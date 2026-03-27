import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Nick's availability rules
const AVAILABILITY_CONFIG = {
  timezone: "Europe/London",
  days: [1, 2, 3, 4, 5], // Mon-Fri
  startHour: 9,
  endHour: 17,
  slotDurationMinutes: 30,
  bufferMinutes: 15,
  minNoticeHours: 24,
  maxWorkingDaysAhead: 4, // up to 4 working days from today
};

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
      for (let hour = config.startHour; hour < config.endHour; hour++) {
        for (let min = 0; min < 60; min += config.slotDurationMinutes) {
          const slotStart = new Date(current);
          slotStart.setHours(hour, min, 0, 0);

          const slotEnd = new Date(slotStart.getTime() + config.slotDurationMinutes * 60 * 1000);

          const endCheck = new Date(current);
          endCheck.setHours(config.endHour, 0, 0, 0);
          if (slotEnd > endCheck) continue;

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
      const { slotStart, slotEnd, leadName, leadEmail, leadPhone, leadId } = body;

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
          `Lead: ${leadName}`,
          `Email: ${leadEmail}`,
          `Phone: ${leadPhone || "Not provided"}`,
          ``,
          `Booked via The Nucleus — book.testtubemarketing.com`,
          leadId ? `Lead ID: ${leadId}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        start: {
          dateTime: slotStart,
          timeZone: AVAILABILITY_CONFIG.timezone,
        },
        end: {
          dateTime: slotEnd,
          timeZone: AVAILABILITY_CONFIG.timezone,
        },
        attendees: [{ email: leadEmail }],
        reminders: {
          useDefault: false,
          overrides: [{ method: "popup", minutes: 15 }],
        },
        conferenceData: undefined, // Zoom link sent via confirmation email instead
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
      };

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
          await supabase.from("leads").update(updatePayload).eq("id", existingLeads[0].id);
        } else {
          // No existing lead — create one
          await supabase.from("leads").insert({
            name: leadName,
            email: leadEmail,
            phone: leadPhone || null,
            ...updatePayload,
            opted_in_at: new Date().toISOString(),
            last_contact_at: new Date().toISOString(),
            proposal_sent: false,
          });
        }
      }

      // Trigger confirmation email via mailer.py (fire-and-forget via Supabase DB flag)
      // We set a flag on the lead that the heartbeat/cron picks up, or call directly
      // For now: store confirmed_at so mailer.py reminders logic can send confirmation
      const confirmedLeadId = leadId || (await (async () => {
        const { data } = await supabase
          .from("leads").select("id").eq("email", leadEmail)
          .eq("booking_completed", true).order("updated_at", { ascending: false }).limit(1);
        return data?.[0]?.id;
      })());

      if (confirmedLeadId) {
        // Mark booked_at so mailer.py send_confirmation can be triggered
        await supabase.from("leads").update({
          booked_at: new Date().toISOString(),
        }).eq("id", confirmedLeadId).is("booked_at", null);
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
