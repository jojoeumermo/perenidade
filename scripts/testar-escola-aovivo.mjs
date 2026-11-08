// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova as aulas ao vivo da Escola de Formação (PLANO-ESCOLA.md, F3, modelo 4.3), num Postgres de verdade dentro do Node
// (install.sql + a migração da F1 + supabase/migracoes/2026-11-escola-aovivo.sql):
//  1. Quem não é militante não vê nada: nem na agenda pública, nem a aula, nem o bate-papo, nem o calendário da equipe.
//  2. O militante lê a aula (com o id do YouTube) e fala no bate-papo pelo CODINOME; sem codinome, não fala.
//  3. Moderação de quem conduz e da coordenação; quem escreveu só esconde a própria fala; nada vai para a fila da
//     mediação da Comunidade.
//  4. O fluxo inteiro: marcar → transmitir (o id do YouTube gravado pelo serviço) → bate-papo → encerrar → a gravação
//     aparece em escola_gravacoes da aula do caderno e em escola_aulas_hoje.
//  5. O bate-papo some 30 dias depois; a aula do site continua igual (agenda aberta, bate-papo aberto).
//  6. O código: tocador sem cookies e só depois do clique; a função do YouTube nunca deixa aula da Escola pública; o
//     painel escreve o limite honesto; textos nos 6 idiomas.
// Uso: npm run testar:escola-aovivo
import fs from "node:fs";
import path from "node:path";
import { criarBanco } from "./banco-local.mjs";
import { cadernoAulaDe, lerCadernoAula, idDoVideo } from "../lib/escola/aovivo.ts";
import { CADERNOS_DA_ESCOLA } from "../lib/escola/contratos.ts";

const raiz = path.resolve(import.meta.dirname, "..");
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
let certos = 0;
const falhas = [];
// Um passo que quebra o resto (uma aula que não nasceu, por exemplo) ainda mostra o que falhou antes dele.
process.on("uncaughtException", (erro) => {
  console.log(`\nparou no meio: ${erro.message}\n${certos} certos, ${falhas.length} falhas`);
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
});
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
const BASE = ler("supabase", "migracoes", "2026-11-escola-formacao-base.sql");
const MIGRACAO = ler("supabase", "migracoes", "2026-11-escola-aovivo.sql");
const banco = await criarBanco();
const { rpc, dono, criarUsuario, pg, exclusivo } = banco;
await espera("a migração da F1 instala", () => exclusivo(() => pg.exec(BASE)));
await espera("a migração da F3 instala sobre a F1", () => exclusivo(() => pg.exec(MIGRACAO)));
await espera("a migração da F3 roda de novo sem quebrar (acrescentável)", () => exclusivo(() => pg.exec(MIGRACAO)));

const como = (sub, ip = "203.0.113.80") => ({ papel: "authenticated", sub, aal: "aal2", ip });
const anon = { papel: "anon", ip: "203.0.113.81" };
const servico = { papel: "service_role", ip: "203.0.113.82" };
const ids = {};
for (const chave of ["coord", "prof", "profsite", "mil", "semcodinome", "comum"]) {
  ids[chave] = await criarUsuario(`${chave}@aovivo.local`, `Nome Civil ${chave}`);
  await rpc(como(ids[chave]), "eu");
}
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao') on conflict do nothing", [ids.coord]);
await dono("insert into interno.papeis (usuario, papel, disciplina) values ($1, 'educacao', 'historia'), ($2, 'educacao', 'historia')", [ids.prof, ids.profsite]);
for (const u of ["prof", "mil", "semcodinome"]) {
  await dono("insert into interno.departamento_membros (departamento, usuario, incluido_por) values ('revolucionarios', $1, $2) on conflict do nothing", [ids[u], ids.coord]);
}
await dono("update interno.perfis set rede_codinome = 'Jurema', rede_codinome_ok = true where id = $1", [ids.prof]);
await dono("update interno.perfis set rede_codinome = 'Faísca', rede_codinome_ok = true where id = $1", [ids.mil]);
await dono("update interno.perfis set rede_codinome = 'Rascunho', rede_codinome_ok = false where id = $1", [ids.semcodinome]);
await dono("update interno.perfis set rede_codinome = 'Coordena', rede_codinome_ok = true where id = $1", [ids.coord]);

