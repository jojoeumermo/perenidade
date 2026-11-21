// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O Farol do ato pela malha sem internet, de ponta a ponta no aparelho (onda R3, item 2.2; lib/rede/malha/atos.ts): o material do
// ato buscado com internet (um banco de mentira que responde como public.rede_ato_farol_material), a malha ligada com o aviso, e o
// farol de duas pessoas da coordenação passando por um aparelho que só repassa até quem confirmou presença. Os ataques como teste:
//   - material torto, nulo (sem presença) ou com erro de rede: o aparelho não guarda nada;
//   - farol com uma assinatura só (pedido), com chave de fora da lista, de ato que o aparelho não guardou, ou mais velho que o
//     último: não aparece na tela;
//   - quem repassa (sem o material) não reconhece o farol e não o mostra;
//   - o material fica só na memória: esquecer (sair, pânico) apaga, e o limite de atos guardados vale.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r3-malha-atos.mjs
import { sortear } from "../lib/rede/chat/r2/bytes.ts";
import { montarFarol, VALIDADE_PADRAO } from "../lib/rede/malha/pacote.ts";
import { assinarFarol, codificarFarol, chaveDoFarol } from "../lib/rede/malha/farol.ts";
import { NoDaMalha } from "../lib/rede/malha/no.ts";
import { RedeSimulada } from "../lib/rede/malha/simulado.ts";
import { ligarMalha, desligarMalha, noDaMalha, _paraTestes } from "../lib/rede/malha/ativacao.ts";
import {
  ATOS_MAXIMO, lerMaterial, buscarAto, atosGuardados, esquecerAto, esquecerAtos, farolSemInternet, aoFarolSemInternet,
} from "../lib/rede/malha/atos.ts";

