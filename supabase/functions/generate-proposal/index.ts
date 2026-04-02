import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // Validate it looks like a Google Doc URL
    if (!doc_url.includes("docs.google.com/document/d/")) {
      return jsonResponse({ error: "Invalid Google Doc URL" }, 400);
    }

    // Insert job into proposal_jobs table — the local poller picks it up
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error } = await supabase.from("proposal_jobs").insert({
      doc_url,
      slug: slug.replace(/^\/+/, "").replace(/\/+$/, ""),
      status: "pending",
    });

    if (error) {
      return jsonResponse({ error: `Database error: ${error.message}` }, 500);
    }

    return jsonResponse({ success: true, message: "Job queued. Fishtail will process it shortly." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