const daqui = (min) => new Date(Date.now() + min * 60_000).toISOString();
const CADERNO_AULA = "conversar-com-quem-pensa-diferente/discordar-sem-humilhar";

// Marcar.
await recusa("educador do site (não militante) não marca aula da Escola", () => rpc(como(ids.profsite), "aula_ao_vivo_salvar", { p_id: null, p: { titulo: "Aula fechada", disciplina: "historia", inicio: daqui(20), publico: "escola" } }), "sem_permissao");
await recusa("caderno de fora da lista é recusado", () => rpc(como(ids.prof), "aula_ao_vivo_salvar", { p_id: null, p: { titulo: "Aula fechada", disciplina: "historia", inicio: daqui(20), publico: "escola", caderno_aula: "outro-caderno/aula" } }), "invalido:caderno_aula");
await recusa("co-educador não militante é recusado na aula da Escola", () => rpc(como(ids.prof), "aula_ao_vivo_salvar", { p_id: null, p: { titulo: "Aula fechada", disciplina: "historia", inicio: daqui(20), publico: "escola", co_educadores: [ids.profsite] } }), "invalido:co_educadores");
const aula = await espera("educador militante marca a aula da Escola ligada à aula do caderno", () =>
  rpc(como(ids.prof), "aula_ao_vivo_salvar", { p_id: null, p: { titulo: "Discordar sem humilhar, ao vivo", descricao: "Roda", disciplina: "historia", inicio: daqui(20), publico: "escola", caderno_aula: CADERNO_AULA, sala_externa: "https://meet.jit.si/sala-secreta" } }),
  (r) => r.publico === "escola" && r.caderno_aula === CADERNO_AULA && r.disciplina === "revolucionarios" && r.sala_externa === "" && r.educador.nome === "Jurema");
const id = aula?.id;
const site = await espera("a aula do site continua igual", () => rpc(como(ids.profsite), "aula_ao_vivo_salvar", { p_id: null, p: { titulo: "Revolução Francesa", disciplina: "historia", inicio: daqui(25), publico: "site", caderno_aula: CADERNO_AULA } }),
  (r) => r.publico === "site" && r.caderno_aula === null && r.educador.id === ids.profsite && r.disciplina === "historia");
await espera("o registro da aula da Escola sai como 'reservado'", () => dono("select detalhes from interno.auditoria where acao = 'aula_ao_vivo_marcada' and alvo = 'Discordar sem humilhar, ao vivo'"), (r) => r.rows.length === 1 && r.rows[0].detalhes.departamento === "reservado");
await espera("o feed de atividade da equipe não recebe a aula da Escola", () => dono("select count(*)::int n from interno.atividade where titulo like '%Discordar sem humilhar%'"), (r) => r.rows[0].n === 0);

// Quem não é militante não vê nada.
await espera("anon: agenda pública sem a aula da Escola", () => rpc(anon, "aulas_ao_vivo_listar", {}), (r) => !r.some((a) => a.id === id) && r.some((a) => a.id === site.id));
await espera("conta comum: agenda pública sem a aula da Escola", () => rpc(como(ids.comum), "aulas_ao_vivo_listar", {}), (r) => !r.some((a) => a.id === id));
await espera("até o militante: a agenda pública é só do site (a da Escola mora em escola_aulas_hoje)", () => rpc(como(ids.mil), "aulas_ao_vivo_listar", {}), (r) => !r.some((a) => a.id === id));
await espera("anon: aula_ao_vivo_ver não devolve nada (sem youtube, sem título)", () => rpc(anon, "aula_ao_vivo_ver", { p_id: id }), (r) => r === null);
await espera("conta comum: aula_ao_vivo_ver não devolve nada", () => rpc(como(ids.comum), "aula_ao_vivo_ver", { p_id: id }), (r) => r === null);
await recusa("conta comum não lê escola_aulas_hoje", () => rpc(como(ids.comum), "escola_aulas_hoje"), "sem_permissao");
await recusa("anon não lê escola_gravacoes", () => rpc(anon, "escola_gravacoes", { p_caderno: CADERNO_AULA }), "sem_permissao");
await recusa("conta comum não marca presença na aula da Escola", () => rpc(como(ids.comum), "aula_ao_vivo_inscrever", { p_id: id }), "nao_encontrado");
await espera("calendário da equipe: educador do site não vê a aula da Escola", () => rpc(como(ids.profsite), "calendario_equipe", { p_de: null, p_ate: null }), (r) => !r.some((e) => e.id === id) && r.some((e) => e.id === site.id));
await espera("calendário da equipe: militante da equipe vê a aula, com o codinome", () => rpc(como(ids.prof), "calendario_equipe", { p_de: null, p_ate: null }), (r) => r.some((e) => e.id === id && e.quem === "Jurema"));

