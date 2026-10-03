-- short name: bidders show to each other as "Ada L."
create or replace function shortName(name text)
returns text
language sql
immutable
as $$
  select split_part(name, ' ', 1) || coalesce(' ' || nullif(left(split_part(name, ' ', 2), 1), '') || '.', '');
$$;
