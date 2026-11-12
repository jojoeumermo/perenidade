// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o registro público das chaves do chat (supabase/migracoes/20261113-chat-transparencia.sql, lib/rede/chat/transparencia.ts)
// num Postgres de verdade dentro do Node: toda chave nova entra no registro, qualquer um (sem conta) refaz a corrente, o aparelho
// nota o servidor reescrevendo o passado e o servidor mostrando uma chave que não é a do registro.
// Uso: npm run testar:chat-registro
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import { abrirAparelho, fecharAparelho } from "../lib/rede/chat/olm.ts";
import { atualizarVista, conferir, INICIO, quemNoRegistro } from "../lib/rede/chat/transparencia.ts";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferirValor = () => true) {
  try {
    const valor = await promessa();
    if (conferirValor(valor)) certos++;
    else falhas.push(`${nome}: veio ${JSON.stringify(valor)?.slice(0, 200)}`);
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}
async function recusa(nome, promessa, codigo) {
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 160)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}
const ler = (caminho) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

const migracao = ler("supabase/migracoes/20261113-chat-transparencia.sql");
const install = ler("supabase/install.sql");
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
await espera("a migração está no install.sql, depois da do remetente selado, e roda de novo", async () => {
  await banco.exclusivo(() => banco.pg.exec(migracao));
  return install.includes(migracao.trim()) && install.indexOf(migracao.trim()) > install.indexOf(ler("supabase/migracoes/20261113-chat-selado.sql").trim());
}, (v) => v === true);

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });
const P = {};
const nomes = ["ana", "bia", "caio"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@kt.local`, `Nome ${nome}`);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Pessoa ${i + 1}`, `${nome}_kt`]);
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
await dono("update auth.users set created_at = now() - interval '30 days'");

const transporte = (nome) => ({
  publicar: (p) => rpc(como(P[nome]), "rede_olm_publicar", { p }),
  consultar: (u) => rpc(como(P[nome]), "rede_olm_consultar", { p_usuarios: u }),
  reivindicar: (p) => rpc(como(P[nome]), "rede_olm_reivindicar", { p }),
  enviar: (t, m) => rpc(como(P[nome]), "rede_olm_enviar", { p_tipo: t, p_mensagens: m }),
  receber: () => rpc(como(P[nome]), "rede_olm_receber"),
  confirmar: (ate) => rpc(como(P[nome]), "rede_olm_confirmar", { p_ate: ate }),
});
const A = {};
for (const [i, nome] of nomes.entries()) A[nome] = await abrirAparelho({ usuario: P[nome], dispositivo: "ABCDEFGHIJ".slice(0, 9) + "XYZ"[i], transporte: transporte(nome), confiavel: async () => null });

// O registro, como qualquer um o vê (sem conta).
const publico = { ponta: () => rpc(visitante(), "rede_kt_ponta"), trecho: (desde) => rpc(visitante(), "rede_kt_trecho", { p_desde: desde }) };
await espera("ativar o chat põe a chave no registro: três pessoas, três linhas", () => rpc(visitante(), "rede_kt_ponta"), (p) => p.seq === 3);
await espera("o registro não mostra o id das contas", async () => JSON.stringify(await rpc(visitante(), "rede_kt_trecho", { p_desde: 0 })), (t) => !nomes.some((n) => t.includes(P[n])));
let vista = await atualizarVista(INICIO, publico);
await espera("qualquer um (sem conta) refaz a corrente inteira", async () => vista.seq, (n) => n === 3);
await espera("a chave que o servidor mostra de Bia é a do registro", () => conferir(vista, P.bia, `o${A.bia.identidade.ed25519}`, 1), (r) => r === "confere");
await espera("quem só tem o registro não sabe de quem é cada linha, mas quem sabe o id acha", async () => [await quemNoRegistro(P.bia), Object.keys(vista.ultimas)], (r) => r[1].includes(r[0]));

