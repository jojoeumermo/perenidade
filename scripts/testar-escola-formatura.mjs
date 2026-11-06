// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o projeto final, a formatura e a caderneta da Escola Revolucionária Lúcia Maria (E4-14, docs/escola/formatura.md): o
// comprovante do modo turma que vira registro SEM o nome, remover e editar na caderneta, o texto exportado, o projeto em
// seis etapas, o critério de formatura, formar, o texto do Mural, a memória de formatura, o texto da Gaveta, as
// promessas no código e os textos nos 6 idiomas. Sem rede, sem navegador, localStorage simulado.
import fs from "node:fs";
import path from "node:path";
import { carregarCursos } from "../lib/escola/cursos-servidor.ts";
import {
  editarRegistro,
  ordenarCaderneta,
  registroEditavel,
  removerRegistro,
  resumoDaCaderneta,
  textoDaCaderneta,
} from "../lib/escola/caderneta.ts";
import {
  CHAVES_DA_ESCOLA,
  MAX_CADERNETA,
  MAX_DETALHE,
  MAX_TITULO,
  acrescentarNaCaderneta,
  inscrever,
  lerCaderneta,
  lerInscricoes,
  marcarDispensa,
  trancar,
} from "../lib/escola/estudante.ts";
import {
  CHAVE_DO_RASCUNHO_DO_MURAL,
  ETAPAS_DO_PROJETO,
  REGRAS_DA_FORMATURA,
  anuncioDoMural,
  apagarRascunhoDoMural,
  apresentacaoFeita,
  bancaDoCurso,
  criterioDeFormatura,
  cursoPodeAnunciar,
  formar,
  gravarEtapa,
  gravarRascunhoDoMural,
  gravarTemaENotas,
  lerProjetos,
  lerRascunhoDoMural,
  memoriaDeFormatura,
  registroDaFormatura,
  textoDaGaveta,
  textoDoPedidoDeMemoria,
  validarMemoria,
  validarProjetos,
} from "../lib/escola/formatura.ts";
import { registroDaBanca } from "../lib/escola/turma-do-curso.ts";
import { codificarSequencia, gerarComprovante, lerComprovante, lerComprovantes, registroDoComprovante, resumoDoComprovante } from "../lib/turma.ts";

const RAIZ = process.cwd();
let certos = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const ler = (...p) => fs.readFileSync(path.join(RAIZ, ...p), "utf8");
const json = (...p) => JSON.parse(ler(...p));

