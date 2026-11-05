// Supabase Edge Function: invite-user
// Deploy using Supabase CLI after configuring PUBLIC_APP_URL and verifying Auth redirect allow-list.
// SUPABASE_SERVICE_ROLE_KEY must remain in Edge secrets; never expose in static assets.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
// The live Workers origin is public configuration, not a secret.
const allowedOrigin = "https://fantasy-cb-redeiras.cbaloncestoredeiras.workers.dev";
const headers = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
  "Content-Type": "application/json",
  Vary: "Origin",
});
const response = (status: number, body: object, origin: string) =>
  new Response(JSON.stringify(body), { status, headers: headers(origin) });

serve(async (request) => {
  const origin = request.headers.get("origin") ?? "";
  if (!allowedOrigin || origin !== allowedOrigin) {
    return response(403, { error: "Origin not allowed" }, allowedOrigin || "null");
  }
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
  if (request.method !== "POST") return response(405, { error: "Method not allowed" }, origin);
  if (!url || !serviceKey || !publicKey) return response(503, { error: "Server configuration incomplete" }, origin);
  const bearer = request.headers.get("authorization") ?? "";
  if (!bearer.startsWith("Bearer ")) return response(401, { error: "Auth required" }, origin);
  const jwt = bearer.slice(7);
  const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: session, error: sessionError } = await client.auth.getUser(jwt);
    if (sessionError || !session.user) return response(401, { error: "Invalid user token" }, origin);
    const payload = await request.json();
    const clubId = String(payload.clubId ?? "");
    const email = String(payload.email ?? "").trim().toLowerCase();
    const role = String(payload.role ?? "participant");
    const linkedPlayer = payload.linkedPlayer ? String(payload.linkedPlayer) : null;
    if (!/^[0-9a-f-]{36}$/.test(clubId) ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !["participant", "admin"].includes(role) || !payload.privacyVerified)
      return response(400, { error: "Missing valid invitation details / permission confirmation" }, origin);

    const { data: member, error: permError } = await service.from("club_memberships")
      .select("role").eq("club_id", clubId).eq("user_id", session.user.id).maybeSingle();
    if (permError || member?.role !== "admin") return response(403, { error: "Admin permission required" }, origin);
    if (linkedPlayer) {
      const { data: p, error: pe } = await service.from("players")
        .select("id,club_id").eq("id", linkedPlayer).eq("club_id", clubId).maybeSingle();
      if (pe || !p) return response(400, { error: "Player is not from this club" }, origin);
    }
    // A player's voting identity must never be silently reassigned by an invitation.
    if (linkedPlayer) {
      const { data: existingLink, error: linkError } = await service.from("player_accounts")
        .select("user_id").eq("player_id", linkedPlayer).maybeSingle();
      if (linkError) return response(500, { error: "Could not verify player mapping" }, origin);
      if (existingLink) return response(409, { error: "Player already linked; ask admin to review the existing account" }, origin);
    }
    const options = { redirectTo: allowedOrigin };
    const { data: invited, error: inviteError } = await service.auth.admin.inviteUserByEmail(email, options);
    if (inviteError || !invited.user) {
      // Default Supabase Auth email sending is heavily rate-limited. Do not
      // present a failed invitation as if the account had been created.
      if (inviteError?.status === 429 || inviteError?.code === "over_email_send_rate_limit") {
        return response(429, {
          error: "Límite de correos de Supabase alcanzado. Non se enviou a invitación. Configura un SMTP propio en Supabase (Authentication → SMTP) e volve tentalo máis tarde.",
        }, origin);
      }
      if (inviteError?.code === "email_address_not_authorized") {
        return response(403, {
          error: "Supabase só permite enviar correos a enderezos autorizados. Configura un SMTP propio para invitar participantes.",
        }, origin);
      }
      // Existing auth users are assigned through the secured fantasy_add_member RPC.
      return response(400, { error: "Non se puido enviar a invitación. Se a conta xa existe, hai que vinculala desde o procedemento de usuarios existentes." }, origin);
    }
    const uid = invited.user.id;
    const { error: memberError } = await service.from("club_memberships")
      .upsert({ club_id: clubId, user_id: uid, role }, { onConflict: "club_id,user_id" });
    if (memberError) return response(500, { error: "Invitation sent but club membership failed; contact support" }, origin);
    if (linkedPlayer) {
      const { error: mappingError } = await service.from("player_accounts")
        .upsert({ player_id: linkedPlayer, user_id: uid }, { onConflict: "player_id" });
      if (mappingError) return response(500, { error: "Invitation sent, but player mapping failed" }, origin);
    }
    return response(200, { invited: true }, origin);
  } catch {
    return response(400, { error: "Invalid invitation request" }, origin);
  }
});
