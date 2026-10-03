(() => {
  const apiUrl = window.ORIXEO_SALES_API_URL || "";
  if (!apiUrl) {
    console.warn("Orixeo Sales AI: ORIXEO_SALES_API_URL is not configured.");
    return;
  }

  const sessionKey = "orixeo_sales_session_id";
  const sessionId = localStorage.getItem(sessionKey) || crypto.randomUUID();
  localStorage.setItem(sessionKey, sessionId);

  const host = document.createElement("div");
  host.id = "orixeo-sales-ai";
  host.innerHTML = `
    <button class="orixeo-chat-launcher" aria-label="Ouvrir Orixeo Sales AI">IA</button>
    <section class="orixeo-chat-panel" aria-hidden="true">
      <header>
        <div>
          <strong>Orixeo Sales AI</strong>
          <span>Assistant commercial IA</span>
        </div>
        <button class="orixeo-chat-close" aria-label="Fermer">×</button>
      </header>
      <div class="orixeo-chat-messages">
        <div class="orixeo-msg assistant">
          Bonjour, je suis l'assistant Orixeo Lab. Quel sujet souhaitez-vous améliorer aujourd'hui dans votre entreprise ?
        </div>
      </div>
      <form class="orixeo-chat-form">
        <textarea rows="2" placeholder="Votre message..." required></textarea>
        <button type="submit">Envoyer</button>
      </form>
      <footer>Orixeo Lab, une marque de MSDG Innovation</footer>
    </section>`;

  document.body.appendChild(host);

  const panel = host.querySelector(".orixeo-chat-panel");
  const launcher = host.querySelector(".orixeo-chat-launcher");
  const closer = host.querySelector(".orixeo-chat-close");
  const form = host.querySelector(".orixeo-chat-form");
  const input = form.querySelector("textarea");
  const messages = host.querySelector(".orixeo-chat-messages");

  function toggle(open) {
    panel.classList.toggle("open", open);
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    if (open) input.focus();
  }

  function addMessage(role, text) {
    const el = document.createElement("div");
    el.className = `orixeo-msg ${role}`;
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  launcher.addEventListener("click", () => toggle(true));
  closer.addEventListener("click", () => toggle(false));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    addMessage("user", text);
    input.value = "";
    input.disabled = true;

    const pending = addMessage("assistant pending", "Je regarde...");
    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, "")}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: text
        })
      });

      const data = await response.json();
      pending.remove();

      if (!response.ok) throw new Error(data?.error || "Erreur serveur");
      addMessage("assistant", data.reply || "Je n'ai pas pu formuler de réponse.");
    } catch (error) {
      pending.remove();
      addMessage("assistant", "Une erreur technique est survenue. Vous pouvez réessayer dans quelques instants.");
      console.error("Orixeo Sales AI", error);
    } finally {
      input.disabled = false;
      input.focus();
    }
  });
})();
