// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os votos que não podem deixar a pessoa ligada ao voto no banco (supabase/migracoes/20261115-alumia-o9-resto8.sql):
//   POST, com a sessão no cabeçalho Authorization, {tipo, ...}
//     tipo "equipe"      {votacao, opcao}     → {ok}                 o voto secreto da equipe
//     tipo "equipe_ver"  {votacoes: [ids]}    → {votei: [ids]}       em quais destas votações secretas a pessoa já votou
//     tipo "enquete"     {post, opcoes: [ids]} → a enquete com os totais
//     tipo "story"       {story, opcao}       → a figurinha da enquete
//     tipo "bem_estar"   {nivel}              → {ok}                 o termômetro da semana (nivel nulo: só pergunta)
// O servidor confere a sessão, calcula a marca da pessoa (HMAC com ALUMIA_VOTO_SEGREDO, lib/rede/voto/servidor.ts) e chama o banco
// com a chave de serviço. O banco grava a marca, nunca a pessoa. O freio é daqui, na memória do processo (uma linha de freio no
// banco, com o id da pessoa, na mesma transação do voto, ligaria um ao outro). Nada vai a log.
import { contaDoToken, criarFreio, deOutraOrigem, resposta, rpcDeServico } from "@/lib/rede/convites/servidor";
import { marcaDoBemEstar, marcaDoVoto, segredoDoVoto, semanaDeSaoPaulo } from "@/lib/rede/voto/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const freioDaConta = criarFreio(60, 10 * 60_000);
const ehId = (x: unknown): x is string => typeof x === "string" && UUID.test(x);

/** O erro do banco que a tela entende passa; o resto vira "falha". */
const CODIGOS = new Set(["ja_votou", "encerrada", "sem_permissao", "nao_encontrado", "invalido:opcao", "invalido:opcoes", "confirme_idade", "consentimento", "invalido:semana", "invalido:nivel", "conta_suspensa"]);

export async function POST(pedido: Request) {
  if (deOutraOrigem(pedido)) return resposta({ ok: false, motivo: "origem" }, 403);
  const segredo = segredoDoVoto();
  if (!segredo) return resposta({ ok: false, motivo: "sem_servico" }, 503);
  const conta = await contaDoToken(pedido);
  if (conta === "sem_conexao") return resposta({ ok: false, motivo: "sem_conexao" }, 502);
  if (!conta) return resposta({ ok: false, motivo: "entre_primeiro" }, 401);
  if (!freioDaConta(conta.id)) return resposta({ ok: false, motivo: "muitos_pedidos" }, 429);

  const c = (await pedido.json().catch(() => null)) as Record<string, unknown> | null;
  const tipo = c?.tipo;
  let funcao = "";
  let args: Record<string, unknown> = {};
  if (tipo === "equipe" && ehId(c?.votacao) && Number.isInteger(c?.opcao)) {
    funcao = "alumia_voto_equipe";
    args = { p_usuario: conta.id, p_votacao: c.votacao, p_opcao: c.opcao, p_marca: marcaDoVoto(segredo, "equipe", c.votacao, conta.id) };
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
  } else if (tipo === "bem_estar" && (c?.nivel === null || c?.nivel === undefined || (Number.isInteger(c?.nivel) && Number(c?.nivel) >= 1 && Number(c?.nivel) <= 5))) {
    const semana = semanaDeSaoPaulo();
    funcao = "alumia_cuidado_bem_estar";
    args = { p_usuario: conta.id, p_semana: semana, p_marca: marcaDoBemEstar(segredo, semana, conta.id), p_nivel: c?.nivel ?? null };
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
