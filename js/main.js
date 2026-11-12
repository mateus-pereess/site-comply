/* ==========================================================
   COMPLY — scripts do site
   ----------------------------------------------------------
   CONFIGURAÇÃO: edite apenas este bloco.
   ========================================================== */
const CONFIG = {
  // Número do WhatsApp (só dígitos, com código do país)
  whatsapp: "351913811060",

  // URL do Google Apps Script que grava cada lead na planilha e envia o e-mail
  // de "Novo lead" (ver CONFIGURAR-PLANILHA.md). Vazio = só abre o WhatsApp.
  // ATENÇÃO: URL de TESTE (planilha de demonstração). Trocar pela da conta da Comply antes da versão oficial.
  leadEndpoint: "https://script.google.com/macros/s/AKfycbwd819YRPPLqVxHslwvSPQwVg9vknEo3nga-ya35fcPhjVZqv2-b_tOuTvAVGdiXSodGw/exec",

  // (Opcional) IDs de medição. Se preenchidos, aparece o aviso de cookies (RGPD)
  // e os scripts só carregam depois que o visitante aceitar.
  metaPixelId: "",     // ex.: "123456789012345"
  ga4Id: "",           // ex.: "G-XXXXXXXXXX"
};

/* Mensagens pré-preenchidas por contexto (botões com data-wa="...") */
const WA_MESSAGES = {
  geral:    "Olá! Vim pelo site da Comply e gostaria de marcar uma consulta.",
  visto:    "Olá! Vim pelo site e quero planejar o meu visto para Portugal.",
  aima:     "Olá! Vim pelo site. O meu processo na AIMA está parado e gostaria de uma análise do meu caso.",
  empresa:  "Olá! Vim pelo site e gostaria de ajuda para estruturar a minha empresa em Portugal.",
  chegada:  "Olá! Vim pelo site e quero organizar a minha chegada a Portugal (NIF, NISS e primeiros passos).",
};

const waUrl = (text) => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;

/* ---------- Medição (só após consentimento) ---------- */
const track = (event, params = {}) => {
  try {
    if (window.fbq) window.fbq("track", event, params);
    if (window.gtag) window.gtag("event", event, params);
  } catch (_) { /* nada */ }
};

function loadTracking() {
  if (CONFIG.metaPixelId) {
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */
    window.fbq("init", CONFIG.metaPixelId);
    window.fbq("track", "PageView");
  }
  if (CONFIG.ga4Id) {
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${CONFIG.ga4Id}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", CONFIG.ga4Id);
  }
}

function initConsent() {
  if (!CONFIG.metaPixelId && !CONFIG.ga4Id) return;
  let choice = null;
  try { choice = localStorage.getItem("comply-consent"); } catch (_) {}
  if (choice === "yes") return loadTracking();
  if (choice === "no") return;
  const box = document.getElementById("consent");
  box.hidden = false;
  box.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-consent]");
    if (!btn) return;
    const val = btn.dataset.consent;
    try { localStorage.setItem("comply-consent", val); } catch (_) {}
    box.hidden = true;
    if (val === "yes") loadTracking();
  });
}

/* ---------- Links de WhatsApp ---------- */
function initWhatsAppLinks() {
  document.querySelectorAll("[data-wa]").forEach((a) => {
    const msg = WA_MESSAGES[a.dataset.wa] || WA_MESSAGES.geral;
    a.href = waUrl(msg);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.addEventListener("click", () => track("Contact", { content_category: a.dataset.wa }));
  });
}

/* ---------- Navegação ---------- */
function initNav() {
  const nav = document.querySelector(".nav");
  const toggle = document.querySelector(".nav__toggle");
  const menu = document.getElementById("menu-mobile");

  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 40);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const setMenu = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    menu.hidden = !open;
    nav.classList.toggle("menu-open", open);
  };
  toggle.addEventListener("click", () => setMenu(menu.hidden));
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  window.addEventListener("resize", () => { if (window.innerWidth > 960) setMenu(false); });
}

/* ==========================================================
   DIAGNÓSTICO — grava o lead (planilha + e-mail) e abre o WhatsApp
   ========================================================== */
function sendLeadBackup(lead) {
  if (!CONFIG.leadEndpoint) return;
  const body = JSON.stringify(lead);
  // keepalive garante o envio mesmo que a pessoa saia da página para o WhatsApp
  try {
    fetch(CONFIG.leadEndpoint, {
      method: "POST",
      mode: "no-cors",
      keepalive: true,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    }).catch(() => navigator.sendBeacon && navigator.sendBeacon(CONFIG.leadEndpoint, body));
  } catch (_) {
    if (navigator.sendBeacon) navigator.sendBeacon(CONFIG.leadEndpoint, body);
  }
}

