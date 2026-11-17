// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Arquivos do núcleo (frente 10D). O navegador já limpou o arquivo; AQUI o servidor confere e limpa de novo, porque um cliente
// alterado poderia mandar o arquivo cru: o tipo vem dos bytes, a imagem perde EXIF, XMP, ICC e o resto (limparImagem), o PDF perde
// o /Info e o XMP ou é recusado se guardar isso de um jeito que não dá para limpar com certeza (limparPdf). Só então o banco reserva
// o lugar como a própria pessoa (pasta do núcleo, cota, limite de envios; com o token dela), e só ESTE servidor grava o arquivo limpo
// no depósito privado "rede-acervo", com a chave de serviço: o depósito não aceita envio nem remoção de quem tem conta, então nada
// chega lá sem a limpeza. Depois o banco marca pronto (de novo como a pessoa). Nada aqui lê ou guarda endereço de rede.
import { identificarArquivo, LIMITE_DO_ARQUIVO, limparPdf } from "@/components/rede/comunidades/acervo/regras";
import { limparImagem } from "@/lib/rede/publicar/midia";
import { chamarComoPessoa, lerCorpoLimitado, statusDoCodigo, tokenDe } from "@/lib/rede/publicar/servidor";

export const runtime = "nodejs";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const servico = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

/** O caminho que o banco reserva: <núcleo>/<id>.<ext>. */
const caminhoOk = (c: string): boolean => /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/.test(c);

/** Fala com o depósito "rede-acervo" com a chave de serviço, só no caminho que o banco devolveu para esta pessoa. */
async function deposito(metodo: "POST" | "DELETE", caminho: string, bytes?: Uint8Array, mime?: string): Promise<boolean> {
  const chave = servico();
  if (!url || !chave || !caminhoOk(caminho)) return false;
  try {
    const r = await fetch(`${url}/storage/v1/object/rede-acervo/${caminho.split("/").map(encodeURIComponent).join("/")}`, {
      method: metodo,
      headers: { apikey: chave, Authorization: `Bearer ${chave}`, ...(mime ? { "Content-Type": mime, "x-upsert": "false", "Cache-Control": "no-store" } : {}) },
      body: bytes as unknown as BodyInit | undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function POST(pedido: Request) {
  const token = tokenDe(pedido);
  if (!token) return resposta({ erro: "entre_primeiro" }, 401);
  const busca = new URL(pedido.url).searchParams;
  const nucleo = busca.get("nucleo") ?? "";
  const nome = (busca.get("nome") ?? "").slice(0, 200);
  if (!UUID.test(nucleo)) return resposta({ erro: "nao_encontrado" }, 404);
  if (!url || !servico()) return resposta({ erro: "sem_servico" }, 503);
  const cru = await lerCorpoLimitado(pedido, LIMITE_DO_ARQUIVO + 4096);
  if (!cru) return resposta({ erro: "grande" }, 413);
  const id = identificarArquivo(cru);
  if (!id) return resposta({ erro: "tipo" }, 415);
  let bytes: Uint8Array;
  if (id.ext === "pdf") {
    const limpo = limparPdf(cru);
    if (!limpo.ok) return resposta({ erro: limpo.motivo === "anexo_ou_programa" ? "pdf_programa" : "pdf_comprimido" }, 415);
    bytes = limpo.bytes;
  } else {
    const limpa = limparImagem(cru);
    if (!limpa) return resposta({ erro: "tipo" }, 415);
    bytes = limpa;
  }
  if (bytes.length > LIMITE_DO_ARQUIVO || bytes.length < 1) return resposta({ erro: "grande" }, 413);
  const reserva = await chamarComoPessoa<{ id: string; caminho: string; desfazer: string }>(token, "rede_acervo_arquivo_reservar", {
    p_nucleo: nucleo, p_nome: nome || `arquivo.${id.ext}`, p_ext: id.ext, p_tamanho: bytes.length,
  });
  if (!reserva.ok) return resposta({ erro: reserva.codigo }, statusDoCodigo(reserva.codigo));
  if (!(await deposito("POST", reserva.dado.caminho, bytes, id.mime))) return resposta({ erro: "falha" }, 502);
  const pronto = await chamarComoPessoa<{ id: string; tamanho: number }>(token, "rede_acervo_arquivo_confirmar", { p_id: reserva.dado.id, p_tamanho: bytes.length });
  if (!pronto.ok) return resposta({ erro: pronto.codigo }, statusDoCodigo(pronto.codigo));
  return resposta({
    arquivo: { id: reserva.dado.id, nome: nome || `arquivo.${id.ext}`, ext: id.ext, tamanho: pronto.dado.tamanho, criado_em: new Date().toISOString(), caminho: reserva.dado.caminho },
    desfazer: reserva.dado.desfazer,
  });
}

export async function DELETE(pedido: Request) {
  const token = tokenDe(pedido);
  if (!token) return resposta({ erro: "entre_primeiro" }, 401);
  const busca = new URL(pedido.url).searchParams;
  const id = busca.get("id") ?? "";
  const desfazer = busca.get("desfazer");
  if (!UUID.test(id)) return resposta({ erro: "nao_encontrado" }, 404);
  if (desfazer !== null && !/^[0-9a-f]{32}$/.test(desfazer)) return resposta({ erro: "sem_permissao" }, 403);
  const r = await chamarComoPessoa<{ id: string; caminho: string }>(token, "rede_acervo_arquivo_apagar", { p_id: id, p_desfazer: desfazer });
  if (!r.ok) return resposta({ erro: r.codigo }, statusDoCodigo(r.codigo));
  // A linha fica "apagado" até o depósito confirmar; se falhar agora, a lista já não mostra o arquivo, o endereço não se assina mais
  // e a faxina dos arquivos (app/api/rede/exportar/faxina) tira o arquivo depois.
  if (await deposito("DELETE", r.dado.caminho)) await chamarComoPessoa(token, "rede_acervo_arquivo_sumiu", { p_id: id });
  return resposta({ apagado: true });
}
