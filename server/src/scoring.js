export const SCORE_RULES = [
  ["main_pain", 15, v => Boolean(v)],
  ["impact_level", 20, v => ["high", "very_high"].includes(v)],
  ["urgency", 20, v => ["rapidement", "moins_3_mois"].includes(v)],
  ["people_affected", 10, v => Number(v || 0) >= 2],
  ["role", 15, v => /(dirigeant|gerant|gérant|president|président|direction|responsable)/i.test(v || "")],
  ["contact_consent", 10, v => v === true],
  ["contact_details", 10, v => Boolean(v)]
];

export function scoreLead(profile = {}) {
  const details = [];
  let score = 0;
  for (const [field, points, predicate] of SCORE_RULES) {
    if (predicate(profile[field])) {
      score += points;
      details.push({ field, points });
    }
  }
  return {
    score,
    band: score >= 70 ? "priority" : score >= 40 ? "follow_up" : "early",
    details
  };
}

export function routeOffer(profile = {}) {
  const text = [
    profile.main_pain,
    profile.current_process,
    ...(Array.isArray(profile.tools) ? profile.tools : [profile.tools])
  ].filter(Boolean).join(" ").toLowerCase();

  if (/formation|equipes|équipes|adoption|competence|compétence/.test(text)) {
    return "training_action";
  }
  if (/assistant|analyse|synthese|synthèse|redaction|rédaction|document|aide a la decision|aide à la décision/.test(text)) {
    return "generative_ai";
  }
  if (/double saisie|relance|validation|transfert|plusieurs outils|workflow|automatis/.test(text)) {
    return "automation";
  }
  if (/repetitive|répétitive|simple|rapide|petite tache|petite tâche/.test(text)) {
    return "quick_wins";
  }
  return "audit_digital_ia";
}

export const OFFER_LABELS = {
  audit_digital_ia: "Audit Digital & IA",
  quick_wins: "Quick wins",
  automation: "Automatisation",
  generative_ai: "IA générative métiers",
  training_action: "Formation-action"
};
