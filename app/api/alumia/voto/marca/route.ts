// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os votos que não podem deixar a pessoa ligada ao voto no banco (supabase/migracoes/20261115-alumia-o9-resto8.sql e
// 20261124-r2-voto.sql):
//   POST, com a sessão no cabeçalho Authorization, {tipo, ...}
//     tipo "equipe"      {votacao, cedula}    → {ok}                 o voto secreto da equipe, CIFRADO no aparelho para a chave
//                                                                    das guardiãs (lib/rede/voto/urna.ts): o servidor não o abre
//     tipo "equipe_ver"  {votacoes: [ids]}    → {votei: [ids]}       em quais destas votações secretas a pessoa já votou
//     tipo "enquete"     {post, opcoes: [ids]} → a enquete com os totais
//     tipo "story"       {story, opcao}       → a figurinha da enquete
//     tipo "teste"       {story, opcao}       → a figurinha do teste com resposta certa, com a certa (P5, A16)
//     tipo "bem_estar"   {nivel}              → {ok}                 o termômetro da semana (nivel nulo: só pergunta)
//     tipo "critica"     {texto, para}        → {ok}                 a caixa de críticas anônimas da equipe (sem marca nenhuma:
//                                                                    uma chamada confere a pessoa; o texto vai a uma fila e é
//                                                                    gravado depois, em lote embaralhado: lib/rede/voto/critica.ts)
//     tipo "pouco_util"  {post, sim}          → {eu}                 o "pouco útil" numa resposta (Prompt 4, item 132, atrás de
//                                                                    "alumia-p4-pontes"): o banco não tem o segredo da marca
//     tipo "pouco_util_ver" {posts: [ids]}    → [ids]                em quais destas respostas a pessoa marcou "pouco útil"
//     tipo "pressao"     {pressao, sim}       → {eu, comunidade}     o "mandei" da pressão em parlamentar (Prompt 4, item 89, atrás
//                                                                    de "alumia-p4-coletiva"): o banco não tem o segredo da marca
//     tipo "pressao_ver" {pressoes: [ids]}    → [ids]                em quais destas pressões a pessoa marcou "mandei"
// O servidor confere a sessão, calcula a marca da pessoa (HMAC com ALUMIA_VOTO_SEGREDO, lib/rede/voto/servidor.ts) e chama o banco
// com a chave de serviço. O banco grava a marca, nunca a pessoa. O freio é daqui, na memória do processo (uma linha de freio no
// banco, com o id da pessoa, na mesma transação do voto, ligaria um ao outro). Nada vai a log.
import { contaDoToken, criarFreio, deOutraOrigem, resposta, rpcDeServico } from "@/lib/rede/convites/servidor";
import { criarCotaDaCritica, criarFilaDaCritica } from "@/lib/rede/voto/critica";
import { marcaDoBemEstar, marcaDoVoto, segredoDoVoto, semanaDeSaoPaulo } from "@/lib/rede/voto/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const freioDaConta = criarFreio(60, 10 * 60_000);
// Ler o próprio "pouco útil" (ou o próprio "mandei" das pressões) acontece a cada vez que a lista aparece na tela: freio à parte,
// mais largo, para não gastar o do voto.
const freioDaLeitura = criarFreio(600, 10 * 60_000);
// A caixa de críticas anônimas da equipe: três por dia por pessoa, contadas só aqui por uma chave opaca (sem a pessoa nem a hora), e
// gravadas depois, em lote embaralhado (o banco não guarda quem mandou, e a hora da gravação não é a do pedido).
const cotaDaCritica = criarCotaDaCritica(3);
const filaDaCritica = criarFilaDaCritica({ gravar: async (c) => (await rpcDeServico<unknown>("alumia_cuidado_critica", { p_texto: c.texto, p_para: c.para })).ok });
const ehId = (x: unknown): x is string => typeof x === "string" && UUID.test(x);
// A cédula v2 (lib/rede/voto/limiar.ts): "v2." e 2230 letras de base64url. O servidor só confere o formato; abrir, não abre.
const CEDULA = /^v2\.[A-Za-z0-9_-]{2230}$/;

