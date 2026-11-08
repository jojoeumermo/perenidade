// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere a vida real da Escola Revolucionária Lúcia Maria (E4-11, docs/escola/vida.md): tarefa no mundo, missões, vozes (locais e
// publicadas), trabalhadores que ensinam, mapa das lutas, estudo de caso, bloco "documento", textos nos 6 idiomas e a
// estrutura (nada de fs nem "@/" na lógica, nenhuma página com generateStaticParams, nada vai ao servidor). Sem rede,
// sem navegador: o armazenamento é simulado em memória.
import fs from "node:fs";
import path from "node:path";
import { FERIADOS } from "../lib/escola/calendario.ts";
import { existeAula, existeMemorial } from "../lib/escola/cursos-servidor.ts";
import { lerCaderneta, MAX_DETALHE, MAX_TITULO } from "../lib/escola/estudante.ts";
import { BASE_DOS_AUDIOS, SEGUNDOS_DE_GRAVACAO } from "../lib/escola/avaliacao.ts";
import { agrupadasPorMes, icsDaLuta, lutasDoAno, proximaLuta } from "../lib/escola/lutas.ts";
import { ROTAS_DA_ESCOLA } from "../lib/escola/rotas.ts";
import {
  apagarCaso,
  apagarVozLocal,
  BASE_DOS_AUDIOS_DA_VIDA,
  CHAVE_DAS_MISSOES,
  CHAVE_DAS_TAREFAS,
  CHAVE_DAS_VOZES,
  CHAVE_DO_CASO,
  chaveDoAudio,
  dadoPessoalEm,
  desmarcarMissao,
  desmarcarTarefa,
  errosDasMarcas,
  gravarCaso,
  gravarVozLocal,
  lerCaso,
  lerMissoes,
  lerTarefas,
  lerVozesLocais,
  linkDaMissao,
  marcarMissao,
  marcarTarefa,
  missoesFeitas,
  registrarCasoNaCaderneta,
  registrarTarefaNaCaderneta,
  tarefasFeitas,
  validarMissoes,
  validarTrabalhadoresQueEnsinam,
  validarVozesPublicas,
} from "../lib/escola/vida.ts";
import { INTERATIVOS, MODELOS_INTERATIVOS } from "../lib/interativos.ts";
import { lerDocumento } from "../lib/interativos-mais.ts";

const raiz = path.resolve(import.meta.dirname, "..");
let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
const json = (...p) => JSON.parse(ler(...p));

