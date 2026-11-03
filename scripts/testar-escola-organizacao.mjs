// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere a organização estudantil da Escola Lúcia Maria (E4-12, docs/escola/organizacao.md): a pauta da assembleia e as
// bordas da janela, o voto (3 por semestre, anônimo, contado só depois da marca local), o resultado na ordem da pauta, a
// Roda do semestre, as regras e recusas da ouvidoria, os protocolos do aparelho, o educador do mês (com autorização), as
// páginas, os textos nos 6 idiomas e a privacidade. Sem rede, sem navegador.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { alvosDaEscola } from "./alvos-de-contagem.mjs";
import {
  CHAVE_DA_ASSEMBLEIA,
  CHAVE_DA_RODA,
  CHAVE_DOS_PROTOCOLOS,
  MAX_PROTOCOLOS,
  MAX_RODAS,
  MIN_PARA_MOSTRAR_RESULTADO,
  VOTOS_POR_PESSOA,
  acrescentarProtocolo,
  apagarRoda,
  assembleiaAberta,
  chaveDaRecusa,
  educadorDoMes,
  esquecerProtocolo,
  gravarRoda,
  guardarProtocolos,
  guardarRodas,
  lerProtocolos,
  lerProtocolosGuardados,
  lerRodas,
  lerRodasGuardadas,
  lerVotos,
  mensagemDeRecusa,
  resultadoDaPauta,
  rodaVazia,
  textoDaRoda,
  validarEducadores,
  validarMensagem,
  validarPauta,
  votar,
  votosDoSemestre,
} from "../lib/escola/organizacao.ts";
import { hojeEmBrasilia } from "../lib/escola/tempo.ts";
import { ROTAS_DA_ESCOLA } from "../lib/escola/rotas.ts";

const RAIZ = process.cwd();
let certos = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const ler = (...partes) => fs.readFileSync(path.join(RAIZ, ...partes), "utf8");

/** Um armazenamento de mentira; `falha` faz toda escrita lançar erro. */
const memoria = (falha = false) => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      if (falha) throw new Error("cheio");
      m.set(k, String(v));
    },
    removeItem: (k) => void m.delete(k),
    _m: m,
  };
};

