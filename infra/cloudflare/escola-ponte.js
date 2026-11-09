// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Worker "escola-ponte" do Cloudflare (rota escola.institutolucia.org/*). A Caddy da VPS só conhece institutolucia.org e
// alumia.institutolucia.org; trocar o host numa regra de origem só existe no plano Enterprise. Então este Worker recebe o
// endereço da Escola e repassa o mesmo pedido ao endereço do instituto, contando o host de verdade em x-lucia-host
// (proxy.ts lê e serve só a Escola). A regra de transformação "Escola: host original para o site" escreve x-lucia-host
// em todo pedido que não vem de um Worker do próprio domínio, então ninguém de fora consegue forjar o cabeçalho.
//
// O Worker também decide sozinho o que NÃO é da Escola e manda de volta ao site (307) antes de buscar: o cache do
// Cloudflare guarda o HTML do site e responderia sem passar pelo proxy.ts, e uma página do site aberta neste endereço
// rodaria com acesso à sessão e ao armazenamento da Escola. Passam só: a Escola (menos as duas páginas abertas), entrar e
// as regras, os arquivos do Next, os serviços /api/ e arquivos com extensão (ícones, workers, vozes).
const ESCOLA = "escola.institutolucia.org";
const SITE = "https://institutolucia.org";
const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];
const ABERTAS = ["militantes", "manifesto"];
const LIVRES = ["entrar", "conduta", "privacidade", "termos", "meus-dados", "fora-do-ar", "modo-seguro"];

/** "seguir" (repassar ao site com a marca), {escola} (outro caminho na própria Escola) ou o caminho do site. */
function decidir(caminho) {
  if (caminho.startsWith("/_next/") || caminho.startsWith("/api/") || /\/[^/]+\.[a-z0-9]{1,8}$/i.test(caminho)) return "seguir";
  const partes = caminho.split("/").filter(Boolean);
  if (partes.length === 0) return { escola: "/pt/escola" };
  const comIdioma = IDIOMAS.includes(partes[0]);
  const resto = comIdioma ? partes.slice(1) : partes;
  if (resto.length === 0) return { escola: `/${partes[0]}/escola` };
  if (resto[0] === "escola") return ABERTAS.includes(resto[1] ?? "") ? caminho : "seguir";
  if (LIVRES.includes(resto[0])) return "seguir";
  return comIdioma ? caminho : `/pt${caminho}`;
}

export default {
  async fetch(pedido) {
    const url = new URL(pedido.url);
    if (url.hostname !== ESCOLA) return new Response(null, { status: 404 });
    const decisao = decidir(url.pathname);
    if (typeof decisao === "object") return Response.redirect(`https://${ESCOLA}${decisao.escola}`, 307);
    if (decisao !== "seguir") return Response.redirect(`${SITE}${decisao}${url.search}`, 307);
    const repasse = new Request(new URL(url.pathname + url.search, SITE), pedido);
    const cabecalhos = new Headers(repasse.headers);
    cabecalhos.set("x-lucia-host", ESCOLA);
    return fetch(new Request(repasse, { headers: cabecalhos, redirect: "manual" }));
  },
};