// Transmitir: o serviço grava a transmissão; a função do YouTube recebe o público e nada de nome.
await espera("o serviço lê os dados da transmissão: público 'escola', sem nome e sem descrição", () => rpc(servico, "youtube_transmissao_dados", { p_aula: id }), (r) => r.publico === "escola" && r.educador === "" && r.descricao === "");
await espera("o serviço grava a transmissão (id do YouTube)", () => rpc(servico, "youtube_transmissao_gravar", { p_aula: id, p_broadcast: "AbCdEfGhIjK", p_stream: "s1", p_rtmp: "rtmp://a.rtmp.youtube.com/live2", p_chave: "xxxx-yyyy" }));
await espera("conta comum continua sem ver a aula (nem o id do YouTube)", () => rpc(como(ids.comum), "aula_ao_vivo_ver", { p_id: id }), (r) => r === null);
await espera("militante vê a aula com o id do YouTube", () => rpc(como(ids.mil), "aula_ao_vivo_ver", { p_id: id }), (r) => r?.youtube === "AbCdEfGhIjK" && r.publico === "escola" && r.conduzo === false);
await espera("militante não recebe o id de quem conduz, só o codinome", () => rpc(como(ids.mil), "aula_ao_vivo_ver", { p_id: id }), (r) => r.educador.id === null && r.educador.nome === "Jurema" && !JSON.stringify(r).includes("Nome Civil"));
await espera("escola_aulas_hoje: a aula está em hoje, marcada, com o caderno", () => rpc(como(ids.mil), "escola_aulas_hoje"), (r) => r.hoje.some((a) => a.id === id && a.status === "marcada" && a.caderno_aula === CADERNO_AULA && a.youtube === "AbCdEfGhIjK") && Array.isArray(r.proximas) && Array.isArray(r.gravadas));
await espera("militante marca presença", () => rpc(como(ids.mil), "aula_ao_vivo_inscrever", { p_id: id }), (r) => r.inscrito === true);

// Começar e o bate-papo.
await espera("quem conduz começa a aula", () => rpc(como(ids.prof), "aula_ao_vivo_estado", { p_id: id, p_status: "ao_vivo" }), (r) => r.status === "ao_vivo");
await espera("o recado de começo aponta para a Escola, não para a agenda pública", () => dono("select texto from interno.avisos where para = $1 order by criado_em desc limit 1", [ids.mil]), (r) => r.rows.length === 1 && /Entre pela Escola/.test(r.rows[0].texto) && !/agenda/.test(r.rows[0].texto));
await espera("conta comum: bate-papo vazio", () => rpc(como(ids.comum), "aula_chat_listar", { p_aula: id }), (r) => Array.isArray(r) && r.length === 0);
await espera("anon: bate-papo vazio", () => rpc(anon, "aula_chat_listar", { p_aula: id }), (r) => Array.isArray(r) && r.length === 0);
await recusa("conta comum não fala no bate-papo da Escola", () => rpc(como(ids.comum), "aula_chat_enviar", { p_aula: id, p_corpo: "Oi" }), "sem_permissao");
await recusa("anon não fala", () => rpc(anon, "aula_chat_enviar", { p_aula: id, p_corpo: "Oi" }), "entre_primeiro");
await recusa("militante sem codinome confirmado não fala (nem com o nome civil)", () => rpc(como(ids.semcodinome), "aula_chat_enviar", { p_aula: id, p_corpo: "Oi, gente" }), "confirme_codinome");
const fala = await espera("militante fala pelo codinome", () => rpc(como(ids.mil), "aula_chat_enviar", { p_aula: id, p_corpo: "Como discordar do meu tio sem brigar?", p_tipo: "pergunta" }),
  (r) => r.nome === "Faísca" && r.tipo === "pergunta" && r.minha === true && r.autor === null);
