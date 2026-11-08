// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o núcleo da Escola de Formação (PLANO-ESCOLA.md, F4):
//  1. O banco (supabase/migracoes/20261108-escola-nucleo.sql, sobre o install.sql e a migração da F1, num Postgres de
//     verdade dentro do Node): militante de outro núcleo não lê a pauta; só a mediação ou a coordenação salva; "Eu levo"
//     com rodízio; levar ao núcleo sem dizer de quem; presença só em números; pergunta e recados; quem acompanha é do
//     Degrau 3; banca aprovada sobe o degrau e cria a conquista verificada; o painel recusa quem não é coordenação;
//     o registro diz 'reservado'; nada de nome civil.
//  2. As contas puras da tela (lib/escola/nucleo.ts): pauta em ver-julgar-agir, presença, rodízio, mensagens de erro.
//  3. Os textos nos 6 idiomas (mesmas chaves, nada vazio, mesmos marcadores).
//  4. Segurança no código: a página não chama o banco; nada de militância no aparelho; prévia só em desenvolvimento;
//     os componentes antigos entram por import, sem mudança.
// Uso: npm run testar:escola-nucleo
import fs from "node:fs";
import path from "node:path";
import { criarBanco } from "./banco-local.mjs";
import { FUNCOES_DA_ESCOLA } from "../lib/escola/contratos.ts";
import { FUNCOES_DO_NUCLEO, PAUTA_VER_JULGAR_AGIR, linhaDaPresenca, motivoDoErro, pautaEmRoda, proximaSegunda, semanaDe } from "../lib/escola/nucleo.ts";

