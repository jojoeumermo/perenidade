// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
//
// Deixa o PWA abrir (a casca do app) sem internet. Nenhum dado do painel é guardado: tudo vem do serviço, com a
// sessão da pessoa, e some quando a aba fecha.
const VERSAO = "v1";
const CASCA = `sentinela-casca-${VERSAO}`;

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(CASCA).then((cache) => cache.addAll(["/", "/manifest.webmanifest", "/icone-192.png"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (evento) => {
  evento.waitUntil((async () => {
    for (const nome of await caches.keys()) if (nome.startsWith("sentinela-") && nome !== CASCA) await caches.delete(nome);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);
  // Só a própria casca (mesma origem, GET); chamadas ao serviço nunca passam por aqui.
  if (evento.request.method !== "GET" || url.origin !== self.location.origin) return;
  evento.respondWith((async () => {
    const cache = await caches.open(CASCA);
    try {
      const resposta = await fetch(evento.request);
      if (resposta.ok && /\.(js|css|png|webmanifest|woff2)$|\/$/.test(url.pathname)) await cache.put(evento.request, resposta.clone());
      return resposta;
    } catch {
      return (await cache.match(evento.request)) ?? (await cache.match("/")) ?? Response.error();
    }
  })());
});
