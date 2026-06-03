select
        dp.discounted_product_id::text,
        dp.product_name as name,
        dp.normalized_name,
        dp.price::double precision as price,
        dp.discount_start,
        dp.discount_end,
        s.store_name as supermarket,
        dp.image_url as image_of_product,
        b.brand_name as type,
        sc.subcategory_name as sub_category,
        c.category_name as category,
        pg.group_name as "group"
    from public.saved_products sp
    join public.discounted_products dp
        on dp.discounted_product_id = sp.discounted_product_id
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
    where sp.user_id = auth.uid()
      and dp.discount_end >= (now() at time zone 'Europe/Bratislava')::date
    order by dp.product_name asc;