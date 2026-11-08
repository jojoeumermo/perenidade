// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere os cursos da Escola Revolucionária Lúcia Maria (E4-07, docs/escola/cursos.md) contra o que existe no repositório: cada aula
// existe, cada patrono está no Memorial (e o motivo é frase da própria ficha), cada obra está no Acervo (e o "porque" é
// frase da sinopse), a alternância tem prática em todo módulo de tempo trabalho, "em construção" nunca vira link, as
// horas e o progresso batem nos cursos reais, a leitura guiada é válida e guarda só no aparelho, o "Ano de formação
// política" é sensível e a busca recebe os cursos. Sem rede, sem navegador.
import fs from "node:fs";
import path from "node:path";
import { areaSlugs } from "../lib/areas.ts";
import { aulasDoCurso, horasDoCurso, horasFeitas, moduloDe, proximaDoCurso } from "../lib/escola/cursos.ts";
import { existeAula, existeMemorial, existeObra, lerCursosComErros, minutosDaAula } from "../lib/escola/cursos-servidor.ts";
import { OBJETIVOS } from "../lib/escola/estudante.ts";
import { cursoAberto } from "../lib/escola/site-aberto.ts";
import { entradasDaEscola, entradasDosCursos, textosDaBusca } from "../lib/escola/indice.ts";
import { apagarRespostas, CHAVE_DAS_LEITURAS, gravarResposta, lerRespostas, limpar, MAX_RESPOSTA, respondidas, validarLeitura } from "../lib/escola/leituras.ts";
import { parseFrontmatter } from "../lib/frontmatter.ts";

const raiz = path.resolve(import.meta.dirname, "..");
let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const corpo = (...partes) => parseFrontmatter(fs.readFileSync(path.join(raiz, ...partes), "utf8")).content.replace(/\*\*?/g, "").replace(/\s+/g, " ");

// ───────────── Os cursos ─────────────
const lidos = lerCursosComErros();
for (const l of lidos) conferir(`curso ${l.arquivo} válido`, l.erros.length === 0, l.erros.join("; "));
const cursos = lidos.filter((l) => l.curso).map((l) => l.curso);
conferir("de 13 a 19 cursos", cursos.length >= 13 && cursos.length <= 19, String(cursos.length));
const porSlug = new Map(cursos.map((c) => [c.slug, c]));
for (const ciclo of ["basico", "profissional", "avancado"]) conferir(`há curso no ciclo ${ciclo}`, cursos.some((c) => c.ciclo === ciclo));

// Palavras que a Escola não usa sobre si (fora a frase citada da ficha do Memorial, que fala da vida da pessoa).
const PROIBIDAS = /universidade|diploma|cr[ée]ditos?\b|bacharel|gradua[çc][ãa]o/i;
const minutos = new Map();
const min = (a) => {
  if (!minutos.has(a)) minutos.set(a, minutosDaAula(a));
  return minutos.get(a);
};