class Memoria {
  d = {};
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
class QueLanca {
  get length() {
    return 0;
  }
  key() {
    return null;
  }
  getItem() {
    throw new Error("bloqueado");
  }
  setItem() {
    throw new Error("cheio");
  }
  removeItem() {
    throw new Error("bloqueado");
  }
}
let avisos = 0;
globalThis.dispatchEvent = (e) => {
  if (e.type === "lucia:estudo") avisos++;
  return true;
};
const novaMemoria = () => (globalThis.localStorage = new Memoria());
const AGORA = new Date("2026-08-10T15:00:00Z");

// ───────────── Tarefa no mundo ─────────────
novaMemoria();
avisos = 0;
conferir("tarefa: marcar grava e avisa", marcarTarefa("barbearia", { nota: "Fiz com a minha tia." }, AGORA) && avisos === 1);
conferir("tarefa: entrada com data de Brasília e nota", lerTarefas().barbearia?.em === "2026-08-10" && lerTarefas().barbearia.nota === "Fiz com a minha tia." && lerTarefas().barbearia.feita === true);
const guardado = JSON.parse(globalThis.localStorage.getItem(CHAVE_DAS_TAREFAS));
conferir("tarefa: formato {versao:1, itens}", guardado.versao === 1 && Object.keys(guardado.itens).join() === "barbearia");
marcarTarefa("barbearia", {}, new Date("2026-09-01T12:00:00Z"));
conferir("tarefa: marcar duas vezes não duplica e mantém a data", Object.keys(lerTarefas()).length === 1 && lerTarefas().barbearia.em === "2026-08-10");
conferir("tarefa: nota acima de 500 recusada", marcarTarefa("costura", { nota: "x".repeat(501) }) === false && !lerTarefas().costura);
conferir("tarefa: nota de 500 aceita", marcarTarefa("costura", { nota: "x".repeat(500) }, AGORA) === true);
for (const ruim of ["", "Costura", "a b", "../x", "x".repeat(81)]) conferir(`tarefa: slug recusado (${JSON.stringify(ruim).slice(0, 12)})`, marcarTarefa(ruim) === false);
conferir("tarefa: tarefasFeitas devolve só curso e data", JSON.stringify(tarefasFeitas()) === JSON.stringify([{ curso: "barbearia", em: "2026-08-10" }, { curso: "costura", em: "2026-08-10" }]));
conferir("tarefa: desmarcar apaga a entrada", desmarcarTarefa("costura") && !lerTarefas().costura && Object.keys(lerTarefas()).length === 1);
desmarcarTarefa("barbearia");
conferir("tarefa: sem nada, a chave sai do aparelho", globalThis.localStorage.getItem(CHAVE_DAS_TAREFAS) === null);
const cheia = { versao: 1, itens: Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`curso-${i}`, { feita: true, em: "2026-08-10" }])) };
globalThis.localStorage.setItem(CHAVE_DAS_TAREFAS, JSON.stringify(cheia));
conferir("tarefa: lista com 41 cursos recusada", Object.keys(lerTarefas()).length === 0 && errosDasMarcas(cheia, 40).some((e) => /mais de 40/.test(e)));
conferir("tarefa: o 41º não entra pela escrita", (() => {
  const ok40 = { versao: 1, itens: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`curso-${i}`, { feita: true, em: "2026-08-10" }])) };
  globalThis.localStorage.setItem(CHAVE_DAS_TAREFAS, JSON.stringify(ok40));
  return marcarTarefa("curso-novo", {}, AGORA) === false && marcarTarefa("curso-3", { nota: "ok" }, AGORA) === true;
})());
conferir("tarefa: validação rejeita slug ruim e nota longa", errosDasMarcas({ versao: 1, itens: { "Ruim Slug": { feita: true, em: "2026-08-10" }, ok: { feita: true, em: "2026-08-10", nota: "x".repeat(501) } } }, 40).length === 2);
globalThis.localStorage.setItem(CHAVE_DAS_TAREFAS, "{estragado");
conferir("tarefa: JSON quebrado vira lista vazia sem erro", Object.keys(lerTarefas()).length === 0 && tarefasFeitas().length === 0);
globalThis.localStorage.setItem(CHAVE_DAS_TAREFAS, JSON.stringify({ versao: 2, itens: {} }));
conferir("tarefa: versão desconhecida vira lista vazia", Object.keys(lerTarefas()).length === 0);

globalThis.localStorage = new QueLanca();
let lancou = false;
let r;
try {
  r = [marcarTarefa("barbearia"), desmarcarTarefa("barbearia"), Object.keys(lerTarefas()).length, marcarMissao("x"), gravarVozLocal({ segundos: 5 }), gravarCaso("livre", ["a", "", "", "", ""])];
} catch {
  lancou = true;
}
conferir("armazenamento que lança erro não quebra e devolve false", !lancou && r[0] === false && r[2] === 0 && r[3] === false && r[4] === null && r[5] === false);
globalThis.localStorage = undefined;
conferir("sem localStorage nada quebra", marcarTarefa("barbearia") === false && lerTarefas() && Object.keys(lerTarefas()).length === 0);

// ───────────── Tarefa na caderneta ─────────────
novaMemoria();
conferir("caderneta: sem marcar não registra", registrarTarefaNaCaderneta("barbearia", "Barbearia", AGORA) === null);
marcarTarefa("barbearia", { nota: "Mostrei a rotina de higiene." }, AGORA);
const reg1 = registrarTarefaNaCaderneta("barbearia", "Barbearia", AGORA);
registrarTarefaNaCaderneta("barbearia", "Barbearia", AGORA);
conferir("caderneta: tipo tarefa, título e detalhe", reg1?.tipo === "tarefa" && reg1.titulo === "Tarefa no mundo: Barbearia" && reg1.detalhe === "Mostrei a rotina de higiene." && reg1.curso === "barbearia" && reg1.pessoas === undefined);
conferir("caderneta: registrar de novo não duplica", lerCaderneta().filter((x) => x.tipo === "tarefa").length === 1);
conferir("caderneta: título longo cortado", registrarTarefaNaCaderneta("barbearia", "x".repeat(400), AGORA)?.titulo.length === MAX_TITULO);

