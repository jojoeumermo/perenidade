// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o back-end da F4 da Alumia (supabase/migracoes/20261109-alumia-f4.sql) num Postgres de verdade dentro do Node, sobre o
// install.sql + a F0, com a migração rodada DUAS vezes (idempotente). A matriz visitante / membro / dono / bloqueado em cada
// função: conta de organização (o caminho do servidor: rede_org_pedir_selo → conta sem senha → rede_identidade_ligar →
// rede_org_criar, que só a chave de serviço chama), pedido e fila do selo (só a coordenação; sem quem pediu), gestores (o vínculo
// não aparece em resposta nenhuma), "Como votamos" (fonte obrigatória), núcleos da organização (pedido e decisão), consultas
// (só quem é de um núcleo da organização vota; voto secreto por construção; quórum; resultado só fechado e com 3 ou mais; a
// apuração ranqueada do banco bate com lib/rede/org/apuracao.ts em casos conhecidos e sorteados), plenárias (fila na ordem de
// chegada que não reordena; respondida e retirada só por regra; visitante não vê a fila), "Ao vivo agora", o sininho (avisa
// quando a organização posta), os extras do perfil, os limites de uso e as permissões (nada direto nas tabelas).
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 --import ./scripts/carregar-ts.mjs scripts/testar-alumia-f4.mjs
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import { apurarRanqueada, apurarSimples, proporcoesFinais } from "../lib/rede/org/apuracao.ts";
import { criarClienteOrg } from "../lib/rede/cliente-org.ts";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 400)}`);
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
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
const ler = (c) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");

// ── Instalação ──
const banco = await criarBanco();
const { dono: sql, criarUsuario, rpc } = banco;
const um = async (t, v = []) => (await sql(t, v)).rows[0];
const migracao = ler("supabase/migracoes/20261109-alumia-f4.sql");
ok("a migração NÃO está colada no install.sql (o integrador cola)", !ler("supabase/install.sql").includes("Alumia · Onda 5 · F4"));
await espera("a F0 instala", () => banco.exclusivo(() => banco.pg.exec(ler("supabase/migracoes/20261109-alumia-f0-contrato.sql"))));
await espera("a F4 instala sobre a F0", () => banco.exclusivo(() => banco.pg.exec(migracao)));
await espera("e instala de novo sem estrago (idempotente)", () => banco.exclusivo(() => banco.pg.exec(migracao)));

let ip = 10;
const como = (sub, extra = {}) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}`, ...extra });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });
const SERVICO = { papel: "service_role" };

