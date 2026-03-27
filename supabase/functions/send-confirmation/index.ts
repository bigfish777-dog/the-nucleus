import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { leadEmail } = await req.json();

    if (!leadEmail) {
      return new Response(
        JSON.stringify({ error: "Missing leadEmail" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Flag the lead for confirmation — VPS mailer.py picks this up and sends
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Only flag leads that have a confirmed call_datetime (not null)
    // Using RPC or subquery approach — Supabase JS doesn't support .limit on .update directly,
    // so we find the lead first, then update by id
    const { data: matchingLeads, error: findError } = await supabase
      .from("leads")
      .select("id")
      .eq("email", leadEmail)
      .eq("booking_completed", true)
      .not("call_datetime", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (findError || !matchingLeads || matchingLeads.length === 0) {
      return new Response(
        JSON.stringify({ error: "No booked lead with call_datetime found for this email" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error } = await supabase
      .from("leads")
      .update({ confirm_pending: true })
      .eq("id", matchingLeads[0].id);

    if (error) {
      console.error("DB flag error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, queued: leadEmail }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("send-confirmation error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
