// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a migração 20261123-r1-borda.sql (reforço 1, frente borda e LGPD: meus dados por inteiro) num Postgres de verdade
// (scripts/banco-local.mjs), rodada DUAS vezes sobre o install.sql:
//   porta      a parte nova passa pela porta da entrada, pede o segundo fator recente e não abre para anon;
//   conteúdo   o que a pessoa fez nas ondas 9 a 14 (perfil, termos, redações, mural, questões, funções, organizações,
//              participação, preferências) sai na cópia; nada de outra pessoa (nem id, nem @, nem texto); o voto não sai;
//   cobertura  TODA tabela interno.rede_* e interno.alumia_* que aponta para a conta está na cópia (exportar, voz e vídeo, ou esta
//              parte) ou numa lista de exclusão com o motivo. Uma tabela nova com dado da pessoa, sem decisão, derruba o teste;
//   textos     a política de privacidade e "O que guardamos" dizem o que o código guarda (conversas cifradas, banimento, bloqueio na
//              borda, Fediverso pelo nome do seletor), com o que mudou de sentido jurídico marcado para revisão;
//   servidor   o .zip (lib/rede/meusdados/servidor.ts) junta esta parte e segue funcionando se ela faltar.
// Uso: npm run testar:alumia-r1-meusdados
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
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 600)}`);
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

// ═══════════════════ 0. O arquivo ═══════════════════
const sql = ler("supabase/migracoes/20261123-r1-borda.sql");
ok("a migração tem cabeçalho com a lei", /LGPD \(Lei 13\.709\/2018\) art\. 18, II/.test(sql) && /art\. 19, II/.test(sql));
ok("a migração termina chamando as portas", sql.trimEnd().endsWith("select interno.alumia_trancar();"));
ok("toda função é security definer com search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 1 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
ok("a migração não apaga tabela nem coluna", !/drop table|drop column/i.test(sql));
ok("nenhum endereço de rede é lido nem guardado", !/x-forwarded-for|cf-connecting-ip|\binet\b|interno\.origem\(\)|request\.headers/i.test(sql));
ok("o voto não sai na cópia (enquete, story, consulta, decisão)", !/\b(rede_votos|rede_voto_antigos|rede_story_votos|rede_story_voto_antigos|rede_consulta_\w+|alumia_decisao_\w+)\b/.test(sql));
ok("o código do convite e do link conferido não saem", !/\bc\.selo\b|\bl\.codigo\b/.test(sql));

// ═══════════════════ 1. Banco ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("e de novo, sem estrago (idempotente)", () => exec(sql));
// O install.sql inteiro de novo por cima: as definições finais (a R2 redefiniu public.rede_meusdados_mais) voltam a valer.
await espera("e o install.sql inteiro de novo por cima (as definições finais voltam)", () => banco.instalarDeNovo());
await espera("as portas: nenhuma função public.rede_* ficou aberta", async () => (await um("select interno.alumia_trancar() as r")).r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
await espera("a parte nova passa pela porta e não abre para anon", async () => um(`select
    pg_get_functiondef('public.rede_meusdados_mais()'::regprocedure) as def,
    has_function_privilege('anon', 'public.rede_meusdados_mais()', 'execute') as anon,
    has_function_privilege('authenticated', 'public.rede_meusdados_mais()', 'execute') as aut`),
  (r) => r.def.includes("alumia_porta") && !r.anon && r.aut);

const agora = () => Math.floor(Date.now() / 1000);
const chamar = (sub, fator, funcao) =>
  banco.exclusivo(async () => {
    const amr = [{ method: "password", timestamp: agora() - 3600 }, ...(fator === null ? [] : [{ method: "totp", timestamp: agora() - fator }])];
    await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', '{}', false)", [JSON.stringify({ role: "authenticated", sub, aal: "aal2", amr })]);
    await banco.pg.exec("set role authenticated");
    try {
      return (await banco.pg.query(`select public.${funcao}() as r`)).rows[0]?.r ?? null;
    } finally {
      await banco.pg.exec("reset role");
    }
  });

// O Prompt 4 já está no banco montado? (A cópia ganha a parte "prompt4" com a 20261127-p4-meusdados.sql.)
const P4 = Boolean((await um("select to_regclass('interno.rede_p4_selos') is not null as t"))?.t);
// E as tabelas dos lotes juntados depois (a cultura, entre elas)?
const P4_CULTURA = Boolean((await um("select to_regclass('interno.rede_p4_obras') is not null as t"))?.t);
// E os da terceira junção (a organização, entre eles)?
const P4_ORGANIZACAO = Boolean((await um("select to_regclass('interno.rede_p4_or_apoio_direto') is not null as t"))?.t);
// E os da quarta junção (a descoberta e estudo e a conta, entre eles)?
const P4_QUARTA = Boolean((await um("select to_regclass('interno.rede_p4_de_linhas') is not null and to_regclass('interno.rede_p4_ct_prefs') is not null as t"))?.t);
const P = {};
for (const [i, nome] of ["dona", "outra", "alt"].entries()) {
  P[nome] = await criarUsuario(`${nome}@r1.local`, `Nome Civil ${nome}`);
  await rpc({ papel: "authenticated", sub: P[nome] }, "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1, rede_handle = $3 where id = $1", [P[nome], `Codinome R${i + 1}`, `${nome}_r1`]);
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const id of Object.values(P)) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [id]);
await dono("update auth.users set created_at = now() - interval '30 days'");

// O que cada uma fez (a "outra" faz o mesmo, com marcas próprias, para provar que nada dela vaza na cópia da dona).
async function semear(quem, marca) {
  const linhas = [
    ["alumia_perfil_secoes (usuario, secoes, sobre)", "$1, array['sobre'], $2", [quem, `sobre ${marca}`]],
    ["alumia_perfil_voluntariado (usuario, frente, ano_de, situacao)", "$1, $2, 2024, 'confirmado'", [quem, marca === "DONA" ? "educacao" : "curadoria"]],
    ["alumia_mural (usuario, como, codinome, curso, instituicao, recado, entrou_em)", "$1, 'codinome', $2, 'Pedagogia', 'UF', $3, current_date", [quem, `Codinome ${marca}`, `recado ${marca}`]],
    ["rede_questoes (autor, materia, tema, enunciado, alternativas, certa, explicacao)", "$1, 'historia', 'tema', $2, '[\"a\",\"b\",\"c\",\"d\"]'::jsonb, 1, 'porque sim'", [quem, `enunciado ${marca}`]],
    ["alumia_conquistas (usuario, medalha, alvo, progresso, mostrar)", "$1, $2, $3, 1, true", [quem, "trilha", `alvo-${marca.toLowerCase()}`]],
    // O arquivo cifrado da lista de conversas (R2, 20261124-r2-dupla.sql): as preferências do chat moram nele, no aparelho.
    ["rede_cofres_da_conta (usuario, tipo, versao, blob, dia)", "$1, 'lista', 3, decode(repeat('00', 65610), 'hex'), current_date", [quem]],
    ["rede_avisos_silencio (usuario, inicio, fim)", "$1, 22, 7", [quem]],
    // Prompt 4 (20261127-p4-meusdados.sql): as escolhas da pessoa nas funções novas.
    ...(P4 ? [
      ["rede_p4_selos (perfil, tipo)", "$1, $2", [quem, marca === "DONA" ? "educadora" : "pessoa_publica"]],
      ["rede_p4_contagens (perfil, seguidores, apoios)", "$1, $2, false", [quem, marca === "DONA"]],
      ["rede_p4_foto_protegida (dono)", "$1", [quem]],
      // Sem contato de confiança, o interruptor só vale para apagar a conta (a regra da tabela).
      ["rede_p4_sumico (usuario, dias, apagar)", "$1, $2, true", [quem, marca === "DONA" ? 30 : 60]],
    ] : []),
    // Junção do Prompt 4 (cultura): a obra seriada que a pessoa escreveu.
    ...(P4 && P4_CULTURA ? [["rede_p4_obras (autor, titulo, genero)", "$1, $2, 'cordel'", [quem, `obra ${marca}`]]] : []),
    // Terceira junção do Prompt 4 (organização): o jeito de apoiar que a pessoa pôs no perfil.
    ...(P4 && P4_ORGANIZACAO ? [["rede_p4_or_apoio_direto (pessoa, link)", "$1, $2", [quem, `https://apoio.exemplo/${marca}`]]] : []),
    // Quarta junção do Prompt 4: a linha compartilhável que a pessoa publicou (descoberta) e a mensagem de ausência dela (conta).
    ...(P4 && P4_QUARTA ? [
      ["rede_p4_de_linhas (codigo, dona, nome, filtro)", "substr(md5($2), 1, 12), $1, $2, '{}'::jsonb", [quem, `linha ${marca}`]],
      ["rede_p4_ct_prefs (usuario, ausencia)", "$1, $2", [quem, `fora ${marca}`]],
    ] : []),
  ];
  const falharam = [];
  for (const [tabela, valores, args] of linhas) {
    try {
      await dono(`insert into interno.${tabela} values (${valores})`, args);
    } catch (e) {
      falharam.push(`${tabela.split(" ")[0]}: ${e.message}`);
    }
  }
  return falharam;
}
const semFalha = [...(await semear(P.dona, "DONA")), ...(await semear(P.outra, "OUTRA"))];
ok(`as linhas de teste entram (${semFalha.join(" | ")})`, semFalha.length === 0);
// A outra identidade da dona e um aceite de termos (as tabelas com chave estrangeira própria).
await espera("a dona tem outra identidade", () => dono("insert into interno.rede_identidades (dono, identidade, tipo) values ($1, $2, 'identidade')", [P.dona, P.alt]));
const versaoTermos = (await um("select coalesce(max(versao), 1) as v from interno.alumia_termos"))?.v ?? 1;
await espera("a dona aceitou os termos", () => dono("insert into interno.alumia_termos_aceites (usuario, versao, como) values ($1, $2, 'cadastro') on conflict do nothing", [P.dona, versaoTermos]));