for (const c of cursos) {
  const aulas = aulasDoCurso(c);
  conferir(`${c.slug}: toda aula existe`, aulas.every(existeAula), aulas.filter((a) => !existeAula(a)).join(", "));
  conferir(`${c.slug}: área existe`, areaSlugs.includes(c.area), c.area);
  conferir(`${c.slug}: objetivos da matrícula`, c.objetivos.length > 0 && c.objetivos.every((o) => OBJETIVOS.includes(o)), c.objetivos.join());
  const textos = [c.titulo, c.resumo, c.objetivo, c.tarefaNoMundo, c.projetoFinal, ...c.modulos.flatMap((m) => [m.titulo, ...(m.pratica ?? [])]), ...(c.emConstrucao ?? []).flatMap((e) => [e.titulo, e.motivo])];
  conferir(`${c.slug}: não fala em universidade, diploma nem créditos`, textos.every((t) => !PROIBIDAS.test(t)), textos.find((t) => PROIBIDAS.test(t)));

  // Horas e semanas (3 horas por semana).
  const horas = horasDoCurso(c, min);
  conferir(`${c.slug}: tem horas`, horas > 0);
  conferir(`${c.slug}: semanas = horas / 3`, c.semanas === Math.max(1, Math.ceil(horas / 3)), `${c.semanas} semanas para ${horas} h`);
  // Progresso nos cursos reais: metade das aulas feita, a primeira trilha dispensada.
  const metade = aulas.slice(0, Math.floor(aulas.length / 2));
  const parcial = horasFeitas(c, metade, [], min);
  conferir(`${c.slug}: horas feitas entre 0 e o total`, parcial >= 0 && parcial <= horas, `${parcial} de ${horas}`);
  conferir(`${c.slug}: tudo feito = total`, horasFeitas(c, aulas, [], min) === horas);
  conferir(`${c.slug}: próxima depois da metade`, proximaDoCurso(c, metade, []) === aulas[metade.length]);
  conferir(`${c.slug}: acabou, sem próxima`, proximaDoCurso(c, aulas, []) === null);
  const primeiraTrilha = aulas[0].split("/")[0];
  conferir(`${c.slug}: dispensa conta como feita`, proximaDoCurso(c, [], [primeiraTrilha]) === (aulas.find((a) => !a.startsWith(`${primeiraTrilha}/`)) ?? null));
  conferir(`${c.slug}: módulo da última aula`, moduloDe(c, aulas.at(-1))?.indice === c.modulos.length - 1);

  // Patrono: existe no Memorial, ainda não confirmado, e o motivo é frase da ficha.
  if (c.patrono) {
    conferir(`${c.slug}: patrono no Memorial`, existeMemorial(c.patrono.memorial), c.patrono.memorial);
    conferir(`${c.slug}: patrono a confirmar`, c.patrono.confirmado === false);
    if (existeMemorial(c.patrono.memorial)) conferir(`${c.slug}: motivo tirado da ficha`, corpo("content", "memorial", `${c.patrono.memorial}.md`).includes(c.patrono.motivo), c.patrono.motivo);
  }

  // Biblioteca: cada obra no Acervo, na ordem 1, 2, 3..., e o "porque" é frase da sinopse da ficha.
  const leituras = c.leituras ?? [];
  conferir(`${c.slug}: ordem de leitura`, leituras.every((l, i) => l.ordem === i + 1));
  for (const l of leituras) {
    conferir(`${c.slug}: obra ${l.obra} no Acervo`, existeObra(l.obra));
    if (existeObra(l.obra)) conferir(`${c.slug}: porquê de ${l.obra} tirado da ficha`, corpo("content", "acervo", `${l.obra}.md`).includes(l.porque), l.porque);
  }

  // Alternância: todo módulo é tempo escola (aulas) + tempo trabalho (2 ou 3 tarefas).
  if (c.formato === "alternancia") for (const [i, m] of c.modulos.entries()) conferir(`${c.slug}: módulo ${i + 1} com tempo trabalho`, Array.isArray(m.pratica) && m.pratica.length >= 2 && m.pratica.length <= 3, String(m.pratica?.length));

  // "Em construção" nunca é link nem aponta para aula.
  for (const e of c.emConstrucao ?? []) {
    const junto = `${e.titulo} ${e.motivo}`;
    conferir(`${c.slug}: em construção sem link`, !/https?:|\]\(|<a\b|\/trilhas\/|^[a-z0-9-]+\/[a-z0-9-]+$/.test(junto) && !existeAula(e.titulo), junto);
  }
}

// O que a especificação pede de cada curso.
const formacao = porSlug.get("ano-de-formacao-politica");
conferir("Ano de formação política existe", Boolean(formacao));
conferir("Ano de formação política é sensível", formacao?.sensivel === true);
conferir("Ano de formação política tem a leitura do Manifesto", formacao?.leituras?.some((l) => l.obra === "manifesto-do-partido-comunista"));
conferir("Ano de formação política em dois semestres", formacao?.modulos.some((m) => m.titulo.startsWith("1º semestre")) && formacao?.modulos.some((m) => m.titulo.startsWith("2º semestre")));
conferir("Aprender a estudar sem requisitos e em percurso", porSlug.get("aprender-a-estudar")?.requisitos.length === 0 && porSlug.get("aprender-a-estudar")?.formato === "percurso");
conferir("ENEM pede Português e Matemática antes", ["portugues-ler-e-escrever-melhor", "matematica-para-a-vida"].every((r) => porSlug.get("enem")?.requisitos.includes(r)));
conferir("EJA com ENCCEJA em construção", porSlug.get("eja-de-ponta-a-ponta")?.emConstrucao?.some((e) => /ENCCEJA/.test(e.titulo)));
conferir("Eletricista em alternância", porSlug.get("eletricista-residencial")?.formato === "alternancia");
const eletrico = porSlug.get("eletricista-residencial")?.modulos.flatMap((m) => m.pratica ?? []).join(" ") ?? "";
conferir("Eletricista: prática sem mexer em instalação ligada", /sem tocar em fios/.test(eletrico) && /sem energia/.test(eletrico) && !/troque o disjuntor|abra o quadro|ligue os fios/i.test(eletrico));
for (const slug of ["trancas", "barbearia"]) conferir(`${slug}: prática repete a higiene das aulas`, /lav|higiene|lâmina nova/i.test(porSlug.get(slug)?.modulos.flatMap((m) => m.pratica ?? []).join(" ") ?? ""));
conferir("curso sensível guardado no grupo certo (o vínculo revela opinião política)", cursos.filter((c) => c.sensivel).every((c) => ["ano-de-formacao-politica", "historia-do-brasil-e-das-lutas-do-povo"].includes(c.slug)));