await espera("no banco, o nome gravado é o codinome (nunca o nome civil)", () => dono("select nome from interno.aulas_chat where id = $1", [fala?.id]), (r) => r.rows[0]?.nome === "Faísca");
await espera("quem lê não recebe o id de quem escreveu", () => rpc(como(ids.prof), "aula_chat_listar", { p_aula: id }), (r) => r.some((m) => m.id === fala.id && m.autor === null && m.minha === false && m.nome === "Faísca") && !JSON.stringify(r).includes(ids.mil));
await espera("o militante lê o bate-papo (com a fala do sistema)", () => rpc(como(ids.mil), "aula_chat_listar", { p_aula: id }), (r) => r.some((m) => m.id === fala.id && m.minha) && r.some((m) => m.tipo === "sistema"));
await espera("o militante sem codinome também lê", () => rpc(como(ids.semcodinome), "aula_chat_listar", { p_aula: id }), (r) => r.some((m) => m.id === fala.id));

// A dúvida das regras espera quem conduz (sem ir para a mediação da Comunidade).
await dono("update interno.aulas_chat set oculta = true, avaliacao = 'revisao' where id = $1", [fala.id]);
await espera("fala em espera: quem escreveu vê com 'esperando'", () => rpc(como(ids.mil), "aula_chat_listar", { p_aula: id }), (r) => r.some((m) => m.id === fala.id && m.esperando));
await espera("fala em espera: os outros militantes não veem", () => rpc(como(ids.semcodinome), "aula_chat_listar", { p_aula: id }), (r) => !r.some((m) => m.id === fala.id));
await espera("a fila da mediação da Comunidade não recebe nada da Escola", () => dono("select count(*)::int n from interno.aulas_chat where aula = $1 and retido", [id]), (r) => r.rows[0].n === 0);
await recusa("quem escreveu não libera a própria fala retida", () => rpc(como(ids.mil), "aula_chat_moderar", { p_id: fala.id, p_ocultar: false }), "sem_permissao");
await espera("quem conduz libera", () => rpc(como(ids.prof), "aula_chat_moderar", { p_id: fala.id, p_ocultar: false }), (r) => r.ok);
await espera("liberada, todos os militantes veem", () => rpc(como(ids.semcodinome), "aula_chat_listar", { p_aula: id }), (r) => r.some((m) => m.id === fala.id && !m.oculta));
const outra = await espera("outra fala", () => rpc(como(ids.mil), "aula_chat_enviar", { p_aula: id, p_corpo: "Obrigada!" }));
await recusa("outro militante não esconde a fala dos outros", () => rpc(como(ids.semcodinome), "aula_chat_moderar", { p_id: outra.id, p_ocultar: true }), "sem_permissao");
await recusa("conta comum não modera (nem sabe que existe)", () => rpc(como(ids.comum), "aula_chat_moderar", { p_id: outra.id, p_ocultar: true }), "nao_encontrado");
await espera("quem escreveu esconde a própria fala", () => rpc(como(ids.mil), "aula_chat_moderar", { p_id: outra.id, p_ocultar: true }), (r) => r.ok);
await espera("a coordenação modera (devolve a fala)", () => rpc(como(ids.coord), "aula_chat_moderar", { p_id: outra.id, p_ocultar: false }), (r) => r.ok);
await espera("a coordenação lê o bate-papo", () => rpc(como(ids.coord), "aula_chat_listar", { p_aula: id }), (r) => r.some((m) => m.id === outra.id));