class Memoria {
  constructor() {
    this.d = {};
  }
  get length() {
    return Object.keys(this.d).length;
  }
  key(i) {
    return Object.keys(this.d)[i] ?? null;
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
let eventos = 0;
globalThis.addEventListener ??= () => {};
const despachar = globalThis.dispatchEvent;
globalThis.dispatchEvent = (e) => {
  if (e?.type === "lucia:estudo") eventos++;
  return despachar ? despachar.call(globalThis, e) : true;
};
const limpo = () => {
  globalThis.localStorage = new Memoria();
};
limpo();

const PROIBIDAS = /universidade|universidad|university|université|университет|大学|diploma|diplôme|диплом|文凭|学位/i;

// ───────────── Comprovante do modo turma ─────────────
const seq = { v: 1, titulo: "Turma de teste", aulas: ["historia/a1", "historia/a2", "historia/a3"] };
const comp = gerarComprovante(seq, new Set(["historia/a1", "historia/a3"]), "Maria da Silva", "2026-11-03");
const lido = lerComprovante(comp);
conferir("o comprovante é lido", lido && lido.n === "Maria da Silva" && lido.c.length === 2);
const reg = registroDoComprovante(lido);
conferir("registro do comprovante: tipo, data e id", reg && reg.tipo === "turma" && reg.data === lido.d && reg.id === `turma-${lido.s}-${lido.d}`, JSON.stringify(reg));
conferir("o detalhe diz 2 de 3 aulas", reg.detalhe.includes("2 de 3 aulas"), reg.detalhe);
conferir("o registro NÃO tem o nome do comprovante", !JSON.stringify(reg).includes("Maria") && !JSON.stringify(reg).includes("Silva"));
conferir("título e detalhe cabem nos limites", reg.titulo.length <= MAX_TITULO && reg.detalhe.length <= MAX_DETALHE);
conferir("o apelido da turma vira título", registroDoComprovante(lido, "Turma da noite").titulo === "Turma: Turma da noite");
const vazioComp = lerComprovante(gerarComprovante(seq, new Set(), "Ana", "2026-11-03"));
conferir("comprovante sem aula feita não vira registro", registroDoComprovante(vazioComp) === null);
conferir("comprovante alterado na cópia é recusado antes", lerComprovante(comp.replace("-", "-x")) === null && lerComprovantes(comp.slice(0, -3)).lidos.length === 0);
const resumo = resumoDoComprovante(lido);
conferir("resumo do comprovante", resumo.feitas === 2 && resumo.total === 3 && resumo.completo === false && resumo.codigo === lido.s && resumo.dia === "2026-11-03");
conferir("sequência completa", resumoDoComprovante(lerComprovante(gerarComprovante(seq, new Set(seq.aulas), "", "2026-11-03"))).completo === true);
conferir("codificarSequencia continua igual", codificarSequencia(seq).startsWith("t="));

// importar duas vezes deixa um só
limpo();
acrescentarNaCaderneta(reg);
acrescentarNaCaderneta(registroDoComprovante(lido));
conferir("importar o mesmo comprovante duas vezes deixa um só registro", lerCaderneta().length === 1);

// ───────────── Caderneta ─────────────
limpo();
const a = acrescentarNaCaderneta({ tipo: "outro", data: "2026-10-01", titulo: "Pintei a sala", detalhe: "feito" });
const b = acrescentarNaCaderneta({ tipo: "saberes", curso: "costura", data: "2026-10-05", titulo: "Saberes", detalhe: "x", pessoas: ["Rosa Souza"] });
const c = acrescentarNaCaderneta({ tipo: "tarefa", data: "2026-10-05", titulo: "Tarefa", detalhe: "" });
const antes = eventos;
conferir("removerRegistro tira só o id certo e avisa", removerRegistro(a.id) && lerCaderneta().length === 2 && lerCaderneta().every((r) => r.id !== a.id) && eventos > antes);
conferir("remover id que não existe devolve false", removerRegistro("nao-existe") === false);
conferir("editar registro de saberes é recusado", editarRegistro(b.id, { titulo: "Novo", detalhe: "" }) === false && !registroEditavel(b));
conferir("editar tarefa troca título e detalhe e mantém o id", editarRegistro(c.id, { titulo: "Tarefa nova", detalhe: "mais" }) && lerCaderneta().find((r) => r.id === c.id).titulo === "Tarefa nova");
conferir("editar com título vazio é recusado", editarRegistro(c.id, { titulo: "  ", detalhe: "" }) === false);
acrescentarNaCaderneta({ id: "formatura-x", tipo: "outro", curso: "x", data: "2026-10-09", titulo: "Formatura: X", detalhe: "" });
conferir("registro de formatura não se edita", editarRegistro("formatura-x", { titulo: "Outro", detalhe: "" }) === false);
conferir("ordenação: data decrescente e, no empate, o último a entrar primeiro", ordenarCaderneta(lerCaderneta()).map((r) => r.id).join() === ["formatura-x", c.id, b.id].join());
globalThis.localStorage.setItem(CHAVES_DA_ESCOLA.caderneta, "{isso não é json");
conferir("lista corrompida não lança", lerCaderneta().length === 0 && removerRegistro("a") === false && editarRegistro("a", { titulo: "t", detalhe: "" }) === false);
globalThis.localStorage = { getItem() { throw new Error("bloqueado"); }, setItem() { throw new Error("bloqueado"); }, removeItem() { throw new Error("bloqueado"); }, length: 0, key: () => null };
conferir("armazenamento bloqueado não lança e devolve false", lerCaderneta().length === 0 && removerRegistro("a") === false && gravarEtapa("costura", "plano", "2026-11-01") === false && gravarRascunhoDoMural({ curso: "costura", oficio: "x", descricao: "" }) === false);
delete globalThis.localStorage;
conferir("sem localStorage: escrita devolve false", gravarEtapa("costura", "plano", "2026-11-01") === false && acrescentarNaCaderneta({ tipo: "outro", data: "2026-11-01", titulo: "t", detalhe: "" }) !== undefined);
limpo();
for (let i = 0; i < MAX_CADERNETA + 5; i++) acrescentarNaCaderneta({ id: `r${i}`, tipo: "outro", data: "2026-11-01", titulo: `t${i}`, detalhe: "" });
conferir("o limite de 500 continua valendo", lerCaderneta().length === MAX_CADERNETA);

// ───────────── Texto da caderneta ─────────────
const ptJson = json("i18n", "escola", "formatura", "pt.json");
const rotulos = {
  secoes: ptJson.caderneta.secoes,
  estudante: ptJson.exportar.estudante,
  titulo: ptJson.exportar.tituloDaFolha,
  matricula: ptJson.exportar.matriculaRotulo,
  data: ptJson.exportar.dataRotulo,
  quemAvaliou: ptJson.exportar.quemAvaliou,
  curso: ptJson.caderneta.curso,
  naoEhDocumento: ptJson.comum.naoEhDocumento,
  vazio: ptJson.exportar.folhaVazia,
};
const regs = [
  { id: "o1", tipo: "outro", data: "2026-10-01", titulo: "Outro", detalhe: "" },
  { id: "t1", tipo: "turma", data: "2026-10-02", titulo: "Turma", detalhe: "" },
  { id: "b1", tipo: "banca", curso: "costura", data: "2026-10-03", titulo: "Projeto apresentado em banca", detalhe: "ok", pessoas: ["Rosa Souza"] },
  { id: "s1", tipo: "saberes", data: "2026-10-04", titulo: "Saberes", detalhe: "" },
  { id: "formatura-costura", tipo: "outro", curso: "costura", data: "2026-10-05", titulo: "Formatura: Costura", detalhe: "" },
  { id: "k1", tipo: "caso", data: "2026-10-06", titulo: "Caso", detalhe: "" },
];
const base = { rotulos, dia: "2026-11-03", matricula: "LM-AAAA-BBBB", apelido: "Rosa" };
const txt = textoDaCaderneta(regs, base);
const ordem = ["FORMATURAS", "SABERES RECONHECIDOS", "PROJETOS EM BANCA", "TURMAS", "TAREFAS E CASOS", "OUTROS"].map((t) => txt.indexOf(t));
conferir("seções na ordem fixa", ordem.every((n, i) => n >= 0 && (i === 0 || n > ordem[i - 1])), ordem.join());
conferir("nomes de terceiros ausentes por padrão", !txt.includes("Rosa Souza"));
conferir("nomes de terceiros só com a opção", textoDaCaderneta(regs, { ...base, incluirNomesDeTerceiros: true }).includes("Rosa Souza"));
conferir("matrícula só com a opção", !txt.includes("LM-AAAA-BBBB") && textoDaCaderneta(regs, { ...base, incluirMatricula: true }).includes("LM-AAAA-BBBB"));
conferir("cabeçalho: apelido, ou Estudante", txt.includes("Rosa") && textoDaCaderneta(regs, { ...base, apelido: undefined }).includes(rotulos.estudante));
limpo();
const comNome = textoDaCaderneta(regs, { ...base, nomeNaFolha: "Rosa Maria da Silva" });
conferir("o nome na folha aparece, mas não é gravado em chave nenhuma", comNome.includes("Rosa Maria da Silva") && globalThis.localStorage.length === 0);
conferir("só os ids escolhidos saem", !textoDaCaderneta(regs, { ...base, ids: ["o1"] }).includes("Saberes"));
conferir("o texto termina com o aviso fixo e não diz universidade nem diploma", txt.trimEnd().endsWith(rotulos.naoEhDocumento) && !PROIBIDAS.test(txt));
for (const lang of ["pt", "en", "es", "fr", "ru", "zh"]) {
  const aviso = json("i18n", "escola", "formatura", `${lang}.json`).comum.naoEhDocumento;
  conferir(`aviso naoEhDocumento em ${lang}`, typeof aviso === "string" && aviso.includes("ENCCEJA"));
}
const insc = [{ curso: "costura", entrouEm: "2026-02-01", semestre: "2026.1", dispensas: [], formadoEm: "2026-10-05" }];
const res = resumoDaCaderneta(regs, insc, [{ slug: "costura", titulo: "Costura", horasFeitas: 10, horasTotais: 20 }, { slug: "outro", titulo: "Outro", horasFeitas: 5, horasTotais: 5 }]);
conferir("resumo da caderneta: total, por seção e horas só dos cursos inscritos", res.total === 6 && res.porSecao.formatura === 1 && res.porSecao.tarefaECaso === 1 && res.horasFeitas === 10 && res.cursos.length === 1 && res.cursos[0].formado);

// ───────────── Projeto ─────────────
limpo();
const v = validarProjetos({
  versao: 1,
  cursos: {
    costura: { tema: "x".repeat(300), etapas: { plano: "2026-10-01", rascunho: "2026-13", inventada: "2026-10-01" }, notas: "n".repeat(3000) },
    "Slug Errado": { etapas: {} },
    "../x": { etapas: {} },
  },
});
conferir("validarProjetos descarta slug inválido, data inválida e etapa desconhecida", Object.keys(v.cursos).join() === "costura" && Object.keys(v.cursos.costura.etapas).join() === "plano");
conferir("validarProjetos corta o tema em 120 e as notas em 2000", v.cursos.costura.tema.length === 120 && v.cursos.costura.notas.length === 2000);
conferir("validarProjetos nunca lança", [null, 5, "x", [], { cursos: 3 }, { cursos: [] }].every((d) => Object.keys(validarProjetos(d).cursos).length === 0));
conferir("máximo de 40 cursos", Object.keys(validarProjetos({ cursos: Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`c${i}`, { etapas: {} }])) }).cursos).length === 40);
conferir("gravarEtapa grava e limpa com null", gravarEtapa("costura", "plano", "2026-10-01") && lerProjetos().cursos.costura.etapas.plano === "2026-10-01" && gravarEtapa("costura", "plano", null) && !lerProjetos().cursos.costura.etapas.plano);
conferir("gravarEtapa recusa etapa, data e curso inválidos", !gravarEtapa("costura", "x", "2026-10-01") && !gravarEtapa("costura", "plano", "ontem") && !gravarEtapa("Costura Ruim", "plano", "2026-10-01"));
conferir("gravarTemaENotas", gravarTemaENotas("costura", "Bolsa de retalhos", "minhas notas") && lerProjetos().cursos.costura.tema === "Bolsa de retalhos");
conferir("as seis etapas fixas", ETAPAS_DO_PROJETO.join() === "tema,plano,rascunho,revisao,apresentacao,entrega");
const cheia = { setItem() { throw new Error("cheio"); }, getItem: () => null, removeItem() {}, length: 0, key: () => null };
globalThis.localStorage = cheia;
conferir("armazenamento cheio devolve false sem quebrar", gravarEtapa("costura", "plano", "2026-10-01") === false);
limpo();