const raiz = path.resolve(import.meta.dirname, "..");
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
let certos = 0;
const falhas = [];
const confere = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
async function espera(nome, promessa, conferir) {
  try {
    const valor = await promessa();
    if (conferir && !(await conferir(valor))) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 400)}`);
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
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 160)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}

// ───────────────────────────── 1. O banco ─────────────────────────────
const BASE = ler("supabase", "migracoes", "20261108-escola-formacao-base.sql");
const MIGRACAO = ler("supabase", "migracoes", "20261108-escola-nucleo.sql");
const banco = await criarBanco();
const { rpc, dono, criarUsuario, pg, exclusivo } = banco;
await espera("a migração da F1 instala", () => exclusivo(() => pg.exec(BASE)));
const instalar = () => exclusivo(() => pg.exec(MIGRACAO));
await espera("a migração da F4 instala sobre a F1", instalar);
await espera("a migração da F4 roda de novo sem quebrar (acrescentável)", instalar);

const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: "203.0.113.80" });
const anon = { papel: "anon", ip: "203.0.113.81" };
const ids = {};
for (const chave of ["coord", "media", "bia", "caio", "jurema", "comum"]) {
  ids[chave] = await criarUsuario(`${chave}@nucleo.local`, `Nome Civil ${chave}`);
  await rpc(como(ids[chave]), "eu");
}
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao') on conflict do nothing", [ids.coord]);
for (const u of ["media", "bia", "caio", "jurema"]) {
  await dono("insert into interno.departamento_membros (departamento, usuario, incluido_por) values ('revolucionarios', $1, $2) on conflict do nothing", [ids[u], ids.coord]);
}
const codinomes = { media: "Faísca", bia: "Jurema Moça", caio: "Caio do Sul", jurema: "Jurema" };
for (const [u, c] of Object.entries(codinomes)) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [ids[u], c, u]);
}
const zl = (await dono("insert into interno.rede_nucleos (nome, cidade) values ('Núcleo Zona Leste', 'São Paulo') returning id")).rows[0].id;
const sul = (await dono("insert into interno.rede_nucleos (nome, cidade) values ('Núcleo Sul', 'Porto Alegre') returning id")).rows[0].id;
await dono("insert into interno.rede_nucleo_membros (nucleo, usuario, papel) values ($1, $2, 'mediacao'), ($1, $3, 'membro'), ($4, $5, 'membro')", [zl, ids.media, ids.bia, sul, ids.caio]);
await dono("update interno.escola_militancia set nucleo = $2 where usuario = any($1)", [[ids.media, ids.bia], zl]);
await dono("update interno.escola_militancia set nucleo = $2 where usuario = $1", [ids.caio, sul]);
await dono("update interno.escola_militancia set degrau = 3 where usuario = $1", [ids.jurema]);

// Quem não é militante não recebe nada.
await recusa("conta comum: escola_nucleo recusa", () => rpc(como(ids.comum), "escola_nucleo"), "sem_permissao");
await recusa("conta comum: pergunta da semana recusa", () => rpc(como(ids.comum), "escola_pergunta_da_semana"), "sem_permissao");
await recusa("conta comum: recados recusa", () => rpc(como(ids.comum), "escola_recados"), "sem_permissao");
await recusa("anon: escola_nucleo nem chega a rodar", () => rpc(anon, "escola_nucleo"), "permission denied");

// Rodas que passaram (presença) e a roda anterior (rodízio): pelo dono, como se tivessem sido salvas antes.
const passada = (dias) => new Date(Date.now() - dias * 86400000).toISOString();
const futura = (dias) => new Date(Date.now() + dias * 86400000).toISOString();
for (const [dias, n] of [[35, 7], [28, 9], [21, 11], [14, 8], [7, 12]]) {
  await dono("insert into interno.escola_encontros (nucleo, quando, presenca, criado_por) values ($1, $2, $3, $4)", [zl, passada(dias), n, ids.media]);
}
const ultima = (await dono("select id from interno.escola_encontros where nucleo = $1 order by quando desc limit 1", [zl])).rows[0].id;
await dono("update interno.escola_encontros set balanco = 'Ver: a panfletagem rendeu. Julgar: faltou material. Agir: imprimir mais.' where id = $1", [ultima]);
await dono("insert into interno.escola_encontro_tarefas (encontro, item, quem) values ($1, 'Ata da reunião', $2)", [ultima, ids.bia]);

// Só a mediação (ou a coordenação) salva.
const encontro = {
  nucleo: zl,
  quando: futura(3),
  pauta: [{ texto: "Mística de abertura (5 min)" }, { texto: "Balanço da panfletagem no terminal" }, { texto: "Roda do caderno 03: a conversa difícil de cada um" }, { texto: "Encaminhamentos e quem faz o quê" }],
  tarefas: [{ item: "Facilitar a roda" }, { item: "Ata da reunião" }, { item: "Levar o lanche" }],
};
await recusa("membro comum do núcleo não salva o encontro", () => rpc(como(ids.bia), "escola_encontro_salvar", { p: encontro }), "sem_permissao");
await recusa("militante de outro núcleo não salva o encontro", () => rpc(como(ids.caio), "escola_encontro_salvar", { p: encontro }), "sem_permissao");
await recusa("mediação sem segundo fator confirmado (aal1 com fator) não vale: sem sessão confiável", async () => {
  // Sem tabela de fatores no banco local, a sessão aal1 é confiável; aqui só confere que a mediação de OUTRO núcleo não vale.
  return rpc(como(ids.media), "escola_encontro_salvar", { p: { ...encontro, nucleo: sul } });
}, "sem_permissao");
const salvo = await espera("a mediação salva o encontro", () => rpc(como(ids.media), "escola_encontro_salvar", { p: encontro }), (r) => r.ok === true && typeof r.id === "string");
await recusa("pauta com 13 itens é recusada", () => rpc(como(ids.media), "escola_encontro_salvar", { p: { ...encontro, pauta: Array.from({ length: 13 }, (_, i) => ({ texto: `Item ${i}` })) } }), "invalido:pauta");
await recusa("item de pauta vazio é recusado", () => rpc(como(ids.media), "escola_encontro_salvar", { p: { ...encontro, pauta: [{ texto: " " }] } }), "invalido:pauta");

const lidoBia = await espera("membro lê o núcleo: nome, pauta, quem faz o quê, presença e a roda que passou", () => rpc(como(ids.bia), "escola_nucleo"), (r) =>
  r.nucleo?.id === zl && r.nucleo?.nome === "Núcleo Zona Leste" && r.proximo?.pauta?.length === 4 && r.proximo.pauta[0].texto === "Mística de abertura (5 min)" &&
  r.proximo.tarefas.length === 3 && r.medeia === false && r.anterior?.presenca === 12 && /panfletagem/.test(r.anterior?.balanco ?? ""));
confere("presença: só as 4 últimas, em números, da mais antiga à mais nova", lidoBia && lidoBia.presenca.map((x) => x.presenca).join() === "9,11,8,12", JSON.stringify(lidoBia?.presenca));
confere("presença: nenhum nome, só quando e quantos", lidoBia && lidoBia.presenca.every((x) => Object.keys(x).sort().join() === "presenca,quando"));
await espera("a mediação vê que medeia", () => rpc(como(ids.media), "escola_nucleo"), (r) => r.medeia === true);
await espera("militante de outro núcleo NÃO lê esta pauta", () => rpc(como(ids.caio), "escola_nucleo"), (r) => r.nucleo?.id === sul && r.proximo === null && !JSON.stringify(r).includes("panfletagem"));

// Quem faz o quê, com rodízio.
const tarefa = (lido, item) => lido.proximo.tarefas.find((t) => t.item === item);
await espera("rodízio: quem fez a ata na roda anterior vê 'repete'", () => rpc(como(ids.bia), "escola_nucleo"), (r) => tarefa(r, "Ata da reunião").repete === true && tarefa(r, "Levar o lanche").repete === false);
await recusa("rodízio: quem fez a ata na roda anterior não pega de novo", () => rpc(como(ids.bia), "escola_tarefa_pegar", { p_id: tarefa(lidoBia, "Ata da reunião").id, p_pegar: true }), "rodizio");
await espera("'Eu levo': membro pega o lanche", () => rpc(como(ids.bia), "escola_tarefa_pegar", { p_id: tarefa(lidoBia, "Levar o lanche").id, p_pegar: true }), (r) => r.ok === true);
await espera("a tarefa aparece como minha, com o codinome (sem nome civil)", () => rpc(como(ids.bia), "escola_nucleo"), (r) => {
  const t = tarefa(r, "Levar o lanche");
  return t.minha === true && t.quem?.codinome === "Jurema Moça" && t.quem?.handle === "bia" && !JSON.stringify(r).includes("Nome Civil");
});
await recusa("outra pessoa não pega tarefa já pegada", () => rpc(como(ids.media), "escola_tarefa_pegar", { p_id: tarefa(lidoBia, "Levar o lanche").id, p_pegar: true }), "ja_tem_quem");
await recusa("outra pessoa (sem mediar) não solta a tarefa de ninguém", () => rpc(como(ids.jurema), "escola_tarefa_pegar", { p_id: tarefa(lidoBia, "Levar o lanche").id, p_pegar: false }), "sem_permissao");
await recusa("militante de outro núcleo não pega tarefa daqui", () => rpc(como(ids.caio), "escola_tarefa_pegar", { p_id: tarefa(lidoBia, "Facilitar a roda").id, p_pegar: true }), "sem_permissao");
await espera("a mediação pega 'Facilitar a roda'", () => rpc(como(ids.media), "escola_tarefa_pegar", { p_id: tarefa(lidoBia, "Facilitar a roda").id, p_pegar: true }), (r) => r.ok);
await espera("salvar de novo sem 'quem' mantém quem já tinha pegado (e marca feito)", async () => {
  await rpc(como(ids.media), "escola_encontro_salvar", { p: { ...encontro, id: salvo.id, tarefas: [{ item: "Facilitar a roda" }, { item: "Ata da reunião" }, { item: "Levar o lanche", feito: true }] } });
  return rpc(como(ids.bia), "escola_nucleo");
}, (r) => tarefa(r, "Levar o lanche").quem?.codinome === "Jurema Moça" && tarefa(r, "Levar o lanche").feito === true && tarefa(r, "Facilitar a roda").quem?.codinome === "Faísca");
await recusa("feito inválido volta como erro da Escola, não do Postgres", () => rpc(como(ids.media), "escola_encontro_salvar", { p: { ...encontro, id: salvo.id, tarefas: [{ item: "Ata da reunião", feito: "talvez" }] } }), "invalido:tarefas");
await recusa("a mediação não põe na tarefa alguém de fora do núcleo", () => rpc(como(ids.media), "escola_encontro_salvar", { p: { ...encontro, id: salvo.id, tarefas: [{ item: "Ata da reunião", quem: ids.caio }] } }), "invalido:quem");
await espera("soltar a própria tarefa", async () => {
  const r = await rpc(como(ids.bia), "escola_nucleo");
  await rpc(como(ids.bia), "escola_tarefa_pegar", { p_id: tarefa(r, "Levar o lanche").id, p_pegar: false });
  return rpc(como(ids.bia), "escola_nucleo");
}, (r) => tarefa(r, "Levar o lanche").quem === null && tarefa(r, "Levar o lanche").feito === false);

// Fechar a roda que passou: só presença e balanço; a pauta e a data dela ficam como estavam.
await dono("update interno.escola_encontros set pauta = '[{\"texto\":\"Pauta antiga\"}]'::jsonb where id = $1", [ultima]);
await espera("fechar a roda que passou guarda presença e balanço sem apagar a pauta", async () => {
  await rpc(como(ids.media), "escola_encontro_salvar", { p: { id: ultima, nucleo: zl, presenca: 13, balanco: "Ver, julgar, agir: sem nomes." } });
  return dono("select pauta::text t, presenca, balanco from interno.escola_encontros where id = $1", [ultima]);
}, (r) => r.rows[0].t.includes("Pauta antiga") && r.rows[0].presenca === 13 && r.rows[0].balanco.startsWith("Ver, julgar"));
await recusa("encontro novo sem data é recusado", () => rpc(como(ids.media), "escola_encontro_salvar", { p: { nucleo: zl, pauta: [] } }), "invalido:encontro");

// Levar ao núcleo: vira item da pauta, sem dizer de quem.
await espera("levar ao núcleo põe a dúvida na pauta como 'levado'", async () => {
  await rpc(como(ids.bia), "escola_levar_ao_nucleo", { p_texto: "Como responder ao tio que manda notícia falsa?" });
  return rpc(como(ids.media), "escola_nucleo");
}, (r) => r.proximo.pauta.length === 5 && r.proximo.pauta[4].levado === true && r.proximo.pauta[4].texto.startsWith("Como responder"));
await espera("o item levado não guarda quem levou", () => dono("select pauta::text t from interno.escola_encontros where id = $1", [salvo.id]), (r) => !r.rows[0].t.includes(ids.bia) && !r.rows[0].t.includes("Jurema"));
await recusa("levar ao núcleo sem núcleo", () => rpc(como(ids.jurema), "escola_levar_ao_nucleo", { p_texto: "Uma dúvida qualquer" }), "sem_nucleo");
await recusa("levar ao núcleo sem encontro marcado", () => rpc(como(ids.caio), "escola_levar_ao_nucleo", { p_texto: "Uma dúvida qualquer" }), "sem_encontro");
await recusa("levar ao núcleo: texto curto demais", () => rpc(como(ids.bia), "escola_levar_ao_nucleo", { p_texto: "a" }), "invalido:texto");

// Pergunta geradora.
const segunda = (await dono("select date_trunc('week', (now() at time zone 'America/Sao_Paulo')::date)::date::text s")).rows[0].s;
await espera("sem pergunta definida: nulo", () => rpc(como(ids.bia), "escola_pergunta_da_semana"), (r) => r === null);
await recusa("militante não define a pergunta", () => rpc(como(ids.media), "escola_pergunta_definir", { p: { semana: segunda, texto: "Uma pergunta?" } }), "sem_permissao");
await recusa("a semana tem de ser uma segunda-feira", () => rpc(como(ids.coord), "escola_pergunta_definir", { p: { semana: "2026-11-11", texto: "Uma pergunta?" } }), "invalido:semana");
await espera("a coordenação define a pergunta da semana", () => rpc(como(ids.coord), "escola_pergunta_definir", { p: { semana: segunda, texto: "Quando foi a última vez que você mudou de ideia, e quem te convenceu?" } }), (r) => r.ok);
await espera("o militante lê a pergunta da semana", () => rpc(como(ids.bia), "escola_pergunta_da_semana"), (r) => r.semana === segunda && r.texto.startsWith("Quando foi"));

// Recados.
const ate = (await dono("select ((now() at time zone 'America/Sao_Paulo')::date + 7)::text d")).rows[0].d;
await espera("a coordenação deixa um recado para toda a Escola", () => rpc(como(ids.coord), "escola_recado_salvar", { p: { texto: "Círculo de estudo aberto no sábado, 10h.", ate } }), (r) => r.ok);
await recusa("a mediação não deixa recado para toda a Escola", () => rpc(como(ids.media), "escola_recado_salvar", { p: { texto: "Recado geral", ate } }), "sem_permissao");
const recadoZl = await espera("a mediação deixa recado para o próprio núcleo", () => rpc(como(ids.media), "escola_recado_salvar", { p: { texto: "Segunda tem lanche coletivo.", ate, nucleo: zl } }), (r) => r.ok);
await recusa("a mediação não deixa recado para outro núcleo", () => rpc(como(ids.media), "escola_recado_salvar", { p: { texto: "Recado de fora", ate, nucleo: sul } }), "sem_permissao");
await recusa("recado vencido não entra", () => rpc(como(ids.coord), "escola_recado_salvar", { p: { texto: "Recado velho", ate: "2020-01-01" } }), "invalido:ate");
await espera("membro do núcleo lê o geral e o do núcleo", () => rpc(como(ids.bia), "escola_recados"), (r) => r.length === 2 && r[0].nucleo === null);
await espera("militante de outro núcleo lê só o geral", () => rpc(como(ids.caio), "escola_recados"), (r) => r.length === 1 && r[0].nucleo === null);
await recusa("apagar inválido volta como erro da Escola, não do Postgres", () => rpc(como(ids.media), "escola_recado_salvar", { p: { id: recadoZl.id, apagar: "talvez" } }), "invalido:recado");
await recusa("membro comum não apaga o recado do núcleo", () => rpc(como(ids.bia), "escola_recado_salvar", { p: { id: recadoZl.id, apagar: true } }), "sem_permissao");
await espera("a mediação apaga o recado do núcleo", () => rpc(como(ids.media), "escola_recado_salvar", { p: { id: recadoZl.id, apagar: true } }), (r) => r.ok);

// Quem acompanha: só Degrau 3.
await recusa("militante não indica quem acompanha", () => rpc(como(ids.media), "escola_acompanhar", { p_militante: ids.bia, p_acompanha: ids.jurema }), "sem_permissao");
await recusa("quem acompanha tem de ser do Degrau 3", () => rpc(como(ids.coord), "escola_acompanhar", { p_militante: ids.bia, p_acompanha: ids.media }), "acompanhante_degrau_3");
await espera("a coordenação indica Jurema (Degrau 3)", () => rpc(como(ids.coord), "escola_acompanhar", { p_militante: ids.bia, p_acompanha: ids.jurema }), (r) => r.ok);
await espera("Jurema vê quem acompanha (codinome e id)", () => rpc(como(ids.jurema), "escola_acompanho"), (r) => r.length === 1 && r[0].codinome === "Jurema Moça" && r[0].usuario === ids.bia && r[0].degrau === 1 && r[0].banca_marcada === false);

// Banca de passagem.
await recusa("a pessoa não marca a própria banca", () => rpc(como(ids.bia), "escola_banca_marcar", { p: { militante: ids.bia, degrau: 1 } }), "sem_permissao");
await recusa("quem não acompanha não marca a banca", () => rpc(como(ids.media), "escola_banca_marcar", { p: { militante: ids.bia, degrau: 1 } }), "sem_permissao");
await recusa("a banca é do degrau de hoje", () => rpc(como(ids.jurema), "escola_banca_marcar", { p: { militante: ids.bia, degrau: 2 } }), "invalido:degrau");
const banca = await espera("quem acompanha marca a banca do Degrau 1", () => rpc(como(ids.jurema), "escola_banca_marcar", { p: { militante: ids.bia, degrau: 1, quando: futura(10) } }), (r) => r.ok && r.id);
await recusa("uma banca marcada por vez", () => rpc(como(ids.jurema), "escola_banca_marcar", { p: { militante: ids.bia, degrau: 1 } }), "banca_ja_marcada");
await recusa("o índice barra a segunda banca marcada mesmo sem o exists (cliques ao mesmo tempo)", () => dono("insert into interno.escola_bancas (militante, degrau, por) values ($1, 1, $2)", [ids.bia, ids.coord]), "escola_bancas_uma_marcada");
await recusa("sem nota: só aprovada ou refazer", () => rpc(como(ids.jurema), "escola_banca_decidir", { p_id: banca.id, p_situacao: "nota 10", p_balanco: "Um balanço comprido o bastante." }), "invalido:situacao");
await recusa("o balanço coletivo é obrigatório", () => rpc(como(ids.jurema), "escola_banca_decidir", { p_id: banca.id, p_situacao: "aprovada", p_balanco: "ok" }), "invalido:balanco");
await recusa("quem não acompanha não decide", () => rpc(como(ids.caio), "escola_banca_decidir", { p_id: banca.id, p_situacao: "aprovada", p_balanco: "Um balanço comprido o bastante." }), "sem_permissao");
await espera("a pessoa vê a própria banca marcada", () => rpc(como(ids.bia), "escola_bancas_listar"), (r) => r.length === 1 && r[0].minha === true && r[0].decido === false && r[0].situacao === "marcada" && r[0].usuario === ids.bia);
await espera("militante de fora não vê a banca de ninguém", () => rpc(como(ids.caio), "escola_bancas_listar"), (r) => r.length === 0);
await espera("banca aprovada", () => rpc(como(ids.jurema), "escola_banca_decidir", { p_id: banca.id, p_situacao: "aprovada", p_balanco: "Trouxe a conversa com o tio; o núcleo viu escuta. Para o Degrau 2: puxar a roda." }), (r) => r.ok);
await espera("aprovada: sobe o degrau e cria a conquista 'degrau-1' verificada", async () => {
  const d = (await dono("select degrau from interno.escola_militancia where usuario = $1", [ids.bia])).rows[0].degrau;
  const c = (await dono("select verificada from interno.escola_conquistas where usuario = $1 and tipo = 'degrau' and alvo = 'degrau-1'", [ids.bia])).rows;
  return d === 2 && c.length === 1 && c[0].verificada === true;
}, (x) => x);
await recusa("banca decidida não se decide de novo", () => rpc(como(ids.jurema), "escola_banca_decidir", { p_id: banca.id, p_situacao: "refazer", p_balanco: "Outro balanço comprido." }), "banca_ja_decidida");
await espera("a pessoa lê o balanço da própria banca", () => rpc(como(ids.bia), "escola_bancas_listar"), (r) => r[0].situacao === "aprovada" && r[0].balanco.startsWith("Trouxe"));
await espera("escola_eu mostra o degrau novo", () => rpc(como(ids.bia), "escola_eu"), (r) => r.degrau === 2 && r.acompanha?.codinome === "Jurema");

// Painel da coordenação.
await recusa("escola_militantes_listar recusa quem não é coordenação", () => rpc(como(ids.media), "escola_militantes_listar"), "sem_permissao");
await recusa("escola_militante_ajustar recusa quem não é coordenação", () => rpc(como(ids.media), "escola_militante_ajustar", { p: { usuario: ids.bia, degrau: 3 } }), "sem_permissao");
await recusa("escola_painel_resumo recusa quem não é coordenação", () => rpc(como(ids.jurema), "escola_painel_resumo"), "sem_permissao");
await espera("a coordenação lista os militantes pelo codinome, sem nome civil nem e-mail", () => rpc(como(ids.coord), "escola_militantes_listar"), (r) =>
  r.length === 4 && r.some((m) => m.codinome === "Jurema Moça" && m.degrau === 2 && m.nucleo?.id === zl && m.acompanha?.codinome === "Jurema" && m.acompanha_id === ids.jurema) &&
  !JSON.stringify(r).includes("Nome Civil") && !JSON.stringify(r).includes("@nucleo.local"));
await espera("a coordenação ajusta núcleo e frente", async () => {
  await rpc(como(ids.coord), "escola_militante_ajustar", { p: { usuario: ids.caio, nucleo: zl, frente: "trabalho" } });
  return dono("select nucleo, frente from interno.escola_militancia where usuario = $1", [ids.caio]);
}, (r) => r.rows[0].nucleo === zl && r.rows[0].frente === "trabalho");
await recusa("frente fora da lista é recusada", () => rpc(como(ids.coord), "escola_militante_ajustar", { p: { usuario: ids.caio, frente: "guerrilha" } }), "invalido:frente");
await espera("baixar Jurema do Degrau 3 solta quem ela acompanhava", async () => {
  await rpc(como(ids.coord), "escola_militante_ajustar", { p: { usuario: ids.jurema, degrau: 2 } });
  return dono("select acompanha from interno.escola_militancia where usuario = $1", [ids.bia]);
}, (r) => r.rows[0].acompanha === null);
await espera("o resumo do painel: núcleos com contagem, recados e perguntas", () => rpc(como(ids.coord), "escola_painel_resumo"), (r) =>
  r.nucleos.length === 2 && r.nucleos.find((n) => n.id === zl)?.militantes === 3 && r.recados.length === 1 && r.perguntas.length === 1 && r.semana === segunda);

// Registro de atividades: nada diz "revolucionarios".
await espera("registro das ações da Escola com 'reservado' e sem o nome do departamento", () => dono("select acao, detalhes::text d from interno.auditoria where acao like 'escola_%' or acao = 'acesso_escola_militantes'"), (r) =>
  r.rows.length >= 8 && r.rows.filter((x) => x.acao !== "acesso_escola_militantes").every((x) => x.d.includes("reservado")) && r.rows.every((x) => !x.d.includes("revolucionarios")));

// Funções: security definer, search_path fixo; anon não executa nenhuma pública.
const PUBLICAS = Object.entries(FUNCOES_DA_ESCOLA).filter(([, f]) => f === "F4").map(([n]) => n).concat(FUNCOES_DO_NUCLEO);
await espera("funções da F4: security definer e search_path fixo", () => dono("select proname, prosecdef, proconfig from pg_proc where pronamespace = 'public'::regnamespace and proname = any($1)", [PUBLICAS]), (r) =>
  r.rows.length === PUBLICAS.length && r.rows.every((x) => x.prosecdef && (x.proconfig ?? []).includes("search_path=interno, pg_temp")));
await espera("anon não executa nenhuma função da F4", () => dono("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = any($1) and has_function_privilege('anon', oid, 'execute')", [PUBLICAS]), (r) => r.rows[0].n === 0);
await espera("as ajudantes internas não são executáveis por authenticated", () => dono("select count(*)::int n from pg_proc where pronamespace = 'interno'::regnamespace and proname like 'escola\\_%' and proname not in ('escola_militancia_criar', 'escola_militancia_apagar', 'escola_departamento_gatilho') and has_function_privilege('authenticated', oid, 'execute')"), (r) => r.rows[0].n === 0);
confere("a migração não lê nome civil (perfis.nome)", !/perfis\.nome|\bf\.nome\b|\bp\.nome\b/.test(MIGRACAO));
confere("a migração não cria tabela (as tabelas são da F1)", !/create table/i.test(MIGRACAO));
const faltam = Object.entries(FUNCOES_DA_ESCOLA).filter(([, f]) => f === "F4").map(([n]) => n).filter((n) => !MIGRACAO.includes(`public.${n}(`));
confere("contrato: a migração tem todas as funções da F4", faltam.length === 0, faltam.join(", "));

// ───────────────────────────── 2. Contas puras ─────────────────────────────
confere("pauta em ver-julgar-agir: mística, ver, julgar, agir, mística", PAUTA_VER_JULGAR_AGIR.length === 5);
const roda = pautaEmRoda(["Mística de abertura", "Ver: o que aconteceu", "Julgar: o caderno 03", "Agir: encaminhamentos", "Mística de fechamento"], "Ver: o que aconteceu");
confere("pautaEmRoda: vira itens sem duplicar", roda.length === 5 && roda.every((x) => typeof x.texto === "string"));
confere("linha da presença com os números", linhaDaPresenca([{ quando: "a", presenca: 9 }, { quando: "b", presenca: null }, { quando: "c", presenca: 12 }]) === "9, –, 12");
confere("motivo do erro conhecido e desconhecido", motivoDoErro("rodizio") === "rodizio" && motivoDoErro("invalido:texto") === "invalido" && motivoDoErro("qualquer") === "falha");
confere("semanaDe dá a segunda-feira", semanaDe(new Date("2026-11-12T15:00:00Z")) === "2026-11-09" && semanaDe(new Date("2026-11-09T04:00:00Z")) === "2026-11-09" && semanaDe(new Date("2026-11-09T02:00:00Z")) === "2026-11-02");
confere("próxima segunda", proximaSegunda(new Date("2026-11-12T15:00:00Z")) === "2026-11-16");

// ───────────────────────────── 3. Textos ─────────────────────────────
const chaves = (o, p = "") => (Array.isArray(o) ? [`${p}[${o.length}]`, ...o.flatMap((v, i) => chaves(v, `${p}[${i}]`))] : o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => chaves(v, p ? `${p}.${k}` : k)) : [p]);
const pt = JSON.parse(ler("i18n", "escola", "nucleo", "pt.json"));
const chavesPt = chaves(pt).join("|");
for (const l of ["en", "es", "fr", "ru", "zh"]) {
  const t = JSON.parse(ler("i18n", "escola", "nucleo", `${l}.json`));
  confere(`textos ${l}: mesmas chaves do português`, chaves(t).join("|") === chavesPt);
  confere(`textos ${l}: nada vazio`, !JSON.stringify(t).includes('""'));
  confere(`textos ${l}: os marcadores {x} batem`, (JSON.stringify(t).match(/\{[a-z]+\}/gi) ?? []).sort().join() === (JSON.stringify(pt).match(/\{[a-z]+\}/gi) ?? []).sort().join());
}
confere("abas da prancha Cel-Núcleo: Pauta, Tarefas, Círculo, Assembleia", [pt.tela.abas.pauta, pt.tela.abas.tarefas, pt.tela.abas.circulo, pt.tela.abas.assembleia].join() === "Pauta,Tarefas,Círculo,Assembleia");
confere("kit: mística de abertura e de fechamento, ver-julgar-agir", Boolean(pt.kit.misticaAbertura.titulo && pt.kit.misticaFechamento.titulo && pt.kit.ver.titulo && pt.kit.julgar.titulo && pt.kit.agir.titulo));
confere("banca: sem nota, com balanço coletivo", /sem nota/i.test(JSON.stringify(pt.kit.banca)) && /balanço/i.test(JSON.stringify(pt.kit.banca)));

// ───────────────────────────── 4. Segurança no código ─────────────────────────────
const pagina = ler("app", "[lang]", "escola", "nucleo", "page.tsx");
confere("a página do núcleo não chama o banco nem lê segredo", !/rpc|supabase|service|process\.env/i.test(pagina));
confere("a página do núcleo fica fora dos buscadores", /noindex|robots/.test(pagina));
const pasta = path.join(raiz, "components", "escola", "nucleo");
const comps = fs.readdirSync(pasta).filter((n) => /\.tsx?$/.test(n) && n !== "previa.ts").map((n) => fs.readFileSync(path.join(pasta, n), "utf8")).join("\n");
confere("componentes do núcleo: nada no aparelho", !/localStorage|sessionStorage|useStored|setItem/.test(comps));
confere("componentes do núcleo: banco só por lib/escola/nucleo.ts", !/from "@\/lib\/backend"/.test(comps) && !/\brpc\(/.test(comps));
confere("kit reaproveita os componentes antigos por import", ["RoteiroDoNucleo", "CirculoDeCultura", "BancaPopular", "AssembleiaVotacao"].every((c) => new RegExp(`import \\{ ${c} \\}`).test(comps + pagina)));
const lib = ler("lib", "escola", "nucleo.ts");
confere("prévia do núcleo só em desenvolvimento (import dinâmico, depois de emPrevia)", /emPrevia\(\)/.test(lib) && /import\("\.\.\/\.\.\/components\/escola\/nucleo\/previa"\)/.test(lib) && !/^import .*nucleo\/previa/m.test(lib));
const previa = ler("components", "escola", "nucleo", "previa.ts");
confere("prévia sem pessoa de verdade (exemplos marcados)", /EXEMPLO/i.test(previa));
const painel = ler("components", "painel", "escola", "PainelDaEscola.tsx");
confere("painel: preenchido (sem o esboço) e pelos nomes do contrato", !/data-painel-da-escola="esboco"/.test(painel) && /escola_militantes_listar/.test(painel + lib) && /escola_banca_decidir/.test(painel + lib));
confere("painel: lê e grava no banco, sem a prévia (nada de fingir que salvou)", /chamarNoBanco\(/.test(painel) && !/chamarDoNucleo|emPrevia/.test(painel));
confere("a mediação publica e apaga recados do núcleo pela tela do núcleo", /escola_recado_salvar/.test(comps) && /escola_recados/.test(comps));
confere("painel: nada de nome civil nem e-mail", !/\.nome\b(?! *[:=])|email/i.test(painel.replace(/nucleo\.nome|n\.nome|\.nome\)/g, "")));

if (falhas.length) {
  console.error(`escola-nucleo: ${certos} certos, ${falhas.length} falhas:\n- ${falhas.join("\n- ")}`);
  process.exit(1);
}
console.log(`escola-nucleo: ${certos} conferências certas.`);
process.exit(0);
