"""
The Nucleus — Email automation
Handles: confirmation emails, call reminders, weekly reports
Run via: python3 automations/email.py <command>
Commands: confirm <lead_id>, reminders, weekly_report
"""
import smtplib, json, urllib.request, sys, os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone

GMAIL_USER = "bigfish@testtubemarketing.com"
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "ndcrbnkssmuetnok")
SUPABASE_URL = "https://oirnxlidjgsbcyhtxkse.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pcm54bGlkamdzYmN5aHR4a3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTA0NzYsImV4cCI6MjA4OTc4NjQ3Nn0.tonvjgYhT5Y9jlyIMFa11fjc8k_gGj8m11L0UseOe_s"
WEEKLY_REPORT_RECIPIENTS = ["bigfish@testtubemarketing.com", "ad@testtubemarketing.com"]
WA_TOKEN = "EAAU8j14lU7EBRM4htCZAXLKC5I7knJY4aM59okwNdZBucSXWJxpD8CL2BH1LzrEqE6epAQqRrH3t1EcsDsvZAYowUPm3dd3okIDXhveZBY374fInzUlfZCUJca0bA9ZBgkQReEj8AZCcYfSbmv6oqAfZBN8DBlrlQVDdO6RVKfMAe2gwo7hBCLVhZCs8QgeVW6oy2lAZDZD"
WA_PHONE_ID = "1043445438845393"

def send_whatsapp(to_number, message):
    """Send WhatsApp message. to_number in E.164 format e.g. 447834238110"""
    import json as _json
    payload = _json.dumps({
        "messaging_product": "whatsapp",
        "to": to_number.replace("+", ""),
        "type": "text",
        "text": {"body": message}
    }).encode()
    req = urllib.request.Request(
        f"https://graph.facebook.com/v19.0/{WA_PHONE_ID}/messages",
        data=payload,
        headers={"Authorization": f"Bearer {WA_TOKEN}", "Content-Type": "application/json"}
    )
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        return True
    except Exception as e:
        print(f"  WhatsApp failed: {e}")
        return False
ZOOM_LINK = "https://us06web.zoom.us/j/8792020476"

SB_HEADERS = {"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {SUPABASE_ANON_KEY}"}

def sb_get(path):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", headers=SB_HEADERS)
    return json.load(urllib.request.urlopen(req, timeout=15))

def get_template(key, fallback_subject="", fallback_body=""):
    """Fetch email template from settings table, with fallback."""
    try:
        rows = sb_get(f"settings?key=eq.{key}&select=value")
        return rows[0]['value'] if rows else (fallback_subject if 'subject' in key else fallback_body)
    except:
        return fallback_subject if 'subject' in key else fallback_body

def render_template(template, first_name, call_time):
    """Replace {{placeholders}} in template."""
    import re
    result = template.replace('{{first_name}}', first_name).replace('{{call_time}}', call_time)
    # Strip emojis from plain text (keep for HTML)
    result_plain = re.sub(r'[^\x00-\x7F]+', '', result).strip()
    return result_plain

def sb_patch(path, data):
    payload = json.dumps(data).encode()
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}",
        data=payload, headers={**SB_HEADERS, "Content-Type": "application/json", "Prefer": "return=minimal"}, method='PATCH')
    return urllib.request.urlopen(req, timeout=15).status

def send_email(to, subject, body_text, body_html=None):
    msg = MIMEMultipart('alternative')
    msg['From'] = f"Nick Fisher | Test Tube Marketing <{GMAIL_USER}>"
    msg['To'] = to
    msg['Subject'] = subject
    msg.attach(MIMEText(body_text, 'plain'))
    if body_html:
        msg.attach(MIMEText(body_html, 'html'))
    server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
    server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
    server.sendmail(GMAIL_USER, to, msg.as_string())
    server.quit()
    print(f"  ✓ Sent to {to}")

def fmt_dt(dt_str):
    if not dt_str: return "TBC"
    try:
        dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        return dt.strftime("%A %-d %B at %-I:%M%p GMT").replace("AM","am").replace("PM","pm")
    except: return dt_str[:16]

