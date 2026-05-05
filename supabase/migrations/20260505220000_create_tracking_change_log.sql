create table if not exists tracking_change_log (
  id uuid primary key default gen_random_uuid(),
  change_date date not null,
  note text not null,
  variant text not null default 'both' check (variant in ('a', 'b', 'both')),
  created_at timestamptz not null default now()
);

create index if not exists tracking_change_log_change_date_idx on tracking_change_log(change_date desc);
create index if not exists tracking_change_log_created_at_idx on tracking_change_log(created_at desc);

alter table tracking_change_log enable row level security;
create policy "allow all" on tracking_change_log for all using (true);
