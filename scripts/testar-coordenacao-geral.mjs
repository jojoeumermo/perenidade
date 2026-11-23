// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a coordenação geral no painel único (supabase/migracoes/20261128-coordenacao-geral.sql), com o install.sql deste ramo:
//  - sem a marca, ligar um recurso que só liga pelo nome continua pedindo a segunda pessoa;
//  - com a marca, a coordenação geral liga direto (aal2), e só ela: outra pessoa da coordenação segue pedindo;
//  - a marca não vale sem o segundo fator, sem o papel de coordenação ou com a conta suspensa;
//  - a função da marca não é chamável de fora.
// Uso: npm run testar:coordenacao-geral
import fs from "node:fs";
import path from "node:path";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(import.meta.dirname, "..");
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
const semCR = (t) => t.replace(/\r\n/g, "\n");
let certos = 0;
const falhas = [];
const confere = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir) {
  try {
    const valor = await promessa();
    if (conferir && !(await conferir(valor))) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 300)}`);
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}
async function recusa(nome, promessa) {
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar, mas passou (${JSON.stringify(valor)?.slice(0, 160)})`);
  } catch {
    certos++;
  }
}

const MIGRACAO = ler("supabase", "migracoes", "20261128-coordenacao-geral.sql");
const install = semCR(ler("supabase", "install.sql"));
confere("a migração está colada inteira no install.sql", install.includes(semCR(MIGRACAO).trim()));
confere("ela vem depois do 20261127-p4-fim.sql", install.indexOf(semCR(MIGRACAO).trim()) > install.lastIndexOf("select interno.alumia_trancar();", install.indexOf(semCR(MIGRACAO).trim())));
confere("a migração termina trancando na porta", /select interno\.alumia_trancar\(\);\s*$/.test(MIGRACAO));
confere("não mexe na versão nem na lista da porta", !/rede_alumia_versao\s*\(|alumia_porta_aberta\s*\(/.test(MIGRACAO.replace(/^--.*$/gm, "")));
confere("ninguém fica marcado pela migração", !/insert into interno\.configuracoes/i.test(MIGRACAO));

const banco = await criarBanco();
const { rpc, dono, criarUsuario, pg, exclusivo } = banco;
await espera("a migração roda de novo sem quebrar", () => exclusivo(() => pg.exec(MIGRACAO)));

const como = (sub, aal = "aal2") => ({ papel: "authenticated", sub, aal, ip: "203.0.113.70" });
const ids = {};
for (const chave of ["geral", "outra"]) {
  ids[chave] = await criarUsuario(`${chave}@coordenacao.local`, `Nome ${chave}`);
  await rpc(como(ids[chave]), "eu");
  await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao') on conflict do nothing", [ids[chave]]);
}
const ligar = (quem, nome, aal) => rpc(como(quem, aal), "alumia_admin_recurso", { p_nome: nome, p_ligar: true, p_motivo: "Teste da coordenação geral.", p_frase: null });
const desligar = async (nome) => {
  await dono("delete from interno.recursos_vivos where nome = $1", [nome]);
  await dono("update interno.confirmacoes set status = 'cancelada' where alvo = $1 and status = 'aguardando'", [nome]);
};

await espera("sem a marca, ligar alumia-mapa pede a segunda pessoa", () => ligar(ids.geral, "alumia-mapa"), (r) => r.aguardando === true);
await desligar("alumia-mapa");

await dono("insert into interno.configuracoes (chave, valor) values ('coordenacao_geral', jsonb_build_object('usuario', $1::text)) on conflict (chave) do update set valor = excluded.valor", [ids.geral]);
await espera("com a marca, a coordenação geral liga direto", () => ligar(ids.geral, "alumia-mapa"), (r) => r.ok === true && r.decisao === true && !r.aguardando);
await espera("e o recurso ficou ligado no banco", () => dono("select ligado from interno.recursos_vivos where nome = 'alumia-mapa'"), (r) => r.rows?.[0]?.ligado === true);
await espera("o estado do painel mostra 'direto' para ela", () => rpc(como(ids.geral), "alumia_admin_estado"), (r) => r.recursos.find((k) => k.nome === "alumia-p4-cultura")?.direto === true);
await desligar("alumia-mapa");

await espera("outra pessoa da coordenação segue pedindo a segunda pessoa", () => ligar(ids.outra, "alumia-mapa"), (r) => r.aguardando === true);
await espera("e para ela o painel não mostra 'direto'", () => rpc(como(ids.outra), "alumia_admin_estado"), (r) => r.recursos.find((k) => k.nome === "alumia-p4-cultura")?.direto === false);
await desligar("alumia-mapa");

await recusa("sem o segundo fator, o painel nem abre", () => ligar(ids.geral, "alumia-mapa", "aal1"));

await dono("delete from interno.papeis where usuario = $1 and papel = 'coordenacao'", [ids.geral]);
await espera("sem o papel de coordenação, a marca não vale", () => dono("select interno.alumia_coord_geral() as v"), (r) => r.rows?.[0]?.v === false);
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao') on conflict do nothing", [ids.geral]);

await dono("update interno.configuracoes set valor = '{\"usuario\": \"nao-e-uuid\"}'::jsonb where chave = 'coordenacao_geral'");
await espera("marca torta não quebra nada e não vale", () => ligar(ids.geral, "alumia-mapa"), (r) => r.aguardando === true);
await desligar("alumia-mapa");

await recusa("anon não chama a função da marca", () => rpc({ papel: "anon", ip: "203.0.113.71" }, "alumia_coord_geral"));
await recusa("conta comum não chama a função da marca", () => rpc(como(ids.outra), "alumia_coord_geral"));

await espera("a porta continua fechada (abertas [])", () => dono("select interno.alumia_trancar() -> 'abertas' as a"), (r) => JSON.stringify(r.rows?.[0]?.a) === "[]");

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log("  FALHA:", f);
process.exit(falhas.length ? 1 : 0);
