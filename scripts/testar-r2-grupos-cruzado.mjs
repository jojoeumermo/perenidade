// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Teste cruzado do MLS (docs/rede/POSTS-RESTRITOS.md): o OpenMLS do @wireapp/core-crypto não expõe as funções internas, então os vetores
// do RFC 9420 não rodam contra ele pela API. Em troca, o grupo é feito entre ele e a ts-mls (que passa nos vetores da IETF), na
// suíte clássica 1 (MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519, a única que as duas têm em comum): boas-vindas de uma abrindo na
// outra, mensagens nos dois sentidos, commit de troca de chave da OpenMLS lido pela ts-mls, a mesma época dos dois lados, e uma
// mensagem mexida recusada pelas duas. Se as duas concordam byte a byte no protocolo, a OpenMLS segue o RFC nos pontos testados.
// Uso: npm run testar:r2-grupos-cruzado
import * as T from "ts-mls";
import { motorNoNode } from "./cifra-no-node.mjs";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (conferir(valor)) certos++;
    else falhas.push(`${nome}: veio ${String(JSON.stringify(valor, (_, v) => (typeof v === "bigint" ? v.toString() : v)))?.slice(0, 200)}`);
    return valor;
  } catch (erro) {
    falhas.push(`${nome}: ${erro?.message ?? erro}`);
    return undefined;
  }
}
const texto = new TextEncoder();
const ler = (b) => new TextDecoder().decode(b);
const juntar = (...p) => {
  const s = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
  let i = 0;
  for (const x of p) {
    s.set(x, i);
    i += x.length;
  }
  return s;
};
/** Embrulha bytes crus num MLSMessage (versão mls10 e o formato), se a OpenMLS devolver sem o cabeçalho. */
const comCabecalho = (bytes, formato) => (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === formato ? bytes : juntar(new Uint8Array([0, 1, 0, formato]), bytes));

const M = await motorNoNode();
const SUITE = 1;
const impl = await T.getCiphersuiteImpl(T.getCiphersuiteFromName("MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519"));

// A (ts-mls) cria o grupo.
const grupoId = texto.encode("alumia:cruzado:1");
// A credencial da ts-mls usa o formato de nome que a OpenMLS do Wire exige do remetente ("<conta>:<aparelho>@<domínio>"): com outro
// formato, a OpenMLS recusa a mensagem (conferido: "Supplied client id was not of the format").
const kpA = await T.generateKeyPackage({ credentialType: "basic", identity: texto.encode(`${crypto.randomUUID()}:a1@alumia.invalid`) }, T.defaultCapabilities(), T.defaultLifetime, [], impl);
let estadoA = await T.createGroup(grupoId, kpA.publicPackage, kpA.privatePackage, [], impl);

// B (OpenMLS) faz o pacote de chave na suíte 1.
const cc = M.CoreCrypto.new(M.Database.inMemory());
const suite = M.cipherSuiteFromU16(SUITE);
const idB = new M.ClientId(new M.Uuid(crypto.randomUUID()), new M.DeviceId(7n), "alumia.invalid");
let commitDaOpenMls = null;
const transporte = {
  async sendCommitBundle(pacote) {
    commitDaOpenMls = pacote.commit;
  },
  async prepareForTransport() {
    return new Uint8Array();
  },
};
const refB = await cc.transaction(async (c) => {
  await c.mlsInit(idB, transporte);
  return c.addCredential(M.Credential.basic(suite, idB));
});
const kpB = (await cc.transaction((c) => c.generateKeyPackage(refB))).serialize();
const kpBlido = T.decodeMlsMessage(comCabecalho(kpB, 5), 0)?.[0];
await espera("a ts-mls lê o pacote de chave da OpenMLS (suíte 1, credencial básica)", async () => [kpBlido?.wireformat, kpBlido?.keyPackage?.cipherSuite], ([w, s]) => w === "mls_key_package" && (s === SUITE || s === "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519"));

// A põe B no grupo; B entra pelas boas-vindas da ts-mls.
const r = await T.createCommit({ state: estadoA, cipherSuite: impl }, { extraProposals: [{ proposalType: "add", add: { keyPackage: kpBlido.keyPackage } }], ratchetTreeExtension: true });
estadoA = r.newState;
const welcome = T.encodeMlsMessage({ welcome: r.welcome, wireformat: "mls_welcome", version: "mls10" });
const cid = await espera("a OpenMLS entra no grupo pelas boas-vindas da ts-mls", async () => {
  try {
    return await cc.transaction((c) => c.processWelcomeMessage(new M.Welcome(welcome)));
  } catch {
    return await cc.transaction((c) => c.processWelcomeMessage(new M.Welcome(welcome.subarray(4))));
  }
}, (id) => id && ler(id.copyBytes()) === "alumia:cruzado:1");
await espera("os dois na mesma época (1)", async () => [Number(estadoA.groupContext.epoch), Number(await cc.transaction((c) => c.conversationEpoch(cid)))], ([a, b]) => a === 1 && b === 1);