// ── Código: sem "@/", sem rede, chaves certas ───────────────────────────────────────────────────────────────────────
const fonte = ler("lib", "escola", "organizacao.ts");
conferir("organizacao.ts não usa '@/'", !/from\s+["']@\//.test(fonte));
conferir(
  "organizacao.ts importa só relativos",
  [...fonte.matchAll(/from\s+["']([^"']+)["']/g)].every((m) => m[1].startsWith("./") || m[1].startsWith("../")),
);
conferir("evento lucia:estudo", fonte.includes('"lucia:estudo"'));
const semProtecao = fonte.split("\n").filter((l) => /localStorage|JSON\.parse/.test(l) && !/typeof localStorage|return typeof/.test(l));
conferir("localStorage e JSON.parse dentro de try", semProtecao.length <= 2, semProtecao.join(" | "));
for (const chave of [CHAVE_DA_ASSEMBLEIA, CHAVE_DOS_PROTOCOLOS, CHAVE_DA_RODA]) conferir(`chave ${chave} com prefixo da Escola`, /^lucia:escola(-privado)?:/.test(chave));
conferir(
  "as três chaves usadas",
  CHAVE_DA_ASSEMBLEIA.endsWith(":assembleia") && CHAVE_DOS_PROTOCOLOS.endsWith(":ouvidoria-protocolos") && CHAVE_DA_RODA.endsWith(":roda-do-semestre"),
);
conferir("a chave 'avaliacoes' do E4-13 não é usada", !fonte.includes("avaliacoes"));
conferir("constantes", VOTOS_POR_PESSOA === 3 && MIN_PARA_MOSTRAR_RESULTADO === 10 && MAX_PROTOCOLOS === 50 && MAX_RODAS === 4);

// Toda escrita avisa lucia:estudo
let avisos = 0;
globalThis.dispatchEvent = () => {
  avisos++;
  return true;
};

// ── Pauta ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const trilhaReal = "lutas-do-povo";
conferir("trilha de teste existe em content/trilhas", fs.existsSync(path.join(process.cwd(), "content", "trilhas", trilhaReal)));
const base = { semestre: "2026.2", confirmado: false, candidatas: ["lutas-do-povo", "a-cidade-que-o-povo-fez"] };
conferir("pauta boa", validarPauta(base).pauta?.candidatas.length === 2);
conferir("pauta boa com janela", validarPauta({ ...base, abreEm: "2026-09-01", fechaEm: "2026-09-30" }).pauta !== null);
conferir("recusa semestre mal formado", validarPauta({ ...base, semestre: "2026-2" }).pauta === null && validarPauta({ ...base, semestre: "2026.3" }).pauta === null);
conferir("recusa candidata repetida", validarPauta({ ...base, candidatas: ["a", "a"] }).pauta === null);
conferir("recusa slug fora do formato", validarPauta({ ...base, candidatas: ["Maiuscula"] }).pauta === null && validarPauta({ ...base, candidatas: ["com espaco"] }).pauta === null);
conferir("recusa mais de 12", validarPauta({ ...base, candidatas: Array.from({ length: 13 }, (_, i) => `t${i}`) }).pauta === null);
conferir("aceita 12", validarPauta({ ...base, candidatas: Array.from({ length: 12 }, (_, i) => `t${i}`) }).pauta !== null);
conferir("recusa data fora do semestre", validarPauta({ ...base, abreEm: "2026-07-31" }).pauta === null && validarPauta({ ...base, fechaEm: "2026-12-16" }).pauta === null);
conferir("recusa data mal formada", validarPauta({ ...base, abreEm: "01/09/2026" }).pauta === null);
conferir("recusa abre depois de fecha", validarPauta({ ...base, abreEm: "2026-10-10", fechaEm: "2026-10-01" }).pauta === null);
conferir("recusa 'confirmado' que não é boolean", validarPauta({ ...base, confirmado: "sim" }).pauta === null);
conferir("recusa lixo", validarPauta(null).pauta === null && validarPauta([]).pauta === null && validarPauta("x").pauta === null);

const pb = validarPauta(base).pauta;
conferir("aberta no meio do semestre", assembleiaAberta(pb, "2026-11-03") === "aberta");
conferir("aberta no dia do início", assembleiaAberta(pb, "2026-08-01") === "aberta");
conferir("aberta no dia do fim", assembleiaAberta(pb, "2026-12-15") === "aberta");
conferir("depois do fim: semestre ainda é o mesmo, mas fechada", assembleiaAberta(pb, "2026-12-16") === "fechada");
conferir("véspera do início: ferias do semestre anterior é outro semestre", assembleiaAberta(pb, "2026-07-31") === "outro-semestre");
conferir("semestre diferente", assembleiaAberta(pb, "2027-03-10") === "outro-semestre");
conferir("sem candidatas é sem-pauta", assembleiaAberta({ ...pb, candidatas: [] }, "2026-11-03") === "sem-pauta");
conferir("pauta null é sem-pauta", assembleiaAberta(null, "2026-11-03") === "sem-pauta");
const janela = validarPauta({ ...base, abreEm: "2026-09-01", fechaEm: "2026-09-30" }).pauta;
conferir("janela: véspera fechada", assembleiaAberta(janela, "2026-08-31") === "fechada");
conferir("janela: primeiro dia aberta", assembleiaAberta(janela, "2026-09-01") === "aberta");
conferir("janela: último dia aberta", assembleiaAberta(janela, "2026-09-30") === "aberta");
conferir("janela: depois fechada", assembleiaAberta(janela, "2026-10-01") === "fechada");

// O arquivo real
const pautaReal = JSON.parse(ler("content", "escola", "assembleia.json"));
const real = validarPauta(pautaReal);
conferir("pauta real é válida", real.pauta !== null, real.erros.join("; "));
conferir("pauta real começa não confirmada", pautaReal.confirmado === false);
conferir("pauta real tem _sobre", typeof pautaReal._sobre === "string" && pautaReal._sobre.length > 50);
conferir("pauta real: hoje é sem-pauta enquanto 'candidatas' estiver vazia", pautaReal.candidatas.length > 0 || assembleiaAberta(real.pauta, hojeEmBrasilia()) === "sem-pauta");
for (const t of pautaReal.candidatas) conferir(`candidata real ${t} existe em content/trilhas`, fs.existsSync(path.join(process.cwd(), "content", "trilhas", t)));
for (const t of base.candidatas) conferir(`candidata de teste ${t} existe em content/trilhas`, fs.existsSync(path.join(process.cwd(), "content", "trilhas", t)));

// O formato casa com scripts/alvos-de-contagem.mjs
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "alvos-"));
try {
  fs.mkdirSync(path.join(tmp, "escola"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "escola", "assembleia.json"), JSON.stringify(base));
  const alvos = alvosDaEscola(tmp).assembleia ?? [];
  conferir("alvosDaEscola lê o formato da pauta", alvos.join() === "2026.2/a-cidade-que-o-povo-fez,2026.2/lutas-do-povo", alvos.join());
  fs.writeFileSync(path.join(tmp, "escola", "assembleia.json"), JSON.stringify(pautaReal));
  const vazios = alvosDaEscola(tmp).assembleia ?? null;
  conferir("alvosDaEscola lê o arquivo real", Array.isArray(vazios) && vazios.length === pautaReal.candidatas.length);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── Voto ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const pauta4 = validarPauta({ semestre: "2026.2", confirmado: true, candidatas: ["a", "b", "c", "d"] }).pauta;
{
  const arm = memoria();
  const contados = [];
  const contar = (...a) => contados.push(a);
  const antes = avisos;
  conferir("1º voto", votar(pauta4, "2026.2", "a", contar, arm).ok);
  conferir("voto grava a marca local", votosDoSemestre("2026.2", arm).join() === "a");
  conferir("voto dispara lucia:estudo", avisos > antes);
  conferir("voto chama contarEscola com tipo, alvo e período", JSON.stringify(contados[0]) === JSON.stringify(["assembleia_voto", "2026.2/a", "semestre"]), JSON.stringify(contados));
  const repetido = votar(pauta4, "2026.2", "a", contar, arm);
  conferir("repetido não duplica nem conta", !repetido.ok && repetido.motivo === "repetido" && contados.length === 1 && votosDoSemestre("2026.2", arm).length === 1);
  conferir("2º e 3º votos", votar(pauta4, "2026.2", "b", contar, arm).ok && votar(pauta4, "2026.2", "c", contar, arm).ok);
  const quarto = votar(pauta4, "2026.2", "d", contar, arm);
  conferir("a 4ª trilha é recusada e não conta", !quarto.ok && quarto.motivo === "limite" && contados.length === 3);
  const fora = votar(pauta4, "2026.2", "zzz", contar, arm);
  conferir("trilha fora da pauta recusa", !fora.ok && fora.motivo === "fora-da-pauta" && contados.length === 3);
  const outro = votar(pauta4, "2027.1", "d", contar, arm);
  conferir("semestre diferente do da pauta recusa", !outro.ok && outro.motivo === "outro-semestre" && contados.length === 3);
  conferir("semestre novo ignora a lista antiga", votosDoSemestre("2027.1", arm).length === 0 && lerVotos(arm.getItem(CHAVE_DA_ASSEMBLEIA), "2027.1").length === 0);
  const guardado = JSON.parse(arm.getItem(CHAVE_DA_ASSEMBLEIA));
  conferir("formato guardado", guardado.versao === 1 && guardado.semestre === "2026.2" && guardado.trilhas.length === 3);
}
{
  const cheio = memoria(true);
  const contados = [];
  const r = votar(pauta4, "2026.2", "a", (...a) => contados.push(a), cheio);
  conferir("armazenamento que lança erro não quebra e não conta", !r.ok && r.motivo === "armazenamento" && contados.length === 0);
  const r2 = votar(pauta4, "2026.2", "a", () => {}, null);
  conferir("sem armazenamento não conta", !r2.ok && r2.motivo === "armazenamento");
  const quebrado = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("bloqueado"); }, removeItem: () => {} };
  conferir("leitura que lança erro vira lista vazia", votosDoSemestre("2026.2", quebrado).length === 0);
  const r3 = votar(pauta4, "2026.2", "a", () => { throw new Error("rede"); }, memoria());
  conferir("contar que lança erro não quebra o voto", r3.ok);
}
conferir("lixo no armazenamento vira lista vazia", lerVotos("{não é json", "2026.2").length === 0 && lerVotos('{"versao":2}', "2026.2").length === 0 && lerVotos('{"versao":1,"semestre":"2026.2","trilhas":"x"}', "2026.2").length === 0);