// banca
const bancaPronta = registroDaBanca(
  { curso: "costura", data: "2026-11-02", devolutiva: { clareza: "Bem explicado." }, pessoas: ["Rosa"] },
  { clareza: "Clareza", curso: "Curso", vida: "Vida", proximo: "Próximo" },
  "Projeto apresentado em banca",
);
const cadBanca = [{ id: "b", ...bancaPronta }];
conferir("bancaDoCurso reconhece o registro da BancaPopular", bancaDoCurso(cadBanca, "costura")?.data === "2026-11-02" && bancaDoCurso(cadBanca, "trancas") === null);
conferir("apresentacaoFeita só vale para o curso certo", apresentacaoFeita({ versao: 1, cursos: {} }, cadBanca, "costura").feita && apresentacaoFeita({ versao: 1, cursos: {} }, cadBanca, "costura").pelaBanca && !apresentacaoFeita({ versao: 1, cursos: {} }, cadBanca, "trancas").feita);
conferir("apresentação marcada à mão também vale", apresentacaoFeita({ versao: 1, cursos: { trancas: { etapas: { apresentacao: "2026-11-01" } } } }, [], "trancas").feita);

// ───────────── Critério e formar ─────────────
const cursoT = { slug: "teste", modulos: [{ titulo: "m", aulas: ["trilha-a/a1", "trilha-a/a2", "trilha-b/b1"] }] };
const minutos = () => 30;
const projOk = { versao: 1, cursos: { teste: { etapas: { plano: "2026-10-01", rascunho: "2026-10-05", apresentacao: "2026-10-20" } } } };
const inscT = (extra = {}) => ({ curso: "teste", entrouEm: "2026-02-01", semestre: "2026.1", dispensas: [], ...extra });
const crit = (o) => criterioDeFormatura({ curso: cursoT, inscricao: inscT(), concluidas: ["trilha-a/a1", "trilha-a/a2", "trilha-b/b1"], projeto: projOk, caderneta: [], minutosDaAula: minutos, ...o });
const k0 = crit({});
conferir("tudo pronto = pode", k0.pode && k0.aulasOk && k0.projetoOk && k0.motivos.length === 0 && k0.aulasFeitas === 3 && k0.aulasTotais === 3);
conferir("horas estimadas (1,5 h) contam", k0.horasTotais === 1.5 && k0.horasFeitas === 1.5, `${k0.horasFeitas}/${k0.horasTotais}`);
const k1 = crit({ concluidas: ["trilha-a/a1"] });
conferir("aula faltando bloqueia e o motivo é código", !k1.pode && k1.motivos.includes("faltam2aulas"), k1.motivos.join());
const k2 = crit({ concluidas: ["trilha-a/a1", "trilha-a/a2"], inscricao: inscT({ dispensas: ["trilha-b"] }) });
conferir("trilha dispensada conta como feita", k2.pode && k2.aulasFeitas === 3);
conferir("dispensa casa com horasFeitas", k2.horasFeitas === 1.5, String(k2.horasFeitas));
const k3 = crit({ projeto: { versao: 1, cursos: { teste: { etapas: { plano: "2026-10-01", rascunho: "2026-10-05" } } } } });
conferir("projeto sem apresentação bloqueia", !k3.pode && k3.etapasFaltando.join() === "apresentacao" && k3.motivos.includes("faltaApresentacao"));
conferir("banca registrada conta como apresentação", crit({ projeto: { versao: 1, cursos: { teste: { etapas: { plano: "2026-10-01", rascunho: "2026-10-05" } } } }, caderneta: [{ id: "b", tipo: "banca", curso: "teste", data: "2026-10-30", titulo: "t", detalhe: "d" }] }).pode);
conferir("sem plano bloqueia", crit({ projeto: { versao: 1, cursos: {} } }).motivos.includes("faltaPlano"));
conferir("inscrição trancada bloqueia", !crit({ inscricao: inscT({ trancadoEm: "2026-10-01" }) }).pode && crit({ inscricao: inscT({ trancadoEm: "2026-10-01" }) }).motivos.includes("trancada"));
conferir("curso já formado não forma de novo", crit({ inscricao: inscT({ formadoEm: "2026-10-30" }) }).jaFormada && !crit({ inscricao: inscT({ formadoEm: "2026-10-30" }) }).pode);
conferir("sem inscrição não forma", !crit({ inscricao: null }).pode && crit({ inscricao: null }).motivos.includes("semInscricao"));
conferir("curso sem aulas não forma", !crit({ curso: { slug: "vazio", modulos: [] } }).pode && crit({ curso: { slug: "vazio", modulos: [] } }).motivos.includes("semAulas"));
conferir("não existe dispensar o projeto: etapas obrigatórias vêm do JSON", REGRAS_DA_FORMATURA.etapasObrigatorias.join() === "plano,rascunho,apresentacao" && REGRAS_DA_FORMATURA.confirmado === false);

