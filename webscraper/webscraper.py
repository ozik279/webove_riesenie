from openai import OpenAI
import os
import json
import time
import requests
from bs4 import BeautifulSoup, Doctype, Tag
import re
import uploading_to_database as upload

from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent / ".env")

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (compatible; PromotheusScraper/1.0)"
})

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

LIMIT = 12  # Max number of products per page

stores = [
    "billa",
    "kaufland",
    "lidl",
    "metro",
    "tesco",
    "101-drogerie",
    "dm-drogerie",
    "coop-jednota",
    "terno"
]

keywords: dict[str, dict[str, list[str]]] = {
    "02_chladene": {
        "01_maso": [
            "bageta",
            "hovaedzie-maeso",
            "kacacie-maeso",
            "slanina",
            "sunka",
            "salama",
            "parky",
            "klobasa",
            "pasteta",
        ],
        "03_mliecne-vyrobky": [
            "mlieko",
            "maslo",
            "jogurt",
            "jogurtovy-napoj",
            "smotana",
            "tvaroh",
            "dezert",
            "slahacka-sprej",
        ],
        "04_syry": [
            "platkovy-syr",
            "struhany-syr",
            "taveny-syr",
            "mozzarella",
            "parenica",
            "syr-s-plesnou",
            "syrove-nite",
            "salamovy-syr",
            "camembert",
        ],
        "05_ostatne-chladene-potraviny": [
            "vajcia",
            "natierka",
        ],
        "02_ryby": [
            "losos",
            "treska",
            "pstruh",
            "makrela",
            "sumec",
            "tuniak",
        ],
    },
    "01_cerstve": {
        "01_slane_pecivo": [
            "chlieb",
            "bageta",
            "kaiserka",
            "rozok",
            "pagac",
        ],
        "02_sladke_pecivo": [
            "croissant",
            "siska",
            "tasticka",
            "donut",
            "zavin",
            "strudla",
            "vianocka",
            "kolac",
            "buchta",
            "muffiny",
            "vafle",
        ],
        "03_ovocie": [
            "ananas",
            "avokado",
            "banany",
            "broskyne",
            "ceresne",
            "citrony",
            "datle",
            "hrozno",
            "hrusky",
            "jablka",
            "jahody",
            "kaki",
            "maliny",
            "mandarinky",
            "marhule",
            "papaja",
            "pomarance",
            "pomelo",
            "slivky",
            "kompot",
        ],
        "04_zelenina": [
            "bataty",
            "cibula",
            "cesnak",
            "fazula",
            "hrasok",
            "sosovica",
            "karfiol",
            "kapusta",
            "paprika",
            "paradajky",
            "sampinony",
            "uhorka-salatova",
            "zemiaky",
            "salat",
            "mrkva",
            "petrzlen-korenovy",
            "zeler",
        ],
    },
    "04_mrazene": {
        "mrazene-potraviny": [
            "zmrzlina",
            "mrazena-pizza",
            "mrazena-zelenina",
            "zemiakove-krokety",
            "hranolky",
        ],
    },
    "03_trvanlive": {
        "03_sladkosti": [
            "cokolada",
            "susienky",
            "cukriky",
            "oblatka",
            "cokoladova-tycinka",
        ],
        "04_slane-snacky": [
            "chipsy",
            "slane-tycinky",
            "slany-snack",
            "oriesky",
            "popcorn",
        ],
        "01_prilohy": [
            "cestoviny",
            "ryza",
        ],
        "07_olej-a-ocot": [
            "olej",
            "ocot",
        ],
        "06_sladidla-a-koreniny": [
            "cukor",
            "koreniny",
        ],
        "05_omacky-a-dochucovadla": [
            "kecup",
            "horcica",
            "chilli-omacka",
            "omacka-na-cestoviny",
            "tatarska-omacka",
            "hotova-omacka",
        ],
        "02_hotove-a-instantne": [
            "hotove-jedlo",
            "instantne-jedlo",
            "instantna-polievka",
        ],
        "08_ostatne-trvanlive-potraviny": [
            "zuvacky",
            "cerealie",
            "med",
            "muka",
        ],
    },
    "05_napoje": {
        "01_nealkoholicke-napoje": [
            "voda",
            "limonada",
            "ladovy-caj",
            "sirup",
            "caj",
            "kava",
            "ladova-kava",
            "dzus",
            "capri-sun",
            "energeticky-napoj",
            "nealkoholicke-pivo",
        ],
        "02_alkoholicke-napoje": [
            "pivo",
            "vino",
            "rum",
            "vodka",
            "liker",
            "whisky",
        ],
    },
    "06_drogeria-a-kozmetika": {
        "03_drogeria": [
            "cistiaci-prostriedok",
            "avivaz",
            "praci-prostriedok",
            "tablety-do-umyvacky",
            "toaletny-papier",
        ],
        "02_kozmetika": [
            "lak-na-nechty",
            "toaletna-voda",
            "krem",
            "farba-na-vlasy",
            "telove-mlieko",
            "make-up",
        ],
        "01_hygiena": [
            "kondicioner",
            "dezodorant",
            "sampon",
            "sprchovaci-gel",
            "mydlo",
            "zubna-pasta",
            "zubna-kefka",
            "antiperspirant",
            "detske-vlhcene-obrusky",
        ],
    },

    "07_krmiva-pre-zvierata": {
        "01_krmiva-pre-psov": [
            "krmivo-pre-psov",
        ],
        "02_krmiva-pre-macky": [
            "krmivo-pre-macky",
        ],
    },
}


