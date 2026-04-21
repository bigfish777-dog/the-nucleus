#!/usr/bin/env python3
"""
Deterministic TTM Proposal Builder v2
Usage: python3 proposal-builder.py <job_id>

New approach: Claude converts the Google Doc directly to HTML sections
using the template's CSS classes. No intermediate JSON schema.
About Us + Results sections are appended in code — never generated.
"""
import json, sys, os, re, urllib.request, urllib.error
from base64 import b64encode

# ── Config from env ───────────────────────────────────────────────────────────
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://oirnxlidjgsbcyhtxkse.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pcm54bGlkamdzYmN5aHR4a3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTA0NzYsImV4cCI6MjA4OTc4NjQ3Nn0.tonvjgYhT5Y9jlyIMFa11fjc8k_gGj8m11L0UseOe_s")

GITHUB_OWNER = "bigfish777-dog"
GITHUB_REPO = "proposal-template"
A = "https://proposals.testtubemarketing.com/assets"

# ── Helpers ───────────────────────────────────────────────────────────────────
def api_request(url, data=None, headers=None, method=None):
    if data and isinstance(data, dict):
        data = json.dumps(data).encode()
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    return urllib.request.urlopen(req, timeout=120)

def supabase_headers():
    return {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"}

def update_job(job_id, status, error=None):
    body = {"status": status}
    if error:
        body["error"] = error[:500]
    api_request(f"{SUPABASE_URL}/rest/v1/proposal_jobs?id=eq.{job_id}",
        data=body, headers=supabase_headers(), method="PATCH")

def fetch_job(job_id):
    resp = api_request(f"{SUPABASE_URL}/rest/v1/proposal_jobs?id=eq.{job_id}&select=*",
        headers=supabase_headers())
    jobs = json.loads(resp.read())
    if not jobs: raise ValueError(f"Job {job_id} not found")
    return jobs[0]

# ── Google Doc fetch ──────────────────────────────────────────────────────────
def fetch_doc(url):
    m = re.search(r'/document/d/([a-zA-Z0-9_-]+)', url)
    if not m: raise ValueError("Invalid Google Doc URL")
    r = urllib.request.urlopen(
        f"https://docs.google.com/document/d/{m.group(1)}/export?format=txt", timeout=30)
    return r.read().decode("utf-8")

# ── Claude: convert doc to HTML sections ──────────────────────────────────────
def doc_to_html_sections(doc_text):
    prompt = f"""You are converting a marketing proposal document into HTML sections for a website.

OUTPUT RULES:
1. Return ONLY the HTML sections. No doctype, head, style, body tags, or explanation.
2. Use these exact CSS classes:

SECTION WRAPPER: <section class="sec" id="s{{N}}" data-label="{{Section Title}}"> or <section class="sec sec-alt" ...> for alternating backgrounds. Start numbering from s1.
INNER WRAPPER: <div class="fi"> wraps all content inside each section.
HEADING: <h2 class="sec-h">{{heading}}</h2>
BODY TEXT: <div class="body"><p>...</p></div>
BOLD: <strong>...</strong>
ITALIC: <em>...</em>
BULLET LIST: <ul class="dlist"><li>...</li></ul>
CALLOUT/QUOTE: <div class="callout">...</div>
SUBHEADING: <p style="font-weight:700;margin-top:16px;margin-bottom:4px;">...</p>
PHASE/WORKSTREAM TAG: <div class="ws-block"><div class="ws-tag">WORKSTREAM 1</div><div class="ws-title">Title</div>...content...</div>
PRICING BOX: <div class="price-box"><h3>Title</h3><div class="price-row"><span class="lbl">Label</span><span class="val">£X+VAT</span></div><p class="price-note">Note</p></div>
NEXT STEPS: <ol class="steps"><li><div class="step-n">1</div><span>Text</span></li></ol>
SIGN-OFF: <div class="sign-off">Closing line<span class="name">Fish (Nick Fisher)</span><span class="details">Test Tube Marketing - bigfish@testtubemarketing.com</span></div>

3. Alternate sections between "sec" and "sec sec-alt" for visual rhythm.
4. EVERY paragraph, heading, bullet point, and section from the doc MUST appear in the output. Do NOT skip, summarise, or truncate anything.
5. Pricing values: always use £ symbol, no spaces before +VAT. E.g. £2,995+VAT not "2,995 pounds + VAT".
6. No em dashes or en dashes. Use hyphens (-) only.
7. The FIRST section should be the opening/personal message (everything before the first ## heading). Use the first ## heading text as the section heading if there is one, otherwise use "My take."
8. Do NOT include any "About Us", "About Test Tube Marketing", "Results", or "Testimonials" sections. Those are added separately.
9. Do NOT include a cover section. Start from the first content section.
10. In the pricing box, keep the price VALUE (e.g. £2,995+VAT) in the <span class="val"> and put ONLY the label (e.g. "Initial Setup") in <span class="lbl">. Description text goes in the body ABOVE the pricing box, not inside the price rows.

Here is the Google Doc to convert:

{doc_text}"""

    body = json.dumps({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 16384,
        "messages": [{"role": "user", "content": prompt}]
    }).encode()

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
        }
    )
    resp = urllib.request.urlopen(req, timeout=120)
    result = json.loads(resp.read())
    text = result["content"][0]["text"].strip()
    # Strip markdown fences if present
    text = re.sub(r'^```html?\s*\n?', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\n?```\s*$', '', text)
    return text

# ── Extract client name from doc ──────────────────────────────────────────────
def extract_client_name(doc_text):
    """Try to find client name from the doc title or first line."""
    body = json.dumps({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 100,
        "messages": [{"role": "user", "content": f"What is the client's name in this proposal? Reply with ONLY the name, nothing else.\n\n{doc_text[:2000]}"}]
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
        }
    )
    resp = urllib.request.urlopen(req, timeout=30)
    result = json.loads(resp.read())
    return result["content"][0]["text"].strip()

# ── Assemble full page ────────────────────────────────────────────────────────
def assemble_page(client_name, sections_html, slug):
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>{client_name} - Test Tube Marketing Proposal</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,600;0,700;0,800;0,900;1,400;1,600&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{{--pink:#E8185A;--teal:#4DD9D0;--white:#fff;--text:#2D2D2D;--muted:#6B7280;--light:#F5F6F8;--green:#1A5C4A;}}
*{{box-sizing:border-box;margin:0;padding:0;}}
html{{scroll-behavior:smooth;}}
body{{font-family:'Inter',system-ui,sans-serif;color:var(--text);background:#fff;overflow-x:hidden;}}
.cover{{min-height:100vh;background:radial-gradient(ellipse at 65% 75%,#1A5C6B 0%,#0B2A45 45%,#060F1C 100%);color:white;padding:48px 56px;display:flex;flex-direction:column;justify-content:space-between;}}
.cover-date{{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--pink);margin-bottom:16px;}}
.cover-logo{{max-height:48px;width:auto;}}
.cover-h1{{font-family:'Poppins',sans-serif;font-weight:900;font-size:clamp(52px,11vw,96px);line-height:.95;letter-spacing:-.03em;margin:56px 0 24px;}}
.cover-sub{{font-size:clamp(15px,1.8vw,19px);color:var(--teal);line-height:1.6;max-width:540px;}}
.cover-credits{{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:64px;}}
.credit-label{{font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--pink);margin-bottom:6px;}}
.credit-name{{font-family:'Poppins',sans-serif;font-size:18px;font-weight:600;color:var(--teal);}}
.sec{{min-height:100vh;padding:96px 56px;display:flex;flex-direction:column;justify-content:center;}}
.sec-alt{{background:var(--light);}}
.sec-h{{font-family:'Poppins',sans-serif;font-size:clamp(32px,5vw,54px);font-weight:800;color:var(--pink);line-height:1.05;letter-spacing:-.02em;margin-bottom:36px;}}
.body{{max-width:720px;font-size:clamp(15px,1.4vw,17px);line-height:1.8;}}
.body p{{margin-bottom:18px;}}.body p:last-child{{margin-bottom:0;}}.body strong{{font-weight:600;}}.body em{{font-style:italic;}}
.callout{{background:white;border-left:3px solid var(--pink);padding:18px 24px;border-radius:0 8px 8px 0;margin:24px 0;font-style:italic;font-size:16px;line-height:1.65;max-width:700px;}}
.sec-alt .callout{{background:white;}}
.ws-tag{{display:inline-block;background:var(--pink);color:white;font-size:11px;font-weight:600;padding:3px 10px;border-radius:99px;letter-spacing:.04em;margin-bottom:10px;}}
.ws-title{{font-family:'Poppins',sans-serif;font-size:26px;font-weight:700;margin-bottom:8px;}}
.ws-block{{margin-top:28px;max-width:720px;}}
.dlist{{list-style:none;display:flex;flex-direction:column;gap:13px;max-width:700px;margin-top:16px;}}
.dlist li{{display:flex;align-items:flex-start;gap:10px;font-size:16px;line-height:1.65;}}
.dlist li::before{{content:'*';color:var(--pink);font-weight:900;font-size:20px;line-height:1.3;flex-shrink:0;}}
.price-box{{background:linear-gradient(135deg,#060F1C 0%,#0F3D5C 100%);border-radius:14px;padding:40px 48px;max-width:660px;margin-top:28px;color:white;}}
.price-box h3{{font-family:'Poppins',sans-serif;font-size:20px;font-weight:700;color:var(--teal);margin-bottom:24px;}}
.price-row{{display:flex;justify-content:space-between;align-items:baseline;padding:13px 0;border-bottom:1px solid rgba(255,255,255,.1);font-size:16px;gap:16px;}}
.price-row:last-of-type{{border-bottom:none;}}
.price-row .lbl{{color:rgba(255,255,255,.8);}}.price-row .val{{font-weight:700;font-size:19px;flex-shrink:0;}}
.price-note{{margin-top:20px;font-size:13px;color:rgba(255,255,255,.6);line-height:1.65;}}
.steps{{list-style:none;display:flex;flex-direction:column;gap:18px;max-width:680px;margin-top:24px;}}
.steps li{{display:flex;align-items:flex-start;gap:14px;font-size:16px;line-height:1.65;}}
.step-n{{width:34px;height:34px;border-radius:50%;background:var(--pink);color:white;font-family:'Poppins',sans-serif;font-weight:700;font-size:15px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}}
.sign-off{{margin-top:52px;font-size:16px;line-height:1.9;}}
.sign-off .name{{font-weight:700;font-size:17px;margin-top:12px;display:block;}}
.sign-off .details{{font-style:italic;display:block;font-size:15px;color:var(--muted);}}
.about-sec{{background:white;}}
.about-wrap{{display:grid;grid-template-columns:1fr 1.2fr;gap:64px;align-items:start;max-width:960px;}}
.about-h{{font-family:'Poppins',sans-serif;line-height:1.05;letter-spacing:-.02em;margin-bottom:24px;}}
.about-h .about-word{{font-weight:300;font-style:italic;color:var(--muted);font-size:clamp(32px,4vw,46px);display:block;}}
.about-h .brand{{font-weight:800;color:var(--pink);font-size:clamp(34px,4.5vw,50px);display:block;}}
.team-col{{display:flex;flex-direction:column;}}
.team-header{{font-family:'Poppins',sans-serif;font-weight:700;font-size:13px;letter-spacing:.12em;text-transform:uppercase;text-align:center;margin-bottom:20px;}}
.team-row{{display:flex;align-items:center;gap:14px;padding:6px 0;}}
.team-photo{{width:54px;height:54px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid #f0f0f0;}}
.t-name{{font-weight:600;font-size:14px;}}.t-role{{font-size:12px;color:var(--muted);margin-top:1px;}}
.testi-sec{{background:var(--light);}}
.testi-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;margin-top:36px;}}
.tcard{{background:white;border-radius:12px;padding:26px;display:flex;flex-direction:column;gap:10px;box-shadow:0 2px 10px rgba(0,0,0,.06);}}
.tresult{{font-family:'Poppins',sans-serif;font-size:19px;font-weight:800;color:var(--green);text-transform:uppercase;line-height:1.1;}}
.tquote{{font-size:13.5px;line-height:1.65;font-style:italic;flex:1;}}
.tperson{{display:flex;align-items:center;gap:10px;margin-top:8px;}}
.tphoto{{width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;}}
.tname{{font-weight:700;font-size:13px;}}.tco{{font-size:12px;color:var(--muted);}}
.nav-dots{{position:fixed;right:18px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:9px;z-index:100;}}
.dot{{width:7px;height:7px;border-radius:50%;background:rgba(200,200,200,.5);cursor:pointer;border:none;padding:0;transition:all .2s;}}
.dot.active{{background:var(--pink);transform:scale(1.5);}}
.footer{{background:#060F1C;color:rgba(255,255,255,.4);text-align:center;padding:28px 24px;font-size:12px;line-height:1.8;}}
.footer a{{color:rgba(255,255,255,.5);}}
.fi{{opacity:0;transform:translateY(20px);transition:opacity .65s ease,transform .65s ease;}}
.fi.vis{{opacity:1;transform:translateY(0);}}
@media(max-width:768px){{.cover{{padding:32px 24px;}}.sec{{padding:64px 24px;min-height:auto;}}.about-wrap{{grid-template-columns:1fr;gap:36px;}}.nav-dots{{display:none;}}}}
@media(max-width:520px){{.price-box{{padding:24px 20px;}}.price-row{{flex-direction:column;gap:2px;padding:10px 0;}}.price-row .val{{font-size:16px;}}.price-row .lbl{{font-size:13px;}}}}
</style>
</head>
<body>
<nav class="nav-dots" id="navDots"></nav>

<!-- COVER -->
<section class="cover" id="s0" data-label="Cover">
<div><div class="cover-date"></div><img class="cover-logo" src="{A}/ttm-logo.png" alt="Test Tube Marketing"/></div>
<div><h1 class="cover-h1">Project<br/>Proposal</h1><p class="cover-sub">A proposal prepared exclusively for {client_name}</p></div>
<div class="cover-credits"><div><div class="credit-label">Presented to:</div><div class="credit-name">{client_name}</div></div><div><div class="credit-label">Presented by:</div><div class="credit-name">Test Tube Marketing</div></div></div>
</section>

<!-- GENERATED SECTIONS -->
{sections_html}

<!-- ══════════════════════════════════════════════════════════════════════ -->
<!-- LOCKED: ABOUT US — hardcoded, never generated                       -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
<section class="sec about-sec" data-label="About Us"><div class="fi about-wrap"><div><h2 class="about-h"><span class="about-word">About</span><span class="brand">Test Tube<br/>Marketing</span></h2><div class="body"><p><strong>Hi, we're Ad and Fish, the founders of Test Tube Marketing.</strong></p><p>Between us, we've been running marketing campaigns, building funnels, and making sales online for over 25 years.</p><p>Unlike other agencies, who will try and force your business to fit their model, we take a completely unique approach to every client we work with. Our experienced team takes the time to understand your business, your goals, and your unique skills, to ensure we can deliver the results you're looking for.</p></div></div><div class="team-col"><div class="team-header">THE TEAM</div><div class="team-row"><img class="team-photo" src="{A}/sm_Adam.jpg" alt="Adam Ashburn"/><div><div class="t-name">Adam Ashburn</div><div class="t-role">Co-Founder</div></div></div><div class="team-row"><img class="team-photo" src="{A}/sm_Fish.jpg" alt="Nick Fisher"/><div><div class="t-name">Nick 'Big Fish' Fisher</div><div class="t-role">Co-Founder</div></div></div><div class="team-row"><img class="team-photo" src="{A}/Grace.png" alt="Grace Harrold"/><div><div class="t-name">Grace Harrold</div><div class="t-role">Head of Client Happiness</div></div></div><div class="team-row"><img class="team-photo" src="{A}/sm_Gabriella.jpg" alt="Gabriella"/><div><div class="t-name">Gabriella Neocleous</div><div class="t-role">Head of Copywriting</div></div></div><div class="team-row"><img class="team-photo" src="{A}/Wayne.jpeg" alt="Wayne Naldo"/><div><div class="t-name">Wayne Naldo</div><div class="t-role">Head of Design</div></div></div><div class="team-row"><img class="team-photo" src="{A}/Emma_Garcia.jpg" alt="Emma Garcia"/><div><div class="t-name">Emma Garcia</div><div class="t-role">Head of Finance</div></div></div><div class="team-row"><img class="team-photo" src="{A}/Dante.png" alt="Dante Nyugen"/><div><div class="t-name">Dante Nyugen</div><div class="t-role">Head of Video</div></div></div><div class="team-row"><img class="team-photo" src="{A}/sm_Cooper_fixed.jpg" alt="Cooper"/><div><div class="t-name">Cooper</div><div class="t-role">Head of Security</div></div></div><div class="team-row"><img class="team-photo" src="{A}/sm_Thula_correct.jpg" alt="Thula"/><div><div class="t-name">Thula</div><div class="t-role">Head of Treats</div></div></div></div></div></section>

<!-- ══════════════════════════════════════════════════════════════════════ -->
<!-- LOCKED: RESULTS — hardcoded, never generated                        -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
<section class="sec testi-sec" data-label="Results"><div class="fi"><h2 class="sec-h">Results.</h2><div class="testi-grid"><div class="tcard"><div class="tresult">$6K PER MONTH</div><p class="tquote">"When I heard the guys were starting a marketing agency, I KNEW I wanted to work with them. They've not only helped provide me with the strategic insights I was looking for, but helped me launch my membership programme which now generates over $6,000 per month - Thanks Ad and Fish!"</p><div class="tperson"><img class="tphoto" src="{A}/sm_Mike_Maher.jpg" alt="Mike Maher"/><div><div class="tname">Mike Maher</div><div class="tco">Take A Deep Breath</div></div></div></div><div class="tcard"><div class="tresult">\u00a330K IN RECURRING REVENUE</div><p class="tquote">"On my first launch, Fish's emails performed so well, we not only had to open up more spots, we also had to 'close doors' early due to selling out. A few months later, the guys helped me launch my mobile app, and within 30 days, we'd signed up over 1,000 members paying \u00a329.99 each."</p><div class="tperson"><img class="tphoto" src="{A}/sm_Steve_Keane.jpg" alt="Steve Keane"/><div><div class="tname">Steve Keane</div><div class="tco">Kraft Coaching</div></div></div></div><div class="tcard"><div class="tresult">OVER \u00a3130,000 IN NEW BUSINESS</div><p class="tquote">"I turned to Ad and Fish when my marketing manager took a new role, because I wanted to keep up my regular emails. I was stunned when the first 4 emails they wrote generated more calls and replies than anything we'd done previously! Since then, they've helped me generated over \u00a3130,000 in sales I can't recommend them enough."</p><div class="tperson"><img class="tphoto" src="{A}/Kirsty_Darkins.jpeg" alt="Kirsty Darkins"/><div><div class="tname">Kirsty Darkins</div><div class="tco">KD Commercial</div></div></div></div><div class="tcard"><div class="tresult">THEY JUST GET IT</div><p class="tquote">"It's safe to say that our 'basement pump' business isn't the most exciting, and is quite technical in its nature. But the team at TTM have been able to rapidly understand our offering, and craft compelling marketing that makes people take action. In fact, we had more replies to the first couple of emails they sent, than we'd had in all the emails in the entire 2 years prior."</p><div class="tperson"><img class="tphoto" src="{A}/Ian_Davis.webp" alt="Ian Davies"/><div><div class="tname">Ian Davies</div><div class="tco">PPS Pumps</div></div></div></div><div class="tcard"><div class="tresult">40% GROWTH YEAR ON YEAR</div><p class="tquote">"I came to the Test Tube Marketing team not because I was struggling, but because I wanted to have a clearly defined marketing strategy in place. We've been working together almost 2 years now, and my revenue grew 40% vs last year, and I've just surpassed 7 figures for the first time ever. Thank you, TTM team!"</p><div class="tperson"><img class="tphoto" src="{A}/sm_Tess_Cope.jpg" alt="Tess Cope"/><div><div class="tname">Tess Cope</div><div class="tco">The Transformation Agency</div></div></div></div><div class="tcard"><div class="tresult">6 FIGURES IN REVENUE</div><p class="tquote">"The first launch Ad, Fish and the team worked on with us generated over \u00a330,000 in sales from a 5-Day Facebook Challenge. Better yet, we were able to leverage the assets they created and re-run the challenge multiple times, and generate a total of 6 figures in revenue."</p><div class="tperson"><img class="tphoto" src="{A}/sm_Aran_Curry.jpg" alt="Aran Curry"/><div><div class="tname">Aran Curry</div><div class="tco">Insight Education</div></div></div></div><div class="tcard"><div class="tresult">250 CALLS BOOKED!</div><p class="tquote">"On the first campaign Fish and Ad ran for us, we'd set a target of booking 50 calls. The first 2 emails they sent exceeded our target, and we had over 250 calls booked in total. Plus we've been able to re-run the campaign since, and get even more calls booked!"</p><div class="tperson"><img class="tphoto" src="{A}/Michelle_Walker.jpg" alt="Michelle Clarke"/><div><div class="tname">Michelle Clarke</div><div class="tco">Veblen Directors</div></div></div></div><div class="tcard"><div class="tresult">AN ABSOLUTE JOY TO WORK WITH</div><p class="tquote">"What an amazing impact the Test Tube Marketing team has had on our business and more importantly on our thinking. Ad, Fish and Grace have been a total joy to work with and we all feel very inspired walking away from a session with these guys. We love their copywriting style and they get our tone of voice absolutely right."</p><div class="tperson"><img class="tphoto" src="{A}/sm_Richard_Parsons.jpg" alt="Richard Parsons"/><div><div class="tname">Richard Parsons</div><div class="tco">Platinum Commercial Academy</div></div></div></div><div class="tcard"><div class="tresult">I'VE NEVER HAD A RESPONSE LIKE THIS</div><p class="tquote">"We've been sending emails to our database pretty consistently for years, but when the TTM team took over, we saw a difference in response almost immediately. More opens, more replies, and more prospects moving towards us - one of which has now turned into a massive contract for us!!"</p><div class="tperson"><img class="tphoto" src="{A}/Steve_Hindley.png" alt="Steve Hindley"/><div><div class="tname">Steve Hindley</div><div class="tco">iNarrator</div></div></div></div></div></div></section>

<!-- FOOTER -->
<footer class="footer"><p>TEST TUBE MARKETING - Prepared exclusively for {client_name}</p><p style="margin-top:8px;"><a href="https://www.testtubemarketing.com">www.testtubemarketing.com</a></p></footer>

<script>
const obs=new IntersectionObserver(e=>{{e.forEach(e=>{{if(e.isIntersecting)e.target.classList.add('vis')}});}},{{threshold:.1}});
document.querySelectorAll('.fi').forEach(el=>obs.observe(el));
const secs=document.querySelectorAll('section[id],section[data-label]');const dc=document.getElementById('navDots');
secs.forEach(s=>{{const d=document.createElement('button');d.className='dot';d.title=s.dataset.label||'';d.onclick=()=>s.scrollIntoView({{behavior:'smooth'}});dc.appendChild(d);}});
const dots=dc.querySelectorAll('.dot');
const no=new IntersectionObserver(e=>{{e.forEach(e=>{{if(e.isIntersecting&&e.intersectionRatio>.5){{const i=Array.from(secs).indexOf(e.target);dots.forEach((d,j)=>d.classList.toggle('active',j===i));}}}});}},{{threshold:.5}});
secs.forEach(s=>no.observe(s));
</script></body></html>'''

# ── GitHub commit ─────────────────────────────────────────────────────────────
def commit_to_github(slug, html):
    path = f"{slug}/index.html"
    api_url = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/contents/{path}"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Content-Type": "application/json",
        "Accept": "application/vnd.github+json",
    }
    sha = None
    try:
        resp = api_request(api_url, headers=headers)
        sha = json.loads(resp.read()).get("sha")
    except: pass

    encoded = b64encode(html.encode("utf-8")).decode("ascii")
    body = {"message": f"Add proposal: {slug}", "content": encoded}
    if sha: body["sha"] = sha
    api_request(api_url, data=body, headers=headers, method="PUT")

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    if len(sys.argv) < 2:
        print("Usage: python3 proposal-builder.py <job_id>")
        sys.exit(1)

    job_id = sys.argv[1]

    try:
        job = fetch_job(job_id)
        slug = job["slug"]
        print(f"Building: {slug}")
        update_job(job_id, "processing")

        # 1. Fetch Google Doc
        doc_text = fetch_doc(job["doc_url"])
        print(f"  Doc: {len(doc_text)} chars")

        # 2. Extract client name
        client_name = extract_client_name(doc_text)
        print(f"  Client: {client_name}")

        # 3. Convert doc to HTML sections (Claude does direct conversion)
        sections_html = doc_to_html_sections(doc_text)
        print(f"  Sections: {len(sections_html)} chars")

        # 4. Assemble full page (locked About/Results appended in code)
        html = assemble_page(client_name, sections_html, slug)
        print(f"  HTML: {len(html)} bytes")

        # 5. Commit to GitHub
        commit_to_github(slug, html)
        print(f"  Committed")

        # 6. Done
        update_job(job_id, "done")
        print(f"  Done! https://proposals.testtubemarketing.com/{slug}")

    except Exception as e:
        print(f"  ERROR: {e}")
        try: update_job(job_id, "error", str(e))
        except: pass
        sys.exit(1)

if __name__ == "__main__":
    main()
