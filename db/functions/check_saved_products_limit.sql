declare
  c integer;
begin
  
  if exists (
    select 1
    from public.saved_products sp
    where sp.user_id = new.user_id
      and sp.discounted_product_id = new.discounted_product_id
  ) then
    return new;
  end if;

  select count(*) into c
  from public.saved_products sp
  where sp.user_id = new.user_id;

  if c >= 100 then
    raise exception 'You can only save up to 100 products.'
      using errcode = 'P0001';
  end if;

  return new;
end;