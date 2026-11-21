// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, segurança pessoal (itens 10, 11 e 12), no banco de verdade (PGlite com o install.sql e a migração) e com o código do
// aparelho de verdade (lib/rede/seguranca-pessoal/aparelho.ts e selo.ts, HPKE X-Wing da biblioteca do chat):
//   · antes da migração, nada disso existe;
//   · a chave de segurança é própria (não é a do voto), assinada pela identidade; chave trocada pelo servidor não recebe nada;
//   · plantão (11) e registro (10): só a assessoria indicada abre; o banco não grava quem mandou; a coordenação não abre;
//   · sumiço (12): lembrete antes, entrega só depois do prazo (cifrado), entrar de novo zera, apagar a conta, a última coordenação fica;
//   · o carimbo de tempo (RFC 3161): pedido e conferência da resposta; sem serviço configurado, desligado;
//   · a regra de privacidade: nenhuma coluna de autor, de endereço de rede ou de texto aberto; ninguém recebe lista de pessoas.
// Uso: npm run testar:p4-seguranca-pessoal
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import * as S from "../lib/rede/seguranca-pessoal/selo.ts";
import * as C from "../lib/rede/seguranca-pessoal/carimbo.ts";
import { criarSeguranca } from "../lib/rede/seguranca-pessoal/aparelho.ts";
import { ROTULOS as ROTULOS_DO_VOTO } from "../lib/rede/voto/limiar.ts";
import { LISTA_DE_ROTULOS } from "../lib/rede/membros/rotulos.ts";
import { ROTULOS as ROTULOS_DO_CHAT, ROTULOS_DE_FORA } from "../lib/rede/chat/r2/rotulos.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const lerSe = (c) => (fs.existsSync(path.join(raiz, c)) ? ler(c) : "");

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function recusa(nome, fazer, codigo) {
  try {
    const v = await fazer();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(v)?.slice(0, 200)})`);
  } catch (erro) {
    if (String(erro.codigo ?? erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.codigo ?? erro.message}"`);
  }
}
async function passa(nome, fazer) {
  try {
    const v = await fazer();
    certos++;
    return v;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.codigo ?? erro.message}`);
    return undefined;
  }
}

const CAMINHO = "supabase/migracoes/20261127-p4-seguranca-pessoal.sql";
const SQL = ler(CAMINHO).replace(/^﻿/, "");
// Depois da junção a migração já está no install.sql: o banco de antes é o install.sql cortado antes dela.
const bancoDeAntes = () => criarBanco(ler("supabase/install.sql").replace(/\r\n/g, "\n").includes(SQL.replace(/\r\n/g, "\n").trim()) ? { antesDe: SQL } : {});
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");

// ═══ 0. A migração ═══
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);\s*$/.test(SQL));
ok("a migração diz que roda depois do p5-fim (banco 17)", SQL.includes("Roda depois de 20261126-p5-fim.sql (banco na versão 17)"));
ok("a migração não lê nem guarda endereço de rede", !/\binet\b|\bip\b|x-forwarded|cf-connecting|remote_addr|interno\.origem\(\)/i.test(semComentario));
ok("a migração não mexe na versão nem na lista da porta", !/rede_alumia_versao|alumia_porta_aberta/.test(semComentario));
{
  // Antes da junção a migração não está no install.sql (quem junta cola); depois, está inteira no fim (seguida só das datadas posteriores).
  const install = ler("supabase/install.sql");
  if (install.includes("rede_p4_seg_")) ok("a migração está colada no fim do install.sql (quem junta colou)", noFimDoInstall(SQL, install));
  else ok("a migração não está colada no install.sql (quem junta cola)", true);
}
ok("a migração não usa a chave de voto", !/voto_xwing|voto_assinatura/.test(semComentario));

// ═══ 0b. Os rótulos e a construção ═══
const outros = new Set([...Object.values(ROTULOS_DO_VOTO), ...LISTA_DE_ROTULOS, ...Object.values(ROTULOS_DO_CHAT), ...Object.values(ROTULOS_DE_FORA)].filter((x) => typeof x === "string"));
ok("os rótulos da segurança pessoal são próprios (nenhum repete o voto, o chat ou os membros)", Object.values(S.ROTULOS).every((r) => r.startsWith("alumia/p4/seguranca/") && !outros.has(r)));
ok("os rótulos não se repetem entre si", new Set(Object.values(S.ROTULOS)).size === Object.values(S.ROTULOS).length);
{
  const selo = ler("lib/rede/seguranca-pessoal/selo.ts");
  ok("o selo não usa o voto (nem a chave nem a construção do voto)", !/voto\/limiar|voto_xwing|crypto_kem_xwing/.test(selo));
  ok("o selo usa a biblioteca HPKE do chat", selo.includes('import("@hpke/core")') && selo.includes('import("@hpke/hybridkem-x-wing")'));
  ok("nada de Math.random na segurança pessoal", !/Math\.random/.test(selo + ler("lib/rede/seguranca-pessoal/aparelho.ts") + ler("lib/rede/seguranca-pessoal/carimbo.ts") + ler("lib/rede/seguranca-pessoal/guarda.ts")));
}

// ═══ 1. Antes: nada disso existe ═══
const banco = await bancoDeAntes();
const { dono, rpc, criarUsuario, pg } = banco;
{
  const n = (await dono("select count(*)::int as n from pg_proc where proname like 'rede\\_p4\\_seg\\_%' or proname like 'rede\\_p4\\_sumico%'")).rows[0].n;
  ok(`antes da migração não há função da segurança pessoal (${n})`, n === 0);
  const t = (await dono("select to_regclass('interno.rede_p4_seg_envios') as t")).rows[0].t;
  ok("antes da migração não há tabela de envios", t === null);
}

// ═══ 2. A migração roda (e roda de novo) ═══
let trancar;
try {
  const r = await pg.exec(SQL);
  trancar = r.at(-1)?.rows?.[0]?.alumia_trancar;
  certos++;
} catch (e) {
  falhas.push(`a migração roda no banco 17: ${e.message}`);
}
ok(`a porta passa em todas as funções novas (abertas: ${JSON.stringify(trancar?.abertas)})`, Array.isArray(trancar?.abertas) && trancar.abertas.length === 0);
await passa("a migração roda de novo (idempotente)", () => pg.exec(SQL));

// ═══ 3. As pessoas ═══
const P = {};
const ID = {};
const nomes = ["org", "ana", "bia", "caio", "dani", "eva", "coord", "fabi"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@p4-seg.local`, nome);
  await rpc({ papel: "authenticated", sub: P[nome], ip: `198.51.100.${i + 1}` }, "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1",
    [P[nome], `Pessoa ${i + 1}`, nome === "org" ? "coletivo_luz" : nome]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [P.coord]);
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const id of Object.values(P)) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [id]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("insert into interno.rede_orgs (perfil, tipo, cidade, verificada_em) values ($1, 'coletivo', 'São Paulo', now())", [P.org]);
await dono("insert into interno.rede_org_gestores (org, gestor, papel) values ($1, $2, 'dono')", [P.org, P.ana]);
// A identidade de cada conta (a do chat novo) no diretório: Ed25519 de verdade; o resto do diretório só com o tamanho certo.
for (const nome of nomes) {
  const privada = ed25519.utils.randomSecretKey();
  ID[nome] = { privada, publica: ed25519.getPublicKey(privada) };
  const r = (n) => crypto.getRandomValues(new Uint8Array(n));
  await dono("insert into interno.diretorio_contas (usuario, identidade, pedidos_xwing, pedidos_assinatura, pedidos_caixa, pedidos_pd) values ($1, $2, $3, $4, $5, $6)",
    [P[nome], ID[nome].publica, r(1216), r(64), r(32), r(32)]);
}
const limpar = () => dono("delete from interno.limites");