// ═══════════════════ 2. A parte nova ═══════════════════
await recusa("sem o código recente do aplicativo, recusa", () => chamar(P.dona, null, "rede_meusdados_mais"), "confirme_segundo_fator");
await recusa("código de 20 minutos atrás também não vale", () => chamar(P.dona, 20 * 60, "rede_meusdados_mais"), "confirme_segundo_fator");
const mais = await espera("com o código de agora, a parte sai", () => chamar(P.dona, 30, "rede_meusdados_mais"), (r) => r && typeof r === "object");
if (mais) {
  const texto = JSON.stringify(mais);
  if (P4) {
    const p4 = mais.prompt4 ?? {};
    ok("Prompt 4: o selo, as contagens, a foto protegida e o interruptor de sumiço da dona saem na cópia",
      p4.selo_de_verificado?.[0]?.tipo === "educadora" && p4.contagens_publicas?.[0]?.seguidores === true && p4.foto_protegida?.length === 1
      && p4.interruptor_de_sumico?.[0]?.dias === 30 && p4.interruptor_de_sumico[0].apagar === true && p4.interruptor_de_sumico[0].tem_contato === false);
    if (P4_ORGANIZACAO) ok("Prompt 4 (organização): o apoio direto da dona sai na cópia, o da outra não",
      p4.apoio_direto?.length === 1 && p4.apoio_direto[0].link === "https://apoio.exemplo/DONA" && !JSON.stringify(p4).includes("apoio.exemplo/OUTRA"));
    if (P4_QUARTA) ok("Prompt 4 (quarta junção): a linha compartilhável e a mensagem de ausência da dona saem na cópia, as da outra não",
      p4.linhas_que_publiquei?.length === 1 && p4.linhas_que_publiquei[0].nome === "linha DONA" && p4.escolhas_da_conta?.[0]?.ausencia === "fora DONA"
      && !JSON.stringify(p4).includes("linha OUTRA") && !JSON.stringify(p4).includes("fora OUTRA"));
    if (P4_CULTURA) ok("Prompt 4 (cultura): a obra da dona sai na cópia, a da outra não",
      p4.obras?.length === 1 && p4.obras[0].titulo === "obra DONA" && !JSON.stringify(p4).includes("obra OUTRA"));
    ok("Prompt 4: nada da outra pessoa (o selo e o prazo dela não aparecem)", !JSON.stringify(p4).includes("pessoa_publica") && !JSON.stringify(p4).includes('"dias":60'));
  }
  ok("traz as seções e o voluntariado do perfil", mais.secoes_do_perfil?.[0]?.sobre === "sobre DONA" && mais.voluntariado_no_perfil?.length === 1 && mais.voluntariado_no_perfil[0].frente === "educacao");
  ok("traz o recado no mural e a questão que ela escreveu", mais.recado_no_mural?.[0]?.recado === "recado DONA" && mais.questoes?.[0]?.enunciado === "enunciado DONA");
  ok("traz as conquistas e as preferências", mais.conquistas?.length === 1 && mais.conquistas[0].alvo === "alvo-dona" && mais.preferencias?.conversas?.onde === "no_aparelho" && mais.preferencias.conversas.arquivos_cifrados?.[0]?.tipo === "lista" && mais.preferencias.conversas.arquivos_cifrados[0].bytes === 65610 && mais.preferencias?.silencio_dos_avisos?.[0]?.inicio === 22);
  ok("traz a outra identidade dela, pelo @", mais.outras_identidades?.length === 1 && mais.outras_identidades[0].arroba === "alt_r1");
  ok("traz o aceite dos termos", Array.isArray(mais.aceites_dos_termos) && mais.aceites_dos_termos.length === 1);
  ok("nada da outra pessoa: nem o id, nem o @, nem o texto", !texto.includes(P.outra) && !texto.includes("outra_r1") && !texto.includes("OUTRA"));
  ok("nem o id da própria conta (a cópia é dela; o id não serve a ela)", !texto.includes(P.dona));
  ok("as seções vazias saem vazias, sem erro", Array.isArray(mais.redacoes) && Array.isArray(mais.funcoes?.cargos) && Array.isArray(mais.organizacoes?.boletins_assinados));
}

