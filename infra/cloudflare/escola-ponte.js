// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Worker "escola-ponte" do Cloudflare (rota escola.institutolucia.org/*). A Caddy da VPS só conhece institutolucia.org e
// alumia.institutolucia.org; trocar o host numa regra de origem só existe no plano Enterprise. Então este Worker recebe o
// endereço da Escola e repassa o mesmo pedido ao endereço do instituto, contando o host de verdade em x-lucia-host
// (proxy.ts lê e serve só a Escola). A regra de transformação "Escola: host original para o site" escreve x-lucia-host
// em todo pedido que não vem de um Worker do próprio domínio, então ninguém de fora consegue forjar o cabeçalho.
// Para quem visita, o endereço continua escola.institutolucia.org: sessão e armazenamento separados do site.
const ESCOLA = "escola.institutolucia.org";
const SITE = "https://institutolucia.org";

export default {
  async fetch(pedido) {
    const url = new URL(pedido.url);
    if (url.hostname !== ESCOLA) return new Response(null, { status: 404 });
    const repasse = new Request(new URL(url.pathname + url.search, SITE), pedido);
    const cabecalhos = new Headers(repasse.headers);
    cabecalhos.set("x-lucia-host", ESCOLA);
    return fetch(new Request(repasse, { headers: cabecalhos, redirect: "manual" }));
  },
};
