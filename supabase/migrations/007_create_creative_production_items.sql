create table if not exists creative_production_items (
  id text primary key,
  title text not null,
  script text not null,
  stage text not null,
  created_at date not null default current_date,
  updated_at timestamptz not null default now()
);

create or replace function update_creative_production_items_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger creative_production_items_updated_at
before update on creative_production_items
for each row execute function update_creative_production_items_updated_at();

alter table creative_production_items enable row level security;
create policy "allow all" on creative_production_items for all using (true);
