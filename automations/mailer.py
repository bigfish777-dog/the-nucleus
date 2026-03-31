"""
The Nucleus — Email automation
Handles: confirmation emails, call reminders, weekly reports, WhatsApp confirmations
Run via: python3 automations/email.py <command>
Commands: confirm <lead_id>, reminders, weekly_report, process_whatsapp_queue
"""
import smtplib, json, urllib.request, urllib.parse, sys, os, re, html, subprocess
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

GMAIL_USER = "bigfish@testtubemarketing.com"
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "ndcrbnkssmuetnok")
SUPABASE_URL = "https://oirnxlidjgsbcyhtxkse.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pcm54bGlkamdzYmN5aHR4a3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTA0NzYsImV4cCI6MjA4OTc4NjQ3Nn0.tonvjgYhT5Y9jlyIMFa11fjc8k_gGj8m11L0UseOe_s"
WEEKLY_REPORT_RECIPIENTS = ["bigfish@testtubemarketing.com", "ad@testtubemarketing.com"]
OPENCLAW_BIN = os.environ.get("OPENCLAW_BIN", "/data/.npm-global/bin/openclaw")
UK_TZ = ZoneInfo("Europe/London")
WA_SEND_HOUR_START = 8
WA_SEND_HOUR_END = 21

def send_whatsapp(to_number, message):
    """Send WhatsApp message via OpenClaw's authenticated personal-number session."""
    normalized = format_phone_uk(to_number)
    if not normalized:
        print("  WhatsApp failed: missing or invalid phone")
        return False
    target = f"+{normalized}"
    try:
        result = subprocess.run(
            [
                OPENCLAW_BIN,
                "message",
                "send",
                "--channel", "whatsapp",
                "--target", target,
                "--message", message,
                "--json",
            ],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
    except Exception as e:
        print(f"  WhatsApp failed: {e}")
        return False

    if result.returncode == 0:
        try:
            payload = json.loads(result.stdout or "{}")
            message_id = (((payload or {}).get("payload") or {}).get("result") or {}).get("messageId")
            if message_id:
                print(f"  ✓ WhatsApp sent to {target} ({message_id})")
            else:
                print(f"  ✓ WhatsApp sent to {target}")
        except Exception:
            print(f"  ✓ WhatsApp sent to {target}")
        return True

    err = (result.stderr or result.stdout or "unknown error").strip()
    print(f"  WhatsApp failed: {err}")
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

def render_template(template, first_name, call_time, zoom_link=ZOOM_LINK):
    """Replace {{placeholders}} in template."""
    return (
        template
        .replace('{{first_name}}', first_name)
        .replace('{{call_time}}', call_time)
        .replace('{{zoom_link}}', zoom_link)
        .strip()
    )

def sb_patch(path, data):
    payload = json.dumps(data).encode()
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}",
        data=payload, headers={**SB_HEADERS, "Content-Type": "application/json", "Prefer": "return=minimal"}, method='PATCH')
    return urllib.request.urlopen(req, timeout=15).status

def sb_post(path, data, prefer="return=minimal"):
    payload = json.dumps(data).encode()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        data=payload,
        headers={**SB_HEADERS, "Content-Type": "application/json", "Prefer": prefer},
        method='POST'
    )
    return urllib.request.urlopen(req, timeout=15)


def format_phone_uk(phone):
    if not phone:
        return None
    cleaned = re.sub(r'[^\d+]', '', phone).replace('+', '')
    if cleaned.startswith('44'):
        return cleaned
    if cleaned.startswith('0'):
        return '44' + cleaned[1:]
    return '44' + cleaned


def within_whatsapp_hours(now=None):
    now = now or datetime.now(timezone.utc)
    local = now.astimezone(UK_TZ)
    return WA_SEND_HOUR_START <= local.hour < WA_SEND_HOUR_END


def next_whatsapp_send_time(now=None):
    now = now or datetime.now(timezone.utc)
    local = now.astimezone(UK_TZ)
    if local.hour < WA_SEND_HOUR_START:
        target = local.replace(hour=WA_SEND_HOUR_START, minute=0, second=0, microsecond=0)
    else:
        target = (local + timedelta(days=1)).replace(hour=WA_SEND_HOUR_START, minute=0, second=0, microsecond=0)
    return target.astimezone(timezone.utc)


def whatsapp_link(phone, message):
    phone = format_phone_uk(phone)
    if not phone:
        return None
    from urllib.parse import quote
    return f"https://wa.me/{phone}?text={quote(message)}"


def plain_text_to_html(body_text):
    """Convert plain-text-ish email copy into a simple HTML version with clickable links."""
    body_html = html.escape(body_text)

    # Markdown links: [Label](https://example.com)
    body_html = re.sub(
        r'\[([^\]]+)\]\((https?://[^)]+)\)',
        lambda m: f'<a href="{m.group(2)}">{m.group(1)}</a>',
        body_html
    )

    # Bare URLs
    body_html = re.sub(
        r'(?<!["=])(https?://[^\s<]+)',
        lambda m: f'<a href="{m.group(1)}">{m.group(1)}</a>',
        body_html
    )

    # Bullet lines
    body_html = re.sub(r'(?m)^- (.+)$', r'• \1', body_html)

    paragraphs = [p.strip() for p in body_html.split('\n\n') if p.strip()]
    html_parts = []
    for paragraph in paragraphs:
        html_parts.append(f"<p>{paragraph.replace(chr(10), '<br>')}</p>")

    return ''.join(html_parts)


