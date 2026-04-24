import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_TOKEN = Deno.env.get("META_TOKEN")!;
const PIXEL_ID = "2497883973908307";
const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") || "";
const SLACK_CHANNEL_ID = "C0ANZ0G35RP"; // #fishtail-nucleus

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Nick's availability rules
const AVAILABILITY_CONFIG = {
  timezone: "Europe/London",
  days: [1, 2, 3, 4, 5], // Mon-Fri
  startHour: 10,         // First slot at 10am London
  endHour: 21,           // No call can START after 20:20 (ends by 21:00)
  latestStartMinute: 40, // 16:40 would end at 17:20 — too late. Latest start = 16:20
  slotDurationMinutes: 40,
  bufferMinutes: 10,     // 10-min buffer between calls
  minNoticeHours: 4,
  maxWorkingDaysAhead: 4,
};

function buildPurchaseEventId(leadId: string, slotStart: string): string {
  return `purchase_${leadId}_${slotStart}`;
}

async function sha256Hash(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, "").replace(/^\+/, "");
}

async function sendMetaPurchase(lead: {
  id: string;
  email: string | null;
  phone: string | null;
  fbp?: string | null;
  fbc?: string | null;
  event_source_url?: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
}, slotStart: string) {
  const eventId = buildPurchaseEventId(lead.id, slotStart);
  const hashedEmail = lead.email ? await sha256Hash(lead.email) : undefined;
  const hashedPhone = lead.phone ? await sha256Hash(normalizePhone(lead.phone)) : undefined;
  const hashedExternalId = await sha256Hash(lead.id);

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: lead.event_source_url || "https://book.testtubemarketing.com",
        event_id: eventId,
        user_data: {
          ...(hashedEmail && { em: [hashedEmail] }),
          ...(hashedPhone && { ph: [hashedPhone] }),
          external_id: [hashedExternalId],
          ...(lead.fbp && { fbp: lead.fbp }),
          ...(lead.fbc && { fbc: lead.fbc }),
        },
        custom_data: {
          currency: "GBP",
          value: 1,
          ...(lead.utm_source && { utm_source: lead.utm_source }),
          ...(lead.utm_campaign && { utm_campaign: lead.utm_campaign }),
          ...(lead.utm_content && { utm_content: lead.utm_content }),
          lead_id: lead.id,
          booking_slot_start: slotStart,
        },
      },
    ],
  };

  const response = await fetch(`https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${META_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Meta purchase send failed: ${JSON.stringify(result)}`);
  }

  return { eventId, result };
}