// Encerrar: a gravação na aula do caderno.
await espera("quem conduz encerra; a gravação vem do YouTube", () => rpc(como(ids.prof), "aula_ao_vivo_estado", { p_id: id, p_status: "encerrada" }), (r) => r.status === "encerrada" && r.gravacao === "https://www.youtube.com/watch?v=AbCdEfGhIjK");
await recusa("encerrada, o bate-papo fecha", () => rpc(como(ids.mil), "aula_chat_enviar", { p_aula: id, p_corpo: "Ainda dá?" }), "topico_trancado");
await espera("escola_gravacoes da aula do caderno traz o vídeo", () => rpc(como(ids.mil), "escola_gravacoes", { p_caderno: CADERNO_AULA }), (r) => r.length === 1 && r[0].id === id && r[0].youtube === "AbCdEfGhIjK" && r[0].status === "encerrada");
await espera("escola_gravacoes do caderno inteiro também", () => rpc(como(ids.mil), "escola_gravacoes", { p_caderno: "conversar-com-quem-pensa-diferente" }), (r) => r.some((a) => a.id === id));
await espera("escola_gravacoes de outra aula: vazio", () => rpc(como(ids.mil), "escola_gravacoes", { p_caderno: "conversar-com-quem-pensa-diferente/outra-aula" }), (r) => r.length === 0);
await recusa("escola_gravacoes recusa endereço torto", () => rpc(como(ids.mil), "escola_gravacoes", { p_caderno: "../x" }), "invalido:caderno");
await espera("escola_aulas_hoje: a aula vira gravada", () => rpc(como(ids.mil), "escola_aulas_hoje"), (r) => r.gravadas.some((a) => a.id === id));
await espera("encerrada, ainda dá para trocar a aula do caderno ligada", () => rpc(como(ids.prof), "aula_ao_vivo_salvar", { p_id: id, p: { caderno_aula: "formar-formadores/a-roda" } }), (r) => r.caderno_aula === "formar-formadores/a-roda");
await espera("conta comum segue sem ver a aula encerrada", () => rpc(como(ids.comum), "aula_ao_vivo_ver", { p_id: id }), (r) => r === null);

// O bate-papo some 30 dias depois.
await dono("update interno.aulas_ao_vivo set encerrada_em = now() - interval '31 days' where id = $1", [id]);
await espera("faxina: apaga o bate-papo da aula da Escola encerrada há mais de 30 dias", () => dono("select interno.escola_aovivo_faxina() n"), (r) => r.rows[0].n >= 2);
await espera("o bate-papo sumiu", () => dono("select count(*)::int n from interno.aulas_chat where aula = $1", [id]), (r) => r.rows[0].n === 0);
await espera("a aula (e a gravação) fica", () => rpc(como(ids.mil), "escola_gravacoes", { p_caderno: "formar-formadores/a-roda" }), (r) => r.some((a) => a.id === id));

// A aula do site não mudou.
await dono("update interno.aulas_ao_vivo set inicio = now() + interval '5 minutes' where id = $1", [site.id]);
const falaSite = await espera("site: a conta comum fala com o nome do painel, como antes", () => rpc(como(ids.comum, "203.0.113.90"), "aula_chat_enviar", { p_aula: site.id, p_corpo: "Boa noite!" }), (r) => r.nome !== "" && r.nome !== "Faísca" && r.autor === ids.comum);
await espera("site: qualquer visitante lê, como antes", () => rpc(anon, "aula_chat_listar", { p_aula: site.id }), (r) => r.some((m) => m.id === falaSite?.id));
await dono("update interno.aulas_ao_vivo set status = 'encerrada', encerrada_em = now() - interval '40 days' where id = $1", [site.id]);
await dono("select interno.escola_aovivo_faxina()");
await espera("a faxina da Escola não toca no bate-papo do site", () => dono("select count(*)::int n from interno.aulas_chat where aula = $1", [site.id]), (r) => r.rows[0].n >= 1);

// Permissões.
await espera("funções internas da F3 fechadas para anon e authenticated", () => dono(
  "select bool_and(not has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute')) ok from pg_proc p where p.pronamespace = 'interno'::regnamespace and p.proname in ('escola_aovivo_pode', 'escola_aula_ve', 'escola_codinome', 'escola_caderno_aula_ok', 'escola_pode_conduzir', 'escola_chat_json', 'escola_aula_json', 'escola_aovivo_faxina')"),
  (r) => r.rows[0].ok === true);
