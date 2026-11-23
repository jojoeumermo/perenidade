// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 5, lote "leve" (E7, A17, A20). Sem rede e sem navegador:
//   · E7: o script das preferências (lib/prefs-script.ts), rodado num documento de mentira, liga o modo leve SOZINHO no instituto
//     com aparelho fraco (navigator.deviceMemory ≤ 2) ou economia de dados, nunca na Alumia, e respeita a escolha guardada;
//     lib/prefs.ts decide igual; o CSS do aparelho fraco está no layout; no instituto nenhuma animação mexe em tamanho, posição ou
//     sombra, e nada usa vidro fosco (fora as exceções escritas abaixo);
//   · A17: o interruptor otimista (acender, seguir) muda no toque, manda um pedido por vez com o estado querido (repetir não
//     duplica), o último toque vale e o erro volta ao que o banco disse; os posts a caminho aparecem uma vez por chave de envio e
//     o confirmado entra uma vez por id; o pré-carregar não roda em economia de dados; as peças usam tudo isso.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-p5-leve.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { prefsScript, naAlumiaJs } from "../lib/prefs-script.ts";
import {
  anunciarPostACaminho,
  assinarPostsACaminho,
  cabeNaLinha,
  confirmarPost,
  criarInterruptor,
  esquecerPostsACaminho,
  juntarConfirmados,
  postsACaminho,
  postsConfirmados,
  retirarPostACaminho,
} from "../lib/rede/otimista.ts";
import { economizandoDados, precarregarTela } from "../lib/rede/precarregar.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** O texto do arquivo (vazio se ele não existe: a conferência que depende dele falha, em vez de o roteiro parar). */
const ler = (c) => {
  try {
    return fs.readFileSync(path.join(raiz, c), "utf8").replace(/\r\n/g, "\n");
  } catch {
    return "";
  }
};

let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

// ───────────── E7: o script inline ─────────────

