// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a F1 da Alumia nova (PLANO-ALUMIA §8: casca, linha, cartão e escrever): as regras puras (pessoas só a partir de 3 e
// arredondadas, porcentagens da enquete somando 100, servidor do Fediverso, desfazer em 10 s, rascunhos até 20 e 30 dias, tipos do
// compositor), os dados de exemplo da prévia (só com NEXT_PUBLIC_ALUMIA_PREVIA=sim, ids "exemplo-", codinome, nada de pessoa abaixo
// de 3), os textos nos 6 idiomas com as mesmas chaves, e que tudo novo fica atrás da flag "alumia-2" (desligada, a Rede de hoje).
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 --import ./scripts/carregar-ts.mjs scripts/testar-alumia-f1.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  contagemDePessoas, diaEMes, misturarRepostes, podeRepostar, enderecoNoFediverso, enderecoParaCompartilhar, LIMITE_DE_RASCUNHOS, porcentagensDaEnquete, previaLigada,
  quandoDoChamado, rascunhosValidos, rascunhoTemTexto, segundosQueFaltam, SEGUNDOS_PARA_DESFAZER, servidorDoFediverso, tempoCurto, tipoDoBanco,
  tipoDoRascunho,
} from "../lib/rede/publicar/alumia2.ts";
import { ATOS_PERTO_DE_EXEMPLO, COMUNIDADES_DE_EXEMPLO, enqueteDeExemplo, PLENARIA_DE_EXEMPLO, postsDeExemplo, SITUACAO_DE_EXEMPLO } from "../lib/rede/publicar/exemplos-alumia2.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => fs.readFileSync(path.join(raiz, p), "utf8");
let certos = 0;
const falhas = [];
const igual = (nome, valor, esperado) => {
  if (JSON.stringify(valor) === JSON.stringify(esperado)) certos++;
  else falhas.push(`${nome}: veio ${JSON.stringify(valor)}, esperava ${JSON.stringify(esperado)}`);
};
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));

// ── Pessoas: só a partir de 3, arredondadas (PLANO-ALUMIA §6.1) ──
igual("0 pessoas não aparece", contagemDePessoas(0), null);
igual("2 pessoas não aparece", contagemDePessoas(2), null);
igual("nulo não aparece", contagemDePessoas(null), null);
igual("NaN não aparece", contagemDePessoas(Number.NaN), null);
igual("3 pessoas aparece", contagemDePessoas(3), { n: 3, arredondado: false });
igual("100 exato", contagemDePessoas(100), { n: 100, arredondado: false });
igual("137 → mais de 130", contagemDePessoas(137), { n: 130, arredondado: true });
igual("1.204 → mais de 1.200", contagemDePessoas(1204), { n: 1200, arredondado: true });
igual("1.200 exato", contagemDePessoas(1200), { n: 1200, arredondado: false });

// ── Enquete ──
igual("61 votos (26/21/14) → 43/34/23, pelo maior resto", porcentagensDaEnquete([26, 21, 14]), [43, 34, 23]);
ok("as porcentagens somam 100", porcentagensDaEnquete([1, 1, 1]).reduce((a, b) => a + b) === 100);
igual("1/1/1 → 34/33/33", porcentagensDaEnquete([1, 1, 1]), [34, 33, 33]);
igual("ninguém votou → nulo", porcentagensDaEnquete([0, 0]), null);
igual("total secreto → nulo", porcentagensDaEnquete([null, 3]), null);

// ── Fediverso ──
igual("servidor de @tiao@mastodon.social", servidorDoFediverso("@tiao@mastodon.social"), "mastodon.social");
igual("servidor sem @ inicial", servidorDoFediverso("tiao@Mastodon.Social"), "mastodon.social");
igual("da Alumia: sem servidor", servidorDoFediverso("rosavermelha"), null);
igual("texto solto não vira selo", servidorDoFediverso("a@<script>"), null);
igual("vazio", servidorDoFediverso(null), null);
igual("endereço da Faísca", enderecoNoFediverso("faisca"), "@faisca@alumia.institutolucia.org");

// ── Compartilhar: sem rastreio ──
igual("compartilhar tira a busca", enderecoParaCompartilhar("https://alumia.institutolucia.org/", "/pt/alumia/p/1?ref=x#y"), "https://alumia.institutolucia.org/pt/alumia/p/1");

