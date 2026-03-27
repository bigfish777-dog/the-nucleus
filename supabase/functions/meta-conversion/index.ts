import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHash } from "https://deno.land/std@0.168.0/crypto/mod.ts";

// TTM Pixel ID — primary pixel
const PIXEL_ID = "1427972831789819";
const META_TOKEN = Deno.env.get("META_TOKEN")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256Hash(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { eventName, email, phone, utm_source, utm_campaign, utm_content, custom_params } = await req.json();

    if (!META_TOKEN) {
      console.error("META_TOKEN not set");
      return new Response(JSON.stringify({ error: "META_TOKEN not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Hash PII as required by Meta CAPI
    const hashedEmail = email ? await sha256Hash(email) : undefined;
    const hashedPhone = phone ? await sha256Hash(phone.replace(/\s+/g, "").replace(/^\+/, "")) : undefined;

    const eventTime = Math.floor(Date.now() / 1000);

    const payload = {
      data: [
        {
          event_name: eventName || "Schedule",
          event_time: eventTime,
          action_source: "website",
          event_source_url: "https://book.testtubemarketing.com",
          user_data: {
            ...(hashedEmail && { em: [hashedEmail] }),
            ...(hashedPhone && { ph: [hashedPhone] }),
            client_user_agent: req.headers.get("user-agent") || "",
          },
          custom_data: {
            currency: "GBP",
            value: 1,
            ...(utm_source && { utm_source }),
            ...(utm_campaign && { utm_campaign }),
            ...(utm_content && { utm_content }),
            // Pass through Meta's URL params (adset, hook) as custom data
            ...(custom_params || {}),
          },
        },
      ],
    };

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${META_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Meta CAPI error:", result);
      return new Response(JSON.stringify({ error: result }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`Meta CAPI: ${eventName} event fired for pixel ${PIXEL_ID}`, result);

    return new Response(
      JSON.stringify({ success: true, events_received: result.events_received }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("meta-conversion error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
