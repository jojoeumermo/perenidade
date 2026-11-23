// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o chat da equipe em MLS (supabase/migracoes/20261124-r2-equipe.sql e lib/equipe/mls.ts) num Postgres local, com o motor
// de verdade (@wireapp/core-crypto) e a identidade de verdade de cada pessoa (lib/sigilo.ts):
//   - a troca: as mensagens "c2"/"e1" e os anexos cifrados de antes saem, os avisos do sistema ficam, as tabelas e funções do
//     Megolm/Olm e da "c2" saem, e o banco passa a aceitar só "m1" de tamanho fixo;
//   - ponta a ponta: cada mensagem assinada pela identidade de quem escreveu, por dentro da cifra; os aparelhos aprovados de cada
//     pessoa (dois da Ana) leem; quem sai da conversa não lê o que vem depois; a época troca a cada 100 mensagens;
//   - a espera de 24 horas: o aparelho que se certifica sozinho não publica folha nem entra no grupo antes de valer;
//   - ataques: aparelho falso cadastrado direto no banco (certificado de outra identidade), troca da chave de um aparelho de verdade
//     (pacote com o nome dele e outra chave), autoria trocada, contexto trocado, commit fora do formato ou fora da vez, folha de
//     outra pessoa, quem não está na conversa.
// Uso: npm run testar:r2-equipe
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { motorNoNode } from "./cifra-no-node.mjs";
import { apagarLojasDoMegolm, lojasDoMegolm } from "../lib/equipe/limpeza.ts";
import { abrirPedido, abrirTexto, assinar, assinarTexto, certificarAparelho, contextoDaConversa, novaIdentidade, novoAparelho, novoCodigo, selarPedido, verificar } from "../lib/sigilo.ts";
import { criarMlsDaEquipe, epocaDoM1, MENSAGENS_POR_EPOCA, textoDoCertificadoDaFolha } from "../lib/equipe/mls.ts";
import { lerPacote } from "../lib/rede/grupos/pacote.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRACAO = "supabase/migracoes/20261124-r2-equipe.sql";
const sql = fs.readFileSync(path.join(raiz, MIGRACAO), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
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

// ═══════════════════ 0. O arquivo da migração ═══════════════════
ok("a migração tem cabeçalho com a função e a lei", /Alumia · R2 · chat da equipe/.test(sql) && /Leis e princípios: LGPD/.test(sql));
ok("a migração termina com a porta", /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("a migração não tem endereço de rede, porta nem caminho do computador", !/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|[A-Z]:\\|\/home\/|\/opt\//.test(sql));
ok("nenhuma função da migração recebe linha de tabela com valor padrão", !/\(\s*[a-z_]+\s+interno\.[a-z_]+\s+default/i.test(sql));
ok("nenhuma função nova tem valor padrão em parâmetro", !/create or replace function [^\n]*\bdefault\b[^\n]*\)\s+returns/i.test(sql));
ok("o nome antigo da rede não aparece", !/Rede Lúcia/.test(sql));
ok("nenhuma menção a Megolm/Olm no código de fora dos comentários da troca", !/m\.megolm|olm_/.test(sql.replace(/^--.*$/gm, "").replace(/drop [^;]+;/g, "")));

// ═══════════════════ 1. O banco de antes, com o chat da equipe em Megolm ═══════════════════
const banco = await criarBanco({ antesDe: sql }).catch(() => criarBanco());
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
await dono("update interno.configuracoes set valor = valor || '{\"exigir_2fa\": false}'::jsonb where chave = 'seguranca'");
const P = {};
for (const nome of ["ana", "bia", "caio", "fora"]) {
  P[nome] = await criarUsuario(`${nome}@r2e.local`, `Pessoa ${nome}`);
  await rpc({ papel: "authenticated", sub: P[nome] }, "eu");
}
for (const nome of ["ana", "bia", "caio"]) await dono("insert into interno.papeis (usuario, papel, disciplina) values ($1, 'educacao', 'matematica') on conflict do nothing", [P[nome]]);
const como = (u) => ({ papel: "authenticated", sub: u });
const conversa = (await dono("insert into interno.conversas (tipo, nome) values ('grupo', 'Exatas') returning id")).rows[0].id;
for (const nome of ["ana", "bia", "caio"]) await dono("insert into interno.conversa_membros (conversa, usuario) values ($1, $2)", [conversa, P[nome]]);
// O estado de antes: uma mensagem "c2", uma "e1", um aviso do sistema, uma versão e um anexo cifrado.
await dono("insert into interno.chat_versoes (conversa, versao) values ($1, 3)", [conversa]);
const antiga = (await dono("insert into interno.conversa_mensagens (conversa, autor, corpo, versao, tipo) values ($1, $2, 'c2.3.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB', 3, 'texto') returning id", [conversa, P.ana])).rows[0].id;
await dono(`insert into interno.conversa_mensagens (conversa, autor, corpo, versao, tipo) values ($1, $2, 'e1.3.${"A".repeat(43)}.BBBB', 3, 'texto')`, [conversa, P.bia]);
await dono("insert into interno.conversa_mensagens (conversa, autor, corpo, versao, tipo, detalhe) values ($1, $2, 'sistema', 0, 'sistema', '{}')", [conversa, P.ana]);
await dono("insert into interno.conversa_anexos (conversa, mensagem, autor, cifrado, tamanho) values ($1, $2, $3, '\\x00', 1)", [conversa, antiga, P.ana]);

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));

// ═══════════════════ 2. A troca ═══════════════════
await espera("as mensagens cifradas de antes e os anexos saem; o aviso do sistema fica", async () => (await dono("select (select count(*) from interno.conversa_mensagens where tipo = 'texto')::int as t, (select count(*) from interno.conversa_mensagens where tipo = 'sistema')::int as s, (select count(*) from interno.conversa_anexos)::int as a, (select count(*) from interno.chat_versoes)::int as v")).rows[0], (r) => r.t === 0 && r.s === 1 && r.a === 0 && r.v === 0);
await espera("as tabelas do Megolm/Olm e da c2 não existem mais", async () => (await dono("select array_agg(t) filter (where to_regclass('interno.' || t) is not null) as sobrou from unnest(array['equipe_chat_olm','equipe_chat_unicas','equipe_chat_reserva','equipe_chat_caixa','equipe_chat_pedidos','chat_chaves']) t")).rows[0].sobrou, (s) => s === null);
await espera("as funções do Megolm/Olm e da c2 não existem mais", async () => (await dono("select array_agg(p.proname) as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','interno') and (p.proname like 'equipe\\_chat\\_%' and p.proname <> 'equipe_chat_embrulho_ok' or p.proname in ('chat_chave_nova','chat_chaves_dar','chat_chaves_pendentes','chat_chaves_recusar','chat_chaves'))")).rows[0].f, (f) => f === null);
const colunas = (await dono(`select table_name || '.' || column_name as c, data_type from information_schema.columns where table_schema = 'interno' and table_name like 'equipe\\_mls\\_%' order by 1`)).rows;
ok(`nenhuma coluna de autor, de hora ou de endereço nas tabelas do MLS da equipe (${colunas.map((c) => c.c).join(", ")})`, colunas.length > 0 && !colunas.some((c) => /autor|criado|_em$|ip$|endereco/.test(c.c) || /timestamp/.test(c.data_type)));
ok("RLS ligada e ninguém de fora lê as tabelas novas", (await dono(`select bool_and(c.relrowsecurity) as rls, bool_or(has_table_privilege('authenticated', c.oid, 'select') or has_table_privilege('anon', c.oid, 'select')) as alguem from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relname like 'equipe\\_mls\\_%' and c.relkind = 'r'`)).rows.every((r) => r.rls && !r.alguem));
ok("as funções novas: só authenticated chama; as de interno, ninguém de fora", (await dono(`select bool_and(case when n.nspname = 'public' then has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute') else not has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute') end) as ok, count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.proname like 'equipe\\_mls\\_%'`)).rows.every((r) => r.ok && r.n === 9));

// ═══════════════════ 3. Aparelhos, identidades e o MLS ═══════════════════
const M = await motorNoNode();
await dono("delete from interno.limites").catch(() => undefined);
/** As identidades que cada aparelho conhece (confiar na primeira vez). */
function conhecidas() {
  const m = new Map();
  return { m, aceitar: (u, a) => (a && !m.has(u) ? m.set(u, a) : m), de: (u) => m.get(u) ?? null };
}
async function aparelhoDe(quem, identidade = null) {
  const par = await novoAparelho();
  const id = identidade ?? (await novaIdentidade());
  const r = await rpc(como(P[quem]), "chat_aparelho_registrar", { p_publica: par.publica, p_rotulo: `teste de ${quem}`, p_assina: id.publica, p_certificado: await certificarAparelho(id, P[quem], par.publica) });
  const k = conhecidas();
  const cc = M.CoreCrypto.new(M.Database.inMemory());
  const memoria = new Map();
  const mls = criarMlsDaEquipe({
    chamar: (f, a) => rpc(como(P[quem]), f, a),
    aparelho: r.id,
    usuario: P[quem],
    assinar: (t) => assinar(id.privada, t),
    verificar,
    identidadeDe: (u) => k.de(u),
    guarda: { ler: async (c) => memoria.get(c) ?? null, guardar: async (c, v) => void memoria.set(c, v), apagar: async (c) => void memoria.delete(c) },
    abrirMotor: async () => ({ M, cc }),
  });
  const ap = { quem, id: r.id, identidade: id, conhecidas: k, mls, estado: r.estado };
  // O que lib/chaveiro.ts faz ao abrir a conversa: lê e aceita as identidades (a primeira vista de cada pessoa).
  ap.carregar = async () => {
    const e = await mls.estado(conversa, true);
    for (const p of e.identidades) k.aceitar(p.usuario, p.assina);
    return e;
  };
  ap.escrever = async (texto) => {
    await ap.carregar();
    const ctx = contextoDaConversa(conversa, P[quem]);
    const corpo = await mls.cifrar(conversa, ctx, (epoca) => assinarTexto(id, texto, ctx, epoca));
    await rpc(como(P[quem]), "chat_enviar", { p_id: conversa, p_corpo: corpo });
    return corpo;
  };
  ap.ler = async (corpo, autor, contexto = contextoDaConversa(conversa, autor)) => {
    await ap.carregar().catch(() => undefined);
    const r = await mls.abrir(conversa, corpo, contexto);
    return r ? abrirTexto(r.texto, k.de(autor), contexto, r.epoca) : null;
  };
  return ap;
}
const A1 = await aparelhoDe("ana"), B1 = await aparelhoDe("bia"), C1 = await aparelhoDe("caio");
// O segundo aparelho da Ana: certificado pela mesma identidade; aprovado por outro aparelho dela (vale na hora).
const A2 = await aparelhoDe("ana", A1.identidade);
await dono("update interno.chat_aparelhos set vale_desde = null where id = $1", [A2.id]);
for (const ap of [B1, C1, A2]) await ap.mls.preparar();

const m1 = await espera("a Ana escreve a primeira mensagem (cria o grupo da conversa e põe todos os aparelhos aprovados)", () => A1.escrever("Reunião às 15h."), (c) => epocaDoM1(c) >= 1);
const aut = (r) => r && `${r.texto}|${r.autoria}`;
await espera("Bia, Caio e o outro aparelho da Ana leem, com a assinatura da Ana conferida", async () => [aut(await B1.ler(m1, P.ana)), aut(await C1.ler(m1, P.ana)), aut(await A2.ler(m1, P.ana))], (l) => l.every((x) => x === "Reunião às 15h.|ok"));
await espera("o corpo tem tamanho fixo e não tem o texto", async () => [m1.split(".")[2].length, m1.includes("Reuni")], ([n, t]) => [395, 736, 1419, 2784, 5515, 8246, 10976].includes(n) && !t);
await espera("com a autoria trocada (dizer que foi a Bia), a assinatura não confere", () => C1.ler(m1, P.bia), (r) => r === null || r.autoria !== "ok");
await espera("com outro contexto (outra conversa), não abre", () => C1.ler(m1, P.ana, contextoDaConversa("00000000-0000-4000-8000-000000000000", P.ana)), (r) => r === null);
const commits = (await dono("select commit from interno.equipe_mls_commits where conversa = $1", [conversa])).rows;
ok("o banco só tem commits em embrulho de tamanho fixo, sem nome de ninguém às claras", commits.length >= 1 && commits.every((c) => [2098, 8242, 32818, 131122].includes(Buffer.from(c.commit, "base64").length) && !Buffer.from(c.commit, "base64").toString("latin1").includes("alumia.invalid")));
await espera("a versão da conversa é a época do MLS", async () => [(await dono("select max(versao)::int as v from interno.chat_versoes where conversa = $1", [conversa])).rows[0].v, epocaDoM1(m1)], ([v, e]) => v === e);
await recusa("o banco recusa mensagem que não é m1 (o formato de antes)", () => rpc(como(P.ana), "chat_enviar", { p_id: conversa, p_corpo: "c2.1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB" }), "invalido:corpo");
await recusa("nem m1 fora dos tamanhos fixos", () => rpc(como(P.ana), "chat_enviar", { p_id: conversa, p_corpo: `m1.${epocaDoM1(m1)}.${"A".repeat(400)}` }), "invalido:corpo");
const m2 = await espera("a Bia responde na mesma época", () => B1.escrever("Combinado."), (c) => epocaDoM1(c) === epocaDoM1(m1));
await espera("a Ana lê nos dois aparelhos", async () => [aut(await A1.ler(m2, P.bia)), aut(await A2.ler(m2, P.bia))], (l) => l.every((x) => x === "Combinado.|ok"));

// ── A espera de 24 horas ──
const A3 = await aparelhoDe("ana", A1.identidade); // se certificou sozinho numa conta que já tem identidade: espera
await recusa("o aparelho na espera de 24 horas não publica folha", () => A3.mls.preparar(), "aparelho_desconhecido");
await espera("nem aparece nas folhas da conversa", async () => (await A1.mls.estado(conversa, true)).folhas.some((f) => f.aparelho === A3.id), (x) => x === false);

// ── Quem sai ──
await rpc(como(P.caio), "chat_sair", { p_id: conversa });
const m3 = await espera("depois que o Caio sai, a Bia escreve numa época nova", () => B1.escrever("Só para quem ficou."), (c) => epocaDoM1(c) > epocaDoM1(m2));
await dono("insert into interno.conversa_membros (conversa, usuario) values ($1, $2)", [conversa, P.caio]); // um servidor que deixa o Caio ler o estado de novo
await espera("o Caio, mesmo vendo o estado, não lê o que veio depois que saiu", () => C1.ler(m3, P.bia), (r) => r === null);
await espera("e ainda relê o que já lia", async () => aut(await C1.ler(m1, P.ana)), (x) => x === "Reunião às 15h.|ok");
await dono("delete from interno.conversa_membros where conversa = $1 and usuario = $2", [conversa, P.caio]);

// ── Ataques do servidor ──
// 1. Um aparelho falso da Ana, cadastrado direto no banco, com um certificado de outra identidade.
const falsa = await novaIdentidade();
const parFalso = await novoAparelho();
const idFalso = (await dono("insert into interno.chat_aparelhos (usuario, publica, rotulo, certificado, aprovado_em) values ($1, $2, 'invasor', $3, now()) returning id", [P.ana, parFalso.publica, await certificarAparelho(falsa, P.ana, parFalso.publica)])).rows[0].id;
const ccFalso = M.CoreCrypto.new(M.Database.inMemory());
const mlsFalso = criarMlsDaEquipe({ chamar: (f, a) => rpc(como(P.ana), f, a), aparelho: idFalso, usuario: P.ana, assinar: (t) => assinar(falsa.privada, t), verificar, identidadeDe: () => null,
  guarda: { ler: async () => null, guardar: async () => {}, apagar: async () => {} }, abrirMotor: async () => ({ M, cc: ccFalso }) });
await mlsFalso.preparar(); // com a sessão da Ana (o servidor tomado), publica a folha com certificado da identidade falsa
const m4 = await espera("a Bia escreve com o aparelho falso da Ana listado no banco", () => B1.escrever("Só para aparelhos de verdade."));
await espera("o aparelho falso não entrou no grupo (o certificado não confere com a identidade que a Bia conhece)", async () => [(await dono("select count(*)::int as n from interno.equipe_mls_boasvindas where para = $1", [idFalso])).rows[0].n, await mlsFalso.abrir(conversa, m4, contextoDaConversa(conversa, P.bia))], ([n, r]) => n === 0 && r === null);
// 2. A troca da chave de um aparelho de verdade: o servidor publica, com o nome e o certificado do A2, um pacote de outra chave.
const nomeA2 = (await dono("select nome, certificado from interno.equipe_mls_folhas where aparelho = $1", [A2.id])).rows[0];
const ccTroca = M.CoreCrypto.new(M.Database.inMemory());
const [uuidA2, resto] = nomeA2.nome.split(":");
const pkTroca = await ccTroca.transaction(async (c) => {
  const id = new M.ClientId(new M.Uuid(uuidA2), new M.DeviceId(BigInt(`0x${resto.split("@")[0]}`)), "alumia.invalid");
  await c.mlsInit(id, { sendCommitBundle: async () => {}, prepareForTransport: async () => new Uint8Array() });
  const ref = await c.addCredential(M.Credential.basic(M.cipherSuiteFromU16(61442), id));
  return (await c.generateKeyPackage(ref)).serialize();
});
ok("o pacote trocado tem o mesmo nome e outra chave", lerPacote(pkTroca)?.nome === nomeA2.nome);
// O servidor tira o A2 do grupo (some da lista de folhas) e o devolve com o pacote trocado.
await dono("update interno.chat_aparelhos set vale_desde = now() + interval '1 day' where id = $1", [A2.id]);
await B1.escrever("A2 sai da lista.");
await dono("update interno.chat_aparelhos set vale_desde = null where id = $1", [A2.id]);
await dono("delete from interno.equipe_mls_pacotes where aparelho = $1", [A2.id]);
await dono("insert into interno.equipe_mls_pacotes (aparelho, pacote) values ($1, $2)", [A2.id, Buffer.from(pkTroca).toString("base64")]);
const m5 = await espera("a Bia escreve com o pacote trocado no banco", () => B1.escrever("Depois da troca."));
await espera("o pacote com a chave trocada não entrou (a impressão não é a do certificado): nada de boas-vindas para o A2 nesta época", async () => (await dono("select count(*)::int as n from interno.equipe_mls_boasvindas where para = $1 and epoca = $2", [A2.id, epocaDoM1(m5)])).rows[0].n, (n) => n === 0);
ok("o certificado da folha é o texto com o rótulo, a conta, o aparelho, o nome e a impressão", textoDoCertificadoDaFolha("u", "a", "n", "i") === "alumia/r2/mls/equipe/folha/v1|u|a|n|i");

// ── A época troca a cada 100 mensagens ──
const antes = epocaDoM1(m5);
await dono(`insert into interno.conversa_mensagens (conversa, autor, corpo, versao, tipo) select $1, $2, 'm1.' || $3::int || '.' || repeat('A', 395), $3::int, 'texto' from generate_series(1, ${MENSAGENS_POR_EPOCA})`, [conversa, P.bia, antes]);
const m6 = await espera("com 100 mensagens na época, a próxima sai numa época nova", () => A1.escrever("Época nova."), (c) => epocaDoM1(c) === antes + 1);
await espera("e a Bia lê", async () => aut(await B1.ler(m6, P.ana)), (x) => x === "Época nova.|ok");

// ── Aparelho novo entra sem esperar alguém escrever, e o que perdeu as boas-vindas entra de novo ──
const B2 = await aparelhoDe("bia", B1.identidade);
await dono("update interno.chat_aparelhos set vale_desde = null where id = $1", [B2.id]);
await B2.mls.preparar();
await espera("a conversa aparece nas pendentes do aparelho da Ana que está online", () => A1.mls.pendentes(), (l) => Array.isArray(l) && l.includes(conversa));
await espera("a Ana acerta o grupo sem escrever e o aparelho novo da Bia recebe as boas-vindas", async () => [await A1.mls.sincronizar(conversa).then(Boolean), (await dono("select count(*)::int as n from interno.equipe_mls_boasvindas where para = $1", [B2.id])).rows[0].n], ([s, n]) => s && n === 1);
await espera("e o banco sabe que ele está no grupo (sai de 'reentrar')", async () => [(await rpc(como(P.ana), "equipe_mls_estado", { p_aparelho: A1.id, p_conversa: conversa, p_desde: 2147483647 })).reentrar, (await dono("select nome from interno.equipe_mls_folhas where aparelho = $1", [B2.id])).rows[0].nome], ([r, n]) => !r.includes(n));
// As boas-vindas venceram (30 dias) antes de o aparelho abrir o painel: ele está na árvore dos outros e não tem o grupo.
await dono("delete from interno.equipe_mls_boasvindas where para = $1", [B2.id]);
const m7 = await espera("a Ana escreve depois que as boas-vindas do aparelho novo venceram", () => A1.escrever("Para o aparelho que chegou."));
await espera("o aparelho sem as boas-vindas não lê e pede para entrar de novo", async () => [await B2.ler(m7, P.ana), (await dono("select count(*)::int as n from interno.equipe_mls_no_grupo where aparelho = $1", [B2.id])).rows[0].n], ([r, n]) => r === null && n === 0);
await espera("o pedido aparece como 'reentrar' no estado e a conversa volta às pendentes", async () => [(await rpc(como(P.ana), "equipe_mls_estado", { p_aparelho: A1.id, p_conversa: conversa, p_desde: 2147483647 })).reentrar, (await dono("select nome from interno.equipe_mls_folhas where aparelho = $1", [B2.id])).rows[0].nome, await A1.mls.pendentes()], ([r, n, l]) => r.includes(n) && l.includes(conversa));
await espera("a Ana acerta o grupo: tira a folha e põe de novo, com boas-vindas novas", async () => { await A1.mls.sincronizar(conversa); return (await dono("select count(*)::int as n from interno.equipe_mls_boasvindas where para = $1", [B2.id])).rows[0].n; }, (n) => n === 1);
const m8 = await espera("a Ana escreve de novo", () => A1.escrever("Agora chega."));
await espera("e o aparelho da Bia lê o que vem depois", async () => aut(await B2.ler(m8, P.ana)), (x) => x === "Agora chega.|ok");
await recusa("ninguém pede para entrar de novo com o aparelho de outra pessoa", () => rpc(como(P.ana), "equipe_mls_reentrar", { p_aparelho: B2.id, p_conversa: conversa, p_visto: 0 }), "aparelho_desconhecido");
await recusa("nem numa conversa em que não está", () => rpc(como(P.fora), "equipe_mls_reentrar", { p_aparelho: B2.id, p_conversa: conversa, p_visto: 0 }), "nao_encontrado");
await espera("com boas-vindas mais novas do que as vistas, o pedido não apaga nada", async () => [await rpc(como(P.bia), "equipe_mls_reentrar", { p_aparelho: B2.id, p_conversa: conversa, p_visto: 0 }), (await dono("select count(*)::int as n from interno.equipe_mls_no_grupo where aparelho = $1", [B2.id])).rows[0].n], ([r, n]) => r.ok === false && r.novas === true && n === 1);
// A conta sai e volta antes de alguém tirar a folha (o banco apaga as boas-vindas de quem sai): o aparelho dela entra de novo.
await dono("select interno.chat_retirar($1, $2)", [conversa, P.bia]);
await dono("insert into interno.conversa_membros (conversa, usuario) values ($1, $2)", [conversa, P.bia]);
await espera("quem saiu e voltou aparece em 'reentrar' (os dois aparelhos)", async () => [(await rpc(como(P.ana), "equipe_mls_estado", { p_aparelho: A1.id, p_conversa: conversa, p_desde: 2147483647 })).reentrar, (await dono("select array_agg(nome) as n from interno.equipe_mls_folhas where aparelho = any($1::uuid[])", [[B1.id, B2.id]])).rows[0].n], ([r, n]) => n.length === 2 && n.every((x) => r.includes(x)));
const m9 = await espera("a Ana escreve depois que a Bia saiu e voltou", () => A1.escrever("Bem-vinda de volta."));
await espera("os dois aparelhos da Bia leem (tirados e postos de novo)", async () => [aut(await B1.ler(m9, P.ana)), aut(await B2.ler(m9, P.ana))], (l) => l.every((x) => x === "Bem-vinda de volta.|ok"));

// ── C3 da R1: o pedido de aparelho vale 10 minutos também no banco ──
{
  const par = await novoAparelho();
  const codigo = novoCodigo();
  const r = await rpc(como(P.ana), "chat_aparelho_registrar", { p_publica: par.publica, p_rotulo: "pedido velho", p_pedido: await selarPedido(codigo, P.ana, par.publica) });
  const aprovar = async () => rpc(como(P.ana), "chat_aparelho_aprovar", { p_id: r.id, p_por: A1.id, p_certificado: await certificarAparelho(A1.identidade, P.ana, par.publica), p_identidade_embrulho: "h1.AAAA" });
  await dono("update interno.chat_aparelhos set pedido_em = now() - interval '11 minutes' where id = $1", [r.id]);
  await recusa("pedido de aparelho com mais de 10 minutos é recusado pelo banco", aprovar, "aparelho_pedido_vencido");
  await espera("o aparelho que aprova também recusa pelo relógio dele (a hora vai cifrada no pedido)", async () => [await abrirPedido(codigo, P.ana, (await rpc(como(P.ana), "chat_aparelhos_meus")).find((a) => a.id === r.id).pedido, Date.now() + 11 * 60_000), await abrirPedido(codigo, P.ana, (await rpc(como(P.ana), "chat_aparelhos_meus")).find((a) => a.id === r.id).pedido)], ([velho, agora]) => velho === null && agora === par.publica);
  await dono("delete from interno.chat_aparelhos where id = $1", [r.id]);
}

// ── As chaves do Megolm de antes saem do aparelho (lib/equipe/limpeza.ts) ──
{
  const { IDBFactory } = await import("fake-indexeddb");
  const idb = new IDBFactory();
  const aparelhoVelho = "0f0e0d0c-0b0a-4908-8706-050403020100";
  const criar = (nome) => new Promise((ok, falha) => { const p = idb.open(nome, 1); p.onupgradeneeded = () => p.result.createObjectStore("sessoes"); p.onsuccess = () => { p.result.close(); ok(); }; p.onerror = () => falha(p.error); });
  for (const nome of [...lojasDoMegolm(aparelhoVelho), "lucia-sigilo"]) await criar(nome);
  await apagarLojasDoMegolm(aparelhoVelho, idb);
  const sobrou = (await idb.databases()).map((d) => d.name);
  ok(`as lojas do Megolm do aparelho saem do navegador e o resto fica (${sobrou.join(", ")})`, !sobrou.some((n) => n.startsWith("lucia-equipe-olm-")) && sobrou.includes("lucia-sigilo"));
  await apagarLojasDoMegolm("nao-e-um-aparelho", idb);
  ok("nome fora do formato não apaga nada", (await idb.databases()).length === 1);
}

// ── O banco ──
const ana = como(P.ana);
const epoca = Number((await dono("select max(epoca) as e from interno.equipe_mls_commits where conversa = $1", [conversa])).rows[0].e);
const falso = (n, marca = 0x47) => {
  const b = Buffer.alloc(n);
  b[0] = marca;
  b[1] = 1;
  return b.toString("base64");
};
await recusa("commit fora do formato é recusado", () => rpc(ana, "equipe_mls_commit", { p_aparelho: A1.id, p_conversa: conversa, p_epoca: epoca + 1, p_commit: falso(2000), p_boasvindas: [] }), "invalido:commit");
await recusa("commit que pula época é recusado", () => rpc(ana, "equipe_mls_commit", { p_aparelho: A1.id, p_conversa: conversa, p_epoca: epoca + 2, p_commit: falso(2098), p_boasvindas: [] }), "versao_ocupada");
await recusa("commit com o aparelho de outra pessoa é recusado", () => rpc(ana, "equipe_mls_commit", { p_aparelho: B1.id, p_conversa: conversa, p_epoca: epoca + 1, p_commit: falso(2098), p_boasvindas: [] }), "aparelho_desconhecido");
await recusa("quem não está na conversa não lê o estado", () => rpc(como(P.fora), "equipe_mls_estado", { p_aparelho: A1.id, p_conversa: conversa, p_desde: 0 }), "nao_encontrado");
await recusa("publicar folha com o nome de outra conta é recusado", () => rpc(ana, "equipe_mls_publicar", { p_aparelho: A1.id, p_nome: `${P.bia}:1@alumia.invalid`, p_certificado: "A".repeat(86), p_pacotes: [] }), "invalido:nome");
await recusa("o estado (e as boas-vindas) de um aparelho só sai para a conta dona dele", () => rpc(ana, "equipe_mls_estado", { p_aparelho: B1.id, p_conversa: conversa, p_desde: 0 }), "aparelho_desconhecido");
// O install.sql rodado de novo: as migrações do Megolm (de antes) recriam as tabelas e funções antigas; esta, que vem depois, apaga
// de novo. As mensagens "m1" e os grupos ficam (a troca das conversas é uma vez só).
await espera("rodar de novo a migração do Megolm e esta não apaga as mensagens nem os grupos novos", async () => {
  const contar = async () => [(await dono("select count(*)::int as n from interno.conversa_mensagens where tipo = 'texto'")).rows[0].n, (await dono("select count(*)::int as n from interno.equipe_mls_commits")).rows[0].n];
  const antes = await contar();
  await exec(fs.readFileSync(path.join(raiz, "supabase/migracoes/20261116-equipe-chat-olm.sql"), "utf8"));
  await exec(sql);
  return [antes, await contar(), (await dono("select to_regclass('interno.equipe_chat_olm') as t")).rows[0].t];
}, ([a, d, t]) => a[0] > 0 && a[0] === d[0] && a[1] === d[1] && t === null);
await espera("e a mensagem de antes de rodar de novo ainda abre", async () => aut(await B1.ler(m6, P.ana)), (x) => x === "Época nova.|ok");
await recusa("anon não chama", () => rpc({ papel: "anon" }, "equipe_mls_estado", { p_aparelho: A1.id, p_conversa: conversa, p_desde: 0 }), "permission denied");

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
