// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A denúncia com prova (message franking, lib/rede/franquia/protocolo.ts):
//   POST, com a sessão de quem denuncia no cabeçalho Authorization, {categoria, autor (ou post), post?, texto?, trechos: [{texto, prova}]}
//     → {ok, protocolo, prioridade, ja}
// Os trechos são o que quem denunciou escolheu tirar do cifrado (a tela avisa antes). Para cada um, o servidor confere com o segredo
// da franquia que o texto está dentro de uma mensagem que passou por aquela caixa naquele dia, depositada com o passe que a conta
// denunciada DECLAROU seu (a declaração Ed25519 é conferida contra as identidades da conta no registro público das chaves, que o
// banco devolve por public.rede_franquia_autoria). Prova que não confere recusa a denúncia inteira (prova_nao_confere): o aparelho
// não manda trecho reescrito como se fosse prova, e ninguém atribui a outra conta um texto que ela não depositou.
// Depois, o banco (com a chave de serviço) grava só o texto, o dia e a origem de cada trecho; a caixa, a marca, a chave e o conteúdo
// inteiro saem da memória ao fim do pedido. Nada vai a log; nenhum endereço de rede é lido. A sessão aqui é a de quem DENUNCIA (a
// denúncia é dela, como qualquer denúncia da Alumia); a rota nunca chama as caixas, então a conta não se liga a caixa nenhuma no banco.
// Onda R3 (o chat separado, item 3.1): com ALUMIA_CHAT_INTERNO e CHAT_INTERFACE_TOKEN, o segredo da franquia é do servidor do chat e a
// rota pergunta a ele se cada marca confere (lib/rede/caixas/franquia-servidor.ts); o resto da conferência (autoria, compromisso,
// trecho) continua aqui. O servidor do chat não fica sabendo quem denunciou nem quem foi denunciado (só recebe marcas e resumos).
import { contaDoToken, criarFreio, deOutraOrigem, resposta, rpcDeServico } from "@/lib/rede/convites/servidor";
import { TRECHOS_POR_DENUNCIA, type TrechoComProva } from "@/lib/rede/franquia/protocolo";
import { deB64 } from "@/lib/rede/franquia/protocolo";
import { chatSeparado, conferirMarcasNoChat, type MarcaAConferir, nomeDaMarca } from "@/lib/rede/caixas/franquia-servidor";
import { type AutoriaNoRegistro, conferirTrecho, type MarcaConfere, segredoDaFranquia } from "@/lib/rede/franquia/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** O maior corpo aceito: 10 trechos com a mensagem inteira de cada um (até 128 KiB de conteúdo, em base64url). */
const MAIOR_CORPO = 1_800_000;
const freioDaConta = criarFreio(10, 60 * 60_000);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CODIGOS = new Set(["sem_permissao", "invalido:categoria", "invalido:prova", "invalido:alvo", "invalido:texto", "nao_encontrado", "muitos_pedidos", "consentimento", "conta_suspensa", "area_interditada"]);