await espera("funções da F3: security definer e search_path fixo", () => dono("select bool_and(prosecdef and (proconfig @> array['search_path=interno, pg_temp'])) ok, count(*)::int n from pg_proc where proname in ('escola_aulas_hoje', 'escola_gravacoes', 'escola_aovivo_pode', 'escola_codinome', 'escola_aovivo_faxina', 'escola_chat_json')"), (r) => r.rows[0].ok === true && r.rows[0].n === 6);
for (const papel of ["anon", "authenticated"]) {
  for (const tabela of ["aulas_ao_vivo", "aulas_chat", "transmissoes"]) {
    await recusa(`${papel} não lê interno.${tabela} direto`, () => exclusivo(async () => {
      await pg.exec(`set role ${papel}`);
      try {
        return (await pg.query(`select * from interno.${tabela} limit 1`)).rows;
      } finally {
        await pg.exec("reset role");
      }
    }), "permission denied");
  }
}
confere("migração: o bate-papo da Escola grava o codinome", /interno\.escola_codinome\(v\), v_corpo/.test(MIGRACAO));
confere("migração: não mexe no install.sql", !ler("supabase", "install.sql").includes("escola_aulas_hoje"));

// ───────────────────────────── 2. O código ─────────────────────────────
confere("caderno_aula: do caderno e do lessonId", cadernoAulaDe(CADERNOS_DA_ESCOLA[2], "conversar-com-quem-pensa-diferente/discordar-sem-humilhar") === CADERNO_AULA);
confere("caderno_aula: aula de outra trilha vira trilha--aula", cadernoAulaDe(CADERNOS_DA_ESCOLA[0], "marxismo-fundamental/o-que-e-exploracao") === "consciencia-de-classe/marxismo-fundamental--o-que-e-exploracao");
confere("caderno_aula: ler", lerCadernoAula(CADERNO_AULA)?.caderno.numero === 3 && lerCadernoAula("x/y") === null && lerCadernoAula("conversar-com-quem-pensa-diferente") === null);
confere("id do vídeo: só 11 caracteres válidos", idDoVideo("AbCdEfGhIjK") === "AbCdEfGhIjK" && idDoVideo("<script>") === null && idDoVideo(null) === null);

