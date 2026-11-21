// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, grupo "presença e print" (supabase/migracoes/20261127-p4-presenca-print.sql, flag "alumia-p4-presenca-print"):
//   item 6  status online por escolha: desligado por padrão; ligado, só "ativo recentemente" e só para a roda de confiança; um campo
//           só, em hora cheia, sobrescrito, sem histórico; desligar apaga. Nenhuma leitura grava nada.
//   item 1  proteção contra print: a escolha da autora (story, foto de perfil), quem lê só pergunta entre o que já pode ver e recebe
//           o próprio codinome para a marca d'água; nada de quem abriu fica gravado, e a autora nunca é avisada. As peças do navegador
//           (esconder ao perder o foco, barrar copiar e arrastar, a marca, o aviso por plataforma) e o FLAG_SECURE do app Android.
//   item 9  três toques na marca = Sair rápido (a conta dos toques e a ligação na casca).
// Antes da migração as funções não existem (a falha de antes); depois, tudo abaixo passa.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-p4-presenca-print.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import { deveEsconder, EVENTOS_BARRADOS, plataformaDaProtecao, textoDaMarca } from "../lib/rede/protecao-print.ts";
import { tresToques, JANELA_DOS_TRES_TOQUES } from "../lib/rede/saida.ts";
import { criarClienteDaPrevia, criarClienteDePresencaEPrint, INTERVALO_DO_ESTOU_AQUI, precisaMarcar } from "../lib/rede/cliente-presenca-print.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(detalhe ? `${nome} (${detalhe})` : nome));
async function recusa(nome, fazer, codigo) {
  try {
    const v = await fazer();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(v)?.slice(0, 200)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}
async function passa(nome, fazer) {
  try {
    const v = await fazer();
    certos++;
    return v;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
    return undefined;
  }
}

// ═══ 0. O arquivo da migração ═══
const SQL = normal(ler("supabase/migracoes/20261127-p4-presenca-print.sql"));
// Depois da junção a migração já está no install.sql: o banco de antes é o install.sql cortado antes dela.
const bancoDeAntes = () => criarBanco(ler("supabase/install.sql").replace(/\r\n/g, "\n").includes(SQL.replace(/\r\n/g, "\n").trim()) ? { antesDe: SQL } : {});
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
ok("a migração diz que roda depois do p5-fim (banco 17)", SQL.includes("Roda depois de 20261126-p5-fim.sql (banco na versão 17)"));
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("a migração não lê nem guarda endereço de rede", !/\binet\b|\bip\b|x-forwarded|cf-connecting|remote_addr|interno\.origem/i.test(semComentario));
ok("a migração não sobe a versão do banco nem mexe na lista da porta", !/rede_alumia_versao|alumia_porta_lista/i.test(semComentario));
{
  // Antes da junção a migração não está no install.sql (quem junta cola); depois, está inteira no fim (seguida só das datadas posteriores).
  const install = ler("supabase/install.sql");
  if (install.includes("rede_p4_presenca")) ok("a migração está colada no fim do install.sql (quem junta colou)", noFimDoInstall(SQL, install));
  else ok("a migração não está colada no install.sql (quem junta cola)", true);
}
ok("a marcação não passa por interno.limite (a tabela dos limites viraria histórico de presença)",
  !/rede_p4_presenca_marcar[\s\S]*?interno\.limite[\s\S]*?end \$\$;/.test(semComentario.match(/function public\.rede_p4_presenca_marcar[\s\S]*?end \$\$;/)?.[0] ?? "x"));
ok("nenhum gatilho na tabela da presença", !/create\s+trigger[\s\S]{0,200}rede_p4_presenca\b/i.test(semComentario));

// ═══ 1. Antes: nada disto existe ═══
{
  const banco = await bancoDeAntes();
  await recusa("antes: rede_p4_presenca_de não existe", () => banco.dono("select public.rede_p4_presenca_de('alguem')"), "does not exist");
  await recusa("antes: rede_p4_pp_stories não existe", () => banco.dono("select public.rede_p4_pp_stories('{}'::uuid[])"), "does not exist");
  await banco.pg.close?.();
}

// ═══ 2. Depois ═══
const banco = await criarBanco();
const { dono, rpc, criarUsuario } = banco;
await passa("a migração roda por cima do install.sql", () => banco.exclusivo(() => banco.pg.exec(SQL)));
await passa("e de novo (idempotente)", () => banco.exclusivo(() => banco.pg.exec(SQL)));
{
  const r = (await dono("select interno.alumia_trancar() as r")).rows[0].r;
  ok(`trancar não acha nada aberto (${JSON.stringify(r.abertas)})`, r.abertas.length === 0);
  const cat = (await dono("select so_pelo_nome from interno.recursos_catalogo where nome = 'alumia-p4-presenca-print'")).rows;
  ok("a flag está no catálogo, só pelo nome", cat.length === 1 && cat[0].so_pelo_nome === true);
  const vivo = (await dono("select count(*)::int n from interno.recursos_vivos where nome = 'alumia-p4-presenca-print'")).rows[0].n;
  ok("a flag nasce desligada (sem decisão no painel)", vivo === 0);
  const colunas = (await dono("select string_agg(column_name, ',' order by ordinal_position) c from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_presenca'")).rows[0].c;
  ok(`a presença é um campo só, sem data de criação nem de mudança (${colunas})`, colunas === "usuario,ativo_ate");
  // O único gatilho é o do modo só leitura de emergência (P5), que só barra escrita: nenhum copia a presença para outro lugar.
  const gatilhos = (await dono("select coalesce(string_agg(tgname, ','), '') n from pg_trigger where tgrelid = 'interno.rede_p4_presenca'::regclass and not tgisinternal")).rows[0].n;
  ok(`nenhum gatilho copia a presença para outro lugar (${gatilhos})`, gatilhos === "" || gatilhos === "alumia_so_leitura");
  const foto = (await dono("select string_agg(column_name, ',') c from information_schema.columns where table_schema = 'interno' and table_name in ('rede_p4_foto_protegida', 'rede_p4_story_protegido')")).rows[0].c;
  ok(`as escolhas da autora guardam só a escolha (${foto})`, foto.split(",").sort().join(",") === "dono,story");
  const anon = (await dono(`select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'rede\\_p4\\_%'
    and p.proname in ('rede_p4_pp_aberto','rede_p4_pp_minhas','rede_p4_presenca_ligar','rede_p4_presenca_marcar','rede_p4_presenca_de','rede_p4_foto_proteger','rede_p4_story_proteger','rede_p4_pp_stories','rede_p4_fotos_protegidas')
    and has_function_privilege('anon', p.oid, 'execute')`)).rows[0].n;
  ok("visitante sem conta não executa nenhuma função do grupo", anon === 0);
}

// As pessoas: Ana (dona), Bia (na roda da Ana), Caio (fora da roda), Davi (na roda, mas bloqueado pela Ana).
const P = {};
for (const [i, nome] of ["ana", "bia", "caio", "davi"].entries()) {
  P[nome] = await criarUsuario(`${nome}@p4-presenca.local`, nome);
  await rpc({ papel: "authenticated", sub: P[nome], ip: `198.51.100.${i + 1}` }, "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1",
    [P[nome], `Codinome ${nome}`, `pessoa_${nome}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const id of Object.values(P)) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [id]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("insert into interno.rede_roda (dono, membro) values ($1, $2), ($1, $3)", [P.ana, P.bia, P.davi]);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.ana, P.davi]);
const como = (quem) => ({ papel: "authenticated", sub: P[quem], ip: "198.51.100.9" });
const chamar = async (quem, funcao, args = {}) => {
  await dono("delete from interno.limites");
  return rpc(como(quem), funcao, args);
};
const membros = (await dono("select count(*)::int n from unnest($1::uuid[]) u where interno.rede2_membro(u)", [Object.values(P)])).rows[0].n;
ok(`as quatro pessoas são membros da Alumia (${membros})`, membros === 4);

// ── Desligado: tudo recusa, a marcação só diz "não" ──
ok("desligado: a tela não vê o grupo", (await chamar("ana", "rede_p4_pp_aberto")) === false);
await recusa("desligado: ligar o status recusa", () => chamar("ana", "rede_p4_presenca_ligar", { p_sim: true }), "desligado");
await recusa("desligado: ver a presença recusa", () => chamar("bia", "rede_p4_presenca_de", { p_handle: "pessoa_ana" }), "desligado");
await recusa("desligado: proteger a foto recusa", () => chamar("ana", "rede_p4_foto_proteger", { p_sim: true }), "desligado");
ok("desligado: marcar presença não grava nada", (await chamar("ana", "rede_p4_presenca_marcar")) === false);
ok("desligado: nenhuma linha de presença", (await dono("select count(*)::int n from interno.rede_p4_presenca")).rows[0].n === 0);

await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-p4-presenca-print', true) on conflict (nome) do update set ligado = true");
ok("ligado: a tela vê o grupo", (await chamar("ana", "rede_p4_pp_aberto")) === true);
await recusa("visitante sem conta: recusa", () => rpc({ papel: "anon", ip: "198.51.100.50" }, "rede_p4_presenca_de", { p_handle: "pessoa_ana" }), "permission denied");

// ═══ Item 6 ═══
{
  const m = await passa("item 6: as minhas escolhas", () => chamar("ana", "rede_p4_pp_minhas"));
  ok("item 6: desligado por padrão", m?.presenca === false && m?.foto === false);
  ok("item 6: sem ligar, ninguém vê (nem a roda)", (await chamar("bia", "rede_p4_presenca_de", { p_handle: "pessoa_ana" }))?.recente === false);
  ok("item 6: sem ligar, marcar não cria a linha", (await chamar("ana", "rede_p4_presenca_marcar")) === false
    && (await dono("select count(*)::int n from interno.rede_p4_presenca")).rows[0].n === 0);

  const ligou = await passa("item 6: ligar", () => chamar("ana", "rede_p4_presenca_ligar", { p_sim: true }));
  ok("item 6: ligado", ligou?.presenca === true);
  const linha = (await dono("select ativo_ate, ativo_ate = date_trunc('hour', now()) + interval '2 hours' as certo, extract(minute from ativo_ate)::int min from interno.rede_p4_presenca where usuario = $1", [P.ana])).rows;
  ok("item 6: uma linha, em hora cheia (a hora de agora mais duas), sem minuto", linha.length === 1 && linha[0].certo === true && linha[0].min === 0);

  ok("item 6: a roda de confiança vê \"ativo recentemente\"", (await chamar("bia", "rede_p4_presenca_de", { p_handle: "pessoa_ana" }))?.recente === true);
  const fora = await chamar("caio", "rede_p4_presenca_de", { p_handle: "pessoa_ana" });
  ok("item 6: quem está fora da roda não vê", fora?.recente === false);
  const naoExiste = await chamar("caio", "rede_p4_presenca_de", { p_handle: "ninguem_aqui" });
  ok("item 6: a resposta de fora da roda é igual à de quem não existe (não dá para descobrir quem ligou)", JSON.stringify(fora) === JSON.stringify(naoExiste));
  ok("item 6: na roda, mas bloqueado, não vê", (await chamar("davi", "rede_p4_presenca_de", { p_handle: "pessoa_ana" }))?.recente === false);
  ok("item 6: a própria pessoa vê o próprio status", (await chamar("ana", "rede_p4_presenca_de", { p_handle: "pessoa_ana" }))?.recente === true);
  ok("item 6: a resposta é só sim ou não (nunca a hora)", JSON.stringify(Object.keys(await chamar("bia", "rede_p4_presenca_de", { p_handle: "pessoa_ana" }))) === '["recente"]');
  ok("item 6: as minhas escolhas não devolvem a hora guardada", JSON.stringify(Object.keys(await chamar("ana", "rede_p4_pp_minhas")).sort()) === '["foto","presenca"]');

  // Marcar: sobrescreve, só quando a hora cheia muda, sem passar pelos limites.
  await dono("update interno.rede_p4_presenca set ativo_ate = date_trunc('hour', now()) - interval '3 hours' where usuario = $1", [P.ana]);
  ok("item 6: o \"ativo até\" passou, a roda deixa de ver", (await chamar("bia", "rede_p4_presenca_de", { p_handle: "pessoa_ana" }))?.recente === false);
  await dono("delete from interno.limites");
  const limitesAntes = (await dono("select count(*)::int n from interno.limites")).rows[0].n;
  ok("item 6: marcar devolve que está ligado", (await rpc(como("ana"), "rede_p4_presenca_marcar")) === true);
  const limitesDepois = (await dono("select count(*)::int n from interno.limites")).rows[0].n;
  ok("item 6: marcar não grava nada na tabela dos limites", limitesAntes === limitesDepois, `${limitesAntes} → ${limitesDepois}`);
  const depois = (await dono("select count(*)::int n, bool_and(ativo_ate = date_trunc('hour', now()) + interval '2 hours') certo from interno.rede_p4_presenca where usuario = $1", [P.ana])).rows[0];
  ok("item 6: marcar sobrescreve a mesma linha (sem histórico)", depois.n === 1 && depois.certo === true);
  ok("item 6: depois de marcar, a roda vê de novo", (await chamar("bia", "rede_p4_presenca_de", { p_handle: "pessoa_ana" }))?.recente === true);

  const desligou = await passa("item 6: desligar", () => chamar("ana", "rede_p4_presenca_ligar", { p_sim: false }));
  ok("item 6: desligado de novo", desligou?.presenca === false);
  ok("item 6: desligar apaga o campo", (await dono("select count(*)::int n from interno.rede_p4_presenca where usuario = $1", [P.ana])).rows[0].n === 0);
  ok("item 6: desligado, a roda não vê", (await chamar("bia", "rede_p4_presenca_de", { p_handle: "pessoa_ana" }))?.recente === false);

  // Aceite: não existe tabela nem log com o histórico de presença. Nenhuma tabela nova do grupo guarda tempo além do "ativo até".
  const tempos = (await dono(`select table_name || '.' || column_name c from information_schema.columns where table_schema = 'interno'
    and table_name like 'rede\\_p4\\_%' and table_name in ('rede_p4_presenca','rede_p4_foto_protegida','rede_p4_story_protegido')
    and data_type like 'timestamp%'`)).rows.map((r) => r.c);
  ok(`item 6: o único tempo guardado é o "ativo até" (${tempos.join(", ")})`, tempos.length === 1 && tempos[0] === "rede_p4_presenca.ativo_ate");
}

// ═══ Item 1 ═══
const contarTudo = async () =>
  (await dono(`select string_agg(c.relname || '=' || (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text, ',' order by c.relname) t
    from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relkind = 'r' and c.relname <> 'limites'`)).rows[0].t;
{
  const story = (await dono("insert into interno.rede_stories (autor, publico, texto) values ($1, 'membros', 'um story') returning id", [P.ana])).rows[0].id;
  const doCaio = (await dono("insert into interno.rede_stories (autor, publico, texto) values ($1, 'proximos', 'só a roda do caio') returning id", [P.caio])).rows[0].id;

  await recusa("item 1: proteger story de outra pessoa recusa", () => chamar("bia", "rede_p4_story_proteger", { p_story: story, p_sim: true }), "nao_encontrado");
  ok("item 1: story protegido pela autora", (await chamar("ana", "rede_p4_story_proteger", { p_story: story, p_sim: true }))?.protegido === true);
  await passa("item 1: o Caio protege o story dele (só a roda dele vê)", () => chamar("caio", "rede_p4_story_proteger", { p_story: doCaio, p_sim: true }));

  ok("item 1: proteger a foto", (await chamar("ana", "rede_p4_foto_proteger", { p_sim: true }))?.foto === true);
  const antes = await contarTudo();
  const daBia = await chamar("bia", "rede_p4_pp_stories", { p_stories: [story, doCaio] });
  ok("item 1: quem lê sabe que o story que vê está protegido", JSON.stringify(daBia?.stories) === JSON.stringify([story]));
  ok("item 1: e não fica sabendo de story que não pode ver", !daBia?.stories.includes(doCaio));
  ok("item 1: a marca d'água é o codinome de quem lê", daBia?.marca === "Codinome bia");
  ok("item 1: bloqueado não recebe o story protegido", (await chamar("davi", "rede_p4_pp_stories", { p_stories: [story] }))?.stories.length === 0);
  await recusa("item 1: mais de 100 stories de uma vez recusa", () => chamar("bia", "rede_p4_pp_stories", { p_stories: Array.from({ length: 101 }, () => story) }), "invalido:stories");

  const fotos = await chamar("caio", "rede_p4_fotos_protegidas", { p_handles: ["pessoa_ana", "pessoa_bia", "ninguem"] });
  ok("item 1: a foto protegida aparece como protegida", JSON.stringify(fotos?.handles) === '["pessoa_ana"]');
  ok("item 1: a marca da foto é o codinome de quem vê", fotos?.marca === "Codinome caio");
  ok("item 1: quem a dona bloqueou nem fica sabendo da proteção", (await chamar("davi", "rede_p4_fotos_protegidas", { p_handles: ["pessoa_ana"] }))?.handles.length === 0);
  const depois = await contarTudo();
  const mudou = depois.split(",").filter((x) => !antes.split(",").includes(x));
  ok("item 1: perguntar o que está protegido não grava nada em tabela nenhuma (ninguém sabe quem abriu)", antes === depois, mudou.join(" "));

  // A autora nunca é avisada de print: nenhuma função do grupo recebe "print", "captura" ou "visto", e nada vai para os avisos.
  const assinaturas = (await dono("select string_agg(p.proname || '(' || pg_get_function_arguments(p.oid) || ')', ' ') s from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','interno') and p.proname like 'rede\\_p4\\_%' and p.proname not like 'rede\\_p4\\_anexo%'")).rows[0].s;
  ok("item 1: nenhuma função registra print, captura ou quem viu", !/print|captura|visto|viu|screenshot/i.test(assinaturas));
  ok("item 1: a migração não escreve em avisos", !/rede_avisos|aviso_criar|notifica/i.test(semComentario));

  ok("item 1: tirar a proteção do story", (await chamar("ana", "rede_p4_story_proteger", { p_story: story, p_sim: false }))?.protegido === false);
  ok("item 1: sem proteção, nada aparece", (await chamar("bia", "rede_p4_pp_stories", { p_stories: [story] }))?.stories.length === 0);
  await chamar("ana", "rede_p4_foto_proteger", { p_sim: false });
  ok("item 1: tirar a proteção da foto apaga a escolha", (await dono("select count(*)::int n from interno.rede_p4_foto_protegida")).rows[0].n === 0);
  await dono("delete from interno.rede_stories where id = $1", [doCaio]);
  ok("item 1: story apagado leva a escolha junto", (await dono("select count(*)::int n from interno.rede_p4_story_protegido where story = $1", [doCaio])).rows[0].n === 0);
}

// ── O cliente chama só funções que existem na migração ──
{
  const chamadas = [];
  const c = criarClienteDePresencaEPrint(async (funcao) => {
    chamadas.push(funcao);
    return funcao === "rede_p4_presenca_de" ? { recente: true } : funcao === "rede_p4_pp_stories" ? { stories: [], marca: "" } : funcao === "rede_p4_fotos_protegidas" ? { handles: [], marca: "" } : {};
  });
  await c.minhas(); await c.ligarPresenca(true); await c.marcar(); await c.presencaDe("x"); await c.protegerFoto(true); await c.protegerStory("s", true);
  await c.storiesProtegidos(["s"]); await c.fotosProtegidas(["x"]);
  const faltam = chamadas.filter((f) => !new RegExp(`function public\\.${f}\\(`).test(SQL));
  ok(`o cliente só chama funções da migração (faltam: ${faltam.join(", ")})`, faltam.length === 0 && chamadas.length === 8);
  ok("lista vazia não vai ao servidor", (await c.storiesProtegidos([])).itens.length === 0 && chamadas.length === 8);
  const previa = criarClienteDaPrevia();
  ok("a prévia começa com tudo desligado", JSON.stringify(await previa.minhas()) === '{"presenca":false,"foto":false}');
}

// ═══ Peças do navegador (item 1) e o "estou aqui" (item 6) ═══
ok("esconde quando a aba some", deveEsconder({ visivel: false, foco: true }));
ok("esconde quando a janela perde o foco", deveEsconder({ visivel: true, foco: false }));
ok("esconde na impressão", deveEsconder({ visivel: true, foco: true, imprimindo: true }));
ok("à vista e com foco, mostra", !deveEsconder({ visivel: true, foco: true }));
ok("barra copiar, recortar, arrastar, selecionar e o menu", ["copy", "cut", "dragstart", "selectstart", "contextmenu"].every((e) => EVENTOS_BARRADOS.includes(e)));
ok("a marca d'água é curta e sem quebra", textoDaMarca("  Ana\n\tdo  Bairro ") === "Ana do Bairro" && [...textoDaMarca("x".repeat(80))].length === 40 && textoDaMarca(null) === "");
ok("app Android (WebView) = app", plataformaDaProtecao("Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP1A; wv) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36") === "app");
ok("Chrome do Android = navegador", plataformaDaProtecao("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36") === "navegador");
ok("computador = navegador", plataformaDaProtecao("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126") === "navegador");
ok("estou aqui: a primeira vez avisa", precisaMarcar(1_000_000, 0, false, true));
ok("estou aqui: trocar de tela logo depois não avisa de novo", !precisaMarcar(1_000_000 + 60_000, 1_000_000, false, true));
ok("estou aqui: depois de meia hora avisa", precisaMarcar(1_000_000 + INTERVALO_DO_ESTOU_AQUI, 1_000_000, false, true));
ok("estou aqui: status desligado ou aba escondida não avisa", !precisaMarcar(9e9, 0, true, true) && !precisaMarcar(9e9, 0, false, false));

// ═══ Item 9: três toques ═══
{
  let r = tresToques([], 1000);
  r = tresToques(r.instantes, 1300);
  ok("dois toques não saem", !r.sair);
  r = tresToques(r.instantes, 1600);
  ok("três toques em 1,2 s saem", r.sair && r.instantes.length === 0);
  ok("um quarto toque logo depois não sai de novo", !tresToques(r.instantes, 1700).sair);
  let devagar = tresToques([], 0);
  devagar = tresToques(devagar.instantes, 700);
  devagar = tresToques(devagar.instantes, 700 + JANELA_DOS_TRES_TOQUES);
  ok("três toques espalhados não saem", !devagar.sair);
}

// ═══ Telas, flag e Android (conferência do código) ═══
{
  const recursos = ler("lib/recursos.ts");
  const soPeloNome = recursos.match(/export const SO_PELO_NOME[^\n]*/)?.[0] ?? "";
  const padrao = recursos.match(/export const PADRAO[\s\S]*?\];/)?.[0] ?? "";
  ok("a flag existe, só pelo nome e fora do padrão", /"alumia-p4-presenca-print":/.test(recursos) && soPeloNome.includes('"alumia-p4-presenca-print"') && !padrao.includes("alumia-p4-presenca-print"));
  ok("a flag tem nome no painel", ler("components/painel/alumia/nomes-das-funcoes.ts").includes('"alumia-p4-presenca-print"'));
  const encaixes = ler("components/rede/encaixes.tsx");
  ok("a seção dos Ajustes entra pelo encaixe", encaixes.includes('import { encaixe as presencaPrint } from "./presenca/encaixe"') && /seguranca, presencaPrint, chat,/.test(encaixes));
  ok("o encaixe fica vazio com a flag desligada", /!presencaPrintLigada\(\)\s*\?\s*\{\}/.test(ler("components/rede/presenca/encaixe.tsx")));
  const cab = ler("components/rede/perfil/livre/Cabecalho.tsx");
  ok("o perfil mostra o \"ativo recentemente\" e protege a foto (fora da prévia do editor)", cab.includes("<PresencaRecente") && cab.includes("useRostoProtegido(refDoRosto, previa ? null"));
  const visor = ler("components/rede/stories/Visor.tsx");
  ok("o visor protege o story e dá a escolha à autora", visor.includes("useProtecaoDoStory(tela") && visor.includes("{...protecao.atributos}") && visor.includes("{protecao.camada}") && visor.includes("protecao.alternar()"));
  const casca = ler("components/rede/publicar/alumia2/CascaDaAlumia2.tsx");
  ok("as duas marcas da casca (computador e celular) têm os três toques", (casca.match(/aria-label=\{t\.marca\.inicio\} onClick=\{naMarca\}/g) ?? []).length === 2);
  ok("a casca avisa \"estou aqui\" só com conta aprovada e fora da prévia", casca.includes("useMarcarPresenca(Boolean(situacao?.logado && situacao.membro && !al2?.previa))"));
  const usar = ler("components/rede/presenca/usar.ts");
  ok("nada do grupo é gravado no aparelho", !/localStorage|sessionStorage|indexedDB/.test(usar + ler("components/rede/presenca/NoStory.tsx") + ler("components/rede/presenca/tres-toques.ts")));
  const css = ler("components/rede/presenca/presenca.css");
  ok("o CSS esconde o conteúdo e o tira da impressão", css.includes("[data-p4-escondido] > :not(.p4-capa):not(.p4-marca)") && /@media print[\s\S]*\[data-p4-protegido\]/.test(css));
  ok("a marca d'água não pega o toque", /\.p4-marca \{[^}]*pointer-events: none/.test(css));
  const pt = JSON.parse(ler("i18n/rede/p4-presenca-print/pt.json"));
  ok("o aviso fixo é o da coordenação", pt.aviso === "Isto impede o print por descuido. Não impede uma foto da tela com outro celular. Só mande o que você aceitaria ver vazado.");
  ok("o navegador diz que a proteção é mais fraca", /mais fraca/.test(pt.avisoNavegador) && /Android/.test(pt.avisoApp));
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const j = JSON.parse(ler(`i18n/rede/p4-presenca-print/${l}.json`));
    ok(`${l}: tradução nova marcada como rascunho`, j._rascunho === true);
  }
  // Android [N]: o app da R3 já liga FLAG_SECURE nas duas telas (o chat e a rede social), antes de a tela existir.
  const main = ler("android/app/src/main/java/org/institutolucia/app/MainActivity.java");
  const rede = ler("android/app/src/main/java/org/institutolucia/app/RedeActivity.java");
  ok("Android: a tela do chat liga FLAG_SECURE antes de existir", /setFlags\(WindowManager\.LayoutParams\.FLAG_SECURE, WindowManager\.LayoutParams\.FLAG_SECURE\)/.test(main) && main.indexOf("FLAG_SECURE)") < main.indexOf("super.onCreate"));
  ok("Android: a miniatura de apps recentes desligada (13+)", main.includes("setRecentsScreenshotEnabled(false)"));
  ok("Android: a rede social (stories, perfil) liga FLAG_SECURE antes de carregar a página", /FLAG_SECURE/.test(rede) && rede.indexOf("FLAG_SECURE") < rede.indexOf("loadUrl"));
  const instr = ler("android/app/src/androidTest/java/org/institutolucia/app/ProtecaoDePrintNoAparelhoTest.java");
  ok("Android: o teste de instrumentação confere FLAG_SECURE nas duas telas", /MainActivity\.class/.test(instr) && /RedeActivity\.class/.test(instr) && /FLAG_SECURE/.test(instr));
}

await banco.pg.close?.();
console.log(`p4 presença e print: ${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log("  ✗ " + f);
  process.exit(1);
}
