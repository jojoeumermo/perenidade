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
  contagemDePessoas, diaEMes, enderecoNoFediverso, enderecoParaCompartilhar, LIMITE_DE_RASCUNHOS, porcentagensDaEnquete, previaLigada,
  rascunhosValidos, rascunhoTemTexto, segundosQueFaltam, SEGUNDOS_PARA_DESFAZER, servidorDoFediverso, tipoDoBanco, tipoDoRascunho,
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
ok("a linha só usa exemplo na prévia", /previa \? Promise\.resolve\(\{ itens: postsDeExemplo\(\)/.test(linha));
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

console.log(`testar-alumia-f1: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