// ── Desfazer envio ──
igual("são 10 s", SEGUNDOS_PARA_DESFAZER, 10);
igual("no começo faltam 10", segundosQueFaltam(1000, 1000), 10);
igual("depois de 0,2 s ainda 10", segundosQueFaltam(1000, 1200), 10);
igual("depois de 9,5 s falta 1", segundosQueFaltam(1000, 10_500), 1);
igual("aos 10 s, zero", segundosQueFaltam(1000, 11_000), 0);
igual("depois, nunca negativo", segundosQueFaltam(1000, 99_000), 0);

// ── Rascunhos ──
igual("até 20 rascunhos", LIMITE_DE_RASCUNHOS, 20);
ok("rascunho vazio não vai", !rascunhoTemTexto({ texto: "  ", titulo: "", corpo: "\n" }));
ok("rascunho com título vai", rascunhoTemTexto({ texto: "", titulo: "Oi", corpo: "" }));
{
  const agora = Date.parse("2026-11-09T12:00:00Z");
  const lista = Array.from({ length: 25 }, (_, i) => ({ id: String(i), atualizado_em: new Date(agora - i * 3_600_000).toISOString() }));
  lista.push({ id: "velho", atualizado_em: new Date(agora - 31 * 86_400_000).toISOString() });
  const v = rascunhosValidos(lista, agora);
  igual("no máximo 20", v.length, 20);
  igual("o mais novo primeiro", v[0].id, "0");
  ok("o de 31 dias some", !v.some((r) => r.id === "velho"));
}

// ── Tipos do compositor ──
igual("post → post", tipoDoBanco("post"), "post");
igual("ato é da F2", tipoDoBanco("ato"), null);
igual("texto longo → discussão", tipoDoBanco("longo"), "discussao");
igual("texto longo como dúvida", tipoDoBanco("longo", "duvida"), "duvida");
igual("enquete → enquete", tipoDoBanco("enquete"), "enquete");
igual("rascunho desconhecido vira post", tipoDoRascunho("qualquer"), "post");
igual("rascunho de ato fica ato", tipoDoRascunho("ato"), "ato");

// ── Datas do cartão ──
{
  const d = diaEMes("2026-11-16T14:00:00Z", "pt");
  igual("dia do chamado", d?.dia, "16");
  ok("mês curto em maiúsculas", d && /^[A-Z]{3}/.test(d.mes));
  igual("data ruim", diaEMes("x", "pt"), null);
}
{
  // O tempo curto das pranchas ("12 min", sem "há") e o quando do chamado ("amanhã, 11h").
  const agora = new Date(2026, 10, 9, 10, 0).getTime();
  const antes = (ms) => new Date(agora - ms).toISOString();
  igual("12 min", tempoCurto(antes(12 * 60_000), "pt", agora), "12 min");
  igual("menos de 1 min vira 1 min", tempoCurto(antes(5_000), "pt", agora), "1 min");
  igual("3 h", tempoCurto(antes(3 * 3_600_000), "pt", agora), "3 h");
  igual("2 dias", tempoCurto(antes(2 * 86_400_000), "pt", agora), "2 dias");
  ok("de uma semana para trás, o dia", /^20 out/.test(tempoCurto(antes(20 * 86_400_000), "pt", agora)));
  ok("sem 'há'", !tempoCurto(antes(12 * 60_000), "pt", agora).includes("há"));
  igual("tempo de data ruim", tempoCurto("x", "pt", agora), "");
  igual("chamado amanhã, 11h", quandoDoChamado(new Date(2026, 10, 10, 11, 0).toISOString(), "pt", agora), "amanhã, 11h");
  igual("chamado hoje, 18h30", quandoDoChamado(new Date(2026, 10, 9, 18, 30).toISOString(), "pt", agora), "hoje, 18h30");
  igual("chamado na semana: o dia da semana", quandoDoChamado(new Date(2026, 10, 13, 18, 0).toISOString(), "pt", agora), "sex, 18h");
  ok("chamado em inglês: tomorrow", quandoDoChamado(new Date(2026, 10, 10, 11, 0).toISOString(), "en", agora).startsWith("tomorrow"));
  for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) ok(`tempo curto em ${l}`, tempoCurto(antes(12 * 60_000), l, agora).includes("12"));
}