// O aparelho de cada pessoa: a identidade dela, a guarda na memória e o banco de verdade.
const guardas = {};
let trocadas = new Set();
const aparelho = (nome, extras = {}) => {
  guardas[nome] ??= new Map();
  return criarSeguranca({
    chamar: async (f, a) => {
      await limpar();
      try {
        return await rpc({ papel: "authenticated", sub: P[nome], ip: "198.51.100.200" }, f, a ?? {});
      } catch (e) {
        const erro = new Error(e.message);
        erro.codigo = e.message;
        throw erro;
      }
    },
    fonte: () => ({
      minha: async () => ({ usuario: P[nome], publica: ID[nome].publica, assinar: async (t) => ed25519.sign(t, ID[nome].privada) }),
      conferir: async (conta) => (trocadas.has(conta) ? "trocada" : "conferida"),
    }),
    guarda: {
      ler: async (u) => {
        const g = guardas[nome].get(u);
        return g ? { publica: g.publica.slice(), privada: g.privada.slice() } : null;
      },
      guardar: async (u, par) => void guardas[nome].set(u, { publica: par.publica.slice(), privada: par.privada.slice() }),
    },
    ...extras,
  });
};
const A = Object.fromEntries(nomes.map((n) => [n, aparelho(n)]));

// ═══ 4. Desligado: o banco recusa ═══
await recusa("com o interruptor desligado, o banco recusa", () => A.caio.situacao(), "desligado");
await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-p4-seguranca-pessoal', true) on conflict (nome) do update set ligado = true");
ok("o interruptor está no catálogo, só pelo nome", (await dono("select so_pelo_nome from interno.recursos_catalogo where nome = 'alumia-p4-seguranca-pessoal'")).rows[0]?.so_pelo_nome === true);
await recusa("visitante não chama", () => rpc({ papel: "anon" }, "rede_p4_seg_situacao"), "permission denied");

