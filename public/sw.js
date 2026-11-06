// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Faz o site e o aplicativo abrirem sem internet (docs/APP.md, pacote app-offline; docs/APP-OFFLINE.md).
//  - Casca do aplicativo: as 5 telas das abas (Início, Estudar, Jogos e labs, Comunidade, Eu) ficam guardadas por idioma,
//    a pedido da página (mensagem "casca"), para a barra de baixo nunca cair na página "sem conexão".
//  - Aulas: toda página aberta é guardada (as últimas 300); os cursos que a pessoa mandou "Guardar" ficam num cache à
//    parte que nunca é aparado nem apagado numa atualização; as aulas do "Comece aqui" entram na casca.
//  - Jogos e ferramentas leves (public/labs, blockly, jscpp, fontes, capas...): guardados ao serem usados; os pesados
//    (pyodide, php, ruby, lua, typescript, vídeos) não, porque pesam dezenas de MB.
//  - Atualização com aviso: a versão nova NÃO assume sozinha. Fica esperando e a página mostra "Nova versão, toque para
//    atualizar"; o toque manda {tipo: "pular"}. Só a primeira instalação assume na hora (não há versão antiga a proteger).
// Nada do painel nem da entrada é guardado. Nada sai do aparelho por aqui: o SW só baixa páginas do próprio site.
// Mudou a VERSAO? Mude também a de components/Offline.tsx (NOME_DAS_PAGINAS) e rode npm run testar:app-offline.
const VERSAO = "v5";
const PAGINAS = `lucia-paginas-${VERSAO}`;
const FIXOS = `lucia-fixos-${VERSAO}`;
const LEVES = `lucia-leves-${VERSAO}`;
const CASCA = `lucia-casca-${VERSAO}`;
/** Os cursos guardados pela pessoa. SEM versão de propósito: trocar a VERSAO não pode apagar o que ela mandou guardar. */
const CURSOS = "lucia-cursos";
const CACHES_ATUAIS = [PAGINAS, FIXOS, LEVES, CASCA, CURSOS];
/** Onde procurar uma página sem rede, na ordem. */
const ONDE_PAGINAS = [PAGINAS, CASCA, CURSOS];
const LIMITE_DE_PAGINAS = 300;
const LIMITE_DE_FIXOS = 800;
const LIMITE_DE_LEVES = 250;
const LIMITE_DA_CASCA = 90;
/** Nenhum arquivo "leve" passa disto (bytes): o que for maior fica por conta da rede. */
const TAMANHO_MAXIMO_LEVE = 4 * 1024 * 1024;
const MAXIMO_DE_EXTRAS = 12;

/** As telas das abas do aplicativo (components/app/modo.ts RAIZ_DA_ABA), sem o idioma. Início é "". */
const RAIZES_DAS_ABAS = ["", "/trilhas", "/jogos", "/comunidade", "/meu-estudo"];

// A página "sem conexão" no idioma do endereço. Sem prefixo, português.
// [html lang, título, h1, texto, link para as disciplinas, botão "tentar de novo"]
const TEXTOS_SEM_REDE = {
  pt: ["pt-BR", "Sem conexão", "Você está sem conexão", "Esta página ainda não foi guardada neste aparelho. As aulas que você já abriu, e os cursos que mandou guardar, continuam disponíveis.", "Ir para as disciplinas", "Tentar de novo"],
  en: ["en", "Offline", "You are offline", "This page has not been saved on this device yet. The lessons you have already opened, and the courses you saved, are still available.", "Go to the subjects", "Try again"],
  es: ["es", "Sin conexión", "Estás sin conexión", "Esta página todavía no se guardó en este aparato. Las clases que ya abriste, y los cursos que guardaste, siguen disponibles.", "Ir a las disciplinas", "Intentar de nuevo"],
  fr: ["fr", "Hors ligne", "Vous êtes hors ligne", "Cette page n'a pas encore été enregistrée sur cet appareil. Les leçons déjà ouvertes, et les cours enregistrés, restent disponibles.", "Aller aux disciplines", "Réessayer"],
  ru: ["ru", "Нет связи", "Нет подключения к интернету", "Эта страница ещё не сохранена на этом устройстве. Уроки, которые вы уже открывали, и сохранённые курсы по-прежнему доступны.", "К дисциплинам", "Повторить"],
  zh: ["zh", "离线", "你目前处于离线状态", "此页面尚未保存在本设备上。你已打开过的课程和已保存的课程仍可使用。", "前往学科", "重试"],
};
const IDIOMAS = Object.keys(TEXTOS_SEM_REDE);

function idiomaDe(caminho) {
  return /^\/(en|es|fr|ru|zh)(\/|$)/.exec(caminho)?.[1] ?? "pt";
}

