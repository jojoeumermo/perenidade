// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o motor dos grupos MLS da R2 (lib/rede/grupos/**) com o motor de verdade (@wireapp/core-crypto, OpenMLS, suíte híbrida
// ML-KEM-768 + X25519) e um servidor de mentira na memória que segue as regras do banco (um commit por época, boas-vindas por
// destinatário, pacotes de chave que saem uma vez). Os ataques estão escritos como teste: servidor que troca pacote, membro que põe
// uma folha falsa, dois commits na mesma época, embrulho de outra época, de outro tipo ou mexido, quem saiu tentando derivar a
// época nova. Uso: npm run testar:r2-grupos-motor
import { motorNoNode } from "./cifra-no-node.mjs";
import { SUITE_MLS } from "../lib/rede/cifra/motor.ts";
import { prepararAparelho } from "../lib/rede/grupos/aparelho.ts";
import { criarMotorDeGrupo, idDoGrupo } from "../lib/rede/grupos/motor-de-grupo.ts";
import { embrulhar, desembrulhar, TIPO, TAMANHOS_DO_EMBRULHO, selar, abrirSelado, epocaDoEmbrulho } from "../lib/rede/grupos/embrulho-da-epoca.ts";
import { segredosDaEpoca, amarraDoGrupo, chaveDaSala } from "../lib/rede/grupos/epoca.ts";
import { lerPacote, impressaoDaChave, lerNome } from "../lib/rede/grupos/pacote.ts";
import { LISTA_DE_ROTULOS } from "../lib/rede/grupos/rotulos-do-motor.ts";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (conferir(valor)) certos++;
    else falhas.push(`${nome}: veio ${String(JSON.stringify(valor, (_, v) => (typeof v === "bigint" ? v.toString() : v)))?.slice(0, 200)}`);
  } catch (erro) {
    falhas.push(`${nome}: ${erro?.message ?? erro}`);
  }
}
async function recusa(nome, promessa, codigo) {
  try {
    await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou`);
  } catch (erro) {
    if (String(erro?.message ?? erro).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro?.message ?? erro}"`);
  }
}
const hex = (b) => Buffer.from(b).toString("hex");
const iguais = (a, b) => a && b && hex(a) === hex(b);

const M = await motorNoNode();

// ── Peças puras ────────────────────────────────────────────────────────────────────────────────────────────────────────────
await espera("os rótulos não se repetem", async () => LISTA_DE_ROTULOS, (l) => new Set(l).size === l.length && l.every((r) => r.startsWith("alumia/r2/mls/")));
const exp = crypto.getRandomValues(new Uint8Array(32));
const gid = idDoGrupo("grupo", "nucleo:x");
const sg = segredosDaEpoca(exp, gid, "grupo");
const se = segredosDaEpoca(exp, idDoGrupo("equipe", "nucleo:x"), "equipe");
const sg2 = segredosDaEpoca(exp, idDoGrupo("grupo", "nucleo:y"), "grupo");
await espera("uma chave por finalidade: embrulho, post e voz todos diferentes", async () => [sg.embrulho, sg.conteudo, sg.voz].map(hex), (l) => new Set(l).size === 3);
await espera("o mesmo segredo dá chaves diferentes no grupo, na equipe e em outro grupo", async () => [hex(sg.embrulho), hex(se.embrulho), hex(sg2.embrulho), hex(sg.conteudo), hex(se.conteudo)], (l) => new Set(l).size === 5);
await espera("as chaves têm 256 bits e a amarração é a do grupo (não muda com a época)", async () => [sg.embrulho.length, sg.conteudo.length, sg.voz.length, hex(sg.amarra) === hex(amarraDoGrupo(gid)), hex(segredosDaEpoca(crypto.getRandomValues(new Uint8Array(32)), gid, "grupo").amarra) === hex(sg.amarra)], (r) => r.join() === "32,32,32,true,true");
await espera("salas de voz diferentes, chaves diferentes", async () => hex(chaveDaSala(sg.voz, gid, "a")) !== hex(chaveDaSala(sg.voz, gid, "b")));
await recusa("segredo exportado de tamanho errado é recusado", async () => segredosDaEpoca(new Uint8Array(31), gid, "grupo"), "segredo_invalido");