// formar
limpo();
inscrever("teste", new Date("2026-02-10T12:00:00Z"));
let contagens = [];
const contar = (...args) => contagens.push(args);
const entradaFormar = { curso: cursoT, inscricao: lerInscricoes()[0], concluidas: ["trilha-a/a1"], projeto: projOk, caderneta: [], minutosDaAula: minutos, tituloDoCurso: "Curso de Teste", contar, agora: new Date("2026-11-03T15:00:00Z") };
const recusa = formar(entradaFormar);
conferir("formar recusa quando pode é falso e não grava nada", !recusa.ok && !lerInscricoes()[0].formadoEm && lerCaderneta().length === 0 && contagens.length === 0);
const feito = formar({ ...entradaFormar, concluidas: ["trilha-a/a1", "trilha-a/a2", "trilha-b/b1"] });
conferir("formar marca formadoEm", feito.ok && lerInscricoes()[0].formadoEm === "2026-11-03");
conferir("formar grava o registro formatura-<curso> uma única vez", lerCaderneta().filter((r) => r.id === "formatura-teste").length === 1 && lerCaderneta()[0].detalhe.includes("Horas estimadas: 1,5 h"), JSON.stringify(lerCaderneta()));
conferir("formar chama a contagem anônima uma vez, por semestre", contagens.length === 1 && contagens[0].join() === "escola_formatura,teste,semestre");
const segunda = formar({ ...entradaFormar, inscricao: lerInscricoes()[0], concluidas: ["trilha-a/a1", "trilha-a/a2", "trilha-b/b1"] });
conferir("formar de novo é recusado (já formada) e não duplica", !segunda.ok && lerCaderneta().length === 1 && contagens.length === 1);
conferir("formar sem backend (sem contar) não quebra", (() => { limpo(); inscrever("teste"); return formar({ ...entradaFormar, inscricao: lerInscricoes()[0], concluidas: ["trilha-a/a1", "trilha-a/a2", "trilha-b/b1"], contar: undefined }).ok; })());
conferir("o registro da formatura respeita os limites", registroDaFormatura("teste", "T".repeat(300), "2026-11-03", 1).titulo.length <= MAX_TITULO);
limpo();
inscrever("teste");
marcarDispensa("teste", "trilha-b");
trancar("teste");
conferir("estudante.ts continua igual: dispensa e trancar existem", lerInscricoes()[0].dispensas.join() === "trilha-b" && Boolean(lerInscricoes()[0].trancadoEm));

