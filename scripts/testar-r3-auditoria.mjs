// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os achados da auditoria interna da R3 que ficam no banco, escritos como ataque (num banco local montado do install.sql inteiro,
// scripts/banco-local.mjs). Cada um falhava antes do conserto (20261125-r3-fim.sql, parte 4b) e passa depois:
//   1. Quem tem o banco inteiro ligava a caixa de PEDIDOS de conversa à conta (pelo diretório) e contava, em interno.caixa_contagem,
//      quantos pedidos cada conta recebeu por dia (quantas pessoas procuram fulana). Agora a caixa de pedidos não grava contagem por
//      dia; o teto (300) é o que está nela esperando leitura.
//   2. O diretório, lido sem sessão só pelo codinome, devolvia o DIA exato em que cada aparelho entrou: quem está de fora acompanhava
//      quando a pessoa troca ou acrescenta aparelho. Agora só a segunda-feira da semana (o certificado do aparelho assina o mesmo dia).
// Uso: npm run testar:r3-auditoria
import crypto from "node:crypto";
import { criarBanco } from "./banco-local.mjs";
import { semanaDoCertificado } from "../lib/rede/chat/r2/certificados.ts";

let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

const sorteio = (n) => crypto.randomBytes(n);
const b64 = (b) => Buffer.from(b).toString("base64");
const resumo = (r, v) => crypto.createHash("sha256").update(Buffer.concat([Buffer.from(r, "utf8"), Buffer.from(v)])).digest();
const PEDIDO = 1120 + 4096 + 16;

const banco = await criarBanco();
const { dono, criarUsuario } = banco;
const agora = () => Math.floor(Date.now() / 1000);
const rpc = (quem, funcao, argumentos = {}) => banco.exclusivo(async () => {
  const nomes = Object.keys(argumentos);
  const papel = quem.papel ?? "authenticated";
  const claims = papel === "authenticated" ? JSON.stringify({ role: papel, sub: quem.sub, aal: "aal2", session_id: quem.sessao, iat: agora() - 30, exp: agora() + 3600 }) : JSON.stringify({ role: papel });
  await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', '{}', false)", [claims]);
  await banco.pg.exec(`set role ${papel}`);
  try {
    const valores = nomes.map((n) => {
      const v = argumentos[n];
      return v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Uint8Array) ? JSON.stringify(v) : v;
    });
    return (await banco.pg.query(`select public.${funcao}(${nomes.map((n, i) => `${n} => $${i + 1}`).join(", ")}) as r`, valores)).rows[0]?.r ?? null;
  } finally {
    await banco.pg.exec("reset role");
  }
});
const servidor = { papel: "service_role" };

