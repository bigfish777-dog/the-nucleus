"""
Phase 6 — OpenClaw Automation Layer
Runs scheduled jobs to keep The Nucleus current automatically.

Jobs:
  meta_pull    — Pull Meta ad performance data (daily)
  fireflies    — Process Fireflies transcripts after calls
  stale_check  — Flag stale leads (daily)
  
Usage: python3 automations/phase6.py <job>
"""
import sys, json, urllib.request, urllib.parse, os
from datetime import datetime, timedelta, timezone

SUPABASE_URL = "https://oirnxlidjgsbcyhtxkse.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pcm54bGlkamdzYmN5aHR4a3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTA0NzYsImV4cCI6MjA4OTc4NjQ3Nn0.tonvjgYhT5Y9jlyIMFa11fjc8k_gGj8m11L0UseOe_s")
META_TOKEN = "EAAVZAQllKN0gBRIKDYTRYdpuAyFB9d8rntGWBlZCllFj1GzLAsEaoAPpKGsTLfjemm17jPkdzfb9hB5tXE9rvUsqyl5UXn6MkNNh9Vteg8l5AUZAjZBShkEXzxMVt3GdnKhW9LZCBZAh2OZC52ctSsKJn7NfmQ6IzvtkSOp8fhsRXMHm9RZC6bKTTHyDlMUZC04CYOAZDZD"
META_CAMPAIGN = "120237526110540006"
FIREFLIES_KEY = "d88ef847-bf1a-4166-9f50-7d2d3e0f49c3"

SB_H = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"}

def sb_get(path):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", headers=SB_H)
    return json.load(urllib.request.urlopen(req, timeout=15))

def sb_patch(path, data):
    payload = json.dumps(data).encode()
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", data=payload,
        headers={**SB_H, "Prefer": "return=minimal"}, method='PATCH')
    return urllib.request.urlopen(req, timeout=15).status

def sb_upsert(table, data, conflict="id"):
    payload = json.dumps(data).encode()
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{table}",
        data=payload, headers={**SB_H, "Prefer": f"resolution=merge-duplicates,return=minimal"}, method='POST')
    return urllib.request.urlopen(req, timeout=30).status

# ─── META AD PERFORMANCE PULL ────────────────────────────────────────────────
def pull_meta_ads():
    """Pull yesterday's ad performance from Meta and upsert into Supabase."""
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime('%Y-%m-%d')
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    params = urllib.parse.urlencode({
        'fields': 'ad_id,ad_name,spend,impressions,clicks',
        'time_range': json.dumps({'since': yesterday, 'until': today}),
        'level': 'ad',
        'access_token': META_TOKEN,
        'limit': 100
    })
    url = f"https://graph.facebook.com/v19.0/{META_CAMPAIGN}/insights?{params}"
    req = urllib.request.Request(url)
    data = json.load(urllib.request.urlopen(req, timeout=30))
    
    ads = data.get('data', [])
    print(f"Meta: {len(ads)} ads with data for {yesterday}")
    
    # Get creative ID mapping from Supabase
    creatives = sb_get("ad_creatives?select=id,meta_creative_id,name")
    creative_map = {c['meta_creative_id']: c['id'] for c in creatives if c.get('meta_creative_id')}
    
    inserted = 0
    for ad in ads:
        ad_id = ad.get('ad_id', ad.get('ad_name', ''))
        creative_id = creative_map.get(ad_id)
        if not creative_id:
            # Try to find by name
            for c in creatives:
                if c['name'] and ad.get('ad_name') and c['name'][:30] in ad.get('ad_name', ''):
                    creative_id = c['id']
                    break
        if not creative_id:
            continue
        
        import uuid as _uuid
        perf = [{
            'id': str(_uuid.uuid4()),
            'creative_id': creative_id,
            'date': yesterday,
            'spend': float(ad.get('spend', 0)),
            'impressions': int(ad.get('impressions', 0)),
            'clicks': int(ad.get('clicks', 0)),
        }]
        try:
            sb_upsert('ad_performance_daily', perf, conflict='creative_id,date')
            inserted += 1
        except: pass
    
    print(f"  Upserted: {inserted} performance records")

# ─── FIREFLIES TRANSCRIPT PROCESSING ─────────────────────────────────────────
def process_fireflies():
    """Check for new Fireflies transcripts matching booked leads, process with analysis."""
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(hours=2)).isoformat()
    
    # Get booked leads whose call was recent (last 24 hrs)
    recent_cutoff = (now - timedelta(hours=24)).isoformat()
    leads = sb_get(f"leads?stage=eq.booked&call_datetime=gte.{recent_cutoff}&select=id,name,email,call_datetime,call_notes_auto")
    print(f"Fireflies: {len(leads)} recent booked calls to check")
    
    # Get transcripts from Fireflies
    fh = {"x-api-key": FIREFLIES_KEY, "Content-Type": "application/json"}
    query = '{"query":"{ transcripts(limit:20) { id title date participants { email } summary { action_items overview } } }"}'
    req = urllib.request.Request("https://api.fireflies.ai/graphql",
        data=query.encode(), headers=fh)
    try:
        transcripts = json.load(urllib.request.urlopen(req, timeout=30))
        meetings = transcripts.get('data', {}).get('transcripts', [])
        print(f"  {len(meetings)} recent Fireflies transcripts")
    except Exception as e:
        print(f"  Fireflies error: {e}")
        return
    
    matched = 0
    for lead in leads:
        lead_email = (lead.get('email') or '').lower()
        lead_name = (lead.get('name') or '').lower()
        
        for meeting in meetings:
            participants = [p.get('email','').lower() for p in meeting.get('participants', [])]
            title = meeting.get('title', '').lower()
            
            if lead_email in participants or any(part in lead_name for part in lead_name.split()):
                summary = meeting.get('summary', {})
                overview = summary.get('overview', '')
                actions = '; '.join(summary.get('action_items', []))
                
                note = f"Fireflies summary: {overview}"
                if actions:
                    note += f"\nActions: {actions}"
                
                sb_patch(f"leads?id=eq.{lead['id']}", {
                    'stage': 'qualified',  # Attended call — move to awaiting proposal
                    'call_notes_auto': note,
                    'last_contact_at': now.isoformat()
                })
                print(f"  ✓ Matched + updated: {lead['name']}")
                matched += 1
                break
    
    print(f"  Matched: {matched}/{len(leads)}")

# ─── STALE LEAD DETECTION ─────────────────────────────────────────────────────
def check_stale():
    """Flag leads with no contact in 14+ days."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    stale = sb_get(f"leads?last_contact_at=lte.{urllib.parse.quote(cutoff)}&select=id,name,stage,last_contact_at&limit=100")
    stale = [l for l in stale if l.get("stage") in ("booked","proposal_sent","proposal_live")]
    print(f"Stale leads (14+ days no contact): {len(stale)}")
    for l in stale[:5]:
        days = (datetime.now(timezone.utc) - datetime.fromisoformat(l['last_contact_at'].replace('Z','+00:00'))).days
        print(f"  {l['name']} | {l['stage']} | {days} days")

# ─── MAIN ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    job = sys.argv[1] if len(sys.argv) > 1 else "help"
    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Running: {job}\n")
    
    if job == "meta_pull":
        pull_meta_ads()
    elif job == "fireflies":
        process_fireflies()
    elif job == "stale_check":
        check_stale()
    elif job == "all":
        pull_meta_ads()
        process_fireflies()
        check_stale()
    else:
        print("Usage: python3 phase6.py <meta_pull | fireflies | stale_check | all>")