// ── Resultado ───────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const r = resultadoDaPauta(
    [
      { alvo: "2026.2/c", total: 9 },
      { alvo: "2026.2/a", total: 3 },
      { alvo: "2026.2/estranha", total: 100 },
      { alvo: "2025.1/b", total: 50 },
    ],
    pauta4,
  );
  conferir("resultado na ordem da pauta, nunca por total", r.linhas.map((l) => l.trilha).join() === "a,b,c,d", r.linhas.map((l) => l.trilha).join());
  conferir("alvo estranho e de outro semestre são ignorados", r.soma === 12 && r.linhas.find((l) => l.trilha === "b").total === 0);
  conferir("soma de 12 mostra números", r.mostrar === true);
  conferir("percentuais entre 0 e 100", r.linhas.every((l) => l.percentual >= 0 && l.percentual <= 100) && r.linhas.find((l) => l.trilha === "c").percentual === 100 && r.linhas.find((l) => l.trilha === "a").percentual === 33);
  const poucos = resultadoDaPauta([{ alvo: "2026.2/a", total: 9 }], pauta4);
  conferir("soma menor que 10 esconde números", poucos.mostrar === false && poucos.soma === 9);
  conferir("soma exatamente 10 mostra", resultadoDaPauta([{ alvo: "2026.2/a", total: 10 }], pauta4).mostrar === true);
  conferir("sem contagens: tudo zero, sem dividir por zero", resultadoDaPauta([], pauta4).linhas.every((l) => l.total === 0 && l.percentual === 0));
  conferir("totais estranhos viram 0", resultadoDaPauta([{ alvo: "2026.2/a", total: -5 }, { alvo: "2026.2/b", total: NaN }], pauta4).soma === 0);
}