const emb = await embrulhar(sg.embrulho, sg.amarra, 7n, TIPO.commit, new Uint8Array([1, 2, 3]));
await espera("o embrulho tem um dos tamanhos fixos e diz a época", async () => [emb.length, epocaDoEmbrulho(emb)], ([n, e]) => TAMANHOS_DO_EMBRULHO.includes(n) && n === 34 + 2048 + 16 && e === 7n);
await espera("o embrulho abre com a chave, o grupo e o tipo certos", async () => desembrulhar(sg.embrulho, sg.amarra, emb, TIPO.commit), (r) => r && r.epoca === 7n && hex(r.bytes) === "010203");
await espera("um commit não passa por mensagem (tipo trocado)", async () => desembrulhar(sg.embrulho, sg.amarra, emb, TIPO.aplicacao), (r) => r === null);
await espera("embrulho de outro grupo não abre", async () => desembrulhar(sg.embrulho, sg2.amarra, emb, TIPO.commit), (r) => r === null);
await espera("embrulho com outra chave (outra época) não abre", async () => desembrulhar(sg2.embrulho, sg.amarra, emb, TIPO.commit), (r) => r === null);
const mexido = new Uint8Array(emb);
mexido[5] ^= 1; // a época escrita
await espera("embrulho com a época mexida não abre", async () => desembrulhar(sg.embrulho, sg.amarra, mexido, TIPO.commit), (r) => r === null);
const cortado = emb.slice(0, emb.length - 1);
await espera("embrulho fora dos tamanhos não abre", async () => desembrulhar(sg.embrulho, sg.amarra, cortado, TIPO.commit), (r) => r === null);
const dois = await embrulhar(sg.embrulho, sg.amarra, 7n, TIPO.commit, new Uint8Array([1, 2, 3]));
await espera("dois embrulhos do mesmo conteúdo são diferentes (nonce sorteado)", async () => hex(dois.subarray(10, 34)) !== hex(emb.subarray(10, 34)) && hex(dois) !== hex(emb));
await recusa("conteúdo acima de 131072 bytes não é embrulhado", () => embrulhar(sg.embrulho, sg.amarra, 1n, TIPO.commit, new Uint8Array(131072)), "grande_demais");
const sel = await selar(sg.conteudo, new TextEncoder().encode("oi"), new TextEncoder().encode("dados"));
await espera("selar/abrir: abre com os mesmos dados amarrados e não abre com outros", async () => [new TextDecoder().decode(await abrirSelado(sg.conteudo, sel, new TextEncoder().encode("dados"))), await abrirSelado(sg.conteudo, sel, new TextEncoder().encode("outros"))], ([a, b]) => a === "oi" && b === null);

// ── Um servidor de mentira com as regras do banco ─────────────────────────────────────────────────────────────────────────
// As regras de 20261124-r2-grupos.sql: o servidor diz quem é do grupo (contas) e quais aparelhos (folhas) cada conta tem; um
// commit por época; boas-vindas por aparelho; pacotes de chave que saem uma vez.
function criarServidor() {
  const grupos = new Map();
  const folhasDe = new Map(); // conta -> Set(nome)
  const pacotesDe = new Map(); // nome -> [pacote]
  const vistos = []; // tudo o que o servidor recebeu nos commits (para conferir o que ele vê)
  let aceitarDuplicado = false;
  const g = (grupo) => {
    if (!grupos.has(grupo)) grupos.set(grupo, { membros: new Set(), commits: new Map(), boas: new Map() });
    return grupos.get(grupo);
  };
  return {
    grupos,
    vistos,
    folhasDe,
    pacotesDe,
    g,
    aceitarDuplicado: (v) => (aceitarDuplicado = v),
    publicar(conta, nome, pacotes) {
      const f = folhasDe.get(conta) ?? new Set();
      f.add(nome);
      folhasDe.set(conta, f);
      pacotesDe.set(nome, [...(pacotesDe.get(nome) ?? []), ...pacotes]);
    },
    transporte(conta, nome) {
      return {
        async estado(grupo, desde) {
          const x = g(grupo);
          if (!x.membros.has(conta)) throw new Error("nao_encontrado");
          const epocas = [...x.commits.keys()];
          return {
            epoca: epocas.length ? Math.max(...epocas) : null,
            membros: [...x.membros],
            folhas: [...x.membros].flatMap((m) => [...(folhasDe.get(m) ?? [])]),
            commits: [...x.commits.entries()].filter(([e]) => e > desde).map(([epoca, corpo]) => ({ epoca, corpo })),
            boasvindas: x.boas.get(nome()) ?? null,
          };
        },
        async pacotes(grupo, faltam) {
          const x = g(grupo);
          if (!x.membros.has(conta)) throw new Error("nao_encontrado");
          const saida = [];
          for (const f of faltam) {
            const lista = pacotesDe.get(f) ?? [];
            if (lista.length) saida.push({ para: f, pacote: lista.shift() });
          }
          return saida;
        },
        async gravarCommit(grupo, epoca, corpo, boasvindas) {
          const x = g(grupo);
          if (!x.membros.has(conta)) throw new Error("nao_encontrado");
          vistos.push({ grupo, epoca, corpo, boasvindas });
          const atual = x.commits.size ? Math.max(...x.commits.keys()) : 0;
          if (epoca !== atual + 1 && !aceitarDuplicado) return "ocupada";
          x.commits.set(epoca, corpo);
          for (const b of boasvindas) x.boas.set(b.para, { epoca, welcome: b.welcome });
          return "ok";
        },
      };
    },
  };
}

