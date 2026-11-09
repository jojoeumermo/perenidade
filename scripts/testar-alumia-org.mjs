// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a parte de front-end da F4 da Alumia (perfis e organizações; PLANO-ALUMIA §8 F4): a apuração das consultas (simples e
// ranqueada por segundo turno instantâneo, em casos conhecidos, e quórum), a regra das contagens de pessoas (nada abaixo de 3,
// "mais de" para número grande), a conferência do pedido do selo (CPF recusado), o cliente do banco sobre uma forma simulada
// (função ausente vira "nada", e o exemplo só aparece com a prévia ligada), os dados de exemplo sem lista de pessoas, os textos nos
// 6 idiomas com as mesmas chaves e as rotas novas atrás da flag. O banco (rede_org_*) é da etapa de back-end.
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 --import ./scripts/carregar-ts.mjs scripts/testar-alumia-org.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { apurarRanqueada, apurarSimples, cedulaValida, proporcoesFinais, quorumAtingido } from "../lib/rede/org/apuracao.ts";
import { dataCurta, escreverPessoas, faltaPara, linkSeguro, pessoasParaMostrar, porcentagem } from "../lib/rede/org/contagem.ts";
import { aoVivoDeExemplo, HANDLE_DE_EXEMPLO, orgDeExemplo } from "../lib/rede/org/exemplos.ts";
import { conferirPedido, pareceCpf } from "../lib/rede/org/pedido.ts";
import { bancoSemAFuncao, criarClienteOrg } from "../lib/rede/cliente-org.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let certos = 0;
const falhas = [];
const igual = (nome, valor, esperado) => {
  if (JSON.stringify(valor) === JSON.stringify(esperado)) certos++;
  else falhas.push(`${nome}: veio ${JSON.stringify(valor)?.slice(0, 300)}, esperava ${JSON.stringify(esperado)?.slice(0, 300)}`);
};
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));

// ── Apuração ──
{
  const op = ["a", "b", "c"];
  ok("cédula vazia não vale", !cedulaValida([], op));
  ok("cédula com opção repetida não vale", !cedulaValida(["a", "a"], op));
  ok("cédula com opção desconhecida não vale", !cedulaValida(["x"], op));
  ok("cédula completa vale", cedulaValida(["c", "a", "b"], op));
  const s = apurarSimples([["a"], ["a"], ["b"], ["x"]], op);
  igual("simples: vence a mais votada e descarta inválida", [s.vencedora, s.cedulas, s.rodadas[0].votos], ["a", 3, { a: 2, b: 1, c: 0 }]);
  igual("simples: empate no topo = sem vencedora", apurarSimples([["a"], ["b"]], op).vencedora, null);
  igual("simples: sem votos = sem vencedora", apurarSimples([], op).vencedora, null);
  // IRV clássico: a 4, b 3, c 2 (c → b). c sai; b fica com 5 de 9 e vence.
  const cedulas = [...Array(4).fill(["a", "b"]), ...Array(3).fill(["b", "a"]), ...Array(2).fill(["c", "b"])];
  const r = apurarRanqueada(cedulas, op);
  igual("ranqueada: c sai na primeira rodada", r.rodadas[0].eliminada, "c");
  igual("ranqueada: b vence com as transferências de c", r.vencedora, "b");
  igual("ranqueada: duas rodadas", r.rodadas.length, 2);
  igual("ranqueada: maioria na primeira rodada vence direto", apurarRanqueada([["a"], ["a"], ["b"]], op).vencedora, "a");
  // Cédulas esgotadas não contam para a maioria: a 2, b 2, c 1 (só c). c sai e esgota; empate a×b → desempate pela regra fixa.
  const esg = apurarRanqueada([["a"], ["a"], ["b"], ["b"], ["c"]], op);
  ok("ranqueada: cédula esgotada contada", esg.rodadas.some((x) => x.esgotadas === 1));
  ok("ranqueada: empate se resolve por regra fixa (sempre o mesmo)", JSON.stringify(esg) === JSON.stringify(apurarRanqueada([["a"], ["a"], ["b"], ["b"], ["c"]], op)));
  const p = proporcoesFinais(r, op);
  ok("proporções finais somam 1", Math.abs(p.a + p.b + p.c - 1) < 1e-9);
  ok("quórum: 300 de 300 atinge", quorumAtingido(300, 300));
  ok("quórum: 299 de 300 não atinge", !quorumAtingido(299, 300));
  ok("quórum: sem quórum sempre atinge", quorumAtingido(0, null));
}