function initLeadForm() {
  const form = document.getElementById("lead-form");
  if (!form) return;
  const err = form.querySelector(".form__error");
  const choices = form.querySelector(".choices");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const fail = (msg, el) => {
    err.textContent = msg;
    if (el) { el.setAttribute("aria-invalid", "true"); el.focus(); }
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    choices.classList.remove("is-invalid");
    err.textContent = "";

    // robô preencheu o campo invisível: finge sucesso e não grava nada
    if (form.site.value) return;

    const nome = form.nome.value.trim();
    const telefone = form.telefone.value.trim();
    const situacao = (form.querySelector('input[name="situacao"]:checked') || {}).value || "";
    const mensagem = form.mensagem.value.trim();

    if (nome.length < 2) return fail("Por favor, escreva o seu nome.", form.nome);
    if (telefone.replace(/\D/g, "").length < 8) return fail("Confira o seu número de WhatsApp (com código do país).", form.telefone);
    if (!situacao) { choices.classList.add("is-invalid"); return fail("Escolha a opção que mais combina com a sua situação."); }
    if (!form.aceite.checked) return fail("Precisamos da sua autorização para entrar em contato.");

    const lead = {
      nome,
      telefone,
      situacao,
      mensagem,
      pagina: location.href,
      origem: document.referrer || "acesso direto",
    };

    const msg =
`Olá! Preenchi a ficha de diagnóstico no site da Comply.

*Nome:* ${nome}
*WhatsApp:* ${telefone}
*Situação:* ${situacao}${mensagem ? `\n*Detalhes:* ${mensagem}` : ""}

Gostaria de uma análise do meu caso.`;

    // 1) backup primeiro (planilha + e-mail), 2) depois abre o WhatsApp no mesmo clique
    sendLeadBackup(lead);
    track("Lead", { content_category: situacao });

    const url = waUrl(msg);
    const win = window.open(url, "_blank");
    if (win) win.opener = null;
    else location.href = url;

    form.innerHTML = `
      <div class="sheet__head mono"><span>Ficha de diagnóstico</span><span>Recebida ✓</span></div>
      <div class="sheet__done">
        <h3><span class="mono">Quase lá</span>Obrigada, ${esc(nome.split(" ")[0])}.</h3>
        <p>Abrimos o WhatsApp da Comply com o seu resumo. Toque em <strong>enviar</strong> para falar com a nossa equipe.</p>
        <a class="btn btn--dark btn--lg" href="${url}" target="_blank" rel="noopener">O WhatsApp não abriu? Toque aqui ↗</a>
      </div>`;
  });
}

/* ---------- Foto da fundadora: mostra o monograma se a imagem não existir ---------- */
function initPhotoFallback() {
  document.querySelectorAll("img[data-fallback]").forEach((img) => {
    const fallback = () => {
      const frame = img.closest(".letter__frame");
      if (frame) frame.classList.add("is-fallback");
      img.remove();
    };
    if (img.complete && img.naturalWidth === 0) fallback();
    else img.addEventListener("error", fallback, { once: true });
  });
}

/* ---------- Início ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initWhatsAppLinks();
  initNav();
  initFlaps();
  initLeadForm();
  initPhotoFallback();
  initConsent();
  const ano = document.getElementById("ano");
  if (ano) ano.textContent = new Date().getFullYear();
});

/* ---------- Painel de partidas: letras estilo "split-flap" ---------- */
function initFlaps() {
  document.querySelectorAll(".dep__code").forEach((el) => {
    const final = el.textContent.trim();
    el.setAttribute("aria-label", final);
    el.innerHTML = [...final].map(() => '<span class="flap" aria-hidden="true"></span>').join("");
    const flaps = el.querySelectorAll(".flap");
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const settle = () => flaps.forEach((f, i) => { f.textContent = final[i]; });
    if (reduce || !("IntersectionObserver" in window)) return settle();

    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      let ticks = 0;
      const t = setInterval(() => {
        ticks += 1;
        flaps.forEach((f, i) => {
          f.textContent = ticks > 8 + i * 3 ? final[i] : chars[Math.floor(Math.random() * chars.length)];
        });
        if (ticks > 8 + flaps.length * 3) { clearInterval(t); settle(); }
      }, 55);
    }, { threshold: 0.6 });
    io.observe(el);
    settle();
  });
}