const memoria = () => {
  const m = new Map();
  return { ler: async (k) => m.get(k) ?? null, guardar: async (k, v) => void m.set(k, v), apagar: async (k) => void m.delete(k), m };
};
/** A política da rede no motor: confia na primeira chave vista de cada aparelho (nome) e recusa troca de chave no mesmo nome. */
const tofu = () => {
  const vistas = new Map();
  return {
    vistas,
    async aceitarFolha(f) {
      const ja = vistas.get(f.nome);
      if (ja) return ja === f.impressao;
      vistas.set(f.nome, f.impressao);
      return true;
    },
  };
};

const S = criarServidor();
async function pessoa(servidor = S, conta = crypto.randomUUID()) {
  const cc = M.CoreCrypto.new(M.Database.inMemory());
  const aparelho = await prepararAparelho(M, cc, conta);
  const politica = tofu();
  const guarda = memoria();
  const motor = criarMotorDeGrupo({ tipo: "grupo", aparelho: async () => aparelho, transporte: servidor.transporte(conta, () => aparelho.eu.nome), guarda, politica });
  return { conta, cc, aparelho, politica, guarda, motor, nome: aparelho.eu.nome, publicar: async (n = 3) => servidor.publicar(conta, aparelho.eu.nome, await motor.gerarPacotes(n)) };
}

const ana = await pessoa(), bia = await pessoa(), caio = await pessoa(), duda = await pessoa();
await espera("o nome de membro é <conta>:<aparelho>@alumia.invalid", async () => [lerNome(ana.nome), await ana.motor.nome()], ([n, m]) => n?.usuario === ana.conta && m === ana.nome);
const [pkBia] = await bia.motor.gerarPacotes(1);
const lidoBia = lerPacote(pkBia);
await espera("o pacote de chave é lido: suíte híbrida, conta e chave de assinatura", async () => lidoBia, (l) => l && l.suite === SUITE_MLS && l.usuario === bia.conta && l.nome === bia.nome && l.assinatura.length === 32 && l.impressao === impressaoDaChave(l.assinatura));
await espera("pacote cortado ou de outro formato não é lido", async () => [lerPacote(pkBia.slice(0, 40)), lerPacote(new Uint8Array([0, 2, 0, 1])), lerPacote(new Uint8Array(0))], (l) => l.every((x) => x === null));