// ═══ 5. A chave de segurança ═══
await passa("bia cria a chave de segurança", () => A.bia.criarMinhaChave());
{
  const sit = await A.bia.situacao();
  const mc = await A.bia.minhaChave(sit.chave);
  ok("a chave publicada é a deste aparelho", mc.aqui && mc.confere && mc.identidade);
  const linha = (await dono("select publica, assinatura from interno.rede_p4_seg_chaves where usuario = $1", [P.bia])).rows[0];
  ok("a assinatura confere com a identidade da conta", S.conferirChave(ID.bia.publica, P.bia, new Uint8Array(linha.publica), new Uint8Array(linha.assinatura)));
  ok("a chave não é a de voto (a conta nem tem chave de voto)", (await dono("select voto_xwing from interno.diretorio_contas where usuario = $1", [P.bia])).rows[0].voto_xwing === null);
}
await recusa("chave do tamanho errado é recusada", () => rpc({ papel: "authenticated", sub: P.caio }, "rede_p4_seg_chave_publicar", { p: { publica: "AAAA", assinatura: "AAAA" } }), "invalido:publica");

// ═══ 6. A assessoria da organização ═══
await recusa("quem não gere a organização não indica assessoria", () => A.caio.assessora("coletivo_luz", "bia", true), "sem_permissao");
await passa("a gestora indica a bia como assessoria", () => A.ana.assessora("coletivo_luz", "bia", true));
ok("a bia recebe o aviso de que foi indicada", (await dono("select count(*)::int as n from interno.avisos where para = $1 and texto like '%assessoria jurídica%'", [P.bia])).rows[0].n === 1);
{
  const sitCaio = await A.caio.situacao();
  ok("quem pede vê a organização com plantão", sitCaio.plantoes.some((o) => o.handle === "coletivo_luz"));
  const texto = JSON.stringify(sitCaio);
  ok("a situação de quem pede não traz a assessora (nem conta, nem @)", !texto.includes(P.bia) && !texto.includes('"bia"'));
  const sitAna = await A.ana.situacao();
  ok("a gestora vê só que o plantão está pronto, sem lista de pessoas", sitAna.gestora_de[0]?.pronta === true && !JSON.stringify(sitAna).includes(P.bia));
  ok("a bia vê de quem é assessora", (await A.bia.situacao()).assessora_de.some((o) => o.handle === "coletivo_luz"));
  await limpar();
  const destinos = await rpc({ papel: "authenticated", sub: P.caio }, "rede_p4_seg_destinos", { p_org: "coletivo_luz" });
  ok("os destinos trazem só conta, identidade e chave (sem nome nem @)", destinos.length === 1 && Object.keys(destinos[0]).sort().join() === "assinatura,conta,identidade,publica");
}