let certos = 0;
const falhas = [];
const confere = (nome, ok, detalhe = "") => (ok ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const b64 = (b) => Buffer.from(b).toString("base64");
const ID = "6f1c2a4e-9b7d-4c3a-8e21-0d5f7a9b1c3e";
const ID2 = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const bytesDoId = (id) => new Uint8Array(Buffer.from(id.replace(/-/g, ""), "hex"));

// A coordenação: duas pessoas com a chave do farol publicada, mais seis linhas falsas (a lista tem sempre 8).
const kAto = sortear(32);
const s1 = sortear(32);
const s2 = sortear(32);
const sFora = sortear(32);
const lista = [chaveDoFarol(s1), chaveDoFarol(s2), ...Array.from({ length: 6 }, () => sortear(32))];
const material = { k_ato: b64(kAto), chaves: lista.map((c) => ({ chave: b64(c), assinatura: b64(sortear(64)) })) };
/** O banco de mentira: confirmou = recebe o material; senão nulo (como o de verdade). */
const banco = (confirmou) => async (f, a) => {
  if (f !== "rede_ato_farol_material") throw new Error("funcao_errada");
  if (a.p_ato !== ID && a.p_ato !== ID2) throw new Error("ato_errado");
  return confirmou ? material : null;
};

// ═══════════════════ 1. O material ═══════════════════
confere("material bom: 32 bytes e 8 chaves", (() => {
  const m = lerMaterial(ID, material);
  return m && m.kAto.length === 32 && m.chaves.length === 8 && Buffer.from(m.ato).equals(Buffer.from(bytesDoId(ID)));
})());
for (const [nome, torto] of [
  ["nulo", null],
  ["texto", "x"],
  ["k_ato curta", { ...material, k_ato: b64(sortear(31)) }],
  ["k_ato não é base64", { ...material, k_ato: "@@@@" }],
  ["chave curta", { ...material, chaves: [{ chave: b64(sortear(31)) }] }],
  ["chaves não é lista", { ...material, chaves: "x" }],
  ["chaves demais", { ...material, chaves: Array.from({ length: 65 }, () => ({ chave: b64(sortear(32)) })) }],
]) confere(`material torto (${nome}) não é guardado`, lerMaterial(ID, torto) === null);
confere("id de ato torto não é guardado", lerMaterial("nao-e-uuid", material) === null);

confere("sem presença confirmada (nulo): nada guardado", (await buscarAto(banco(false), ID)) === false && atosGuardados().length === 0);
confere("erro de rede: nada guardado", (await buscarAto(async () => { throw new Error("rede"); }, ID)) === false && atosGuardados().length === 0);
confere("com presença: guardado", (await buscarAto(banco(true), ID)) === true && atosGuardados().length === 1);
confere("buscar de novo não duplica", (await buscarAto(banco(true), ID.toUpperCase())) === true && atosGuardados().length === 1);

// ═══════════════════ 2. Ponta a ponta pela malha: coordenação → quem repassa → quem confirmou ═══════════════════
const rede = new RedeSimulada();
const tBia = rede.aparelho();
_paraTestes(() => tBia);
ligarMalha({ celularesProximosPercebem: true });
const bia = noDaMalha();
confere("a malha da Bia ligou", bia !== null);
const vistos = [];
const parar = aoFarolSemInternet((ato, f) => vistos.push({ ato, f }));

const coord = { t: rede.aparelho() };
coord.no = new NoDaMalha(coord.t, async () => false);
coord.no.ligar();
const repassa = { t: rede.aparelho() };
const doRepasse = [];
repassa.no = new NoDaMalha(repassa.t, async (p) => (doRepasse.push(p), false));
repassa.no.ligar();

const agora = Math.floor(Date.now() / 1000);
const conteudo = (estado, quando, ato = ID) => ({ ato: bytesDoId(ato), estado, texto: estado === "ponto2" ? "Praça do lado" : "", quando });
const pacoteDe = async (f) => montarFarol(kAto, codificarFarol(f), VALIDADE_PADRAO);

async function passar(p) {
  coord.no.guardar(p);
  await rede.encontrar(coord.t, repassa.t);
  await rede.encontrar(repassa.t, tBia);
}

await passar(await pacoteDe(assinarFarol(assinarFarol(conteudo("dispersar", agora - 60), s1), s2)));
confere("o farol de duas pessoas chega à Bia por quem repassa", vistos.length === 1 && vistos[0].ato === ID && vistos[0].f.estado === "dispersar", JSON.stringify(vistos.map((v) => v.f.estado)));
confere("farolSemInternet devolve o último", farolSemInternet(ID)?.estado === "dispersar");
confere("quem repassa recebeu o pacote mas não tem como abrir (sem o material)", doRepasse.length >= 1);

await passar(await pacoteDe(assinarFarol(conteudo("tranquilo", agora - 30), s1)));
confere("uma assinatura só (pedido): não aparece", vistos.length === 1 && farolSemInternet(ID)?.estado === "dispersar");

await passar(await pacoteDe(assinarFarol(assinarFarol(conteudo("tranquilo", agora - 20), s1), sFora)));
confere("chave de fora da lista: não aparece", vistos.length === 1);

await passar(await pacoteDe(assinarFarol(assinarFarol(conteudo("tranquilo", agora - 120), s1), s2)));
confere("farol mais velho que o último: não volta o estado", vistos.length === 1 && farolSemInternet(ID)?.estado === "dispersar");

await passar(await pacoteDe(assinarFarol(assinarFarol(conteudo("ponto2", agora - 10), s2), s1)));
confere("farol novo das duas vale", vistos.length === 2 && farolSemInternet(ID)?.estado === "ponto2" && farolSemInternet(ID)?.texto === "Praça do lado");

await passar(await pacoteDe(assinarFarol(assinarFarol(conteudo("atencao", agora - 5, ID2), s1), s2)));
confere("farol de outro ato (que a Bia não guardou), mesmo com k_ato: não aparece", vistos.length === 2 && farolSemInternet(ID2) === null);

// ═══════════════════ 3. Esquecer e o limite ═══════════════════
esquecerAto(ID);
confere("esquecer o ato apaga o material e o farol", atosGuardados().length === 0 && farolSemInternet(ID) === null);
await passar(await pacoteDe(assinarFarol(assinarFarol(conteudo("atencao", agora - 1), s1), s2)));
confere("sem o material, o farol não é reconhecido", vistos.length === 2);

const chamarMuitos = async (_f, a) => (a.p_ato ? material : null);
for (let i = 0; i < ATOS_MAXIMO + 3; i++) await buscarAto(chamarMuitos, `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
confere(`no máximo ${ATOS_MAXIMO} atos guardados`, atosGuardados().length === ATOS_MAXIMO);
esquecerAtos();
confere("esquecer todos", atosGuardados().length === 0);

parar();
desligarMalha();
coord.no.desligar();
repassa.no.desligar();
_paraTestes(null);

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  FALHOU: ${f}`);
process.exit(falhas.length ? 1 : 0);