const P = {};
for (const nome of ["ana", "bia"]) {
  P[nome] = await criarUsuario(`${nome}@auditoria.local`, `Pessoa ${nome}`);
  await rpc({ sub: P[nome], sessao: crypto.randomUUID() }, "eu").catch(() => undefined);
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of Object.keys(P)) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `aud_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("select interno.alumia_entrada_ligar(true)");
for (const nome of Object.keys(P)) await dono("insert into interno.alumia_entrada (usuario, situacao) values ($1, 'aprovada') on conflict (usuario) do update set situacao = 'aprovada'", [P[nome]]);
const sessao = (n) => ({ sub: P[n], sessao: crypto.randomUUID() });

// A Bia publica a conta (com a caixa de pedidos) e um aparelho.
const cx = { id: sorteio(32), pd: sorteio(32), pl: sorteio(32) };
await rpc(sessao("bia"), "rede_diretorio_conta", { p: { identidade: b64(sorteio(32)), pedidos_xwing: b64(sorteio(1216)), pedidos_assinatura: b64(sorteio(64)), pedidos_caixa: b64(cx.id), pedidos_pd: b64(cx.pd), pedidos_pl_h: b64(resumo("alumia/r2/passe-leitura", cx.pl)) } });
await rpc(sessao("bia"), "rede_diretorio_publicar", { p_aparelho: { aparelho: b64(sorteio(32)), certificado: b64(sorteio(64)), proteus_impressao: b64(sorteio(32)), xwing_semana: b64(sorteio(1216)), xwing_assinatura: b64(sorteio(64)), semana: 2900 } });

// ── 1. Os pedidos por conta e por dia ──
const hoje = (await dono("select interno.caixa_hoje()::text as d")).rows[0].d;
const pedir = () => rpc(servidor, "rede_caixa_lote", { p_itens: [{ acao: "pedido", codinome: "Codinome bia", envelope: b64(sorteio(PEDIDO)), gastos: [b64(sorteio(32)), b64(sorteio(32))] }], p_dia: hoje });
let aceitos = 0;
for (let i = 0; i < 3; i++) if ((await pedir()).resultados[0].ok) aceitos++;
ok("três pedidos de conversa entram na caixa de pedidos da Bia", aceitos === 3);
const porConta = await dono(`select f.rede_codinome as codinome, c.dia::text, c.n
  from interno.diretorio_contas d join interno.perfis f on f.id = d.usuario
  join interno.caixa_contagem c on c.caixa_h = extensions.digest(convert_to('alumia/r2/caixa', 'UTF8') || d.pedidos_caixa, 'sha256')`);
ok("ATAQUE quem tem o banco: nenhuma contagem por dia da caixa de pedidos (não dá para saber quantos pedidos a Bia recebeu em cada dia)", porConta.rows.length === 0, JSON.stringify(porConta.rows));
// O teto continua: 300 esperando leitura, o seguinte é recusado.
const idH = resumo("alumia/r2/caixa", cx.id);
await dono("insert into interno.pacotes (id, caixa_h, ordem, envelope, dia) select extensions.gen_random_bytes(16), $1, 100 + g, extensions.gen_random_bytes(10), current_date from generate_series(1, 297) g", [idH]);
ok("o teto da caixa de pedidos: com 300 esperando leitura, o pedido seguinte é recusado (cheia)", (await pedir()).resultados[0].erro === "cheia");
await dono("delete from interno.pacotes where caixa_h = $1 and ordem > 100", [idH]);
ok("lido (saiu do servidor), volta a caber", (await pedir()).resultados[0].ok === true);
ok("o limite de antes (contagem por dia) continua nas caixas sem dono", /p_multi then 5000 else 1000/.test((await dono("select pg_get_functiondef('interno.caixa_contar(bytea, boolean, boolean)'::regprocedure) as d")).rows[0].d));

// ── 2. O dia do aparelho no diretório lido de fora ──
const dir = await rpc(servidor, "rede_diretorio_ler", { p_codinome: "codinome bia" });
const segunda = (await dono("select date_trunc('week', interno.caixa_hoje()::timestamp)::date::text as d")).rows[0].d;
ok("ATAQUE de fora: o diretório não diz o dia exato em que o aparelho entrou, só a segunda-feira da semana", dir?.aparelhos?.length === 1 && dir.aparelhos[0].criado_dia === segunda, JSON.stringify(dir?.aparelhos?.map((a) => a.criado_dia)));
const diaDoCertificado = new Date(semanaDoCertificado(Date.now()) * 86_400_000).toISOString().slice(0, 10);
ok("o aparelho assina o certificado com o MESMO dia que o banco grava (senão o certificado não confere)", diaDoCertificado === segunda, `${diaDoCertificado} × ${segunda}`);
ok("semanaDoCertificado: sempre uma segunda-feira, nunca depois de hoje, no máximo 6 dias antes", [0, 1, 2, 3, 4, 5, 6, 400, 9999].every((d) => {
  const ms = Date.UTC(2026, 10, 16) + d * 86_400_000 + 3_600_000;
  const s = semanaDoCertificado(ms);
  const hojeD = Math.floor(ms / 86_400_000);
  return new Date(s * 86_400_000).getUTCDay() === 1 && s <= hojeD && hojeD - s <= 6;
}));

// ── A porta ──
const porta = (await dono("select interno.alumia_trancar() as r")).rows[0].r;
ok("a porta não deixa função aberta", (porta?.abertas ?? []).length === 0, JSON.stringify(porta?.abertas));

console.log(`Auditoria interna da R3 (banco): ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