const G = "nucleo:00000000-0000-4000-8000-000000000001";
const grupoG = S.g(G);
grupoG.membros.add(ana.conta);
await ana.publicar(1);
await espera("quem cria fica sozinho na época 1 (registrada no servidor)", () => ana.motor.sincronizar(G), (r) => r && r.epoca === 1n);
for (const p of [bia, caio]) {
  grupoG.membros.add(p.conta);
  await p.publicar();
}
await espera("bia e caio ainda não estão: sem boas-vindas, não há chave", () => bia.motor.sincronizar(G), (r) => r === null);
const r2 = await ana.motor.sincronizar(G);
await espera("ana põe quem o servidor diz ser do grupo (época 2)", async () => r2, (r) => r?.epoca === 2n);
const rb = await bia.motor.sincronizar(G);
const rc = await caio.motor.sincronizar(G);
await espera("bia e caio entram pelas boas-vindas na mesma época, com os mesmos segredos", async () => [rb?.epoca, rc?.epoca, iguais(rb?.segredos.conteudo, r2.segredos.conteudo), iguais(rc?.segredos.embrulho, r2.segredos.embrulho)], (r) => r[0] === 2n && r[1] === 2n && r[2] && r[3]);
await espera("a árvore tem os três, cada um com a suíte híbrida", async () => [(await ana.motor.folhas(G)).length, Number(await ana.aparelho.operar(null, (c) => c.conversationCipherSuite(new M.ConversationId(idDoGrupo("grupo", G)))))], (r) => r[0] === 3 && r[1] === SUITE_MLS);

// O que o servidor viu dos commits: só embrulhos de tamanho fixo, nunca o commit do MLS nem a GroupInfo.
await espera("o servidor só vê embrulhos de tamanho fixo (nunca a mensagem pública do MLS)", async () => S.vistos.map((v) => [v.corpo.length, v.corpo[0]]), (l) => l.length >= 2 && l.every(([n, m]) => TAMANHOS_DO_EMBRULHO.includes(n) && m === 0x47));
await espera("o que vai ao servidor no commit é só grupo, época, embrulho e boas-vindas (a GroupInfo nunca sai)", async () => S.vistos.map((v) => Object.keys(v).sort().join()), (l) => l.every((k) => k === "boasvindas,corpo,epoca,grupo"));
await espera("o commit embrulhado não traz o nome de ninguém às claras", async () => S.vistos.every((v) => !Buffer.from(v.corpo).toString("latin1").includes("alumia.invalid")));

// ── Remoção ──
grupoG.membros.delete(caio.conta);
const rRem = await bia.motor.sincronizar(G);
await espera("caio saiu: o próximo aparelho que sincroniza tira ele (época 3)", async () => rRem?.epoca, (e) => e === 3n);
await espera("ana chega à época 3 com os mesmos segredos", async () => ana.motor.sincronizar(G), (r) => r?.epoca === 3n && iguais(r.segredos.conteudo, rRem.segredos.conteudo));
// Caio, mesmo com o servidor deixando ler o estado (servidor tomado), não consegue a época nova.
grupoG.membros.add(caio.conta);
await espera("quem saiu não deriva a chave da época nova (lê o commit e perde o grupo)", async () => [await caio.motor.sincronizar(G), await caio.motor.segredosDe(G, 3), await caio.motor.segredosDe(G, 2)], ([r, s3, s2]) => r === null && s3 === null && s2 !== null && !iguais(s2.conteudo, rRem.segredos.conteudo));
grupoG.membros.delete(caio.conta);

// ── Um commit por época ──
const [eA, eB] = await Promise.all([ana.motor.renovar(G), bia.motor.renovar(G)]);
const [fA, fB] = [await ana.motor.sincronizar(G), await bia.motor.sincronizar(G)];
await espera("dois aparelhos trocam a chave ao mesmo tempo: um grava, o outro lê o dele; os dois na mesma época e com os mesmos segredos", async () => [eA, eB, fA?.epoca, fB?.epoca, iguais(fA?.segredos.conteudo, fB?.segredos.conteudo)], (r) => (r[0] === null) !== (r[1] === null) && r[2] === r[3] && r[2] === 4n && r[4]);
await espera("o servidor recebeu o segundo commit da mesma época e recusou (nada se partiu)", async () => S.vistos.filter((v) => v.grupo === G && v.epoca === 4).length, (n) => n === 2);
await espera("a troca de chave dá segredos novos (o aparelho tomado antes deixa de servir)", async () => !iguais(fA.segredos.conteudo, rRem.segredos.conteudo) && !iguais(fA.segredos.embrulho, rRem.segredos.embrulho));