// ── Prévia: só com "sim", e os exemplos seguem a seção 6 ──
ok("prévia desligada sem a variável", !previaLigada(undefined));
ok("prévia desligada com 'nao'", !previaLigada("nao"));
ok("prévia ligada com 'sim'", previaLigada("sim"));
{
  const posts = postsDeExemplo(Date.parse("2026-11-09T12:00:00Z"));
  igual("5 posts das pranchas", posts.length, 5);
  ok("todos com id exemplo-", posts.every((p) => p.id.startsWith("exemplo-")));
  ok("ordem de chegada (mais novo primeiro)", posts.every((p, i) => i === 0 || posts[i - 1].criado_em >= p.criado_em));
  ok("todos com codinome", posts.every((p) => p.autor.codinome.trim().length > 0));
  ok("nenhum total de Acender para quem não escreveu", posts.every((p) => p.meu || p.apoios === null));
  ok("comunidades conhecidas", posts.every((p) => !p.comunidade || p.comunidade in COMUNIDADES_DE_EXEMPLO));
  const e = enqueteDeExemplo();
  igual("enquete soma 61", e.opcoes.reduce((s, o) => s + o.votos, 0), 61);
  igual("enquete de exemplo 43/34/23", porcentagensDaEnquete(e.opcoes.map((o) => o.votos)), [43, 34, 23]);
  ok("plenária: número de pessoas passa pela regra", contagemDePessoas(PLENARIA_DE_EXEMPLO.naSala)?.arredondado === true);
  igual("3 atos perto", ATOS_PERTO_DE_EXEMPLO.length, 3);
  ok("situação de exemplo com codinome e @nome", SITUACAO_DE_EXEMPLO.codinome === "Faísca" && SITUACAO_DE_EXEMPLO.handle === "faisca");
}

// ── Textos nos 6 idiomas, mesmas chaves, sem vazio ──
const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? chaves(v, `${p}${k}.`) : [`${p}${k}`]));
const base = JSON.parse(ler("i18n/rede/publicar/alumia2/pt.json"));
for (const l of ["en", "es", "fr", "ru", "zh"]) {
  const t = JSON.parse(ler(`i18n/rede/publicar/alumia2/${l}.json`));
  igual(`${l}: as mesmas chaves do pt`, chaves(t).sort(), chaves(base).sort());
  const vazios = chaves(t).filter((k) => !String(k.split(".").reduce((o, c) => o[c], t)).trim());
  igual(`${l}: nenhum texto vazio`, vazios, []);
  ok(`${l}: o lembrete de descrição tem texto`, t.escrever.semAlt.length > 20);
}
ok("pt: 'Ordem de chegada, sem algoritmo'", base.linha.ordem === "Ordem de chegada, sem algoritmo");
ok("pt: 'Público, também no Fediverso'", base.escrever.publicoInternet === "Público, também no Fediverso");

