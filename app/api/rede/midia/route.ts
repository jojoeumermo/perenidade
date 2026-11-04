// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Envio de imagem e áudio para a Rede (pacote publicar). O navegador já reencoda a imagem (sem EXIF/GPS) e borra rostos; AQUI o
// servidor confere de novo, porque um cliente alterado poderia mandar o arquivo cru: o tipo vem dos bytes, o metadado é tirado
// (limparImagem), o tamanho é limitado e só então o arquivo vai para o depósito privado, na pasta da própria pessoa, com a
// permissão dela. Antes, o banco reserva o caminho (limite de envios e conferência de que a pessoa é membro da Rede).
import { dimensoesDaImagem, identificarMidia, LIMITE_AUDIO, LIMITE_IMAGEM, limparImagem, MAX_LADO } from "@/lib/rede/publicar/midia";
import { chamarComoPessoa, guardarNoDeposito, lerCorpoLimitado, statusDoCodigo, tokenDe } from "@/lib/rede/publicar/servidor";

export const runtime = "nodejs";

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

export async function POST(pedido: Request) {
  const token = tokenDe(pedido);
  if (!token) return resposta({ erro: "entre_primeiro" }, 401);
  const cru = await lerCorpoLimitado(pedido, LIMITE_IMAGEM + 4096);
  if (!cru) return resposta({ erro: "grande" }, 413);
  const id = identificarMidia(cru);
  if (!id) return resposta({ erro: "tipo" }, 415);
  let bytes: Uint8Array = cru;
  let largura: number | null = null;
  let altura: number | null = null;
  if (id.tipo === "imagem") {
    const limpa = limparImagem(cru);
    const dim = limpa ? dimensoesDaImagem(limpa) : null;
    if (!limpa || !dim || dim.largura < 1 || dim.altura < 1 || dim.largura > MAX_LADO || dim.altura > MAX_LADO) return resposta({ erro: "tipo" }, 415);
    if (limpa.length > LIMITE_IMAGEM) return resposta({ erro: "grande" }, 413);
    bytes = limpa;
    largura = dim.largura;
    altura = dim.altura;
  } else if (cru.length > LIMITE_AUDIO) {
    return resposta({ erro: "grande" }, 413);
  }
  const reserva = await chamarComoPessoa<{ id: string; caminho: string }>(token, "rede_pub_midia_reservar", { p_ext: id.ext });
  if (!reserva.ok) return resposta({ erro: reserva.codigo }, statusDoCodigo(reserva.codigo));
  if (!(await guardarNoDeposito(token, reserva.dado.caminho, bytes, id.mime))) return resposta({ erro: "falha" }, 502);
  return resposta({ caminho: reserva.dado.caminho, tipo: id.mime, largura, altura });
}