// ── Roda ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const arm = memoria();
  const r1 = { ...rodaVazia("2026.2", "2026-11-03"), respostas: { p1: "A roda funcionou", p2: "", p3: "x".repeat(900), p4: "", p5: "" } };
  const antes = avisos;
  conferir("guardarRodas grava", guardarRodas(gravarRoda([], r1), arm) && lerRodasGuardadas(arm).length === 1);
  conferir("guardarRodas dispara lucia:estudo", avisos > antes);
  conferir("resposta passa de 600: corta", lerRodasGuardadas(arm)[0].respostas.p3.length === 600);
  let lista = [];
  for (const s of ["2025.1", "2025.2", "2026.1", "2026.2", "2027.1"]) lista = gravarRoda(lista, { ...rodaVazia(s, "2026-01-01"), respostas: { p1: s, p2: "", p3: "", p4: "", p5: "" } });
  conferir("no máximo 4 rodas, a mais velha sai", lista.length === 4 && lista[0].semestre === "2025.2" && lista[3].semestre === "2027.1");
  conferir("uma por semestre", gravarRoda(lista, { ...rodaVazia("2027.1", "2027-02-01"), respostas: { p1: "outra", p2: "", p3: "", p4: "", p5: "" } }).length === 4);
  conferir("roda em branco sai da lista", gravarRoda(lista, rodaVazia("2027.1")).length === 3);
  conferir("apagarRoda", apagarRoda(lista, "2027.1").length === 3);
  conferir("lixo vira lista vazia", lerRodas("{ruim").length === 0 && lerRodas('{"versao":1,"rodas":"x"}').length === 0 && lerRodas(null).length === 0);
  conferir("guardarRodas([]) apaga a chave", guardarRodas([], arm) && arm.getItem(CHAVE_DA_RODA) === null);
  const perguntas = { p1: "Q1", p2: "Q2", p3: "Q3", p4: "Q4", p5: "Q5" };
  const texto = textoDaRoda(r1, perguntas, "Título");
  conferir("textoDaRoda leva só as respondidas", texto.startsWith("Título") && texto.includes("Q1\nA roda funcionou") && !texto.includes("Q2") && texto.length <= 3000);
}

// ── Ouvidoria: regras ───────────────────────────────────────────────────────────────────────────────────────────────
const ok = { sobre: "escola", texto: "x".repeat(10) };
conferir("texto de 9 caracteres recusado", validarMensagem({ ...ok, texto: "x".repeat(9) }) === "texto-curto");
conferir("texto de 10 caracteres vale", validarMensagem(ok) === null);
conferir("texto de 3000 vale", validarMensagem({ ...ok, texto: "x".repeat(3000) }) === null);
conferir("texto de 3001 recusado", validarMensagem({ ...ok, texto: "x".repeat(3001) }) === "texto-longo");
conferir("texto só de espaços é curto", validarMensagem({ ...ok, texto: " ".repeat(40) }) === "texto-curto");
conferir("caminho /pt/trilhas/x vale", validarMensagem({ ...ok, caminho: "/pt/trilhas/x" }) === null);
conferir("caminho https://x recusado", validarMensagem({ ...ok, caminho: "https://x" }) === "caminho");
conferir("caminho com maiúscula ou espaço recusado", validarMensagem({ ...ok, caminho: "/Pt" }) === "caminho" && validarMensagem({ ...ok, caminho: "/a b" }) === "caminho");
conferir("contato de 200 vale e de 201 recusado", validarMensagem({ ...ok, contato: "c".repeat(200) }) === null && validarMensagem({ ...ok, contato: "c".repeat(201) }) === "contato-longo");
conferir("assunto inválido recusado", validarMensagem({ ...ok, sobre: "xyz" }) === "assunto");
for (const a of ["aula", "curso", "educador", "escola", "outro"]) conferir(`assunto ${a} vale`, validarMensagem({ ...ok, sobre: a }) === null);

