import http from "node:http";
import { randomUUID } from "node:crypto";
import { scoreLead, routeOffer, OFFER_LABELS } from "./scoring.js";
import { mergeProfile, inferProfileFromText } from "./profile.js";
import {
  addMessage,
  createConversation,
  createLead,
  getConversationBySession,
  getRecentMessages,
  updateConversation
} from "./supabase.js";
import { generateAssistantReply } from "./openai.js";

const PORT = Number(process.env.PORT || 8787);
const ORIGIN = process.env.ALLOWED_ORIGIN || "https://orixeo-lab.io";

const SYSTEM_PROMPT = `Tu es Orixeo Sales AI, l assistant commercial d Orixeo Lab, marque de MSDG Innovation.
Tu aides les dirigeants de TPE et PME a identifier des usages concrets de digitalisation, automatisation et IA.
Tu es simple, professionnel, concret et non insistant.
Tu progresses par qualification: contexte, probleme, impact, processus, urgence, recommandation, prochaine etape.
Tu ne garantis jamais un ROI.
Tu ne pretend jamais avoir execute une action si elle n est pas confirmee.
Tu collectes uniquement les coordonnees utiles et uniquement si le prospect accepte d etre recontacte.`;

function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS"
  });
  res.end(JSON.stringify(data));
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function handleChat(req, res) {
  const body = await parseBody(req);
  const sessionId = body.session_id || randomUUID();
  const text = String(body.message || "").trim();

  if (!text) return send(res, 400, { error: "message_required" });

  let conversation = await getConversationBySession(sessionId);
  if (!conversation) {
    conversation = await createConversation({ sessionId, metadata: { profile: {} } });
  }

  const currentProfile = conversation.metadata?.profile || {};
  let profile = mergeProfile(currentProfile, body.profile || {});
  profile = inferProfileFromText(profile, text);

  await addMessage(conversation.id, "user", text, { profile_snapshot: profile });

  const scoring = scoreLead(profile);
  const offerKey = routeOffer(profile);
  const offerName = OFFER_LABELS[offerKey];

  const history = await getRecentMessages(conversation.id, 12);
  const reply = await generateAssistantReply({
    systemPrompt: SYSTEM_PROMPT,
    messages: history,
    profile,
    offerName,
    score: scoring.score
  });

  await addMessage(conversation.id, "assistant", reply, {
    lead_score: scoring.score,
    lead_band: scoring.band,
    recommended_offer: offerKey
  });

  const shouldCreateLead = profile.contact_consent === true && Boolean(profile.email || profile.phone);
  let lead = null;

  if (shouldCreateLead && !conversation.metadata?.lead_created) {
    lead = await createLead({
      conversationId: conversation.id,
      profile,
      score: scoring.score,
      band: scoring.band,
      offerKey,
      offerName
    });
  }

  const metadata = {
    ...(conversation.metadata || {}),
    profile,
    lead_score: scoring.score,
    lead_band: scoring.band,
    recommended_offer: offerKey,
    lead_created: Boolean(conversation.metadata?.lead_created || lead)
  };

  await updateConversation(conversation.id, { metadata });

  send(res, 200, {
    session_id: sessionId,
    reply,
    qualification: {
      score: scoring.score,
      band: scoring.band,
      recommended_offer: offerKey,
      recommended_offer_name: offerName
    },
    lead_created: Boolean(lead)
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method === "GET" && req.url === "/health") {
    return send(res, 200, { ok: true, service: "orixeo-sales-ai" });
  }
  if (req.method === "POST" && req.url === "/chat") {
    try {
      return await handleChat(req, res);
    } catch (error) {
      console.error(error);
      return send(res, 500, { error: "internal_error" });
    }
  }
  send(res, 404, { error: "not_found" });
});

server.listen(PORT, () => {
  console.log(`Orixeo Sales AI listening on :${PORT}`);
});
