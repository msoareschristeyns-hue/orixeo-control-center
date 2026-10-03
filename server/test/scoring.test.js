import test from "node:test";
import assert from "node:assert/strict";
import { scoreLead, routeOffer } from "../src/scoring.js";

test("scores a priority lead", () => {
  const result = scoreLead({
    main_pain: "Double saisie",
    impact_level: "high",
    urgency: "rapidement",
    people_affected: 8,
    role: "Dirigeant",
    contact_consent: true,
    contact_details: "contact@example.com"
  });
  assert.equal(result.score, 100);
  assert.equal(result.band, "priority");
});

test("routes multi-tool manual flow to automation", () => {
  const offer = routeOffer({
    main_pain: "Double saisie entre plusieurs outils et relances manuelles"
  });
  assert.equal(offer, "automation");
});

test("routes unclear need to audit", () => {
  const offer = routeOffer({
    main_pain: "Je voudrais savoir ce que l IA peut apporter a mon entreprise"
  });
  assert.equal(offer, "audit_digital_ia");
});