// ───────────── Cursos reais ─────────────
const cursos = carregarCursos();
const porSlug = new Map(cursos.map((x) => [x.slug, x]));
conferir("há cursos reais", cursos.length >= 10);
conferir("todo curso tem projetoFinal não vazio", cursos.every((x) => typeof x.projetoFinal === "string" && x.projetoFinal.trim().length > 10), cursos.filter((x) => !x.projetoFinal?.trim()).map((x) => x.slug).join());
const mapa = REGRAS_DA_FORMATURA.muralPorCurso;
conferir("todo slug do mapa do Mural existe e é do ciclo profissional", Object.keys(mapa).length > 0 && Object.keys(mapa).every((s) => porSlug.get(s)?.ciclo === "profissional"), Object.keys(mapa).filter((s) => porSlug.get(s)?.ciclo !== "profissional").join());
conferir("as categorias do mapa são do Mural", Object.values(mapa).every((c) => ["servico", "produto", "cooperativa", "arte", "iniciativa"].includes(c)));
conferir("eletricista-residencial não está no mapa", !("eletricista-residencial" in mapa) && !cursoPodeAnunciar("eletricista-residencial") && !cursoPodeAnunciar("curso-que-nao-existe") && cursoPodeAnunciar("costura"));
const sem = anuncioDoMural({ curso: "eletricista-residencial", tituloDoCurso: "Eletricista", oficio: "Eletricista", descricaoDaPessoa: "faço instalações" });
conferir("eletricista não gera anúncio", sem.ok === false && sem.motivo === "curso");
const an = anuncioDoMural({ curso: "costura", tituloDoCurso: "Costura", oficio: "Costureira", descricaoDaPessoa: "Ajustes, barras e consertos de roupa em geral." });
conferir("anúncio ok: categoria, título 4–160 e descrição 20–1200", an.ok && an.categoria === "servico" && an.titulo.length >= 4 && an.titulo.length <= 160 && an.descricao.length >= 20 && an.descricao.length <= 1200);
conferir("anúncio traz a frase de registro de estudo", an.descricao.includes("Estudei Costura na Escola Revolucionária Lúcia Maria, escola popular do Instituto Lúcia. É um registro de estudo, não uma certificação oficial."));
conferir("anúncio sem URL, telefone, certificado nem diploma", !/https?:|www\.|@|\d{8}/.test(an.descricao) && !/certificado|diploma|universidade/i.test(an.descricao + an.titulo));
conferir("anúncio recusa contato no texto da pessoa", anuncioDoMural({ curso: "costura", tituloDoCurso: "Costura", oficio: "Costureira", descricaoDaPessoa: "me chame no (21) 99999-8888" }).motivo === "contato" && anuncioDoMural({ curso: "costura", tituloDoCurso: "Costura", oficio: "Costureira", descricaoDaPessoa: "ana@exemplo.com" }).motivo === "contato");
conferir("ofício curto é recusado", anuncioDoMural({ curso: "costura", tituloDoCurso: "Costura", oficio: "ab", descricaoDaPessoa: "" }).motivo === "oficioCurto");
limpo();
conferir("o rascunho do Mural guarda só curso, ofício e descrição", gravarRascunhoDoMural({ curso: "costura", oficio: "Costureira", descricao: "Ajustes", contato: "21 99999-0000", cidade: "Rio" }) && Object.keys(lerRascunhoDoMural()).sort().join() === "curso,descricao,oficio" && !globalThis.localStorage.getItem(CHAVE_DO_RASCUNHO_DO_MURAL).includes("99999"));
conferir("rascunho com telefone ou e-mail não é guardado", gravarRascunhoDoMural({ curso: "costura", oficio: "Costureira", descricao: "ligue 21 99999-0000 ou a@b.com" }) && lerRascunhoDoMural().descricao === "" && lerRascunhoDoMural().oficio === "Costureira");
conferir("o rascunho fica na chave privada e se apaga", CHAVE_DO_RASCUNHO_DO_MURAL === "lucia:escola-privado:mural-rascunho" && apagarRascunhoDoMural() && lerRascunhoDoMural() === null);

