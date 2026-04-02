#!/usr/bin/env python3
"""
Lead Review — Interactive CLI for auditing all contacts in Supabase.

Goes through leads one by one, shows current status, and lets you
correct stage, add proposal value, revenue, or notes on the spot.
Changes are applied directly to Supabase as you go.

Usage:
  python3 automations/lead-review.py           # all leads needing attention
  python3 automations/lead-review.py --all     # every lead, no filter
  python3 automations/lead-review.py --stage showed
"""

import sys, json, urllib.request, os
from datetime import datetime, timezone

SUPABASE_URL = "https://oirnxlidjgsbcyhtxkse.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pcm54bGlkamdzYmN5aHR4a3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTA0NzYsImV4cCI6MjA4OTc4NjQ3Nn0.tonvjgYhT5Y9jlyIMFa11fjc8k_gGj8m11L0UseOe_s")
SB_H = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"}

# ── Stages ──────────────────────────────────────────────────────────────────
STAGE_KEYS = {
    'b': 'booked',
    's': 'showed',
    'q': 'qualified',
    'p': 'proposal_sent',
    'v': 'proposal_live',
    'w': 'closed_won',
    'l': 'closed_lost',
    'n': 'no_show',
    'd': 'disqualified',
    'a': 'abandoned',
    'c': 'cancelled',
    'x': None,  # skip
}

STAGE_LABEL = {
    'booked': 'Booked', 'showed': 'Showed', 'qualified': 'Qualified',
    'proposal_sent': 'Proposal Sent', 'proposal_live': 'Proposal Live',
    'closed_won': '✓ Closed Won', 'closed_lost': '✗ Closed Lost',
    'no_show': 'No-Show', 'disqualified': "Disqualified", 'abandoned': 'Abandoned',
    'cancelled': 'Cancelled', 'spam': 'Spam', 'test': 'Test',
    'second_call_booked': '2nd Call Booked', 'second_call_no_show': '2nd No-Show',
}

# Stages considered "done" — skip by default unless --all
DONE_STAGES = {'closed_won', 'closed_lost', 'disqualified', 'spam', 'test', 'no_show', 'cancelled'}

# ── Supabase helpers ─────────────────────────────────────────────────────────
def sb_get(path):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", headers=SB_H)
    return json.load(urllib.request.urlopen(req, timeout=15))

def sb_patch(table, id_, data):
    payload = json.dumps({**data, 'updated_at': datetime.now(timezone.utc).isoformat()}).encode()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{table}?id=eq.{id_}",
        data=payload,
        headers={**SB_H, "Prefer": "return=minimal"},
        method='PATCH'
    )
    urllib.request.urlopen(req, timeout=15)

# ── Formatting ───────────────────────────────────────────────────────────────
def fmt_date(dt_str):
    if not dt_str:
        return '—'
    try:
        dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        return dt.strftime('%-d %b %Y')
    except:
        return dt_str[:10]

def days_ago(dt_str):
    if not dt_str:
        return ''
    try:
        dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        d = (datetime.now(timezone.utc) - dt).days
        return f"{d}d ago"
    except:
        return ''

def stage_display(stage):
    return STAGE_LABEL.get(stage, stage)

def ask(prompt, default=''):
    try:
        val = input(prompt)
        return val.strip() if val.strip() else default
    except (KeyboardInterrupt, EOFError):
        print('\n\nExiting.')
        sys.exit(0)

# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    show_all = '--all' in sys.argv
    filter_stage = None
    if '--stage' in sys.argv:
        idx = sys.argv.index('--stage')
        if idx + 1 < len(sys.argv):
            filter_stage = sys.argv[idx + 1]

    print('\n🔄 Fetching leads from Supabase...')
    leads = sb_get('leads?select=*&order=call_datetime.asc.nullslast&limit=500')
    print(f'   {len(leads)} leads loaded.\n')

    # Filter
    if filter_stage:
        leads = [l for l in leads if l.get('stage') == filter_stage]
    elif not show_all:
        leads = [l for l in leads if l.get('stage') not in DONE_STAGES]

    if not leads:
        print('No leads to review with current filter.')
        return

    # Sort: showed/booked/qualified first, then others
    priority = {'showed': 0, 'booked': 1, 'qualified': 2, 'proposal_sent': 3, 'proposal_live': 4,
                'abandoned': 5, 'second_call_booked': 6}
    leads.sort(key=lambda l: (priority.get(l.get('stage',''), 9), l.get('call_datetime') or ''))

    total = len(leads)
    updated = 0

    print(f'Reviewing {total} leads. Press Enter to keep current stage, or use shortcuts below.\n')
    print('  b=booked  s=showed  q=qualified  p=proposal_sent  v=proposal_live')
    print('  w=closed_won  l=closed_lost  n=no_show  d=disqualified  a=abandoned  c=cancelled')
    print('  x=skip  Enter=keep  Ctrl+C=quit\n')

    for i, lead in enumerate(leads):
        name = lead.get('name') or '(no name)'
        stage = lead.get('stage') or '?'
        email = lead.get('email') or ''
        call_dt = lead.get('call_datetime') or ''
        last_contact = lead.get('last_contact_at') or ''
        industry = lead.get('industry') or ''
        revenue_range = lead.get('revenue_range') or ''
        proposal_value = lead.get('proposal_value')
        revenue = lead.get('revenue')

        # Header
        print(f'{"─" * 60}')
        print(f'[{i+1}/{total}]  {name}')
        print(f'  Stage:    {stage_display(stage)}')
        if email:
            print(f'  Email:    {email}')
        if call_dt:
            print(f'  Call:     {fmt_date(call_dt)}  ({days_ago(call_dt)})')
        if last_contact and last_contact != call_dt:
            print(f'  Last:     {fmt_date(last_contact)}  ({days_ago(last_contact)})')
        if industry or revenue_range:
            print(f'  Business: {industry}  {revenue_range}')
        if proposal_value:
            print(f'  Proposal: £{float(proposal_value):,.0f}')
        if revenue:
            print(f'  Revenue:  £{float(revenue):,.0f}')
        print()

        raw = ask('  > ').lower()

        if raw == '' or raw == 'k':
            continue  # keep

        if raw == 'x':
            continue  # explicit skip

        new_stage = STAGE_KEYS.get(raw)
        if new_stage is None and raw not in STAGE_KEYS:
            print('  ⚠ Unknown key — skipping.\n')
            continue

        if new_stage == stage:
            print('  (unchanged)\n')
            continue

        changes = {'stage': new_stage}

        # Follow-up prompts
        if new_stage == 'closed_won':
            val = ask('  Revenue (£, Enter to skip): ')
            if val:
                try:
                    changes['revenue'] = float(val.replace('£','').replace(',',''))
                except: pass
            pval = ask('  Proposal value (£, Enter to skip): ')
            if pval:
                try:
                    changes['proposal_value'] = float(pval.replace('£','').replace(',',''))
                except: pass
            close_date = ask('  Close date (YYYY-MM-DD, Enter = today): ')
            if close_date:
                try:
                    changes['last_contact_at'] = datetime.strptime(close_date, '%Y-%m-%d').replace(tzinfo=timezone.utc).isoformat()
                except: pass

        elif new_stage in ('closed_lost', 'disqualified', 'abandoned'):
            reason = ask('  Reason (Enter to skip): ')
            if reason:
                changes['close_reason'] = reason

        elif new_stage in ('proposal_sent', 'proposal_live', 'qualified'):
            pval = ask('  Proposal value (£, Enter to skip): ')
            if pval:
                try:
                    changes['proposal_value'] = float(pval.replace('£','').replace(',',''))
                    changes['proposal_sent'] = True
                except: pass

        note = ask('  Add note? (Enter to skip): ')
        if note:
            changes['call_notes_manual'] = note

        # Apply
        try:
            sb_patch('leads', lead['id'], changes)
            print(f'  ✓ Updated → {stage_display(new_stage)}\n')
            updated += 1
        except Exception as e:
            print(f'  ✗ Error: {e}\n')

    print(f'\n{"═" * 60}')
    print(f'Done. {updated}/{total} leads updated.')

if __name__ == '__main__':
    main()