// ═══════════════════ 3. Cobertura: nenhuma tabela da pessoa sem decisão ═══════════════════
// Fora da cópia, com o motivo. "terceiros": a linha é sobre a relação com outra pessoa (só ids de outras pessoas);
// "voto": ninguém pode exigir a prova do voto; "cifrado": o texto só abre no aparelho; "segurança": barreira contra abuso, que
// perde o sentido se for entregue (a pessoa vê a situação dela na tela); "equipe": o ato é da equipe ou da organização, não da
// pessoa como titular; "passagem": vive minutos ou horas, só para entregar algo.
const EXCLUIDAS = {
  alumia_admin_borda: "equipe", alumia_admin_convite_lacos: "segurança", alumia_ato_contatos: "terceiros", alumia_ato_sinais: "terceiros",
  alumia_avisos_fixados: "equipe", alumia_cadastro_passes: "passagem", alumia_com_herdados: "equipe", alumia_comunidades_encerradas: "equipe",
  alumia_convite_cotas: "segurança", alumia_decisao_abertos: "voto", alumia_decisao_votantes: "voto", alumia_impressao_banimentos: "equipe",
  alumia_impressoes: "segurança", alumia_monitoria_marcas: "passagem", alumia_pacote_convites: "terceiros", alumia_painel_lixeira: "equipe",
  alumia_redacao_afastadas: "segurança", alumia_redacao_leituras: "terceiros", alumia_reputacao: "segurança", alumia_rotulos: "equipe",
  alumia_sessoes_cortadas: "segurança", alumia_transp_pedidos: "equipe", rede_acervo_doc_versoes: "equipe", rede_alumia_wiki_versoes: "equipe",
  rede_ama: "terceiros", rede_ato_farol_pedidos: "passagem", rede_comunidades: "equipe", rede_convites: "terceiros",
  rede_desc_pacote_pessoas: "terceiros", rede_dm_chaves: "cifrado", rede_dm_conversas: "cifrado", rede_dm_mensagens: "cifrado",
  rede_dm_recusas: "terceiros", rede_espacos: "equipe", rede_fed_enviados: "passagem", rede_lento: "equipe", rede_mencoes: "terceiros",
  rede_mls_boasvindas: "cifrado", rede_mls_commits: "cifrado", rede_mls_pacotes: "cifrado", rede_o9_marcacoes: "terceiros",
  rede_o9_restritos: "terceiros", rede_o9_soltas: "terceiros", rede_olm_aparelhos: "cifrado", rede_olm_caixa: "cifrado",
  rede_olm_reserva: "cifrado", rede_olm_unicas: "cifrado", rede_org_ata_sinais: "voto", rede_org_caixa_lancamentos: "equipe",
  rede_org_fila: "equipe", rede_org_pedidos: "equipe", rede_pontes_resumo: "passagem", rede_rotulos: "equipe", rede_sel_caixa: "cifrado",
  rede_sel_entrega: "cifrado", rede_story_voto_antigos: "voto", rede_story_votos: "voto", rede_voto_antigos: "voto", rede_votos: "voto",
  alumia_apagamentos: "passagem", rede_bloqueio_lista: "terceiros", rede_dm_embrulhos: "cifrado", rede_story_mencao_aviso: "passagem",
};
const cobertura = await espera("o catálogo e as funções da cópia", async () => {
  const tabelas = (await dono(`select distinct c.relname as t from pg_constraint con join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace join pg_class cf on cf.oid = con.confrelid join pg_namespace nf on nf.oid = cf.relnamespace
      where con.contype = 'f' and n.nspname = 'interno' and c.relname ~ '^(rede|alumia)_'
        and ((nf.nspname = 'interno' and cf.relname = 'perfis') or (nf.nspname = 'auth' and cf.relname = 'users'))`)).rows.map((r) => r.t);
  const defs = (await dono(`select string_agg(pg_get_functiondef(p.oid), E'\\n') as d from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('rede_meusdados_exportar', 'rede_meusdados_voz_e_video', 'rede_meusdados_mais')`)).rows[0].d;
  return { tabelas, defs };
}, (r) => r.tabelas.length > 100);
if (cobertura) {
  // A R2 (20261124-r2-grupos.sql) troca as tabelas do MLS da rede: saem as rede_mls_* (da ts-mls) e entra rede_grupo_folhas (o nome
  // da folha MLS de cada aparelho, a chave pública dele: só serve à cifra). Vale o que existir no banco montado (antes e depois da junção).
  for (const t of ["rede_mls_boasvindas", "rede_mls_commits", "rede_mls_pacotes"]) if (!cobertura.tabelas.includes(t)) delete EXCLUIDAS[t];
  // E o chat a dois do beta (20261124-r2-dupla.sql) sai inteiro: as rede_dm_*, rede_olm_* e rede_sel_* deixam de existir.
  for (const t of Object.keys(EXCLUIDAS)) if (/^rede_(dm|olm|sel)_/.test(t) && !cobertura.tabelas.includes(t)) delete EXCLUIDAS[t];
  // A chave da votação secreta (20261124-r2-voto.sql: quem criou e as guardiãs) e o núcleo (que a R2 dos membros escondidos deixa só
  // com quem o criou, a organização ou a coordenação) são da organização, não da pessoa como titular.
  if (cobertura.tabelas.includes("rede_consulta_chaves")) EXCLUIDAS.rede_consulta_chaves = "voto";
  if (cobertura.tabelas.includes("rede_nucleos")) EXCLUIDAS.rede_nucleos = "equipe";
  if (cobertura.tabelas.includes("rede_grupo_folhas")) EXCLUIDAS.rede_grupo_folhas = "cifrado";
  // R3 (20261125-r3-sem-internet-formal.sql): a chave pública do farol de quem coordena o ato; o "de" só garante uma chave por pessoa e
  // nenhuma função o devolve. É do ato (da coordenação), não da pessoa como titular.
  if (cobertura.tabelas.includes("rede_ato_farol_chaves")) EXCLUIDAS.rede_ato_farol_chaves = "equipe";
  // Prompt 5 (20261126-p5-entrada.sql): o navegador conhecido (a marca do cookie, o rótulo e o dia) é a barreira do aviso de entrada
  // nova, como alumia_sessoes_cortadas; a sessão nova esperando o navegador se apresentar vive 10 minutos (no máximo 1 dia).
  if (cobertura.tabelas.includes("alumia_navegadores")) EXCLUIDAS.alumia_navegadores = "segurança";
  if (cobertura.tabelas.includes("alumia_entradas_pendentes")) EXCLUIDAS.alumia_entradas_pendentes = "passagem";
  // Prompt 5 (20261126-p5-beta.sql): o pedido de zerar o beta guarda só quem da coordenação pediu (o registro da ação). É da equipe.
  if (cobertura.tabelas.includes("alumia_zerar_pedidos")) EXCLUIDAS.alumia_zerar_pedidos = "equipe";
  // Prompt 4: o limite dos avisos de local guarda só a conta e a hora cheia, sem lugar nem categoria (20261127-p4-avisos-de-local.sql);
  // os embrulhos da caixa da assessoria e os avisos de sumiço entregues são cifrados para quem recebe (20261127-p4-seguranca-pessoal.sql).
  // O resto das tabelas do Prompt 4 entra na cópia (20261127-p4-meusdados.sql).
  if (cobertura.tabelas.includes("rede_local_limite")) EXCLUIDAS.rede_local_limite = "passagem";
  if (cobertura.tabelas.includes("rede_p4_seg_embrulhos")) EXCLUIDAS.rede_p4_seg_embrulhos = "cifrado";
  if (cobertura.tabelas.includes("rede_p4_sumico_entregues")) EXCLUIDAS.rede_p4_sumico_entregues = "cifrado";
  // Terceira junção (20261127-p4-coletiva.sql): o embrulho da ficha de filiação é cifrado para quem a organização escolheu ler (a
  // "conta" é de quem recebe, não de quem se filiou).
  if (cobertura.tabelas.includes("rede_p4_filiacao_embrulhos")) EXCLUIDAS.rede_p4_filiacao_embrulhos = "cifrado";
  const naCopia = (t) => new RegExp(`\\b${t}\\b`).test(cobertura.defs);
  const semDecisao = cobertura.tabelas.filter((t) => !naCopia(t) && !(t in EXCLUIDAS));
  ok(`toda tabela da pessoa está na cópia ou tem motivo para ficar fora (sem decisão: ${semDecisao.join(", ")})`, semDecisao.length === 0);
  const sobrando = Object.keys(EXCLUIDAS).filter((t) => naCopia(t) || !cobertura.tabelas.includes(t));
  ok(`a lista de exclusão não tem tabela que já está na cópia ou que não existe (${sobrando.join(", ")})`, sobrando.length === 0);
  ok("voto e conversa cifrada nunca estão na cópia", Object.entries(EXCLUIDAS).filter(([, m]) => m === "voto" || m === "cifrado").every(([t]) => !naCopia(t)));
}

