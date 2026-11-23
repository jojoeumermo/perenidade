// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, o que a R2 deixou (14): o certificado das folhas MLS dos grupos da rede (supabase/migracoes/20261125-r3-resto-r2.sql,
// lib/rede/grupos/certificado.ts, lib/rede/grupos/chaveiro.ts), num Postgres local, com o motor de verdade (@wireapp/core-crypto) e o
// registro público de chaves de verdade (rede_kt, alimentado pelo gatilho do diretório; lib/rede/chat/transparencia.ts). Prova:
//   - a folha só é publicada com o certificado; as folhas de antes, sem certificado, saem;
//   - ponta a ponta: com os certificados assinados pela identidade de cada conta, o grupo funciona como antes;
//   - ATAQUES do servidor (aparelho-fantasma de uma conta listada): sem certificado que confira, com certificado de outra conta, com
//     certificado de outra folha, com o pacote de outra chave no lugar do pacote certo, com a identidade do próprio servidor (fora do
//     registro): o grupo recusa (o fantasma não recebe boas-vindas e não lê o post);
//   - aparelho novo de conta já vista: entra com AVISO FORTE; identidade trocada no registro: o aviso diz;
//   - sem a identidade do chat neste aparelho: "sem_identidade" (nada publicado sem certificado);
//   - a identidade só assina o texto do voto e o da folha.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r3-resto-folhas.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ed25519 } from "@noble/curves/ed25519.js";
import { criarBanco } from "./banco-local.mjs";
import { motorNoNode } from "./cifra-no-node.mjs";
import { criarChaveiroDeGrupo } from "../lib/rede/grupos/chaveiro.ts";
import { lerNome, lerPacote } from "../lib/rede/grupos/pacote.ts";
import { SUITE_MLS } from "../lib/rede/cifra/motor.ts";
import { certificadoDaFolhaConfere, lerCertificado, montarCertificado, ROTULOS, textoDaFolha } from "../lib/rede/grupos/certificado.ts";
import { assinarTextoDoVoto, novoParEd25519 } from "../lib/rede/chat/r2/certificados.ts";
import { atualizarVista, conferirConta, INICIO } from "../lib/rede/chat/transparencia.ts";
import { cifrarParaOGrupo } from "../components/rede/publicar/restrito/grupo.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = fs.readFileSync(path.join(raiz, "supabase/migracoes/20261125-r3-resto-r2.sql"), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 300)}`);
    certos++;
    return valor;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
    return undefined;
  }
}
async function recusa(nome, promessa, codigo) {
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 200)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}
const b64 = (b) => Buffer.from(b).toString("base64");
const sorteio = (n) => crypto.getRandomValues(new Uint8Array(n));

