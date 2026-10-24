-- Run after the inventory structure has inventory_id, ingredient_name, and unit.
-- This adds a unit label to each recipe and keeps it aligned with inventory.

alter table public.menu_ingredients add column if not exists unit varchar(20);

-- Restore the known base units provided for Brewora if any inventory unit is blank.
update public.inventory
set unit = case ingredient_name
  when 'Coffee Beans' then 'g'
  when 'Milk' then 'ml'
  when 'Water' then 'ml'
  when 'Ice' then 'g'
  when 'Chocolate Syrup' then 'ml'
  when 'Caramel Syrup' then 'ml'
  when 'Vanilla Syrup' then 'ml'
  when 'White Chocolate Syrup' then 'ml'
  when 'Frappe Powder' then 'g'
  when 'Whipped Cream' then 'g'
  when 'Black Tea' then 'g'
  when 'Earl Grey Tea' then 'g'
  when 'Matcha Powder' then 'g'
  when 'Lemon Juice' then 'ml'
  when 'Sugar' then 'g'
  when 'Sugar Syrup' then 'ml'
  when 'Chocolate Powder' then 'g'
  when 'White Chocolate' then 'g'
  when 'Chocolate Chips' then 'g'
  when 'All-Purpose Flour' then 'g'
  when 'Butter' then 'g'
  when 'Yeast' then 'g'
  when 'Salt' then 'g'
  when 'Blueberries' then 'g'
  when 'Eggs' then 'pcs'
  when 'Baking Powder' then 'g'
  when 'Cocoa Powder' then 'g'
  when 'Baking Soda' then 'g'
  when 'Chocolate' then 'g'
  else unit
end
where unit is null or btrim(unit) = '';

update public.menu_ingredients mi
set unit = i.unit
from public.inventory i
where mi.inventory_id = i.inventory_id;

alter table public.menu_ingredients alter column unit set not null;

create or replace function public.sync_menu_ingredient_names()
returns trigger language plpgsql set search_path = ''
as $$
begin
  select m.name into new.menu_name
  from public.menu_items m where m.id = new.menu_item_id;

  select i.ingredient_name, i.unit
  into new.ingredient_name, new.unit
  from public.inventory i where i.inventory_id = new.inventory_id;

  if new.menu_name is null or new.ingredient_name is null or new.unit is null then
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

create or replace function public.sync_menu_ingredient_inventory_fields()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.ingredient_name is distinct from old.ingredient_name
     or new.unit is distinct from old.unit then
    update public.menu_ingredients
    set ingredient_name = new.ingredient_name, unit = new.unit
    where inventory_id = new.inventory_id;
  end if;
  return new;
end;
$$;

drop trigger if exists inventory_sync_recipe_names on public.inventory;
drop trigger if exists inventory_sync_recipe_fields on public.inventory;
drop function if exists public.sync_menu_ingredient_inventory_name();
create trigger inventory_sync_recipe_fields
after update of ingredient_name, unit on public.inventory
for each row execute function public.sync_menu_ingredient_inventory_fields();

notify pgrst, 'reload schema';

select menu_name, ingredient_name, unit, quantity_required
from public.menu_ingredients
order by menu_name, ingredient_name;