// Recusas: todo código do banco.md tem chave, e a chave tem texto em pt
const bancoMd = ler("docs", "escola", "banco.md");
const bloco = /Códigos de recusa:([^]*?)\n\n/.exec(bancoMd)?.[1] ?? "";
const codigos = [...bloco.matchAll(/`([a-z_]+(?::[a-z]+)?)`/g)].map((m) => m[1]);
conferir("achou os códigos de recusa em banco.md", codigos.length >= 15, String(codigos.length));
const dicionarios = Object.fromEntries(["pt", "en", "es", "fr", "ru", "zh"].map((l) => [l, JSON.parse(ler("i18n", "escola", "organizacao", `${l}.json`))]));
const ptRec = dicionarios.pt.ouvidoria.recusas;
for (const c of codigos) conferir(`código ${c} tem texto em pt`, typeof mensagemDeRecusa(c, ptRec) === "string" && mensagemDeRecusa(c, ptRec).length > 10);
for (const c of ["entre_primeiro", "conta_suspensa", "invalido:sobre", "invalido:caminho", "invalido:texto", "invalido:contato", "area_interditada", "envios_pausados", "acesso_bloqueado", "muitos_pedidos"]) {
  conferir(`código ${c} tem texto próprio`, chaveDaRecusa(c) !== "generica" && ptRec[chaveDaRecusa(c)] !== ptRec.generica);
  conferir(`código ${c} está no banco.md`, codigos.includes(c));
}
conferir("código desconhecido cai no genérico", chaveDaRecusa("zzz") === "generica" && mensagemDeRecusa("zzz", ptRec) === ptRec.generica && mensagemDeRecusa("", ptRec) === ptRec.generica);

// ── Ouvidoria: protocolos no aparelho ───────────────────────────────────────────────────────────────────────────────
{
  const hex = (n) => n.toString(16).padStart(8, "0");
  let lista = [];
  for (let i = 0; i < 55; i++) lista = acrescentarProtocolo(lista, { protocolo: hex(i + 1), sobre: "escola", em: "2026-11-03" });
  conferir("no máximo 50 protocolos", lista.length === 50);
  conferir("o mais antigo sai", lista[0].protocolo === hex(6) && lista[49].protocolo === hex(55));
  conferir("duplicado não repete", acrescentarProtocolo(lista, { protocolo: hex(55), sobre: "aula", em: "2026-11-04" }).length === 50);
  conferir("protocolo maiúsculo guarda minúsculo", acrescentarProtocolo([], { protocolo: "ABCD1234", sobre: "outro", em: "2026-11-03" })[0].protocolo === "abcd1234");
  conferir("protocolo fora do formato é ignorado", acrescentarProtocolo([], { protocolo: "xyz", sobre: "outro", em: "2026-11-03" }).length === 0 && acrescentarProtocolo([], { protocolo: "abcd12345", sobre: "outro", em: "2026-11-03" }).length === 0);
  conferir("assunto ou data inválidos são ignorados", acrescentarProtocolo([], { protocolo: hex(1), sobre: "nada", em: "2026-11-03" }).length === 0 && acrescentarProtocolo([], { protocolo: hex(1), sobre: "aula", em: "ontem" }).length === 0);
  conferir("lixo no armazenamento vira lista vazia", lerProtocolos("{ruim").length === 0 && lerProtocolos('{"a":1}').length === 0 && lerProtocolos('[1,"x",null,{"protocolo":"zz"}]').length === 0 && lerProtocolos(null).length === 0);
  conferir("esquecerProtocolo tira só um", esquecerProtocolo(lista, hex(55)).length === 49);
  const arm = memoria();
  const antes = avisos;
  conferir("guardarProtocolos grava e relê", guardarProtocolos(lista, arm) && lerProtocolosGuardados(arm).length === 50 && avisos > antes);
  conferir("guardarProtocolos([]) apaga", guardarProtocolos([], arm) && arm.getItem(CHAVE_DOS_PROTOCOLOS) === null);
  conferir("armazenamento que lança erro devolve false", guardarProtocolos(lista, memoria(true)) === false);
}