// Bia troca de aparelho: linha nova, versão 2.
fecharAparelho(A.bia);
A.bia = await abrirAparelho({ usuario: P.bia, dispositivo: "NOVOBIAAAA", transporte: transporte("bia"), confiavel: async () => null });
const vista2 = await atualizarVista(vista, publico);
await espera("a troca de aparelho entra no registro, e a corrente segue de onde o aparelho parou", async () => [vista2.seq, await conferir(vista2, P.bia, `o${A.bia.identidade.ed25519}`, 2)], (r) => r[0] === 4 && r[1] === "confere");
await espera("a chave antiga de Bia não confere mais", () => conferir(vista2, P.bia, `o${A.ana.identidade.ed25519}`, 1), (r) => r === "nao_confere");

// O servidor mostra de Caio uma chave falsa, sem passar pelo registro (desligando o gatilho).
await dono("alter table interno.rede_dm_chaves disable trigger rede_kt_anotar");
await dono("update interno.rede_dm_chaves set identidade = $2 where usuario = $1", [P.caio, `o${A.ana.identidade.ed25519}`]);
await dono("alter table interno.rede_dm_chaves enable trigger rede_kt_anotar");
const mostrada = (await dono("select identidade, versao from interno.rede_dm_chaves where usuario = $1", [P.caio])).rows[0];
await espera("chave mostrada fora do registro: o aparelho diz que não confere", async () => conferir(await atualizarVista(vista2, publico), P.caio, mostrada.identidade, mostrada.versao), (r) => r === "nao_confere");

// O servidor reescreve o passado (troca a chave de Ana numa linha antiga e refaz os resumos dali em diante).
await dono(`
  do $$ declare l record; v_ant text := repeat('A', 43) || '=';
  begin
    update interno.rede_kt set identidade = 'oFALSOFALSOFALSOFALSOFALSOFALSOFALSOFALSOFAL' where seq = 1;
    for l in select * from interno.rede_kt order by seq loop
      update interno.rede_kt set resumo = interno.rede_kt_resumo(v_ant, l.seq, l.quem, l.identidade, l.versao, l.dia) where seq = l.seq returning resumo into v_ant;
    end loop;
  end $$`);
await recusa("o aparelho que já tinha visto o registro nota o passado reescrito (a ponta mudou sem crescer)", () => atualizarVista(vista2, publico), "kt_quebrado");
await espera("até um aparelho novo refaz a corrente reescrita (ela fecha), por isso duas pessoas comparam o ponto conferido", async () => (await atualizarVista(INICIO, publico)).seq, (n) => n === 4);
await dono("insert into interno.rede_kt (seq, quem, identidade, versao, dia, resumo) values (5, $1, 'oX', 9, current_date, $2)", [await quemNoRegistro(P.ana), `${"B".repeat(43)}=`]);
await recusa("linha com resumo que não fecha: o aparelho recusa", () => atualizarVista(INICIO, publico), "kt_quebrado");
await espera("ninguém tem permissão na tabela do registro (só as duas funções públicas leem)", async () => (await dono("select bool_or(has_table_privilege(r, 'interno.rede_kt', 'select')) as algum from unnest(array['anon','authenticated']) r")).rows[0].algum, (v) => v === false);
await espera("o chaveiro confere o registro ao abrir a conversa e retém o envio quando não confere", async () => ler("lib/rede/chat-chaveiro.ts"),
  (t) => /conferir\(vista, outro, doOutro\.identidade, doOutro\.versao\)\) !== "confere"\) sessao\.foraDoRegistro = "nao_confere"/.test(t) && /if \(sessao\.foraDoRegistro\) throw erroDoChat\("dm_fora_do_registro"\)/.test(t));

for (const nome of nomes) fecharAparelho(A[nome]);
console.log(`${certos} conferências certas${falhas.length ? `, ${falhas.length} com problema.` : "."}`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