# ─── CONFIRMATION EMAIL ──────────────────────────────────────────────────────
def send_confirmation(lead_id):
    leads = sb_get(f"leads?id=eq.{lead_id}&select=*")
    if not leads: print("Lead not found"); return
    lead = leads[0]
    name_first = lead['name'].split()[0] if lead.get('name') else "there"
    call_time = fmt_dt(lead.get('call_datetime'))

    # Use DB template if available, otherwise fallback
    subj_tpl = get_template('email_confirmation_subject')
    body_tpl = get_template('email_confirmation_body')

    if subj_tpl:
        subject = render_template(subj_tpl, name_first, call_time)
    else:
        subject = f"Your Marketing Growth Call is confirmed — {call_time}"

    if body_tpl:
        text = render_template(body_tpl, name_first, call_time)
        # Ensure Zoom link is present if template uses placeholder
        if ZOOM_LINK not in text:
            text = text.replace('{{zoom_link}}', ZOOM_LINK)
    else:
        text = f"""Hi {name_first},

Your Marketing Growth Call with Nick Fisher is confirmed.

{call_time}
{ZOOM_LINK}

What to expect:
- 45 minutes - no pitch, no pressure
- We'll talk about your business, your marketing, and what's not working
- You'll get an honest view of where the gaps are
- You can't buy anything on this call

If you need to reschedule, just reply to this email.

Looking forward to speaking with you.

Nick Fisher
Test Tube Marketing
bigfish@testtubemarketing.com
www.testtubemarketing.com
"""
    send_email(lead['email'], subject, text)
    # Also send WhatsApp if phone available
    if lead.get('phone'):
        phone = lead['phone'].replace(' ', '').replace('+', '')
        if not phone.startswith('44'): phone = '44' + phone.lstrip('0')
        wa_msg = f"Hi {name_first}, your Marketing Growth Call with Nick is confirmed for {call_time}. Join here: {ZOOM_LINK}"
        send_whatsapp(phone, wa_msg)
    sb_patch(f"leads?id=eq.{lead_id}", {
        "last_contact_at": datetime.now(timezone.utc).isoformat(),
        "confirm_pending": False,
    })

# ─── PROCESS PENDING CONFIRMATIONS ───────────────────────────────────────────
def process_pending_confirmations():
    """Pick up any leads flagged confirm_pending=true and send their confirmation email."""
    # Only process leads that actually have a call_datetime (no TBC emails)
    pending = sb_get("leads?confirm_pending=eq.true&booking_completed=eq.true&call_datetime=not.is.null&select=id,name,email")
    if not pending:
        print("No pending confirmations")
        return
    for lead in pending:
        print(f"  Sending confirmation to {lead['email']}...")
        send_confirmation(lead['id'])

# ─── REMINDER EMAILS ─────────────────────────────────────────────────────────
def send_reminders():
    now = datetime.now(timezone.utc)
    # Get all booked leads with upcoming calls
    leads = sb_get("leads?stage=eq.booked&booking_completed=eq.true&call_datetime=not.is.null&select=*")
    sent = 0
    for lead in leads:
        if not lead.get('call_datetime') or not lead.get('email'): continue
        call_dt = datetime.fromisoformat(lead['call_datetime'].replace('Z','+00:00'))
        diff_hours = (call_dt - now).total_seconds() / 3600
        name_first = lead['name'].split()[0] if lead.get('name') else "there"
        
        call_time_str = fmt_dt(lead['call_datetime'])

        # 24hr reminder
        if 23 <= diff_hours <= 25:
            subj_tpl = get_template('email_reminder_24h_subject')
            body_tpl = get_template('email_reminder_24h_body')
            subject = render_template(subj_tpl, name_first, call_time_str) if subj_tpl else f"Reminder: Your call with Nick is tomorrow — {call_time_str}"
            text = render_template(body_tpl, name_first, call_time_str) if body_tpl else f"Hi {name_first},\n\nJust a reminder that your Marketing Growth Call with Nick is tomorrow.\n\n{call_time_str}\n{ZOOM_LINK}\n\nSee you then!\n\nNick Fisher | Test Tube Marketing"
            if ZOOM_LINK not in text: text += f"\n\n{ZOOM_LINK}"
            send_email(lead['email'], subject, text)
            sent += 1

        # 3hr reminder
        elif 2.75 <= diff_hours <= 3.25:
            subject = f"Your call with Nick starts in 3 hours"
            text = f"Hi {name_first},\n\nYour Marketing Growth Call with Nick starts in 3 hours.\n\n{call_time_str}\n{ZOOM_LINK}\n\nSee you shortly!\n\nNick Fisher | Test Tube Marketing"
            send_email(lead['email'], subject, text)
            sent += 1

        # 15min reminder
        elif 0.2 <= diff_hours <= 0.35:
            subject = f"Your call with Nick starts in 15 minutes"
            text = f"Hi {name_first},\n\nYour Marketing Growth Call starts in 15 minutes - here's the link:\n\n{ZOOM_LINK}\n\nSee you in a moment!\n\nNick Fisher | Test Tube Marketing"
            send_email(lead['email'], subject, text)
            sent += 1
    
    print(f"Reminders sent: {sent}")

