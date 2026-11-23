// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, item 3.3 (a multidão). Prova, com um relógio simulado (dias de uso em segundos de teste):
//   - ACEITE: os três tipos de aparelho (o site, o app do Android e o do computador) têm a MESMA distribuição de horários de depósito
//     e de tamanhos em cada estado (aberto, fundo, bateria fraca): Kolmogorov–Smirnov de duas amostras, p > 0,01. O site diz o estado
//     pela visibilidade da página e pela bateria do navegador; os apps, pelo ciclo de vida (definirEstado). O código do ritmo é um só;
//   - ACEITE: a mensagem de verdade não se distingue da cobertura: com e sem mensagens de verdade, os intervalos entre depósitos têm a
//     mesma distribuição (KS, p > 0,01) e o número de depósitos por hora não muda (ela sai NO LUGAR de um pacote de cobertura);
//   - teto de espera (30 s, só a primeira da fila): com mensagem esperando, nunca passa mais de 30 s sem depósito; as cópias de uma
//     mensagem para vários aparelhos saem em instantes diferentes (sem rajada); nunca dois depósitos a menos de 1 s;
//   - a taxa muda com o estado (o próximo instante é sorteado de novo): ao voltar do fundo, o depósito seguinte não espera a taxa velha;
//   - as buscas (agendarBusca): intervalo fixo do estado, deslocamento sorteado por caixa, caixas em horários diferentes;
//   - o chat a dois busca pela agenda: a tela não puxa as caixas todas de uma vez quando a agenda está ligada;
//   - os cabeçalhos dos apps e os da mixnet são os mesmos; a tela não oferece mais desligar a cobertura.
// O sorteio do teste é determinístico (semente fixa) para o resultado ser o mesmo em toda rodada; o código do ritmo continua chamando
// crypto.getRandomValues (aqui trocado por um gerador de teste, só neste processo).
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r3-ritmo.mjs
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