async function getValidAccessToken(supabase: any): Promise<string> {
  const { data: tokenRow, error } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_label", "nick")
    .single();

  if (error || !tokenRow) {
    throw new Error("No Google tokens found. Please connect Google Calendar first via /google-auth/login");
  }

  const expiresAt = new Date(tokenRow.token_expiry);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;

  if (expiresAt.getTime() - now.getTime() > bufferMs) {
    return tokenRow.access_token;
  }

  console.log("Access token expired, refreshing...");

  const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: tokenRow.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const refreshData = await refreshResponse.json();

  if (!refreshResponse.ok) {
    throw new Error(`Token refresh failed: ${JSON.stringify(refreshData)}`);
  }

  const newExpiry = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();

  await supabase
    .from("google_tokens")
    .update({
      access_token: refreshData.access_token,
      token_expiry: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq("user_label", "nick");

  return refreshData.access_token;
}

async function getBusyTimes(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<Array<{ start: string; end: string }>> {
  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone: AVAILABILITY_CONFIG.timezone,
      items: [{ id: "primary" }],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Google Calendar API error: ${JSON.stringify(data)}`);
  }

  return data.calendars?.primary?.busy || [];
}

function generateAvailableSlots(
  startDate: Date,
  endDate: Date,
  busyTimes: Array<{ start: string; end: string }>
): Array<{ start: string; end: string; displayTime: string; displayDate: string }> {
  const slots: Array<{ start: string; end: string; displayTime: string; displayDate: string }> = [];
  const config = AVAILABILITY_CONFIG;
  const now = new Date();
  const minNotice = new Date(now.getTime() + config.minNoticeHours * 60 * 60 * 1000);

  const busyPeriods = busyTimes.map((b) => ({
    start: new Date(b.start),
    end: new Date(b.end),
  }));

  const current = new Date(startDate);
  while (current <= endDate) {
    const dayOfWeek = current.getDay();

    if (config.days.includes(dayOfWeek)) {
      // Get London date string for this day (handles BST/GMT correctly)
      const dateStr = current.toLocaleDateString("en-CA", { timeZone: config.timezone }); // YYYY-MM-DD

      // Calculate UTC offset for London on this date by parsing noon UTC
      const noonUtc = new Date(`${dateStr}T12:00:00Z`);
      const londonNoonHour = parseInt(
        noonUtc.toLocaleString("en-GB", { timeZone: config.timezone, hour: "2-digit", hour12: false })
      );
      const utcOffsetHours = londonNoonHour - 12; // e.g. BST = +1, GMT = 0

      // Helper: London clock time → UTC Date
      const londonToUtc = (h: number, m: number): Date => {
        const d = new Date(`${dateStr}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00Z`);
        d.setTime(d.getTime() - utcOffsetHours * 60 * 60 * 1000);
        return d;
      };

      // End of working day in UTC
      const endOfDay = londonToUtc(config.endHour, 0);

      // Generate slots at 40-minute intervals in London time
      const totalMinutes = (config.endHour - config.startHour) * 60;
      for (let offsetMin = 0; offsetMin < totalMinutes; offsetMin += config.slotDurationMinutes) {
        const londonH = config.startHour + Math.floor(offsetMin / 60);
        const londonM = offsetMin % 60;

        const slotStart = londonToUtc(londonH, londonM);
          const slotEnd = new Date(slotStart.getTime() + config.slotDurationMinutes * 60 * 1000);

          if (slotEnd > endOfDay) continue;

          if (slotStart < minNotice) continue;

          // Check for conflicts including buffer after slot
          const slotWithBuffer = new Date(slotEnd.getTime() + config.bufferMinutes * 60 * 1000);
          const isConflict = busyPeriods.some(
            (busy) => slotStart < busy.end && slotWithBuffer > busy.start
          );

          if (!isConflict) {
            slots.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
              displayTime: slotStart.toLocaleString("en-GB", {
                timeZone: config.timezone,
                hour: "2-digit",
                minute: "2-digit",
              }),
              displayDate: slotStart.toLocaleDateString("en-GB", {
                timeZone: config.timezone,
                weekday: "long",
                day: "numeric",
                month: "long",
              }),
            });
          }
      }
    }

    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }

  return slots;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);
  const path = url.pathname;

  try {
    const accessToken = await getValidAccessToken(supabase);

    // GET /availability
    if (req.method === "GET" && path.endsWith("/availability")) {
      const now = new Date();
      const startDate = new Date(now);

      // Calculate end date as N working days ahead (Mon-Fri only)
      const maxWorkingDays = AVAILABILITY_CONFIG.maxWorkingDaysAhead;
      let workingDaysCount = 0;
      const endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      while (workingDaysCount < maxWorkingDays) {
        endDate.setDate(endDate.getDate() + 1);
        const day = endDate.getDay();
        if (day !== 0 && day !== 6) workingDaysCount++; // skip weekends
      }

      const busyTimes = await getBusyTimes(
        accessToken,
        startDate.toISOString(),
        endDate.toISOString()
      );

      const slots = generateAvailableSlots(startDate, endDate, busyTimes);

      return new Response(
        JSON.stringify({
          slots,
          config: {
            slotDuration: AVAILABILITY_CONFIG.slotDurationMinutes,
            workingHours: `${AVAILABILITY_CONFIG.startHour}:00 - ${AVAILABILITY_CONFIG.endHour}:00 London`,
            maxWorkingDaysAhead: AVAILABILITY_CONFIG.maxWorkingDaysAhead,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // POST /book
    if (req.method === "POST" && path.endsWith("/book")) {
      const body = await req.json();
      const {
        slotStart,
        slotEnd,
        leadName,
        leadEmail,
        leadPhone,
        leadId,
        fbp,
        fbc,
        event_source_url,
        utm_source,
        utm_campaign,
        utm_content,
        turnover,
      } = body;

      // Only fire Meta Purchase if turnover is £500k+ (not under £500k or unknown)
      const UNDER_500K_VALUE = "Under £500k";
      const shouldFireMetaPurchase = turnover && turnover !== UNDER_500K_VALUE;

      if (!slotStart || !slotEnd || !leadName || !leadEmail) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: slotStart, slotEnd, leadName, leadEmail" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Double-check slot is still free
      const busyTimes = await getBusyTimes(accessToken, slotStart, slotEnd);
      if (busyTimes.length > 0) {
        return new Response(
          JSON.stringify({ error: "This time slot is no longer available. Please choose another." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create the calendar event
      const event = {
        summary: `Marketing Growth Call — ${leadName}`,
        description: [
          `Hi ${leadName.split(" ")[0]},`,
          ``,
          `Thanks for booking a call with Test Tube Marketing.`,
          ``,
          `Join via Zoom: https://us06web.zoom.us/j/8792020476`,
          ``,
          `⚠️ Important: Please accept this calendar invite to confirm your attendance. If the invite is not accepted, the call may be cancelled.`,
          ``,
          `Speak soon!`,
          `—`,
          `<!-- Lead: ${leadName} | Email: ${leadEmail} | Phone: ${leadPhone || "N/A"} | ID: ${leadId || "N/A"} | Source: book.testtubemarketing.com -->`,
        ].join("\n"),
        start: {
          dateTime: slotStart,
          timeZone: AVAILABILITY_CONFIG.timezone,
        },
        end: {
          dateTime: slotEnd,
          timeZone: AVAILABILITY_CONFIG.timezone,
        },
        location: "https://us06web.zoom.us/j/8792020476",
        attendees: [{ email: leadEmail }],
        reminders: {
          useDefault: false,
          overrides: [{ method: "popup", minutes: 15 }],
        }
      };

      // sendUpdates=all sends a Google Calendar invite to the attendee
      const calResponse = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );

      const calData = await calResponse.json();

      if (!calResponse.ok) {
        console.error("Calendar event creation failed:", calData);
        return new Response(
          JSON.stringify({ error: "Failed to create calendar event", details: calData }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update lead record with event ID and confirmed stage
      // Try by leadId first, fall back to email lookup
      const updatePayload = {
        google_event_id: calData.id,
        call_datetime: slotStart,
        stage: "booked",
        booking_completed: true,
        updated_at: new Date().toISOString(),
        ...(turnover ? { revenue_range: turnover } : {}),
      };

      let confirmedLeadId: string | null = leadId || null;

      if (leadId) {
        await supabase.from("leads").update(updatePayload).eq("id", leadId);
      } else if (leadEmail) {
        // Fallback: find most recent non-booked lead with this email
        const { data: existingLeads } = await supabase
          .from("leads")
          .select("id")
          .eq("email", leadEmail)
          .eq("booking_completed", false)
          .order("created_at", { ascending: false })
          .limit(1);

        if (existingLeads && existingLeads.length > 0) {
          confirmedLeadId = existingLeads[0].id;
          await supabase.from("leads").update(updatePayload).eq("id", confirmedLeadId);
        } else {
          // No existing lead — create one
          const { data: insertedLead } = await supabase
            .from("leads")
            .insert({
              name: leadName,
              email: leadEmail,
              phone: leadPhone || null,
              fbp: fbp || null,
              fbc: fbc || null,
              event_source_url: event_source_url || null,
              utm_source: utm_source || null,
              utm_campaign: utm_campaign || null,
              utm_content: utm_content || null,
              ...updatePayload,
              opted_in_at: new Date().toISOString(),
              last_contact_at: new Date().toISOString(),
              proposal_sent: false,
            })
            .select("id")
            .single();
          confirmedLeadId = insertedLead?.id || null;
        }
      }

      if (!confirmedLeadId && leadEmail) {
        const { data } = await supabase
          .from("leads").select("id").eq("email", leadEmail)
          .eq("booking_completed", true).order("updated_at", { ascending: false }).limit(1);
        confirmedLeadId = data?.[0]?.id || null;
      }

      if (confirmedLeadId) {
        const bookedAt = new Date().toISOString();
        const purchaseEventId = buildPurchaseEventId(confirmedLeadId, slotStart);

        // Mark booked_at so mailer.py send_confirmation can be triggered,
        // and persist the event id so the browser pixel can assist with dedupe.
        await supabase.from("leads").update({
          booked_at: bookedAt,
          purchase_event_id: purchaseEventId,
          meta_purchase_status: "pending",
          meta_purchase_error: null,
        }).eq("id", confirmedLeadId);

        const { data: leadForMeta } = await supabase
          .from("leads")
          .select("id, email, phone, fbp, fbc, event_source_url, utm_source, utm_campaign, utm_content")
          .eq("id", confirmedLeadId)
          .single();

        if (leadForMeta && shouldFireMetaPurchase) {
          try {
            await sendMetaPurchase(leadForMeta, slotStart);
            await supabase.from("leads").update({
              meta_purchase_status: "sent",
              meta_purchase_sent_at: new Date().toISOString(),
              meta_purchase_error: null,
            }).eq("id", confirmedLeadId);
          } catch (metaError) {
            const message = metaError instanceof Error ? metaError.message : String(metaError);
            console.error("Meta purchase send failed after booking:", metaError);
            await supabase.from("leads").update({
              meta_purchase_status: "failed",
              meta_purchase_error: message.slice(0, 1000),
            }).eq("id", confirmedLeadId);
          }
        }
      }

      // Send Slack notification for new booking
      if (SLACK_BOT_TOKEN) {
        try {
          const callTime = new Date(slotStart).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
          const slackText = `📞 *New Call Booked!*\n• *Name:* ${leadName}\n• *Email:* ${leadEmail}\n• *Phone:* ${leadPhone || "N/A"}\n• *Revenue:* ${turnover || "N/A"}\n• *Industry:* ${industry || "N/A"}\n• *Source:* ${utm_source || "direct"}\n• *Call:* ${callTime}\n• *Meta CAPI:* ${shouldFireMetaPurchase ? "fired" : "skipped (under \u00a3500k)"}`;
          await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SLACK_BOT_TOKEN}` },
            body: JSON.stringify({ channel: SLACK_CHANNEL_ID, text: slackText }),
          });
        } catch (slackErr) {
          console.error("Slack notification failed:", slackErr);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          eventId: calData.id,
          eventLink: calData.htmlLink,
          start: slotStart,
          end: slotEnd,
          leadId: confirmedLeadId,
        }),
        {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response("Not found. Use GET /availability or POST /book", {
      status: 404,
      headers: corsHeaders,
    });
  } catch (err: any) {
    console.error("Calendar function error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