// ───────────── Memória ─────────────
const item = (extra = {}) => ({ curso: "costura", semestre: "2026.2", apelido: "Rosa da Costura", frase: "Aprendi muito.", autorizacao: true, maiorDeIdade: true, ...extra });
const cursosMemoria = cursos.map((x) => ({ slug: x.slug, sensivel: x.sensivel }));
const memoriaReal = json("content", "escola", "memoria-de-formatura.json");
conferir("a memória real valida (e começa vazia)", validarMemoria(memoriaReal, cursosMemoria).ok && memoriaReal.length === 0);
const m = (lista) => validarMemoria(lista, cursosMemoria);
conferir("item correto passa", m([item()]).ok, m([item()]).erros.join());
conferir("sem autorizacao ou sem maiorDeIdade falha", !m([item({ autorizacao: false })]).ok && !m([item({ maiorDeIdade: undefined })]).ok);
conferir("curso inexistente falha", !m([item({ curso: "nao-existe" })]).ok);
const sensiveis = cursos.filter((x) => x.sensivel).map((x) => x.slug);
conferir("cursos sensíveis (formação política e história das lutas) falham", sensiveis.includes("ano-de-formacao-politica") && sensiveis.includes("historia-do-brasil-e-das-lutas-do-povo") && sensiveis.every((s) => !m([item({ curso: s })]).ok));
conferir("apelido com 3 palavras maiúsculas falha", !m([item({ apelido: "Maria Aparecida Souza" })]).ok && m([item({ apelido: "Maria da Costura" })]).ok);
conferir("apelido com e-mail, telefone ou @ falha", !m([item({ apelido: "ana@x.com" })]).ok && !m([item({ apelido: "21 99999 8888" })]).ok && !m([item({ apelido: "@ana" })]).ok);
conferir("apelido vazio, longo ou com espaço duplo falha", !m([item({ apelido: "" })]).ok && !m([item({ apelido: "a".repeat(41) })]).ok && !m([item({ apelido: "Rosa  Maria" })]).ok);
conferir("frase com URL ou e-mail falha, frase longa falha", !m([item({ frase: "veja https://x.com" })]).ok && !m([item({ frase: "ana@x.com" })]).ok && !m([item({ frase: "a".repeat(141) })]).ok);
conferir("apelido repetido no mesmo curso e semestre falha, em outro semestre passa", !m([item(), item()]).ok && m([item(), item({ semestre: "2026.1" })]).ok);
conferir("mais de 300 itens falha", !m(Array.from({ length: 301 }, (_, i) => item({ apelido: `Apelido ${String.fromCharCode(97 + (i % 26))}${i}` }))).ok);
conferir("a lista só vale inteira: um item ruim derruba", !m([item(), item({ apelido: "ana@x.com", semestre: "2026.1" })]).ok);
const grupos = memoriaDeFormatura([item(), item({ semestre: "2026.1", apelido: "Bia" }), item({ semestre: "2027.1", apelido: "Futuro" })], "2026-11-03");
conferir("memoriaDeFormatura agrupa do mais novo ao mais velho e esconde semestre futuro", grupos.map((g) => g.semestre).join() === "2026.2,2026.1");
const pedido = textoDoPedidoDeMemoria({ curso: "Costura", semestre: "2026.2", apelido: "Rosa", frase: "" });
conferir("o pedido de memória só diz o que a pessoa digitou", pedido.includes("curso Costura, semestre 2026.2, apelido Rosa") && pedido.includes("Tenho 18 anos ou mais") && !/@|https?:/.test(pedido));

