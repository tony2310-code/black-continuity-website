/**
 * Black Continuity website signup endpoint.
 *
 * Cloudflare Worker route:
 *   blackcontinuity.com/api/signup*
 *
 * Required Worker secret:
 *   BREVO_API_KEY
 *
 * Optional Worker variable:
 *   BREVO_PENDING_LIST_ID (defaults to 14)
 */

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function validEmail(value) {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/api/signup") {
      return json({ error: "Not found" }, 404);
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    if (!env.BREVO_API_KEY) {
      return json({ error: "Signup service is not configured yet." }, 503);
    }

    let body;
    try {
      body = await request.json();
    } catch (_) {
      return json({ error: "Invalid signup request." }, 400);
    }

    const email = String(body.email || "").trim().toLowerCase();
    const firstName = String(body.firstName || "").trim().slice(0, 100);

    if (!validEmail(email)) {
      return json({ error: "Please enter a valid email address." }, 400);
    }

    const pendingListId = Number(env.BREVO_PENDING_LIST_ID || 14);

    const brevoResponse = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": env.BREVO_API_KEY
      },
      body: JSON.stringify({
        email,
        attributes: firstName ? { FIRSTNAME: firstName } : {},
        listIds: [pendingListId],
        updateEnabled: true
      })
    });

    if (!brevoResponse.ok) {
      let detail = "";
      try {
        const failure = await brevoResponse.json();
        detail = failure && failure.message ? failure.message : "";
      } catch (_) {}

      console.error("Brevo signup failed", brevoResponse.status, detail);
      return json({ error: "We could not start your signup. Please try again." }, 502);
    }

    return json({ ok: true, state: "pending_confirmation" });
  }
};