/** O erro do banco que a tela entende passa; o resto vira "falha". */
const CODIGOS = new Set(["ja_votou", "encerrada", "sem_chave", "invalido:cedula", "cedula_repetida", "sem_permissao", "nao_encontrado", "invalido:opcao", "invalido:opcoes", "confirme_idade", "consentimento", "invalido:semana", "invalido:nivel", "conta_suspensa",
  "desligado", "invalido:propria", "confirme_codinome", "invalido:marca"]);

export async function POST(pedido: Request) {
  if (deOutraOrigem(pedido)) return resposta({ ok: false, motivo: "origem" }, 403);
  const segredo = segredoDoVoto();
  if (!segredo) return resposta({ ok: false, motivo: "sem_servico" }, 503);
  const conta = await contaDoToken(pedido);
  if (conta === "sem_conexao") return resposta({ ok: false, motivo: "sem_conexao" }, 502);
  if (!conta) return resposta({ ok: false, motivo: "entre_primeiro" }, 401);

  const c = (await pedido.json().catch(() => null)) as Record<string, unknown> | null;
  const tipo = c?.tipo;
  // A crítica não passa pelo freio geral (ele guarda a hora de cada pedido com a pessoa): tem a cota dela, sem pessoa nem hora.
  if (tipo === "critica") return critica(segredo, conta.id, c?.texto, c?.para);
  if (!(tipo === "pouco_util_ver" || tipo === "pressao_ver" ? freioDaLeitura : freioDaConta)(conta.id)) return resposta({ ok: false, motivo: "muitos_pedidos" }, 429);
  let funcao = "";
  let args: Record<string, unknown> = {};
  if (tipo === "equipe" && ehId(c?.votacao) && typeof c?.cedula === "string" && CEDULA.test(c.cedula)) {
    funcao = "alumia_voto_equipe_cifrada";
    args = { p_usuario: conta.id, p_votacao: c.votacao, p_cedula: c.cedula, p_marca: marcaDoVoto(segredo, "equipe", c.votacao, conta.id) };
  } else if (tipo === "equipe_ver" && Array.isArray(c?.votacoes)) {
    const ids = c.votacoes.filter(ehId).slice(0, 50);
    funcao = "alumia_voto_equipe_votei";
    args = { p_usuario: conta.id, p_marcas: Object.fromEntries(ids.map((id) => [id, marcaDoVoto(segredo, "equipe", id, conta.id)])) };
  } else if (tipo === "enquete" && ehId(c?.post) && Array.isArray(c?.opcoes) && c.opcoes.length >= 1 && c.opcoes.length <= 6 && c.opcoes.every(ehId)) {
    funcao = "alumia_voto_enquete";
    args = { p_usuario: conta.id, p_post: c.post, p_opcoes: c.opcoes, p_marca: marcaDoVoto(segredo, "enquete", c.post, conta.id) };
  } else if (tipo === "story" && ehId(c?.story) && (c?.opcao === 0 || c?.opcao === 1)) {
    funcao = "alumia_voto_story";
    args = { p_usuario: conta.id, p_story: c.story, p_opcao: c.opcao, p_marca: marcaDoVoto(segredo, "story", c.story, conta.id) };
  } else if (tipo === "teste" && ehId(c?.story) && Number.isInteger(c?.opcao) && Number(c?.opcao) >= 0 && Number(c?.opcao) <= 3) {
    funcao = "alumia_teste_story";
    args = { p_usuario: conta.id, p_story: c.story, p_opcao: c.opcao, p_marca: marcaDoVoto(segredo, "teste", c.story, conta.id) };
  } else if (tipo === "bem_estar" && (c?.nivel === null || c?.nivel === undefined || (Number.isInteger(c?.nivel) && Number(c?.nivel) >= 1 && Number(c?.nivel) <= 5))) {
    const semana = semanaDeSaoPaulo();
    funcao = "alumia_cuidado_bem_estar";
    args = { p_usuario: conta.id, p_semana: semana, p_marca: marcaDoBemEstar(segredo, semana, conta.id), p_nivel: c?.nivel ?? null };
  } else if (tipo === "pouco_util" && ehId(c?.post) && typeof c?.sim === "boolean") {
    funcao = "rede_p4_pouco_util";
    args = { p_usuario: conta.id, p_post: c.post, p_sim: c.sim, p_marca: marcaDoVoto(segredo, "pouco_util", c.post, conta.id) };
  } else if (tipo === "pouco_util_ver" && Array.isArray(c?.posts)) {
    const ids = [...new Set(c.posts.filter(ehId))].slice(0, 400);
    funcao = "rede_p4_pouco_util_meus";
    args = { p_marcas: Object.fromEntries(ids.map((id) => [id, marcaDoVoto(segredo, "pouco_util", id, conta.id)])) };
  } else if (tipo === "pressao" && ehId(c?.pressao) && typeof c?.sim === "boolean") {
    funcao = "rede_p4_pressao_mandei";
    args = { p_usuario: conta.id, p_id: c.pressao, p_sim: c.sim, p_marca: marcaDoVoto(segredo, "pressao", c.pressao, conta.id) };
  } else if (tipo === "pressao_ver" && Array.isArray(c?.pressoes)) {
    const ids = [...new Set(c.pressoes.filter(ehId))].slice(0, 100);
    funcao = "rede_p4_pressao_minhas";
    args = { p_marcas: Object.fromEntries(ids.map((id) => [id, marcaDoVoto(segredo, "pressao", id, conta.id)])) };
  } else {
    return resposta({ ok: false, motivo: "invalido" }, 400);
  }

  const r = await rpcDeServico<unknown>(funcao, args);
  if (!r.ok) {
    if (r.status === 0) return resposta({ ok: false, motivo: "sem_servico" }, 503);
    if (r.status === 404) return resposta({ ok: false, motivo: "banco_desatualizado" }, 503);
    return resposta({ ok: false, motivo: CODIGOS.has(r.codigo) ? r.codigo : "falha" }, 400);
  }
  if (tipo === "equipe_ver") return resposta({ ok: true, votei: Array.isArray(r.dado) ? r.dado : [] });
  return resposta({ ok: true, dado: r.dado });
}