// ───────────── Missões ─────────────
const cursosDaEscola = fs.readdirSync(path.join(raiz, "content", "escola", "cursos")).filter((a) => a.endsWith(".json")).map((a) => a.replace(/\.json$/, ""));
const labsComPagina = fs.readdirSync(path.join(raiz, "app", "[lang]", "laboratorios"), { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(raiz, "app", "[lang]", "laboratorios", d.name, "page.tsx"))).map((d) => d.name);
const exerciciosDe = (perfil) => {
  const arq = path.join(raiz, "content", "laboratorios", `${perfil}.json`);
  return fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, "utf8")).map((e) => e.id) : [];
};
const conf = { cursoExiste: (s) => cursosDaEscola.includes(s), labExiste: (l) => labsComPagina.includes(l), exercicioExiste: (p, id) => exerciciosDe(p).includes(id) };
const missoes = json("content", "escola", "vida", "missoes.json").missoes;
conferir("missões: o arquivo curado passa", validarMissoes(missoes, conf).length === 0, validarMissoes(missoes, conf).join("; "));
conferir("missões: há missões e todas em revisão", missoes.length >= 6 && missoes.every((m) => m.revisao === true));
const m0 = missoes[0];
conferir("missões: id repetido falha", validarMissoes([m0, m0], conf).some((e) => /repetido/.test(e)));
conferir("missões: curso inexistente falha", validarMissoes([{ ...m0, curso: "nao-existe" }], conf).some((e) => /curso inexistente/.test(e)));
conferir("missões: laboratório sem página falha", validarMissoes([{ ...m0, lab: "nao-existe" }], conf).some((e) => /laboratório/.test(e)));
const ide = missoes.find((m) => m.exercicio);
conferir("missões: exercício ausente falha", validarMissoes([{ ...ide, exercicio: "sql-99-nada" }], conf).some((e) => /exercício ausente/.test(e)));
conferir("missões: sem revisao falha", validarMissoes([{ ...m0, revisao: false }], conf).some((e) => /revisao/.test(e)));
conferir("missões: texto vazio falha", validarMissoes([{ ...m0, situacao: " " }], conf).some((e) => /situacao/.test(e)));
conferir("missões: link da IDE no formato de IDEPagina", linkDaMissao({ lab: "ide", perfil: "sql", exercicio: "sql-01-select" }) === "/laboratorios/ide?p=sql&ex=sql-01-select" && linkDaMissao({ lab: "eletrica" }) === "/laboratorios/eletrica");
conferir("missões: só laboratórios que existem", missoes.every((m) => labsComPagina.includes(m.lab)));
novaMemoria();
avisos = 0;
marcarMissao("luz-tomada", { nota: "feito" }, AGORA);
conferir("missões: marcar e ler", lerMissoes()["luz-tomada"]?.em === "2026-08-10" && avisos === 1 && JSON.stringify(missoesFeitas()) === JSON.stringify([{ missao: "luz-tomada", em: "2026-08-10" }]));
desmarcarMissao("luz-tomada");
conferir("missões: desmarcar", Object.keys(lerMissoes()).length === 0 && globalThis.localStorage.getItem(CHAVE_DAS_MISSOES) === null);

// ───────────── Vozes locais ─────────────
novaMemoria();
const v1 = gravarVozLocal({ segundos: 90, titulo: "x".repeat(100), pergunta: "O que eu faço no meu trabalho?" }, AGORA);
conferir("vozes locais: grava, corta o título em 60", v1 && v1.titulo.length === 60 && v1.segundos === 90 && v1.criadaEm === "2026-08-10" && lerVozesLocais().length === 1);
conferir("vozes locais: acima de 120 s recusado", gravarVozLocal({ segundos: 121 }) === null && gravarVozLocal({ segundos: 120 }, AGORA) !== null);
conferir("vozes locais: zero e negativo recusados", gravarVozLocal({ segundos: 0 }) === null && gravarVozLocal({ segundos: -3 }) === null);
for (let i = lerVozesLocais().length; i < 10; i++) gravarVozLocal({ segundos: 10 }, AGORA);
conferir("vozes locais: no máximo 10", lerVozesLocais().length === 10 && gravarVozLocal({ segundos: 10 }, AGORA) === null);
conferir("vozes locais: apagar libera vaga", apagarVozLocal(v1.id) && lerVozesLocais().length === 9 && gravarVozLocal({ segundos: 10 }, AGORA) !== null);
conferir("vozes locais: a chave é privada", CHAVE_DAS_VOZES.startsWith("lucia:escola-privado:") && CHAVE_DO_CASO.startsWith("lucia:escola-privado:"));
for (const chave of [CHAVE_DAS_TAREFAS, CHAVE_DAS_MISSOES, CHAVE_DAS_VOZES, CHAVE_DO_CASO]) conferir(`chave com prefixo permitido: ${chave}`, /^lucia:escola(-privado)?:/.test(chave));
conferir("vozes locais: a base é a mesma do ExpliqueComSuasPalavras", BASE_DOS_AUDIOS_DA_VIDA === BASE_DOS_AUDIOS && chaveDoAudio("abc") === "voz:abc" && SEGUNDOS_DE_GRAVACAO === 120);
const audio = ler("components", "escola", "vida", "audio-local.ts");
conferir("audio-local: base lucia-explicacoes versão 1, loja audios, chaves voz:", /indexedDB\.open\(BASE_DOS_AUDIOS_DA_VIDA, 1\)/.test(audio) && /LOJA_DOS_AUDIOS/.test(audio) && /chaveDoAudio\(id\)/.test(audio));

