// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Envio de imagem e áudio para a Rede (pacote publicar). O navegador já reencoda a imagem (sem EXIF/GPS) e borra rostos; AQUI o
// servidor confere de novo, porque um cliente alterado poderia mandar o arquivo cru: o tipo vem dos bytes, o metadado é tirado
// (limparImagem), o tamanho é limitado e só então o arquivo vai para o depósito privado, na pasta da própria pessoa. Antes, o
// banco reserva o caminho COMO a pessoa (membro da Rede, idade, limite de envios e cota). Desde a auditoria do Prompt 5, só este
// servidor grava no depósito (com a chave de serviço, no caminho reservado): o depósito não aceita envio direto de quem tem conta,
// então ninguém põe lá foto com EXIF/GPS nem troca a foto de um post já publicado (lib/rede/publicar/deposito-servidor.ts).
// O áudio também: o gravador do navegador não põe metadado, mas um cliente alterado pode mandar um .m4a do celular (com o lugar
// da gravação na caixa "udta") ou um .webm com etiquetas. O MP4 e o WEBM passam pela mesma limpeza do vídeo
// (lib/rede/midia/limpar-video.ts: caixas de metadado neutralizadas no lugar, faixa que não é de som recusada). O Ogg (Firefox)
// segue como veio: o gravador só escreve o nome do programa nos comentários.
import { dimensoesDaImagem, identificarMidia, LIMITE_AUDIO, LIMITE_IMAGEM, limparImagem, MAX_LADO } from "@/lib/rede/publicar/midia";
import { chamarComoPessoa, lerCorpoLimitado, statusDoCodigo, tokenDe } from "@/lib/rede/publicar/servidor";
import { guardarComServico, midiaLigadaNoServidor } from "@/lib/rede/publicar/deposito-servidor";
import { limparVideo } from "@/lib/rede/midia/limpar-video";
import { caminhoDaVersao } from "@/lib/rede/publicar/versoes";
import { versoesDaPrincipal } from "@/lib/rede/publicar/versoes-servidor";

export const runtime = "nodejs";

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

export async function POST(pedido: Request) {
  const token = tokenDe(pedido);
  if (!token) return resposta({ erro: "entre_primeiro" }, 401);
  // A20: a versão menor não vem mais do aparelho (podia ser outra imagem, que o celular mostrava e a moderação não via): o servidor
  // a faz da principal, logo abaixo. O pedido antigo ("versao_de") é recusado.
  if (new URL(pedido.url).searchParams.has("versao_de")) return resposta({ erro: "versao_no_servidor" }, 410);
  if (!midiaLigadaNoServidor()) return resposta({ erro: "sem_servico" }, 503);
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
  } else {
    if (cru.length > LIMITE_AUDIO) return resposta({ erro: "grande" }, 413);
    if (id.ext !== "ogg") {
      const limpo = limparVideo(cru);
      if (!limpo) return resposta({ erro: "tipo" }, 415);
      bytes = limpo.bytes;
    }
  }
  const reserva = await chamarComoPessoa<{ id: string; caminho: string }>(token, "rede_pub_midia_reservar", { p_ext: id.ext });
  if (!reserva.ok) return resposta({ erro: reserva.codigo }, statusDoCodigo(reserva.codigo));
  if (!(await guardarComServico(reserva.dado.caminho, bytes, id.mime))) return resposta({ erro: "falha" }, 502);
  // A20: as versões de 640 e 1080 px, da principal já limpa, no mesmo formato. Falhar não atrapalha: o post fica com a principal
  // (e a versão de uma principal que não vira post fica órfã: a faxina apaga as duas).
  if (id.tipo === "imagem") {
    for (const v of await versoesDaPrincipal(bytes, id.mime, largura)) await guardarComServico(caminhoDaVersao(reserva.dado.caminho, v.largura), v.bytes, id.mime);
  }
  return resposta({ caminho: reserva.dado.caminho, tipo: id.mime, largura, altura });
}
