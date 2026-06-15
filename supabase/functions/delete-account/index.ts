import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey =
    Deno.env.get("DELETE_ACCOUNT_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    getDefaultSecretKey();
  const authorization = request.headers.get("Authorization");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !authorization) {
    return jsonResponse({ error: "Missing server configuration" }, 500);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } }
  });

  const {
    data: { user },
    error: userError
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const userId = user.id;

  const deleteSteps = [
    adminClient.from("subjects").delete().eq("user_id", userId),
    adminClient.from("semesters").delete().eq("user_id", userId),
    adminClient.from("academic_years").delete().eq("user_id", userId),
    adminClient.from("study_programs").delete().eq("user_id", userId),
    adminClient.from("profiles").delete().eq("id", userId)
  ];

  for (const step of deleteSteps) {
    const { error } = await step;

    if (error) {
      console.error("Account data deletion failed", error);
      return jsonResponse({ error: "Account data deletion failed" }, 500);
    }
  }

  const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);

  if (deleteUserError) {
    console.error("Auth user deletion failed", deleteUserError);
    return jsonResponse({ error: "Auth user deletion failed" }, 500);
  }

  return jsonResponse({ ok: true });
});

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function getDefaultSecretKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (!secretKeys) {
    return "";
  }

  try {
    const parsed = JSON.parse(secretKeys) as Record<string, string>;
    return parsed.default || Object.values(parsed)[0] || "";
  } catch (_error) {
    return "";
  }
}
