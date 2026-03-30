-- WhatsApp queue for personal-number sending workflow

create table if not exists whatsapp_queue (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  kind text not null default 'confirmation',
  message text not null,
  phone text,
  send_after timestamptz not null default now(),
  status text not null default 'pending',
  sent_at timestamptz,
  failed_at timestamptz,
  fail_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_queue_status_idx on whatsapp_queue(status, send_after);
create index if not exists whatsapp_queue_lead_idx on whatsapp_queue(lead_id);

create trigger whatsapp_queue_updated_at
before update on whatsapp_queue
for each row execute function update_updated_at();

alter table whatsapp_queue enable row level security;
create policy "allow all" on whatsapp_queue for all using (true);