function semRede(caminho) {
  const lang = idiomaDe(caminho);
  const [html, titulo, h1, texto, link, tentar] = TEXTOS_SEM_REDE[lang];
  return `<!doctype html><html lang="${html}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo} — Instituto Lúcia</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4ecd8;color:#1f1a14;font-family:Georgia,serif;padding:1.5rem}main{max-width:32rem}h1{font-size:2rem;margin:0 0 .75rem}p{font-size:1.15rem;line-height:1.5}a{color:#6e1f1a}button{font:inherit;font-weight:700;padding:.7rem 1.2rem;border-radius:999px;border:2px solid #1f1a14;background:#c21f16;color:#fff;min-height:44px}@media(prefers-color-scheme:dark){body{background:#17130e;color:#efe4c8}a{color:#e0837a}button{border-color:#efe4c8}}</style></head>
<body><main><h1>${h1}</h1><p>${texto}</p><p><button type="button" onclick="location.reload()">${tentar}</button></p><p><a href="/${lang}/trilhas">${link}</a></p></main></body></html>`;
}

const fixo = (caminho) => /^\/(_next\/static\/|imagens\/|arquivos\/|marca|icon|apple-icon|cartao)/.test(caminho);
/** Jogos e ferramentas leves e imagens otimizadas. Fora daqui, de propósito: pyodide, php, ruby, lua, typescript, videos-curtos, vozes-amostras. */
const leve = (caminho) => /^\/(labs|blockly|jscpp|fontes|capas|territorios|tri|workers|_next\/image)(\/|$)/.test(caminho);
const privado = (caminho) => /^\/[a-z]{2}\/(painel|entrar|meus-dados|certificado)(\/|$)/.test(caminho) || caminho.startsWith("/_vercel/") || caminho.startsWith("/api/");

/** As telas das abas de um idioma: ["/pt", "/pt/trilhas", "/pt/jogos", "/pt/comunidade", "/pt/meu-estudo"]. */
function urlsDaCasca(lang) {
  return IDIOMAS.includes(lang) ? RAIZES_DAS_ABAS.map((raiz) => `/${lang}${raiz}`) : [];
}

/** Aceita só caminho do próprio site, num idioma, fora do que é privado. Devolve o caminho limpo ou null. */
function caminhoPermitido(valor) {
  if (typeof valor !== "string" || valor.length === 0 || valor.length > 300) return null;
  if (!valor.startsWith("/") || valor.startsWith("//") || valor.includes("\\")) return null;
  let url;
  try {
    url = new URL(valor, "https://lucia.invalido");
  } catch {
    return null;
  }
  if (url.origin !== "https://lucia.invalido") return null;
  if (!/^\/(pt|en|es|fr|ru|zh)(\/|$)/.test(url.pathname) || privado(url.pathname)) return null;
  return url.pathname;
}

/** O que a mensagem "casca" manda guardar: as 5 telas do idioma e até MAXIMO_DE_EXTRAS páginas extras (as aulas do dia). */
function planoDaCasca(mensagem) {
  const lang = typeof mensagem?.lang === "string" && IDIOMAS.includes(mensagem.lang) ? mensagem.lang : null;
  if (!lang) return [];
  const extras = Array.isArray(mensagem.extras) ? mensagem.extras.slice(0, MAXIMO_DE_EXTRAS).map(caminhoPermitido).filter(Boolean) : [];
  return [...new Set([...urlsDaCasca(lang), ...extras])];
}

const tamanhoPermitido = (resposta) => {
  const tamanho = Number(resposta.headers.get("content-length"));
  return !(Number.isFinite(tamanho) && tamanho > TAMANHO_MAXIMO_LEVE);
};

async function aparar(nome, maximo) {
  const cache = await caches.open(nome);
  const chaves = await cache.keys();
  for (const chave of chaves.slice(0, Math.max(0, chaves.length - maximo))) await cache.delete(chave);
}

/** Copia o que há num cache de versão antiga para o novo, sem rede, para a atualização não esvaziar as últimas aulas. */
async function migrar(antigo, novo, maximo) {
  const de = await caches.open(antigo);
  const para = await caches.open(novo);
  const chaves = await de.keys();
  for (const chave of chaves.slice(-maximo)) {
    if (await para.match(chave)) continue;
    const resposta = await de.match(chave);
    if (resposta) await para.put(chave, resposta);
  }
}