/**
 * A crítica anônima da equipe: confere a pessoa (é da equipe, sem suspensão) e põe só o texto e o destino na fila, que grava depois,
 * em lote embaralhado e sem a pessoa. A cota de três por dia fica aqui, na memória do processo, sem a pessoa nem a hora.
 */
async function critica(segredo: string, conta: string, texto: unknown, para: unknown) {
  const t = typeof texto === "string" ? texto.trim() : "";
  const p = typeof para === "string" && para ? para : "geral";
  if (t.length < 10 || t.length > 2000 || !/^[a-z_]{2,30}$/.test(p)) return resposta({ ok: false, motivo: "invalido" }, 400);
  const pode = await rpcDeServico<boolean>("alumia_cuidado_pode_criticar", { p_usuario: conta });
  if (!pode.ok) return resposta({ ok: false, motivo: pode.status === 0 ? "sem_servico" : pode.status === 404 ? "banco_desatualizado" : "falha" }, pode.status === 0 || pode.status === 404 ? 503 : 400);
  if (pode.dado !== true) return resposta({ ok: false, motivo: "sem_permissao" }, 403);
  if (!cotaDaCritica(segredo, conta)) return resposta({ ok: false, motivo: "muitos_pedidos" }, 429);
  if (!filaDaCritica.por({ texto: t, para: p })) return resposta({ ok: false, motivo: "sem_servico" }, 503);
  return resposta({ ok: true, dado: { ok: true, na_fila: true } });
}