// ───────────── Vozes publicadas ─────────────
const voz = { id: "voz-1", apelido: "Dona Cida", oficio: "costureira", arquivo: "/arquivos/vozes/dona-cida.webm", segundos: 100, transcricao: "Eu costuro há trinta anos e aprendi a conferir a medida duas vezes.", autorizacao: true, data: "2026-08-01", revisao: true };
const existe = (c) => c === "/arquivos/vozes/dona-cida.webm";
const publicadas = json("content", "escola", "vida", "vozes.json").vozes;
conferir("vozes públicas: lista vazia é válida", Array.isArray(publicadas) && validarVozesPublicas(publicadas, { arquivoExiste: existe }).length === 0);
conferir("vozes públicas: a lista do repositório passa (arquivos em public)", validarVozesPublicas(publicadas, { arquivoExiste: (c) => fs.existsSync(path.join(raiz, "public", c)) }).length === 0);
conferir("vozes públicas: item bom passa", validarVozesPublicas([voz], { arquivoExiste: existe }).length === 0, validarVozesPublicas([voz], { arquivoExiste: existe }).join("; "));
const falha = (item, rx) => validarVozesPublicas([item], { arquivoExiste: existe }).some((e) => rx.test(e));
conferir("vozes públicas: sem autorizacao falha", falha({ ...voz, autorizacao: false }, /autoriza/) && falha({ ...voz, autorizacao: undefined }, /autoriza/));
conferir("vozes públicas: sem transcrição falha", falha({ ...voz, transcricao: "" }, /transcri/));
conferir("vozes públicas: e-mail na transcrição falha", falha({ ...voz, transcricao: "Escreva para maria@exemplo.com" }, /e-mail/));
conferir("vozes públicas: telefone na transcrição falha", falha({ ...voz, transcricao: "Me ligue no (21) 98765-4321" }, /telefone/));
conferir("vozes públicas: CPF na transcrição falha", falha({ ...voz, transcricao: "Meu CPF é 123.456.789-09" }, /CPF/));
conferir("vozes públicas: http na transcrição falha", falha({ ...voz, transcricao: "Veja em http://exemplo.org" }, /internet/));
conferir("vozes públicas: texto comum não dá falso alarme", dadoPessoalEm("Trabalho há 30 anos, 8 horas por dia, com 12 colegas.").length === 0);
conferir("vozes públicas: arquivo que não existe falha", falha({ ...voz, arquivo: "/arquivos/vozes/outra.webm" }, /não existe/));
conferir("vozes públicas: arquivo fora de /arquivos/vozes falha", falha({ ...voz, arquivo: "/arquivos/outra/dona-cida.webm" }, /arquivo deve ser/) && falha({ ...voz, arquivo: "https://x.org/a.webm" }, /arquivo deve ser/) && falha({ ...voz, arquivo: "/arquivos/vozes/../a.webm" }, /arquivo/));
conferir("vozes públicas: acima de 120 s falha", falha({ ...voz, segundos: 121 }, /segundos/));
conferir("vozes públicas: apelido longo falha", falha({ ...voz, apelido: "x".repeat(41) }, /apelido/));

