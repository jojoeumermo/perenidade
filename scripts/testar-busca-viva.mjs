// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere a busca viva da Etapa 4 (E4-05): a busca que entende pergunta (lib/intencoes.ts e content/busca-intencoes.json,
// com todo destino existindo de verdade), o "Por onde andei" (lib/historico-local.ts: desligado por padrão, 7 dias,
// 60 itens, "não guardar mais" e modo seguro) e a regra da saída rápida (lib/modo-seguro.ts: só "lucia*" sai).
// Sem rede e sem navegador. Uso: npm run testar:busca-viva
import fs from "node:fs";
import path from "node:path";
import { casamentos, casar, hrefDe, LIMIAR, normalizar, pontuar } from "../lib/intencoes.ts";
import { agrupar, apagarHistorico, CHAVE_HISTORICO, CHAVE_LIGADO, historicoLigado, lerHistorico, ligarHistorico, naoGuardarMais, podeGuardar, registrarVisita, semIdioma } from "../lib/historico-local.ts";
import { basesParaApagar, cachesParaApagar, chavesParaApagar, apagarChaves, CHAVE_SEGURO, DESTINO_NEUTRO, desligarModoSeguro, estaLigado, ligarModoSeguro, tresEsc } from "../lib/modo-seguro.ts";
import { chavesSoApagar, entraNaCopia } from "../lib/estudo.ts";
import { entradasDaEscola, entradaDoModoSeguro, textosDaBusca } from "../lib/escola/indice.ts";

