// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a sala de voz cifrada (lib/rede/voz/sala.ts, lib/rede/voz/retransmissao.ts e a chave de voz do MLS em
// lib/rede/grupo-mls.ts) no Node, com conexões de mentira (o Node não tem WebRTC) e o MLS de verdade num Postgres local: só
// quem é do grupo combina a chamada, recado mexido ou velho é descartado, a conexão é sempre por retransmissão (nenhum
// candidato com o endereço da pessoa é usado), quem liga é sempre o de id menor, a sala tem teto, e as contas do TURN.
// Uso: npm run testar:voz
import { createHmac } from "node:crypto";
import { criarBanco } from "./banco-local.mjs";
import { criarChaveiroDeGrupo } from "../lib/rede/grupo-mls.ts";
import { abrirRecado, criarSalaDeVoz, MAXIMO_NA_SALA, selarRecado } from "../lib/rede/voz/sala.ts";
import { doCoturn, soTurn } from "../lib/rede/voz/retransmissao.ts";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (conferir(valor)) certos++;
    else falhas.push(`${nome}: veio ${JSON.stringify(valor)?.slice(0, 200)}`);
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}

// ── O MLS de verdade: Ana e Bia no núcleo, a intrusa fora ──
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const P = {};
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of ["ana", "bia", "intrusa"]) {
  P[nome] = await criarUsuario(`${nome}@voz.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1, rede_handle = $2 where id = $1", [P[nome], `${nome}_voz`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
const nucleo = (await (await dono("insert into interno.rede_nucleos (nome) values ('Núcleo da voz') returning id")).rows[0]).id;
for (const nome of ["ana", "bia"]) await dono("insert into interno.rede_nucleo_membros (nucleo, usuario) values ($1, $2)", [nucleo, P[nome]]);
const GRUPO = `nucleo:${nucleo}`;
const memoria = () => { const m = new Map(); return { ler: async (k) => m.get(k) ?? null, guardar: async (k, v) => void m.set(k, v), apagar: async (k) => void m.delete(k) }; };
const ch = {};
for (const nome of ["ana", "bia", "intrusa"]) ch[nome] = criarChaveiroDeGrupo({ chamar: (f, a) => rpc(como(P[nome]), f, a), guarda: memoria() });
await ch.bia.preparar(P.bia);
const kAna = await ch.ana.chaveDeVoz(GRUPO, P.ana, "estudo");
const kBia = await ch.bia.chaveDeVoz(GRUPO, P.bia, "estudo");
await espera("Ana e Bia (do núcleo) chegam à mesma chave da sala, na mesma época", async () => {
  const r = await selarRecado(kAna.chave, kAna.epoca, "s", { de: "a", para: null, tipo: "ola", quando: Date.now() });
  return [kAna.epoca === kBia.epoca, (await abrirRecado(kBia.chave, "s", r))?.tipo];
}, (r) => r[0] && r[1] === "ola");
await espera("a intrusa (fora do núcleo) não consegue a chave", () => ch.intrusa.chaveDeVoz(GRUPO, P.intrusa, "estudo").then((k) => k, (e) => e.message), (r) => r === null || /nao_encontrado/.test(String(r)));
await espera("outra sala do mesmo grupo tem outra chave", async () => {
  const outra = await ch.bia.chaveDeVoz(GRUPO, P.bia, "outra");
  const r = await selarRecado(kAna.chave, kAna.epoca, "s", { de: "a", para: null, tipo: "ola", quando: Date.now() });
  return abrirRecado(outra.chave, "s", r);
}, (r) => r === null);

// ── Recados ──
const k = kAna.chave;
await espera("recado mexido não abre", async () => {
  const r = await selarRecado(k, 1, "s", { de: "a", para: null, tipo: "ola", quando: Date.now() });
  return abrirRecado(k, "s", { ...r, ct: r.ct.slice(0, -4) + (r.ct.endsWith("AAAA") ? "BBBB" : "AAAA") });
}, (r) => r === null);
await espera("recado de outra sala (mesma chave) não abre", async () => abrirRecado(k, "outra", await selarRecado(k, 1, "s", { de: "a", para: null, tipo: "ola", quando: Date.now() })), (r) => r === null);
await espera("recado velho (regravado depois de 1 minuto) é descartado", async () => abrirRecado(k, "s", await selarRecado(k, 1, "s", { de: "a", para: null, tipo: "ola", quando: Date.now() - 120_000 })), (r) => r === null);

// ── A sala com conexões de mentira ──
class ConexaoDeMentira {
  constructor(config) { this.config = config; this.signalingState = "stable"; this.connectionState = "new"; this.candidatos = []; this.faixas = []; }
  addTrack(f) { this.faixas.push(f); }
  async createOffer() { return { type: "offer", sdp: "v=0 oferta" }; }
  async createAnswer() { return { type: "answer", sdp: "v=0 resposta" }; }
  async setLocalDescription(d) { this.local = d; if (d.type === "offer") this.signalingState = "have-local-offer"; else this.signalingState = "stable"; }
  async setRemoteDescription(d) { this.remota = d; if (d.type === "answer") this.signalingState = "stable"; }
  async addIceCandidate(c) { this.candidatos.push(c); }
  close() { this.connectionState = "closed"; }
}
const ondas = new Set();
const fazerCanal = () => {
  const meus = [];
  const canal = { enviar: async (b) => { for (const c of ondas) if (c !== canal) for (const o of c.ouvintes) o(b); }, aoReceber: (f) => void meus.push(f), sair: async () => void ondas.delete(canal), ouvintes: meus };
  ondas.add(canal);
  return canal;
};
const chaveFixa = (kk) => ({ atual: async () => kk, daEpoca: async (e) => (e === kk.epoca ? kk.chave : null) });
const conexoes = { a: [], b: [] };
const espere = () => new Promise((r) => setTimeout(r, 30));
const fluxo = { getAudioTracks: () => [{ enabled: true }], getTracks: () => [{ stop() {} }] };
await espera("sem servidor de retransmissão, a sala não abre", async () => { try { criarSalaDeVoz({ eu: "x", sala: "s", chave: chaveFixa(kAna), canal: fazerCanal(), iceServers: [] }); return "abriu"; } catch (e) { return e.message; } }, (m) => m === "voz_sem_retransmissao");
const turn = [{ urls: ["turn:retransmissao.exemplo:3478"], username: "u", credential: "c" }];
const salaA = criarSalaDeVoz({ eu: P.ana, sala: "s", chave: chaveFixa(kAna), canal: fazerCanal(), iceServers: turn, novaConexao: (c) => { const x = new ConexaoDeMentira(c); conexoes.a.push(x); return x; } });
const salaB = criarSalaDeVoz({ eu: P.bia, sala: "s", chave: chaveFixa(kBia), canal: fazerCanal(), iceServers: turn, novaConexao: (c) => { const x = new ConexaoDeMentira(c); conexoes.b.push(x); return x; } });
await salaA.entrar(fluxo);
await espere();
await salaB.entrar(fluxo);
await espere();
await espere();
await espera("Ana e Bia se ligam: uma conexão de cada lado, oferta e resposta trocadas", async () => [conexoes.a.length, conexoes.b.length, conexoes.a[0]?.remota?.type, conexoes.b[0]?.remota?.type], (r) => r[0] === 1 && r[1] === 1 && r.slice(2).sort().join() === "answer,offer");
await espera("quem liga é quem tem o id menor (os dois não ligam ao mesmo tempo)", async () => (P.ana < P.bia ? conexoes.a[0].local?.type : conexoes.b[0].local?.type), (t) => t === "offer");
await espera("toda conexão é só por retransmissão (relay)", async () => [...conexoes.a, ...conexoes.b].every((c) => c.config.iceTransportPolicy === "relay"), (v) => v === true);
// Candidatos: só o de retransmissão é aceito.
const canalDaIntrusa = fazerCanal();
for (const tipo of ["host", "srflx", "relay"]) {
  await canalDaIntrusa.enviar(await selarRecado(kAna.chave, kAna.epoca, "s", { de: P.ana, para: P.bia, tipo: "ice", candidato: { candidate: `candidate:1 1 udp 1 203.0.113.9 5000 typ ${tipo}`, sdpMid: "0" }, quando: Date.now() }));
}
await espere();
await espera("candidato com o endereço da pessoa (host, srflx) nunca é usado; só o de retransmissão", async () => conexoes.b[0].candidatos.map((c) => / typ (\w+)/.exec(c.candidate)[1]), (l) => l.join() === "relay");
// A intrusa (sem a chave) tenta se meter: manda uma oferta com a chave errada.
const kFalsa = { epoca: kAna.epoca, chave: await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]) };
await canalDaIntrusa.enviar(await selarRecado(kFalsa.chave, kFalsa.epoca, "s", { de: P.intrusa, para: null, tipo: "oferta", sdp: "v=0 falsa", quando: Date.now() }));
await espere();
await espera("quem não tem a chave do grupo não consegue se meter na ligação", async () => [conexoes.a.length, conexoes.b.length], (r) => r[0] === 1 && r[1] === 1);
await salaB.sair();
await espere();
await espera("sair desliga a ligação do outro lado", async () => salaA.participantes().length, (n) => n === 0);
await espera("a sala tem teto de 8 pessoas", async () => MAXIMO_NA_SALA, (n) => n === 8);

// ── As contas do TURN ──
await espera("coturn: usuário com validade e senha HMAC-SHA1 do segredo", async () => doCoturn(["turn:x:3478", "stun:x:3478"], "segredo", 1_000_000_000_000), (l) => {
  const s = l[0];
  return l.length === 1 && s.urls.length === 1 && s.urls[0] === "turn:x:3478" && s.username === "1000003600:alumia" && s.credential === createHmac("sha1", "segredo").update("1000003600:alumia").digest("base64");
});
await espera("só servidores TURN passam (STUN e sem senha ficam de fora)", async () => soTurn([{ urls: "stun:x" , username: "u", credential: "c" }, { urls: ["turns:y:443"] }, { urls: ["turns:y:443", "stun:y"], username: "u", credential: "c" }]), (l) => l.length === 1 && l[0].urls.join() === "turns:y:443");

console.log(`${certos} conferências certas${falhas.length ? `, ${falhas.length} com problema.` : "."}`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