// ── Educador do mês ─────────────────────────────────────────────────────────────────────────────────────────────────
const cursosReais = new Set(fs.readdirSync(path.join(process.cwd(), "content", "escola", "cursos")).filter((n) => n.endsWith(".json")).map((n) => n.replace(/\.json$/, "")));
const cursoReal = [...cursosReais][0];
const edReal = JSON.parse(ler("content", "escola", "educador-do-mes.json"));
conferir("lista real de educadores é válida", validarEducadores(edReal.educadores, cursosReais).length === 0, validarEducadores(edReal.educadores, cursosReais).join("; "));
conferir("lista real começa vazia", Array.isArray(edReal.educadores) && edReal.educadores.length === 0);
conferir("educador-do-mes.json tem _sobre com o processo", typeof edReal._sobre === "string" && /autoriza/i.test(edReal._sobre));
for (const e of edReal.educadores) if (e.curso) conferir(`curso ${e.curso} do educador existe`, fs.existsSync(path.join(process.cwd(), "content", "escola", "cursos", `${e.curso}.json`)));
const e1 = { mes: "2026-10", apelido: "Seu Zé", motivo: "Ensina com paciência.", autorizacao: true };
const bom = [e1, { mes: "2026-11", apelido: "Dona Lu", curso: cursoReal, motivo: "Abriu a turma.", autorizacao: true }];
conferir("lista boa vale", validarEducadores(bom, cursosReais).length === 0);
conferir("recusa sem autorizacao:true", validarEducadores([{ ...e1, autorizacao: false }]).length > 0 && validarEducadores([{ mes: "2026-10", apelido: "Zé", motivo: "x" }]).length > 0);
conferir("recusa mês repetido", validarEducadores([e1, { ...e1, apelido: "Outra" }]).length > 0);
conferir("recusa mês mal formado", validarEducadores([{ ...e1, mes: "2026-13" }]).length > 0 && validarEducadores([{ ...e1, mes: "26-10" }]).length > 0);
conferir("recusa apelido com 3 palavras", validarEducadores([{ ...e1, apelido: "João da Silva" }]).length > 0);
conferir("recusa e-mail ou número no apelido", validarEducadores([{ ...e1, apelido: "ze@x.com" }]).length > 0 && validarEducadores([{ ...e1, apelido: "Zé 123" }]).length > 0);
conferir("recusa apelido vazio ou acima de 40", validarEducadores([{ ...e1, apelido: " " }]).length > 0 && validarEducadores([{ ...e1, apelido: "a".repeat(41) }]).length > 0 && validarEducadores([{ ...e1, apelido: "a".repeat(40) }]).length === 0);
conferir("recusa motivo acima de 280", validarEducadores([{ ...e1, motivo: "m".repeat(281) }]).length > 0 && validarEducadores([{ ...e1, motivo: "m".repeat(280) }]).length === 0);
conferir("recusa curso que não existe", validarEducadores([{ ...e1, curso: "curso-que-nao-existe" }], cursosReais).length > 0);
conferir("sem a lista de cursos, não confere curso", validarEducadores([{ ...e1, curso: "qualquer" }], null).length === 0);
for (const campo of ["foto", "imagem", "avatar", "votos", "indicacoes", "ranking"]) conferir(`nenhum campo '${campo}' aceito`, validarEducadores([{ ...e1, [campo]: "x" }]).length > 0);
conferir("lista que não é lista é recusada", validarEducadores({}).length > 0 && validarEducadores(null).length > 0);
{
  const lista = Array.from({ length: 15 }, (_, i) => ({ ...e1, mes: `${2025 + Math.floor((i + 3) / 12)}-${String(((i + 3) % 12) + 1).padStart(2, "0")}`, apelido: `Pessoa${""}`.replace("Pessoa", "Ana") }));
  const r = educadorDoMes(lista, "2026-05");
  conferir("educadorDoMes pega o mês certo", r.atual?.mes === "2026-05");
  conferir("no máximo 12 meses, do mais novo ao mais antigo", r.anteriores.length <= 11 && r.anteriores.every((e) => e.mes < "2026-05" && e.mes >= "2025-06") && r.anteriores[0].mes > r.anteriores[r.anteriores.length - 1].mes, r.anteriores.map((e) => e.mes).join());
  conferir("mês sem ninguém: atual nulo", educadorDoMes(bom, "2026-12").atual === null);
  conferir("mês futuro não aparece", educadorDoMes(bom, "2026-10").anteriores.length === 0 && educadorDoMes(bom, "2026-10").atual?.mes === "2026-10");
  conferir("lista inválida: nada", educadorDoMes([{ ...e1, autorizacao: false }], "2026-10").atual === null);
  conferir("virada de ano", educadorDoMes([{ ...e1, mes: "2025-12" }], "2026-01").anteriores.length === 1);
}

