export function mergeProfile(current = {}, incoming = {}) {
  const allowed = [
    "first_name","last_name","company","role","sector","company_size",
    "main_pain","impact_type","impact_level","current_process","tools",
    "urgency","people_affected","contact_consent","email","phone"
  ];
  const next = { ...current };
  for (const key of allowed) {
    if (incoming[key] !== undefined && incoming[key] !== null && incoming[key] !== "") {
      next[key] = incoming[key];
    }
  }
  next.contact_details = next.email || next.phone || null;
  return next;
}

export function inferProfileFromText(profile = {}, text = "") {
  const next = { ...profile };
  const lower = text.toLowerCase();

  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  if (email) next.email = email;

  const phone = text.match(/(?:\+33|0)[1-9](?:[ .-]?\d{2}){4}/)?.[0];
  if (phone) next.phone = phone;

  if (/urgent|rapidement|au plus vite|des que possible|dès que possible/.test(lower)) next.urgency = "rapidement";
  if (/moins de 3 mois|dans les 3 mois|ce trimestre/.test(lower)) next.urgency = "moins_3_mois";

  if (/beaucoup|important|majeur|critique|tres eleve|très élevé/.test(lower)) next.impact_level = "high";

  const people = text.match(/(\d+)\s+(personnes|collaborateurs|salari[eé]s|utilisateurs)/i)?.[1];
  if (people) next.people_affected = Number(people);

  next.contact_details = next.email || next.phone || null;
  return next;
}