// ═══ 7. Item 11: o plantão jurídico ═══
const ONDE = "Praça da Sé, perto da catedral";
const pedido = await passa("caio pede o plantão (cifrado no aparelho)", () => A.caio.pedirPlantao("coletivo_luz", ONDE, "detencao", { tipo: "telefone", valor: "11 90000-0000" }));
{
  const linha = (await dono("select e.*, octet_length(e.cifra) as n from interno.rede_p4_seg_envios e where id = $1", [pedido?.id])).rows[0];
  ok("o pedido tem tamanho fixo (2048 por dentro)", linha?.n === 12 + 2048 + 16);
  ok("a cifra não tem o texto aberto", linha && !Buffer.from(linha.cifra).toString("latin1").includes("Praça") && !Buffer.from(linha.cifra).toString("utf8").includes("90000"));
  const colunas = (await dono("select table_name, column_name, data_type from information_schema.columns where table_schema = 'interno' and (table_name like 'rede\\_p4\\_seg\\_%' or table_name like 'rede\\_p4\\_sumico%') order by 1, 2")).rows;
  const envio = colunas.filter((c) => c.table_name === "rede_p4_seg_envios").map((c) => c.column_name).sort().join();
  ok(`o envio não guarda quem mandou (${envio})`, envio === "apagar_em,cifra,criado_dia,finalidade,id,org");
  ok("nenhuma tabela nova guarda endereço de rede ou hora exata", !colunas.some((c) => c.data_type === "inet" || /ip|origem|_em$/.test(c.column_name) && c.column_name !== "apagar_em" || c.data_type.startsWith("timestamp")));
  const entregues = colunas.filter((c) => c.table_name === "rede_p4_sumico_entregues").map((c) => c.column_name).sort().join();
  ok(`o aviso entregue não guarda quem mandou (${entregues})`, entregues === "apagar_em,cifra,destino,embrulho,entregue_dia,id");
}
{
  const caixa = await A.bia.caixa();
  ok("a assessora vê o pedido na caixa", caixa.length === 1 && caixa[0].finalidade === "plantao" && caixa[0].org === "coletivo_luz");
  ok("a caixa não diz quem mandou", !JSON.stringify(caixa).includes(P.caio) && !JSON.stringify(caixa).includes("caio"));
  const aberto = await passa("a assessora abre no aparelho dela", () => A.bia.abrirDaCaixa(caixa[0]?.id));
  ok("o pedido aberto é o que o caio mandou, só com os campos mínimos", aberto?.pedido?.onde === ONDE && aberto.pedido.ocorrido === "detencao" && aberto.pedido.contato.valor === "11 90000-0000"
    && Object.keys(aberto.pedido).sort().join() === "contato,ocorrido,onde,v");
  ok("a assessora recebe um aviso sem o conteúdo", (await dono("select texto from interno.avisos where para = $1 and texto like '%plantão%'", [P.bia])).rows.every((r) => !r.texto.includes("Praça")));
}
await recusa("a gestora (não assessora) não abre", () => A.ana.abrirDaCaixa(pedido?.id), "nao_encontrado");
await recusa("a coordenação não abre", () => A.coord.abrirDaCaixa(pedido?.id), "nao_encontrado");
ok("a caixa da coordenação vem vazia", (await A.coord.caixa()).length === 0);
await recusa("sem a chave neste aparelho, não abre", async () => {
  const outra = aparelho("bia");
  guardas.bia_reserva = guardas.bia;
  guardas.bia = new Map();
  try {
    return await outra.abrirDaCaixa(pedido?.id);
  } finally {
    guardas.bia = guardas.bia_reserva;
  }
}, "sem_chave_aqui");
{
  // O servidor troca a chave da assessora: a assinatura não confere e nada é mandado.
  const antes = (await dono("select publica from interno.rede_p4_seg_chaves where usuario = $1", [P.bia])).rows[0].publica;
  const falsa = await S.novaChaveDeSeguranca();
  await dono("update interno.rede_p4_seg_chaves set publica = $2 where usuario = $1", [P.bia, falsa.publica]);
  await recusa("chave trocada pelo servidor: o aparelho não manda", () => A.caio.pedirPlantao("coletivo_luz", ONDE, "agressao", { tipo: "alumia", valor: "@caio" }), "sem_assessoria");
  await dono("update interno.rede_p4_seg_chaves set publica = $2 where usuario = $1", [P.bia, antes]);
  trocadas = new Set([P.bia]);
  await recusa("identidade trocada no registro de transparência: o aparelho não manda", () => A.caio.pedirPlantao("coletivo_luz", ONDE, "agressao", { tipo: "alumia", valor: "@caio" }), "sem_assessoria");
  trocadas = new Set();
}
{
  // Embrulho para quem não é assessora: o banco recusa.
  const fabiPar = await S.novaChaveDeSeguranca();
  const id = crypto.randomUUID();
  const { cifra, embrulhos } = await S.selar("plantao", id, [{ conta: P.fabi, publica: fabiPar.publica }], S.pedidoDoPlantao(ONDE, "outro", { tipo: "alumia", valor: "x" }));
  await limpar();
  await recusa("embrulho para quem não é assessora é recusado", () => rpc({ papel: "authenticated", sub: P.caio }, "rede_p4_seg_enviar",
    { p: { id, org: "coletivo_luz", finalidade: "plantao", cifra: S.paraBase64(cifra), embrulhos: [{ conta: P.fabi, embrulho: S.paraBase64(embrulhos[0].embrulho) }] } }), "invalido:embrulhos");
}
ok("selar e abrir com outro envio, outra conta ou outra finalidade não abre", await (async () => {
  const par = await S.novaChaveDeSeguranca();
  const id = crypto.randomUUID();
  const dados = new TextEncoder().encode("segredo");
  const { cifra, embrulhos } = await S.selar("plantao", id, [{ conta: P.bia, publica: par.publica }], dados);
  const e = embrulhos[0].embrulho;
  const certo = await S.abrir("plantao", id, P.bia, par.privada, e, cifra);
  const outroId = await S.abrir("plantao", crypto.randomUUID(), P.bia, par.privada, e, cifra);
  const outraConta = await S.abrir("plantao", id, P.caio, par.privada, e, cifra);
  const outraFin = await S.abrir("registro", id, P.bia, par.privada, e, cifra);
  const mexido = cifra.slice();
  mexido[20] ^= 1;
  const quebrado = await S.abrir("plantao", id, P.bia, par.privada, e, mexido);
  return new TextDecoder().decode(certo) === "segredo" && !outroId && !outraConta && !outraFin && !quebrado && e.length === S.TAMANHOS.embrulho;
})());