// ── Páginas, componentes e rotas ────────────────────────────────────────────────────────────────────────────────────
for (const nome of ["assembleia", "ouvidoria", "educador-do-mes"]) {
  const arq = ler("app", "[lang]", "escola", nome, "page.tsx");
  conferir(`página ${nome} existe e não importa EmConstrucao`, !/EmConstrucao/.test(arq));
  conferir(`página ${nome} sem generateStaticParams`, !/generateStaticParams/.test(arq));
  conferir(`página ${nome} sem node:fs`, !/node:fs|from\s+["']fs["']/.test(arq));
  conferir(`página ${nome} usa paginaMeta`, /paginaMeta\(/.test(arq) && !/noindex|robots/.test(arq));
  if (nome !== "assembleia") conferir(`página ${nome} não importa lib/content`, !/lib\/content/.test(arq));
  const rota = ROTAS_DA_ESCOLA.find((r) => r.caminho === `/escola/${nome}`);
  conferir(`rota ${nome} não é mais provisória`, rota && !rota.provisoria && rota.pacote === "E4-12");
}
conferir("assembleia usa lib/content só para os títulos", /getTracks/.test(ler("app", "[lang]", "escola", "assembleia", "page.tsx")));

const arquivosNovos = [
  "lib/escola/organizacao.ts",
  "components/escola/organizacao/guardado-organizacao.ts",
  "components/escola/organizacao/AssembleiaVotacao.tsx",
  "components/escola/organizacao/ResultadoDaAssembleia.tsx",
  "components/escola/organizacao/RodaDoSemestre.tsx",
  "components/escola/organizacao/RoteiroDoNucleo.tsx",
  "components/escola/organizacao/FormularioDaOuvidoria.tsx",
  "components/escola/organizacao/MeusProtocolos.tsx",
  "components/escola/organizacao/RespostasPublicas.tsx",
  "app/[lang]/escola/assembleia/page.tsx",
  "app/[lang]/escola/ouvidoria/page.tsx",
  "app/[lang]/escola/educador-do-mes/page.tsx",
];
for (const a of arquivosNovos) {
  const t = ler(...a.split("/"));
  conferir(`${a}: sem fetch, sendBeacon, cookie ou analytics`, !/\bfetch\(|sendBeacon|document\.cookie|gtag|analytics|pixel/i.test(t));
  conferir(`${a}: sem node:fs`, !/node:fs/.test(t));
}
for (const a of arquivosNovos.filter((x) => x.startsWith("components/") && x.endsWith(".tsx") && !x.includes("RoteiroDoNucleo"))) {
  conferir(`${a}: componente de cliente`, ler(...a.split("/")).includes('"use client"'));
  conferir(`${a}: sem import de valor dos JSON de texto`, !/from\s+["']@\/i18n\/escola\/organizacao\/(pt|en|es|fr|ru|zh)/.test(ler(...a.split("/"))) && !/import\s+\{[^}]*textosDaOrganizacao/.test(ler(...a.split("/"))));
}

// A ouvidoria nunca monta endereço com texto
const form = ler("components", "escola", "organizacao", "FormularioDaOuvidoria.tsx");
conferir("formulário só lê assunto e caminho do endereço", [...form.matchAll(/q\.get\("(\w+)"\)/g)].map((m) => m[1]).sort().join() === "caminho,sobre");
conferir("formulário não monta href nem searchParams com texto", !/href=/.test(form) && !/searchParams|router\.(push|replace)|location\.(href|assign|replace)\s*=/.test(form));
conferir("formulário envia o campo-isca 'site'", /site:\s*isca/.test(form) && /name="site"/.test(form) && /tabIndex=\{-1\}/.test(form) && /aria-hidden="true"/.test(form));
const roda = ler("components", "escola", "organizacao", "RodaDoSemestre.tsx");
const links = [...roda.matchAll(/localePath\(lang, ("[^"]*"|`[^`]*`)\)/g)].map((m) => m[1]);
conferir("a Roda só leva à ouvidoria com ?sobre=escola", links.length === 1 && links[0] === '"/escola/ouvidoria?sobre=escola"', links.join());
const educadorPagina = ler("app", "[lang]", "escola", "educador-do-mes", "page.tsx");
conferir("educador não tem foto nem imagem", !/<img|next\/image|avatar|\.foto\b/i.test(educadorPagina));
conferir("não existe função de desfazer voto", !/(function|const)\s+(desfazer|removerVoto|retirarVoto)/i.test(fonte));

// ── Textos: 6 idiomas ───────────────────────────────────────────────────────────────────────────────────────────────
const achatar = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? achatar(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
const ptPlano = new Map(achatar(dicionarios.pt));
const marcadores = (t) => [...String(t).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
const PROIBIDAS = /universidade|universidad|university|université|университет|大学|diploma|diplôme|диплом|文凭|学位/i;
for (const [l, d] of Object.entries(dicionarios)) {
  const plano = new Map(achatar(d));
  conferir(`${l}: mesmas chaves do pt`, [...plano.keys()].sort().join() === [...ptPlano.keys()].sort().join());
  for (const [k, v] of plano) {
    conferir(`${l}.${k}: não vazio`, typeof v === "string" && v.trim().length > 0);
    conferir(`${l}.${k}: mesmos marcadores do pt`, marcadores(v) === marcadores(ptPlano.get(k)));
    if (!/nao/i.test(k)) conferir(`${l}.${k}: sem universidade nem diploma`, !PROIBIDAS.test(String(v)));
  }
}
const pt = dicionarios.pt;
conferir("pt: textos de conteúdo trazem 'em revisão'", [pt.emRevisao, pt.nucleo.revisao, pt.educador.motivoRevisao].every((t) => /em revisão/i.test(t)));
conferir("pt: prazo e eliminação trazem '[A REVISAR PELA COORDENAÇÃO]'", [pt.ouvidoria.prazo, pt.ouvidoria.eliminar, pt.educador.criterio].every((t) => t.includes("[A REVISAR PELA COORDENAÇÃO]")));
conferir("pt: resultado diz que não é eleição e que a coordenação decide", pt.assembleia.naoEEleicao.includes("contagem de aparelhos, não uma eleição") && pt.assembleia.naoEEleicao.includes("A coordenação lê o resultado e decide."));
conferir("pt: a ouvidoria avisa de CPF, documento, endereço, telefone, criança e menor de 18", /CPF/.test(pt.ouvidoria.avisoDados) && /telefone/.test(pt.ouvidoria.avisoDados) && /criança/.test(pt.ouvidoria.avisoDados) && /18 anos/.test(pt.ouvidoria.avisoDados));
conferir("pt: o aviso do educador pede 'sem xingar'", /sem xingar/.test(pt.ouvidoria.avisoEducador));
conferir("pt: educador não é prêmio", /não é prêmio/i.test(pt.educador.lead));
conferir("pt: protocolo sem prazo prometido", /Recebida\. Se a mediação publicar/.test(pt.protocolos.recebida) && !/\d+\s*(dias|horas)/.test(pt.protocolos.recebida));
conferir("pt: esquecer avisa que não apaga no servidor", /não apaga a mensagem no servidor/i.test(pt.protocolos.aviso));
conferir("pt: voto definitivo avisado", /não pode ser desfeito/.test(pt.assembleia.avisoVoto) && /não pode ser desfeito/.test(pt.assembleia.entendi));

// ── Privacidade e recurso ───────────────────────────────────────────────────────────────────────────────────────────
const priv = ler("content", "paginas", "privacidade.md");
conferir("privacidade.md continua com 'Voto na assembleia estudantil'", priv.includes("Voto na assembleia estudantil"));
conferir("privacidade.md continua com o parágrafo 'Ouvidoria.'", priv.includes("**Ouvidoria.**"));
const git = (...args) => {
  try {
    return execFileSync("C:\\Program Files\\Git\\cmd\\git.exe", args, { cwd: RAIZ, encoding: "utf8" });
  } catch {
    return null;
  }
};
const diffRecursos = git("diff", "--stat", "--", "lib/recursos.ts");
conferir("lib/recursos.ts intocado", diffRecursos === null || diffRecursos.trim() === "");
const layout = ler("app", "[lang]", "escola", "layout.tsx");
conferir("o layout da Escola continua com a flag", /ligado\(\s*["']escola["']\s*\)/.test(layout));
const e2e = ler("e2e", "escola-organizacao.spec.ts");
conferir("e2e liga a Escola e simula o banco", /NEXT_PUBLIC_RECURSOS=escola/.test(e2e) && /rest\/v1\/rpc\/contar_escola/.test(e2e) && /ouvidoria_enviar/.test(e2e));

console.log(`escola-organizacao: ${certos} conferências certas, ${falhas.length} falha(s).`);
if (falhas.length) {
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
