-- Run only after supabase_inventory_structure_migration.sql on an existing database.
-- It adds readable menu/ingredient names to existing recipe rows and keeps
-- the names synchronized when the referenced records are renamed.

alter table public.menu_ingredients
  add column if not exists menu_name text,
  add column if not exists ingredient_name text;

update public.menu_ingredients mi
set menu_name = m.name,
    ingredient_name = i.ingredient_name
from public.menu_items m, public.inventory i
where mi.menu_item_id = m.id
  and mi.inventory_id = i.inventory_id;

alter table public.menu_ingredients
  alter column menu_name set not null,
  alter column ingredient_name set not null;

create or replace function public.sync_menu_ingredient_names()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select m.name into new.menu_name
  from public.menu_items m
  where m.id = new.menu_item_id;

  select i.ingredient_name into new.ingredient_name
  from public.inventory i
  where i.inventory_id = new.inventory_id;

  if new.menu_name is null or new.ingredient_name is null then
    raise exception 'Menu item and inventory ingredient must exist.';
  end if;

  return new;
end;
$$;

drop trigger if exists menu_ingredients_sync_names on public.menu_ingredients;
create trigger menu_ingredients_sync_names
before insert or update of menu_item_id, inventory_id
on public.menu_ingredients
for each row execute function public.sync_menu_ingredient_names();

create or replace function public.sync_menu_ingredient_menu_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.name is distinct from old.name then
    update public.menu_ingredients
    set menu_name = new.name
    where menu_item_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists menu_item_sync_recipe_names on public.menu_items;
create trigger menu_item_sync_recipe_names
after update of name on public.menu_items
for each row execute function public.sync_menu_ingredient_menu_name();

create or replace function public.sync_menu_ingredient_inventory_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ingredient_name is distinct from old.ingredient_name then
    update public.menu_ingredients
    set ingredient_name = new.ingredient_name
    where inventory_id = new.inventory_id;
  end if;
  return new;
end;
$$;

drop trigger if exists inventory_sync_recipe_names on public.inventory;
create trigger inventory_sync_recipe_names
after update of ingredient_name on public.inventory
for each row execute function public.sync_menu_ingredient_inventory_name();

notify pgrst, 'reload schema';

-- Verify the backfilled recipe values.
select menu_name, ingredient_name, quantity_required
from public.menu_ingredients
order by menu_name, ingredient_name;