// ───────────── Trabalhadores que ensinam ─────────────
const ensinam = json("content", "escola", "vida", "trabalhadores-que-ensinam.json").itens;
const confE = { memorialExiste: existeMemorial, aulaExiste: existeAula };
conferir("trabalhadores: o arquivo curado passa", ensinam.length >= 3 && validarTrabalhadoresQueEnsinam(ensinam, confE).length === 0, validarTrabalhadoresQueEnsinam(ensinam, confE).join("; "));
conferir("trabalhadores: o nome é o do Memorial", ensinam.every((t) => new RegExp(`^nome:\\s*"${t.nome}"`, "m").test(ler("content", "memorial", `${t.memorial}.md`))));
const e0 = ensinam[0];
conferir("trabalhadores: pessoa fora do Memorial falha", validarTrabalhadoresQueEnsinam([{ ...e0, memorial: "nao-existe" }], confE).length > 0);
conferir("trabalhadores: aula inexistente falha", validarTrabalhadoresQueEnsinam([{ ...e0, aula: "nao/existe" }], confE).length > 0);
conferir("trabalhadores: fonte de fora falha", validarTrabalhadoresQueEnsinam([{ ...e0, fonte: "https://exemplo.org" }], confE).length > 0);
conferir("trabalhadores: sem revisao falha", validarTrabalhadoresQueEnsinam([{ ...e0, revisao: false }], confE).length > 0);
conferir("trabalhadores: lista vazia é válida", validarTrabalhadoresQueEnsinam([], confE).length === 0);

// ───────────── Mapa das lutas ─────────────
const nesteDia = json("content", "neste-dia.json").fatos;
const lutas = lutasDoAno(FERIADOS, nesteDia);
const feriadas = lutas.filter((l) => l.feriado);
conferir("lutas: as 8 datas de feriados.json entram, e só elas são feriado", FERIADOS.length === 8 && feriadas.length === 8 && FERIADOS.every((f) => feriadas.some((l) => l.dia === f.dia && l.nome === f.nome && l.fonte === f.fonte && l.aula === f.aula)));
conferir("lutas: cruza com neste-dia por MM-DD", feriadas.every((l) => l.fatos.length === nesteDia.filter((f) => f.dia === l.dia).length) && lutas.reduce((s, l) => s + l.fatos.length, 0) === nesteDia.length);
conferir("lutas: datas de memória são as que só têm fato", lutas.filter((l) => !l.feriado).every((l) => l.nome === null && l.fatos.length > 0 && !FERIADOS.some((f) => f.dia === l.dia)));
conferir("lutas: ordem de calendário e meses de 1 a 12", lutas.every((l, i) => i === 0 || lutas[i - 1].dia < l.dia) && agrupadasPorMes(lutas).every((g) => g.mes >= 1 && g.mes <= 12 && g.lutas.every((l) => Number(l.dia.slice(0, 2)) === g.mes)));
conferir("lutas: toda fonte e todo link são https", lutas.every((l) => (!l.fonte || l.fonte.startsWith("https://")) && l.fatos.every((f) => f.link.startsWith("https://"))));
conferir("lutas: nada de dado inventado: todo feriado tem fonte", feriadas.every((l) => l.fonte));
const eldorado = lutas.find((l) => l.dia === "04-17");
conferir("lutas: o Eldorado do Carajás não cita número de mortos", eldorado && !/\b(19|21)\b[^.]*mort|mort[^.]*\b(19|21)\b/i.test(JSON.stringify(eldorado.fatos)) && !/19 x 21|21 x 19/.test(JSON.stringify(eldorado)));
const um = [{ dia: "03-08", nome: "A", fonte: "https://x.org", fatos: [], feriado: true }, { dia: "12-31", nome: "B", fatos: [], feriado: true }, { dia: "02-29", nome: "C", fatos: [], feriado: true }];
conferir("lutas: próxima no próprio dia", proximaLuta(um, "2026-03-08")?.data === "2026-03-08");
conferir("lutas: próxima depois do dia vai para o ano seguinte", proximaLuta([um[0]], "2026-03-09")?.data === "2027-03-08");
conferir("lutas: 31/12 e virada do ano", proximaLuta([um[1]], "2026-12-31")?.data === "2026-12-31" && proximaLuta(um.slice(0, 1), "2026-12-31")?.data === "2027-03-08");
conferir("lutas: 29/02 só em ano bissexto", proximaLuta([um[2]], "2026-03-01")?.data === "2028-02-29" && proximaLuta([um[2]], "2028-02-29")?.data === "2028-02-29" && proximaLuta([um[2]], "2028-03-01")?.data === "2032-02-29");
conferir("lutas: só feriados", proximaLuta([{ dia: "01-01", nome: null, fatos: [], feriado: false }], "2026-01-01", true) === null && proximaLuta(lutas, "2026-04-18", true)?.luta.dia === "04-19");
const ics = icsDaLuta(feriadas.find((l) => l.dia === "04-17"), "2026-11-03", "https://exemplo.org/pt/escola/lutas", AGORA);
conferir("lutas: .ics com CRLF, UID, data de dia inteiro e evento único", ics && ics.includes("\r\n") && /UID:escola-luta-2027-04-17@/.test(ics) && /DTSTART;VALUE=DATE:20270417/.test(ics) && !/RRULE/.test(ics) && (ics.match(/BEGIN:VEVENT/g) ?? []).length === 1);
conferir("lutas: .ics de data de memória sai com 'Data de memória'", /Data de memória/.test(icsDaLuta(lutas.find((l) => !l.feriado), "2026-01-01", "https://exemplo.org", AGORA) ?? ""));