// ── Aparelho que perdeu o estado volta com nome novo ──
// O "Sair rápido" apaga a loja do motor: a bia volta como aparelho novo da mesma conta; os outros tiram a folha velha e põem a nova.
const biaNova = await pessoa(S, bia.conta);
S.folhasDe.get(bia.conta).delete(bia.nome);
await biaNova.publicar(1);
await ana.motor.sincronizar(G); // tira a folha velha (época 5) e põe a nova (época 6)
const rNova = await biaNova.motor.sincronizar(G);
await espera("o aparelho novo da bia entra pelas boas-vindas e a folha velha sai", async () => [rNova?.epoca, (await ana.motor.folhas(G)).map((f) => f.nome).sort().join()], ([e, l]) => e === 6n && l === [ana.nome, biaNova.nome].sort().join());
await espera("a folha velha da bia, se ainda existir em algum lugar, não lê a época nova", async () => [await bia.motor.sincronizar(G), await bia.motor.segredosDe(G, 6)], ([r, s]) => r === null && s === null);

// ── Ataques ──
// 1. O servidor troca o pacote de duda por um feito por outro aparelho com o nome DELA (mesmo nome, outra chave): não entra.
grupoG.membros.add(duda.conta);
await duda.publicar(1);
await ana.politica.aceitarFolha({ ...lerNome(duda.nome), impressao: lerPacote(S.pacotesDe.get(duda.nome)[0]).impressao }); // ana já conhecia a chave do aparelho de duda
const falsa = await pessoa(S, duda.conta);
// Um pacote com o nome do aparelho de duda e outra chave: o motor "falso" é aberto com o mesmo nome (credencial nova).
const ccFalso = M.CoreCrypto.new(M.Database.inMemory());
const nomeDuda = lerNome(duda.nome);
const pkFalso = await ccFalso.transaction(async (c) => {
  const id = new M.ClientId(new M.Uuid(duda.conta), new M.DeviceId(BigInt(`0x${nomeDuda.dispositivo}`)), "alumia.invalid");
  await c.mlsInit(id, { sendCommitBundle: async () => {}, prepareForTransport: async () => new Uint8Array() });
  const ref = await c.addCredential(M.Credential.basic(M.cipherSuiteFromU16(SUITE_MLS), id));
  return (await c.generateKeyPackage(ref)).serialize();
});
S.pacotesDe.set(duda.nome, [pkFalso]);
const antesFalsa = (await ana.motor.folhas(G)).length;
await ana.motor.sincronizar(G);
await espera("o servidor troca a chave do aparelho de duda (mesmo nome, outra chave): ana não põe", async () => [(await ana.motor.folhas(G)).length, (await ana.motor.folhas(G)).some((f) => f.usuario === duda.conta)], (r) => r[0] === antesFalsa && r[1] === false);
// 2. O servidor entrega o pacote de outra conta no lugar do de duda.
S.pacotesDe.set(duda.nome, [(await caio.motor.gerarPacotes(1))[0]]);
await ana.motor.sincronizar(G);
await espera("o servidor entrega o pacote de caio dizendo que é do aparelho de duda: ninguém entra", async () => (await ana.motor.folhas(G)).map((f) => f.usuario), (l) => !l.includes(caio.conta) && !l.includes(duda.conta));
// 3. O servidor entrega o pacote de um aparelho que ele NÃO anunciou nas folhas (falsa, mesma conta): não entra.
S.pacotesDe.set(duda.nome, [(await falsa.motor.gerarPacotes(1))[0]]);
await ana.motor.sincronizar(G);
await espera("pacote de um aparelho que o servidor não anunciou não entra (o nome não confere com o pedido)", async () => (await ana.motor.folhas(G)).some((f) => f.nome === falsa.nome), (x) => x === false);
// 4. Um membro com um aparelho "esperto" (sem a política) põe no grupo a folha da intrusa com o nome do aparelho de duda; ana, que
// conhecia a chave daquele aparelho, recusa a árvore: grupo_suspeito (e não escreve nada).
const ccIntrusa = M.CoreCrypto.new(M.Database.inMemory());
const pkIntrusa = await ccIntrusa.transaction(async (c) => {
  const id = new M.ClientId(new M.Uuid(duda.conta), new M.DeviceId(BigInt(`0x${nomeDuda.dispositivo}`)), "alumia.invalid");
  await c.mlsInit(id, { sendCommitBundle: async () => {}, prepareForTransport: async () => new Uint8Array() });
  const ref = await c.addCredential(M.Credential.basic(M.cipherSuiteFromU16(SUITE_MLS), id));
  return (await c.generateKeyPackage(ref)).serialize();
});
S.pacotesDe.set(duda.nome, [pkIntrusa]);
await bia.motor.esquecer(G).catch(() => undefined);
await biaNova.motor.sincronizar(G); // biaNova nunca viu o aparelho de duda: aceita na primeira vez e põe
await espera("bia (que nunca viu o aparelho de duda) põe a folha que o servidor deu", async () => (await biaNova.motor.folhas(G)).some((f) => f.usuario === duda.conta));
await recusa("ana, que conhecia a chave daquele aparelho, recusa o grupo: grupo_suspeito", () => ana.motor.sincronizar(G), "grupo_suspeito");
const epocaAntes = Math.max(...S.g(G).commits.keys());
await recusa("grupo_suspeito não deixa a ana renovar nem escrever (nenhum commit sai)", () => ana.motor.renovar(G), "grupo_suspeito");
await espera("e nada foi gravado pela ana depois da suspeita", async () => Math.max(...S.g(G).commits.keys()), (e) => e === epocaAntes);
// 5. Um nome de membro que não é da Alumia (ou repetido) na árvore também é suspeito: o motor não aceita folha sem nome válido.
await espera("lerNome recusa nomes de fora (outro domínio, conta inválida)", async () => [lerNome("x:1@alumia.invalid"), lerNome(`${duda.conta}:1@wire.com`), lerNome(`${duda.conta}:zz@alumia.invalid`)], (l) => l.every((x) => x === null));
// 6. Dois commits aceitos na mesma época por um servidor desonesto: cada aparelho fica numa época diferente com o mesmo número.
// O teste mostra o limite: o aparelho não lê o commit do outro (grupo_invalido), em vez de aceitar em silêncio.
const P = "nucleo:00000000-0000-4000-8000-000000000003";
const S2 = criarServidor();
const k1 = await pessoa(S2), k2 = await pessoa(S2);
S2.g(P).membros.add(k1.conta);
await k1.publicar(1);
await k1.motor.sincronizar(P);
S2.g(P).membros.add(k2.conta);
await k2.publicar(1);
await k1.motor.sincronizar(P);
await k2.motor.sincronizar(P);
S2.aceitarDuplicado(true);
await Promise.all([k1.motor.renovar(P), k2.motor.renovar(P)]); // os dois gravam a época 3 (o servidor desonesto aceita os dois)
S2.aceitarDuplicado(false);
await espera("servidor desonesto: os dois aparelhos ficaram em épocas 3 diferentes (o grupo se partiu)", async () => [await k1.motor.segredosDe(P, 3), await k2.motor.segredosDe(P, 3)], ([a, b]) => a && b && !iguais(a.conteudo, b.conteudo));
await recusa("e o aparelho do outro lado acusa no commit seguinte (não aceita em silêncio)", async () => {
  await k1.motor.renovar(P);
  await k2.motor.sincronizar(P);
}, "grupo_invalido");
// 7. O servidor reenvia um commit velho como se fosse da época seguinte: o embrulho é da época anterior, não abre.
const Q = "nucleo:00000000-0000-4000-8000-000000000004";
const S3 = criarServidor();
const q1 = await pessoa(S3), q2 = await pessoa(S3);
S3.g(Q).membros.add(q1.conta);
await q1.publicar(1);
await q1.motor.sincronizar(Q);
S3.g(Q).membros.add(q2.conta);
await q2.publicar(1);
await q1.motor.sincronizar(Q);
await q2.motor.sincronizar(Q);
await q1.motor.renovar(Q);
const velho = S3.g(Q).commits.get(2);
S3.g(Q).commits.set(3, velho);
await recusa("commit velho reenviado como o da época seguinte não abre (grupo_invalido)", () => q2.motor.sincronizar(Q), "grupo_invalido");

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