// ── Contagens de pessoas ──
{
  const t = { exato: "{n} na sala", maisDe: "mais de {n} na sala", poucas: "poucas pessoas na sala" };
  igual("0, 1 e 2 pessoas: nada", [0, 1, 2, null, undefined, NaN].map(pessoasParaMostrar), [null, null, null, null, null, null]);
  igual("3 pessoas: exato", pessoasParaMostrar(3), { valor: 3, maisDe: false });
  igual("19 exato", pessoasParaMostrar(19), { valor: 19, maisDe: false });
  igual("48 → mais de 40", pessoasParaMostrar(48), { valor: 40, maisDe: true });
  igual("1.204 → mais de 1.200", escreverPessoas(1204, t, "pt"), "mais de 1.200 na sala");
  igual("2 → poucas pessoas", escreverPessoas(2, t, "pt"), "poucas pessoas na sala");
  igual("150 exato redondo", escreverPessoas(150, t, "pt"), "150 na sala");
  igual("porcentagem 0,71 → 71", porcentagem(0.71), 71);
  igual("porcentagem fora do intervalo → nulo", [porcentagem(1.2), porcentagem(-0.1), porcentagem(null)], [null, null, null]);
  igual("data AAAA-MM-DD em pt", dataCurta("2026-11-03", "pt"), "03/11/2026");
  igual("prazo vencido → nulo", faltaPara("2020-01-01T00:00:00Z"), null);
  igual("faltam 2 d 4 h", faltaPara("2026-01-03T04:00:00Z", new Date("2026-01-01T00:00:00Z")), { dias: 2, horas: 4 });
  igual("link: só http(s)", [linkSeguro("javascript:alert(1)"), linkSeguro("data:text/html,x"), linkSeguro("nada"), linkSeguro("https://camara.leg.br/x")], [null, null, null, "https://camara.leg.br/x"]);
}

// ── Pedido do selo ──
{
  const bom = { codinome: "Coletivo Teste", handle: "coletivo_teste", tipo: "coletivo", cidade: "Recife", documentoTipo: "cnpj", documento: "12.345.678/0001-90", sobre: "Um coletivo de teste.", maior: true };
  igual("pedido bom passa", conferirPedido(bom), null);
  igual("CPF é recusado", conferirPedido({ ...bom, documento: "123.456.789-09" }), "docPessoal");
  igual("CPF sem pontos é recusado", conferirPedido({ ...bom, documento: "12345678909" }), "docPessoal");
  ok("CNPJ não parece CPF", !pareceCpf("12.345.678/0001-90"));
  igual("@ com maiúscula ou acento é recusado", [conferirPedido({ ...bom, handle: "Coletivo" }), conferirPedido({ ...bom, handle: "ação" }), conferirPedido({ ...bom, handle: "ab" })], ["handle", "handle", "handle"]);
  igual("sem 18+ não passa", conferirPedido({ ...bom, maior: false }), "maior");
  igual("tipo fora da lista não passa", conferirPedido({ ...bom, tipo: "empresa" }), "tipo");
}

// ── Cliente sobre forma simulada ──
{
  const chamadas = [];
  const semFuncao = async (funcao, args) => {
    chamadas.push([funcao, args]);
    throw Object.assign(new Error("x"), { code: "banco_desatualizado" });
  };
  const semPrevia = criarClienteOrg(semFuncao, () => false);
  const comPrevia = criarClienteOrg(semFuncao, () => true);
  ok("bancoSemAFuncao reconhece os dois códigos", bancoSemAFuncao({ code: "banco_desatualizado" }) && bancoSemAFuncao({ code: "sem_servico" }) && !bancoSemAFuncao({ code: "outro" }));
  igual("sem banco e sem prévia: org nula", await semPrevia.org(HANDLE_DE_EXEMPLO), null);
  igual("sem banco e sem prévia: ao vivo vazio", await semPrevia.aoVivo(), []);
  igual("sem banco: linha da pessoa vazia", await semPrevia.linhaDaPessoa("x", "midia"), { itens: [], proximo: null });
  ok("com prévia: org de exemplo só no @ de exemplo", (await comPrevia.org(HANDLE_DE_EXEMPLO))?.handle === HANDLE_DE_EXEMPLO && (await comPrevia.org("outra")) === null);
  igual("nomes das funções chamadas", [...new Set(chamadas.map((c) => c[0]))], ["rede_org_perfil", "rede_org_ao_vivo", "rede_perfil_linha"]);
  let subiu = false;
  try {
    await criarClienteOrg(async () => {
      throw Object.assign(new Error("x"), { code: "proibido" });
    }).org("x");
  } catch {
    subiu = true;
  }
  ok("outro erro sobe (não vira exemplo)", subiu);
  const args = [];
  const c = criarClienteOrg(async (f, a) => (args.push([f, a]), { votei: true }));
  await c.votar("c1", ["a", "b"]);
  await c.perguntar("p1", "Pergunta?", false);
  igual("votar manda só a cédula (nada de quem)", args[0], ["rede_org_consulta_votar", { p_consulta: "c1", p_ranking: ["a", "b"] }]);
  igual("perguntar manda o 'mostrar meu @'", args[1], ["rede_org_plenaria_perguntar", { p_plenaria: "p1", p_texto: "Pergunta?", p_mostrar: false }]);
}

