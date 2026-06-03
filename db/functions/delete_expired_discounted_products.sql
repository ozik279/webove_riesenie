begin
  delete from public.discounted_products dp
  where dp.discount_end < (now() at time zone 'Europe/Bratislava')::date;
end;