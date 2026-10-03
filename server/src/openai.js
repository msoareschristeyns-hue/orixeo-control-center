function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export async function generateAssistantReply({ systemPrompt, messages, profile, offerName, score }) {
  const input = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "system",
      content: `Profil courant: ${JSON.stringify(profile)}\nOffre recommandee: ${offerName}\nScore commercial: ${score}/100. Pose une seule question utile a la fois. Si le besoin est suffisamment qualifie, formule une recommandation courte puis propose un contact humain.`
    },
    ...messages.map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content || ""
    }))
  ];

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${required("OPENAI_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      input,
      max_output_tokens: 500
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.output_text || data.output?.flatMap(x => x.content || []).map(x => x.text || "").join("\n").trim() || "";
}
