// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a fundação da Alumia nova (PLANO-ALUMIA, F0): a rota /alumia no lugar de /comunidade (308 com a busca, um salto só para os
// endereços antigos do Fórum, host próprio, interdição, sitemap, nenhum link velho), as flags só pelo nome e desligadas, as 12
// rotas novas atrás das flags, os encaixes, o Sair rápido, a conta extra sem o dono nos metadados e a migração
// 20261109-alumia-f0-contrato.sql num Postgres de verdade (rodada DUAS vezes).
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 --import ./scripts/carregar-ts.mjs scripts/testar-alumia-rota.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { caminhoNovoDaAlumia, destinoDaComunidade, ehCaminhoDaAlumia, encaixeAtivo } from "../lib/rede/rota-alumia.ts";
import { destinoDireto, destinoNovo, pedidoAntigo } from "../lib/rede/antigos.ts";
import { caminhoDoSiteParaAlumia, enderecoDaAlumia, ROTAS_DA_ALUMIA, rotaNaAlumia } from "../lib/rede/alumia.ts";
import { enderecos, ERROS_DA_REDE } from "../lib/rede/tipos.ts";
import { areaDoCaminho, fechado } from "../lib/interdicao.ts";
import { ligado, lerRecursos, RECURSOS, SO_PELO_NOME } from "../lib/recursos.ts";
import { ROTAS_NOVAS, alumia2Ligada, rotaNovaLigada } from "../lib/rede/rotas-novas.ts";
import { apagarChavesDaRede, PREFIXO_DA_REDE, rodarLimpezas } from "../lib/rede/saida.ts";
import { codinomeOk, corpoDoUsuario, criarContaExtra, emailAleatorio } from "../lib/rede/contas-extra.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const existe = (c) => fs.existsSync(path.join(raiz, c));

let certos = 0;
const falhas = [];
const igual = (nome, valor, esperado) => {
  if (JSON.stringify(valor) === JSON.stringify(esperado)) certos++;
  else falhas.push(`${nome}: veio ${JSON.stringify(valor)}, esperava ${JSON.stringify(esperado)}`);
};
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 300)}`);
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}
async function recusa(nome, promessa, codigo) {
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 160)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}

const ID = "0b9c5f0e-7f3a-4c1e-9d55-2f6a8f0d1c11";

// ═══════════════════ 1. O 308 de /comunidade para /alumia (lib/rede/rota-alumia.ts, usada pelo proxy.ts) ═══════════════════
igual("post antigo com busca", destinoDaComunidade("/pt/comunidade/p/x", "?y=1"), "/pt/alumia/p/x?y=1");
igual("a linha", destinoDaComunidade("/pt/comunidade"), "/pt/alumia");
igual("barra no fim cai", destinoDaComunidade("/pt/comunidade/"), "/pt/alumia");
igual("inglês", destinoDaComunidade("/en/comunidade/c/matematica"), "/en/alumia/c/matematica");
igual("chinês com busca", destinoDaComunidade("/zh/comunidade/buscar", "?q=greve"), "/zh/alumia/buscar?q=greve");
igual("sem idioma vai para o português, num salto só", destinoDaComunidade("/comunidade/p/1", "?t=2"), "/pt/alumia/p/1?t=2");
igual("sem idioma, a linha", destinoDaComunidade("/comunidade"), "/pt/alumia");
igual("busca sem ? ganha o ?", destinoDaComunidade("/pt/comunidade", "t=1"), "/pt/alumia?t=1");
igual("? sozinho some", destinoDaComunidade("/pt/comunidade", "?"), "/pt/alumia");
igual("/comunidades (outra rota) não é da Alumia", destinoDaComunidade("/pt/comunidades"), null);
igual("/comunidade-x não é", destinoDaComunidade("/pt/comunidade-x"), null);
igual("/comunidades-tradicionais não é", destinoDaComunidade("/pt/comunidades-tradicionais"), null);
igual("idioma que não existe não é", destinoDaComunidade("/xx/comunidade"), null);
igual("/alumia já é o novo", destinoDaComunidade("/pt/alumia"), null);
igual("subpasta que só começa com comunidade não é", destinoDaComunidade("/pt/trilhas/comunidade"), null);
igual("barra dupla não vira outro domínio", destinoDaComunidade("/pt/comunidade//evil.example/x"), "/pt/alumia/evil.example/x");
for (const caso of ["/pt/comunidade//evil.example", "/comunidade/\\evil", "/en/comunidade/p/%2F%2Fevil", "/comunidade//"]) {
  const d = destinoDaComunidade(caso, "?a=1");
  ok(`destino de "${caso}" fica no próprio site (${d})`, d === null || (/^\/(pt|en|es|fr|ru|zh)\/alumia(\/|\?|$)/.test(d) && !d.startsWith("//")));
}
igual("caminho novo sem a busca", caminhoNovoDaAlumia("/ru/comunidade/u/maria_luta"), "/ru/alumia/u/maria_luta");
igual("ehCaminhoDaAlumia", [ehCaminhoDaAlumia("/alumia"), ehCaminhoDaAlumia("/alumia/p/x"), ehCaminhoDaAlumia("/comunidade"), ehCaminhoDaAlumia("/comunidades"), ehCaminhoDaAlumia("/alumiar")], [true, true, true, false, false]);

// ═══════════════════ 2. Endereços antigos do Fórum: um salto só ═══════════════════
igual("?t= no caminho novo", pedidoAntigo("/pt/alumia", `?t=${ID}`), { lang: "pt", tipo: "topico", antigo: ID });
igual("?t= no caminho antigo (antes do 308)", pedidoAntigo("/pt/comunidade", `?t=${ID}`), { lang: "pt", tipo: "topico", antigo: ID });
igual("?post= vai direto ao post novo", destinoDireto(pedidoAntigo("/en/alumia", `?post=${ID}`)), `/en/alumia/p/${ID}`);
igual("o mapa do banco dá o endereço novo", destinoNovo("pt", { tipo: "comunidade", novo: "matematica" }), "/pt/alumia/c/matematica");
// O que o proxy faz com /comunidade?post=: caminho novo → pedido antigo → destino final. Um salto (o 308 nem acontece).
{
  const novo = caminhoNovoDaAlumia("/comunidade");
  const destino = destinoDireto(pedidoAntigo(novo, `?post=${ID}`));
  igual("/comunidade?post=<id> chega ao post em um salto", destino, `/pt/alumia/p/${ID}`);
}
igual("?t= estranho não é pedido antigo", pedidoAntigo("/pt/alumia", "?t=../../x"), null);

// ═══════════════════ 3. O proxy de verdade: proxy() com NextRequest, status, Location e saltos ═══════════════════
{
  // O proxy.ts importa "next/server" sem extensão (o Next resolve); aqui o Node precisa de "next/server.js".
  const { register } = await import("node:module");
  register("data:text/javascript," + encodeURIComponent(`