// ── Exemplo sem lista de pessoas ──
{
  const o = orgDeExemplo(new Date("2026-11-09T12:00:00Z"));
  const texto = JSON.stringify(o);
  ok("exemplo: nenhum campo de lista de pessoas", !/"(seguidores|membros|votantesLista|quem|pessoasNaSala)"/.test(texto));
  ok("exemplo: consulta aberta sem proporção nem votantes", o.consultas.filter((c) => c.situacao === "aberta").every((c) => c.votantes === null && c.opcoes.every((x) => x.proporcao === null)));
  ok("exemplo: fila em ordem de chegada", o.plenarias.every((p) => p.fila.every((q, i, a) => i === 0 || a[i - 1].criadaEm <= q.criadaEm)));
  ok("exemplo: toda votação tem fonte https", o.votacoes.every((v) => linkSeguro(v.fonte)?.startsWith("https://")));
  igual("ao vivo do exemplo: sem a fila de perguntas", Object.keys(aoVivoDeExemplo()[0]).includes("fila"), false);
}

// ── Textos nos 6 idiomas ──
{
  const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (k === "_rascunho" ? [] : v && typeof v === "object" ? chaves(v, `${p}${k}.`) : [`${p}${k}`]));
  const ler = (l) => JSON.parse(fs.readFileSync(path.join(raiz, "i18n/rede/org", `${l}.json`), "utf8"));
  const pt = chaves(ler("pt"));
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const outro = chaves(ler(l));
    igual(`i18n ${l}: mesmas chaves do pt`, [pt.filter((k) => !outro.includes(k)), outro.filter((k) => !pt.includes(k))], [[], []]);
    const marcadores = (d) => JSON.stringify(d).match(/\{[a-z]+\}/gi)?.sort() ?? [];
    igual(`i18n ${l}: mesmos {marcadores}`, marcadores(ler(l)), marcadores(ler("pt")));
  }
  ok("pt: a regra do selo diz que não é apoio do Instituto", ler("pt").selo.regra.includes("não é apoio do Instituto Lúcia"));
}

// ── Rotas atrás da flag ──
{
  for (const r of ["organizacoes/page.tsx", "organizacoes/exemplo/page.tsx", "organizacoes/selo/page.tsx"]) {
    const fonte = fs.readFileSync(path.join(raiz, "app/[lang]/alumia", r), "utf8");
    ok(`${r}: 404 com a flag desligada`, /if \(!rotaNovaLigada\("organizacoes"\)\) notFound\(\);/.test(fonte));
  }
  const exemplo = fs.readFileSync(path.join(raiz, "app/[lang]/alumia/organizacoes/exemplo/page.tsx"), "utf8");
  ok("exemplo: fora da busca (dados ilustrativos)", /index: false/.test(exemplo));
  const tela = fs.readFileSync(path.join(raiz, "components/rede/perfil/TelaDoPerfil.tsx"), "utf8");
  ok("perfil: a tela de hoje continua quando a Alumia nova está desligada", /if \(alumia2Ligada\(\)\) return <PerfilDaAlumia2/.test(tela) && /return <TelaDoPerfilDeHoje/.test(tela));
  const ao = fs.readFileSync(path.join(raiz, "components/rede/org/AoVivoAgora.tsx"), "utf8");
  ok("Ao vivo agora: confere a flag alumia-org", /recursoLigado\("alumia-org"\)/.test(ao));
}

console.log(`Alumia (F4, organizações e perfis): ${certos} certos, ${falhas.length} falhas.`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