def ai(prompt: str) -> list[dict]:
    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "products": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "name": {"type": ["string", "null"]},
                        "price": {"type": ["number", "null"]},
                        "discount_start": {"type": ["string", "null"]},
                        "discount_end": {"type": ["string", "null"]},
                        "type": {"type": ["string", "null"]},
                        "supermarket": {
                            "type": ["string", "null"],
                            "enum": ["Tesco", "Billa", "Kaufland", "Lidl", "Metro", "101 drogeria",
                                     "dm drogeria", "Terno", "COOP Jednota", None],
                        },
                        "image_of_product": {"type": ["string", "null"]},
                    },
                    "required": [
                        "name",
                        "price",
                        "discount_start",
                        "discount_end",
                        "type",
                        "supermarket",
                        "image_of_product",
                    ],
                },
            }
        },
        "required": ["products"],
    }

    resp = client.responses.create(
        model="gpt-4.1-mini",
        input=[{
            "role": "user",
            "content": [{"type": "input_text", "text": prompt}],
        }],
        text={
            "format": {
                "type": "json_schema",
                "name": "products",
                "strict": True,
                "schema": schema,
            }
        },
    )

    data = json.loads(resp.output_text)
    return data["products"]


def html_to_json(html: list[Tag]) -> list[dict]:
    prompt = (
        "Extract product data from the provided HTML snippet (promotheus.sk).\n"
        "Each product is inside an <a> element with class \"product-card\".\n"
        "If there are N such `<a>` elements, you MUST return N product objects.\n"
        "\n"
        "Within each `product-card`, there is an `product-card-header` where img is located and `product-card-content`, "
        "where all other info about product is located.\n"
        "Typical structure is:\n"
        "- name is inside a span, with class `product-card__monitoring-data`.\n"
        "- price is inside a span.\n"
        "- discount_start and discount_end is in a div with class `product-availability`.\n"
        "- supermarket name in a div with class `product-store`.\n"
        "- product image in an `<img>` tag.\n"
        "\n"
        "Return ONLY JSON that matches the provided JSON schema.\n"
        "\n"
        "Extraction rules:\n"
        "- If a field is missing/unclear, output null.\n"
        "- If no products are found, output an empty products array.\n"
        "- For date fields, if you can extract a date, convert it to format DD-MM-YYYY.\n"
        "\n"
        "Rules for the `type` field (treat this as a BRAND field):\n"
        "Goal: `type` must be a short, stable label used to group products by brand/manufacturer.\n"
        "\n"
        "How to choose `type` (in priority order):\n"
        "1) If the product name clearly begins with a brand/manufacturer, set `type` to that brand.\n"
        "2) If the brand appears later in the name but is clearly identifiable, set `type` to that brand.\n"
        "3) Sometimes the brand may be identified from the odd adjective, for example \"Bratislavské\", "
        "\"Farmárske\", \"Viedenské\", \"Malokarpatská\". Use your best judgement.\n"
        "4) If there is no clear brand (e.g., generic store/commodity items) or you are unsure, set `type` to `žžostatne` \n"
        "\n"
        "Normalization requirements:\n"
        "- Do NOT include variant details in `type` (flavors, sizes, fat %, pack count, 'XX g', '1+1', 'maxi', etc.).\n"
        "- Do NOT include descriptors like: \"with\", \"bez\", \"light\", \"bio\", \"premium\", \"family pack\", etc.\n"
        "- Keep `type` as short as possible while still identifying the brand.\n"
        "- Preserve original capitalization if it looks like a brand (e.g., \"Milka\", \"Lay's\", \"Coca-Cola\").\n"
        "\n"
        "Examples:\n"
        "- \"Milka čokoláda lieskovce 90 g\" -> type: \"Milka\"\n"
        "- \"Lay’s Chips solené 130 g\" -> type: \"Lay’s\"\n"
        "- \"Coca-Cola Zero 1.5 l\" -> type: \"Coca-Cola\"\n"
        "- \"Zlatý Bažant 12% pivo 0.5 l\" -> type: \"Zlatý Bažant\"\n"
        "- \"Fit kuracie rezne\" -> type: \"Fit\"\n"
        "- \"Farmárske kuracie stehná \" -> type: \"Farmárske\"\n"
        "- \"Viedenské párky\" -> type: \"Viedenské\"\n"
        "- \"Banány voľné\" -> type: \"žžostatne\"\n"
        "- \"Kuracie prsia chladené\" -> type: \"žžostatne\"\n"
        "\n"
        "HTML:\n"
        f"{html}\n"
    )

    return ai(prompt)