self.addEventListener("install", (evento) => {
  // A primeira instalação (sem versão antiga ativa) assume na hora. Atualização: espera o "toque para atualizar".
  evento.waitUntil(self.registration && self.registration.active ? Promise.resolve() : self.skipWaiting());
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      for (const nome of nomes) {
        if (nome.startsWith("lucia-paginas-") && nome !== PAGINAS) await migrar(nome, PAGINAS, LIMITE_DE_PAGINAS).catch(() => undefined);
        else if (nome.startsWith("lucia-fixos-") && nome !== FIXOS) await migrar(nome, FIXOS, LIMITE_DE_FIXOS).catch(() => undefined);
        // A casca e os jogos leves também passam: sem isto, logo depois de atualizar as 5 abas não abririam sem internet
        // (a página só pede a casca uma vez por visita).
        else if (nome.startsWith("lucia-casca-") && nome !== CASCA) await migrar(nome, CASCA, LIMITE_DA_CASCA).catch(() => undefined);
        else if (nome.startsWith("lucia-leves-") && nome !== LEVES) await migrar(nome, LEVES, LIMITE_DE_LEVES).catch(() => undefined);
      }
      for (const nome of await caches.keys()) if (nome.startsWith("lucia-") && !CACHES_ATUAIS.includes(nome)) await caches.delete(nome);
      await self.clients.claim();
    })(),
  );
});

/** Procura a página guardada (ignorando a busca ?x=y) nos caches de páginas. Devolve {resposta, cache} ou null. */
async function acharPagina(url) {
  for (const nome of ONDE_PAGINAS) {
    const cache = await caches.open(nome);
    const resposta = await cache.match(url, { ignoreSearch: true, ignoreVary: true });
    if (resposta) return { resposta, nome };
  }
  return null;
}

/** Páginas: tenta a rede (para a pessoa ver sempre a versão mais nova) e, sem ela, usa a cópia guardada. */
async function primeiroARede(pedido) {
  const guardada = await acharPagina(pedido.url);
  const semInternet = typeof navigator !== "undefined" && navigator.onLine === false;
  if (!semInternet) {
    try {
      const controle = new AbortController();
      // Com cópia guardada não vale esperar uma rede lenta: 3 s. Sem cópia, 6 s.
      const relogio = setTimeout(() => controle.abort(), guardada ? 3000 : 6000);
      const resposta = await fetch(pedido, { signal: controle.signal });
      clearTimeout(relogio);
      // Erro do servidor (5xx) com cópia guardada: a cópia vale mais que a página de erro.
      if (guardada && resposta.status >= 500) return guardada.resposta;
      if (resposta.ok && resposta.type === "basic") {
        // Se a página já mora na casca ou nos cursos, a cópia nova vai para o mesmo lugar (e fica fresca).
        const destino = guardada ? guardada.nome : PAGINAS;
        const cache = await caches.open(destino);
        await cache.put(pedido.url, resposta.clone());
        if (destino === PAGINAS) void aparar(PAGINAS, LIMITE_DE_PAGINAS);
      }
      return resposta;
    } catch {
      // cai na cópia guardada
    }
  }
  return guardada ? guardada.resposta : new Response(semRede(new URL(pedido.url).pathname), { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "X-Lucia-Offline": "1" } });
}

/** Arquivos que nunca mudam de conteúdo (o nome muda quando o conteúdo muda): a cópia guardada basta. */
async function primeiroOGuardado(pedido) {
  const cache = await caches.open(FIXOS);
  const guardado = await cache.match(pedido.url);
  if (guardado) return guardado;
  const resposta = await fetch(pedido);
  if (resposta.ok && resposta.type === "basic") {
    await cache.put(pedido.url, resposta.clone());
    void aparar(FIXOS, LIMITE_DE_FIXOS);
  }
  return resposta;
}

/** Jogos e ferramentas leves: mostra a cópia guardada na hora e atualiza por trás (o nome do arquivo nem sempre muda). */
async function guardadoEAtualiza(pedido, evento) {
  const cache = await caches.open(LEVES);
  const guardado = await cache.match(pedido.url);
  const rede = fetch(pedido).then(async (resposta) => {
    if (resposta.ok && resposta.type === "basic" && tamanhoPermitido(resposta)) {
      await cache.put(pedido.url, resposta.clone());
      void aparar(LEVES, LIMITE_DE_LEVES);
    }
    return resposta;
  });
  if (guardado) {
    evento.waitUntil(rede.catch(() => undefined));
    return guardado;
  }
  return rede;
}

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET" || pedido.headers.has("range")) return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin || privado(url.pathname)) return;
  if (fixo(url.pathname)) {
    evento.respondWith(primeiroOGuardado(pedido));
    return;
  }
  if (leve(url.pathname)) {
    evento.respondWith(guardadoEAtualiza(pedido, evento));
    return;
  }
  // Só documentos inteiros: os pedaços que o site troca entre páginas ficam por conta da rede e,
  // sem ela, o navegador pede o documento inteiro, que sai daqui.
  if (pedido.mode === "navigate") evento.respondWith(primeiroARede(pedido));
});

