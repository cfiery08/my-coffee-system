-- Allow admins to delete ingredients without deleting their movement history.
-- Existing recipe links are removed with the ingredient; movement rows keep
-- ingredient/unit snapshots and become detached from the live inventory row.

alter table public.menu_ingredients
  drop constraint if exists menu_ingredients_inventory_id_fkey;
alter table public.menu_ingredients
  add constraint menu_ingredients_inventory_id_fkey
  foreign key (inventory_id) references public.inventory(inventory_id) on delete cascade;

alter table public.inventory_movements
  add column if not exists ingredient_name_snapshot varchar(100);
alter table public.inventory_movements
  add column if not exists unit_snapshot varchar(20);
update public.inventory_movements im
set ingredient_name_snapshot = coalesce(im.ingredient_name_snapshot, i.ingredient_name),
    unit_snapshot = coalesce(im.unit_snapshot, i.unit)
from public.inventory i
where im.inventory_id = i.inventory_id
  and (im.ingredient_name_snapshot is null or im.unit_snapshot is null);

alter table public.inventory_movements
  drop constraint if exists inventory_movements_inventory_id_fkey;
alter table public.inventory_movements
  alter column inventory_id drop not null;
alter table public.inventory_movements
  add constraint inventory_movements_inventory_id_fkey
  foreign key (inventory_id) references public.inventory(inventory_id) on delete set null;

create or replace function public.snapshot_inventory_movement_ingredient()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.inventory_id is not null and (new.ingredient_name_snapshot is null or new.unit_snapshot is null) then
    select i.ingredient_name, i.unit
    into new.ingredient_name_snapshot, new.unit_snapshot
    from public.inventory i where i.inventory_id = new.inventory_id;
  end if;
  return new;
end;
$$;
drop trigger if exists inventory_movement_snapshot_ingredient on public.inventory_movements;
create trigger inventory_movement_snapshot_ingredient
  before insert or update of inventory_id on public.inventory_movements
  for each row execute function public.snapshot_inventory_movement_ingredient();

notify pgrst, 'reload schema';
