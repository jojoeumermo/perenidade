// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Envio do vídeo curto do post (frente 12B, atrás de "alumia-video-post"). O aparelho já regravou o vídeo (sem GPS, modelo nem
// data); AQUI o servidor confere de novo, porque um cliente alterado poderia mandar o arquivo cru: o formato vem dos bytes (só MP4
// e WEBM), as caixas de metadado são neutralizadas (lib/rede/midia/limpar-video.ts) e o tamanho é limitado. Depois o banco reserva
// o caminho como a própria pessoa (interruptor, membro 18+, limite de envios e a cota de mídia, com o tamanho do arquivo limpo) e
// o arquivo vai para o depósito privado "rede-video", na pasta dela. Quem grava é só este servidor, com a chave de serviço: o
// depósito não aceita envio de quem tem conta, então nenhum arquivo cru entra por fora desta rota. A duração e a medida vêm do aparelho e o banco confere os limites. Nenhum
// endereço de rede é lido nem guardado.
import { LIMITES_DA_MIDIA } from "@/lib/rede/midia/regras";
import { limparVideo } from "@/lib/rede/midia/limpar-video";
import { guardarVideo, videoLigadoNoServidor } from "@/lib/rede/midia/servidor";
import { chamarComoPessoa, lerCorpoLimitado, statusDoCodigo, tokenDe } from "@/lib/rede/publicar/servidor";

export const runtime = "nodejs";
export const maxDuration = 60;

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

const inteiro = (v: string | null, min: number, max: number): number | null => {
  if (!v || !/^\d{1,9}$/.test(v)) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
};

export async function POST(pedido: Request) {
  const token = tokenDe(pedido);
  if (!token) return resposta({ erro: "entre_primeiro" }, 401);
  if (!videoLigadoNoServidor()) return resposta({ erro: "desligado" }, 503);
  const q = new URL(pedido.url).searchParams;
  const duracao = inteiro(q.get("d"), LIMITES_DA_MIDIA.videoMinMs, LIMITES_DA_MIDIA.videoMs + 500);
  const largura = inteiro(q.get("l"), 2, LIMITES_DA_MIDIA.ladoLongo);
  const altura = inteiro(q.get("a"), 2, LIMITES_DA_MIDIA.ladoLongo);
  if (duracao === null) return resposta({ erro: "longo" }, 400);
  if (largura === null || altura === null) return resposta({ erro: "invalido:video" }, 400);
  const cru = await lerCorpoLimitado(pedido, LIMITES_DA_MIDIA.videoBytes);
  if (!cru) return resposta({ erro: "grande" }, 413);
  const limpo = limparVideo(cru);
  if (!limpo) return resposta({ erro: "tipo" }, 415);
  const reserva = await chamarComoPessoa<{ id: string; caminho: string }>(token, "rede_video_reservar", {
    p_ext: limpo.tipo.ext,
    p_bytes: limpo.bytes.length,
    p_duracao_ms: duracao,
    p_largura: largura,
    p_altura: altura,
    p_som: q.get("s") === "1",
  });
  if (!reserva.ok) return resposta({ erro: reserva.codigo }, reserva.codigo === "grande" || reserva.codigo === "longo" ? 400 : statusDoCodigo(reserva.codigo));
  if (!(await guardarVideo(reserva.dado.caminho, limpo.bytes, limpo.tipo.tipo))) return resposta({ erro: "falha" }, 502);
  return resposta({ id: reserva.dado.id, tipo: limpo.tipo.tipo });
}
