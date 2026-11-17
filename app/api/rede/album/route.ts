// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Envio de foto para o álbum do ato (frente 10F). O aparelho já borrou os rostos e refez a imagem no canvas (sem EXIF, GPS, modelo
// do aparelho nem data); AQUI o servidor confere de novo, porque um cliente alterado poderia mandar o arquivo cru: o tipo vem dos
// bytes, só imagem, o metadado é tirado (limparImagem) e o tamanho é limitado. Depois o banco reserva o lugar como a própria pessoa
// (só quem confirmou presença ou modera o ato, só com a declaração de que os rostos foram conferidos), e só ESTE servidor grava a
// foto limpa no depósito privado "rede-album" (com a chave de serviço; o depósito não aceita envio de quem tem conta), num caminho
// sem o id de quem mandou. Toda foto entra na fila da moderação do ato. Nada do pedido (nem endereço de rede) é guardado.
import { albumLigado, caminhoDoAlbumOk, guardarNoAlbum } from "@/lib/rede/atos/album-servidor";
import { dimensoesDaImagem, identificarMidia, LIMITE_IMAGEM, limparImagem, MAX_LADO } from "@/lib/rede/publicar/midia";
import { chamarComoPessoa, lerCorpoLimitado, statusDoCodigo, tokenDe } from "@/lib/rede/publicar/servidor";

export const runtime = "nodejs";

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function POST(pedido: Request) {
  const token = tokenDe(pedido);
  if (!token) return resposta({ erro: "entre_primeiro" }, 401);
  const busca = new URL(pedido.url).searchParams;
  const ato = busca.get("ato") ?? "";
  const legenda = (busca.get("legenda") ?? "").slice(0, 140);
  if (!UUID.test(ato)) return resposta({ erro: "nao_encontrado" }, 404);
  // A declaração de que todo rosto foi conferido no aparelho: sem ela, nada sobe (o banco confere de novo).
  if (busca.get("conferida") !== "sim") return resposta({ erro: "rostos_nao_conferidos" }, 400);
  if (!albumLigado()) return resposta({ erro: "sem_servico" }, 503);
  const cru = await lerCorpoLimitado(pedido, LIMITE_IMAGEM + 4096);
  if (!cru) return resposta({ erro: "grande" }, 413);
  const id = identificarMidia(cru);
  if (!id || id.tipo !== "imagem" || !["jpg", "png", "webp"].includes(id.ext)) return resposta({ erro: "tipo" }, 415);
  const limpa = limparImagem(cru);
  const dim = limpa ? dimensoesDaImagem(limpa) : null;
  if (!limpa || !dim || dim.largura < 1 || dim.altura < 1 || dim.largura > MAX_LADO || dim.altura > MAX_LADO) return resposta({ erro: "tipo" }, 415);
  if (limpa.length > LIMITE_IMAGEM) return resposta({ erro: "grande" }, 413);
  const reserva = await chamarComoPessoa<{ id: string; caminho: string }>(token, "rede_ato_album_reservar", {
    p_ato: ato,
    p_ext: id.ext,
    p_largura: Math.min(dim.largura, 8000),
    p_altura: Math.min(dim.altura, 8000),
    p_legenda: legenda,
    p_conferida: true,
  });
  if (!reserva.ok) return resposta({ erro: reserva.codigo }, statusDoCodigo(reserva.codigo));
  if (!caminhoDoAlbumOk(reserva.dado.caminho)) return resposta({ erro: "falha" }, 502);
  if (!(await guardarNoAlbum(reserva.dado.caminho, limpa, id.mime))) return resposta({ erro: "falha" }, 502);
  const foto = await chamarComoPessoa<unknown>(token, "rede_ato_album_enviada", { p_id: reserva.dado.id });
  if (!foto.ok) return resposta({ erro: foto.codigo }, statusDoCodigo(foto.codigo));
  return resposta(foto.dado);
}