/** Guarda a casca: baixa, uma de cada vez e só o que falta, as telas pedidas. Não faz nada sem rede nem em modo de economia (a página já filtra). */
async function guardarCasca(caminhos) {
  const cache = await caches.open(CASCA);
  for (const caminho of caminhos) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) break;
    if (await acharPagina(new URL(caminho, self.location.origin).href)) continue;
    try {
      const resposta = await fetch(caminho, { credentials: "same-origin" });
      if (resposta.ok && resposta.type === "basic" && !resposta.redirected) await cache.put(new URL(caminho, self.location.origin).href, resposta);
    } catch {
      break; // sem rede de verdade: tenta de novo na próxima visita
    }
  }
  await aparar(CASCA, LIMITE_DA_CASCA);
}

// Mensagens da página (só do próprio site: um service worker só recebe mensagens das páginas que controla).
//  {tipo: "pular"}                        a pessoa tocou em "atualizar": a versão nova assume
//  {tipo: "casca", lang, extras: [...]}   guarda as 5 telas das abas do idioma e as aulas do dia
//  {tipo: "versao"}                       responde {tipo: "versao", versao}
self.addEventListener("message", (evento) => {
  const dados = evento.data;
  if (!dados || typeof dados.tipo !== "string") return;
  if (dados.tipo === "pular") {
    self.skipWaiting();
  } else if (dados.tipo === "casca") {
    const plano = planoDaCasca(dados);
    if (plano.length > 0) evento.waitUntil(guardarCasca(plano).catch(() => undefined));
  } else if (dados.tipo === "versao" && evento.source && "postMessage" in evento.source) {
    evento.source.postMessage({ tipo: "versao", versao: VERSAO });
  }
});

// ── Aviso no celular da Rede (Web Push, pacote avisos; docs/rede/AVISOS.md) ──
// O conteúdo do aviso é só {n, l}: quantos avisos e o idioma. Nunca o texto de um post. Toda notificação recebida é mostrada
// (exigência do navegador) e toca na tela de Avisos da Rede.
const TEXTOS_AVISO = {
  pt: ["Alumia", (n) => (n === 1 ? "Você tem 1 aviso na Alumia." : n > 1 ? `Você tem ${n} avisos na Alumia.` : "Você tem avisos novos na Alumia.")],
  en: ["Alumia", (n) => (n === 1 ? "You have 1 notification on Alumia." : n > 1 ? `You have ${n} notifications on Alumia.` : "You have new notifications on Alumia.")],
  es: ["Alumia", (n) => (n === 1 ? "Tienes 1 aviso en Alumia." : n > 1 ? `Tienes ${n} avisos en Alumia.` : "Tienes avisos nuevos en Alumia.")],
  fr: ["Alumia", (n) => (n === 1 ? "Vous avez 1 notification sur Alumia." : n > 1 ? `Vous avez ${n} notifications sur Alumia.` : "Vous avez de nouvelles notifications sur Alumia.")],
  ru: ["Alumia", (n) => (n > 0 ? `У вас уведомлений в Alumia: ${n}.` : "У вас новые уведомления в Alumia.")],
  zh: ["Alumia", (n) => (n > 0 ? `你在 Alumia 上有 ${n} 条通知。` : "你在 Alumia 上有新通知。")],
};

self.addEventListener("push", (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    dados = {};
  }
  const lang = typeof dados.l === "string" && dados.l in TEXTOS_AVISO ? dados.l : "pt";
  const n = Number.isInteger(dados.n) && dados.n > 0 && dados.n < 100 ? dados.n : 0;
  const [titulo, frase] = TEXTOS_AVISO[lang];
  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: frase(n),
      icon: "/icone-192.png",
      badge: "/marca-96.png",
      tag: "rede-avisos",
      data: { lang },
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const lang = typeof evento.notification.data?.lang === "string" && evento.notification.data.lang in TEXTOS_AVISO ? evento.notification.data.lang : "pt";
  const destino = `/${lang}/comunidade/avisos`;
  evento.waitUntil(
    (async () => {
      const abertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const janela of abertas) {
        if (new URL(janela.url).origin === self.location.origin && "focus" in janela) {
          await janela.focus();
          if ("navigate" in janela) await janela.navigate(destino).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(destino);
    })(),
  );
});

// Só para o teste (scripts/testar-app-offline.mjs). No navegador `module` não existe e isto não roda.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { VERSAO, PAGINAS, FIXOS, LEVES, CASCA, CURSOS, TEXTOS_SEM_REDE, idiomaDe, semRede, fixo, leve, privado, urlsDaCasca, caminhoPermitido, planoDaCasca };
}
