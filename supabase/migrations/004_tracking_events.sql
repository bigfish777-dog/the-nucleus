create table if not exists tracking_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  event_type text not null,
  page_path text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tracking_events_created_at_idx on tracking_events(created_at desc);
create index if not exists tracking_events_event_type_idx on tracking_events(event_type);
create index if not exists tracking_events_page_path_idx on tracking_events(page_path);
create index if not exists tracking_events_session_id_idx on tracking_events(session_id);

alter table tracking_events enable row level security;

drop policy if exists "allow insert tracking events" on tracking_events;
create policy "allow insert tracking events" on tracking_events for insert with check (true);

drop policy if exists "allow read tracking events" on tracking_events;
create policy "allow read tracking events" on tracking_events for select using (true);

alter table leads add column if not exists fbclid text;
alter table leads add column if not exists fbp text;
alter table leads add column if not exists fbc text;
alter table leads add column if not exists event_source_url text;
alter table leads add column if not exists purchase_event_id text;
alter table leads add column if not exists meta_purchase_sent_at timestamptz;
alter table leads add column if not exists meta_purchase_response jsonb;
alter table leads add column if not exists website text;
alter table leads add column if not exists challenge text;
alter table leads add column if not exists readiness text;