// ───────────── Estudo de caso ─────────────
novaMemoria();
const cinco = ["Vi o esgoto aberto.", "As pessoas falaram do cheiro.", "A aula fala de saneamento.", "Mostra falta de obra.", "Pedir a limpeza em grupo.", ];
conferir("caso: precisa de exatamente 5 passos", gravarCaso("a-conta-de-luz", cinco.slice(0, 4)) === false && gravarCaso("a-conta-de-luz", [...cinco, "sexto"]) === false);
conferir("caso: passo acima de 600 recusado, 600 aceito", gravarCaso("a-conta-de-luz", ["x".repeat(601), "", "", "", ""]) === false && gravarCaso("a-conta-de-luz", ["x".repeat(600), "", "", "", ""], AGORA) === true);
gravarCaso("a-conta-de-luz", cinco, AGORA);
conferir("caso: lê o rascunho por curso", JSON.stringify(lerCaso("a-conta-de-luz")) === JSON.stringify(cinco) && lerCaso("livre") === null);
conferir("caso: o rascunho fica em chave privada e a caderneta não recebe nada", globalThis.localStorage.getItem(CHAVE_DO_CASO) !== null && lerCaderneta().length === 0);
const rotulos = ["O que vi", "Quem ouvi", "Aula", "Caso", "Proposta"];
const regCaso = registrarCasoNaCaderneta("a-conta-de-luz", "x".repeat(300), cinco, rotulos, AGORA);
conferir("caso: resumo na caderneta, tipo caso, sem pessoas, títulos e detalhes dentro dos limites", regCaso?.tipo === "caso" && regCaso.curso === "a-conta-de-luz" && regCaso.pessoas === undefined && regCaso.titulo.length === MAX_TITULO && regCaso.detalhe.length <= MAX_DETALHE && /O que vi: Vi o esgoto/.test(regCaso.detalhe));
registrarCasoNaCaderneta("a-conta-de-luz", "t", cinco, rotulos, AGORA);
conferir("caso: registrar de novo troca em vez de duplicar", lerCaderneta().filter((r) => r.tipo === "caso").length === 1);
conferir("caso: sem curso (livre) vai sem curso", registrarCasoNaCaderneta("livre", "t", cinco, rotulos, AGORA)?.curso === undefined);
conferir("caso: ficha vazia não vai para a caderneta", registrarCasoNaCaderneta("livre", "t", ["", "", "", "", ""], rotulos) === null);
conferir("caso: apagar", apagarCaso("a-conta-de-luz") && lerCaso("a-conta-de-luz") === null);
const cursosComCaso = cursosDaEscola.filter((c) => json("content", "escola", "cursos", `${c}.json`).casoDoBairro);
conferir("caso: os 3 cursos que marcam casoDoBairro existem", cursosComCaso.length === 3, cursosComCaso.join());

