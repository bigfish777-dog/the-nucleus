#!/usr/bin/env python3
"""
Lead Review — Sequential interview CLI for auditing all contacts.

Walks through each lead with a mini-interview based on what happened:
  1. Did they show up?
  2. Were they qualified?
  3. Was a proposal sent? (+ value)
  4. What happened to it? (open / won / lost)

Applies changes directly to Supabase as you go.

Usage:
  python3 automations/lead-review.py           # all leads, call-date order
  python3 automations/lead-review.py --stage showed
"""

import sys, json, urllib.request, os
from datetime import datetime, timezone

SUPABASE_URL = "https://oirnxlidjgsbcyhtxkse.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pcm54bGlkamdzYmN5aHR4a3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTA0NzYsImV4cCI6MjA4OTc4NjQ3Nn0.tonvjgYhT5Y9jlyIMFa11fjc8k_gGj8m11L0UseOe_s")
SB_H = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"}

SKIP_STAGES = {'spam', 'test'}  # never worth reviewing

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

def fmt_date(dt_str):
    if not dt_str: return '—'
    try:
        dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        return dt.strftime('%-d %b %Y')
    except: return dt_str[:10]

def days_ago(dt_str):
    if not dt_str: return ''
    try:
        dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        d = (datetime.now(timezone.utc) - dt).days
        return f"{d}d ago"
    except: return ''

def ask(prompt, default=None):
    """Prompt user. Shows default in brackets. Returns stripped input or default."""
    hint = f' [{default}]' if default is not None else ''
    try:
        val = input(f'  {prompt}{hint}: ').strip()
        if val == '' and default is not None:
            return str(default)
        return val
    except (KeyboardInterrupt, EOFError):
        print('\n\nExiting.')
        sys.exit(0)

def ask_yn(prompt, default=None):
    """Ask yes/no. Returns True/False/None (None = skip/don't know)."""
    if default is True: hint = 'Y/n/skip'
    elif default is False: hint = 'y/N/skip'
    else: hint = 'y/n/skip'
    try:
        val = input(f'  {prompt} [{hint}]: ').strip().lower()
        if val == '': return default
        if val in ('y', 'yes'): return True
        if val in ('n', 'no'): return False
        if val in ('s', 'skip', '?'): return None
        return default
    except (KeyboardInterrupt, EOFError):
        print('\n\nExiting.')
        sys.exit(0)

def ask_money(prompt, current=None):
    """Ask for a £ value. Returns float or None."""
    hint = f'£{float(current):,.0f}' if current else 'Enter to skip'
    try:
        val = input(f'  {prompt} [{hint}]: ').strip().replace('£','').replace(',','')
        if val == '':
            return float(current) if current else None
        return float(val)
    except (ValueError, KeyboardInterrupt, EOFError):
        return float(current) if current else None