// ═══ 8. Item 10: o registro de abuso ═══
{
  const foto = new Uint8Array(randomBytes(300 * 1024));
  const comCarimbo = aparelho("caio", { carimbar: async (resumo) => ({ carimbo: Buffer.from(`token:${resumo}`).toString("base64"), hora: "2026-11-20T12:00:00Z", servico: "carimbo.exemplo" }) });
  const r = await passa("caio registra uma foto com carimbo", () => comCarimbo.registrar("coletivo_luz", foto, "foto", "image/jpeg", { local: "Av. Paulista" }));
  ok("o registro diz que foi carimbado e o resumo é o SHA-256 do arquivo", r?.carimbado === true && r.resumo === (await S.resumoHex(foto)));
  const n = (await dono("select octet_length(cifra) as n from interno.rede_p4_seg_envios where id = $1", [r?.id])).rows[0]?.n;
  ok(`o registro vai em degraus de 256 KiB (${n})`, (n - 28) % S.TAMANHOS.degrau === 0);
  const aberto = await passa("a assessora abre o registro", () => A.bia.abrirDaCaixa(r?.id));
  ok("o arquivo aberto é o mesmo, com a ficha, o carimbo e o local escolhido", aberto?.finalidade === "registro" && Buffer.compare(Buffer.from(aberto.arquivo), Buffer.from(foto)) === 0
    && aberto.ficha.resumo === r.resumo && aberto.ficha.carimbo_em === "2026-11-20T12:00:00Z" && aberto.ficha.local === "Av. Paulista" && !("contato" in aberto.ficha));
  const semCarimbo = await passa("sem serviço de carimbo, o registro sai sem carimbo", () => A.caio.registrar("coletivo_luz", foto.slice(0, 1000), "foto", "image/png"));
  ok("e diz que não foi carimbado", semCarimbo?.carimbado === false);
  const sc = await A.bia.abrirDaCaixa(semCarimbo?.id);
  ok("a ficha sem carimbo não tem local (a pessoa não escolheu)", sc.ficha.carimbo === null && !("local" in sc.ficha));
  await recusa("arquivo grande demais nem sai", () => A.caio.registrar("coletivo_luz", new Uint8Array(S.TAMANHOS.arquivo + 1), "video", "video/mp4"), "grande_demais");
  await passa("a assessora apaga o registro", () => A.bia.apagarDaCaixa(r?.id));
  ok("com a última assessora apagando, o envio some inteiro", (await dono("select count(*)::int as n from interno.rede_p4_seg_envios where id = $1", [r?.id])).rows[0].n === 0);
}