def send_email(to, subject, body_text, body_html=None):
    msg = MIMEMultipart('alternative')
    msg['From'] = f"Nick Fisher | Test Tube Marketing <{GMAIL_USER}>"
    msg['To'] = to
    msg['Subject'] = subject
    if body_html is None:
        body_html = plain_text_to_html(body_text)
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


def queue_whatsapp_confirmation(lead):
    if not lead.get('phone'):
        return False
    name_first = lead['name'].split()[0] if lead.get('name') else "there"
    call_time = fmt_dt(lead.get('call_datetime'))
    msg_tpl = get_template('whatsapp_confirmation')
    message = render_template(msg_tpl, name_first, call_time) if msg_tpl else f"Hey {name_first} — just confirming our call for {call_time}. Zoom link: {ZOOM_LINK}"
    send_after = datetime.now(timezone.utc) if within_whatsapp_hours() else next_whatsapp_send_time()
    payload = {
        "lead_id": lead['id'],
        "kind": "confirmation",
        "message": message,
        "phone": format_phone_uk(lead.get('phone')),
        "send_after": send_after.isoformat(),
        "status": "pending",
    }
    try:
        sb_post('whatsapp_queue', payload)
        return True
    except Exception as e:
        print(f"  WhatsApp queue failed: {e}")
        return False


def process_whatsapp_queue():
    now_iso = urllib.parse.quote(datetime.now(timezone.utc).isoformat(), safe='')
    try:
        queued = sb_get(f"whatsapp_queue?status=eq.pending&send_after=lte.{now_iso}&order=created_at.asc&select=*")
    except Exception as e:
        print(f"WhatsApp queue fetch failed: {e}")
        return

    if not queued:
        print("No WhatsApp messages ready")
        return

    print(f"WhatsApp ready: {len(queued)}")
    for item in queued:
        phone = item.get('phone')
        message = item.get('message', '')
        if not phone or not message:
            sb_patch(f"whatsapp_queue?id=eq.{item['id']}", {
                "status": "failed",
                "failed_at": datetime.now(timezone.utc).isoformat(),
                "fail_reason": "missing phone or message"
            })
            continue

        if send_whatsapp(phone, message):
            sb_patch(f"whatsapp_queue?id=eq.{item['id']}", {
                "status": "sent",
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "fail_reason": None
            })
        else:
            sb_patch(f"whatsapp_queue?id=eq.{item['id']}", {
                "status": "failed",
                "failed_at": datetime.now(timezone.utc).isoformat(),
                "fail_reason": "openclaw send failed"
            })

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
    # Queue WhatsApp confirmation for personal-number workflow
    if lead.get('phone'):
        queue_whatsapp_confirmation(lead)
    sb_patch(f"leads?id=eq.{lead_id}", {
        "last_contact_at": datetime.now(timezone.utc).isoformat(),
        "confirm_pending": False,
    })

# ─── PROCESS PENDING CONFIRMATIONS ───────────────────────────────────────────
def process_pending_confirmations():
    """Pick up any leads flagged confirm_pending=true and send their confirmation email."""
    # Only process leads that actually have a call_datetime (no TBC emails)
    pending = sb_get("leads?confirm_pending=eq.true&booking_completed=eq.true&call_datetime=not.is.null&select=id,name,email,phone,call_datetime")
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
            if ZOOM_LINK not in text:
                text += f"\n\n{ZOOM_LINK}"
            send_email(lead['email'], subject, text)
            sent += 1

        # 3hr reminder
        elif 2.75 <= diff_hours <= 3.25:
            subj_tpl = get_template('email_reminder_3h_subject')
            body_tpl = get_template('email_reminder_3h_body')
            subject = render_template(subj_tpl, name_first, call_time_str) if subj_tpl else "Your call with Nick starts in 3 hours"
            text = render_template(body_tpl, name_first, call_time_str) if body_tpl else f"Hi {name_first},\n\nYour Marketing Growth Call with Nick starts in 3 hours.\n\n{call_time_str}\n{ZOOM_LINK}\n\nSee you shortly!\n\nNick Fisher | Test Tube Marketing"
            if ZOOM_LINK not in text:
                text += f"\n\n{ZOOM_LINK}"
            send_email(lead['email'], subject, text)
            sent += 1

        # 15min reminder
        elif 0.2 <= diff_hours <= 0.35:
            subj_tpl = get_template('email_reminder_15min_subject')
            body_tpl = get_template('email_reminder_15min_body')
            subject = render_template(subj_tpl, name_first, call_time_str) if subj_tpl else "Your call with Nick starts in 15 minutes"
            text = render_template(body_tpl, name_first, call_time_str) if body_tpl else f"Hi {name_first},\n\nYour Marketing Growth Call starts in 15 minutes - here's the link:\n\n{ZOOM_LINK}\n\nSee you in a moment!\n\nNick Fisher | Test Tube Marketing"
            if ZOOM_LINK not in text:
                text += f"\n\n{ZOOM_LINK}"
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
    elif cmd == "process_whatsapp_queue":
        process_whatsapp_queue()
    elif cmd == "test":
        send_email(GMAIL_USER, "✅ Nucleus email test", "Email system working correctly.")
    else:
        print("Usage: python3 email.py <confirm <lead_id> | pending_confirmations | reminders | weekly_report | process_whatsapp_queue | test>")