// ── As pessoas ──
// dona: cria a organização; gestora: posta depois como gestora; m1..m5: membros; fora: membro sem núcleo; bloq: membro bloqueado
// pela organização; menor: declarou menos de 18 (não é membro); equipe: coordenação.
const nomes = ["dona", "gestora", "m1", "m2", "m3", "m4", "m5", "fora", "bloq", "menor", "equipe"];
const P = {};
for (const nome of nomes) {
  P[nome] = await criarUsuario(`${nome}@f4.local`, nome);
  await rpc(como(P[nome]), "eu");
  await sql("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [P[nome], `Pessoa ${nome}`, `${nome}_f4`]);
}
await sql("delete from interno.papeis");
await sql("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [P.equipe]);
await sql("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes.filter((n) => n !== "menor")) {
  await sql("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome]]);
  await sql("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1)", [P[nome]]);
}
await sql("update auth.users set created_at = now() - interval '30 days'");
const A = (nome, extra) => como(P[nome], extra);
const EQUIPE = como(P.equipe, { aal: "aal2" });

// ── 1. Conta da organização (o caminho do servidor) e o selo ──
const PEDIDO = { codinome: "Coletivo Lume", handle: "coletivo_lume", tipo: "coletivo", cidade: "São Paulo", documentoTipo: "CNPJ", documento: "12.345.678/0001-90", sobre: "Coletivo de bairro da zona leste.", maior: true };
await recusa("visitante não pede o selo", () => rpc(visitante(), "rede_org_pedir_selo", { p: PEDIDO }), "permission denied");
await recusa("quem não é membro (menos de 18) não pede", () => rpc(A("menor"), "rede_org_pedir_selo", { p: PEDIDO }), "confirme_idade");
await recusa("CPF no lugar do documento público é recusado", () => rpc(A("dona"), "rede_org_pedir_selo", { p: { ...PEDIDO, documento: "123.456.789-09" } }), "invalido:docpessoal");
await recusa("sem a declaração de 18 anos é recusado", () => rpc(A("dona"), "rede_org_pedir_selo", { p: { ...PEDIDO, maior: false } }), "invalido:maior");
await recusa("@ de uma pessoa é recusado", () => rpc(A("dona"), "rede_org_pedir_selo", { p: { ...PEDIDO, handle: "m1_f4" } }), "handle_usado");
await recusa("@ que imita o instituto é recusado", () => rpc(A("dona"), "rede_org_pedir_selo", { p: { ...PEDIDO, handle: "lucia_oficial" } }), "handle_reservado");
const prep = await espera("@ livre: o banco pede conta nova e devolve o próprio id de quem chama", () => rpc(A("dona"), "rede_org_pedir_selo", { p: PEDIDO }), (r) => r.criar === true && r.dono === P.dona);
// O servidor cria a conta sem senha (lib/rede/contas-extra.ts) e liga ao dono; aqui, o mesmo no banco.
const ORG = (await sql("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", ["a1b2c3d4@contas.alumia.invalid", JSON.stringify({ apelido: "Coletivo Lume" })])).rows[0].id;
await espera("a conta nova liga ao dono (só a chave de serviço)", () => rpc(SERVICO, "rede_identidade_ligar", { p_dono: P.dona, p_identidade: ORG, p_tipo: "org" }));
await recusa("ninguém logado transforma a conta em organização (só o servidor)", () => rpc(A("dona"), "rede_org_criar", { p_dono: P.dona, p_org: ORG, p: PEDIDO }), "permission denied");
await recusa("o servidor não transforma conta que não é do dono", () => rpc(SERVICO, "rede_org_criar", { p_dono: P.m1, p_org: ORG, p: PEDIDO }), "sem_permissao");
const pedido = await espera("o servidor transforma a conta em organização e põe o pedido na fila", () => rpc(SERVICO, "rede_org_criar", { p_dono: P.dona, p_org: prep ? ORG : ORG, p: PEDIDO }), (r) => r.situacao === "esperando" && r.id);
await recusa("não transforma duas vezes", () => rpc(SERVICO, "rede_org_criar", { p_dono: P.dona, p_org: ORG, p: PEDIDO }), "ja_pedido");
await espera("a organização tem @, codinome e a palavra da capa", () => um("select f.rede_handle, f.rede_codinome, o.palavra from interno.perfis f join interno.rede_orgs o on o.perfil = f.id where f.id = $1", [ORG]), (r) => r.rede_handle === "coletivo_lume" && r.rede_codinome === "Coletivo Lume" && r.palavra === "COLETIVO LUME");
await recusa("pedir de novo com o pedido esperando", () => rpc(A("dona"), "rede_org_pedir_selo", { p: PEDIDO }), "ja_pedido");
await recusa("outra pessoa não pede o selo pela organização dos outros", () => rpc(A("m1"), "rede_org_pedir_selo", { p: PEDIDO }), "handle_usado");

// Antes do selo: visitante não vê; membro vê sem o selo.
await espera("visitante: organização sem selo não aparece", () => rpc(visitante(), "rede_org_perfil", { p_handle: "coletivo_lume" }), (r) => r === null);
await espera("membro: vê a organização ainda sem selo", () => rpc(A("m1"), "rede_org_perfil", { p_handle: "@Coletivo_Lume" }), (r) => r?.verificadaEm === null && r.documento === null && r.gerencio === false);
await espera("@ de pessoa não é organização (o perfil de pessoa segue)", () => rpc(A("m1"), "rede_org_perfil", { p_handle: "m2_f4" }), (r) => r === null);

// A fila do selo.
await recusa("membro não vê a fila do selo", () => rpc(A("m1"), "rede_org_selo_fila"), "sem_permissao");
await recusa("a dona da organização não vê a fila do selo", () => rpc(A("dona"), "rede_org_selo_fila"), "sem_permissao");
const fila = await espera("a coordenação vê o pedido com o documento público", () => rpc(EQUIPE, "rede_org_selo_fila"), (r) => r.length === 1 && r[0].handle === "coletivo_lume" && r[0].documento === PEDIDO.documento && r[0].situacao === "esperando");
ok("a fila não traz quem pediu nem quem cuida da conta", fila && !JSON.stringify(fila).includes(P.dona) && !JSON.stringify(fila).includes("dona_f4") && !JSON.stringify(fila).includes("Pessoa dona"));
await recusa("membro não decide o selo", () => rpc(A("m1"), "rede_org_selo_decidir", { p_id: pedido?.id, p_aceitar: true, p_motivo: "" }), "sem_permissao");
await recusa("recusar sem motivo não vale", () => rpc(EQUIPE, "rede_org_selo_decidir", { p_id: pedido?.id, p_aceitar: false, p_motivo: "curto" }), "invalido:motivo");
await espera("a coordenação dá o selo", () => rpc(EQUIPE, "rede_org_selo_decidir", { p_id: pedido?.id, p_aceitar: true, p_motivo: "" }), (r) => r.ok);
await espera("quem cuida da conta recebe o aviso do selo", () => um("select count(*)::int n from interno.avisos where para = $1 and texto like '%recebeu o selo%'", [P.dona]), (r) => r.n === 1);
await recusa("decidir duas vezes não vale", () => rpc(EQUIPE, "rede_org_selo_decidir", { p_id: pedido?.id, p_aceitar: true, p_motivo: "" }), "nao_encontrado");
await espera("visitante: com selo, a organização aparece com o tipo do documento", () => rpc(visitante(), "rede_org_perfil", { p_handle: "coletivo_lume" }), (r) => r?.verificadaEm && r.documento === "CNPJ" && r.sigo === false && r.gerencio === false);

// ── 2. Gestores: o vínculo não aparece para ninguém ──
await recusa("membro não põe gestor", () => rpc(A("m1"), "rede_org_gestor_adicionar", { p_org: "coletivo_lume", p_handle: "m2_f4" }), "sem_permissao");
await recusa("não vira gestora quem não é membro", () => rpc(A("dona"), "rede_org_gestor_adicionar", { p_org: "coletivo_lume", p_handle: "menor_f4" }), "nao_encontrado");
await espera("a dona põe a gestora", () => rpc(A("dona"), "rede_org_gestor_adicionar", { p_org: "coletivo_lume", p_handle: "gestora_f4" }), (r) => r.ok === true && Object.keys(r).length === 1);
await recusa("a gestora não põe outra gestora (só a dona)", () => rpc(A("gestora"), "rede_org_gestor_adicionar", { p_org: "coletivo_lume", p_handle: "m3_f4" }), "sem_permissao");
await espera("a dona gerencia", () => rpc(A("dona"), "rede_org_perfil", { p_handle: "coletivo_lume" }), (r) => r.gerencio === true);
await espera("a gestora gerencia", () => rpc(A("gestora"), "rede_org_perfil", { p_handle: "coletivo_lume" }), (r) => r.gerencio === true);
await espera("a gestora age como a organização (rede_age_como da F0, ampliada)", () => um("select interno.rede_age_como($1, $2) a, interno.rede_age_como($3, $2) b", [P.gestora, ORG, P.m1]), (r) => r.a === true && r.b === false);
{
  const deFora = JSON.stringify(await rpc(A("m1"), "rede_org_perfil", { p_handle: "coletivo_lume" }));
  const deVisita = JSON.stringify(await rpc(visitante(), "rede_org_perfil", { p_handle: "coletivo_lume" }));
  const daGestora = JSON.stringify(await rpc(A("gestora"), "rede_org_perfil", { p_handle: "coletivo_lume" }));
  for (const [quem, texto] of [["membro", deFora], ["visitante", deVisita], ["a própria gestora", daGestora]]) {
    ok(`${quem}: o perfil não traz nem o id nem o @ de quem cuida`, ![P.dona, P.gestora, "dona_f4", "gestora_f4", "Pessoa dona", "Pessoa gestora"].some((x) => texto.includes(x)));
  }
}
await espera("tirar quem não era gestor responde igual (não serve para descobrir)", () => rpc(A("dona"), "rede_org_gestor_remover", { p_org: "coletivo_lume", p_handle: "m5_f4" }), (r) => r.ok === true);
await espera("a dona não sai da própria organização pelo 'sair'", async () => {
  await rpc(A("dona"), "rede_org_gestor_sair", { p_org: "coletivo_lume" });
  return rpc(A("dona"), "rede_org_perfil", { p_handle: "coletivo_lume" });
}, (r) => r.gerencio === true);

// O bloqueio: a organização bloqueou "bloq".
await sql("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [ORG, P.bloq]);
await espera("bloqueado: a organização não existe para ele", () => rpc(A("bloq"), "rede_org_perfil", { p_handle: "coletivo_lume" }), (r) => r === null);
await recusa("bloqueado: não liga o sininho", () => rpc(A("bloq"), "rede_org_sino", { p_handle: "coletivo_lume", p_sim: true }), "nao_encontrado");
await recusa("bloqueado: não vira gestor", () => rpc(A("dona"), "rede_org_gestor_adicionar", { p_org: "coletivo_lume", p_handle: "bloq_f4" }), "nao_encontrado");

// ── 3. "Como votamos" ──
const VOTO = { data: "2026-11-03", projeto: "PL 1234/2026 — tarifa zero", voto: "sim", porque: "Transporte é direito.", resultado: "aprovado por 31 a 18", fonte: "https://www.camara.sp.gov.br/votacao/1234" };
await recusa("visitante não registra voto", () => rpc(visitante(), "rede_org_votacao_registrar", { p_handle: "coletivo_lume", p: VOTO }), "permission denied");
await recusa("membro não registra voto da organização", () => rpc(A("m1"), "rede_org_votacao_registrar", { p_handle: "coletivo_lume", p: VOTO }), "sem_permissao");
await recusa("sem fonte pública não vale", () => rpc(A("gestora"), "rede_org_votacao_registrar", { p_handle: "coletivo_lume", p: { ...VOTO, fonte: "javascript:alert(1)" } }), "invalido:fonte");
await recusa("data no futuro não vale", () => rpc(A("gestora"), "rede_org_votacao_registrar", { p_handle: "coletivo_lume", p: { ...VOTO, data: "2099-01-01" } }), "invalido:data");
await recusa("voto fora da lista não vale", () => rpc(A("gestora"), "rede_org_votacao_registrar", { p_handle: "coletivo_lume", p: { ...VOTO, voto: "talvez" } }), "invalido:votacao");
await espera("a gestora registra o voto", () => rpc(A("gestora"), "rede_org_votacao_registrar", { p_handle: "coletivo_lume", p: VOTO }), (r) => r.id && r.voto === "sim" && r.fonte === VOTO.fonte);
await espera("o voto aparece para o visitante, com a fonte", () => rpc(visitante(), "rede_org_perfil", { p_handle: "coletivo_lume" }), (r) => r.votacoes.length === 1 && r.votacoes[0].projeto === VOTO.projeto);

// ── 4. Núcleos da organização ──
await recusa("consulta sem núcleo não abre", () => rpc(A("dona"), "rede_org_consulta_abrir", { p_handle: "coletivo_lume", p: { pergunta: "Qual pauta primeiro?", metodo: "simples", opcoes: ["A", "B"], prazo: new Date(Date.now() + 864e5).toISOString(), compromisso: "Levamos o resultado à assembleia.", quorum: null } }), "sem_nucleos");
await recusa("membro não cria núcleo", () => rpc(A("m1"), "rede_org_nucleo_criar", { p_handle: "coletivo_lume", p: { nome: "Núcleo Leste", quando: "terças, 19h", onde: "Itaquera", cor: 2 } }), "sem_permissao");
const nucleo = await espera("a dona cria um núcleo", () => rpc(A("dona"), "rede_org_nucleo_criar", { p_handle: "coletivo_lume", p: { nome: "Núcleo Leste", quando: "terças, 19h", onde: "Itaquera", cor: 2 } }), (r) => r.id);
const nucleo2 = await espera("e um segundo", () => rpc(A("dona"), "rede_org_nucleo_criar", { p_handle: "coletivo_lume", p: { nome: "Núcleo Centro", quando: "sábados, 10h", onde: "Sé", cor: 3 } }), (r) => r.id);
await recusa("cor fora de 1 a 5 não vale", () => rpc(A("dona"), "rede_org_nucleo_criar", { p_handle: "coletivo_lume", p: { nome: "Núcleo X", quando: "", onde: "", cor: 9 } }), "invalido:nucleo");
await recusa("visitante não pede para entrar", () => rpc(visitante(), "rede_org_nucleo_entrar", { p_nucleo: nucleo?.id }), "permission denied");
await recusa("bloqueado não pede para entrar", () => rpc(A("bloq"), "rede_org_nucleo_entrar", { p_nucleo: nucleo?.id }), "nao_encontrado");
for (const n of ["m1", "m2", "m3", "m4", "m5"]) {
  await espera(`${n} pede para entrar no núcleo`, () => rpc(A(n), "rede_org_nucleo_entrar", { p_nucleo: nucleo?.id }), (r) => r.pedi === true && r.sou === false);
}
await recusa("membro não vê os pedidos dos núcleos", () => rpc(A("m1"), "rede_org_nucleo_pedidos", { p_handle: "coletivo_lume" }), "sem_permissao");
await espera("a gestora vê os pedidos: só codinome e @", () => rpc(A("gestora"), "rede_org_nucleo_pedidos", { p_handle: "coletivo_lume" }), (r) => r.length === 5 && r.every((x) => Object.keys(x).sort().join() === "codinome,handle,nucleo,nucleoNome"));
for (const n of ["m1", "m2", "m3", "m4"]) await rpc(A("gestora"), "rede_org_nucleo_decidir", { p_nucleo: nucleo?.id, p_handle: `${n}_f4`, p_aceitar: true });
await espera("recusar só apaga o pedido", () => rpc(A("gestora"), "rede_org_nucleo_decidir", { p_nucleo: nucleo?.id, p_handle: "m5_f4", p_aceitar: false }), (r) => r.ok);
await espera("quem entrou se vê no núcleo; ninguém vê a lista de membros", () => rpc(A("m1"), "rede_org_perfil", { p_handle: "coletivo_lume" }), (r) => {
  const n = r.nucleos.find((x) => x.id === nucleo?.id);
  return n.sou === true && n.quando === "terças, 19h" && n.onde === "Itaquera" && n.cor === 2 && !("membros" in n) && !JSON.stringify(r).includes("m2_f4");
});
await espera("m5 (recusado) não é do núcleo e não está mais pedindo", () => rpc(A("m5"), "rede_org_perfil", { p_handle: "coletivo_lume" }), (r) => r.nucleos.find((x) => x.id === nucleo?.id)?.sou === false && r.nucleos.find((x) => x.id === nucleo?.id)?.pedi === false);

// ── 5. Consultas: voto secreto, só núcleo, quórum ──
const agora = Date.now();
const CONSULTA = { pergunta: "Qual pauta levamos à plenária?", metodo: "ranqueada", opcoes: ["Tarifa zero", "Moradia", "Creche"], prazo: new Date(agora + 2 * 864e5).toISOString(), compromisso: "A pauta vencedora abre a próxima plenária.", quorum: 4, nucleos: [] };
await recusa("membro não abre consulta", () => rpc(A("m1"), "rede_org_consulta_abrir", { p_handle: "coletivo_lume", p: CONSULTA }), "sem_permissao");
await recusa("sem compromisso escrito não abre", () => rpc(A("dona"), "rede_org_consulta_abrir", { p_handle: "coletivo_lume", p: { ...CONSULTA, compromisso: "" } }), "invalido:consulta");
await recusa("prazo curto demais não abre", () => rpc(A("dona"), "rede_org_consulta_abrir", { p_handle: "coletivo_lume", p: { ...CONSULTA, prazo: new Date(agora + 6e5).toISOString() } }), "invalido:prazo");
await recusa("uma opção só não abre", () => rpc(A("dona"), "rede_org_consulta_abrir", { p_handle: "coletivo_lume", p: { ...CONSULTA, opcoes: ["Só esta"] } }), "invalido:opcoes");
await recusa("núcleo de fora não vale", () => rpc(A("dona"), "rede_org_consulta_abrir", { p_handle: "coletivo_lume", p: { ...CONSULTA, nucleos: ["00000000-0000-0000-0000-000000000000"] } }), "invalido:nucleos");
const consulta = await espera("a dona abre a consulta ranqueada", () => rpc(A("dona"), "rede_org_consulta_abrir", { p_handle: "coletivo_lume", p: CONSULTA }), (r) => r.id);
const consulta2 = await espera("e uma simples, só para o Núcleo Centro (sem ninguém)", () => rpc(A("dona"), "rede_org_consulta_abrir", { p_handle: "coletivo_lume", p: { ...CONSULTA, metodo: "simples", quorum: null, nucleos: [nucleo2?.id] } }), (r) => r.id);
const opcoes = (await sql("select id, texto from interno.rede_consulta_opcoes where consulta = $1 order by ordem", [consulta?.id])).rows.map((r) => r.id);
const [TZ, MO, CR] = opcoes;
const verConsulta = async (quem, id = consulta?.id) => (await rpc(quem, "rede_org_perfil", { p_handle: "coletivo_lume" })).consultas.find((c) => c.id === id);
await espera("m1 (do núcleo) pode votar; o resultado e os votantes não aparecem com a consulta aberta", () => verConsulta(A("m1")), (c) => c.possoVotar === true && c.votei === false && c.votantes === null && c.quorumAtingido === null && c.opcoes.every((o) => o.proporcao === null) && c.nucleos.join() === "Núcleo Centro,Núcleo Leste");
await espera("fora (sem núcleo) não pode votar", () => verConsulta(A("fora")), (c) => c.possoVotar === false);
await espera("visitante vê a consulta, mas não pode votar", () => verConsulta(visitante()), (c) => c.possoVotar === false && c.votei === false);
await recusa("visitante não vota", () => rpc(visitante(), "rede_org_consulta_votar", { p_consulta: consulta?.id, p_ranking: [TZ] }), "permission denied");
await recusa("membro sem núcleo da organização não vota", () => rpc(A("fora"), "rede_org_consulta_votar", { p_consulta: consulta?.id, p_ranking: [TZ] }), "sem_permissao");
await recusa("a gestora (sem núcleo) também não vota", () => rpc(A("gestora"), "rede_org_consulta_votar", { p_consulta: consulta?.id, p_ranking: [TZ] }), "sem_permissao");
await recusa("bloqueado não vota", () => rpc(A("bloq"), "rede_org_consulta_votar", { p_consulta: consulta?.id, p_ranking: [TZ] }), "nao_encontrado");
await recusa("m5 (recusado no núcleo) não vota", () => rpc(A("m5"), "rede_org_consulta_votar", { p_consulta: consulta?.id, p_ranking: [TZ] }), "sem_permissao");
await recusa("m1 não vota no núcleo dos outros (consulta só do Centro)", () => rpc(A("m1"), "rede_org_consulta_votar", { p_consulta: consulta2?.id, p_ranking: [TZ] }), "sem_permissao");
await recusa("cédula com opção repetida não vale", () => rpc(A("m1"), "rede_org_consulta_votar", { p_consulta: consulta?.id, p_ranking: [TZ, TZ] }), "invalido:ranking");
await recusa("cédula com opção de outra consulta não vale", () => rpc(A("m1"), "rede_org_consulta_votar", { p_consulta: consulta?.id, p_ranking: ["00000000-0000-0000-0000-000000000001"] }), "invalido:ranking");
// m1: TZ > MO; m2: MO > TZ; m3: CR > MO; m4: TZ. Rodada 1: TZ 2, MO 1, CR 1 → CR sai (empate com MO; regra fixa); m3 vai para MO.
const cedulas = { m1: [TZ, MO], m2: [MO, TZ], m3: [CR, MO], m4: [TZ] };
for (const [n, c] of Object.entries(cedulas)) {
  await espera(`${n} vota (só volta "votei")`, () => rpc(A(n), "rede_org_consulta_votar", { p_consulta: consulta?.id, p_ranking: c }), (r) => JSON.stringify(r) === '{"votei":true}');
}
await recusa("votar duas vezes não vale", () => rpc(A("m1"), "rede_org_consulta_votar", { p_consulta: consulta?.id, p_ranking: [CR] }), "ja_votou");
await espera("depois de votar: votei, e o que votei não volta", () => verConsulta(A("m1")), (c) => c.votei === true && c.possoVotar === false && c.opcoes.every((o) => o.proporcao === null));
await espera("voto secreto por construção: a cédula não tem a pessoa, nem hora; o votante não tem a cédula", async () => {
  const col = async (t) => (await sql("select column_name from information_schema.columns where table_schema = 'interno' and table_name = $1 order by 1", [t])).rows.map((r) => r.column_name).join();
  return [await col("rede_consulta_cedulas"), await col("rede_consulta_votantes")];
}, ([c, v]) => c === "consulta,id,ranking" && v === "consulta,usuario");
// Fecha (o prazo passa).
await sql("update interno.rede_consultas set prazo = now() - interval '1 minute' where id in ($1, $2)", [consulta?.id, consulta2?.id]);
const fechada = await espera("fechada: votantes, quórum e as proporções da última rodada", () => verConsulta(visitante()), (c) => c.situacao === "fechada" && c.votantes === 4 && c.quorumAtingido === true && c.possoVotar === false);
{
  const ref = apurarRanqueada(Object.values(cedulas), opcoes);
  const props = proporcoesFinais(ref, opcoes);
  ok("a apuração do banco bate com lib/rede/org/apuracao.ts (proporções da última rodada)", fechada && fechada.opcoes.every((o) => Math.abs(o.proporcao - props[o.id]) < 1e-3));
  const ap = await um("select interno.alumia_apurar($1) a", [consulta?.id]);
  ok("o banco e a referência dão a mesma vencedora", ap.a.vencedora === ref.vencedora && ap.a.rodadas === ref.rodadas.length);
}
await espera("fechada com 0 votos: nada de número de pessoas nem proporção", () => verConsulta(A("m1"), consulta2?.id), (c) => c.situacao === "fechada" && c.votantes === null && c.opcoes.every((o) => o.proporcao === null));
await recusa("consulta fechada não recebe voto", () => rpc(A("m2"), "rede_org_consulta_votar", { p_consulta: consulta?.id, p_ranking: [TZ] }), "consulta_fechada");
{
  // Com 2 votos só, fechada: o número de pessoas e o resultado ficam escondidos (com 1 ou 2 daria para saber o voto de alguém).
  const c3 = await rpc(A("dona"), "rede_org_consulta_abrir", { p_handle: "coletivo_lume", p: { ...CONSULTA, metodo: "simples", quorum: 3 } });
  const o3 = (await sql("select id from interno.rede_consulta_opcoes where consulta = $1 order by ordem", [c3.id])).rows.map((r) => r.id);
  await rpc(A("m1"), "rede_org_consulta_votar", { p_consulta: c3.id, p_ranking: [o3[0]] });
  await rpc(A("m2"), "rede_org_consulta_votar", { p_consulta: c3.id, p_ranking: [o3[1]] });
  await recusa("na simples, cédula com mais de uma opção não vale", () => rpc(A("m3"), "rede_org_consulta_votar", { p_consulta: c3.id, p_ranking: [o3[0], o3[1]] }), "invalido:ranking");
  await sql("update interno.rede_consultas set prazo = now() - interval '1 minute' where id = $1", [c3.id]);
  await espera("fechada com 2 votos: votantes nulo, proporções nulas, quórum não atingido", () => verConsulta(A("m3"), c3.id), (c) => c.votantes === null && c.quorumAtingido === false && c.opcoes.every((o) => o.proporcao === null));
}
// IRV: o banco e a referência em casos sorteados (cédulas postas direto, como o dono do banco).
{
  let sem = 7;
  const sorte = () => ((sem = (sem * 1103515245 + 12345) % 2147483648) / 2147483648);
  let iguais = 0;
  const CASOS = 25;
  for (let k = 0; k < CASOS; k++) {
    const metodo = k % 5 === 0 ? "simples" : "ranqueada";
    const n = 2 + Math.floor(sorte() * 4);
    const cid = (await um("insert into interno.rede_consultas (org, pergunta, metodo, prazo, compromisso) values ($1, 'Caso sorteado?', $2, now() - interval '1 minute', 'Compromisso do caso sorteado.') returning id", [ORG, metodo])).id;
    const ops = [];
    for (let i = 1; i <= n; i++) ops.push((await um("insert into interno.rede_consulta_opcoes (consulta, ordem, texto) values ($1, $2, $3) returning id", [cid, i, `Opção ${i}`])).id);
    const lista = [];
    const total = Math.floor(sorte() * 12);
    for (let v = 0; v < total; v++) {
      const embaralhada = [...ops].sort(() => sorte() - 0.5);
      const c = metodo === "simples" ? embaralhada.slice(0, 1) : embaralhada.slice(0, 1 + Math.floor(sorte() * n));
      lista.push(c);
      await sql("insert into interno.rede_consulta_cedulas (consulta, ranking) values ($1, $2::uuid[])", [cid, `{${c.join(",")}}`]);
    }
    const ref = metodo === "simples" ? apurarSimples(lista, ops) : apurarRanqueada(lista, ops);
    const props = proporcoesFinais(ref, ops);
    const ap = (await um("select interno.alumia_apurar($1) a", [cid])).a;
    if (ap.vencedora === ref.vencedora && ap.cedulas === ref.cedulas && ops.every((o) => Math.abs(Number(ap.proporcoes[o]) - props[o]) < 1e-9)) iguais++;
    else falhas.push(`IRV sorteado ${k} (${metodo}): banco ${JSON.stringify(ap)} × referência ${JSON.stringify({ v: ref.vencedora, props })}`);
  }
  ok(`IRV: ${CASOS} casos sorteados iguais à referência`, iguais === CASOS);
  await sql("delete from interno.rede_consultas where pergunta = 'Caso sorteado?'");
}

// ── 6. Plenárias: fila por ordem de chegada que não reordena ──
const PLEN = { titulo: "Plenária da tarifa zero", descricao: "Aberta a quem é da Rede.", inicio: new Date(agora + 36e5).toISOString(), sala: "https://www.youtube.com/watch?v=abc" };
await recusa("membro não marca plenária", () => rpc(A("m1"), "rede_org_plenaria_abrir", { p_handle: "coletivo_lume", p: PLEN }), "sem_permissao");
await recusa("sala que não é https não vale", () => rpc(A("gestora"), "rede_org_plenaria_abrir", { p_handle: "coletivo_lume", p: { ...PLEN, sala: "javascript:alert(1)" } }), "invalido:plenaria");
const plen = await espera("a gestora marca a plenária", () => rpc(A("gestora"), "rede_org_plenaria_abrir", { p_handle: "coletivo_lume", p: PLEN }), (r) => r.id);
const verPlen = async (quem) => (await rpc(quem, "rede_org_perfil", { p_handle: "coletivo_lume" })).plenarias.find((p) => p.id === plen?.id);
await espera("marcada: a sala ainda não aparece", () => verPlen(A("m1")), (p) => p.aoVivo === false && p.sala === null && p.naSala === null && p.naFila === 0);
await recusa("visitante não pergunta", () => rpc(visitante(), "rede_org_plenaria_perguntar", { p_plenaria: plen?.id, p_texto: "Oi?", p_mostrar: false }), "permission denied");
await recusa("bloqueado não pergunta", () => rpc(A("bloq"), "rede_org_plenaria_perguntar", { p_plenaria: plen?.id, p_texto: "Posso?", p_mostrar: true }), "nao_encontrado");
await recusa("menor de 18 não pergunta", () => rpc(A("menor"), "rede_org_plenaria_perguntar", { p_plenaria: plen?.id, p_texto: "Posso?", p_mostrar: true }), "confirme_idade");
const ordem = [["m3", true, "Primeira: e a tarifa nos fins de semana?"], ["m1", false, "Segunda: quem paga a conta?"], ["fora", true, "Terceira: como ajudar sem núcleo?"], ["m2", false, "Quarta: e o metrô?"]];
for (const [n, mostrar, texto] of ordem) {
  await espera(`${n} pergunta (entra no fim)`, () => rpc(A(n), "rede_org_plenaria_perguntar", { p_plenaria: plen?.id, p_texto: texto, p_mostrar: mostrar }), (r) => r.ok && r.naFila >= 1);
}
await recusa("uma pergunta por pessoa", () => rpc(A("m1"), "rede_org_plenaria_perguntar", { p_plenaria: plen?.id, p_texto: "De novo!", p_mostrar: false }), "ja_perguntou");
await espera("a fila vem na ordem de chegada; o @ só de quem quis", () => verPlen(A("m5")), (p) =>
  p.fila.map((q) => q.texto).join("|") === ordem.map((o) => o[2]).join("|") && p.fila[0].handle === "m3_f4" && p.fila[1].handle === null && p.fila[2].handle === "fora_f4" && p.naFila === 4 && p.pergunteiEu === false);
await espera("eu vejo que já perguntei", () => verPlen(A("m1")), (p) => p.pergunteiEu === true);
await espera("visitante não vê a fila, só quantas perguntas esperam", () => verPlen(visitante()), (p) => p.fila.length === 0 && p.naFila === 4);
await recusa("ninguém reordena a fila, nem o dono do banco", () => sql("update interno.rede_plenaria_perguntas set criado_em = now() - interval '1 day' where texto like 'Quarta%'"), "fila_fixa");
await recusa("nem troca o texto", () => sql("update interno.rede_plenaria_perguntas set texto = 'outra' where texto like 'Quarta%'"), "fila_fixa");
const ids = (await sql("select id from interno.rede_plenaria_perguntas where plenaria = $1 order by seq", [plen?.id])).rows.map((r) => r.id);
await recusa("membro não marca pergunta como respondida", () => rpc(A("m1"), "rede_org_plenaria_responder", { p_pergunta: ids[0] }), "sem_permissao");
await espera("a gestora marca a segunda como respondida", () => rpc(A("gestora"), "rede_org_plenaria_responder", { p_pergunta: ids[1] }), (r) => r.ok);
await recusa("tirar da fila só por regra escrita", () => rpc(A("gestora"), "rede_org_plenaria_retirar", { p_pergunta: ids[2], p_motivo: "nao_gostei" }), "invalido:motivo");
await espera("tirar por dado pessoal (com registro)", () => rpc(A("gestora"), "rede_org_plenaria_retirar", { p_pergunta: ids[2], p_motivo: "dado_pessoal" }), (r) => r.ok);
await espera("o registro leva a organização e o motivo, não quem do time tirou", () => um("select quem, detalhes from interno.auditoria where acao = 'alumia_pergunta_retirar' order by id desc limit 1"), (r) => r.quem === ORG && r.detalhes.motivo === "dado_pessoal");
await espera("a ordem continua a mesma; a respondida fica no lugar, a retirada sai", () => verPlen(A("m5")), (p) =>
  p.fila.map((q) => q.texto[0]).join("") === "PSQ" && p.fila[1].respondida === true && p.naFila === 2);
// Ao vivo.
await espera("visitante: nada ao vivo ainda", () => rpc(visitante(), "rede_org_ao_vivo"), (r) => r.length === 0);
await recusa("membro não põe no ar", () => rpc(A("m1"), "rede_org_plenaria_mudar", { p_id: plen?.id, p_situacao: "ao_vivo" }), "sem_permissao");
await espera("a gestora põe no ar", () => rpc(A("gestora"), "rede_org_plenaria_mudar", { p_id: plen?.id, p_situacao: "ao_vivo" }), (r) => r.ok);
await espera("Ao vivo agora: aparece ao visitante (organização com selo), sem fila", () => rpc(visitante(), "rede_org_ao_vivo"), (r) => r.length === 1 && r[0].aoVivo && r[0].sala === PLEN.sala && !("fila" in r[0]) && r[0].org.handle === "coletivo_lume");
await espera("Ao vivo agora: o bloqueado não vê", () => rpc(A("bloq"), "rede_org_ao_vivo"), (r) => r.length === 0);
await espera("encerrar", () => rpc(A("gestora"), "rede_org_plenaria_mudar", { p_id: plen?.id, p_situacao: "encerrada" }), (r) => r.ok);
await recusa("encerrada não volta nem recebe pergunta", () => rpc(A("m4"), "rede_org_plenaria_perguntar", { p_plenaria: plen?.id, p_texto: "Atrasada?", p_mostrar: false }), "plenaria_encerrada");

// ── 7. O sininho ──
await recusa("visitante não liga o sininho", () => rpc(visitante(), "rede_org_sino", { p_handle: "coletivo_lume", p_sim: true }), "permission denied");
await espera("m1 liga o sininho (só sobre si)", () => rpc(A("m1"), "rede_org_sino", { p_handle: "coletivo_lume", p_sim: true }), (r) => r.sino === true);
await espera("o perfil diz que eu liguei; ninguém mais sabe", async () => [await rpc(A("m1"), "rede_org_perfil", { p_handle: "coletivo_lume" }), await rpc(A("dona"), "rede_org_perfil", { p_handle: "coletivo_lume" })], ([a, b]) => a.sino === true && b.sino === false);
await espera("a organização posta e quem ligou o sininho recebe o aviso (sem trecho do post)", async () => {
  await sql("insert into interno.rede_posts (autor, texto) values ($1, 'Plenária amanhã!')", [ORG]);
  return um("select count(*)::int n, max(texto) t from interno.avisos where para = $1 and texto like '%publicou na Alumia%'", [P.m1]);
}, (r) => r.n === 1 && !r.t.includes("amanhã"));
await espera("quem não ligou não recebe", () => um("select count(*)::int n from interno.avisos where para = $1 and texto like '%publicou na Alumia%'", [P.m2]), (r) => r.n === 0);
await espera("desligar", () => rpc(A("m1"), "rede_org_sino", { p_handle: "coletivo_lume", p_sim: false }), (r) => r.sino === false);

// ── 8. Extras do perfil ──
await espera("editar status, pronomes e campos", () => rpc(A("m2"), "rede_perfil_extras_editar", { p: { status: { tipo: "greve", texto: "Em greve até sexta", horas: 48 }, pronomes: "ela/dela", campos: [{ rotulo: "Sindicato", valor: "Apeoesp" }] } }), (r) => r.status.tipo === "greve" && r.pronomes === "ela/dela" && r.campos.length === 1);
await recusa("mais de 4 campos não vale", () => rpc(A("m2"), "rede_perfil_extras_editar", { p: { campos: Array(5).fill({ rotulo: "a", valor: "b" }) } }), "invalido:campos");
await recusa("status fora da lista não vale", () => rpc(A("m2"), "rede_perfil_extras_editar", { p: { status: { tipo: "festa", texto: "", horas: 2 } } }), "invalido:status");
await espera("outro membro lê os extras", () => rpc(A("m1"), "rede_perfil_extras", { p_handle: "m2_f4" }), (r) => r.pronomes === "ela/dela");
await espera("visitante não lê extras de pessoa", () => rpc(visitante(), "rede_perfil_extras", { p_handle: "m2_f4" }), (r) => r === null);
await sql("update interno.perfis set rede_status_ate = now() - interval '1 minute' where id = $1", [P.m2]);
await espera("o status some quando vence", () => rpc(A("m1"), "rede_perfil_extras", { p_handle: "m2_f4" }), (r) => r.status === null);

// ── 9. Tirar o selo ──
await recusa("membro não tira o selo", () => rpc(A("m1"), "rede_org_selo_tirar", { p_handle: "coletivo_lume", p_motivo: "motivo comprido o bastante" }), "sem_permissao");
await recusa("tirar o selo pede motivo", () => rpc(EQUIPE, "rede_org_selo_tirar", { p_handle: "coletivo_lume", p_motivo: "curto" }), "invalido:motivo");
await espera("a coordenação tira o selo, com motivo registrado", () => rpc(EQUIPE, "rede_org_selo_tirar", { p_handle: "coletivo_lume", p_motivo: "Documento vencido na fonte oficial." }), (r) => r.ok);
await espera("sem selo, o visitante não vê mais a organização", () => rpc(visitante(), "rede_org_perfil", { p_handle: "coletivo_lume" }), (r) => r === null);
await espera("e a dona pode pedir de novo (a organização já existe: direto na fila)", () => rpc(A("dona"), "rede_org_pedir_selo", { p: PEDIDO }), (r) => r.situacao === "esperando" && r.id);

// ── 10. Limites e permissões ──
await recusa("limite de uso: o sininho para depois de 60 em uma hora", async () => {
  for (let i = 0; i < 62; i++) await rpc(A("m3"), "rede_org_sino", { p_handle: "coletivo_lume", p_sim: i % 2 === 0 });
}, "muitos_pedidos");
await recusa("ninguém logado lê as tabelas novas", () => banco.exclusivo(async () => {
  await banco.pg.exec("set role authenticated");
  try {
    return await banco.pg.query("select * from interno.rede_consulta_cedulas");
  } finally {
    await banco.pg.exec("reset role");
  }
}), "permission denied");
await espera("RLS ligada em todas as tabelas novas e nenhuma permissão para anon/authenticated", async () =>
  (await sql(`select c.relname, c.relrowsecurity, has_table_privilege('authenticated', c.oid, 'select') a, has_table_privilege('anon', c.oid, 'select') b
              from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relname in
              ('rede_orgs','rede_org_gestores','rede_org_pedidos','rede_org_votacoes','rede_org_nucleo_pedidos','rede_consultas','rede_consulta_opcoes',
               'rede_consulta_votantes','rede_consulta_cedulas','rede_plenarias','rede_plenaria_perguntas','rede_org_sinos','rede_perfil_campos')`)).rows,
  (rows) => rows.length === 13 && rows.every((r) => r.relrowsecurity && !r.a && !r.b));
await espera("toda função nova é security definer com search_path = interno, pg_temp", async () =>
  (await sql(`select p.proname, p.prosecdef, array_to_string(p.proconfig, ',') cfg from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and (p.proname like 'rede_org_%' or p.proname like 'rede_perfil_extras%')`)).rows,
  (rows) => rows.length >= 24 && rows.every((r) => r.prosecdef && r.cfg.includes("search_path=interno, pg_temp")));
await espera("o visitante só executa as funções de leitura", async () =>
  (await sql(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and (p.proname like 'rede_org_%' or p.proname like 'rede_perfil_extras%') and has_function_privilege('anon', p.oid, 'execute') order by 1`)).rows.map((r) => r.proname).join(),
  (s) => s === "rede_org_ao_vivo,rede_org_perfil,rede_perfil_extras");

// ── 11. O cliente: pedir o selo chama o servidor só quando precisa de conta nova ──
{
  const chamadas = [];
  const servidor = [];
  const cliente = (resposta) =>
    criarClienteOrg(async (f, a) => (chamadas.push([f, a]), resposta), () => false, async (p) => (servidor.push(p.handle), { id: "novo", situacao: "esperando" }));
  await espera("@ livre: o cliente manda ao servidor criar a conta", () => cliente({ criar: true, dono: "x" }).pedirSelo(PEDIDO), (r) => r.id === "novo" && servidor.length === 1);
  await espera("organização que já gerencio: direto na fila, sem servidor", () => cliente({ id: "p1", situacao: "esperando" }).pedirSelo(PEDIDO), (r) => r.id === "p1" && servidor.length === 1);
  ok("o cliente chama rede_org_pedir_selo com o pedido", chamadas.every(([f, a]) => f === "rede_org_pedir_selo" && a.p.handle === PEDIDO.handle));
}
// A rota do servidor: atrás das flags, confere o token e pega o dono da resposta do banco (nunca do corpo).
{
  const rota = ler("app/api/rede/org/selo/route.ts");
  ok("a rota responde 404 com as flags desligadas", /if \(!alumia2Ligada\(\) \|\| !ligado\("alumia-org"\)\) return resposta\(\{ erro: "nao_encontrado" \}, 404\)/.test(rota));
  ok("a rota usa o dono que o banco devolveu, não o do corpo", /dono: r\.dado\.dono/.test(rota) && !/p\.dono|json\.dono/.test(rota));
  ok("a rota apaga a conta se rede_org_criar falhar", /admin\/users\/\$\{conta\.id\}/.test(rota));
  const painel = ler("components/painel/casca/Dentro.tsx");
  ok("o painel lista a fila do selo só com a flag e para a coordenação", /id: "rede-organizacoes"[^}]*can\(eu, "coordenacao", "vice"\) && orgLigada\(\)/.test(painel) && /atual\.id === "rede-organizacoes" && <RedeOrganizacoes \/>/.test(painel));
}

await banco.pg.close?.();
if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s) (${certos} certos):\n- ${falhas.join("\n- ")}`);
  process.exit(1);
}
console.log(`✓ Alumia F4 (back-end): ${certos} conferências certas.`);