# ─── WEEKLY REPORT ───────────────────────────────────────────────────────────
def send_weekly_report():
    now = datetime.now(timezone.utc)
    week_start = (now - timedelta(days=7)).isoformat()
    next_week_end = (now + timedelta(days=7)).isoformat()
    
    all_leads = sb_get("leads?select=*&limit=500")
    non_spam = [l for l in all_leads if l['stage'] not in ('spam','test','abandoned')]
    
    # This week's activity
    new_bookings = [l for l in non_spam if l.get('booked_at') and l['booked_at'] >= week_start]
    showed = [l for l in non_spam if l['stage'] in ('qualified','proposal_sent','proposal_live','closed_won','closed_lost')]
    proposals = [l for l in non_spam if l.get('proposal_sent_at') and l['proposal_sent_at'] >= week_start]
    won_this_week = [l for l in non_spam if l['stage'] == 'closed_won' and l.get('updated_at') and l['updated_at'] >= week_start]
    
    # Pipeline snapshot
    booked_count = len([l for l in non_spam if l['stage'] == 'booked'])
    proposal_count = len([l for l in non_spam if l['stage'] == 'proposal_sent'])
    live_count = len([l for l in non_spam if l['stage'] == 'proposal_live'])
    live_value = sum(float(l.get('proposal_value') or 0) for l in non_spam if l['stage'] in ('proposal_sent','proposal_live'))
    total_revenue = sum(float(l.get('revenue') or 0) for l in non_spam if l['stage'] == 'closed_won')
    
    # Upcoming calls next 7 days
    upcoming = [l for l in non_spam if l.get('call_datetime') and now.isoformat() <= l['call_datetime'] <= next_week_end]
    upcoming.sort(key=lambda x: x['call_datetime'])
    
    subject = f"Weekly Report — w/c {now.strftime('%-d %b')}"
    text = f"""THE NUCLEUS — WEEKLY REPORT
Week ending {now.strftime('%-d %B %Y')}
{'='*50}

THIS WEEK
---------
New calls booked:     {len(new_bookings)}
Attended calls:       {len([l for l in new_bookings if l['stage'] not in ('booked','no_show')])}
Proposals sent:       {len(proposals)}
Deals closed (won):   {len(won_this_week)}  (£{sum(float(l.get('revenue') or 0) for l in won_this_week):,.0f})

PIPELINE SNAPSHOT
-----------------
Calls booked (upcoming): {booked_count}
Proposals sent (live):   {proposal_count}  (£{live_value:,.0f} total value)
Proposals - deciding:    {live_count}
Revenue closed (all time): £{total_revenue:,.0f}

CALLS NEXT 7 DAYS
-----------------
"""
    for l in upcoming:
        text += f"• {fmt_dt(l.get('call_datetime'))} — {l['name']} ({l.get('industry','?')})\n"
    
    if not upcoming:
        text += "No calls scheduled this week.\n"
    
    text += f"""
---
The Nucleus | Test Tube Marketing
"""
    
    for recipient in WEEKLY_REPORT_RECIPIENTS:
        send_email(recipient, subject, text)

# ─── MAIN ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"
    
    if cmd == "confirm" and len(sys.argv) > 2:
        send_confirmation(sys.argv[2])
    elif cmd == "pending_confirmations":
        process_pending_confirmations()
    elif cmd == "reminders":
        send_reminders()
    elif cmd == "weekly_report":
        send_weekly_report()
    elif cmd == "test":
        send_email(GMAIL_USER, "✅ Nucleus email test", "Email system working correctly.")
    else:
        print("Usage: python3 email.py <confirm <lead_id> | reminders | weekly_report | test>")