def interview(lead):
    """
    Run the sequential interview for one lead.
    Returns a dict of field updates, or None if nothing changed.
    """
    stage = lead.get('stage') or 'booked'
    changes = {}

    # ── Q1: Did they show? ───────────────────────────────────────────────────
    # Pre-fill based on current stage
    currently_showed = stage not in ('booked', 'no_show', 'cancelled')
    currently_no_show = stage == 'no_show'

    if currently_no_show:
        showed = ask_yn('Did they show up to the call?', default=False)
    elif currently_showed:
        showed = ask_yn('Did they show up to the call?', default=True)
    else:
        showed = ask_yn('Did they show up to the call?')

    if showed is None:
        return None  # skipped
    if not showed:
        if stage != 'no_show':
            changes['stage'] = 'no_show'
        return changes or None

    # ── Q2: Were they qualified / a good fit? ────────────────────────────────
    currently_qualified = stage in ('qualified', 'second_call_booked', 'proposal_sent',
                                     'proposal_live', 'closed_won', 'closed_lost', 'abandoned')
    qualified = ask_yn('Were they a good fit / qualified?', default=True if currently_qualified else None)

    if qualified is None:
        # Don't know — just mark as showed
        if stage not in ('showed', 'qualified', 'proposal_sent', 'proposal_live', 'closed_won', 'closed_lost'):
            changes['stage'] = 'showed'
        return changes or None

    if not qualified:
        reason = ask('Disqualified reason (Enter to skip)')
        new_stage = 'disqualified'
        if stage != new_stage:
            changes['stage'] = new_stage
        if reason:
            changes['close_reason'] = reason
        return changes or None

    # ── Q3: Was a proposal sent? ─────────────────────────────────────────────
    currently_proposal = stage in ('proposal_sent', 'proposal_live', 'closed_won', 'closed_lost', 'abandoned')
    proposal_sent = ask_yn('Was a proposal sent?', default=True if currently_proposal else None)

    if proposal_sent is None:
        if stage not in ('showed', 'qualified', 'proposal_sent', 'proposal_live', 'closed_won', 'closed_lost'):
            changes['stage'] = 'qualified'
        return changes or None

    if not proposal_sent:
        if stage not in ('showed', 'qualified'):
            changes['stage'] = 'qualified'
        return changes or None

    # Proposal was sent — get value
    current_pval = lead.get('proposal_value')
    pval = ask_money('Proposal value (£)', current=current_pval)
    if pval and pval != current_pval:
        changes['proposal_value'] = pval
        changes['proposal_sent'] = True

    # ── Q4: What happened to the proposal? ───────────────────────────────────
    if stage == 'closed_won':
        default_outcome = 'w'
    elif stage == 'closed_lost':
        default_outcome = 'l'
    elif stage in ('proposal_sent', 'proposal_live'):
        default_outcome = 'o'
    else:
        default_outcome = None

    hint = 'w' if default_outcome == 'w' else ('l' if default_outcome == 'l' else ('o' if default_outcome == 'o' else '?'))
    try:
        outcome = input(f'  Proposal outcome — [o]pen / [w]on / [l]ost [{hint}]: ').strip().lower()
        if outcome == '' and default_outcome:
            outcome = default_outcome
    except (KeyboardInterrupt, EOFError):
        print('\n\nExiting.')
        sys.exit(0)

    if outcome == 'o':
        if stage not in ('proposal_sent', 'proposal_live'):
            changes['stage'] = 'proposal_sent'

    elif outcome == 'w':
        if stage != 'closed_won':
            changes['stage'] = 'closed_won'
        rev = ask_money('Revenue closed (£)', current=lead.get('revenue'))
        if rev:
            changes['revenue'] = rev
        close_date = ask('Close date (YYYY-MM-DD, Enter = keep current)')
        if close_date:
            try:
                changes['last_contact_at'] = datetime.strptime(close_date, '%Y-%m-%d').replace(tzinfo=timezone.utc).isoformat()
            except: pass

    elif outcome == 'l':
        if stage != 'closed_lost':
            changes['stage'] = 'closed_lost'
        reason = ask('Lost reason (e.g. budget, competitor, timing)', default=lead.get('close_reason'))
        if reason and reason != lead.get('close_reason'):
            changes['close_reason'] = reason

    # ── Optional note ────────────────────────────────────────────────────────
    note = ask('Add/update note? (Enter to skip)')
    if note:
        changes['call_notes_manual'] = note

    return changes or None


def main():
    filter_stage = None
    if '--stage' in sys.argv:
        idx = sys.argv.index('--stage')
        if idx + 1 < len(sys.argv):
            filter_stage = sys.argv[idx + 1]

    print('\n🔄 Fetching leads from Supabase...')
    leads = sb_get('leads?select=*&order=call_datetime.asc.nullslast&limit=500')
    print(f'   {len(leads)} leads loaded.\n')

    # Filter
    leads = [l for l in leads if l.get('stage') not in SKIP_STAGES]
    if filter_stage:
        leads = [l for l in leads if l.get('stage') == filter_stage]
    # Only leads that had a call booked (exclude pure opt-ins with no call)
    leads = [l for l in leads if l.get('booking_completed') or l.get('call_datetime')]

    if not leads:
        print('No leads to review.')
        return

    total = len(leads)
    updated = 0

    print(f'Reviewing {total} leads in call-date order.')
    print('Answer each question — press Enter to keep the current value, "skip" if unsure.\n')

    for i, lead in enumerate(leads):
        name = lead.get('name') or '(no name)'
        stage = lead.get('stage') or '?'
        email = lead.get('email') or ''
        call_dt = lead.get('call_datetime') or ''
        industry = lead.get('industry') or ''
        revenue_range = lead.get('revenue_range') or ''
        proposal_value = lead.get('proposal_value')
        revenue = lead.get('revenue')

        print(f'{"─" * 56}')
        print(f'[{i+1}/{total}]  {name}')
        line2 = []
        if call_dt: line2.append(f'Call {fmt_date(call_dt)} ({days_ago(call_dt)})')
        if industry: line2.append(industry)
        if revenue_range: line2.append(revenue_range)
        if line2: print(f'  {" · ".join(line2)}')
        status_line = f'  Current: {stage}'
        if proposal_value: status_line += f'  ·  proposal £{float(proposal_value):,.0f}'
        if revenue: status_line += f'  ·  revenue £{float(revenue):,.0f}'
        print(status_line)
        print()

        changes = interview(lead)

        if changes:
            try:
                sb_patch('leads', lead['id'], changes)
                summary = changes.get('stage', stage)
                if changes.get('revenue'): summary += f" · £{changes['revenue']:,.0f} revenue"
                elif changes.get('proposal_value'): summary += f" · £{changes['proposal_value']:,.0f} proposal"
                print(f'  ✓ Saved → {summary}\n')
                updated += 1
            except Exception as e:
                print(f'  ✗ Error saving: {e}\n')
        else:
            print('  (no changes)\n')

    print(f'\n{"═" * 56}')
    print(f'Done. {updated}/{total} leads updated in Supabase.')

if __name__ == '__main__':
    main()