// Mensagens nos dois sentidos.
const deB = await cc.transaction((c) => c.encryptMessage(cid, texto.encode("oi da OpenMLS")));
const lidoPorA = await espera("a ts-mls abre a mensagem da OpenMLS", async () => {
  const msg = T.decodeMlsMessage(comCabecalho(deB, 2), 0)?.[0];
  const p = await T.processMessage(msg, estadoA, T.emptyPskIndex, T.acceptAll, impl);
  estadoA = p.newState;
  return p.kind === "applicationMessage" ? ler(p.message) : p.kind;
}, (t) => t === "oi da OpenMLS");
void lidoPorA;
const deA = await T.createApplicationMessage(estadoA, texto.encode("oi da ts-mls"), impl);
estadoA = deA.newState;
await espera("a OpenMLS abre a mensagem da ts-mls", async () => {
  const bytes = T.encodeMlsMessage({ privateMessage: deA.privateMessage, wireformat: "mls_private_message", version: "mls10" });
  const d = await cc.transaction((c) => c.decryptMessage(cid, bytes));
  return d.tag === "ApplicationMessage" ? ler(d.inner.plaintext) : null;
}, (t) => t === "oi da ts-mls");

// Mensagem mexida: as duas recusam.
const mexida = new Uint8Array(deB);
mexida[mexida.length - 3] ^= 1;
await espera("mensagem mexida: a ts-mls recusa", async () => {
  try {
    await T.processMessage(T.decodeMlsMessage(comCabecalho(mexida, 2), 0)?.[0], estadoA, T.emptyPskIndex, T.acceptAll, impl);
    return "abriu";
  } catch {
    return "recusou";
  }
}, (x) => x === "recusou");
const deA2 = await T.createApplicationMessage(estadoA, texto.encode("de novo"), impl);
estadoA = deA2.newState;
const bytesA2 = T.encodeMlsMessage({ privateMessage: deA2.privateMessage, wireformat: "mls_private_message", version: "mls10" });
const mexidaA = new Uint8Array(bytesA2);
mexidaA[mexidaA.length - 3] ^= 1;
await espera("mensagem mexida: a OpenMLS recusa (e a íntegra abre depois)", async () => {
  let r1 = "abriu";
  try {
    await cc.transaction((c) => c.decryptMessage(cid, mexidaA));
  } catch {
    r1 = "recusou";
  }
  const d = await cc.transaction((c) => c.decryptMessage(cid, bytesA2));
  return [r1, ler(d.inner.plaintext)];
}, ([a, b]) => a === "recusou" && b === "de novo");
await espera("mensagem repetida: a OpenMLS recusa", async () => {
  try {
    await cc.transaction((c) => c.decryptMessage(cid, bytesA2));
    return "abriu";
  } catch {
    return "recusou";
  }
}, (x) => x === "recusou");

// Commit de troca de chave feito pela OpenMLS, lido pela ts-mls.
await cc.transaction((c) => c.updateKeyingMaterial(cid));
await espera("a ts-mls lê o commit de troca de chave da OpenMLS e as duas vão à época 2", async () => {
  const msg = T.decodeMlsMessage(comCabecalho(commitDaOpenMls, 1), 0)?.[0];
  const p = await T.processMessage(msg, estadoA, T.emptyPskIndex, T.acceptAll, impl);
  estadoA = p.newState;
  return [Number(estadoA.groupContext.epoch), Number(await cc.transaction((c) => c.conversationEpoch(cid)))];
}, ([a, b]) => a === 2 && b === 2);
const deB2 = await cc.transaction((c) => c.encryptMessage(cid, texto.encode("época 2")));
await espera("e a mensagem da época nova abre do outro lado", async () => {
  const p = await T.processMessage(T.decodeMlsMessage(comCabecalho(deB2, 2), 0)?.[0], estadoA, T.emptyPskIndex, T.acceptAll, impl);
  estadoA = p.newState;
  return ler(p.message);
}, (t) => t === "época 2");

// Commit da ts-mls trocando a chave dela, lido pela OpenMLS. Vai como mensagem PÚBLICA do MLS: o grupo do core-crypto recusa commit
// em mensagem privada (conferido logo abaixo), que é a razão do embrulho da Alumia (nada do MLS vai ao servidor sem ele).
const privado = await T.createCommit({ state: estadoA, cipherSuite: impl }, { wireAsPublicMessage: false });
await espera("commit em mensagem privada do MLS: a OpenMLS do core-crypto recusa", async () => {
  try {
    await cc.transaction((c) => c.decryptMessage(cid, T.encodeMlsMessage(privado.commit)));
    return "aceitou";
  } catch {
    return "recusou";
  }
}, (x) => x === "recusou");
const rA = await T.createCommit({ state: estadoA, cipherSuite: impl }, { wireAsPublicMessage: true });
estadoA = rA.newState;
await espera("a OpenMLS lê o commit da ts-mls (época 3)", async () => {
  await cc.transaction((c) => c.decryptMessage(cid, T.encodeMlsMessage(rA.commit)));
  return [Number(estadoA.groupContext.epoch), Number(await cc.transaction((c) => c.conversationEpoch(cid)))];
}, ([a, b]) => a === 3 && b === 3);

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