const pasta = (...p) => fs.readdirSync(path.join(raiz, ...p)).filter((n) => /\.(tsx?|css)$/.test(n)).map((n) => fs.readFileSync(path.join(raiz, ...p, n), "utf8")).join("\n");
const aovivo = pasta("components", "escola", "aovivo");
confere("tocador: domínio sem cookies", /youtube-nocookie\.com\/embed\//.test(aovivo) && !/www\.youtube\.com\/embed/.test(aovivo));
confere("tocador: só depois do clique (iframe atrás de um estado)", /carregado \?[\s\S]*<iframe/.test(aovivo) && /setCarregado\(true\)/.test(aovivo));
confere("sala: nada fica no aparelho", !/localStorage|setItem\(/.test(aovivo.replace(/sessionStorage/g, "")) && !/localStorage/.test(aovivo));
confere("sala: o sinal de tempo real não leva o id da aula", !/transmitir\([^)]*,/.test(aovivo));
confere("prévia só em desenvolvimento", /process\.env\.NODE_ENV !== "development"|emPrevia\(\)/.test(ler("lib", "escola", "aovivo.ts")) && !/^import .*previa/m.test(aovivo + ler("lib", "escola", "aovivo.ts")));
const gravacao = ler("components", "escola", "aula", "GravacaoDaAula.tsx");
confere("GravacaoDaAula: lê escola_gravacoes pelo contrato", /escola_gravacoes/.test(gravacao + aovivo));
confere("GravacaoDaAula: segue o contrato da F2 (PropsDaGravacao, aula = lessonId, cadernoAula opcional)", /export interface PropsDaGravacao/.test(gravacao) && /cadernoAula\?: string/.test(gravacao) && /\(\{ lang, caderno, aula \}: PropsDaGravacao\)/.test(gravacao));
confere("GravacaoDaAula: a chave é caderno/pedaço do endereço, como o painel grava", /`\$\{caderno\}\/\$\{pedacoDaAula\(doCaderno, aula\)\}`/.test(gravacao) && /CADERNO_AULA\.test\(chave\)/.test(gravacao));
const chat = ler("components", "escola", "aovivo", "ChatDaEscola.tsx");
confere("migração: toda função criada tem search_path fixo", [...MIGRACAO.matchAll(/create or replace function[\s\S]*?as \$\$/g)].every((m) => /set search_path/.test(m[0])));
confere("bate-papo: o sinal de moderação faz todo mundo reler a lista inteira", /sinal\.tipo === "aula_chat_moderar"/.test(chat) && /buscar\(voltas %/.test(chat));
const pagina = ler("app", "[lang]", "escola", "ao-vivo", "[id]", "page.tsx");
confere("página da sala: só manda texto (nada do banco no servidor) e não é indexada", !/rpc|supabase|service/i.test(pagina) && /index: false/.test(pagina));

const funcaoYoutube = ler("supabase", "functions", "youtube", "index.ts");
confere("função do YouTube: aula da Escola sempre não listada", /publico === "escola" \? "unlisted" : privacidade/.test(funcaoYoutube));
confere("função do YouTube: aula da Escola sem link para a agenda pública", /publico === "escola"[\s\S]{0,400}descricao|escola[\s\S]{0,200}@institutoluciaorg/.test(funcaoYoutube));
const painel = ler("components", "painel", "AoVivo.tsx");
const t = JSON.parse(ler("i18n", "escola", "aovivo", "pt.json"));
confere("painel: o limite honesto está escrito", /não listada.*não é secreta/i.test(t.painel.limite) && /\{t\.limite\}/.test(painel) && /<LimiteDaEscola t=\{te\} \/>/.test(painel) && /<LimiteDaEscola[^>]*comChat/.test(painel));
confere("painel: a caixa 'Só para a Escola' só aparece para militante", /escola_eu/.test(painel + ler("lib", "escola", "aovivo.ts")) && /podeEscola/.test(painel));

// Textos nos 6 idiomas.
const chaves = (o, p = "") => (Array.isArray(o) ? [`${p}[${o.length}]`, ...o.flatMap((v, i) => chaves(v, `${p}[${i}]`))] : o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => chaves(v, p ? `${p}.${k}` : k)) : [p]);
const chavesPt = chaves(t).join("|");
for (const l of ["en", "es", "fr", "ru", "zh"]) {
  const x = JSON.parse(ler("i18n", "escola", "aovivo", `${l}.json`));
  confere(`textos ${l}: mesmas chaves do português`, chaves(x).join("|") === chavesPt);
  confere(`textos ${l}: nada vazio`, !JSON.stringify(x).includes('""'));
  confere(`textos ${l}: os marcadores {x} batem`, (JSON.stringify(x).match(/\{[a-z]+\}/gi) ?? []).sort().join() === (JSON.stringify(t).match(/\{[a-z]+\}/gi) ?? []).sort().join());
}
// Contraste AA dos pares de cor da sala e da aula gravada (components/escola/aovivo/aovivo.css).
const lum = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contraste = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
for (const [f, b] of [["#F1EEE6", "#110C0A"], ["#CDBFB5", "#110C0A"], ["#CDBFB5", "#1A1311"], ["#F2C94C", "#110C0A"], ["#E8604C", "#110C0A"], ["#110C0A", "#F2C94C"], ["#FFFFFF", "#C21F16"], ["#B3140E", "#FBFAF6"], ["#1B1F1C", "#FBFAF6"], ["#F1EEE6", "#1A1311"], ["#AE9C90", "#1A1311"]]) {
  confere(`contraste AA ${f} sobre ${b}`, contraste(f, b) >= 4.5, contraste(f, b).toFixed(2));
}
const css = ler("components", "escola", "aovivo", "aovivo.css");
confere("CSS: o pulso do 'ao vivo' respeita quem pede menos movimento", /prefers-reduced-motion: no-preference\)[\s\S]{0,120}ea-pulsa/.test(css));

const pacote = JSON.parse(ler("package.json"));
confere("package.json: a linha testar:escola-aovivo", /testar-escola-aovivo\.mjs/.test(pacote.scripts["testar:escola-aovivo"] ?? ""));

console.log(`\n${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
