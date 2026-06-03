import os
import json
import glob
import re
from datetime import datetime, timezone
import unicodedata
from typing import Any

from supabase import create_client, Client

from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent / ".env")

PROJECT_URL = os.getenv("SUPABASE_PROJECT_URL")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def is_valid_discount_period(start: str | None, end: str | None) -> bool:
    if not start or not end:
        return False

    try:
        start_date = datetime.strptime(start, "%Y-%m-%d").date()
        end_date = datetime.strptime(end, "%Y-%m-%d").date()
        return end_date >= start_date
    except ValueError:
        return False

def from_ddmmyyyy_to_yyyymmdd(value: str | None) -> str | None:
    if not value:
        return None

    value = str(value).strip()

    for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            pass

    return None


def strip_diacritics(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def norm(value: Any) -> str:
    if value is None:
        return ""

    s = str(value).strip().lower()
    s = strip_diacritics(s)
    s = s.translate(str.maketrans("", "", "*-‘’'`´"))
    return s


def slugify(value: Any) -> str:
    s = norm(value)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    return s or "unknown"


def normalize_brand(value: Any) -> str:
    if value is None:
        return "žžostatne"

    s = str(value).replace("'", "").replace("`", "").replace("´", "")
    s = s.replace("’", "").replace("‘", "").strip().lower()

    return s if s else "žžostatne"


def parse_price(value: Any) -> float | None:
    if value is None:
        return None

    if isinstance(value, (int, float)):
        return float(value)

    s = str(value).strip()
    s = s.replace("€", "").replace(" ", "").replace(",", ".")

    try:
        return float(s)
    except ValueError:
        return None


def chunked(seq: list[dict], size: int):
    for i in range(0, len(seq), size):
        yield seq[i:i + size]


def has_null_value(row: dict) -> bool:
    return any(value is None for value in row.values())


def load_payload(path: str) -> dict | None:
    try:
        with open(path, "r", encoding="utf-8") as f:
            obj = json.load(f)

        if not isinstance(obj, dict):
            return None

        required = {"group", "category", "sub_category", "data"}
        if not required.issubset(obj.keys()):
            return None

        if not isinstance(obj["data"], list):
            return None

        return obj

    except Exception:
        return None


def check_subcategory(sub_category: Any) -> str:
    if sub_category == "capri-sun":
        sub_category = "dzus"

    if sub_category in {
        "avokado", "broskyne", "ceresne", "datle", "kaki",
        "maliny", "marhule", "papaja", "slivky"
    }:
        sub_category = "žžostatne-ovocie"

    if sub_category in {"citrony", "mandarinky", "pomarance", "pomelo"}:
        sub_category = "citrusy"

    if sub_category == "bataty":
        sub_category = "zemiaky"

    if sub_category in {"fazula", "hrasok", "sosovica"}:
        sub_category = "strukoviny"

    if sub_category in {
        "donut", "zavin", "strudla", "kolac",
        "muffiny", "buchta", "vafle"
    }:
        sub_category = "žžostatne-sladke-pecivo"

    if sub_category in {"mrkva", "zeler", "petrzlen-korenovy"}:
        sub_category = "korenova-zelenina"

    return sub_category


class ImportContext:
    def __init__(self, supabase: Client):
        self.supabase = supabase

        self.groups: dict[str, int] = {}
        self.categories: dict[tuple[int, str], int] = {}
        self.subcategories: dict[str, int] = {}
        self.stores: dict[str, int] = {}
        self.brands: dict[str, int] = {}


def create_run(supabase: Client) -> str:
    now = datetime.now(timezone.utc).isoformat()

    resp = (
        supabase
        .table("runs")
        .insert({"imported_at": now})
        .execute()
    )

    data = resp.data or []

    if not data or "run_id" not in data[0]:
        raise RuntimeError("Failed to create run in table runs.")

    return data[0]["run_id"]


def get_or_create_group(ctx: ImportContext, group_name: Any) -> int:
    if group_name in ctx.groups:
        return ctx.groups[group_name]

    found = (
        ctx.supabase
        .table("product_groups")
        .select("group_id")
        .eq("group_name", group_name)
        .limit(1)
        .execute()
    )

    if found.data:
        group_id = found.data[0]["group_id"]
    else:
        inserted = (
            ctx.supabase
            .table("product_groups")
            .insert({"group_name": group_name})
            .execute()
        )
        group_id = inserted.data[0]["group_id"]

    ctx.groups[group_name] = group_id
    return group_id


def get_or_create_category(ctx: ImportContext, group_id: int, category_name: Any) -> int:
    key = (group_id, category_name)

    if key in ctx.categories:
        return ctx.categories[key]

    found = (
        ctx.supabase
        .table("categories")
        .select("category_id")
        .eq("group_id", group_id)
        .eq("category_name", category_name)
        .limit(1)
        .execute()
    )

    if found.data:
        category_id = found.data[0]["category_id"]
    else:
        inserted = (
            ctx.supabase
            .table("categories")
            .insert({
                "group_id": group_id,
                "category_name": category_name
            })
            .execute()
        )
        category_id = inserted.data[0]["category_id"]

    ctx.categories[key] = category_id
    return category_id


def get_or_create_subcategory(
    ctx: ImportContext,
    category_id: int,
    subcategory_name: str
) -> int:
    subcategory_slug = subcategory_name

    if subcategory_slug in ctx.subcategories:
        return ctx.subcategories[subcategory_slug]

    found = (
        ctx.supabase
        .table("subcategories")
        .select("subcategory_id")
        .eq("subcategory_slug", subcategory_slug)
        .limit(1)
        .execute()
    )

    if found.data:
        subcategory_id = found.data[0]["subcategory_id"]
    else:
        inserted = (
            ctx.supabase
            .table("subcategories")
            .insert({
                "category_id": category_id,
                "subcategory_name": subcategory_name,
                "subcategory_slug": subcategory_slug
            })
            .execute()
        )
        subcategory_id = inserted.data[0]["subcategory_id"]

    ctx.subcategories[subcategory_slug] = subcategory_id
    return subcategory_id


def get_or_create_store(ctx: ImportContext, store_name: Any) -> int:
    if store_name in ctx.stores:
        return ctx.stores[store_name]

    found = (
        ctx.supabase
        .table("stores")
        .select("store_id")
        .eq("store_name", store_name)
        .limit(1)
        .execute()
    )

    if found.data:
        store_id = found.data[0]["store_id"]
    else:
        inserted = (
            ctx.supabase
            .table("stores")
            .insert({
                "store_name": store_name,
                "store_slug": slugify(store_name)
            })
            .execute()
        )
        store_id = inserted.data[0]["store_id"]

    ctx.stores[store_name] = store_id
    return store_id


def get_or_create_brand(ctx: ImportContext, brand_name: str) -> int:
    if brand_name in ctx.brands:
        return ctx.brands[brand_name]

    found = (
        ctx.supabase
        .table("brands")
        .select("brand_id")
        .eq("brand_name", brand_name)
        .limit(1)
        .execute()
    )

    if found.data:
        brand_id = found.data[0]["brand_id"]
    else:
        inserted = (
            ctx.supabase
            .table("brands")
            .insert({"brand_name": brand_name})
            .execute()
        )
        brand_id = inserted.data[0]["brand_id"]

    ctx.brands[brand_name] = brand_id
    return brand_id


def build_discounted_product_rows(
    ctx: ImportContext,
    payload: dict,
    run_id: str
) -> list[dict]:
    group_name = payload.get("group")
    category_name = payload.get("category")
    subcategory_name = check_subcategory(payload.get("sub_category"))

    if not group_name or not category_name or not subcategory_name:
        return []

    group_id = get_or_create_group(ctx, group_name)
    category_id = get_or_create_category(ctx, group_id, category_name)
    subcategory_id = get_or_create_subcategory(ctx, category_id, subcategory_name)

    rows: list[dict] = []

    for item in payload.get("data", []):
        if not isinstance(item, dict):
            continue

        product_name = item.get("name")
        supermarket = item.get("supermarket")
        price = parse_price(item.get("price"))
        discount_start = from_ddmmyyyy_to_yyyymmdd(item.get("discount_start"))
        discount_end = from_ddmmyyyy_to_yyyymmdd(item.get("discount_end"))
        image_url = item.get("image_of_product")

        if not product_name or not supermarket or price is None or not discount_start or not discount_end:
            continue

        if not is_valid_discount_period(discount_start, discount_end):
            print(
                f"Skipping product with invalid discount period: "
                f"{product_name}, start={discount_start}, end={discount_end}"
            )
            continue

        store_id = get_or_create_store(ctx, supermarket)
        brand_id = get_or_create_brand(ctx, normalize_brand(item.get("type")))

        row = {
            "run_id": run_id,
            "store_id": store_id,
            "subcategory_id": subcategory_id,
            "brand_id": brand_id,
            "product_name": product_name,
            "normalized_name": norm(product_name),
            "price": price,
            "discount_start": discount_start,
            "discount_end": discount_end,
            "image_url": image_url
        }

        if has_null_value(row):
            continue

        rows.append(row)

    return rows


def upload_all(root_dir: str = "./products_promotheus", batch_size: int = 500) -> None:
    if not PROJECT_URL:
        raise RuntimeError("Missing env var SUPABASE_PROJECT_URL")

    if not SERVICE_ROLE_KEY:
        raise RuntimeError("Missing env var SUPABASE_SERVICE_ROLE_KEY")

    supabase: Client = create_client(PROJECT_URL, SERVICE_ROLE_KEY)
    ctx = ImportContext(supabase)

    run_id = create_run(supabase)

    paths = glob.glob(os.path.join(root_dir, "**", "*.json"), recursive=True)

    total_rows = 0
    total_files = 0

    for path in paths:
        payload = load_payload(path)

        if not payload:
            continue

        rows = build_discounted_product_rows(ctx, payload, run_id)

        if not rows:
            continue

        total_files += 1

        for batch in chunked(rows, batch_size):
            resp = (
                supabase
                .table("discounted_products")
                .upsert(
                    batch,
                    on_conflict="store_id,subcategory_id,normalized_name,price,discount_start,discount_end"
                )
                .execute()
            )

            _ = resp.data
            total_rows += len(batch)

        print(f"Uploaded {len(rows)} rows from: {path}")

    print(f"Done. run_id: {run_id}, Files: {total_files}, Rows: {total_rows}")


if __name__ == "__main__":
    upload_all()