// ───────────── Leitura guiada ─────────────
const pastaLeituras = path.join(raiz, "content", "escola", "leituras");
const arquivos = fs.readdirSync(pastaLeituras).filter((n) => n.endsWith(".json"));
conferir("só a leitura do Manifesto", arquivos.join() === "manifesto-do-partido-comunista.json", arquivos.join());
for (const nome of arquivos) {
  const l = JSON.parse(fs.readFileSync(path.join(pastaLeituras, nome), "utf8"));
  const erros = validarLeitura(l, existeObra);
  conferir(`leitura ${nome} válida`, erros.length === 0, erros.join("; "));
  conferir(`leitura ${nome}: nome é a obra`, `${l.obra}.json` === nome);
  conferir(`leitura ${nome}: em revisão`, l.revisao === "em-revisao");
  // Não reproduz o texto: cada trecho de referência é curto (onde ler), sem citação longa entre aspas.
  conferir(`leitura ${nome}: referência sem copiar o texto`, l.secoes.every((s) => s.referencia.length <= 220 && !/"[^"]{40,}"/.test(s.referencia)));
}
conferir("Pedagogia do Oprimido fica fora (direitos reservados)", !arquivos.includes("pedagogia-do-oprimido.json"));
conferir("leitura inválida é recusada", validarLeitura({ obra: "nao-existe", titulo: "", revisao: "x", secoes: [] }, existeObra).length >= 3);

class Memoria {
  constructor() {
    this.d = {};
  }
  getItem(k) {
    return k in this.d ? this.d[k] : null;
  }
  setItem(k, v) {
    this.d[k] = String(v);
  }
  removeItem(k) {
    delete this.d[k];
  }
}
globalThis.localStorage = new Memoria();
let eventos = 0;
globalThis.dispatchEvent = () => {
  eventos++;
  return true;
};
conferir("sem nada guardado", Object.keys(lerRespostas("manifesto-do-partido-comunista")).length === 0);
conferir("grava a resposta", gravarResposta("manifesto-do-partido-comunista", "introducao", 1, "Os poderosos da Europa."));
conferir("lê a resposta no lugar certo", lerRespostas("manifesto-do-partido-comunista").introducao?.[1] === "Os poderosos da Europa." && lerRespostas("manifesto-do-partido-comunista").introducao?.[0] === "");
conferir("guarda só na chave da Escola", Object.keys(localStorage.d).join() === CHAVE_DAS_LEITURAS && CHAVE_DAS_LEITURAS === "lucia:escola:leituras");
conferir("avisa o estudo", eventos > 0);
conferir("corta resposta longa", gravarResposta("manifesto-do-partido-comunista", "introducao", 0, "x".repeat(MAX_RESPOSTA + 50)) && lerRespostas("manifesto-do-partido-comunista").introducao[0].length === MAX_RESPOSTA);
const manifesto = JSON.parse(fs.readFileSync(path.join(pastaLeituras, "manifesto-do-partido-comunista.json"), "utf8"));
conferir("conta as respondidas", respondidas(manifesto, lerRespostas("manifesto-do-partido-comunista")) === 2);
conferir("resposta vazia apaga", gravarResposta("manifesto-do-partido-comunista", "introducao", 1, "  ") && lerRespostas("manifesto-do-partido-comunista").introducao.length === 1);
conferir("recusa obra ou seção estranha", !gravarResposta("../x", "introducao", 0, "a") && !gravarResposta("manifesto-do-partido-comunista", "a b", 0, "a") && !gravarResposta("manifesto-do-partido-comunista", "introducao", -1, "a"));
conferir("apaga as respostas da obra", apagarRespostas("manifesto-do-partido-comunista") && localStorage.getItem(CHAVE_DAS_LEITURAS) === null);
localStorage.setItem(CHAVE_DAS_LEITURAS, "{estragado");
conferir("guardado estragado vira vazio", Object.keys(lerRespostas("manifesto-do-partido-comunista")).length === 0);
conferir("limpa o que não tem forma", JSON.stringify(limpar({ "Obra Ruim": {}, ok: { s: ["a", 3], "x y": ["b"] }, lista: [] })) === JSON.stringify({ ok: { s: ["a", ""] } }));
globalThis.localStorage = {
  getItem: () => {
    throw new Error("bloqueado");
  },
  setItem: () => {
    throw new Error("bloqueado");
  },
  removeItem: () => {},
};
conferir("sem armazenamento, não quebra", Object.keys(lerRespostas("manifesto-do-partido-comunista")).length === 0 && gravarResposta("manifesto-do-partido-comunista", "introducao", 0, "a") === false);

// ───────────── Busca ─────────────
const doscursos = entradasDosCursos("pt");
const abertos = cursos.filter((c) => cursoAberto(c.slug));
conferir("um item de busca por curso aberto (os da Formação ficam fora, F7)", abertos.length < cursos.length && doscursos.length === abertos.length && !doscursos.some((e) => e.href === "/cursos/ano-de-formacao-politica") && doscursos.every((e) => e.kind === "pagina" && e.href.startsWith("/cursos/") && e.title && e.text && e.area));
const escola = entradasDaEscola("en", textosDaBusca("en"));
conferir("cursos na busca da Escola, modo seguro por último", escola.some((e) => e.href === "/cursos/aprender-a-estudar") && escola.at(-1).href === "/modo-seguro");
conferir("contexto da busca no idioma", entradasDosCursos("en")[0]?.context === "School course");

// ───────────── Páginas e textos ─────────────
const existe = (...p) => fs.existsSync(path.join(raiz, ...p));
for (const p of [
  // F7 (prancha Mapa): os cursos voltaram ao site aberto, em /cursos.
  ["app", "[lang]", "cursos", "page.tsx"],
  ["app", "[lang]", "cursos", "[curso]", "page.tsx"],
  ["app", "[lang]", "cursos", "[curso]", "zine", "page.tsx"],
  ["app", "[lang]", "escola", "leituras", "[obra]", "page.tsx"],
])
  conferir(`página ${p.slice(1).join("/")}`, existe(...p));
conferir("os cursos saíram de /escola", !existe("app", "[lang]", "escola", "cursos"));
const catalogo = fs.readFileSync(path.join(raiz, "app", "[lang]", "cursos", "page.tsx"), "utf8");
conferir("o catálogo aberto deixa o Ano de formação política para a Formação", /filter\(\(c\) => cursoAberto\(c\.slug\)\)/.test(catalogo) && !cursoAberto("ano-de-formacao-politica") && cursoAberto("costura"));
conferir("o mapa do site leva os cursos abertos", /cursoAberto\(curso\.slug\)/.test(fs.readFileSync(path.join(raiz, "app", "sitemap.ts"), "utf8")));
conferir("o Ano de formação política existe (senão o filtro não faz sentido)", cursos.some((c) => c.slug === "ano-de-formacao-politica"));
conferir("o catálogo não é mais a página provisória", !/EmConstrucao/.test(catalogo));
const paginaDoCurso = fs.readFileSync(path.join(raiz, "app", "[lang]", "cursos", "[curso]", "page.tsx"), "utf8");
conferir("em construção sai sem link na página do curso", /emConstrucao\.map\(\(e\) => \(\s*<li[^>]*>\s*<span lang="pt">\{e\.titulo\}<\/span>/.test(paginaDoCurso));
const aula = fs.readFileSync(path.join(raiz, "app", "[lang]", "trilhas", "[track]", "[lesson]", "page.tsx"), "utf8");
conferir("faixa do curso logo acima do botão de concluir", /<FaixaDoCurso[\s\S]{0,400}?\/>\s*\)\}\s*<CompleteButton/.test(aula));
conferir("sem curso, o próximo passo da trilha fica como era", /cursosDestaAula\.length === 0 && <ProximoPasso/.test(aula));

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];
// "_rascunho" marca a tradução de máquina ainda não revisada: fica fora da comparação de chaves.
const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (k === "_rascunho" ? [] : v && typeof v === "object" && !Array.isArray(v) ? chaves(v, `${p}${k}.`) : [`${p}${k}`]));
const pt = JSON.parse(fs.readFileSync(path.join(raiz, "i18n", "escola", "cursos", "pt.json"), "utf8"));
for (const lang of IDIOMAS) {
  const d = JSON.parse(fs.readFileSync(path.join(raiz, "i18n", "escola", "cursos", `${lang}.json`), "utf8"));
  conferir(`textos dos cursos em ${lang}: mesmas chaves`, chaves(d).sort().join() === chaves(pt).sort().join());
}

console.log(`escola-cursos: ${cursos.length} cursos, ${ok} conferências certas, ${falhas.length} falhas`);
for (const c of cursos) console.log(`  ${c.slug}: ${aulasDoCurso(c).length} aulas, ${horasDoCurso(c, min)} h, ${c.semanas} semanas${c.patrono ? `, patrono ${c.patrono.memorial}` : ""}${c.sensivel ? ", sensível" : ""}`);
if (falhas.length) {
  console.error(falhas.map((f) => `- ${f}`).join("\n"));
  process.exit(1);
}
