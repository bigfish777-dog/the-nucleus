create table if not exists public.creative_production_items (
  id text primary key,
  title text not null,
  script text not null,
  stage text not null,
  created_at date not null default current_date,
  updated_at timestamptz not null default now()
);

create or replace function public.update_creative_production_items_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists creative_production_items_updated_at on public.creative_production_items;
create trigger creative_production_items_updated_at
before update on public.creative_production_items
for each row execute function public.update_creative_production_items_updated_at();

alter table public.creative_production_items enable row level security;

drop policy if exists "allow all" on public.creative_production_items;
create policy "allow all" on public.creative_production_items for all using (true) with check (true);