export async function resolve(e, c, proximo) { return proximo(e === "next/server" ? "next/server.js" : e, c); }`));
  // Sem banco (a interdição abre o site) e fora da Vercel: o teste não sai da máquina.
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.VERCEL_ENV;
  const { proxy } = await import("../proxy.ts");
  const { NextRequest } = await import("next/server.js");
  const { definirVivos } = await import("../lib/recursos.ts");
  const { site } = await import("../lib/site.ts");
  const SITE = site.url; // http://localhost:3000 fora da produção
  const ALUMIA = SITE.replace("://", "://alumia.");
  const AP = "application/activity+json";
  const REDIR = [301, 307, 308];
  /** Um pedido ao proxy: status lógico (200 = passou ou reescreveu), Location absoluta e o destino da reescrita. */
  const pedir = async (url, aceita = "text/html") => {
    const r = await proxy(new NextRequest(url, { headers: { accept: aceita, host: new URL(url).host } }), { waitUntil() {} });
    if (!r) return { status: 200, url };
    const local = r.headers.get("location");
    const reescrita = r.headers.get("x-middleware-rewrite");
    return { status: r.status, url, local: local ? new URL(local, url).href : null, reescrita: reescrita ? new URL(reescrita).pathname : null };
  };
  /** Segue os redirecionamentos (no máximo 5) até um 200 lógico; devolve os saltos e o fim. Laço = não chega. */
  const seguir = async (url, aceita) => {
    const saltos = [];
    let r = await pedir(url, aceita);
    while (REDIR.includes(r.status) && saltos.length < 5) {
      saltos.push(`${r.status} ${r.local}`);
      r = await pedir(r.local, aceita);
    }
    return { saltos, fim: r };
  };
  const vivos = (ligados) => definirVivos({ ligados: new Set(ligados), desligados: new Set() });

  vivos([]);
  {
    const r = await pedir(`${SITE}/pt/comunidade?t=${ID}`);
    igual("site, rede-v2 desligada: /pt/comunidade?t= dá 308 para /pt/alumia?t= (a busca vai junto)", [r.status, r.local], [308, `${SITE}/pt/alumia?t=${ID}`]);
    const f = await seguir(`${SITE}/pt/comunidade?t=${ID}`);
    igual("e chega num 200 em um salto", [f.saltos.length, f.fim.status], [1, 200]);
  }
  igual("site: /comunidade (sem idioma) vai num salto a /pt/alumia", (await seguir(`${SITE}/comunidade/p/${ID}`)).saltos, [`308 ${SITE}/pt/alumia/p/${ID}`]);
  igual("site: /comunidades não é da Alumia (só o idioma entra)", (await pedir(`${SITE}/comunidades`)).local, `${SITE}/pt/comunidades`);
  igual("site: /pt/comunidades segue como está", (await pedir(`${SITE}/pt/comunidades`)).status, 200);
  {
    const r = await pedir(`${SITE}/pt/comunidade//evil.example/x`);
    ok(`site: /pt/comunidade//evil fica no próprio site (${r.local})`, r.status === 308 && new URL(r.local).host === new URL(SITE).host && new URL(r.local).pathname === "/pt/alumia/evil.example/x");
  }

  vivos(["rede-v2"]);
  igual("site, rede-v2 ligada: /pt/comunidade?post= vai DIRETO ao post (301, um salto)", (await seguir(`${SITE}/pt/comunidade?post=${ID}`)).saltos, [`301 ${SITE}/pt/alumia/p/${ID}`]);
  igual("site: /comunidade?post= também", (await seguir(`${SITE}/comunidade?post=${ID}`)).saltos, [`301 ${SITE}/pt/alumia/p/${ID}`]);
  igual("host da Alumia: /pt/comunidade?post= vai direto ao post, um salto só", (await seguir(`${ALUMIA}/pt/comunidade?post=${ID}`)).saltos, [`301 ${ALUMIA}/pt/alumia/p/${ID}`]);
  igual("host da Alumia: /pt/alumia?post= também (ainda no caminho completo)", (await seguir(`${ALUMIA}/pt/alumia?post=${ID}`)).saltos, [`301 ${ALUMIA}/pt/alumia/p/${ID}`]);
  {
    const f = await seguir(`${ALUMIA}/pt/comunidade?t=${ID}`);
    // Sem banco não há o par do tópico: vai para a raiz curta com a busca, e lá a página resolve no navegador.
    igual("host da Alumia: /pt/comunidade?t= sem banco vai num salto à raiz curta, com a busca", [f.saltos, f.fim.status, f.fim.reescrita], [[`308 ${ALUMIA}/?t=${ID}`], 200, "/pt/alumia"]);
  }
  vivos([]);

  {
    const f = await seguir(`${ALUMIA}/comunidade`);
    igual("host da Alumia: /comunidade vai à raiz curta / (e a raiz é a linha)", [f.saltos, f.fim.reescrita], [[`308 ${ALUMIA}/`], "/pt/alumia"]);
  }
  {
    const f = await seguir(`${ALUMIA}/en/comunidade/p/${ID}?x=1`);
    igual("host da Alumia: /en/comunidade/p/<id> vai a /en/p/<id> com a busca, e ali é o post", [f.saltos, f.fim.reescrita], [[`308 ${ALUMIA}/en/p/${ID}?x=1`], `/en/alumia/p/${ID}`]);
  }
  {
    const r = await pedir(`${ALUMIA}/pt/comunidade/p/${ID}`, AP);
    igual("host da Alumia, ActivityPub no url antigo: o documento da federação, sem 308", [r.status, r.reescrita], [200, `/api/fediverso/p/${ID}`]);
    const u = await pedir(`${ALUMIA}/pt/comunidade/u/ana_1`, AP);
    igual("e o perfil antigo também", [u.status, u.reescrita], [200, "/api/fediverso/u/ana_1"]);
  }
  {
    const f = await seguir(`${ALUMIA}/pt/comunidade//evil`);
    ok(`host da Alumia: /pt/comunidade//evil fica no host e termina (${f.saltos.join(" → ")})`, f.saltos.length === 1 && new URL(f.saltos[0].split(" ")[1]).host === new URL(ALUMIA).host && f.fim.status === 200);
  }
  // Nenhum laço: todo caminho termina em até 2 saltos (o "site" leva ao domínio do instituto, que pode pôr o idioma).
  for (const c of ["/", "/p/" + ID, "/alumia", "/alumia/salvos", "/pt/alumia", "/pt/alumia/", "/comunidade", "/comunidade/", "/pt/comunidade/", "/en/comunidade/buscar",
    "/comunidades", "/pt/comunidades", "/painel", "/pt/painel", "/trilhas", "/entrar", "/@ana_1", "/atos", "/pt/comunidade/nao-existe"]) {
    const f = await seguir(`${ALUMIA}${c}`);
    ok(`host da Alumia: ${c} termina sem laço (${f.saltos.join(" → ") || "direto"})`, f.saltos.length <= 2 && f.fim.status === 200);
  }
  for (const c of ["/", "/comunidade", "/pt/comunidade", "/pt/comunidade/", "/alumia", "/pt/alumia", "/comunidades"]) {
    const f = await seguir(`${SITE}${c}`);
    ok(`site: ${c} termina sem laço (${f.saltos.join(" → ") || "direto"})`, f.saltos.length <= 2 && f.fim.status === 200);
  }
  ok("next.config.ts não tem redirecionamento de /comunidade (dois saltos)", !/source:\s*["'`][^"'`]*comunidade/.test(ler("next.config.ts")));
}

// ═══════════════════ 4. Host próprio (alumia.institutolucia.org) ═══════════════════
igual("/ é a linha em /pt/alumia", rotaNaAlumia("/"), { tipo: "reescrever", destino: "/pt/alumia" });
igual("/pt/comunidade/p/<id> no host da Alumia: 308 para o curto /p/<id>", rotaNaAlumia(`/pt/comunidade/p/${ID}`), { tipo: "mover", destino: `/p/${ID}`, completo: `/pt/alumia/p/${ID}` });
igual("/comunidade no host da Alumia: 308 para a raiz curta", rotaNaAlumia("/comunidade"), { tipo: "mover", destino: "/", completo: "/pt/alumia" });
igual("/en/comunidade no host da Alumia: 308 para /en", rotaNaAlumia("/en/comunidade"), { tipo: "mover", destino: "/en", completo: "/en/alumia" });
igual("/pt/comunidade//evil no host da Alumia fica em /pt/alumia/evil (não é tela: não vira caminho curto)", rotaNaAlumia("/pt/comunidade//evil"), { tipo: "mover", destino: "/pt/alumia/evil", completo: "/pt/alumia/evil" });
igual("ActivityPub no url antigo: o documento, sem 308", rotaNaAlumia(`/pt/comunidade/p/${ID}`, "application/activity+json"), { tipo: "reescrever", destino: `/api/fediverso/p/${ID}` });
igual("/pt/alumia/salvos segue", rotaNaAlumia("/pt/alumia/salvos"), { tipo: "seguir" });
igual("/@nome vira o perfil em /alumia", rotaNaAlumia("/@maria_luta"), { tipo: "reescrever", destino: "/pt/alumia/u/maria_luta" });
igual("ActivityPub continua no documento da federação", rotaNaAlumia(`/pt/alumia/p/${ID}`, "application/activity+json"), { tipo: "reescrever", destino: `/api/fediverso/p/${ID}` });
for (const r of ROTAS_NOVAS) {
  const nome = r.caminho.split("/")[1];
  ok(`a rota nova /${nome} é da Alumia no host próprio`, ROTAS_DA_ALUMIA.includes(nome));
}
igual("sem o endereço próprio, links em /[lang]/alumia", [enderecoDaAlumia("pt", "", ""), enderecoDaAlumia("en", "/p/1", "")], ["/pt/alumia", "/en/alumia/p/1"]);
igual("com o endereço próprio, os dois prefixos vão para lá", [caminhoDoSiteParaAlumia("/pt/alumia/p/1", "?x=1", "https://alumia.exemplo.org"), caminhoDoSiteParaAlumia("/pt/comunidade/p/1", "?x=1", "https://alumia.exemplo.org"), caminhoDoSiteParaAlumia("/pt/comunidades", "", "https://alumia.exemplo.org")], ["https://alumia.exemplo.org/p/1?x=1", "https://alumia.exemplo.org/p/1?x=1", null]);
igual("enderecos da v2 em /alumia", [enderecos.linha("pt"), enderecos.post("en", ID), enderecos.comunidade("pt", "x"), enderecos.perfil("pt", "ana")], ["/pt/alumia", `/en/alumia/p/${ID}`, "/pt/alumia/c/x", "/pt/alumia/u/ana"]);

// ═══════════════════ 5. Interdição e sitemap ═══════════════════
const comunidade = { geral: false, areas: ["comunidade"], mensagem: "" };
igual("interdição fecha /alumia", [fechado("/pt/alumia", comunidade), fechado("/en/alumia/atos", comunidade), fechado("/comunidade/p/x", comunidade)], ["comunidade", "comunidade", "comunidade"]);
igual("interdição: /alumiar e /comunidades não são da Alumia", [areaDoCaminho("/alumiar"), areaDoCaminho("/comunidades")], [null, null]);
ok("o sitemap anuncia /alumia e não /comunidade", /"\/alumia"/.test(ler("app/sitemap.ts")) && !/"\/comunidade"/.test(ler("app/sitemap.ts")));

// ═══════════════════ 6. Nenhum link velho no site ═══════════════════
{
  // Só estes arquivos podem citar o caminho antigo, cada um por um motivo:
  const PERMITIDOS = new Map([
    ["proxy.ts", "faz o 308 do caminho antigo"],
    ["lib/rede/rota-alumia.ts", "a regra do 308"],
    ["lib/rede/alumia.ts", "o host próprio lê o caminho antigo (308 e ActivityPub)"],
    ["lib/rede/antigos.ts", "os ?t=/?post= do Fórum pelo caminho antigo"],
    ["lib/interdicao.ts", "o caminho antigo fecha junto com a área"],
    ["scripts/testar-alumia-rota.mjs", "este teste"],
    ["scripts/testar-fediverso.mjs", "confere o 308 e o ActivityPub do caminho antigo no host próprio"],
    ["scripts/testar-interdicao.mjs", "confere que o caminho antigo também fecha"],
    ["scripts/testar-rede-moderacao.mjs", "a ponte de /denunciar aceita o link antigo de um post"],
    ["scripts/testar-banco.mjs", "denúncia com ?post= antigo e a linha do tempo dos tópicos do fórum (de propósito, ver a migração da F0)"],
  ]);
  const achados = [];
  const andar = (dir) => {
    if (!existe(dir)) return;
    for (const e of fs.readdirSync(path.join(raiz, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (e.name !== "node_modules" && !e.name.startsWith(".")) andar(rel);
      } else if (/\.(tsx?|mjs|js|json|md|html)$/.test(e.name) && !PERMITIDOS.has(rel)) {
        const texto = ler(rel);
        // "/comunidade" como caminho de rota (seguido de /, ?, aspas, crase, parêntese ou fim), fora de import de pasta.
        for (const m of texto.matchAll(/(?<!components)(?<!"\.)\/comunidade(?=[/?"'`)\s]|$)/gm)) achados.push(`${rel}@${m.index}`);
      }
    }
  };
  for (const d of ["app", "components", "lib", "i18n", "scripts", "e2e", "public", "content/paginas"]) andar(d);
  ok("proxy.ts é varrido de fora da lista só porque faz o 308", PERMITIDOS.has("proxy.ts"));
  // O banco: as migrações antigas são história (o install.sql é colado nelas); o que vale é a última definição de cada função.
  // As que gravavam /comunidade num link novo foram refeitas na F0; os links de tópico da linha do tempo ficam de propósito.
  {
    const f0 = ler("supabase/migracoes/20261109-alumia-f0-contrato.sql");
    for (const fn of ["interno.rede3_aviso_resumo(", "interno.rede3_aviso_resumo_semanal(", "interno.rede3_mod_ponte_denuncia("]) {
      ok(`a F0 refaz ${fn}) com o caminho novo`, f0.includes(`create or replace function ${fn}`));
    }
    ok("a F0 não grava /comunidade em link novo", !/'\/pt\/comunidade|'\/comunidade\?/.test(f0.replace(/--.*$/gm, "")));
    ok("a F0 explica por que '/comunidade?t=' da linha do tempo fica", /Ficam DE PROPÓSITO no caminho antigo: os links '\/comunidade\?t=<id>'/.test(f0));
  }
  igual("nenhum link para /comunidade fora dos arquivos de compatibilidade", achados, []);
  ok("a pasta da rota mudou (app/[lang]/alumia) e a antiga sumiu", existe("app/[lang]/alumia/page.tsx") && !existe("app/[lang]/comunidade"));
  ok("o layout usa LayoutProps<\"/[lang]/alumia\">", /LayoutProps<"\/\[lang\]\/alumia">/.test(ler("app/[lang]/alumia/layout.tsx")));
}

// ═══════════════════ 7. Flags: só pelo nome, desligadas, e o visual novo só com as duas ═══════════════════
const FLAGS = ["alumia-2", "alumia-stories", "alumia-modo-ato", "alumia-org", "alumia-chat-grupo"];
for (const f of FLAGS) {
  ok(`a flag ${f} existe`, f in RECURSOS);
  ok(`a flag ${f} é só pelo nome`, SO_PELO_NOME.includes(f));
  igual(`"todos" não liga ${f}`, ligado(f, lerRecursos("todos")), false);
  igual(`o nome liga ${f}`, ligado(f, lerRecursos(`todos,${f}`)), true);
}
ok("sem a variável de montagem, a Alumia nova está desligada", !process.env.NEXT_PUBLIC_RECURSOS?.includes("alumia-2") ? alumia2Ligada() === false : true);
ok("rota nova desligada por padrão", ROTAS_NOVAS.every((r) => (process.env.NEXT_PUBLIC_RECURSOS ?? "").includes(r.flag) || rotaNovaLigada(r.nome) === false));
{
  const layout = ler("app/[lang]/alumia/layout.tsx");
  ok("desligada, o layout devolve a moldura de antes, sem data-al", /if \(!alumia2Ligada\(\)\) return moldura;/.test(layout));
  ok("ligada, tudo dentro de data-al=\"2\" com as fontes", /data-al="2" className=\{`\$\{archivo\.variable\} \$\{garamond\.variable\}`\}/.test(layout));
  ok("Archivo com o eixo de largura e EB Garamond itálica, por next/font/google, só no layout da Alumia", /Archivo\(\{[^}]*axes: \["wdth"\]/.test(layout) && /EB_Garamond\(\{[^}]*style: \["italic"\]/.test(layout));
  ok("os tokens são importados só pelo layout da Alumia", /import "@\/styles\/alumia-tokens\.css"/.test(layout));
  const tokens = ler("styles/alumia-tokens.css");
  const fora = tokens.split("\n").filter((l) => /^[^\s/*@}][^{]*\{\s*$/.test(l) && !l.includes('[data-al="2"]'));
  igual("todo seletor dos tokens está dentro de [data-al=\"2\"] (desligado, nada muda)", fora, []);
  for (const cor of ["#0f0e0d", "#1b1917", "#2a2622", "#f3efe6", "#e8321f", "#ffc21a"]) ok(`token com a cor das pranchas ${cor}`, tokens.toLowerCase().includes(cor));
  const faixa = ["#c21f16 0 16.667%", "#f0b323 16.667% 23.333%", "#23408e 23.333% 33.333%", "#f3efe6 33.333% 36.667%", "#2e6b4f 36.667% 50%", "#e4577f 50% 56.667%", "#ea7a24 56.667% 66.667%", "#0f0e0d 66.667% 70%", "#1f8a85 70% 80%", "#f0b323 80% 86.667%", "#c21f16 86.667% 100%"];
  ok("a faixa tecida tem as 11 listras nas proporções 5-2-3-1-4-2-3-1-3-2-4", faixa.every((l) => tokens.includes(l)));
  ok("foco visível dourado de 2 px", /outline: 2px solid var\(--al-foco\)/.test(tokens));
  ok("variantes de e-ink e alto contraste", tokens.includes(':root[data-eink] [data-al="2"]') && tokens.includes(':root[data-contrast] [data-al="2"]'));
  ok("no e-ink o botão e o selo não somem (vermelho vira preto, texto branco)", /:root\[data-eink\][^{]*\{[^}]*--al-vermelho: #000000;[^}]*--al-sobre-vermelho: #ffffff;/s.test(tokens));
}

// ═══════════════════ 8. As 12 rotas novas ═══════════════════
igual("são 12 rotas novas", ROTAS_NOVAS.length, 12);
{
  const registro = ler("components/rede/registro.tsx");
  const idiomas = ["pt", "en", "es", "fr", "ru", "zh"];
  const textos = Object.fromEntries(idiomas.map((l) => [l, JSON.parse(ler(`i18n/rede/onda5/${l}.json`))]));
  for (const r of ROTAS_NOVAS) {
    const pagina = `app/[lang]/alumia${r.caminho}/page.tsx`;
    ok(`a página de ${r.caminho} existe`, existe(pagina));
    const fonte = existe(pagina) ? ler(pagina) : "";
    ok(`${r.caminho} passa pela PaginaNova ou tem tela própria com a mesma trava (404 com a flag desligada)`, fonte.includes("metadadosDaRotaNova") && (fonte.includes(`nome="${r.nome}"`) || fonte.includes(`if (!rotaNovaLigada("${r.nome}")) notFound();`)));
    const linha = new RegExp(`"?${r.nome}"?: \\{ componente: dynamic\\(\\(\\) => import\\("\\./([^"]+)"\\), \\{ ssr: false \\}\\)`).exec(registro);
    ok(`${r.nome} está no registro com import dinâmico`, !!linha);
    if (linha) ok(`o arquivo da tela de ${r.nome} existe (components/rede/${linha[1]}.tsx)`, existe(`components/rede/${linha[1]}.tsx`));
    for (const l of idiomas) ok(`texto de ${r.nome} em ${l}`, !!textos[l].telas[r.nome]?.titulo && !!textos[l].telas[r.nome]?.descricao);
    ok(`a flag de ${r.nome} é da Onda 5`, FLAGS.includes(r.flag));
  }
  for (const l of idiomas) igual(`as chaves de ${l} batem com o português`, Object.keys(textos[l].emConstrucao).sort(), Object.keys(textos.pt.emConstrucao).sort());
  const pn = ler("components/rede/onda5/PaginaNova.tsx");
  ok("PaginaNova: notFound com a flag desligada", /if \(!rotaNovaLigada\(nome\)\) notFound\(\);/.test(pn));
  ok("metadados: nada com a flag desligada e sem trecho de conteúdo", /if \(!rotaNovaLigada\(nome\)\) return \{\};/.test(pn));
  ok("o ato confere o id antes", /if \(!idOk\(id\)\) notFound\(\);/.test(ler("app/[lang]/alumia/ato/[id]/page.tsx")));
}

// ═══════════════════ 9. Encaixes e esboços ═══════════════════
{
  const encaixes = ler("components/rede/encaixes.tsx");
  for (const pasta of ["atos", "conversa", "org", "stories", "seguranca", "chat", "protecao", "alcance", "publicar"]) {
    ok(`o encaixes.tsx importa ./${pasta}/encaixe`, encaixes.includes(`from "./${pasta}/encaixe"`));
    ok(`o esboço components/rede/${pasta}/encaixe.tsx existe e exporta "encaixe"`, existe(`components/rede/${pasta}/encaixe.tsx`) && /export const encaixe: Encaixe = /.test(ler(`components/rede/${pasta}/encaixe.tsx`)));
  }
  for (const tipo of ["menu", "acoesDoCartao", "anexosDoCartao", "tiposDoCompositor", "antesDePublicar", "abasDoPerfil", "abasDaComunidade", "abasDoNucleo", "colunaDireita", "secoesDeAjustes", "aoSairRapido"]) {
    ok(`o encaixe tem o tipo ${tipo}`, new RegExp(`\\b${tipo}\\?:`).test(encaixes));
  }
  const casca = ler("components/rede/Casca.tsx");
  ok("a casca usa o Sair rápido de lib/rede/saida.ts com os encaixes", /sairRapidoDaRede\(DESTINO_DA_SAIDA, ENCAIXES\.aoSairRapido\)/.test(casca));
  ok("a casca lê o menu dos encaixes", /ENCAIXES\.menu/.test(casca));
  // O "substitui" vale nos dois lugares: o menu do computador e a barra do celular passam pela mesma hrefDoItem.
  ok("menu do computador e barra do celular usam o mesmo destino (com o substitui)", (casca.match(/const href = hrefDoItem\(d, lang, s, situacao\);/g) ?? []).length === 2
    && /function ItemDaBarra[\s\S]*hrefDoItem\(d, lang, s, situacao\)/.test(casca));
  ok("os itens encaixados marcam aria-current", /const atual = encaixeAtivo\(href, caminho\);[\s\S]{0,200}aria-current=\{atual \? "page" : undefined\}/.test(casca));
  igual("encaixeAtivo: tela aberta, tela dentro, outra tela, a linha, host próprio", [
    encaixeAtivo("/pt/alumia/atos", "/pt/alumia/atos"),
    encaixeAtivo("/pt/alumia/atos", "/pt/alumia/atos/abc"),
    encaixeAtivo("/pt/alumia/atos", "/pt/alumia/atosx"),
    encaixeAtivo("/pt/alumia", "/pt/alumia/atos"),
    encaixeAtivo("/pt/alumia", "/pt/alumia"),
    encaixeAtivo("https://alumia.exemplo.org/atos", "/atos"),
    encaixeAtivo("https://alumia.exemplo.org/en/atos", "/en/alumia/atos?x=1"),
  ], [true, true, false, false, true, true, true]);
}

// ═══════════════════ 10. Sair rápido ═══════════════════
{
  const falso = (chaves) => {
    const m = new Map(chaves.map((k) => [k, "1"]));
    return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, removeItem: (k) => m.delete(k), m };
  };
  const a = falso([`${PREFIXO_DA_REDE}:rascunho`, `${PREFIXO_DA_REDE}-chat`, "lucia:outra", "tema"]);
  const b = falso([`${PREFIXO_DA_REDE}:x`]);
  igual("apaga só as chaves da Alumia, dos dois armazenamentos", [apagarChavesDaRede([a, b, null]), [...a.m.keys()], [...b.m.keys()]], [3, ["lucia:outra", "tema"], []]);
  const quebrado = { get length() { throw new Error("bloqueado"); }, key: () => null, removeItem: () => undefined };
  igual("armazenamento bloqueado não derruba a saída", apagarChavesDaRede([quebrado]), 0);
  await espera("as limpezas dos encaixes rodam e um erro não para as outras", async () => {
    const feitas = [];
    await rodarLimpezas([() => { feitas.push(1); }, () => { throw new Error("x"); }, async () => { feitas.push(3); }]);
    return feitas;
  }, (f) => f.join() === "1,3");
  await espera("uma limpeza lenta não segura a saída (teto de tempo)", async () => {
    const t0 = Date.now();
    await rodarLimpezas([() => new Promise((r) => setTimeout(r, 5000))], 100);
    return Date.now() - t0;
  }, (ms) => ms < 1000);
}

// ═══════════════════ 11. Conta extra: nada do dono em auth.users ═══════════════════
{
  const DONO = "11111111-2222-4333-8444-555555555555";
  const corpo = corpoDoUsuario("Coletivo Lume", "x@contas.alumia.invalid");
  igual("o corpo do usuário só tem e-mail, confirmação e codinome", corpo, { email: "x@contas.alumia.invalid", email_confirm: true, user_metadata: { apelido: "Coletivo Lume" } });
  ok("sem senha no corpo", !("password" in corpo));
  ok("e-mail aleatório no domínio .invalid, diferente a cada vez", /^[0-9a-f]{32}@contas\.alumia\.invalid$/.test(emailAleatorio()) && emailAleatorio() !== emailAleatorio());
  igual("codinome: recusa e-mail, telefone e vazio", [codinomeOk("Coletivo Lume"), codinomeOk("a@b"), codinomeOk("(11) 98765-4321"), codinomeOk(" ")], [true, false, false, false]);
  const chamadas = [];
  const fetchFalso = (falharLigacao, corpoDoErro = "{}") => async (url, init) => {
    chamadas.push({ url, metodo: init.method, corpo: init.body ? JSON.parse(init.body) : null });
    if (url.endsWith("/auth/v1/admin/users")) return new Response(JSON.stringify({ id: "99999999-8888-4777-8666-555555555555" }), { status: 200 });
    if (url.includes("/rpc/rede_identidade_ligar")) return new Response(falharLigacao ? corpoDoErro : JSON.stringify({ ok: true }), { status: falharLigacao ? 400 : 200 });
    return new Response("{}", { status: 200 });
  };
  await espera("cria e liga a conta; o dono só vai para a função do banco, nunca para auth.users", async () => {
    chamadas.length = 0;
    const r = await criarContaExtra({ dono: DONO, tipo: "org", codinome: "Coletivo Lume" }, { url: "https://banco.exemplo", chave: "k", buscar: fetchFalso(false) });
    const criar = chamadas.find((c) => c.url.endsWith("/auth/v1/admin/users"));
    return { r, semDono: !JSON.stringify(criar.corpo).includes(DONO) && !JSON.stringify(criar.corpo).includes("org"), ligar: chamadas.find((c) => c.url.includes("rede_identidade_ligar"))?.corpo };
  }, (v) => v.r.ok && v.semDono && v.ligar.p_dono === DONO && v.ligar.p_tipo === "org");
  await espera("se a ligação falha, a conta criada é apagada", async () => {
    chamadas.length = 0;
    const r = await criarContaExtra({ dono: DONO, tipo: "identidade", codinome: "Outra Voz" }, { url: "https://banco.exemplo", chave: "k", buscar: fetchFalso(true) });
    return { r, apagou: chamadas.some((c) => c.metodo === "DELETE" && c.url.endsWith("/auth/v1/admin/users/99999999-8888-4777-8666-555555555555")) };
  }, (v) => v.r.ok === false && v.r.erro === "falha" && v.apagou);
  await espera("no teto de 5, o erro é limite_identidades (traduzido) e a conta criada é apagada", async () => {
    chamadas.length = 0;
    const r = await criarContaExtra({ dono: DONO, tipo: "org", codinome: "Sexta Org" }, { url: "https://banco.exemplo", chave: "k", buscar: fetchFalso(true, JSON.stringify({ code: "P0001", message: "limite_identidades" })) });
    return { r, apagou: chamadas.some((c) => c.metodo === "DELETE") };
  }, (v) => v.r.ok === false && v.r.erro === "limite_identidades" && v.apagou);
  ok("limite_identidades é erro da Rede e tem texto nos 6 idiomas", ERROS_DA_REDE.includes("limite_identidades")
    && ["pt", "en", "es", "fr", "ru", "zh"].every((l) => typeof JSON.parse(ler(`i18n/rede/${l}.json`)).erros?.limite_identidades === "string"));
  await espera("sem chave de serviço, nem tenta", () => criarContaExtra({ dono: DONO, tipo: "org", codinome: "X Y" }, null), (r) => r.ok === false && r.erro === "sem_servico");
  ok("a chave de serviço nunca é NEXT_PUBLIC_", /process\.env\.SUPABASE_SERVICE_ROLE_KEY/.test(ler("lib/rede/contas-extra.ts")) && !/NEXT_PUBLIC_SUPABASE_SERVICE/.test(ler("lib/rede/contas-extra.ts")));
}

// ═══════════════════ 12. A migração da F0 num Postgres de verdade (duas vezes) ═══════════════════
{
  const { criarBanco } = await import("./banco-local.mjs");
  const banco = await criarBanco();
  const { dono, criarUsuario, rpc } = banco;
  const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
  const migracao = ler("supabase/migracoes/20261109-alumia-f0-contrato.sql");
  ok("a migração está colada no fim do install.sql (o integrador colou)", ler("supabase/install.sql").includes("Alumia · Onda 5 · F0"));
  await espera("a migração instala sobre o install.sql", () => banco.exclusivo(() => banco.pg.exec(migracao)));
  await espera("e instala de novo sem estrago (idempotente)", () => banco.exclusivo(() => banco.pg.exec(migracao)));
  await espera("as colunas novas de rede_posts existem", async () => (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_posts' and column_name in ('expira_em', 'ato', 'como') order by 1")).rows.map((r) => r.column_name), (c) => c.join() === "ato,como,expira_em");
  await espera("rede_alumia_versao() = 1, para visitante também", () => rpc({ papel: "anon" }, "rede_alumia_versao"), (v) => v === 1);

  let ip = 10;
  const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++}` });
  const a = await criarUsuario("a@f0.local", "a");
  const b = await criarUsuario("b@f0.local", "b");
  const c = await criarUsuario("c@f0.local", "c");
  for (const p of [a, b, c]) await rpc(como(p), "eu");

  await recusa("como ≠ autor é recusado (o dono nunca fica gravado no post)", () => dono("insert into interno.rede_posts (autor, texto, como) values ($1, 'x', $2)", [a, b]), "rede_posts_como_autor");
  await espera("como = autor passa", () => dono("insert into interno.rede_posts (autor, texto, como) values ($1, 'x', $1)", [a]));
  await espera("os alvos novos de denúncia entram", () => dono("insert into interno.rede_denuncias (alvo_tipo, alvo, categoria) values ('story', 'x', 'spam'), ('peticao', 'y', 'spam')"));
  await recusa("alvo inventado continua recusado", () => dono("insert into interno.rede_denuncias (alvo_tipo, alvo, categoria) values ('qualquer', 'x', 'spam')"), "rede_denuncias_alvo_tipo_v5");
  await espera("os tipos novos de aviso entram, e os de antes continuam", () => dono("insert into interno.rede_avisos_prefs (usuario, tipo, canal, ligado) values ($1, 'ato_mudou', 'site', true), ($1, 'resumo', 'email', false)", [a]));
  await espera("o registro de moderação aceita os alvos novos", () => dono("insert into interno.rede_moderacao (acao, alvo_tipo, alvo, motivo) values ('reter', 'story', 'x', 'teste da F0')"));

  await recusa("visitante não liga identidade", () => rpc({ papel: "anon" }, "rede_identidade_ligar", { p_dono: a, p_identidade: b, p_tipo: "org" }), "permission denied");
  await recusa("quem tem conta também não (só a chave de serviço)", () => rpc(como(a), "rede_identidade_ligar", { p_dono: a, p_identidade: b, p_tipo: "org" }), "permission denied");
  await espera("a chave de serviço liga a organização ao dono", () => rpc({ papel: "service_role" }, "rede_identidade_ligar", { p_dono: a, p_identidade: b, p_tipo: "org" }), (r) => r.ok === true);
  await recusa("uma identidade não tem dois donos", () => rpc({ papel: "service_role" }, "rede_identidade_ligar", { p_dono: c, p_identidade: b, p_tipo: "org" }), "invalido:identidade");
  await recusa("sem cadeia: quem é identidade não vira dono", () => rpc({ papel: "service_role" }, "rede_identidade_ligar", { p_dono: b, p_identidade: c, p_tipo: "identidade" }), "invalido:dono");
  await espera("no teto de 5 organizações por dono, o erro é limite_identidades (não é limite diário)", async () => {
    const extras = [];
    for (let i = 0; i < 6; i++) extras.push(await criarUsuario(`org${i}@f0.local`, `org${i}`));
    for (const x of extras) await rpc(como(x), "eu");
    for (const x of extras.slice(0, 5)) await rpc({ papel: "service_role" }, "rede_identidade_ligar", { p_dono: c, p_identidade: x, p_tipo: "org" });
    try {
      await rpc({ papel: "service_role" }, "rede_identidade_ligar", { p_dono: c, p_identidade: extras[5], p_tipo: "org" });
      return "passou";
    } catch (e) {
      return String(e?.message ?? e);
    }
  }, (m) => m.includes("limite_identidades"));
  await espera("o laço da migração só derruba o check da lista: o check de canal das preferências continua", async () =>
    (await dono("select count(*)::int as n from pg_constraint where conrelid = 'interno.rede_avisos_prefs'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%canal%'")).rows[0].n, (n) => n === 1);
  await espera("rede_age_como: o dono age como a org; outro não; cada um como si mesmo", async () =>
    (await um("select interno.rede_age_como($1, $2) as a, interno.rede_age_como($3, $2) as b, interno.rede_age_como($3, $3) as c, interno.rede_age_como($2, $1) as d", [a, b, c])), (r) => r.a === true && r.b === false && r.c === true && r.d === false);
  await espera("o vínculo guarda só a data, sem hora", async () => (await um("select data_type from information_schema.columns where table_schema = 'interno' and table_name = 'rede_identidades' and column_name = 'criada_em'")).data_type, (t) => t === "date");
  await recusa("ninguém de fora lê a tabela de identidades", () => banco.exclusivo(async () => {
    await banco.pg.exec("set role authenticated");
    try {
      return await banco.pg.query("select * from interno.rede_identidades");
    } finally {
      await banco.pg.exec("reset role");
    }
  }), "permission denied");
  await espera("as flags da Onda 5 entram no catálogo, só pelo nome", async () => (await dono("select nome from interno.recursos_catalogo where so_pelo_nome and nome like 'alumia-%' order by 1")).rows.map((r) => r.nome), (n) => n.join() === "alumia-2,alumia-chat-grupo,alumia-modo-ato,alumia-org,alumia-stories");
  await espera("o resumo semanal leva a /pt/alumia/avisos", async () => (await um("select pg_get_functiondef('interno.rede3_aviso_resumo(uuid)'::regprocedure) as f, pg_get_functiondef('interno.rede3_aviso_resumo_semanal()'::regprocedure) as g")), (r) => r.f.includes("/pt/alumia/avisos") && r.g.includes("/pt/alumia/avisos") && !r.f.includes("/comunidade/avisos"));
  await espera("a ponte da página /denunciar reconhece /alumia/p/ e /comunidade/p/", async () => (await um("select pg_get_functiondef('interno.rede3_mod_ponte_denuncia()'::regprocedure) as f")).f, (f) => f.includes("'/(comunidade|alumia)/p/'"));
  await banco.pg.close?.();
}

console.log(`Alumia (F0, rota e contrato): ${certos} certos, ${falhas.length} falhas.`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