// ───────────── Gaveta ─────────────
const gv = textoDaGaveta({ curso: "costura", tituloDoCurso: "Costura" });
const gavetaFonte = ler("lib", "gaveta.ts");
conferir("a Gaveta tem o tipo projeto e a licença sugerida", gv.tipo === "projeto" && gv.licenca === "CC BY-SA 4.0" && /tiposDeTrabalho = \[[^\]]*"projeto"/.test(gavetaFonte) && /licencasDaGaveta = \[[^\]]*"CC BY-SA 4.0"/.test(gavetaFonte));
conferir("o bloco da Gaveta traz o título e o lembrete", gv.titulo === "Projeto final: Costura" && gv.bloco.includes("Sem rosto, sem nome completo e sem documento de ninguém") && gv.lembrete.includes("Só publique o que é seu"));

// ───────────── Promessas no código ─────────────
const arquivosDoPacote = [
  "lib/escola/caderneta.ts",
  "lib/escola/formatura.ts",
  "lib/escola/formatura-servidor.ts",
  ...["caderneta", "formatura"].flatMap((p) => fs.readdirSync(path.join(RAIZ, "components", "escola", p)).map((f) => `components/escola/${p}/${f}`)),
  "app/[lang]/escola/caderneta/page.tsx",
  ...["", "projeto", "mural", "memoria", "registro"].map((p) => `app/[lang]/escola/formatura/${p ? `${p}/` : ""}page.tsx`),
];
conferir("todos os arquivos do pacote existem", arquivosDoPacote.every((f) => fs.existsSync(path.join(RAIZ, f))), arquivosDoPacote.filter((f) => !fs.existsSync(path.join(RAIZ, f))).join());
const fonte = (f) => ler(...f.split("/"));
const semRede = arquivosDoPacote.filter((f) => !/Cerimonia\.tsx$/.test(f)).filter((f) => /\bfetch\(|\brpc\(|@\/lib\/backend|@\/lib\/escola\/banco/.test(fonte(f)));
conferir("só a Cerimonia importa a contagem; nenhum arquivo tem fetch, rpc nem backend", semRede.length === 0, semRede.join());
conferir("Cerimonia só importa contarEscola do banco", /import \{ contarEscola \} from "@\/lib\/escola\/banco"/.test(fonte("components/escola/formatura/Cerimonia.tsx")) && !/\bfetch\(|\brpc\(|@\/lib\/backend/.test(fonte("components/escola/formatura/Cerimonia.tsx")));
conferir("lib/escola/caderneta.ts, formatura.ts e lib/turma.ts não usam @/", ["lib/escola/caderneta.ts", "lib/escola/formatura.ts", "lib/turma.ts"].every((f) => !/from "@\//.test(fonte(f))));
conferir("nenhum fs novo nos arquivos do pacote", arquivosDoPacote.every((f) => !/node:fs|readFileSync|from "fs"/.test(fonte(f))));
conferir("nenhuma página nova tem generateStaticParams", arquivosDoPacote.filter((f) => f.startsWith("app/")).every((f) => !fonte(f).includes("generateStaticParams")));
const chaves = new Set();
for (const f of arquivosDoPacote) for (const mm of fonte(f).matchAll(/["'`](lucia:[^"'`$]*)["'`]/g)) chaves.add(mm[1]);
conferir("nenhuma chave de storage fora de lucia:escola: e lucia:escola-privado:", [...chaves].every((c) => c.startsWith("lucia:escola:") || c.startsWith("lucia:escola-privado:") || c === "lucia:estudo"), [...chaves].join());
conferir("a chave privada nova está no código", fonte("lib/escola/formatura.ts").includes("PREFIXO_PRIVADO}mural-rascunho"));

// ───────────── Rotas ─────────────
const { ROTAS_DA_ESCOLA } = await import("../lib/escola/rotas.ts");
const rota = (c) => ROTAS_DA_ESCOLA.find((r) => r.caminho === c);
conferir("caderneta e formatura deixam de ser provisórias", rota("/escola/caderneta") && !rota("/escola/caderneta").provisoria && rota("/escola/formatura") && !rota("/escola/formatura").provisoria);

// ───────────── Textos nos 6 idiomas ─────────────
const achatar = (o, p = "", s = new Map()) => {
  if (Array.isArray(o)) o.forEach((x, i) => achatar(x, `${p}.${i}`, s));
  else if (o && typeof o === "object") Object.entries(o).forEach(([k, x]) => achatar(x, p ? `${p}.${k}` : k, s));
  else s.set(p, o);
  return s;
};
const refPt = achatar(ptJson);
for (const lang of ["en", "es", "fr", "ru", "zh"]) {
  const t = achatar(json("i18n", "escola", "formatura", `${lang}.json`));
  conferir(`${lang}: todas as chaves do português, sem vazio`, [...refPt.keys()].every((k) => typeof t.get(k) === "string" && t.get(k).trim()), [...refPt.keys()].filter((k) => !t.get(k)).slice(0, 5).join());
  conferir(`${lang}: placeholders iguais ao português`, [...refPt].every(([k, val]) => (String(val).match(/\{\w+\}/g) ?? []).sort().join() === (String(t.get(k)).match(/\{\w+\}/g) ?? []).sort().join()));
}
conferir("o texto do critério e do Mural dizem em revisão / A REVISAR", ptJson.comum.revisar.includes("A REVISAR PELA COORDENAÇÃO") && ptJson.comum.emRevisao === "em revisão" && /confirmar pela coordenação/.test(ptJson.formatura.criterioProposto));
conferir("o aviso de eletricista no texto", ptJson.mural.semAnuncio.includes("Procure um profissional habilitado"));
conferir("a página memoria importa JSON sem fs", /memoria-de-formatura\.json/.test(fonte("app/[lang]/escola/formatura/memoria/page.tsx")));

// ───────────── lib/turma.ts só acrescentou ─────────────
const turmaFonte = fonte("lib/turma.ts");
conferir("lib/turma.ts: funções antigas seguem exportadas", ["normalizarSequencia", "codificarSequencia", "lerSequencia", "codigoDaSequencia", "gerarComprovante", "lerComprovante", "lerComprovantes"].every((n) => new RegExp(`export (function|const) ${n}\\b`).test(turmaFonte)));

console.log(`escola-formatura: ${certos} conferências certas, ${falhas.length} falhas`);
if (falhas.length) {
  console.error(falhas.map((f) => `- ${f}`).join("\n"));
  process.exit(1);
}
