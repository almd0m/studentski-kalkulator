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

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const supportEmail = Deno.env.get("CONTACT_TO_EMAIL");
  const fromEmail = Deno.env.get("CONTACT_FROM_EMAIL") || "Moj Prosjek <onboarding@resend.dev>";

  if (!resendApiKey || !supportEmail) {
    return jsonResponse({ error: "Missing contact email configuration" }, 500);
  }

  const body = await request.json().catch(() => ({}));
  const type = sanitizeText(body.type || "Greška");
  const title = sanitizeText(body.title || "");
  const description = sanitizeText(body.description || "");
  const userEmail = sanitizeText(body.userEmail || "-");
  const replyTo = isValidEmail(userEmail) ? userEmail : undefined;

  if (!description) {
    return jsonResponse({ error: "Description is required" }, 400);
  }

  const subject = title ? `Moj Prosjek - ${type}: ${title}` : `Moj Prosjek - ${type}`;
  const text = [
    `Tip poruke: ${type}`,
    `Naslov: ${title || "-"}`,
    `Opis: ${description}`,
    `Korisnik: ${userEmail}`
  ].join("\n");

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: fromEmail,
      to: supportEmail,
      subject,
      text,
      ...(replyTo ? { reply_to: replyTo } : {})
    })
  });

  if (!resendResponse.ok) {
    const details = await resendResponse.text();
    console.error("Contact email failed", details);
    return jsonResponse({ error: "Contact email failed" }, 500);
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

function sanitizeText(value: unknown) {
  return String(value ?? "").trim().slice(0, 4000);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
