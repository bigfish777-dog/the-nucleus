import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GMAIL_USER = "bigfish@testtubemarketing.com";
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD") || "ndcrbnkssmuetnok";
const ZOOM_LINK = "https://us06web.zoom.us/j/8792020476";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function formatDateTime(isoStr: string): string {
  try {
    const dt = new Date(isoStr);
    return dt.toLocaleString("en-GB", {
      timeZone: "Europe/London",
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }) + " GMT";
  } catch {
    return isoStr;
  }
}

async function sendEmail(to: string, subject: string, textBody: string, htmlBody: string) {
  // Use Gmail SMTP via fetch to a relay, or encode as MIME for SMTP
  // Deno doesn't have native SMTP — use Gmail API via OAuth (or a relay)
  // For simplicity: use SendGrid-compatible approach with Gmail SMTP via fetch
  // Actually: use the existing Gmail app password via SMTP with Deno SMTP library
  
  const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
  
  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: {
        username: GMAIL_USER,
        password: GMAIL_APP_PASSWORD,
      },
    },
  });

  await client.send({
    from: `Nick Fisher | Test Tube Marketing <${GMAIL_USER}>`,
    to,
    subject,
    content: textBody,
    html: htmlBody,
  });

  await client.close();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { leadName, leadEmail, callDatetime } = await req.json();

    if (!leadEmail || !leadName || !callDatetime) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: leadName, leadEmail, callDatetime" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firstName = leadName.split(" ")[0] || "there";
    const callTime = formatDateTime(callDatetime);
    const subject = `Your Marketing Growth Call is confirmed — ${callTime}`;

    const textBody = `Hi ${firstName},

Your Marketing Growth Call with Nick Fisher is confirmed.

📅 ${callTime}
🔗 ${ZOOM_LINK}

What to expect:
- 45 minutes — no pitch, no pressure
- We'll talk about your business, your marketing, and what's not working
- You'll get an honest view of where the gaps are
- You can't buy anything on this call

If you need to reschedule, just reply to this email.

Looking forward to speaking with you.

Nick Fisher
Test Tube Marketing
bigfish@testtubemarketing.com
www.testtubemarketing.com`;

    const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f7f7f5;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:560px;width:100%;">
        <!-- Header -->
        <tr><td style="background:#1A1A2E;padding:32px 40px;text-align:center;">
          <p style="color:#C9922A;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 8px">Test Tube Marketing</p>
          <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0;font-family:Georgia,serif;">You're booked in. ✅</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 40px;">
          <p style="color:#4A4A4A;font-size:16px;line-height:1.6;margin:0 0 24px">Hi ${firstName},</p>
          <p style="color:#4A4A4A;font-size:16px;line-height:1.6;margin:0 0 32px">Your Marketing Growth Call with Nick Fisher is confirmed.</p>
          
          <!-- Call details box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f5;border-radius:8px;border:1px solid #E8E4DC;margin-bottom:32px;">
            <tr><td style="padding:24px;">
              <p style="margin:0 0 8px;font-size:13px;color:#888;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">When</p>
              <p style="margin:0 0 20px;font-size:17px;font-weight:700;color:#1A1A2E;">📅 ${callTime}</p>
              <p style="margin:0 0 8px;font-size:13px;color:#888;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Join link</p>
              <a href="${ZOOM_LINK}" style="color:#C9922A;font-size:15px;word-break:break-all;">🔗 ${ZOOM_LINK}</a>
            </td></tr>
          </table>

          <p style="color:#4A4A4A;font-size:15px;line-height:1.7;margin:0 0 12px"><strong>What to expect:</strong></p>
          <ul style="color:#4A4A4A;font-size:15px;line-height:1.8;margin:0 0 32px;padding-left:20px;">
            <li>45 minutes — no pitch, no pressure</li>
            <li>We'll talk about your business, your marketing, and what's not working</li>
            <li>You'll get an honest view of where the gaps are</li>
            <li>You can't buy anything on this call</li>
          </ul>

          <p style="color:#888;font-size:14px;line-height:1.6;margin:0 0 32px">If you need to reschedule, just reply to this email.</p>
          
          <p style="color:#1A1A2E;font-size:15px;line-height:1.6;margin:0">Looking forward to speaking with you.</p>
          <p style="color:#1A1A2E;font-size:15px;font-weight:700;margin:8px 0 4px">Nick Fisher</p>
          <p style="color:#888;font-size:13px;margin:0">Test Tube Marketing · <a href="https://www.testtubemarketing.com" style="color:#C9922A;">www.testtubemarketing.com</a></p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#1A1A2E;padding:20px 40px;text-align:center;">
          <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0;">© 2026 Test Tube Marketing Ltd · Balsall Common, England</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await sendEmail(leadEmail, subject, textBody, htmlBody);

    return new Response(
      JSON.stringify({ success: true, to: leadEmail }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Confirmation email error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