export async function POST(pedido: Request) {
  if (deOutraOrigem(pedido)) return resposta({ ok: false, motivo: "origem" }, 403);
  const chat = chatSeparado();
  const segredo = chat ? "" : segredoDaFranquia();
  if (segredo === null) return resposta({ ok: false, motivo: "sem_servico" }, 503);
  const tamanho = Number(pedido.headers.get("content-length") ?? "0");
  if (!Number.isFinite(tamanho) || tamanho > MAIOR_CORPO) return resposta({ ok: false, motivo: "grande_demais" }, 413);
  const conta = await contaDoToken(pedido);
  if (conta === "sem_conexao") return resposta({ ok: false, motivo: "sem_conexao" }, 502);
  if (!conta) return resposta({ ok: false, motivo: "entre_primeiro" }, 401);
  if (!freioDaConta(conta.id)) return resposta({ ok: false, motivo: "muitos_pedidos" }, 429);

  const bruto = await pedido.text().catch(() => "");
  if (bruto.length > MAIOR_CORPO) return resposta({ ok: false, motivo: "grande_demais" }, 413);
  let c: Record<string, unknown> | null = null;
  try {
    c = JSON.parse(bruto) as Record<string, unknown>;
  } catch {
    c = null;
  }
  const autor = typeof c?.autor === "string" ? c.autor.trim().replace(/^@/, "").toLowerCase() : "";
  const post = c?.post === undefined || c?.post === null || c?.post === "" ? null : c.post;
  const trechos = Array.isArray(c?.trechos) ? (c.trechos as TrechoComProva[]) : [];
  // O @ de quem escreveu: obrigatório, menos na denúncia de post (aí o banco tira o autor do próprio post).
  const autorOk = post !== null && autor === "" ? true : /^[a-z0-9_]{3,20}$/.test(autor);
  if (!c || typeof c.categoria !== "string" || !autorOk || (post !== null && (typeof post !== "string" || !UUID.test(post)))
    || trechos.length < 1 || trechos.length > TRECHOS_POR_DENUNCIA || (c.texto !== undefined && typeof c.texto !== "string")) {
    return resposta({ ok: false, motivo: "invalido" }, 400);
  }

  // A autoria: as identidades da conta denunciada no registro público. Denúncia de post (sem @) não tem declaração: não sai com prova.
  let autoria: AutoriaNoRegistro | null = null;
  if (autor !== "") {
    const a = await rpcDeServico<{ conta: string; identidades: string[] } | null>("rede_franquia_autoria", { p_autor: autor });
    if (!a.ok) {
      if (a.status === 0) return resposta({ ok: false, motivo: "sem_servico" }, 503);
      if (a.status === 404) return resposta({ ok: false, motivo: "banco_desatualizado" }, 503);
      return resposta({ ok: false, motivo: "falha" }, 400);
    }
    const ids = Array.isArray(a.dado?.identidades) ? a.dado.identidades.map((x) => deB64(x, 32)).filter((x): x is Uint8Array => x !== null) : [];
    if (a.dado && typeof a.dado.conta === "string" && ids.length) autoria = { conta: a.dado.conta, identidades: ids };
  }

  // No modo separado, as marcas vão ao servidor do chat numa pergunta só (sem nada da conta); a resposta entra na conferência.
  let marcaConfere: MarcaConfere | undefined;
  if (chat) {
    const marcas: MarcaAConferir[] = [];
    for (const t of trechos) {
      const p = t?.prova;
      const c = deB64(p?.c, 32), idH = deB64(p?.caixa, 32), pdH = deB64(p?.pd_h, 32), marca = deB64(p?.marca, 32);
      if (c && idH && pdH && marca && typeof p?.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.dia)) marcas.push({ c, idH, pdH, dia: p.dia, marca });
    }
    const certas = marcas.length ? await conferirMarcasNoChat(marcas, chat) : new Set<string>();
    if (!certas) return resposta({ ok: false, motivo: "sem_servico" }, 503);
    marcaConfere = (c, idH, pdH, dia, marca) => certas.has(nomeDaMarca({ c, idH, pdH, dia, marca }));
  }

  const conferidos: { texto: string; dia: string; origem: string }[] = [];
  for (const t of trechos) {
    const r = conferirTrecho(segredo, t, autoria, undefined, marcaConfere);
    if (!r.ok) return resposta({ ok: false, motivo: "prova_nao_confere", trecho: conferidos.length, porque: r.motivo }, 400);
    if (post !== null && r.origem !== "post") return resposta({ ok: false, motivo: "prova_nao_confere", trecho: conferidos.length, porque: "origem" }, 400);
    conferidos.push({ texto: r.texto, dia: r.dia, origem: r.origem });
  }

  const b = await rpcDeServico<{ protocolo: string; prioridade: number; ja: boolean; responder_ate?: string }>("rede_franquia_denunciar", {
    p_usuario: conta.id,
    p: { categoria: c.categoria, autor, post, texto: typeof c.texto === "string" ? c.texto.slice(0, 2000) : "", prova: conferidos },
  });
  if (!b.ok) {
    if (b.status === 0) return resposta({ ok: false, motivo: "sem_servico" }, 503);
    if (b.status === 404) return resposta({ ok: false, motivo: "banco_desatualizado" }, 503);
    return resposta({ ok: false, motivo: CODIGOS.has(b.codigo) ? b.codigo : "falha" }, 400);
  }
  return resposta({ ok: true, ...b.dado });
}