// ── Atrás da flag: desligada, a Rede de hoje ──
const redeTsx = ler("components/rede/Rede.tsx");
ok("Rede lê alumia2Ligada", /const AL2 = alumia2Ligada\(\)/.test(redeTsx));
ok("a prévia exige a flag", /const PREVIA = AL2 && previaLigada\(\)/.test(redeTsx));
ok("sem o contexto, a casca de hoje", /contexto2 \? CascaDaAlumia2 : Casca/.test(redeTsx));
ok("sem o contexto, o Escrever de hoje", /escrevendo && pode && !contexto2 && \(\s*<Escrever/.test(redeTsx));
const cartao = ler("components/rede/CartaoDePost.tsx");
ok("cartão novo só com o contexto", /al2 \? <CartaoDaAlumia2 \{\.\.\.props\} \/> : <CartaoClassico \{\.\.\.props\} \/>/.test(cartao));
const linha = ler("components/rede/Linha.tsx");
ok("a linha só usa exemplo na prévia", /previa\s*\?\s*import\("@\/lib\/rede\/publicar\/exemplos-alumia2"\)\.then\(\(m\) => \(\{[\s\S]{0,240}?m\.postsDeExemplo\(\)/.test(linha));
// Desligada, nada da Alumia nova vai no pacote da Rede de hoje: as peças e os exemplos chegam sob demanda.
for (const p of ["CascaDaAlumia2", "EscreverDaAlumia2", "TopoDaLinha2"]) {
  ok(`${p} sob demanda`, redeTsx.includes(`const ${p} = dynamic(() => import("./publicar/alumia2/${p}")`) && !new RegExp(`^import \\{[^}]*\\b${p}\\b`, "m").test(redeTsx));
}
ok("cartão novo sob demanda", cartao.includes("const CartaoDaAlumia2 = dynamic(") && !/^import \{ CartaoDaAlumia2/m.test(cartao));
ok("exemplos fora do pacote", ![redeTsx, linha].some((x) => /^import [^;]*exemplos-alumia2/m.test(x)));
const css = ler("styles/alumia.css");
const novas = css.slice(css.indexOf("Alumia nova (Onda 5, F1"));
const seletores = novas.replace(/\/\*[\s\S]*?\*\//g, "").match(/[^{}]+(?=\{)/g) ?? [];
const soltos = seletores.map((s) => s.trim()).filter((s) => s && !s.startsWith("@") && !/data-al="2"/.test(s) && !/^(from|to|\d+%)$/.test(s));
igual("todo estilo novo fica dentro de [data-al=\"2\"]", soltos, []);

// ── Funções das pranchas presentes (nada só de enfeite) ──
const casca = ler("components/rede/publicar/alumia2/CascaDaAlumia2.tsx");
for (const item of ["inicio", "explorar", "chamados", "comunidades", "nucleos", "avisos", "conversas", "salvos", "perfil"]) ok(`menu tem ${item}`, casca.includes(`chave: "${item}"`));
igual("barra de baixo do celular", (casca.match(/const BARRA: Chave\[\] = \[([^\]]+)\]/) ?? [])[1], '"inicio", "explorar", "chamados", "perfil"');
ok("Sair rápido na casca", casca.includes("sairRapidoDaRede(enderecoDoSite(lang), ENCAIXES.aoSairRapido)"));
const cartaoNovo = ler("components/rede/publicar/alumia2/CartaoDaAlumia2.tsx");
for (const f of ["repostar", "acender", "salvar", "compartilhar"]) ok(`cartão: ${f} chama algo de verdade`, new RegExp(`const ${f} = \\(\\) =>`).test(cartaoNovo));
ok("compartilhar sem rastreio", cartaoNovo.includes("enderecoParaCompartilhar(window.location.origin"));
const escrever = ler("components/rede/publicar/alumia2/EscreverDaAlumia2.tsx");
ok("escrever: desfazer em 10 s", escrever.includes("segundosQueFaltam(envio.desde") && escrever.includes("function desfazer()"));
ok("escrever: rascunho na conta", escrever.includes("redePub.salvarRascunho(") && escrever.includes("redePub.rascunhos()"));
ok("escrever: verificações das frentes", escrever.includes("verificarAntesDePublicar("));
ok("escrever: Quem vê / Quem responde / Onde publicar", ["t.escrever.quemVe", "t.escrever.quemResponde", "t.escrever.ondePublicar"].every((k) => escrever.includes(k)));
ok("escrever: o Ato vem do encaixe da F2", escrever.includes('ENCAIXES.tiposDoCompositor.find((x) => x.tipo === "ato")'));
// Teclado e foco (WCAG 2.1.1, 2.4.3): o diálogo prende o Tab e devolve o foco; Esc fecha a lista antes do Escrever; fechar guarda o rascunho.
ok("escrever: Tab preso no diálogo", escrever.includes("onKeyDown={prenderTab}") && escrever.includes('document.addEventListener("focusin"'));
ok("escrever: foco volta a quem abriu", escrever.includes("if (antes?.isConnected) antes.focus()"));
ok("escrever: Esc fecha a lista primeiro", /if \(aberta\) \{\s*setAberta\(null\);\s*return;/.test(escrever));
ok("escrever: fechar guarda o rascunho na hora", /function fechar\(\)[\s\S]*escreverRascunho\(/.test(escrever));
ok("escrever: pílulas com setas (rádio de verdade)", ler("components/rede/publicar/alumia2/Pilulas.tsx").includes("ArrowRight") && !escrever.includes('role="radio"'));
ok("escrever: globo só quando federa", escrever.includes('p === "internet" ? "fediverso"'));
const topo = ler("components/rede/publicar/alumia2/TopoDaLinha2.tsx");
ok("abas completas: aria-controls, tabIndex móvel e setas", topo.includes("aria-controls={PAINEL_DA_LINHA}") && topo.includes("tabIndex={aba === a ? 0 : -1}") && topo.includes("ArrowLeft"));
ok("o painel da linha", redeTsx.includes('role="tabpanel" id="al2-painel-linha"'));
const dubles = ler("components/rede/publicar/alumia2/previa/Dubles.tsx");
ok("compartilhar o ato faz algo", dubles.includes("onClick={() => void compartilhar()}"));
ok("nenhum hidden direto num botão (o display do .al-botao ganharia)", !/<(Botao|LinkBotao)[^>]*className="[^"]*\bhidden\b/.test(dubles));
ok("repostar se desliga sem a função no banco", cartaoNovo.includes("repostarForaDoBanco = true"));

// ── Repostar: a mesma regra do banco, e a mistura na aba Seguindo (o banco é provado em testar-alumia-f1-banco.mjs) ──
const basePost = { meu: false, resposta_a: null, publico: "membros", expira_em: null };
ok("repostar: post de outra pessoa para a Alumia", podeRepostar(basePost));
ok("repostar: público da internet também", podeRepostar({ ...basePost, publico: "internet" }));
ok("repostar: o próprio post não", !podeRepostar({ ...basePost, meu: true }));
ok("repostar: resposta não", !podeRepostar({ ...basePost, resposta_a: "x" }));
ok("repostar: post para seguidores, comunidade, núcleo ou equipe não", ["seguidores", "comunidade", "nucleo", "equipe"].every((p) => !podeRepostar({ ...basePost, publico: p })));
ok("repostar: post que some sozinho não", !podeRepostar({ ...basePost, expira_em: "2026-11-10T00:00:00Z" }));
const pagina = [{ id: "a", criado_em: "2026-11-09T12:00:00Z" }, { id: "b", criado_em: "2026-11-09T10:00:00Z" }];
const reps = [{ id: "c", criado_em: "2026-11-01T00:00:00Z", repostado_em: "2026-11-09T11:00:00Z" }, { id: "a", criado_em: "2026-11-09T12:00:00Z", repostado_em: "2026-11-09T11:30:00Z" }];
igual("mistura: o repost entra pela hora do repost, sem repetir o que já está na página", misturarRepostes(pagina, reps).map((p) => p.id), ["a", "c", "b"]);
igual("mistura: o que já apareceu em página anterior não volta", misturarRepostes(pagina, reps, new Set(["c"])).map((p) => p.id), ["a", "b"]);
ok("cartão: o estado do repostar vem do banco em lote", cartaoNovo.includes("jaRepostei(post.id)") && ler("lib/rede/publicar/repostados.ts").includes("redePub.repostados"));
ok("cartão: repost de quem se segue sem o nome de quem repostou", cartaoNovo.includes("t.cartao.veioDeRepost") && !/repostado_por|quem_repostou/.test(cartaoNovo));
ok("escrever: Desfazer no meio do envio desfaz no banco", escrever.includes("redePub.desfazer(post.id)") && escrever.includes("desfeitoNoEnvio.current = true"));
ok("escrever: 20 rascunhos cheios avisa", escrever.includes('"limite_rascunhos"') && escrever.includes("t.escrever.rascunhosCheios"));
ok("linha: reposts só na aba Seguindo da Alumia nova", ler("components/rede/Linha.tsx").includes('const comReposts = Boolean(al2) && !previa && logado && aba === "seguindo"'));
const cascaNova = ler("components/rede/publicar/alumia2/CascaDaAlumia2.tsx");
ok("cascaNova: emblemas numa chamada, com os avisos de hoje se faltar a F1", /redePub\s*\.emblemas\(\)/.test(cascaNova) && cascaNova.includes("avisos.contar()"));
const sqlF1 = ler("supabase/migracoes/20261109-alumia-f1.sql");
ok("a migração da F1 tem as funções que o cliente chama", ["rede_pub_repostar", "rede_pub_repostados", "rede_pub_repostes", "rede_pub_rascunho_salvar", "rede_pub_rascunhos", "rede_pub_rascunho_apagar", "rede_pub_desfazer", "rede_alumia_emblemas"].every((f) => sqlF1.includes(`function public.${f}(`) && ler("lib/rede/cliente-publicar.ts").includes(`"${f}"`)));

console.log(`testar-alumia-f1: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