// ───────────── Bloco documento ─────────────
const doc = `imagem: /imagens/documentos/modelo.webp | Modelo em branco
fonte: https://www.gov.br/exemplo/modelo
licenca: Modelo oficial em branco
sem-dados-pessoais: sim
Campo 1 | 10 12 40 8 | O que significa. | O que conferir.
Campo 2 | 50 12 40 8 | Outro campo. | Outra conferência.`;
const d = lerDocumento(doc);
conferir("documento: leitura válida", d && d.areas.length === 2 && d.semDadosPessoais === true && d.fonte.startsWith("https://") && d.licenca === "Modelo oficial em branco" && d.areas[0].conferir === "O que conferir.");
conferir("documento: o modelo do editor lê", lerDocumento(MODELOS_INTERATIVOS.documento.modelo)?.areas.length === 1);
conferir("documento: está em INTERATIVOS e tem modelo", INTERATIVOS.includes("documento") && Boolean(MODELOS_INTERATIVOS.documento));
conferir("documento: imagem de fora do site recusada", lerDocumento(doc.replace("/imagens/documentos/modelo.webp", "https://x.org/a.webp")) === null && lerDocumento(doc.replace("/imagens/documentos/modelo.webp", "/imagens/../a.webp")) === null);
conferir("documento: sem fonte recusado", lerDocumento(doc.replace(/fonte:.*\n/, "")) === null);
conferir("documento: sem licença recusado", lerDocumento(doc.replace(/licenca:.*\n/, "")) === null);
conferir("documento: fonte sem https recusada", lerDocumento(doc.replace("https://www.gov.br", "http://www.gov.br")) === null);
conferir("documento: área fora de 0..100 recusada", lerDocumento(doc.replace("10 12 40 8", "10 12 140 8")) === null && lerDocumento(doc.replace("10 12 40 8", "-1 12 40 8")) === null && lerDocumento(doc.replace("10 12 40 8", "80 12 40 8")) === null);
const muitas = Array.from({ length: 25 }, (_, i) => `Campo ${i} | 1 1 5 5 | a | b`).join("\n");
conferir("documento: mais de 24 áreas recusado, 24 aceito", lerDocumento(`${doc.split("\n").slice(0, 4).join("\n")}\n${muitas}`) === null && lerDocumento(`${doc.split("\n").slice(0, 4).join("\n")}\n${muitas.split("\n").slice(0, 24).join("\n")}`)?.areas.length === 24);
conferir("documento: sem áreas recusado", lerDocumento(doc.split("\n").slice(0, 4).join("\n")) === null);
const documentos = json("content", "escola", "vida", "documentos.json").aulas;
conferir("documento: cada aula listada existe e contém o bloco", documentos.every((a) => existeAula(a.aula) && /```documento/.test(ler("content", "trilhas", `${a.aula}.md`))));
const interativo = ler("components", "blocos", "Interativo.tsx");
conferir("documento: despacho lazy (dynamic, ssr:false) em Interativo", /const DocumentoReal = dynamic\(.*ssr: false/.test(interativo) && /documento: DocumentoReal/.test(interativo));
conferir("documento: o componente mostra o selo de revisão e a fonte", /s\.selo/.test(ler("components", "blocos", "DocumentoReal.tsx")) && /s\.verOriginal/.test(ler("components", "blocos", "DocumentoReal.tsx")));

// ───────────── Textos nos 6 idiomas ─────────────
const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];
const textos = Object.fromEntries(IDIOMAS.map((l) => [l, json("i18n", "escola", "vida", `${l}.json`)]));
// "_rascunho" marca a tradução de máquina ainda não revisada: fica fora da comparação de chaves.
const chaves = (o, p = "") => (Array.isArray(o) ? o.flatMap((v, i) => chaves(v, `${p}.${i}`)) : o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => (k === "_rascunho" ? [] : chaves(v, `${p}.${k}`))) : [p]);
for (const l of IDIOMAS) conferir(`${l}: mesmas chaves do português`, chaves(textos[l]).sort().join() === chaves(textos.pt).sort().join());
for (const l of IDIOMAS) conferir(`${l}: roteiro de 6 perguntas, 5 passos do caso, 5 avisos`, textos[l].vozes.roteiro.perguntas.length === 6 && textos[l].caso.passos.length === 5 && textos[l].vozes.gravador.aviso.length === 5);
for (const l of IDIOMAS) conferir(`${l}: roteiro e missões levam a marca de revisão`, textos[l].vozes.roteiro.emRevisao.length > 10 && textos[l].missoes.emRevisao.length > 10 && textos[l].comum.emRevisao.length > 1);
conferir("textos: marcas [A REVISAR PELA COORDENAÇÃO] onde depende dela", IDIOMAS.every((l) => textos[l].documentos.vazio.includes("[") && textos[l].comum.revisar.startsWith("[")));
conferir("textos: o aviso de menores existe em todos os idiomas", IDIOMAS.every((l) => textos[l].vozes.gravador.menores.includes("18")));
conferir("textos: sem universidade nem diploma", !/universidade|universidad|university|université|университет|大学|diploma|diplôme|диплом|文凭|学位/i.test(JSON.stringify(textos)));
const roteiroRodape = JSON.stringify(textos.pt.vozes.roteiro.perguntas);
conferir("textos: o roteiro da voz tem as 6 perguntas do plano", /o que eu faço/i.test(roteiroRodape) && /não está nos livros/.test(roteiroRodape) && /risco/.test(roteiroRodape) && /direito/.test(roteiroRodape) && /conselho/.test(roteiroRodape) && /Escola poderia ensinar/.test(roteiroRodape));

// ───────────── Estrutura ─────────────
const vidaTs = ler("lib", "escola", "vida.ts");
const lutasTs = ler("lib", "escola", "lutas.ts");
conferir("estrutura: lib/escola/vida.ts e lutas.ts sem '@/' e sem fs", ![vidaTs, lutasTs].some((t) => /from\s+["']@\//.test(t) || /node:fs|from\s+["']fs["']|require\(["']fs/.test(t)));
const pastaVida = path.join(raiz, "components", "escola", "vida");
const arquivosDaVida = fs.readdirSync(pastaVida).map((a) => ({ a, t: fs.readFileSync(path.join(pastaVida, a), "utf8") }));
conferir("estrutura: componentes da vida sem fs", arquivosDaVida.every(({ t }) => !/node:fs|from\s+["']fs["']/.test(t)));
conferir("estrutura: nada vai ao servidor (sem fetch, rpc nem backend)", [...arquivosDaVida, { a: "vida.ts", t: vidaTs }, { a: "lutas.ts", t: lutasTs }].every(({ t }) => !/\bfetch\s*\(|\.rpc\s*\(|@\/lib\/backend|XMLHttpRequest|sendBeacon/.test(t)), "");
// F7 (prancha Mapa): a vida real (hub, tarefas, missões, caso do bairro, documentos) voltou ao site aberto, em /vida;
// vozes e lutas ficam na Escola (vão para a Biblioteca).
const paginas = ["escola/vozes", "escola/lutas", "vida", "vida/tarefas", "vida/missoes", "vida/caso-do-bairro", "vida/documentos"];
conferir("estrutura: as 7 páginas existem", paginas.every((p) => fs.existsSync(path.join(raiz, "app", "[lang]", ...p.split("/"), "page.tsx"))));
conferir("estrutura: nenhuma página nova usa generateStaticParams", paginas.every((p) => !/generateStaticParams/.test(ler("app", "[lang]", ...p.split("/"), "page.tsx"))));
conferir("estrutura: a vida real saiu de /escola", !fs.existsSync(path.join(raiz, "app", "[lang]", "escola", "vida")));
conferir("estrutura: o hub aponta para os endereços abertos", ["/vida/tarefas", "/vida/missoes", "/vida/caso-do-bairro", "/vida/documentos"].every((c) => ler("components", "escola", "vida", "HubDaVida.tsx").includes(`"${c}"`)));
conferir("estrutura: vozes e lutas não são mais provisórias", ["vozes", "lutas"].every((c) => { const r = ROTAS_DA_ESCOLA.find((x) => x.chave === c); return r && !r.provisoria && !/EmConstrucao/.test(ler("app", "[lang]", "escola", c, "page.tsx")); }));
// Integração da onda 4: as quatro páginas de baixo da vida nunca constaram em rotas.ts (F7: o hub também saiu da Escola).
conferir("estrutura: nenhuma página de baixo da vida em rotas.ts", ROTAS_DA_ESCOLA.every((r) => !r.caminho.startsWith("/escola/vida/")));
const importadoresGlobais = [ler("app", "[lang]", "layout.tsx"), ler("app", "[lang]", "trilhas", "[track]", "[lesson]", "page.tsx")];
conferir("estrutura: layout raiz e aula não importam nada de vida", importadoresGlobais.every((t) => !/escola\/vida|lib\/escola\/(vida|lutas)|DocumentoReal/.test(t)));
for (const arq of ["vozes.json", "trabalhadores-que-ensinam.json", "missoes.json", "documentos.json"]) conferir(`conteúdo: ${arq} é JSON válido`, (() => { try { json("content", "escola", "vida", arq); return true; } catch { return false; } })());
conferir("conteúdo: LEIA-ME existe", fs.existsSync(path.join(raiz, "content", "escola", "vida", "LEIA-ME.md")));
conferir("estrutura: o hub aberto não aponta para dentro da Escola (vozes, lutas e círculo ficam lá) e não duplica o círculo", !/"\/escola\//.test(ler("components", "escola", "vida", "HubDaVida.tsx")) && !fs.existsSync(path.join(pastaVida, "CirculoDeCultura.tsx")));
const cursoPagina = ler("app", "[lang]", "cursos", "[curso]", "page.tsx");
conferir("estrutura: a página do curso ganhou a tarefa e o link do caso", /<TarefaNoMundo curso=/.test(cursoPagina) && /caso-do-bairro\?curso=/.test(cursoPagina));
conferir("estrutura: o teste está no package.json", /testar:escola-vida/.test(ler("package.json")));

console.log(`escola-vida: ${ok} conferências certas, ${falhas.length} falha(s).`);
if (falhas.length) {
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
