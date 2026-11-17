// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova supabase/migracoes/20261117-alumia-o11-porta.sql num Postgres de verdade (scripts/banco-local.mjs), rodada DUAS vezes sobre o
// install.sql: com um banimento por rede em vigor, o pedido de entrada aceita o passe da porta (que já recusou a rede barrada) no
// lugar da impressão de rede guardada ao lado da conta; sem passe e sem impressão, a recusa de antes. E a tela não guarda mais a
// impressão de rede de quem só prepara uma conta pelos Ajustes (lib/rede/seguranca/isca.ts).
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o11-porta.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 500)}`);
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

// ═══════════════════ 0. Os arquivos ═══════════════════
const sql = ler("supabase/migracoes/20261117-alumia-o11-porta.sql");
ok("a função tem search_path fixo", /security definer set search_path = interno, pg_temp/.test(sql));
ok("a migração termina chamando as portas", sql.trimEnd().endsWith("select interno.alumia_trancar();"));
ok("nenhuma tabela nem coluna nova", !/create table|alter table/i.test(sql));
ok("a migração não lê nem guarda endereço de rede", !/x-forwarded-for|cf-connecting-ip|\binet\b|ip_address|interno\.origem\(\)/i.test(sql));
const install = ler("supabase/install.sql");
ok("o install.sql tem a cópia idêntica, antes do fim da onda", install.includes(sql.trimEnd()) && install.indexOf(sql.trimEnd()) < install.indexOf("-- Alumia · Onda 11 · fim:"));
const isca = ler("lib/rede/seguranca/isca.ts");
ok("o preparo da conta pelos Ajustes não registra a impressão de rede", !/api\/alumia\/impressao/.test(isca));
const rede = ler("lib/rede/painel/cliente-rede.ts");
const encaixe = ler("components/rede/seguranca/encaixe-da-entrada.ts");
ok("a entrada pela senha de pânico não registra a impressão de rede naquela página", /export function naoRegistrarRedeNestaPagina/.test(rede) && /naoRegistrarRedeNestaPagina\(\)/.test(encaixe));

// ═══════════════════ 1. O banco ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal1" });
const servico = { papel: "service_role" };
await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("e de novo, sem estrago (idempotente)", () => exec(sql));
await espera("as portas: nenhuma função public.rede_*/alumia_* ficou aberta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
await espera("o gatilho continua no pedido de entrada", async () => (await dono("select count(*)::int n from pg_trigger where tgname = 'alumia_painel_pedido_com_rede' and tgrelid = 'interno.alumia_entrada'::regclass")).rows[0].n, (n) => n === 1);

await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
const imp = (n) => n.toString(16).padStart(64, "0");
const coord = await criarUsuario("coord@porta.local", "Pessoa coord");
await rpc(como(coord), "eu");
const ban = (await dono("insert into interno.alumia_impressao_banimentos (motivo, por, contas, ate) values ('Rede usada para ataque coordenado.', $1, 1, now() + interval '7 days') returning id", [coord])).rows[0].id;
await dono("insert into interno.alumia_impressao_banidas (banimento, impressao) values ($1, $2)", [ban, imp(6)]);

const pedir = (u) => rpc(como(u), "alumia_entrada_pedir", { p_codinome: `Codinome ${u.slice(0, 4)}`, p_motivo: "Quero me organizar com o núcleo do meu bairro.", p_maior: true, p_versao: 1, p_aceite: true });
const nova = async (nome) => {
  const u = await criarUsuario(`${nome}@porta.local`, `Pessoa ${nome}`);
  await rpc(como(u), "eu");
  return u;
};
const ligar = (sim) => dono("insert into interno.configuracoes (chave, valor) values ('alumia_cadastro', $1) on conflict (chave) do update set valor = excluded.valor", [JSON.stringify({ ligada: sim })]);
const selo = (n) => n.toString(16).padStart(64, "a");
const passar = (u, impressao, n) => rpc(servico, "alumia_cadastro_passar", { p_momento: "pedido", p_chave: null, p_selo: selo(n), p_vence: new Date(Date.now() + 10 * 60_000).toISOString(), p_impressao: impressao, p_usuario: u, p_convite: null });

await ligar(false);
const semNada = await nova("semnada");
await recusa("porta desligada, banimento em vigor: sem passe e sem impressão, a recusa de antes", () => pedir(semNada), "alumia_rede");
await espera("o passe não sai para a rede barrada", () => passar(semNada, imp(6), 1), (r) => r.ok === false);
await recusa("e sem passe o pedido continua recusado", () => pedir(semNada), "alumia_rede");
await espera("o passe sai para outra rede", () => passar(semNada, imp(7), 2), (r) => r.ok === true);
await espera("com o passe da porta, o pedido entra sem nenhuma impressão guardada ao lado da conta", async () => [await pedir(semNada), (await dono("select count(*)::int n from interno.alumia_impressoes where usuario = $1", [semNada])).rows[0].n],
  ([r, n]) => r.situacao === "em_analise" && n === 0);
const comImpressao = await nova("comimpressao");
await rpc(servico, "alumia_impressao_registrar", { p_usuario: comImpressao, p_impressao: imp(9), p_momento: "pedido" });
await espera("a impressão recente continua valendo como antes", () => pedir(comImpressao), (r) => r.situacao === "em_analise");
const vencido = await nova("vencido");
await dono("insert into interno.alumia_cadastro_passes (usuario, vence_em) values ($1, now() - interval '1 minute')", [vencido]);
await recusa("passe vencido não vale", () => pedir(vencido), "alumia_rede");

await ligar(true);
const comPorta = await nova("comporta");
await recusa("porta ligada: sem passe, a porta recusa primeiro", () => pedir(comPorta), "alumia_porta");
await espera("porta ligada: o passe (dado depois de conferir a rede) basta", async () => {
  await passar(comPorta, imp(8), 3);
  return pedir(comPorta);
}, (r) => r.situacao === "em_analise");
await espera("sem impressão guardada para essa conta", async () => (await dono("select count(*)::int n from interno.alumia_impressoes where usuario = $1", [comPorta])).rows[0].n, (n) => n === 0);

await banco.pg.close();
console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  FALHA ${f}`);
process.exit(falhas.length ? 1 : 0);