const RAIZ = path.resolve(import.meta.dirname, "..");
const falhas = [];
let conferidos = 0;
const ok = (condicao, mensagem) => {
  conferidos++;
  if (!condicao) falhas.push(mensagem);
};
const igual = (a, b, mensagem) => ok(JSON.stringify(a) === JSON.stringify(b), `${mensagem}: esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);

/** Um armazenamento em memória com a mesma cara do localStorage. */
function memoria(inicial = {}) {
  const dados = new Map(Object.entries(inicial));
  return {
    get length() {
      return dados.size;
    },
    key: (i) => [...dados.keys()][i] ?? null,
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => void dados.set(k, String(v)),
    removeItem: (k) => void dados.delete(k),
    chaves: () => [...dados.keys()],
  };
}

// ───────────── normalizar e casar ─────────────

igual(normalizar("Como faço para estudar na EJA?"), "estudar na eja", "normalizar tira 'como faço para', acento e pontuação");
igual(normalizar("O que é a CLT?"), "a clt", "normalizar tira 'o que é'");
igual(normalizar("Onde peço o seguro-desemprego!!"), "peco o seguro desemprego", "normalizar tira 'onde' e troca hífen por espaço");
igual(normalizar("   "), "", "normalizar de espaço vazio");

const intencoes = JSON.parse(fs.readFileSync(path.join(RAIZ, "content/busca-intencoes.json"), "utf8"));
const primeiro = (q) => casar(q, intencoes)[0];
const hrefs = (q) => casar(q, intencoes).map(hrefDe);

igual(primeiro("como faço para estudar na EJA"), { tipo: "aula", id: "alfabetizacao-de-jovens-e-adultos/o-que-e-a-eja-e-como-se-matricular" }, "'como faço para estudar na EJA' leva à aula da EJA");
ok(hrefs("como faço rescisão").includes("/direitos"), "'como faço rescisão' leva ao guia de direitos");
ok(hrefs("como faço rescisão").includes("/trilhas/direitos-no-trabalho/o-que-e-a-clt"), "'como faço rescisão' leva à aula da CLT");
ok(hrefs("caí num golpe do pix").includes("/seguranca-digital"), "'caí num golpe do pix' leva à segurança digital");
ok(hrefs("Como funciona o ENEM?")[0] === "/trilhas/enem-como-funciona/como-funciona-o-enem", "'Como funciona o ENEM?' leva à aula do ENEM");
ok(hrefs("quero aprender a ler").includes("/trilhas/ler-e-escrever"), "'quero aprender a ler' leva à trilha Ler e escrever");
ok(hrefs("estou desempregado").includes("/direitos"), "'estou desempregado' leva ao guia de direitos");
ok(hrefs("como calcular porcentagem").includes("/trilhas/matematica-fundamental/02-porcentagem"), "porcentagem leva à aula de porcentagem");
for (const q of ["o golpe de 1964", "mais-valia", "receita de bolo de cenoura", "", "Marx", "fotossíntese"]) igual(casar(q, intencoes), [], `'${q}' não casa com nada (a busca fica como era)`);
ok(casar("como faço rescisão", intencoes).length <= 3, "no máximo 3 destinos");
for (const q of ["enem", "direitos do trabalhador", "golpe no celular", "juros"]) ok(casar(q, intencoes).length <= 3, `'${q}': no máximo 3 destinos`);

// O limite de 0,6, com intenções de teste (palavras que não são vazias).
const teste = [{ id: "t", padroes: ["alfa beta gama delta epsilon"], destinos: [{ tipo: "pagina", caminho: "/a" }, { tipo: "pagina", caminho: "/b" }], nota: "" }];
igual(pontuar("alfa beta gama", "alfa beta gama delta epsilon"), 0.6, "3 de 5 palavras dá 0,6");
igual(casar("alfa beta gama", teste).length, 2, "0,6 em ponto casa (o limite é 'pelo menos 0,6')");
igual(casar("alfa beta", teste), [], "0,4 não casa");
igual(casar("alfa beta gama zeta omega eta", teste), [], "3 em comum numa pergunta de 6 palavras: 0,5, não casa");
ok(pontuar("alfa beta gama zeta omega", "alfa beta gama delta epsilon") === 0.6 && casamentos("alfa beta gama zeta omega", teste).length === 1, "pergunta e padrão com 3 de 5 em comum: 0,6, casa");
ok(LIMIAR === 0.6, "LIMIAR é 0,6");
const duas = [
  { id: "x", padroes: ["sigma"], destinos: [{ tipo: "pagina", caminho: "/1" }, { tipo: "pagina", caminho: "/2" }], nota: "" },
  { id: "y", padroes: ["sigma tau"], destinos: [{ tipo: "pagina", caminho: "/2" }, { tipo: "pagina", caminho: "/3" }, { tipo: "pagina", caminho: "/4" }], nota: "" },
];
igual(casar("sigma", duas).map(hrefDe), ["/1", "/2"], "a melhor intenção primeiro; a segunda (0,5) fica de fora");
igual(casar("sigma tau", duas).map(hrefDe), ["/2", "/3", "/4"], "sem repetir destino e no máximo 3");

// ───────────── content/busca-intencoes.json: forma e destinos que existem ─────────────

ok(Array.isArray(intencoes) && intencoes.length >= 30 && intencoes.length <= 60, `de 30 a 60 intenções (há ${intencoes.length})`);
const ids = new Set();
const ferramentas = [...fs.readFileSync(path.join(RAIZ, "lib/areas.ts"), "utf8").matchAll(/export const tools = \[([\s\S]*?)\] as const/g)][0]?.[1] ?? "";
const existeFerramenta = (id) => ferramentas.includes(`"${id}"`);
const paginaLivre = (caminho) => {
  const arquivo = path.join(RAIZ, "app/[lang]", ...caminho.split("/").filter(Boolean), "page.tsx");
  if (!fs.existsSync(arquivo)) return "não existe";
  // Página que some sem uma flag não serve de destino: a caixa mostraria um link quebrado com a flag desligada.
  if (/notFound\(\)/.test(fs.readFileSync(arquivo, "utf8")) && /ligado\(/.test(fs.readFileSync(arquivo, "utf8"))) return "depende de uma flag";
  return "";
};
for (const intencao of intencoes) {
  const nome = `intenção "${intencao.id}"`;
  ok(typeof intencao.id === "string" && /^[a-z0-9-]+$/.test(intencao.id), `${nome}: id em minúsculas e hífens`);
  ok(!ids.has(intencao.id), `${nome}: id repetido`);
  ids.add(intencao.id);
  ok(typeof intencao.nota === "string" && intencao.nota.length > 0, `${nome}: precisa de nota`);
  ok(Array.isArray(intencao.padroes) && intencao.padroes.length > 0, `${nome}: precisa de padrões`);
  for (const padrao of intencao.padroes ?? []) {
    const limpo = padrao.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    ok(padrao === limpo && !/[^a-z0-9 ]/.test(padrao), `${nome}: o padrão "${padrao}" precisa estar sem acento, sem maiúscula e sem pontuação`);
    ok(casamentos(padrao, [intencao]).length === 1, `${nome}: o próprio padrão "${padrao}" precisa casar (não pode ser só palavras vazias)`);
  }
  ok(Array.isArray(intencao.destinos) && intencao.destinos.length >= 1 && intencao.destinos.length <= 3, `${nome}: de 1 a 3 destinos`);
  for (const destino of intencao.destinos ?? []) {
    if (destino.tipo === "aula") {
      const [trilha, aula] = destino.id.split("/");
      ok(fs.existsSync(path.join(RAIZ, "content/trilhas", trilha ?? "", `${aula}.md`)), `${nome}: a aula ${destino.id} não existe em content/trilhas`);
    } else if (destino.tipo === "trilha") {
      ok(fs.existsSync(path.join(RAIZ, "content/trilhas", destino.slug, "_trilha.md")), `${nome}: a trilha ${destino.slug} não existe`);
    } else if (destino.tipo === "ferramenta") {
      ok(existeFerramenta(destino.id), `${nome}: a ferramenta ${destino.id} não está em lib/areas.ts`);
    } else if (destino.tipo === "pagina") {
      const motivo = paginaLivre(destino.caminho);
      ok(!motivo, `${nome}: a página ${destino.caminho} ${motivo}`);
    } else ok(false, `${nome}: tipo de destino desconhecido (${destino.tipo})`);
  }
}
// Toda página e ferramenta usada como destino precisa de título nos textos (a caixa não mostra destino sem título).
for (const lang of ["pt", "en", "es", "fr", "ru", "zh"]) {
  const t = textosDaBusca(lang);
  for (const intencao of intencoes)
    for (const destino of intencao.destinos) {
      if (destino.tipo === "pagina") ok(Boolean(t.paginas[destino.caminho]), `${lang}: falta o título da página ${destino.caminho} em i18n/escola/busca`);
      if (destino.tipo === "ferramenta") ok(Boolean(t.ferramentas[destino.id]), `${lang}: falta o título da ferramenta ${destino.id} em i18n/escola/busca`);
    }
}

// ───────────── índice: Escola com a flag, modo seguro sempre ─────────────

const tb = textosDaBusca("pt");
const daEscola = entradasDaEscola("pt", tb);
ok(daEscola.some((e) => e.href === "/escola") && daEscola.some((e) => e.href === "/escola/caderneta"), "o índice da Escola tem a entrada e a caderneta");
ok(daEscola.at(-1).href === "/modo-seguro" && entradaDoModoSeguro(tb).href === "/modo-seguro", "o modo seguro entra no índice");
ok(daEscola.every((e) => e.kind === "pagina" && e.title && e.text), "toda entrada da Escola tem tipo página, título e texto");
igual(textosDaBusca("xx").melhor.titulo, tb.melhor.titulo, "idioma desconhecido cai no português");
const indice = fs.readFileSync(path.join(RAIZ, "lib/indice-de-busca.ts"), "utf8");
ok(/ligado\("escola"\)\s*\?\s*entradasDaEscola/.test(indice) && /entradaDoModoSeguro\(tb\)/.test(indice), "lib/indice-de-busca.ts: Escola só com a flag, modo seguro sempre");

// ───────────── Por onde andei ─────────────

const agora = Date.UTC(2026, 10, 3, 15, 0, 0);
const DIA = 86_400_000;
{
  const arm = memoria();
  ok(!historicoLigado(arm), "o histórico começa desligado");
  ok(!registrarVisita(arm, { caminho: "/trilhas/x/y", titulo: "Aula" }, { agora }), "desligado, não grava");
  igual(arm.chaves(), [], "desligado, nenhuma chave é criada");
  ligarHistorico(arm);
  ok(historicoLigado(arm) && arm.getItem(CHAVE_LIGADO) === "1", "ligar grava a marca");
  ok(registrarVisita(arm, { caminho: "/trilhas/x/y", titulo: "Aula Y" }, { agora }), "ligado, grava");
  ok(!registrarVisita(arm, { caminho: "/trilhas/x/z", titulo: "Aula Z" }, { agora, seguro: true }), "com o modo seguro, não grava");
  for (const caminho of ["/painel", "/painel/conversas", "/entrar", "/modo-seguro", "/por-onde-andei"]) ok(!registrarVisita(arm, { caminho, titulo: "x" }, { agora }) && !podeGuardar(caminho), `${caminho} nunca entra`);
  ok(podeGuardar("/painelzinho") && podeGuardar("/busca"), "só os caminhos exatos ficam de fora");
  igual(lerHistorico(arm, agora).map((v) => v.caminho), ["/trilhas/x/y"], "só a visita permitida ficou");
  registrarVisita(arm, { caminho: "/acervo", titulo: "Acervo" }, { agora: agora + 1000 });
  registrarVisita(arm, { caminho: "/trilhas/x/y", titulo: "Aula Y" }, { agora: agora + 2000 });
  igual(lerHistorico(arm, agora + 3000).map((v) => v.caminho), ["/trilhas/x/y", "/acervo"], "a mesma página sobe para o topo sem repetir");
  // 7 dias
  arm.setItem(CHAVE_HISTORICO, JSON.stringify([{ caminho: "/velha", titulo: "Velha", em: agora - 8 * DIA }, { caminho: "/semana", titulo: "Semana", em: agora - 3 * DIA }, { caminho: "/hoje", titulo: "Hoje", em: agora - 60_000 }]));
  igual(lerHistorico(arm, agora).map((v) => v.caminho), ["/hoje", "/semana"], "só os últimos 7 dias");
  const { hoje, semana } = agrupar(lerHistorico(arm, agora), agora);
  igual([hoje.map((v) => v.caminho), semana.map((v) => v.caminho)], [["/hoje"], ["/semana"]], "agrupa em Hoje e Esta semana");
  // 60 itens
  for (let i = 0; i < 75; i++) registrarVisita(arm, { caminho: `/p${i}`, titulo: `P${i}` }, { agora: agora + i });
  const lista = lerHistorico(arm, agora + 100);
  igual(lista.length, 60, "no máximo 60 itens");
  igual(lista[0].caminho, "/p74", "a mais nova primeiro");
  ok(JSON.parse(arm.getItem(CHAVE_HISTORICO)).length === 60, "o guardado também fica em 60");
  // forma errada
  arm.setItem(CHAVE_HISTORICO, "{quebrado");
  igual(lerHistorico(arm, agora), [], "forma errada vira lista vazia, sem erro");
  arm.setItem(CHAVE_HISTORICO, JSON.stringify([{ caminho: "sem-barra", titulo: "x", em: agora }, null, 3]));
  igual(lerHistorico(arm, agora), [], "itens sem forma de visita ficam de fora");
  // apagar e não guardar
  registrarVisita(arm, { caminho: "/a", titulo: "A" }, { agora });
  apagarHistorico(arm);
  ok(arm.getItem(CHAVE_HISTORICO) === null && historicoLigado(arm), "'Apagar tudo' apaga a lista e continua ligado");
  registrarVisita(arm, { caminho: "/a", titulo: "A" }, { agora });
  naoGuardarMais(arm);
  igual(arm.chaves(), [], "'Não guardar mais' desliga e apaga");
  ok(!registrarVisita(arm, { caminho: "/b", titulo: "B" }, { agora }), "depois de 'não guardar mais', não grava");
}
igual(semIdioma("/pt/busca", ["pt", "en"]), "/busca", "tira o idioma do caminho");
igual(semIdioma("/en", ["pt", "en"]), "/", "a inicial vira /");
igual(semIdioma("/pt/trilhas/x?q=segredo#y", ["pt"]), "/trilhas/x", "a consulta e a âncora nunca são guardadas");

// As chaves do histórico e o aviso da voz ficam fora da cópia, mas saem no "apagar" (lib/estudo.ts).
{
  const arm = memoria({ "lucia:historico": "[]", "lucia:historico-ligado": "1", "lucia:escola-privado:aviso-da-voz": "1" });
  const soApagar = chavesSoApagar(arm);
  for (const chave of arm.chaves()) {
    ok(!entraNaCopia(chave), `${chave} não entra na cópia de segurança`);
    ok(soApagar.includes(chave), `${chave} sai no 'apagar meus dados'`);
  }
  ok(fs.readFileSync(path.join(RAIZ, "components/busca/BuscaPorVoz.tsx"), "utf8").includes('"lucia:escola-privado:aviso-da-voz"'), "o aviso da voz usa a chave privada da Escola");
}

// ───────────── Modo seguro: só "lucia*" sai ─────────────

{
  const sessao = memoria();
  ok(!estaLigado(sessao), "o modo seguro começa desligado");
  ligarModoSeguro(sessao);
  ok(estaLigado(sessao) && sessao.getItem(CHAVE_SEGURO) === "1", "ligar marca 'lucia-seguro' no sessionStorage");
  desligarModoSeguro(sessao);
  ok(!estaLigado(sessao), "desligar tira a marca");
  ok(!estaLigado(null), "sem sessionStorage, desligado");

  const local = memoria({ "lucia:concluidas": "[]", "lucia:historico": "[]", "lucia-seguro": "1", "lucia:escola:matricula": "{}", "outro-site": "x", "tema": "escuro", "LUCIA:maiuscula": "x" });
  igual(chavesParaApagar(local).sort(), ["lucia-seguro", "lucia:concluidas", "lucia:escola:matricula", "lucia:historico"], "só as chaves que começam com 'lucia'");
  igual(apagarChaves(local), 4, "apaga as 4");
  igual(local.chaves().sort(), ["LUCIA:maiuscula", "outro-site", "tema"], "o que não é do site fica");

  igual(basesParaApagar(["lucia-busca", "lucia-sigilo", "lucia-explicacoes", "lucia-vozes", "lucia-voz-kokoro", "outra-base", "lucia-busca"]), ["lucia-busca", "lucia-sigilo", "lucia-explicacoes"], "bases: as 'lucia-*' que não são de voz, sem repetir");
  igual(cachesParaApagar(["lucia-paginas-v4", "lucia-fixos-v4", "lucia-vozes", "workbox-x"]), ["lucia-paginas-v4", "lucia-fixos-v4"], "caches: as páginas e arquivos do site saem; as vozes ficam");
  const sw = fs.readFileSync(path.join(RAIZ, "public/sw.js"), "utf8");
  for (const [, nome] of sw.matchAll(/const (?:PAGINAS|FIXOS) = `([^`$]+)\$\{VERSAO\}`/g)) ok(cachesParaApagar([`${nome}v9`]).length === 1, `o cache do service worker '${nome}*' sai na saída rápida`);
  ok(!/[?&](q|u|id|email)=[^&]*lucia/i.test(DESTINO_NEUTRO) && DESTINO_NEUTRO.startsWith("https://"), "o destino neutro é de fora e não leva nada da pessoa");

  let estado = tresEsc([], 1000);
  estado = tresEsc(estado.instantes, 1300);
  ok(!estado.sair, "duas vezes Esc não sai");
  estado = tresEsc(estado.instantes, 1900);
  ok(estado.sair, "três vezes Esc em 1 s sai");
  estado = tresEsc([1000, 1500], 2100);
  ok(!estado.sair, "três vezes Esc em mais de 1 s não sai");
}

if (falhas.length) {
  console.error(`Busca viva: ${falhas.length} falha(s) em ${conferidos} conferências:\n- ${falhas.join("\n- ")}`);
  process.exit(1);
}
console.log(`Busca viva: ${conferidos} conferências ok (${intencoes.length} intenções, todos os destinos existem).`);
