create table public.brands (
  brand_id integer generated always as identity not null,
  brand_name text not null,
  constraint brands_pkey primary key (brand_id),
  constraint brands_brand_name_key unique (brand_name)
) TABLESPACE pg_default;

create table public.categories (
  category_id integer generated always as identity not null,
  group_id integer not null,
  category_name text not null,
  constraint categories_pkey primary key (category_id),
  constraint categories_group_category_unique unique (group_id, category_name),
  constraint categories_group_id_fkey foreign KEY (group_id) references product_groups (group_id) on delete RESTRICT
) TABLESPACE pg_default;

create table public.discounted_products (
  discounted_product_id uuid not null default gen_random_uuid (),
  run_id uuid not null,
  store_id integer not null,
  subcategory_id integer not null,
  brand_id integer not null,
  product_name text not null,
  normalized_name text not null,
  price numeric(5, 2) not null,
  discount_start date not null,
  discount_end date not null,
  image_url text not null,
  constraint discounted_products_pkey primary key (discounted_product_id),
  constraint discounted_products_unique unique (
    store_id,
    subcategory_id,
    normalized_name,
    price,
    discount_start,
    discount_end
  ),
  constraint discounted_products_run_id_fkey foreign KEY (run_id) references runs (run_id) on delete RESTRICT,
  constraint discounted_products_store_id_fkey foreign KEY (store_id) references stores (store_id) on delete RESTRICT,
  constraint discounted_products_subcategory_id_fkey foreign KEY (subcategory_id) references subcategories (subcategory_id) on delete RESTRICT,
  constraint discounted_products_brand_id_fkey foreign KEY (brand_id) references brands (brand_id) on delete RESTRICT,
  constraint discounted_products_price_check check ((price >= (0)::numeric)),
  constraint discounted_products_dates_check check ((discount_end >= discount_start))
) TABLESPACE pg_default;

create index IF not exists discounted_products_normalized_name_trgm_idx on public.discounted_products using gin (normalized_name gin_trgm_ops) TABLESPACE pg_default;

create index IF not exists discounted_products_store_id_idx on public.discounted_products using btree (store_id) TABLESPACE pg_default;

create index IF not exists discounted_products_brand_id_idx on public.discounted_products using btree (brand_id) TABLESPACE pg_default;

create index IF not exists discounted_products_subcategory_id_idx on public.discounted_products using btree (subcategory_id) TABLESPACE pg_default;

create index IF not exists discounted_products_discount_end_idx on public.discounted_products using btree (discount_end) TABLESPACE pg_default;

create index IF not exists discounted_products_price_idx on public.discounted_products using btree (price) TABLESPACE pg_default;

create view public.navigation_menu
with
  (security_invoker = true) as
select distinct
  pg.group_id,
  pg.group_name,
  c.category_id,
  c.category_name,
  sc.subcategory_id,
  sc.subcategory_name,
  sc.subcategory_slug
from
  discounted_products dp
  join subcategories sc on sc.subcategory_id = dp.subcategory_id
  join categories c on c.category_id = sc.category_id
  join product_groups pg on pg.group_id = c.group_id
where
  dp.discount_end >= (now() at time zone 'Europe/Bratislava')::date
order by
  pg.group_name,
  c.category_name,
  sc.subcategory_name;

create table public.product_groups (
  group_id integer generated always as identity not null,
  group_name text not null,
  constraint product_groups_pkey primary key (group_id),
  constraint product_groups_group_name_key unique (group_name)
) TABLESPACE pg_default;

create table public.runs (
  run_id uuid not null default gen_random_uuid (),
  imported_at timestamp with time zone not null default now(),
  constraint runs_pkey primary key (run_id)
) TABLESPACE pg_default;

create table public.saved_products (
  user_id uuid not null,
  discounted_product_id uuid not null,
  saved_at timestamp with time zone not null default now(),
  constraint saved_products_pkey primary key (user_id, discounted_product_id),
  constraint saved_products_discounted_product_id_fkey foreign KEY (discounted_product_id) references discounted_products (discounted_product_id) on delete CASCADE,
  constraint saved_products_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists saved_products_user_id_idx on public.saved_products using btree (user_id) TABLESPACE pg_default;

create trigger trg_check_saved_products_limit BEFORE INSERT on saved_products for EACH row
execute FUNCTION check_saved_products_limit ();

create table public.stores (
  store_id integer generated always as identity not null,
  store_name text not null,
  store_slug text not null,
  constraint stores_pkey primary key (store_id),
  constraint stores_store_name_key unique (store_name),
  constraint stores_store_slug_key unique (store_slug)
) TABLESPACE pg_default;

create table public.subcategories (
  subcategory_id integer generated always as identity not null,
  category_id integer not null,
  subcategory_name text not null,
  subcategory_slug text not null,
  constraint subcategories_pkey primary key (subcategory_id),
  constraint subcategories_category_name_unique unique (category_id, subcategory_name),
  constraint subcategories_subcategory_slug_key unique (subcategory_slug),
  constraint subcategories_category_id_fkey foreign KEY (category_id) references categories (category_id) on delete RESTRICT
) TABLESPACE pg_default;