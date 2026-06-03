with base as (
    select
        dp.product_name as name,
        dp.normalized_name,
        dp.price::double precision as price,
        dp.discount_start,
        dp.discount_end,

        s.store_name as supermarket,
        dp.image_url as image_of_product,

        b.brand_name as type,
        c.category_name as category,
        sc.subcategory_name as sub_category,
        pg.group_name as "group",

        dp.discounted_product_id::text,
        r.imported_at
    from public.discounted_products dp
    join public.stores s
        on s.store_id = dp.store_id
    join public.brands b
        on b.brand_id = dp.brand_id
    join public.subcategories sc
        on sc.subcategory_id = dp.subcategory_id
    join public.categories c
        on c.category_id = sc.category_id
    join public.product_groups pg
        on pg.group_id = c.group_id
    join public.runs r
        on r.run_id = dp.run_id
    where
        (p_supermarket is null or s.store_name = p_supermarket)
        and (p_category is null or c.category_name = p_category)
        and (
            p_sub_category is null
            or sc.subcategory_name = p_sub_category
            or sc.subcategory_slug = p_sub_category
        )
        and (p_type is null or b.brand_name = p_type)
        and (p_group is null or pg.group_name = p_group)
        and (
            p_tokens is null
            or array_length(p_tokens, 1) is null
            or (
                select bool_and(
                    dp.normalized_name ilike ('%' || t || '%')
                    or coalesce(c.category_name, '') ilike ('%' || t || '%')
                    or coalesce(sc.subcategory_name, '') ilike ('%' || t || '%')
                    or coalesce(s.store_name, '') ilike ('%' || t || '%')
                    or coalesce(b.brand_name, '') ilike ('%' || t || '%')
                )
                from unnest(p_tokens) as t
            )
        )
        and dp.discount_end >= (now() at time zone 'Europe/Bratislava')::date
),
dedup as (
    select distinct on (b.normalized_name, b.supermarket, b.price)
        b.name,
        b.normalized_name,
        b.price,
        b.discount_start,
        b.discount_end,
        b.supermarket,
        b.image_of_product,
        b.type,
        b.category,
        b.sub_category,
        b."group",
        b.discounted_product_id
    from base b
    order by
        b.normalized_name,
        b.supermarket,
        b.price,
        b.imported_at desc,
        b.discounted_product_id desc
)
select
    d.name,
    d.normalized_name,
    d.price,
    d.discount_start,
    d.discount_end,
    d.supermarket,
    d.image_of_product,
    d.type,
    d.category,
    d.sub_category,
    d."group",
    d.discounted_product_id
from dedup d
order by
    case when p_price_sort = 'asc' then d.price end asc nulls last,
    case when p_price_sort = 'desc' then d.price end desc nulls last,
    d.name asc
limit greatest(0, (p_to - p_from + 1))
offset greatest(0, p_from);