def save_json(obj, dir_path, file_name):
    # Ensure directory exists
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, file_name)
    # Write JSON with UTF-8 and pretty formatting
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    return file_path

def has_doctype(html: BeautifulSoup) -> bool:
    return any(isinstance(item, Doctype) for item in html.contents)

def build_payload(group: str, category: str, sub_category: str, items: list[dict]) -> dict:
    # Adds metadata and places products under data[]
    return {
        "group": group,
        "category": category,
        "sub_category": sub_category,
        "data": items,
    }

def page_item_key(item: dict) -> tuple:
    return (
        upload.norm(item.get("name")),
        str(item.get("supermarket") or "").strip().lower(),
        item.get("price"),
        item.get("discount_start"),
        item.get("discount_end"),
    )

def deduplicate_page_items(page_items: list[dict]) -> list[dict]:
    seen_keys = set()
    unique_items = []

    for item in page_items:
        if not isinstance(item, dict):
            continue

        key = page_item_key(item)
        if key in seen_keys:
            continue

        seen_keys.add(key)
        unique_items.append(item)

    return unique_items

def fetch_page(sub_category_name: str, page: int, store: str) -> BeautifulSoup | None:
    url = (
        f"https://promotheus.sk/{sub_category_name}"
        f"?productCardGrid-page={page}"
        f"&productCardGrid-order=null"
        f"&productCardGrid-column=null"
        f"&store={store}"
        f"&do=productCardGrid-showProducts")

    try:
        resp = session.get(url, timeout=10)
        resp.raise_for_status()
    except requests.RequestException:
        return None

    return BeautifulSoup(resp.text, "lxml")

def extract_product_cards(html: BeautifulSoup, limit: int) -> list[Tag]:
    cards = []

    for a in html.find_all("a", class_=re.compile(r"\bproduct-card\b")):
        cards.append(a)
        if len(cards) >= limit:
            break

    return cards

def get_product_store_from_card(card_html: Tag) -> str | None:
    store_div = card_html.find("div", class_=re.compile(r"\bproduct-store\b"))

    if not store_div:
        return None

    store = store_div.get_text(strip=True)
    return store or None

def scrape_subcategory(group: str, category_key: str, sub_category_name: str, max_pages: int = 3) -> None:
    ALL_product_cards: list[Tag] = []

    for store in stores:
        product_cards: list[Tag] = []

        html0 = fetch_page(sub_category_name, 0, store)
        if html0 is None:
            continue

        # Validate STORE on page 0 FIRST
        first_card = extract_product_cards(html0, 1)
        raw_store = get_product_store_from_card(first_card[0]) if first_card else None
        store_name = raw_store.lower() if raw_store else None

        if store_name is None or store_name != store.replace("-", " ").lower():
            continue
        ############

        # Collect page 0 products
        cards0 = extract_product_cards(html0, LIMIT)
        if cards0:
            product_cards.extend(cards0)

        index = 1
        while True:
            html = fetch_page(sub_category_name, index, store)
            if html is None or has_doctype(html) or index >= max_pages:
                break

            cards = extract_product_cards(html, LIMIT)
            if cards:
                product_cards.extend(cards)
            index += 1

        if product_cards:
            ALL_product_cards.extend(product_cards)

    # If nothing was collected, nothing to parse
    if not ALL_product_cards:
        print("No products found for subcategory:", sub_category_name)
        return

    # Convert HTML to JSON via AI
    page_items = html_to_json(ALL_product_cards)

    # Deduplicate subcategories (same product may appear on multiple pages, we want only one entry per product)
    page_items = deduplicate_page_items(page_items)

    # Save JSON with metadata
    json_payload = build_payload(group, category_key, sub_category_name, page_items)
    json_path = save_json(json_payload, f"./products_promotheus/{group}/{category_key}", f"{sub_category_name}.json")
    print(f"Saved JSON to: {json_path}")

def scrape_goods(limit: int = 1) -> None:
    count = 0
    start_all = time.time()

    for group in keywords:
        for key in keywords[group]:
            os.makedirs(f"./products_promotheus/{group}/{key}", exist_ok=True)
            for word in keywords[group][key]:
                t0 = time.time()
                scrape_subcategory(group, key, word)
                print(f"Subcategory {group}/{key}/{word} took {time.time() - t0:.2f}s")
                count += 1
                if count >= limit:
                    print(f"Stopped after limit={limit}. Total time: {time.time() - start_all:.2f}s")
                    return

            print(f"Data for category {group}/{key} has been successfully written to jsv files.")

    print("ALL DATA has been successfully written to a jsv files. Total time:", time.time() - start_all)

if __name__ == "__main__":
    scrape_goods()
    upload.upload_all()


