// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 5, A7: "a federação ainda não está ligada no servidor" com o painel dizendo "Fediverso: ligada".
//   · a causa no código: a página /alumia/fediverso saía pronta da montagem da imagem, que não tem o segredo da federação (só as
//     variáveis públicas vão para a montagem), e dizia "não ligada" para sempre. Agora ela espera o pedido (connection()) antes de
//     ler o segredo. A conferência pelo texto falha no código de antes;
//   · a Saúde do painel mostra as peças da federação (lib/rede/fediverso/saude.ts): o recurso, o endereço em https, o segredo no
//     servidor, o SHA-256 e o endereço de entrega no banco, e se o banco reconhece o segredo; nunca valor, tamanho ou endereço;
//   · o segredo está na lista das variáveis do servidor e no .env.example;
//   · o banco (supabase/migracoes/20261126-p5-federacao.sql): public.alumia_admin_federacao só para a coordenação com o segundo
//     fator, só sim ou não.
// Uso: npm run testar:p5-federacao
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import { oQueFalta, saudeDaFederacao, situacaoDoSegredo } from "../lib/rede/fediverso/saude.ts";
import { VARIAVEIS_DO_SERVIDOR, situacaoDasVariaveis } from "../lib/rede/seguranca/variaveis.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

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

// ═══════════════════ 1. A página espera o pedido para ler o segredo ═══════════════════
{
  const pagina = ler("app/[lang]/alumia/fediverso/page.tsx");
  const corpo = pagina.slice(pagina.indexOf("export default async function Pagina"));
  const espera = corpo.indexOf("await connection()");
  const le = corpo.indexOf("federacaoNoServidor()");
  ok("a página do Fediverso chama connection() (de next/server)", /import \{ connection \} from "next\/server";/.test(pagina) && espera > 0);
  ok("connection() vem ANTES de ler o segredo (senão a montagem grava \"não ligada\" para sempre)", espera > 0 && le > espera);
  ok("o segredo continua lido só no servidor (nada de NEXT_PUBLIC)", !/NEXT_PUBLIC_ALUMIA_FEDIVERSO/.test(pagina));
}

// ═══════════════════ 2. As variáveis e o .env.example ═══════════════════
{
  const v = VARIAVEIS_DO_SERVIDOR.find((x) => x.nome === "ALUMIA_FEDIVERSO_SEGREDO");
  ok("a Saúde conhece ALUMIA_FEDIVERSO_SEGREDO (obrigatória, 32 ou mais)", Boolean(v) && !v.opcional && v.minimo === 32);
  const s = situacaoDasVariaveis({ ALUMIA_FEDIVERSO_SEGREDO: "x".repeat(40) }).find((x) => x.nome === "ALUMIA_FEDIVERSO_SEGREDO");
  const curta = situacaoDasVariaveis({ ALUMIA_FEDIVERSO_SEGREDO: "curto" }).find((x) => x.nome === "ALUMIA_FEDIVERSO_SEGREDO");
  ok("a situação diz presente/curta, nunca o valor", s?.situacao === "presente" && curta?.situacao === "curta" && !JSON.stringify(s).includes("xxxx"));
  ok("o .env.example tem ALUMIA_FEDIVERSO_SEGREDO vazio", /^ALUMIA_FEDIVERSO_SEGREDO=$/m.test(ler(".env.example")));
}