let certos = 0;
const falhas = [];
const confere = (nome, ok, detalhe = "") => (ok ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

// ── Sorteio determinístico do teste (xoshiro128**, semente = SHA-256 de um rótulo fixo). NÃO é para segurança: só para o teste
// repetir igual. ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const semente = createHash("sha256").update("alumia/r3/ritmo/teste/v1").digest();
let s0 = semente.readUInt32LE(0), s1 = semente.readUInt32LE(4), s2 = semente.readUInt32LE(8), s3 = semente.readUInt32LE(12);
const rotl = (x, k) => ((x << k) | (x >>> (32 - k))) >>> 0;
function proximo32() {
  const r = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
  const t = (s1 << 9) >>> 0;
  s2 ^= s0; s3 ^= s1; s1 ^= s2; s0 ^= s3; s2 ^= t; s3 = rotl(s3, 11);
  s0 >>>= 0; s1 >>>= 0; s2 >>>= 0; s3 >>>= 0;
  return r;
}
const real = globalThis.crypto;
Object.defineProperty(globalThis, "crypto", {
  configurable: true,
  value: {
    subtle: real.subtle,
    randomUUID: () => real.randomUUID(),
    getRandomValues(a) {
      const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
      for (let i = 0; i < b.length; i += 4) {
        const v = proximo32();
        for (let j = 0; j < 4 && i + j < b.length; j++) b[i + j] = (v >>> (8 * j)) & 0xff;
      }
      return a;
    },
  },
});

const ritmo = await import("../lib/rede/caixas/ritmo.ts");
const agenda = await import("../lib/rede/caixas/agenda.ts");
const { TAMANHOS_DUPLA } = await import("../lib/rede/caixas/tamanhos.ts");
const { CABECALHOS_PELA_MIXNET } = await import("../lib/rede/mixnet/parametros.ts");
const { RITMO } = ritmo;

// ── O relógio simulado ───────────────────────────────────────────────────────────────────────────────────────────────────
let agora = 0;
let aVista = true;
let sequencia = 0;
const timers = [];
const relogio = {
  agendar: (fn, ms) => {
    const t = { quando: agora + Math.max(0, ms), fn, seq: sequencia++, vivo: true };
    timers.push(t);
    return () => void (t.vivo = false);
  },
  agora: () => agora,
  aVista: () => aVista,
};
agenda.configurarRelogio(relogio);
const microtarefas = () => new Promise((r) => setImmediate(r));
/** Roda o relógio até `ate`, disparando os agendados em ordem (e deixando as promessas andarem entre eles). */
async function rodarAte(ate) {
  for (;;) {
    let i = -1;
    for (let k = 0; k < timers.length; k++) if (timers[k].vivo && timers[k].quando <= ate && (i < 0 || timers[k].quando < timers[i].quando || (timers[k].quando === timers[i].quando && timers[k].seq < timers[i].seq))) i = k;
    if (i < 0) break;
    const t = timers.splice(i, 1)[0];
    agora = t.quando;
    t.fn();
    await microtarefas();
  }
  agora = ate;
  for (let k = timers.length - 1; k >= 0; k--) if (!timers[k].vivo) timers.splice(k, 1);
}

// ── Kolmogorov–Smirnov de duas amostras (valor p assintótico) ──────────────────────────────────────────────────────────────
function ks(a, b) {
  const x = [...a].sort((p, q) => p - q);
  const y = [...b].sort((p, q) => p - q);
  let i = 0, j = 0, d = 0;
  while (i < x.length && j < y.length) {
    const v = Math.min(x[i], y[j]);
    while (i < x.length && x[i] <= v) i++;
    while (j < y.length && y[j] <= v) j++;
    d = Math.max(d, Math.abs(i / x.length - j / y.length));
  }
  const ne = (x.length * y.length) / (x.length + y.length);
  const l = (Math.sqrt(ne) + 0.12 + 0.11 / Math.sqrt(ne)) * d;
  let p = 0;
  for (let k = 1; k <= 100; k++) p += 2 * (-1) ** (k - 1) * Math.exp(-2 * k * k * l * l);
  return { d, p: Math.min(1, Math.max(0, p)) };
}

// ── Os três tipos de aparelho ──────────────────────────────────────────────────────────────────────────────────────────────
// O roteiro de um dia (horas): aberto, fundo, bateria fraca, aberto de novo. Cada perfil diz o estado do seu jeito.
const ROTEIRO = [
  { estado: "aberto", horas: 6 },
  { estado: "fundo", horas: 60 },
  { estado: "bateria_fraca", horas: 150 },
  { estado: "aberto", horas: 6 },
];
const H = 3_600_000;
const PERFIS = {
  // O site: visibilidade da página e a bateria do navegador; o fetch do navegador (manda Origin: limite dito no documento).
  site: { estado: (e) => { ritmo.definirEstado(null); aVista = e !== "fundo"; ritmo.definirBateria(e === "bateria_fraca"); }, cabecalhos: { Origin: "https://exemplo" } },
  // Os apps: o ciclo de vida do app (Capacitor App / Tauri) chama definirEstado; HTTP nativo com os cabeçalhos fixos.
  android: { estado: (e) => ritmo.definirEstado(e), cabecalhos: { ...ritmo.CABECALHOS_DOS_APPS } },
  computador: { estado: (e) => ritmo.definirEstado(e), cabecalhos: { ...ritmo.CABECALHOS_DOS_APPS } },
};
const TAMANHO_CURTO = TAMANHOS_DUPLA[0];

/**
 * Um perfil vivendo o roteiro. `mensagens`: a cada quanto (média, ms) a pessoa escreve com a tela aberta (0 = nunca); cada mensagem vai
 * a `aparelhos` caixas (um depósito por aparelho da outra pessoa). Devolve os depósitos ({t, tamanho, deVerdade, estado, espera}).
 */
async function viver(nome, { mensagens = 0, aparelhos = 1 } = {}) {
  const perfil = PERFIS[nome];
  agora = 0;
  timers.length = 0;
  ritmo.pararRitmo();
  ritmo.definirEstado(null);
  ritmo.definirBateria(false);
  aVista = true;
  const depositos = [];
  let estadoDaVez = "aberto";
  const depositar = (tamanho, deVerdade, desde) => {
    depositos.push({ t: agora, tamanho, deVerdade, desde, estado: estadoDaVez, espera: deVerdade ? agora - Math.floor(desde) : 0, cabecalhos: perfil.cabecalhos });
    return Promise.resolve({ ok: true });
  };
  perfil.estado("aberto");
  const parar = ritmo.ligarRitmo(async () => void (await depositar(TAMANHO_CURTO, false, 0)));
  let inicio = 0;
  for (const passo of ROTEIRO) {
    estadoDaVez = passo.estado;
    perfil.estado(passo.estado);
    const fim = inicio + passo.horas * H;
    if (mensagens && passo.estado === "aberto") {
      // A pessoa escreve em horários de Poisson (média `mensagens`), só com a tela aberta.
      let t = inicio + ritmo.esperaExponencial(mensagens);
      while (t < fim) {
        const quando = t;
        relogio.agendar(() => {
          for (let k = 0; k < aparelhos; k++) void ritmo.enfileirarDeVerdade(() => depositar(TAMANHO_CURTO, true, quando + k / 1000));
        }, quando - agora);
        t += ritmo.esperaExponencial(mensagens);
      }
    }
    await rodarAte(fim);
    inicio = fim;
  }
  const antesDeParar = depositos.length;
  parar();
  await microtarefas();
  return depositos.slice(0, antesDeParar);
}

const intervalos = (lista, estado) => {
  const r = [];
  for (let i = 1; i < lista.length; i++) if (lista[i].estado === estado && lista[i - 1].estado === estado) r.push(lista[i].t - lista[i - 1].t);
  return r;
};

// ── ACEITE 1: os três perfis ───────────────────────────────────────────────────────────────────────────────────────────────
const vidas = {};
for (const nome of Object.keys(PERFIS)) vidas[nome] = await viver(nome);
for (const estado of ["aberto", "fundo", "bateria_fraca"]) {
  const n = Object.fromEntries(Object.entries(vidas).map(([k, v]) => [k, intervalos(v, estado)]));
  confere(`perfis (${estado}): amostras suficientes (≥ 200 intervalos em cada)`, Object.values(n).every((x) => x.length >= 200), JSON.stringify(Object.fromEntries(Object.entries(n).map(([k, v]) => [k, v.length]))));
  for (const [a, b] of [["site", "android"], ["site", "computador"], ["android", "computador"]]) {
    const r = ks(n[a], n[b]);
    confere(`ACEITE 3.3 (${estado}): ${a} e ${b} têm a mesma distribuição de intervalos (KS p > 0,01)`, r.p > 0.01, `D=${r.d.toFixed(4)} p=${r.p.toFixed(4)}`);
  }
  const media = n.site.reduce((x, y) => x + y, 0) / n.site.length;
  confere(`perfis (${estado}): o intervalo médio é o do ritmo (±15%)`, Math.abs(media / RITMO[estado].cobertura - 1) < 0.15, `${Math.round(media)} ms contra ${RITMO[estado].cobertura}`);
}
confere("ACEITE 3.3: todos os depósitos, nos três perfis, têm o tamanho da mensagem curta", Object.values(vidas).every((v) => v.every((d) => d.tamanho === TAMANHO_CURTO)));
confere("cobertura: o pacote falso tem o tamanho da mensagem curta da conversa a dois", agenda.TAMANHO_DA_COBERTURA === TAMANHO_CURTO);
confere("cabeçalhos: os dois apps mandam os mesmos (sem Origin)", JSON.stringify(PERFIS.android.cabecalhos) === JSON.stringify(PERFIS.computador.cabecalhos) && !("Origin" in ritmo.CABECALHOS_DOS_APPS));
confere("cabeçalhos: sem Accept-Language nem nada que diga a pessoa (só User-Agent alumia/1 e Accept)", JSON.stringify(Object.keys(ritmo.CABECALHOS_DOS_APPS).sort()) === JSON.stringify(["Accept", "User-Agent"]) && ritmo.CABECALHOS_DOS_APPS["User-Agent"] === "alumia/1");
confere("cabeçalhos: a mixnet manda os mesmos dos apps", JSON.stringify(CABECALHOS_PELA_MIXNET) === JSON.stringify(ritmo.CABECALHOS_DOS_APPS));

// ── ACEITE 2: a mensagem de verdade não se distingue da cobertura ───────────────────────────────────────────────────────────
// Uma conversa animada: uma mensagem a cada 2 min (média) com a tela aberta, para 2 aparelhos da outra pessoa.
const comMensagens = await viver("android", { mensagens: 120_000, aparelhos: 2 });
const soCobertura = vidas.android;
const deVerdade = comMensagens.filter((d) => d.deVerdade);
confere("mensagens: saíram muitas de verdade (≥ 600 depósitos)", deVerdade.length >= 600, String(deVerdade.length));
for (const estado of ["aberto", "fundo"]) {
  const r = ks(intervalos(comMensagens, estado), intervalos(soCobertura, estado));
  confere(`ACEITE 3.3 (${estado}): com e sem mensagens de verdade, os intervalos têm a mesma distribuição (KS p > 0,01)`, r.p > 0.01, `D=${r.d.toFixed(4)} p=${r.p.toFixed(4)}`);
}
const horasAbertas = ROTEIRO.filter((p) => p.estado === "aberto").reduce((n, p) => n + p.horas, 0);
const esperado = (horasAbertas * H) / RITMO.aberto.cobertura;
const contar = (v) => v.filter((d) => d.estado === "aberto").length;
confere("ACEITE 3.3: com mensagens de verdade, o número de depósitos por hora não sobe (dentro de 4 desvios do esperado)",
  Math.abs(contar(comMensagens) - esperado) < 4 * Math.sqrt(esperado) && Math.abs(contar(soCobertura) - esperado) < 4 * Math.sqrt(esperado),
  `${contar(comMensagens)} e ${contar(soCobertura)} contra ${Math.round(esperado)}`);
// O teto: com uma mensagem esperando, nunca passa mais de 30 s sem depósito (contando do momento em que ela entrou na fila).
{
  let pior = 0;
  for (const d of deVerdade) {
    const entrou = Math.floor(d.desde);
    let antes = entrou;
    for (const x of comMensagens) {
      if (x.t <= entrou) continue;
      if (x.t > d.t) break;
      pior = Math.max(pior, x.t - antes);
      antes = x.t;
    }
  }
  confere("teto: com mensagem de verdade esperando, nunca passaram mais de 30 s sem depósito", pior <= RITMO.tetoDeEspera, `pior ${pior} ms`);
}
const forcadas = deVerdade.filter((d) => d.espera >= RITMO.tetoDeEspera).length;
const gaps = comMensagens.slice(1).map((d, i) => d.t - comMensagens[i].t);
confere("sem rajada: nunca dois depósitos a menos de 1 s (as 3 cópias de uma mensagem saem em instantes diferentes)", Math.min(...gaps) >= RITMO.minimo, `menor ${Math.min(...gaps)} ms`);
{
  const esperas = deVerdade.map((d) => d.espera).sort((a, b) => a - b);
  console.log(`  (mensagens de verdade: ${deVerdade.length}; espera mediana ${esperas[esperas.length >> 1]} ms; ${forcadas} saíram pelo teto de 30 s)`);
}

// ── A taxa muda com o estado ───────────────────────────────────────────────────────────────────────────────────────────────
{
  agora = 0;
  timers.length = 0;
  ritmo.pararRitmo();
  ritmo.definirEstado("fundo");
  const marcas = [];
  const parar = ritmo.ligarRitmo(async () => void marcas.push(agora));
  await rodarAte(30_000);
  ritmo.definirEstado("aberto");
  await rodarAte(30_000 + RITMO.aberto.cobertura * RITMO.vezesAMedia);
  confere("estado: ao voltar do fundo, o depósito seguinte sai com a taxa nova (não espera o sorteio do fundo)", marcas.some((t) => t > 30_000));
  parar();
  confere("parar: depois de parado, o ritmo não está ligado e nada fica na fila", !ritmo.ritmoLigado() && ritmo.naFilaDoRitmo() === 0);
}
{
  // Parar com mensagens na fila: saem na hora (não se perde mensagem).
  agora = 0;
  timers.length = 0;
  ritmo.definirEstado("bateria_fraca");
  const saiu = [];
  const parar = ritmo.ligarRitmo(async () => undefined);
  const p = Promise.all([1, 2].map((k) => ritmo.enfileirarDeVerdade(async () => void saiu.push(k))));
  confere("fila: duas mensagens esperam o instante", ritmo.naFilaDoRitmo() === 2);
  parar();
  await p;
  confere("parar: as que esperavam saem na hora, na ordem", saiu.join() === "1,2");
  confere("sem ritmo: a mensagem sai na hora", (await ritmo.enfileirarDeVerdade(async () => "já")) === "já");
}

// ── As buscas ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  agora = 0;
  timers.length = 0;
  ritmo.definirEstado(null);
  ritmo.definirBateria(false);
  aVista = true;
  const buscas = { a: [], b: [], c: [] };
  const paradas = Object.keys(buscas).map((k) => agenda.agendarBusca(async () => void buscas[k].push(agora)));
  await rodarAte(30 * RITMO.aberto.busca);
  const fixos = Object.values(buscas).every((l) => l.length >= 28 && l.slice(1).every((t, i) => t - l[i] === RITMO.aberto.busca));
  confere("buscas: cada caixa em intervalo FIXO do estado (aberto: 60 s)", fixos, JSON.stringify(Object.values(buscas).map((l) => l.length)));
  const fases = Object.values(buscas).map((l) => l[0] % RITMO.aberto.busca);
  confere("buscas: cada caixa num ponto sorteado do intervalo (as três em horários diferentes)", new Set(fases).size === 3, JSON.stringify(fases));
  aVista = false;
  const antes = buscas.a.length;
  await rodarAte(agora + RITMO.aberto.busca + 3 * RITMO.fundo.busca);
  const novas = buscas.a.slice(antes + 1);
  confere("buscas: em segundo plano, o intervalo é o do fundo (15 min)", novas.length >= 2 && novas.slice(1).every((t, i) => t - novas[i] === RITMO.fundo.busca), JSON.stringify(novas.slice(0, 4)));
  paradas.forEach((p) => p());
  const depois = buscas.a.length;
  await rodarAte(agora + 2 * RITMO.fundo.busca);
  confere("buscas: parada, a caixa não é mais buscada", buscas.a.length === depois);
  confere("agenda: o intervalo de busca é o do ritmo", agenda.INTERVALO_A_VISTA_MS === RITMO.aberto.busca && agenda.INTERVALO_FUNDO_MS === RITMO.fundo.busca);
}