// ═══ 9. Item 12: o interruptor de sumiço ═══
await passa("dani cria a chave de segurança", () => A.dani.criarMinhaChave());
await recusa("sem ser contato de confiança, não dá para escolher", () => A.caio.ligarSumico({ dias: 30, apagar: false, destino: "dani", de: "@caio", texto: "Oi" }), "nao_encontrado");
await dono("insert into interno.alumia_ato_contatos (dono, contato, aceito) values ($1, $2, true), ($3, $2, false)", [P.caio, P.dani, P.eva]);
await recusa("contato que não aceitou não serve", () => A.eva.ligarSumico({ dias: 30, apagar: false, destino: "dani", de: "@eva", texto: "Oi" }), "nao_encontrado");
await recusa("nem avisar nem apagar: recusa", () => A.caio.ligarSumico({ dias: 30, apagar: false }), "invalido:vazio");
await recusa("prazo de menos de 14 dias: recusa", () => A.caio.ligarSumico({ dias: 7, apagar: true }), "invalido:dias");
const TEXTO = "Se você recebeu isto, procure a minha irmã e diga que eu estou bem guardado.";
await passa("caio liga o interruptor (avisar a dani em 30 dias)", () => A.caio.ligarSumico({ dias: 30, apagar: false, destino: "@dani", de: "@caio", texto: TEXTO }));
{
  const linha = (await dono("select * from interno.rede_p4_sumico where usuario = $1", [P.caio])).rows[0];
  ok("o aviso está guardado cifrado, de tamanho fixo", linha?.cifra?.length === 12 + 4096 + 16 && !Buffer.from(linha.cifra).toString("utf8").includes("irmã"));
  ok("a situação mostra o interruptor com o prazo", (await A.caio.situacao()).sumico?.dias === 30);
  ok("antes do prazo, nada foi entregue", (await A.dani.recebidos()).length === 0);
}
const rodar = async () => (await dono("select interno.rede_p4_seg_rodar() as r")).rows[0].r;
{
  await dono("update interno.perfis set visto_em = now() - interval '24 days' where id = $1", [P.caio]);
  const r1 = await rodar();
  ok(`7 dias antes, o lembrete vai à própria pessoa (${JSON.stringify(r1)})`, r1.lembrados === 1 && r1.entregues === 0);
  ok("o lembrete chegou ao caio", (await dono("select count(*)::int as n from interno.avisos where para = $1 and texto like '%interruptor de sumiço%'", [P.caio])).rows[0].n === 1);
  await dono("update interno.perfis set visto_em = now() - interval '31 days' where id = $1", [P.caio]);
  const r2 = await rodar();
  ok("o prazo passou, mas o lembrete foi há menos de 7 dias: nada dispara", r2.entregues === 0 && r2.lembrados === 0);
  await dono("update interno.rede_p4_sumico set lembrado_dia = current_date - 7 where usuario = $1", [P.caio]);
  const r3 = await rodar();
  ok(`prazo vencido e lembrete dado: o aviso é entregue (${JSON.stringify(r3)})`, r3.entregues === 1);
  ok("o interruptor do caio some depois de disparar", (await dono("select count(*)::int as n from interno.rede_p4_sumico where usuario = $1", [P.caio])).rows[0].n === 0);
  const recebidos = await A.dani.recebidos();
  ok("a dani abre o aviso no aparelho dela", recebidos.length === 1 && recebidos[0].aviso?.texto === TEXTO && recebidos[0].aviso.de === "@caio");
  ok("a conta do caio continua (ele não pediu para apagar)", (await dono("select count(*)::int as n from interno.perfis where id = $1", [P.caio])).rows[0].n === 1);
  await passa("a dani apaga o aviso", () => A.dani.apagarRecebido(recebidos[0]?.id));
}
{
  // Entrar de novo zera: o lembrete volta a valer e nada dispara.
  await dono("update interno.perfis set visto_em = now() where id = $1", [P.caio]);
  await A.caio.ligarSumico({ dias: 14, apagar: false, destino: "dani", de: "@caio", texto: TEXTO });
  await dono("update interno.rede_p4_sumico set lembrado_dia = current_date - 8 where usuario = $1", [P.caio]);
  const r = await rodar();
  ok("quem entrou depois do lembrete não dispara, e o lembrete zera", r.entregues === 0 && (await dono("select lembrado_dia from interno.rede_p4_sumico where usuario = $1", [P.caio])).rows[0].lembrado_dia === null);
  await passa("caio desliga o interruptor", () => A.caio.desligarSumico());
  ok("desligado, a linha some (com o aviso cifrado)", (await dono("select count(*)::int as n from interno.rede_p4_sumico where usuario = $1", [P.caio])).rows[0].n === 0);
}
{
  // Apagar a conta; a última coordenação nunca é apagada por aqui.
  await passa("eva pede para apagar a conta se sumir", () => A.eva.ligarSumico({ dias: 14, apagar: true }));
  await passa("a coordenação também liga (para apagar)", () => A.coord.ligarSumico({ dias: 14, apagar: true }));
  await dono("update interno.perfis set visto_em = now() - interval '20 days' where id = any($1)", [[P.eva, P.coord]]);
  await dono("update interno.rede_p4_sumico set lembrado_dia = current_date - 7 where usuario = any($1)", [[P.eva, P.coord]]);
  const r = await rodar();
  ok(`a conta da eva é apagada (${JSON.stringify(r)})`, r.apagadas === 1 && (await dono("select count(*)::int as n from auth.users where id = $1", [P.eva])).rows[0].n === 0);
  ok("a última coordenação não é apagada", r.ultima_coordenacao === 1 && (await dono("select count(*)::int as n from interno.perfis where id = $1", [P.coord])).rows[0].n === 1);
  ok("a rotina devolve só números (nunca quem)", Object.values(r).every((x) => typeof x === "number" || typeof x === "boolean"));
}
{
  await dono("update interno.recursos_vivos set ligado = false where nome = 'alumia-p4-seguranca-pessoal'");
  await A.dani.ligarSumico({ dias: 14, apagar: true }).catch(() => undefined);
  ok("com o interruptor desligado no painel, a rotina não faz nada", (await rodar()).ligado === false);
  await dono("update interno.recursos_vivos set ligado = true where nome = 'alumia-p4-seguranca-pessoal'");
}
{
  // A faxina: envio vencido some.
  await dono("update interno.rede_p4_seg_envios set apagar_em = current_date - 1");
  await rodar();
  ok("a faxina leva os envios vencidos", (await dono("select count(*)::int as n from interno.rede_p4_seg_envios")).rows[0].n === 0);
}
{
  // Ninguém (nem a coordenação) tem função que leia a cifra dos outros ou a lista de assessoras.
  const funcoes = (await dono("select p.proname, pg_get_functiondef(p.oid) as d from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like 'rede\\_p4\\_seg\\_%' or p.proname like 'rede\\_p4\\_sumico%')")).rows;
  ok(`são 15 funções públicas (${funcoes.length})`, funcoes.length === 15);
  ok("toda função pública passa pela porta", funcoes.every((f) => f.d.includes("interno.alumia_porta()")));
  ok("nenhuma função pública devolve a lista de assessoras com nome ou @", funcoes.filter((f) => /rede_p4_seg_assessoras/.test(f.d) && /rede_handle', *a\.|nome', *interno\.rede_nome\(a\./.test(f.d)).length === 0);
}

// ═══ 10. O carimbo de tempo (RFC 3161) ═══
{
  ok("sem ALUMIA_CARIMBO_URL, sem carimbo (desligado)", C.servicoDoCarimbo(undefined) === null && C.servicoDoCarimbo("") === null);
  ok("só https", C.servicoDoCarimbo("http://exemplo.org/tsr") === null && C.servicoDoCarimbo("https://exemplo.org/tsr")?.hostname === "exemplo.org");
  const resumo = crypto.getRandomValues(new Uint8Array(32));
  const nonce = crypto.getRandomValues(new Uint8Array(8));
  const req = C.pedidoDeCarimbo(resumo, nonce);
  ok("o pedido é um SEQUENCE DER com versão 1 e o resumo dentro", req[0] === 0x30 && req[2] === 0x02 && req[3] === 0x01 && req[4] === 0x01 && Buffer.from(req).includes(Buffer.from(resumo)));
  // Uma resposta montada à mão: status 0, e um "carimbo" com o resumo, o nonce e a hora (a forma do TSTInfo, sem a assinatura).
  const tlv = (tag, c) => {
    const n = c.length;
    const len = n < 0x80 ? [n] : n < 0x100 ? [0x81, n] : [0x82, n >> 8, n & 0xff];
    return [tag, ...len, ...c];
  };
  const n = Array.from(C.nonceDoPedido(nonce));
  const hora = Array.from(Buffer.from("20261120120000Z"));
  const tst = (r, nn) => tlv(0x30, [...tlv(0x02, [1]), ...tlv(0x06, [1, 2, 3]), ...tlv(0x30, [...tlv(0x30, [0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]), ...tlv(0x04, Array.from(r))]), ...tlv(0x02, [5]), ...tlv(0x18, hora), ...tlv(0x02, nn)]);
  const resp = (status, r, nn) => new Uint8Array(tlv(0x30, [...tlv(0x30, tlv(0x02, [status])), ...tlv(0x30, tst(r, nn))]));
  const certo = C.lerRespostaDoCarimbo(resp(0, resumo, n), resumo, nonce);
  ok("a resposta certa é aceita, com a hora", certo.ok && certo.hora === "2026-11-20T12:00:00Z");
  ok("outro resumo: recusa", C.lerRespostaDoCarimbo(resp(0, crypto.getRandomValues(new Uint8Array(32)), n), resumo, nonce).motivo === "resumo");
  ok("outro nonce: recusa", C.lerRespostaDoCarimbo(resp(0, resumo, [1, 2, 3, 4, 5, 6, 7, 8]), resumo, nonce).motivo === "nonce");
  ok("serviço recusou (status 2): recusa", C.lerRespostaDoCarimbo(resp(2, resumo, n), resumo, nonce).motivo === "recusado");
  ok("lixo: recusa", C.lerRespostaDoCarimbo(new Uint8Array([1, 2, 3]), resumo, nonce).motivo === "formato");
  const rota = ler("app/api/alumia/carimbo/route.ts");
  ok("a rota do carimbo manda ao serviço só o resumo e nada vai a log", rota.includes("pedidoDeCarimbo(resumo, nonce)") && !/console\.|impressaoDoPedido|x-forwarded/.test(rota));
  ok("a rota do carimbo fica fechada com o interruptor desligado", rota.includes('ligado("alumia-p4-seguranca-pessoal")'));
}

// ═══ 11. A flag, a rota e as telas ═══
{
  const recursos = ler("lib/recursos.ts");
  ok("a flag existe e liga só pelo nome", /"alumia-p4-seguranca-pessoal":/.test(recursos) && /SO_PELO_NOME[^;]*"alumia-p4-seguranca-pessoal"/.test(recursos));
  ok("a flag não está ligada por padrão", !/PADRAO[^;]*"alumia-p4-seguranca-pessoal"/.test(recursos));
  const { rotaNova, rotaNovaLigada } = await import("../lib/rede/rotas-novas.ts");
  ok("a rota /seguranca-pessoal existe, com a flag, sem indexar", rotaNova("seguranca-pessoal")?.flag === "alumia-p4-seguranca-pessoal" && rotaNova("seguranca-pessoal")?.indexar === false);
  ok("desligada, a rota não abre (404)", rotaNovaLigada("seguranca-pessoal") === false);
  ok("a tela está no registro", ler("components/rede/registro.tsx").includes('"seguranca-pessoal":'));
  ok("a página existe e usa a PaginaNova", lerSe("app/[lang]/alumia/seguranca-pessoal/page.tsx").includes('nome="seguranca-pessoal"'));
  ok("a base da chave sai com o Sair rápido", ler("lib/modo-seguro.ts").includes('"lucia-alumia-seguranca"'));
  const pt = JSON.parse(lerSe("i18n/rede/seguranca-pessoal/pt.json") || "{}");
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const t = JSON.parse(lerSe(`i18n/rede/seguranca-pessoal/${l}.json`) || "{}");
    ok(`${l}: tradução nova marcada como rascunho`, typeof t._rascunho === "string");
  }
  ok("pt: o texto diz o limite honesto (a privada só neste aparelho)", JSON.stringify(pt).includes("só neste aparelho"));
  ok("pt: as categorias do plantão cobrem a lista do aparelho", S.OCORRIDOS.every((o) => typeof pt.plantao?.ocorridos?.[o] === "string"));
}

console.log(`\n${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
process.exit(0);
