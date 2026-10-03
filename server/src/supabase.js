function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

const baseUrl = () => required("SUPABASE_URL").replace(/\/$/, "");
const serviceKey = () => required("SUPABASE_SERVICE_ROLE_KEY");
const schema = () => process.env.SUPABASE_SCHEMA || "orixeo";

async function request(path, { method = "GET", body, prefer } = {}) {
  const headers = {
    apikey: serviceKey(),
    Authorization: `Bearer ${serviceKey()}`,
    "Content-Type": "application/json",
    "Accept-Profile": schema(),
    "Content-Profile": schema()
  };
  if (prefer) headers.Prefer = prefer;

  const response = await fetch(`${baseUrl()}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${response.status}: ${text}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function createConversation({ sessionId, metadata = {} }) {
  const orgId = required("ORIXEO_ORGANIZATION_ID");
  const agentId = required("ORIXEO_AGENT_ID");
  const rows = await request("conversations", {
    method: "POST",
    prefer: "return=representation",
    body: {
      organization_id: orgId,
      agent_id: agentId,
      channel: "web",
      external_session_id: sessionId,
      status: "open",
      metadata
    }
  });
  return rows[0];
}

export async function getConversationBySession(sessionId) {
  const q = encodeURIComponent(sessionId);
  const rows = await request(`conversations?external_session_id=eq.${q}&order=started_at.desc&limit=1`);
  return rows?.[0] || null;
}

export async function addMessage(conversationId, role, content, payload = {}) {
  const orgId = required("ORIXEO_ORGANIZATION_ID");
  const rows = await request("messages", {
    method: "POST",
    prefer: "return=representation",
    body: {
      organization_id: orgId,
      conversation_id: conversationId,
      role,
      content,
      payload
    }
  });
  return rows[0];
}

export async function getRecentMessages(conversationId, limit = 12) {
  return request(`messages?conversation_id=eq.${conversationId}&order=created_at.asc&limit=${limit}`);
}

export async function createLead({ conversationId, profile, score, band, offerKey, offerName }) {
  const orgId = required("ORIXEO_ORGANIZATION_ID");
  const agentId = required("ORIXEO_AGENT_ID");
  const rows = await request("leads", {
    method: "POST",
    prefer: "return=representation",
    body: {
      organization_id: orgId,
      agent_id: agentId,
      conversation_id: conversationId,
      first_name: profile.first_name || null,
      last_name: profile.last_name || null,
      company: profile.company || null,
      email: profile.email || null,
      phone: profile.phone || null,
      need: profile.main_pain || null,
      status: band === "priority" ? "qualified" : "new",
      metadata: {
        ...profile,
        lead_score: score,
        lead_band: band,
        recommended_offer: offerKey,
        recommended_offer_name: offerName
      }
    }
  });
  return rows[0];
}

export async function updateConversation(conversationId, patch) {
  const rows = await request(`conversations?id=eq.${conversationId}`, {
    method: "PATCH",
    prefer: "return=representation",
    body: patch
  });
  return rows[0];
}