// ═══════════════════ 3. As peças da federação (puro) ═══════════════════
{
  ok("segredo: falta, curta, presente", situacaoDoSegredo(undefined) === "falta" && situacaoDoSegredo("abc") === "curta" && situacaoDoSegredo("a".repeat(32)) === "presente");
  const tudo = { total: true, grupos: false, segredo_guardado: true, url_entrega: true };
  const pronta = await saudeDaFederacao(tudo, async () => true, { ALUMIA_FEDIVERSO_SEGREDO: "s".repeat(48) }, "https://alumia.exemplo.org");
  ok("com as quatro peças: pronta, nada falta", pronta.faltam.length === 0 && pronta.banco_reconhece === true && pronta.endereco);
  ok("a resposta não leva o segredo nem o endereço", !JSON.stringify(pronta).includes("ssss") && !JSON.stringify(pronta).includes("exemplo.org"));
  const semSegredo = await saudeDaFederacao(tudo, async () => { throw new Error("não devia perguntar"); }, {}, "https://alumia.exemplo.org");
  ok("o caso da coordenação: painel ligado, sem o segredo no servidor → diz o que pôr e não pergunta ao banco", semSegredo.segredo === "falta" && semSegredo.banco_reconhece === null && semSegredo.faltam.some((f) => /ALUMIA_FEDIVERSO_SEGREDO/.test(f)));
  const semBanco = await saudeDaFederacao({ ...tudo, segredo_guardado: false, url_entrega: false }, async () => false, { ALUMIA_FEDIVERSO_SEGREDO: "s".repeat(48) }, "https://alumia.exemplo.org");
  ok("sem o SHA-256 no banco → diz para guardar", semBanco.faltam.some((f) => /SHA-256/.test(f)) && !semBanco.faltam.some((f) => /não é o mesmo/.test(f)));
  const outro = await saudeDaFederacao(tudo, async () => false, { ALUMIA_FEDIVERSO_SEGREDO: "s".repeat(48) }, "https://alumia.exemplo.org");
  ok("segredo diferente do guardado → diz que não confere", outro.faltam.some((f) => /não é o mesmo/.test(f)));
  ok("sem https → diz para pôr o endereço", oQueFalta({ endereco: false, segredo: "presente", banco_reconhece: true, banco: tudo }).some((f) => /NEXT_PUBLIC_ALUMIA_URL/.test(f)));
  ok("Fediverso desligado no painel → diz que é decisão da coordenação", oQueFalta({ endereco: true, segredo: "presente", banco_reconhece: true, banco: { ...tudo, total: false } }).some((f) => /fediverso-total/.test(f)));
}
{
  const rota = ler("app/api/alumia/painel/saude/route.ts");
  ok("a rota da Saúde devolve a federação e pergunta ao banco só com uma ação de leitura", /federacao/.test(rota) && /"dominio_estado"/.test(rota) && /alumia_admin_federacao/.test(rota));
  ok("a rota não escreve log", !/console\./.test(rota));
  const tela = ler("components/rede/seguranca/SaudeDoServicoDeContas.tsx");
  ok("a tela da Saúde mostra as peças da federação", /VistaDaFederacao/.test(tela) && /ALUMIA_FEDIVERSO_SEGREDO no servidor/.test(tela));
}

// ═══════════════════ 4. O banco ═══════════════════
const SQL = normal(ler("supabase/migracoes/20261126-p5-federacao.sql"));
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("a migração está no fim do install.sql (seguida só de migrações datadas)", noFimDoInstall(SQL));
ok("não mexe na versão nem na lista de exceções", !/function public\.rede_alumia_versao|alumia_porta_aberta/.test(SQL.replace(/--.*$/gm, "")));
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const como = (sub, aal = "aal2") => ({ papel: "authenticated", sub, aal });
await espera("roda de novo por cima", () => banco.exclusivo(() => banco.pg.exec(SQL)));
const coord = await criarUsuario("coord@fed.local", "Coordenação");
const comum = await criarUsuario("comum@fed.local", "Comum");
await rpc(como(coord), "eu");
await rpc(como(comum), "eu");
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [coord]);
await recusa("conta comum não vê", () => rpc(como(comum), "alumia_admin_federacao"), "sem_permissao");
await recusa("coordenação sem o segundo fator não vê", () => rpc(como(coord, "aal1"), "alumia_admin_federacao"), "confirme_segundo_fator");
await recusa("visitante não vê", () => rpc({ papel: "anon" }, "alumia_admin_federacao"), "permission denied");
await espera("sem configuração: nada guardado", () => rpc(como(coord), "alumia_admin_federacao"), (r) => r.segredo_guardado === false && r.url_entrega === false && typeof r.total === "boolean");
const HASH = "a".repeat(64);
await dono(`insert into interno.configuracoes (chave, valor) values ('fediverso', jsonb_build_object('segredo_hash', $1::text, 'url_entrega', 'https://alumia.exemplo.org/api/fediverso/entregar'))
  on conflict (chave) do update set valor = excluded.valor`, [HASH]);
await espera("com a configuração: guardados, e só sim ou não (nem o SHA-256 nem o endereço saem)", () => rpc(como(coord), "alumia_admin_federacao"),
  (r) => r.segredo_guardado === true && r.url_entrega === true && !JSON.stringify(r).includes(HASH) && !JSON.stringify(r).includes("exemplo.org"));
await espera("o recurso ligado no painel aparece como total", async () => {
  await dono("insert into interno.recursos_vivos (nome, ligado, por) values ('fediverso-total', true, $1) on conflict (nome) do update set ligado = true", [coord]);
  return rpc(como(coord), "alumia_admin_federacao");
}, (r) => r.total === true);
await espera("a função é estável e não grava (a API a roda em transação só de leitura)", () => dono("select provolatile from pg_proc where oid = 'public.alumia_admin_federacao()'::regprocedure"), (r) => r.rows[0].provolatile === "s");

console.log(`\nP5 · federação (A7): ${certos} certos, ${falhas.length} falhas.`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
