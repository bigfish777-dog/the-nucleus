import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ── Env ──────────────────────────────────────────────────────────────────────
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const NOTIFICATION_EMAIL = Deno.env.get("NOTIFICATION_EMAIL") || "bigfish@testtubemarketing.com";

const GITHUB_OWNER = "bigfish777-dog";
const GITHUB_REPO = "proposal-template";
const PROPOSALS_DOMAIN = "https://proposals.testtubemarketing.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Google Doc fetch ─────────────────────────────────────────────────────────
function extractDocId(url: string): string | null {
  const m = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

async function fetchGoogleDocText(docId: string): Promise<string> {
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  const res = await fetch(exportUrl);
  if (!res.ok) throw new Error(`Failed to fetch Google Doc (${res.status}). Make sure the doc is publicly accessible or shared with "Anyone with the link".`);
  return await res.text();
}

// ── Claude: parse doc into proposal JSON ─────────────────────────────────────
interface ProposalData {
  client_name: string;
  date: string;
  cover_subtitle: string;
  opening_heading: string;
  opening_paragraphs: string[];
  plan_intro: string[];
  phases: { title: string; subtitle?: string; description: string; activities: { title: string; description: string }[] }[];
  deliverables: { title: string; description: string }[];
  investment_intro: string[];
  pricing: { title: string; lines: { label: string; value: string }[]; note: string };
  comparison_table?: { headers: string[]; rows: string[][] };
  next_steps: { num: string; text: string }[];
  sign_off: string;
  signoff_name: string;
}

async function parseDocToProposalJSON(docText: string): Promise<ProposalData> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are a proposal data extractor for Test Tube Marketing. Extract the following proposal content from this Google Doc text and return it as JSON.

IMPORTANT RULES:
- No em dashes or en dashes. Use single hyphens (-) only.
- Currency: use the pound sign for GBP, dollar sign for USD.
- Pricing format: use +VAT or +VAT/mo suffixes.
- The sign-off name should default to "Fish (Nick Fisher)" unless stated otherwise in the doc.
- Extract ONLY editable proposal content. Do NOT generate About Us or Results sections.

Return a JSON object with these fields:
{
  "client_name": "string",
  "date": "string - format like 'April 2026'",
  "cover_subtitle": "string - one-line tagline for the cover",
  "opening_heading": "string - defaults to 'My take.'",
  "opening_paragraphs": ["array of paragraph strings"],
  "plan_intro": ["array of intro paragraph strings"],
  "phases": [{"title": "string", "subtitle": "optional string", "description": "string", "activities": [{"title": "string", "description": "string"}]}],
  "deliverables": [{"title": "string", "description": "string"}],
  "investment_intro": ["array of paragraph strings"],
  "pricing": {"title": "string", "lines": [{"label": "string", "value": "string"}], "note": "string"},
  "comparison_table": null or {"headers": ["string"], "rows": [["string"]]},
  "next_steps": [{"num": "1", "text": "string"}],
  "sign_off": "string - closing line before name",
  "signoff_name": "string - defaults to Fish (Nick Fisher)"
}

Return ONLY the JSON, no markdown fences.

Here is the Google Doc text:

${docText}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Claude API error (${res.status}): ${errBody}`);
  }

  const result = await res.json();
  const text = result.content[0].text.trim();

  // Strip markdown fences if present
  const cleaned = text.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  return JSON.parse(cleaned);
}

// ── Build HTML from template + data ──────────────────────────────────────────
function buildProposalHTML(data: ProposalData, slug: string): string {
  // Build phases HTML
  let phasesHtml = "";
  for (const phase of data.phases || []) {
    phasesHtml += `<div class="phase"><p class="phase-title">${phase.title}</p>`;
    if (phase.subtitle) phasesHtml += `<p class="phase-subtitle">${phase.subtitle}</p>`;
    phasesHtml += `<div class="body-text"><p>${phase.description}</p></div>`;
    for (const activity of phase.activities || []) {
      phasesHtml += `<p class="activity-title">${activity.title}</p><div class="body-text"><p>${activity.description}</p></div>`;
    }
    phasesHtml += "</div>";
  }

  // Build deliverables
  let deliverablesHtml = "";
  for (const d of data.deliverables || []) {
    deliverablesHtml += `<li><strong>${d.title}</strong> - ${d.description}</li>`;
  }

  // Build pricing lines
  let pricingHtml = "";
  const pricing = data.pricing || { title: "", lines: [], note: "" };
  for (const p of pricing.lines || []) {
    pricingHtml += `<div class="pricing-line"><span class="label">${p.label}</span><span class="value">${p.value}</span></div>`;
  }

  // Build next steps
  let stepsHtml = "";
  for (const s of data.next_steps || []) {
    stepsHtml += `<li><div class="step-num">${s.num}</div><span>${s.text}</span></li>`;
  }

  // Comparison table
  let tableHtml = "";
  if (data.comparison_table) {
    const t = data.comparison_table;
    tableHtml = '<table class="compare-table"><thead><tr>';
    for (const h of t.headers) tableHtml += `<th>${h}</th>`;
    tableHtml += "</tr></thead><tbody>";
    for (const row of t.rows) {
      tableHtml += "<tr>";
      for (const cell of row) tableHtml += `<td>${cell}</td>`;
      tableHtml += "</tr>";
    }
    tableHtml += "</tbody></table>";
  }

  const openingHtml = (data.opening_paragraphs || []).map((p: string) => `<p>${p}</p>`).join("");
  const planIntroHtml = (data.plan_intro || []).map((p: string) => `<p>${p}</p>`).join("");
  const investmentIntroHtml = (data.investment_intro || []).map((p: string) => `<p>${p}</p>`).join("");

  const proposalUrl = `${PROPOSALS_DOMAIN}/${slug}`;

  const html = TEMPLATE_HTML
    .replace(/\{\{CLIENT_NAME\}\}/g, data.client_name)
    .replace("{{DATE}}", data.date || "")
    .replace("{{COVER_SUBTITLE}}", data.cover_subtitle || "")
    .replace("{{OPENING_HEADING}}", data.opening_heading || "My take.")
    .replace("{{OPENING_COPY}}", openingHtml)
    .replace("{{PLAN_INTRO}}", planIntroHtml)
    .replace("{{PHASES}}", phasesHtml)
    .replace("{{DELIVERABLES}}", deliverablesHtml)
    .replace("{{INVESTMENT_INTRO}}", investmentIntroHtml)
    .replace("{{PRICING_TITLE}}", pricing.title || "")
    .replace("{{PRICING_LINES}}", pricingHtml)
    .replace("{{PRICING_NOTE}}", pricing.note || "")
    .replace("{{COMPARISON_TABLE}}", tableHtml)
    .replace("{{NEXT_STEPS}}", stepsHtml)
    .replace("{{SIGN_OFF}}", data.sign_off || "Looking forward to working with you.")
    .replace("{{SIGNOFF_NAME}}", data.signoff_name || "Fish (Nick Fisher)")
    .replace(/\{\{PROPOSAL_URL\}\}/g, proposalUrl);

  return html;
}

// ── GitHub: commit file ──────────────────────────────────────────────────────
async function commitToGitHub(slug: string, html: string): Promise<void> {
  const path = `${slug}/index.html`;
  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github+json",
  };

  // Check if file exists (to get sha for update)
  let sha: string | undefined;
  const checkRes = await fetch(apiUrl, { headers });
  if (checkRes.ok) {
    const existing = await checkRes.json();
    sha = existing.sha;
  }

  // Base64 encode the HTML
  const encoded = btoa(unescape(encodeURIComponent(html)));

  const body: Record<string, string> = {
    message: `Add proposal: ${slug}`,
    content: encoded,
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(apiUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });

  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`GitHub commit failed (${putRes.status}): ${err}`);
  }
}

// ── Email notification ───────────────────────────────────────────────────────
async function sendNotificationEmail(slug: string, clientName: string): Promise<void> {
  if (!RESEND_API_KEY) return;

  const proposalUrl = `${PROPOSALS_DOMAIN}/${slug}`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "The Nucleus <notifications@testtubemarketing.com>",
      to: [NOTIFICATION_EMAIL],
      subject: `Proposal published: ${clientName}`,
      html: `<p>A new proposal has been published.</p>
<p><strong>Client:</strong> ${clientName}</p>
<p><strong>URL:</strong> <a href="${proposalUrl}">${proposalUrl}</a></p>
<p>- The Nucleus</p>`,
    }),
  });
}

// ── Main handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { doc_url, slug } = await req.json();

    if (!doc_url || !slug) {
      return jsonResponse({ error: "Missing doc_url or slug" }, 400);
    }

    // 1. Extract doc ID and fetch content
    const docId = extractDocId(doc_url);
    if (!docId) {
      return jsonResponse({ error: "Invalid Google Doc URL" }, 400);
    }

    const docText = await fetchGoogleDocText(docId);

    // 2. Parse doc into proposal JSON via Claude
    const proposalData = await parseDocToProposalJSON(docText);

    // 3. Build the HTML page from template
    const html = buildProposalHTML(proposalData, slug);

    // 4. Commit to GitHub (triggers GitHub Pages deployment)
    await commitToGitHub(slug, html);

    // 5. Send notification email
    await sendNotificationEmail(slug, proposalData.client_name);

    const proposalUrl = `${PROPOSALS_DOMAIN}/${slug}`;
    return jsonResponse({ success: true, url: proposalUrl, client_name: proposalData.client_name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CANONICAL TEMPLATE
// The About Us and Results sections below are LOCKED. They are copied verbatim
// from proposal-template/index.html and must NOT be regenerated or paraphrased.
// ═══════════════════════════════════════════════════════════════════════════════
const TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{{CLIENT_NAME}} - Test Tube Marketing Proposal</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,600&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {
  --pink: #E8185A;
  --teal: #4DD9D0;
  --cover-dark: #0B1E35;
  --cover-mid: #0F3D5C;
  --white: #FFFFFF;
  --text: #2D2D2D;
  --muted: #6B7280;
  --light-bg: #F5F6F8;
  --green: #1A5C4A;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  font-family: 'Inter', system-ui, sans-serif;
  color: var(--text);
  background: #fff;
  overflow-x: hidden;
}

.section {
  min-height: 100vh;
  padding: 80px 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
}
@media (max-width: 768px) {
  .section { padding: 60px 24px; min-height: auto; }
}

.cover {
  background: radial-gradient(ellipse at 60% 80%, #1A5C6B 0%, #0B2A45 40%, #060F1C 100%);
  color: white;
  min-height: 100vh;
  padding: 48px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.cover-meta {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pink);
}
.cover-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
}
.cover-logo-icon { font-size: 28px; line-height: 1; }
.cover-logo-text { font-family: 'Poppins', sans-serif; font-size: 14px; }
.cover-logo-text strong { font-weight: 700; font-size: 15px; }
.cover-logo-text span { font-weight: 400; font-size: 11px; letter-spacing: 0.1em; opacity: 0.8; display: block; }

.cover-headline {
  font-family: 'Poppins', sans-serif;
  font-size: clamp(44px, 10vw, 88px);
  font-weight: 900;
  line-height: 0.95;
  letter-spacing: -0.03em;
  color: white;
  margin: 48px 0 24px;
}
.cover-subtitle {
  font-family: 'Inter', sans-serif;
  font-size: clamp(15px, 2vw, 18px);
  font-weight: 400;
  color: var(--teal);
  line-height: 1.6;
  max-width: 560px;
}
.cover-subtitle em { font-style: italic; }

.cover-credits {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  margin-top: 64px;
}
.cover-credit-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pink);
  margin-bottom: 6px;
}
.cover-credit-name {
  font-family: 'Poppins', sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: var(--teal);
}

.section-heading {
  font-family: 'Poppins', sans-serif;
  font-size: clamp(32px, 5vw, 52px);
  font-weight: 800;
  color: var(--pink);
  line-height: 1.1;
  margin-bottom: 32px;
  letter-spacing: -0.02em;
}
.section-heading.dark { color: var(--text); }

.body-text {
  font-size: clamp(15px, 1.5vw, 17px);
  line-height: 1.75;
  color: var(--text);
  max-width: 720px;
}
.body-text p { margin-bottom: 18px; }
.body-text p:last-child { margin-bottom: 0; }
.body-text strong { font-weight: 600; }
.body-text em { font-style: italic; }

.phase { margin-top: 36px; margin-bottom: 8px; }
.phase-title {
  font-family: 'Poppins', sans-serif;
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 4px;
}
.phase-subtitle { font-size: 14px; color: var(--muted); margin-bottom: 16px; }
.activity-title {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  margin-top: 20px;
  margin-bottom: 6px;
}

.callout {
  background: var(--light-bg);
  border-left: 3px solid var(--pink);
  padding: 20px 24px;
  border-radius: 0 8px 8px 0;
  margin: 24px 0;
  font-style: italic;
  font-size: 16px;
  line-height: 1.6;
  color: var(--text);
  max-width: 680px;
}

.bullet-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 16px;
  max-width: 680px;
}
.bullet-list li {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 16px;
  line-height: 1.6;
}
.bullet-list li::before {
  content: '\\2022';
  color: var(--pink);
  font-weight: 900;
  font-size: 18px;
  line-height: 1.4;
  flex-shrink: 0;
}
.bullet-list li strong { font-weight: 600; }

.pricing-box {
  background: linear-gradient(135deg, #0B1E35 0%, #0F3D5C 100%);
  border-radius: 12px;
  padding: 40px 48px;
  color: white;
  max-width: 680px;
  margin-top: 24px;
}
.pricing-box h3 {
  font-family: 'Poppins', sans-serif;
  font-size: 22px;
  font-weight: 700;
  color: var(--teal);
  margin-bottom: 24px;
}
.pricing-line {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  font-size: 16px;
}
.pricing-line:last-child { border-bottom: none; }
.pricing-line .label { color: rgba(255,255,255,0.8); }
.pricing-line .value { font-weight: 700; color: white; font-size: 18px; }
.pricing-note {
  margin-top: 20px;
  font-size: 13px;
  color: rgba(255,255,255,0.6);
  line-height: 1.6;
}

.compare-table {
  width: 100%;
  max-width: 680px;
  border-collapse: collapse;
  margin-top: 24px;
  font-size: 14px;
}
.compare-table th {
  background: var(--pink);
  color: white;
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  padding: 12px 16px;
  text-align: left;
}
.compare-table td {
  padding: 11px 16px;
  border-bottom: 1px solid #E5E7EB;
  color: var(--text);
}
.compare-table tr:nth-child(even) td { background: #F9FAFB; }

.steps-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 24px;
  max-width: 680px;
}
.steps-list li {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  font-size: 16px;
  line-height: 1.6;
}
.step-num {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--pink);
  color: white;
  font-family: 'Poppins', sans-serif;
  font-weight: 700;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sign-off {
  margin-top: 48px;
  font-size: 16px;
  line-height: 1.8;
  color: var(--text);
}
.sign-off strong { font-weight: 700; display: block; margin-top: 8px; }

.about-section { background: white; }
.about-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  align-items: start;
}
@media (max-width: 768px) {
  .about-grid { grid-template-columns: 1fr; gap: 40px; }
}
.about-heading {
  font-family: 'Poppins', sans-serif;
  font-size: clamp(32px, 5vw, 52px);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.02em;
  margin-bottom: 28px;
}
.about-heading span { font-weight: 300; font-style: italic; color: var(--muted); }
.team-list { display: flex; flex-direction: column; gap: 20px; }
.team-member { display: flex; align-items: center; gap: 14px; }
.team-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0B1E35, #0F3D5C);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Poppins', sans-serif;
  font-weight: 700;
  font-size: 16px;
  color: var(--teal);
  flex-shrink: 0;
  overflow: hidden;
  border: 2px solid var(--light-bg);
}
.team-avatar img { width: 100%; height: 100%; object-fit: cover; }
.team-name { font-weight: 700; font-size: 15px; color: var(--text); }
.team-role { font-size: 13px; color: var(--muted); }

.testimonials-section { background: var(--light-bg); }
.testimonials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
  margin-top: 40px;
}
.testi-card {
  background: white;
  border-radius: 12px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}
.testi-result {
  font-family: 'Poppins', sans-serif;
  font-size: 22px;
  font-weight: 800;
  color: var(--green);
  line-height: 1.1;
  text-transform: uppercase;
}
.testi-quote {
  font-size: 14px;
  line-height: 1.65;
  color: var(--text);
  font-style: italic;
  flex: 1;
}
.testi-person { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
.testi-photo {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0B1E35, #0F3D5C);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  color: var(--teal);
  flex-shrink: 0;
  overflow: hidden;
}
.testi-photo img { width: 100%; height: 100%; object-fit: cover; }
.testi-name { font-weight: 700; font-size: 14px; }
.testi-company { font-size: 12px; color: var(--muted); }

.nav-dots {
  position: fixed;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 100;
}
.nav-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,0.3);
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  padding: 0;
}
.nav-dot.active { background: var(--pink); transform: scale(1.4); }
@media (max-width: 768px) { .nav-dots { display: none; } }

.footer {
  background: #060F1C;
  color: rgba(255,255,255,0.4);
  text-align: center;
  padding: 32px 24px;
  font-size: 12px;
  line-height: 1.8;
}
.footer a { color: rgba(255,255,255,0.5); }

.fade-in {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.fade-in.visible { opacity: 1; transform: translateY(0); }

.section-alt { background: var(--light-bg); }
</style>
</head>
<body>

<nav class="nav-dots" id="navDots"></nav>

<!-- COVER -->
<section class="cover" id="s-cover" data-label="Cover">
  <div>
    <div class="cover-meta">{{DATE}}</div>
    <div class="cover-logo">
      <div class="cover-logo-icon">&#x1F9EA;</div>
      <div class="cover-logo-text">
        <strong>test tube</strong>
        <span>MARKETING</span>
      </div>
    </div>
  </div>
  <div>
    <h1 class="cover-headline">Project<br/>Proposal</h1>
    <p class="cover-subtitle">{{COVER_SUBTITLE}}</p>
  </div>
  <div class="cover-credits">
    <div>
      <div class="cover-credit-label">Presented to:</div>
      <div class="cover-credit-name">{{CLIENT_NAME}}</div>
    </div>
    <div>
      <div class="cover-credit-label">Presented by:</div>
      <div class="cover-credit-name">Test Tube Marketing</div>
    </div>
  </div>
</section>

<!-- OPENING -->
<section class="section" id="s-opening" data-label="My Take">
  <div class="fade-in">
    <h2 class="section-heading">{{OPENING_HEADING}}</h2>
    <div class="body-text">
      {{OPENING_COPY}}
    </div>
  </div>
</section>

<!-- THE PLAN -->
<section class="section section-alt" id="s-plan" data-label="The Plan">
  <div class="fade-in">
    <h2 class="section-heading">The plan.</h2>
    <div class="body-text">
      {{PLAN_INTRO}}
    </div>
    {{PHASES}}
  </div>
</section>

<!-- WHAT YOU GET -->
<section class="section" id="s-deliverables" data-label="What You Get">
  <div class="fade-in">
    <h2 class="section-heading">What you get.</h2>
    <ul class="bullet-list">
      {{DELIVERABLES}}
    </ul>
  </div>
</section>

<!-- INVESTMENT -->
<section class="section section-alt" id="s-investment" data-label="Investment">
  <div class="fade-in">
    <h2 class="section-heading">Your investment.</h2>
    <div class="body-text">
      {{INVESTMENT_INTRO}}
    </div>
    <div class="pricing-box">
      <h3>{{PRICING_TITLE}}</h3>
      {{PRICING_LINES}}
      <p class="pricing-note">{{PRICING_NOTE}}</p>
    </div>
    {{COMPARISON_TABLE}}
  </div>
</section>

<!-- NEXT STEPS -->
<section class="section" id="s-next" data-label="Next Steps">
  <div class="fade-in">
    <h2 class="section-heading">What happens next.</h2>
    <ol class="steps-list">
      {{NEXT_STEPS}}
    </ol>
    <div class="sign-off">
      {{SIGN_OFF}}
      <strong>{{SIGNOFF_NAME}}<br/>Test Tube Marketing</strong>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<!-- LOCKED SECTION: ABOUT US — copied verbatim from canonical template       -->
<!-- DO NOT regenerate, paraphrase, or modify this section                     -->
<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<section class="section about-section section-alt" id="s-about" data-label="About Us">
  <div class="fade-in about-grid">
    <div>
      <h2 class="about-heading"><span>About</span><br/>Test Tube<br/>Marketing</h2>
      <div class="body-text">
        <p>Hi, we're Ad and Fish - the founders of Test Tube Marketing.</p>
        <p>We're a boutique marketing agency based in the Midlands, UK. We work with a small number of expert businesses - coaches, consultants, and professional service providers - doing the marketing that needs doing, so they can focus on the work only they can do.</p>
        <p>We don't do fluffy. We do results.</p>
      </div>
    </div>
    <div class="team-list">
      <div class="team-member"><div class="team-avatar">AD</div><div><div class="team-name">Ad</div><div class="team-role">Co-Founder &amp; Head of Strategy</div></div></div>
      <div class="team-member"><div class="team-avatar">NK</div><div><div class="team-name">Nick (Fish)</div><div class="team-role">Co-Founder &amp; Head of Client Happiness</div></div></div>
      <div class="team-member"><div class="team-avatar">GB</div><div><div class="team-name">Gabriella</div><div class="team-role">Head of Copywriting</div></div></div>
      <div class="team-member"><div class="team-avatar">GR</div><div><div class="team-name">Grace</div><div class="team-role">Head of RevOps</div></div></div>
      <div class="team-member"><div class="team-avatar">WY</div><div><div class="team-name">Wayne</div><div class="team-role">Head of Design</div></div></div>
      <div class="team-member"><div class="team-avatar">&#x1F415;</div><div><div class="team-name">Biscuit</div><div class="team-role">Head of Security</div></div></div>
      <div class="team-member"><div class="team-avatar">&#x1F415;</div><div><div class="team-name">Cookie</div><div class="team-role">Head of Treats</div></div></div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<!-- LOCKED SECTION: RESULTS — copied verbatim from canonical template        -->
<!-- DO NOT regenerate, paraphrase, or modify this section                     -->
<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<section class="section testimonials-section" id="s-results" data-label="Results">
  <div class="fade-in">
    <h2 class="section-heading">Results.</h2>
    <div class="testimonials-grid">
      <div class="testi-card"><div class="testi-result">\u00A3130,000+<br/>in new business</div><p class="testi-quote">"Test Tube came in and immediately understood what we needed. The pipeline has grown consistently and the quality of leads has been exceptional."</p><div class="testi-person"><div class="testi-photo">KD</div><div><div class="testi-name">Kirsty Darkins</div><div class="testi-company">KD Commercial</div></div></div></div>
      <div class="testi-card"><div class="testi-result">40% growth<br/>year on year</div><p class="testi-quote">"I came to TTM not because I was struggling, but because I wanted a clearly defined marketing strategy. Two years later, I've just had my best year ever."</p><div class="testi-person"><div class="testi-photo">TC</div><div><div class="testi-name">Tess Cope</div><div class="testi-company">The Transformation Agency</div></div></div></div>
      <div class="testi-card"><div class="testi-result">1,000+ members<br/>in 30 days</div><p class="testi-quote">"\u00A329.99/month, over 1,000 paying members within 30 days of launch. TTM handled everything. I just delivered the coaching."</p><div class="testi-person"><div class="testi-photo">SK</div><div><div class="testi-name">Steve Keane</div><div class="testi-company">Kraft Coaching</div></div></div></div>
      <div class="testi-card"><div class="testi-result">\u00A330k recurring<br/>revenue</div><p class="testi-quote">"Working with TTM has been transformational. They don't just do the work - they think strategically about what will actually move the needle."</p><div class="testi-person"><div class="testi-photo">JD</div><div><div class="testi-name">Julie D.</div><div class="testi-company">Business Coach</div></div></div></div>
      <div class="testi-card"><div class="testi-result">Pipeline<br/>transformed</div><p class="testi-quote">"Within three months we had a consistent pipeline of qualified leads coming in. The difference has been night and day compared to what we were doing before."</p><div class="testi-person"><div class="testi-photo">RB</div><div><div class="testi-name">Rob B.</div><div class="testi-company">Consultant</div></div></div></div>
      <div class="testi-card"><div class="testi-result">7 figures<br/>achieved</div><p class="testi-quote">"We crossed 7 figures this year. Having TTM as our dedicated marketing department meant I could focus on delivery while they handled everything else."</p><div class="testi-person"><div class="testi-photo">SL</div><div><div class="testi-name">Sarah L.</div><div class="testi-company">Training &amp; Development</div></div></div></div>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer class="footer">
  <p>TEST TUBE MARKETING - Prepared exclusively for {{CLIENT_NAME}}</p>
  <p style="margin-top:8px;"><a href="https://testtube.marketing">testtube.marketing</a></p>
</footer>

<script>
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('visible');
  });
}, { threshold: 0.1 });
document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

const sections = document.querySelectorAll('section[id]');
const dotsContainer = document.getElementById('navDots');

sections.forEach((sec, i) => {
  const dot = document.createElement('button');
  dot.className = 'nav-dot';
  dot.title = sec.dataset.label || '';
  dot.onclick = () => sec.scrollIntoView({ behavior: 'smooth' });
  dotsContainer.appendChild(dot);
});

const dots = dotsContainer.querySelectorAll('.nav-dot');

const navObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting && e.intersectionRatio > 0.5) {
      const idx = Array.from(sections).indexOf(e.target);
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    }
  });
}, { threshold: 0.5 });

sections.forEach(s => navObserver.observe(s));
</script>
</body>
</html>`;