// ── O chat a dois busca pela agenda; a tela não desliga a cobertura ─────────────────────────────────────────────────────────
const ler = (f) => fs.readFileSync(path.join(import.meta.dirname, "..", f), "utf8");
{
  const nav = ler("lib/rede/chat/r2/navegador.ts");
  const chaveiro = ler("lib/rede/chat-chaveiro.ts");
  const servico = ler("lib/rede/chat/r2/servico.ts");
  confere("chat a dois: o relógio do chat liga a agenda de cada caixa (vigiarCaixas → agendarBusca)", /function ligarRelogio[\s\S]*?vigiarCaixas\(chat\)/.test(nav) && /agendarBusca\(async/.test(nav));
  confere("chat a dois: com a agenda ligada, a tela não puxa as caixas (receberMensagens só lê o histórico)", /if \(agendaLigada\(c\)\) return 0;/.test(chaveiro));
  confere("chat a dois: as caixas vigiadas são pedidos, sincronia e cada conversa, uma por vez", /caixasVigiadas\(\): string\[\]/.test(servico) && /async receberCaixa\(qual: string\)/.test(servico));
  const transporte = ler("lib/rede/chat/r2/transporte-das-caixas.ts");
  confere("chat a dois: cada depósito de verdade passa pelo ritmo (no lugar de um pacote de cobertura)", /enfileirarDeVerdade\(\(\) => cliente\.depositar\(/.test(transporte));
  const ajustes = ler("components/rede/chat/Ajustes.tsx");
  const tela = ler("components/rede/chat/Tela.tsx");
  confere("tela: a cobertura é sempre ligada (sem caixa de marcar nos ajustes)", !/mudarCobertura|coberturaLigada/.test(ajustes) && /cobertura\(true\)/.test(tela) && /observarBateria\(\)/.test(tela));
  const codigo = ler("lib/rede/caixas/ritmo.ts");
  confere("sorteio: o ritmo não usa Math.random", !/Math\.random/.test(codigo.replace(/\/\/.*$/gm, "")));
}

Object.defineProperty(globalThis, "crypto", { configurable: true, value: real });
for (const f of falhas) console.log("FALHA:", f);
console.log(`${certos} certos, ${falhas.length} falhas`);
process.exit(falhas.length ? 1 : 0);