/** Roda o prefsScript num documento de mentira e devolve os atributos que ele pôs em <html>. */
function rodarScript({ host = "institutolucia.org", caminho = "/pt", memoria, saveData = false, guardado = null, reduzirDados = false } = {}) {
  const atributos = new Map();
  const html = { setAttribute: (k, v) => atributos.set(k, v), removeAttribute: (k) => atributos.delete(k), hasAttribute: (k) => atributos.has(k), style: {} };
  const navegador = { userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/131.0 Mobile", connection: { saveData } };
  if (memoria !== undefined) navegador.deviceMemory = memoria;
  const contexto = {
    document: { documentElement: html, querySelector: () => null, addEventListener: () => undefined },
    navigator: navegador,
    location: { hostname: host, pathname: caminho, href: `https://${host}${caminho}` },
    localStorage: { getItem: (k) => (k === "lucia:acessibilidade" && guardado ? JSON.stringify(guardado) : null) },
    matchMedia: (q) => ({ matches: q.includes("prefers-reduced-data") ? reduzirDados : false }),
    JSON,
  };
  contexto.window = contexto;
  vm.runInNewContext(prefsScript, contexto);
  return atributos;
}

const leve = (o) => rodarScript(o).has("data-light");
ok("instituto, 2 GB: leve liga sozinho", leve({ memoria: 2 }));
ok("instituto, 1 GB: leve liga sozinho", leve({ memoria: 1 }));
ok("instituto, 0,5 GB: leve liga sozinho", leve({ memoria: 0.5 }));
ok("instituto, 4 GB: leve não liga", !leve({ memoria: 4 }));
ok("instituto, 8 GB: leve não liga", !leve({ memoria: 8 }));
ok("navegador que não diz a memória: leve não liga", !leve({}));
ok("instituto, economia de dados: leve liga", leve({ saveData: true, memoria: 8 }));
ok("instituto, prefers-reduced-data: leve liga", leve({ reduzirDados: true }));
ok("Escola, 2 GB: leve liga", leve({ caminho: "/pt/escola/formacao", memoria: 2 }));
ok("painel, 2 GB: leve liga", leve({ caminho: "/pt/painel", memoria: 2 }));
ok("Alumia (/pt/alumia), 1 GB: leve NÃO liga sozinho", !leve({ caminho: "/pt/alumia", memoria: 1 }));
ok("Alumia (/en/alumia/u/x), economia de dados: leve NÃO liga sozinho", !leve({ caminho: "/en/alumia/u/x", saveData: true }));
ok("Alumia no endereço próprio, 1 GB: leve NÃO liga sozinho", !leve({ host: "alumia.institutolucia.org", caminho: "/", memoria: 1 }));
ok("Alumia: marca data-na-alumia", rodarScript({ caminho: "/pt/alumia" }).has("data-na-alumia"));
ok("instituto: sem data-na-alumia", !rodarScript({ caminho: "/pt/alumiar" }).has("data-na-alumia") && !rodarScript({}).has("data-na-alumia"));
ok("Alumia: o leve escolhido pela pessoa vale", leve({ caminho: "/pt/alumia", guardado: { light: true } }));
ok("instituto: quem desligou o leve, fica desligado (1 GB)", !leve({ memoria: 1, guardado: { light: false } }));
ok("instituto: quem desligou o leve, fica desligado (economia)", !leve({ saveData: true, guardado: { light: false } }));

// lib/prefs.ts decide igual ao script (mesma conta do aparelho fraco e da Alumia).
const prefs = ler("lib/prefs.ts");
ok("prefs.ts: aparelhoFraco lê deviceMemory ≤ 2", /deviceMemory[\s\S]{0,200}memoria > 0 && memoria <= 2/.test(prefs));
ok("prefs.ts: naAlumia com a mesma conta do script", prefs.includes('window.location.hostname.indexOf("alumia.") === 0 || window.location.pathname.split("/")[2] === "alumia"') && naAlumiaJs.includes('location.hostname.indexOf("alumia.")===0||location.pathname.split("/")[2]==="alumia"'));
ok("prefs.ts: o leve sozinho não vale na Alumia", /export function leveSozinho[\s\S]{0,200}guardado\.light === undefined && !naAlumia\(\) && pedeEconomia\(\)/.test(prefs));
ok("prefs.ts: comEconomia usa leveSozinho", prefs.includes("light: guardado.light ?? leveSozinho(guardado)"));
ok("prefs.ts: applyPrefs marca a área", prefs.includes('root.setAttribute("data-na-alumia", "")'));

// O CSS do aparelho fraco e a peça que decide de novo a cada troca de endereço.
const layout = ler("app/[lang]/layout.tsx");
ok("layout importa o CSS do aparelho fraco", layout.includes('import "@/styles/leve-do-aparelho.css";'));
ok("layout tem a LeveDoAparelho", layout.includes("<LeveDoAparelho />"));
const css = ler("styles/leve-do-aparelho.css");
ok("CSS: menos movimento para tudo fora da Alumia", /@media \(prefers-reduced-motion: reduce\)\s*\{\s*:root:not\(\[data-na-alumia\]\) \*/.test(css) && css.includes("animation-duration: 0.01ms !important"));
ok("CSS: modo leve sem vidro fosco e sem sombra, foco à vista", css.includes("backdrop-filter: none !important") && css.includes("box-shadow: none !important") && css.includes(":not(:focus, :focus-visible)"));
ok("CSS: letras da Escola e do Vale o Escrito do aparelho no modo leve", css.includes(":root[data-light] [data-escola]") && css.includes("--font-escola-texto: system-ui") && css.includes(":root[data-light] .ve {"));

// Nenhuma animação do instituto mexe em tamanho, posição ou sombra (Alumia fica de fora: components/rede e styles/alumia*).
const PROIBIDAS = /^(width|height|min-width|min-height|max-width|max-height|top|left|right|bottom|margin.*|padding.*|box-shadow|inset|font-size|border-width)$/;
const animacoesRuins = [];
const vidros = [];
function varrer(dir) {
  for (const f of fs.readdirSync(path.join(raiz, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, f.name);
    if (f.isDirectory()) {
      if (["node_modules", ".next", "rede", "labs"].includes(f.name)) continue;
      varrer(rel);
      continue;
    }
    if (/^styles\/alumia/.test(rel)) continue;
    if (/\.css$/.test(f.name)) {
      const s = ler(rel);
      for (const m of s.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
        let i = m.index + m[0].length;
        let fundo = 1;
        const comeco = i;
        while (fundo && i < s.length) {
          if (s[i] === "{") fundo++;
          else if (s[i] === "}") fundo--;
          i++;
        }
        const ruins = [...new Set([...s.slice(comeco, i).matchAll(/([a-z-]+)\s*:/g)].map((x) => x[1]))].filter((p) => PROIBIDAS.test(p));
        if (ruins.length) animacoesRuins.push(`${rel} ${m[1]} (${ruins.join(", ")})`);
      }
      // Vidro fosco: só o "none" (que desliga) passa. painel-tema.css fica para o redesign do painel (E2).
      if (rel !== "styles/painel-tema.css") for (const m of s.matchAll(/backdrop-filter:\s*([^;]+);/g)) if (!/^none/.test(m[1].trim())) vidros.push(`${rel}: ${m[1].trim()}`);
    }
    if (/\.tsx$/.test(f.name)) {
      const s = ler(rel);
      if (/\bbackdrop-blur\b/.test(s)) vidros.push(`${rel}: backdrop-blur`);
    }
  }
}
for (const d of ["app", "styles", "components"]) varrer(d);
ok("instituto: nenhuma animação de tamanho, posição ou sombra", animacoesRuins.length === 0, animacoesRuins.join("; "));
ok("instituto: nada de vidro fosco", vidros.length === 0, vidros.join("; "));

// ───────────── A17: o interruptor otimista ─────────────

/** Um banco de mentira: cada pedido fica esperando até o teste responder. */
function bancoDeMentira() {
  const pedidos = [];
  let estado = false;
  return {
    pedidos,
    enviar: (querido) =>
      new Promise((ok, falha) => {
        pedidos.push({ querido, responder: () => ((estado = querido), ok({ estado })), falhar: () => falha(new Error("sem_conexao")) });
      }),
    estado: () => estado,
  };
}
const esperar = () => new Promise((r) => setTimeout(r, 0));

{
  const b = bancoDeMentira();
  const telas = [];
  let erros = 0;
  const i = criarInterruptor(false, { enviar: b.enviar, confirmado: (r) => r.estado, mostrar: (x) => telas.push(x), aoFalhar: () => erros++ });
  i.querer(true);
  ok("toque: a tela muda na hora", telas.at(-1) === true && i.atual() === true);
  ok("toque: um pedido, com o estado querido", b.pedidos.length === 1 && b.pedidos[0].querido === true);
  i.querer(false);
  i.querer(true);
  i.querer(false);
  ok("toques rápidos: continua UM pedido no caminho", b.pedidos.length === 1);
  ok("toques rápidos: a tela mostra o último toque", telas.at(-1) === false);
  b.pedidos[0].responder();
  await esperar();
  ok("depois da resposta: sai o pedido do último toque", b.pedidos.length === 2 && b.pedidos[1].querido === false);
  b.pedidos[1].responder();
  await esperar();
  ok("no fim: banco e tela iguais ao último toque", b.estado() === false && telas.at(-1) === false && !i.ocupado() && erros === 0);
  i.querer(false);
  ok("querer o que já está: nenhum pedido", b.pedidos.length === 2);
}
{
  const b = bancoDeMentira();
  const telas = [];
  let erros = 0;
  const i = criarInterruptor(false, { enviar: b.enviar, confirmado: (r) => r.estado, mostrar: (x) => telas.push(x), aoFalhar: () => erros++ });
  i.querer(true);
  b.pedidos[0].falhar();
  await esperar();
  ok("erro: volta ao que o banco disse e avisa", telas.at(-1) === false && i.atual() === false && erros === 1 && !i.ocupado());
  i.querer(true);
  ok("depois do erro: o toque seguinte manda de novo", b.pedidos.length === 2 && b.pedidos[1].querido === true);
}
{
  // Perfil trancado: o banco responde "pendente" (o estado ligado é "sigo ou pendente"); o que ele disse vale.
  const pedidos = [];
  const respostas = [];
  const i = criarInterruptor(false, {
    enviar: (q) => new Promise((r) => pedidos.push(() => r({ sigo: false, pendente: q }))),
    confirmado: (r) => r.sigo || r.pendente,
    mostrar: () => undefined,
    aoConfirmar: (r) => respostas.push(r),
  });
  i.querer(true);
  pedidos[0]();
  await esperar();
  ok("seguir perfil trancado: confirma como pedido enviado", respostas.length === 1 && respostas[0].pendente === true && i.atual() === true && pedidos.length === 1);
}
{
  // Repetir o mesmo pedido não duplica: o banco grava o estado (insert … on conflict do nothing / delete), nunca "inverta".
  const reagir = ler("supabase/install.sql").match(/create or replace function public\.rede_reagir\(p_post uuid, p_tipo text, p_sim boolean\)[\s\S]*?end \$\$;/g)?.at(-1) ?? "";
  ok("rede_reagir grava o estado (on conflict do nothing)", reagir.includes("on conflict do nothing") && reagir.includes("if coalesce(p_sim, false) then"));
  const seguir = ler("supabase/install.sql").match(/create or replace function public\.rede_perfil_seguir\(p_handle text, p_sim boolean default true\)[\s\S]*?end \$\$;/g)?.at(-1) ?? "";
  ok("rede_perfil_seguir grava o estado e avisa só na primeira vez", seguir.includes("on conflict do nothing") && seguir.includes("if v_linhas > 0 and v_pendente then"));
}

// ───────────── A17: os posts a caminho ─────────────

{
  esquecerPostsACaminho();
  let avisos = 0;
  const parar = assinarPostsACaminho(() => avisos++);
  anunciarPostACaminho({ chave: "c1", texto: "Ocupar e resistir", imagens: 0, comunidade: null });
  anunciarPostACaminho({ chave: "c1", texto: "Ocupar e resistir!", imagens: 1, comunidade: null });
  ok("mesma chave anunciada duas vezes: UM post a caminho", postsACaminho().length === 1 && postsACaminho()[0].texto === "Ocupar e resistir!" && avisos === 2);
  anunciarPostACaminho({ chave: "c2", texto: "Outro", imagens: 0, comunidade: "passe-livre-sp" });
  ok("chaves diferentes: dois, o mais novo no alto", postsACaminho().length === 2 && postsACaminho()[0].chave === "c2");
  retirarPostACaminho("c1");
  retirarPostACaminho("c1");
  ok("retirar: sai uma vez", postsACaminho().length === 1 && postsACaminho()[0].chave === "c2");
  const antes = Date.now() - 1000;
  confirmarPost({ id: "p1", comunidade: null });
  confirmarPost({ id: "p1", comunidade: null });
  confirmarPost({ id: "p2", comunidade: "passe-livre-sp" });
  ok("confirmado duas vezes: entra uma vez", postsConfirmados().filter((x) => x.id === "p1").length === 1);
  const lista = [{ id: "velho" }];
  const juntos = juntarConfirmados("seguindo", lista, antes);
  ok("linha do Início: os confirmados no alto, sem repetir", juntos.map((p) => p.id).join() === "p2,p1,velho");
  ok("post já na lista: não entra de novo", juntarConfirmados("seguindo", [{ id: "p1" }, { id: "p2" }], antes).length === 2);
  ok("lista pedida depois da confirmação: nada a juntar (o banco já mandou, ou foi apagado)", juntarConfirmados("seguindo", lista, Date.now() + 1000) === lista);
  ok("linha da comunidade: só os dela", juntarConfirmados("c:passe-livre-sp", [], antes).map((p) => p.id).join() === "p2");
  ok("linha de um perfil: nenhum", juntarConfirmados("u:faisca", [], antes).length === 0);
  ok("cabeNaLinha", cabeNaLinha("tudo", null) && cabeNaLinha("c:x", "x") && !cabeNaLinha("c:x", "y") && !cabeNaLinha("c:x", null) && !cabeNaLinha("u:x", null));
  for (let k = 0; k < 15; k++) confirmarPost({ id: `n${k}` });
  ok("a memória dos confirmados tem limite", postsConfirmados().length === 10);
  parar();
  esquecerPostsACaminho();
}

// ───────────── A17: pré-carregar ─────────────

{
  const atributos = new Set();
  globalThis.document = { documentElement: { hasAttribute: (k) => atributos.has(k) } };
  const conexao = {};
  Object.defineProperty(globalThis, "navigator", { value: { connection: conexao }, configurable: true, writable: true });
  const pedidos = [];
  const roteador = { prefetch: (h) => pedidos.push(h) };
  let pedacos = 0;
  ok("pré-carregar: abre na primeira intenção", precarregarTela(roteador, "/pt/alumia/p/1", async () => pedacos++) && pedidos.length === 1);
  ok("pré-carregar: o mesmo endereço não pede de novo", !precarregarTela(roteador, "/pt/alumia/p/1") && pedidos.length === 1);
  atributos.add("data-light");
  ok("pré-carregar: modo leve não pré-carrega", economizandoDados() && !precarregarTela(roteador, "/pt/alumia/p/2") && pedidos.length === 1);
  atributos.delete("data-light");
  conexao.saveData = true;
  ok("pré-carregar: economia de dados não pré-carrega", !precarregarTela(roteador, "/pt/alumia/p/3"));
  conexao.saveData = false;
  conexao.effectiveType = "3g";
  ok("pré-carregar: 3G não pré-carrega", !precarregarTela(roteador, "/pt/alumia/p/4"));
  conexao.effectiveType = "4g";
  ok("pré-carregar: 4G pré-carrega", precarregarTela(roteador, "/pt/alumia/p/5") && pedidos.length === 2);
  await esperar();
  ok("pré-carregar: o pedaço de código desce junto", pedacos === 1);
  delete globalThis.document;
}

// ───────────── A17: as peças usam o que foi conferido acima ─────────────

const cartao = ler("components/rede/publicar/alumia2/CartaoDaAlumia2.tsx");
ok("cartão: Acender pelo interruptor otimista, com o estado querido", /acendedor\.current \?\?= criarInterruptor\(post\.apoiei,[\s\S]{0,120}rede\.reagir\(post\.id, "apoio", quer\)/.test(cartao));
ok("cartão: o Acender não espera as outras ações (sem disabled={ocupado})", /al2-acao-acender" aria-pressed=\{post\.apoiei\} data-tocou=\{[^}]+\} onClick/.test(cartao));
ok("cartão: pré-carrega a conversa na intenção", cartao.includes("onPointerEnter={preparar}") && cartao.includes('import("../../conversa/TelaDaConversa")'));
const perfil = ler("components/rede/perfil/livre/PaginaDoPerfil.tsx");
ok("perfil: Seguir pelo interruptor otimista", /seguidor\.current \?\?= criarInterruptor\(dado\.sigo \|\| dado\.pendente,[\s\S]{0,80}redePerfil\.seguir\(dado\.handle, quer\)/.test(perfil));
const escrever = ler("components/rede/publicar/alumia2/EscreverDaAlumia2.tsx");
ok("Escrever: anuncia o post a caminho pela chave do envio", /anunciarPostACaminho\(\{ chave: envio\.chave,/.test(escrever) && escrever.includes("return () => retirarPostACaminho(envio.chave);"));
const redeTsx = ler("components/rede/Rede.tsx");
ok("Rede: o post confirmado entra sem recarregar a linha", redeTsx.includes("else if (!post.retido) confirmarPost(post);"));
const linha = ler("components/rede/Linha.tsx");
ok("Linha: junta os confirmados e mostra os a caminho", linha.includes("juntarConfirmados(aba, r.itens, Date.parse(antes))") && linha.includes("<CartaoACaminho"));
const casca = ler("components/rede/publicar/alumia2/CascaDaAlumia2.tsx");
ok("casca: os links trocam de tela por View Transitions, e a entrada de antes fica de reserva", casca.includes("useTransicaoNosLinks(roteador);") && casca.includes("!trocaEmCurso()") && casca.includes('className={entrando ? "al2-tela-entra" : undefined}'));
const transicao = ler("components/rede/publicar/alumia2/TransicaoDaTela.tsx");
ok("transição: sem a API, com menos movimento ou no leitor de tinta, só navega", /if \(!trocaAnimada\(\)\) return roteador\.push\(href\);/.test(transicao) && transicao.includes("!semMovimento()") && transicao.includes('data-eink'));
const linkDoSite = ler("components/Link.tsx");
ok("Link do site: só a casca da Alumia registra a navegação animada; sem registro, nada muda", linkDoSite.includes("if (navegacaoAnimada && typeof href === \"string\" && !replace && navegacaoAnimada(href)) e.preventDefault();"));
ok("cartão: abre a conversa pela transição", cartao.includes("navegarComTransicao(router, caminhoDoPost);"));
const alumiaCss = ler("styles/alumia.css");
ok("CSS da Alumia: transição de tela para com menos movimento", /@media \(prefers-reduced-motion: reduce\) \{\s*:root:has\(\[data-al="2"\]\)::view-transition-group\(\*\)[^{]*\{ animation: none !important; \}/.test(alumiaCss) && alumiaCss.includes(':root[data-parado]:has([data-al="2"])::view-transition-new(*)'));

console.log(`testar:p5-leve — ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