// ═══════════════════ 0. O arquivo e o formato ═══════════════════
ok("a migração tem a parte (14) e termina trancando na porta", /\(14\) O certificado das folhas MLS/.test(sql) && /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("o rótulo da folha é o do desenho da onda", ROTULOS.folha === "alumia/r3/folha-pacote/v1");

// ═══════════════════ 1. O banco ═══════════════════
// Montado até antes desta migração (se ela já estiver colada no install.sql, depois da junção): o estado de antes é o da R2.
const banco = await criarBanco({ antesDe: sql }).catch(() => criarBanco());
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
await dono("update interno.configuracoes set valor = valor || '{\"exigir_2fa\": false}'::jsonb where chave = 'seguranca'").catch(() => undefined);
const P = {};
for (const nome of ["ana", "bia", "caio"]) {
  P[nome] = await criarUsuario(`${nome}@r3f.local`, `Pessoa ${nome}`);
  await rpc({ papel: "authenticated", sub: P[nome] }, "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of Object.keys(P)) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `r3f_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
// Os núcleos não têm mais membros no servidor (R2): o grupo da rede com filiação no banco é a comunidade fechada.
await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo) values ('r3-folhas', 'Fechada R3', 'lutas', 'fechada') on conflict do nothing");
for (const m of ["ana", "bia", "caio"]) await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, situacao) values ('r3-folhas', $1, 'ativo')", [P[m]]);
const G = "comunidade:r3-folhas";
// O estado de antes: uma folha sem certificado (como a R2 publicava).
await rpc({ papel: "authenticated", sub: P.caio }, "rede_mls_publicar", { p_nome: `${P.caio}:abc@alumia.invalid`, p_pacotes: ["AAAA"] }).catch((e) => falhas.push(`montar a folha de antes: ${e.message}`));

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
ok("a folha de antes, sem certificado, saiu (com o pacote)", (await dono("select count(*)::int as n from interno.rede_grupo_folhas")).rows[0].n === 0 && (await dono("select count(*)::int as n from interno.rede_grupo_pacotes")).rows[0].n === 0);
ok("o certificado é obrigatório na tabela (96 bytes)", (await dono("select is_nullable from information_schema.columns where table_schema = 'interno' and table_name = 'rede_grupo_folhas' and column_name = 'certificado'")).rows[0]?.is_nullable === "NO");
ok("a função antiga (sem certificado) saiu; a nova passa pela porta e só authenticated chama", (await dono(`select array_agg(p.oid::regprocedure::text) as f, bool_and(p.prosrc ~ 'interno\\.alumia_porta\\(\\)' and not has_function_privilege('anon', p.oid, 'execute') and has_function_privilege('authenticated', p.oid, 'execute')) as ok from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'rede_mls_publicar'`)).rows.every((r) => r.f.length === 1 && r.f[0] === "rede_mls_publicar(text,text[],text)" && r.ok));
await recusa("publicar folha sem certificado é recusado", () => rpc({ papel: "authenticated", sub: P.ana }, "rede_mls_publicar", { p_nome: `${P.ana}:1@alumia.invalid`, p_pacotes: [], p_certificado: null }), "invalido:certificado");
await recusa("nem com certificado de outro tamanho", () => rpc({ papel: "authenticated", sub: P.ana }, "rede_mls_publicar", { p_nome: `${P.ana}:1@alumia.invalid`, p_pacotes: [], p_certificado: b64(sorteio(95)) }), "invalido:certificado");

// ═══════════════════ 2. As identidades no registro público (o gatilho do diretório) ═══════════════════
const ids = {};
async function registrar(nome, par) {
  ids[nome] = par;
  await dono(`insert into interno.diretorio_contas (usuario, identidade, pedidos_xwing, pedidos_assinatura, pedidos_caixa, pedidos_pd) values ($1, $2, $3, $4, $5, $6)
              on conflict (usuario) do update set identidade = excluded.identidade, versao = interno.diretorio_contas.versao + 1`, [P[nome], par.publica, sorteio(1216), sorteio(64), sorteio(32), sorteio(32)]);
}
for (const n of ["ana", "bia", "caio"]) await registrar(n, novoParEd25519());
ok("cada identidade entrou no registro público (linha 'conta')", (await dono("select count(*)::int as n from interno.rede_kt where tipo = 'conta'")).rows[0].n === 3);

/** A fonte da identidade como a do chat do navegador (lib/rede/chat/r2/navegador.ts, fonteDoVoto): assina pelo caminho restrito e confere no registro. */
function fonteDe(nome, usar = () => ids[nome]) {
  let vista = INICIO;
  return {
    minha: async () => ({ usuario: P[nome], publica: usar().publica, assinar: async (t) => assinarTextoDoVoto(usar(), t) }),
    conferir: async (usuario, identidade) => {
      try {
        vista = await atualizarVista(vista, { ponta: () => rpc({ papel: "authenticated", sub: P[nome] }, "rede_kt_ponta"), trecho: (desde) => rpc({ papel: "authenticated", sub: P[nome] }, "rede_kt_trecho", { p_desde: desde }) });
        return (await conferirConta(vista, usuario, identidade)) === "confere" ? "conferida" : "trocada";
      } catch {
        return "nao_conferida";
      }
    },
  };
}

// ═══════════════════ 3. Ponta a ponta com o motor de verdade ═══════════════════
const M = await motorNoNode();
await dono("delete from interno.limites").catch(() => undefined);
const chamarComo = (u) => (funcao, argumentos) => rpc({ papel: "authenticated", sub: u }, funcao, argumentos);
const memoria = () => {
  const m = new Map();
  return { ler: async (k) => m.get(k) ?? null, guardar: async (k, v) => void m.set(k, v), apagar: async (k) => void m.delete(k) };
};
const aparelho = (nome, fonte = fonteDe(nome)) => {
  const cc = M.CoreCrypto.new(M.Database.inMemory());
  return criarChaveiroDeGrupo({ chamar: chamarComo(P[nome]), guarda: memoria(), abrirMotor: async () => ({ M, cc }), identidade: async () => fonte });
};
const A = aparelho("ana"), B = aparelho("bia"), C = aparelho("caio");
await espera("bia e caio publicam a folha com certificado", async () => {
  await B.preparar(P.bia);
  await C.preparar(P.caio);
  return (await dono("select count(*)::int as n, bool_and(octet_length(certificado) = 96) as c from interno.rede_grupo_folhas")).rows[0];
}, (r) => r.n === 2 && r.c);
{
  const f = (await dono("select nome, certificado from interno.rede_grupo_folhas where usuario = $1", [P.caio])).rows[0];
  const pac = (await dono("select pacote from interno.rede_grupo_pacotes where nome = $1 limit 1", [f.nome])).rows[0].pacote;
  const lido = lerPacote(Buffer.from(pac, "base64"));
  const cert = lerCertificado(new Uint8Array(f.certificado));
  ok("o certificado publicado confere: identidade do caio, a folha e a impressão da chave do pacote", !!cert && Buffer.from(cert.identidade).equals(Buffer.from(ids.caio.publica)) && certificadoDaFolhaConfere(cert, P.caio, f.nome, lido.impressao));
}
const p1 = await espera("ana escreve na comunidade fechada (cria o grupo e põe bia e caio, conferindo os certificados)", () => A.cifrar(G, P.ana, "Reunião sábado às 15h"), (c) => /^p2\.\d+\./.test(c));
await espera("bia e caio abrem", async () => [await B.abrir(G, P.bia, P.ana, p1), await C.abrir(G, P.caio, P.ana, p1)], (l) => l.every((t) => t === "Reunião sábado às 15h"));

// ═══════════════════ 4. ATAQUES: o servidor põe um aparelho-fantasma do caio ═══════════════════
/**
 * O "servidor": um motor dele, que gera um pacote de chave com a chave DELE para uma folha da conta do caio (com o nome pedido, ou
 * um sorteado), e o põe no banco como dono, sem passar pelas funções.
 */
async function pacoteDoServidor(nome = null) {
  const cc = M.CoreCrypto.new(M.Database.inMemory());
  const suite = M.cipherSuiteFromU16(SUITE_MLS);
  const dispositivo = nome ? lerNome(nome).dispositivo : Array.from(sorteio(6), (x) => x.toString(16).padStart(2, "0")).join("").replace(/^0+/, "") || "1";
  const cid = new M.ClientId(new M.Uuid(P.caio), new M.DeviceId(BigInt(`0x${dispositivo}`)), "alumia.invalid");
  const transporte = { sendCommitBundle: async () => undefined, prepareForTransport: async () => { throw new Error("nao"); } };
  const ref = await cc.transaction(async (c) => {
    await c.mlsInit(cid, transporte);
    return c.addCredential(M.Credential.basic(suite, cid));
  });
  const pacote = (await cc.transaction((c) => c.generateKeyPackage(ref))).serialize();
  return { pacote, lido: lerPacote(pacote) };
}
async function fantasma(rotulo, montarCertificadoFalso, { trocarPacoteDe = null } = {}) {
  const { pacote, lido } = await pacoteDoServidor(trocarPacoteDe);
  const nome = lido.nome;
  await dono("delete from interno.rede_grupo_pacotes where nome = $1", [nome]);
  if (!trocarPacoteDe) await dono("insert into interno.rede_grupo_folhas (nome, usuario, certificado) values ($1, $2, $3)", [nome, P.caio, montarCertificadoFalso(nome, lido.impressao)]);
  await dono("insert into interno.rede_grupo_pacotes (nome, pacote) values ($1, $2)", [nome, b64(pacote)]);
  const post = await A.cifrar(G, P.ana, `Depois do fantasma (${rotulo})`).catch((e) => `erro:${e.message}`);
  const boasvindas = (await dono("select count(*)::int as n from interno.rede_grupo_boasvindas where para = $1 and epoca > 1", [nome])).rows[0].n;
  return { nome, post, boasvindas, igual: nome === trocarPacoteDe };
}
const outraConta = (nome, impressao) => montarCertificado(ids.bia.publica, ed25519.sign(textoDaFolha(P.caio, nome, impressao), ids.bia.privada));
const daBiaComoBia = (nome, impressao) => montarCertificado(ids.bia.publica, ed25519.sign(textoDaFolha(P.bia, nome, impressao), ids.bia.privada));
const servidor = novoParEd25519();
const doServidor = (nome, impressao) => montarCertificado(servidor.publica, ed25519.sign(textoDaFolha(P.caio, nome, impressao), servidor.privada));
const folhaVerdadeira = (await dono("select nome, certificado from interno.rede_grupo_folhas where usuario = $1", [P.caio])).rows[0];
const deOutraFolha = () => new Uint8Array(folhaVerdadeira.certificado);
const ataques = [
  ["certificado sorteado", () => sorteio(96)],
  ["certificado de outra conta (a identidade da bia assinando pela conta do caio)", outraConta],
  ["certificado de outra conta (o da bia, para ela mesma)", daBiaComoBia],
  ["certificado de outra folha (o certificado verdadeiro do caio, copiado)", deOutraFolha],
  ["identidade do próprio servidor (fora do registro público)", doServidor],
];
for (const [rotulo, falso] of ataques) {
  const r = await fantasma(rotulo, falso);
  ok(`ATAQUE fantasma com ${rotulo}: o grupo recusa (sem boas-vindas para ele, o post sai para os outros)`, r.boasvindas === 0 && /^p2\./.test(r.post), JSON.stringify({ b: r.boasvindas, p: String(r.post).slice(0, 40) }));
  await dono("delete from interno.rede_grupo_folhas where nome = $1", [r.nome]);
}
{
  // De outro pacote: o servidor troca o pacote da folha VERDADEIRA de um aparelho novo do caio (com o certificado certo) pelo dele.
  const C2 = aparelho("caio");
  await C2.preparar(P.caio);
  const nova = (await dono("select nome from interno.rede_grupo_folhas where usuario = $1 and nome <> $2", [P.caio, folhaVerdadeira.nome])).rows[0].nome;
  const r = await fantasma("pacote de outra chave no lugar do pacote da folha certificada", null, { trocarPacoteDe: nova });
  const naArvore = (await dono("select count(*)::int as n from interno.rede_grupo_boasvindas where para = $1", [nova])).rows[0].n;
  ok("ATAQUE pacote de outra chave, com o MESMO nome da folha certificada (o certificado não confere com a impressão): recusado", r.igual && naArvore === 0 && /^p2\./.test(r.post), JSON.stringify({ igual: r.igual, naArvore, p: String(r.post).slice(0, 40) }));
  await dono("delete from interno.rede_grupo_folhas where nome = $1", [nova]);
}
await espera("e o caio de verdade continua lendo", async () => C.abrir(G, P.caio, P.ana, await A.cifrar(G, P.ana, "Tudo certo")), (t) => t === "Tudo certo");

// ═══════════════════ 5. Aparelho novo de conta já vista: aviso forte ═══════════════════
const B2 = aparelho("bia");
await B2.preparar(P.bia);
const p2 = await espera("ana escreve com o aparelho novo da bia publicado (certificado pela identidade dela)", () => A.cifrar(G, P.ana, "Bem-vinda"));
await espera("o aparelho novo da bia abre", () => B2.abrir(G, P.bia, P.ana, p2), (t) => t === "Bem-vinda");
await espera("a ana tem o AVISO FORTE de aparelho novo da bia (identidade a mesma)", () => A.avisos(P.ana), (l) => l.some((x) => x.usuario === P.bia && x.forte === true && x.trocada === false && !x.visto));
await espera("marcar como visto tira da tela (o aviso fica guardado)", async () => {
  await A.avisosVistos(P.ana);
  return A.avisos(P.ana);
}, (l) => l.length >= 1 && l.every((x) => x.visto));
// A bia liga o chat de novo (identidade nova, registrada) e entra com outro aparelho: o aviso diz que a identidade mudou.
await registrar("bia", novoParEd25519());
const B3 = aparelho("bia");
await B3.preparar(P.bia);
await espera("ana escreve com o aparelho da identidade nova da bia", () => A.cifrar(G, P.ana, "Identidade nova"));
await espera("o aviso forte diz que a identidade da bia mudou", () => A.avisos(P.ana), (l) => l.some((x) => x.usuario === P.bia && x.trocada === true && !x.visto));
await espera("o aparelho da identidade nova abre", async () => B3.abrir(G, P.bia, P.ana, await A.cifrar(G, P.ana, "Confere")), (t) => t === "Confere");

// ═══════════════════ 6. Sem a identidade neste aparelho ═══════════════════
{
  const cc = M.CoreCrypto.new(M.Database.inMemory());
  const semId = criarChaveiroDeGrupo({ chamar: chamarComo(P.ana), guarda: memoria(), abrirMotor: async () => ({ M, cc }), identidade: async () => null });
  await recusa("sem o chat ligado neste aparelho, preparar diz sem_identidade (nada vai ao banco sem certificado)", () => semId.preparar(P.ana), "sem_identidade");
  await espera("e o compositor diz sem_identidade (a tela pede para ligar o chat)", () => cifrarParaOGrupo(semId, G, P.ana, "oi"), (r) => r.ok === false && r.codigo === "sem_identidade");
  const outra = criarChaveiroDeGrupo({ chamar: chamarComo(P.ana), guarda: memoria(), abrirMotor: async () => ({ M, cc: M.CoreCrypto.new(M.Database.inMemory()) }), identidade: async () => fonteDe("bia") });
  await recusa("a identidade de outra conta não serve", () => outra.preparar(P.ana), "sem_identidade");
}

// ═══════════════════ 7. A identidade não vira assinador genérico ═══════════════════
{
  const id = novoParEd25519();
  const t = textoDaFolha(P.ana, `${P.ana}:1@alumia.invalid`, "x");
  ok("a identidade assina o texto da folha (e confere)", ed25519.verify(assinarTextoDoVoto(id, t), t, id.publica));
  let recusou = 0;
  for (const outro of ["alumia/r2/franquia/remetente/v1 x", "alumia/r3/folha-pacote/v1 sem o byte zero", "alumia/r2/certificado-aparelho/v1\u0000x"]) {
    try {
      assinarTextoDoVoto(id, new TextEncoder().encode(outro));
    } catch {
      recusou++;
    }
  }
  ok("ATAQUE textos de outro uso continuam recusados", recusou === 3);
}

// ═══════════════════ 8. As telas ═══════════════════
const ler = (f) => fs.readFileSync(path.join(raiz, f), "utf8");
ok("o navegador liga a identidade do chat ao chaveiro dos grupos", /identidade: identidadeDaConta/.test(ler("lib/rede/grupos/navegador.ts")));
ok("o compositor mostra o aviso forte e o texto de sem_identidade", /AvisoDeAparelhoNovo/.test(ler("components/rede/publicar/restrito/NaTela.tsx")) && /semIdentidade/.test(ler("components/rede/publicar/restrito/textos.ts")));
for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) {
  const j = JSON.parse(ler(`i18n/rede/publicar/restrito/${l}.json`));
  ok(`textos do aviso em ${l}`, typeof j.semIdentidade === "string" && ["titulo", "texto", "trocada", "entendi"].every((k) => typeof j.avisoForte?.[k] === "string" && j.avisoForte[k].length > 2));
}

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
