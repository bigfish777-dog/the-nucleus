import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const GOOGLE_REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  // /login → redirect to Google consent screen
  if (path.endsWith("/login")) {
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    return Response.redirect(authUrl.toString(), 302);
  }

  // /callback → exchange code for tokens and store
  if (path.endsWith("/callback")) {
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      return new Response(`Auth error: ${error}`, { status: 400, headers: corsHeaders });
    }
    if (!code) {
      return new Response("No auth code received", { status: 400, headers: corsHeaders });
    }

    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: GOOGLE_REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error("Token exchange failed:", tokenData);
        return new Response(`Token exchange failed: ${JSON.stringify(tokenData)}`, {
          status: 400,
          headers: corsHeaders,
        });
      }

      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { error: dbError } = await supabase
        .from("google_tokens")
        .upsert(
          {
            user_label: "nick",
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_expiry: expiresAt,
            scopes: SCOPES,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_label" }
        );

      if (dbError) {
        console.error("DB storage failed:", dbError);
        return new Response(`Token storage failed: ${dbError.message}`, {
          status: 500,
          headers: corsHeaders,
        });
      }

      return new Response(
        `<html>
        <head><title>Google Calendar Connected</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 60px; background: #1A1A2E; color: #fff;">
          <h1 style="color: #C9922A;">✅ Google Calendar Connected</h1>
          <p style="color: rgba(255,255,255,0.7);">Tokens stored successfully. You can close this window.</p>
          <p style="color: rgba(255,255,255,0.4); margin-top: 20px; font-size: 13px;">Token expires: ${expiresAt}</p>
        </body>
        </html>`,
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/html" },
        }
      );
    } catch (err: any) {
      console.error("Auth callback error:", err);
      return new Response(`Server error: ${err.message}`, {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  return new Response("Not found. Use /login or /callback", {
    status: 404,
    headers: corsHeaders,
  });
});