// ═══════════════════ 4. Os textos dizem o que o código guarda ═══════════════════
{
  const politica = ler("content/paginas/privacidade.md");
  const alumia = politica.slice(politica.indexOf("## Alumia"), politica.indexOf("## Se você publica na Gaveta"));
  ok("a política não diz mais que a Alumia não tem conversa privada", !/Não há conversa privada/.test(alumia));
  ok("a política conta as conversas cifradas, quem conversa com quem e o registro de chaves", /cifradas de ponta a ponta/.test(alumia) && /quem conversa com quem/.test(alumia) && /registro público de chaves/.test(alumia));
  ok("a política conta o banimento (resumo do e-mail) e o bloqueio na borda, sem guardar endereço", /resumo embaralhado do e-mail/.test(alumia) && /Cloudflare/.test(alumia) && /1 a 7 dias/.test(alumia));
  ok("a política usa o nome do seletor (\"Alumia e Fediverso\") e diz que \"Todos na Alumia\" não sai", /"Alumia e Fediverso"/.test(alumia) && /"Todos na Alumia" nunca sai/.test(alumia) && !/marcar como Internet/.test(alumia));
  ok("a política diz como baixar a cópia e apagar a conta da Alumia", /\[Meus dados da Alumia\]\(\/alumia\/meus-dados\)/.test(politica) && /sem os seus votos/.test(politica));
  ok("o que mudou com sentido jurídico está marcado para a revisão", (alumia.match(/RASCUNHO, REVISÃO JURÍDICA PENDENTE/g) ?? []).length >= 3);
  const rotulos = JSON.parse(ler("i18n/rede/publicar/alumia2/pt.json"));
  const textoDoSeletor = JSON.stringify(rotulos);
  ok("os nomes usados na política são os do seletor da tela", textoDoSeletor.includes('"internet":"Alumia e Fediverso"') && textoDoSeletor.includes('"membros":"Todos na Alumia"'));
  const lei = JSON.parse(ler("i18n/rede/lei/pt.json"));
  const linhas = lei.guardamos.grupos.flatMap((g) => g.linhas.map((l) => `${g.titulo} :: ${l.dado} :: ${l.onde} :: ${l.tempo}`));
  ok("\"O que guardamos\" tem o grupo do Fediverso", lei.guardamos.grupos.some((g) => /^Fediverso/.test(g.titulo) && g.linhas.length >= 5));
  ok("\"O que guardamos\" diz que de quem curtiu de fora fica só um apelido, nunca o endereço", linhas.some((l) => /Curtidas e impulsos/.test(l) && /apelido embaralhado/.test(l) && /nunca o endereço/.test(l)));
  ok("\"O que guardamos\" tem a marca do e-mail barrado, as chaves dos aparelhos e o bloqueio na borda", linhas.some((l) => /e-mail barrado/.test(l)) && linhas.some((l) => /registro público de chaves/.test(l)) && linhas.some((l) => /Cloudflare/.test(l) && /1 a 7 dias/.test(l)));
  ok("o item do Fediverso na privacidade da Alumia usa o nome do seletor", lei.privacidade.secoes[6].itens.some((x) => /"Alumia e Fediverso"/.test(x)) && !lei.privacidade.secoes[6].itens.some((x) => /marcados como Internet/.test(x)));
}

// ═══════════════════ 5. O servidor do .zip ═══════════════════
const servidor = ler("lib/rede/meusdados/servidor.ts");
ok("o .zip pede a parte nova como a própria pessoa", /chamarComoPessoa<Record<string, unknown>>\(token, "rede_meusdados_mais"\)/.test(servidor));
ok("sem a parte nova (ou se ela falhar), a cópia sai como antes", /if \(!mais\.ok \|\| !mais\.dado\) return dados;/.test(servidor));
ok("a parte nova não troca o que a cópia principal já trouxe (e vem depois dela)", /filter\(\(\[chave\]\) => !\(chave in dados\)\)/.test(servidor) && /\{ \.\.\.dados, \.\.\.Object\.fromEntries\(novas\) \}/.test(servidor));

if (falhas.length) {
  console.error(`Alumia (meus dados por inteiro, reforço 1): ${certos} certos, ${falhas.length} falhas.`);
  for (const f of falhas) console.error(`  FALHA: ${f}`);
  process.exit(1);
}
console.log(`Alumia (meus dados por inteiro, reforço 1): ${certos} certos, 0 falhas.`);
process.exit(0);
