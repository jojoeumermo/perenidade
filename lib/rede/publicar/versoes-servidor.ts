// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As versões menores da imagem do post (Prompt 5, A20), feitas NO SERVIDOR a partir da principal que a rota acabou de limpar
// (app/api/rede/midia). Antes, o aparelho mandava cada versão e a rota só conferia a largura: a versão podia ser outra imagem
// qualquer, que o celular mostrava pelo srcset e a moderação (que vê a principal) nunca via. Agora a versão é sempre a mesma
// imagem, reduzida aqui, no mesmo formato, sem metadado nenhum (o sharp não copia EXIF, GPS, XMP nem ICC sem pedir, e a limpeza
// de sempre passa de novo por cima). Sem o sharp no servidor, não há versão: o post fica com a principal, como os antigos.
// Só roda no servidor (e no Node dos testes).
import { limparImagem, MAX_LADO } from "./midia";
import { type LarguraDaVersao, versoesPara } from "./versoes";

export interface VersaoFeita {
  largura: LarguraDaVersao;
  bytes: Uint8Array;
}

type Sharp = typeof import("sharp").default;

let carregado: Promise<Sharp | null> | null = null;
/** O sharp (o mesmo que o Next usa para as imagens), carregado uma vez; nulo se o servidor não o tem. */
function sharpDoServidor(): Promise<Sharp | null> {
  carregado ??= import("sharp").then((m) => m.default).catch(() => null);
  return carregado;
}

/**
 * As versões de 640 e 1080 px (só as menores que a principal) da imagem principal já limpa. `mime` é o tipo da principal: a
 * versão sai no mesmo formato, para o caminho "<principal>.v640" servir o mesmo tipo. Qualquer falha devolve o que deu certo.
 */
export async function versoesDaPrincipal(principal: Uint8Array, mime: string, largura: number | null): Promise<VersaoFeita[]> {
  const larguras = versoesPara(largura);
  if (!larguras.length || !["image/jpeg", "image/png", "image/webp"].includes(mime)) return [];
  const sharp = await sharpDoServidor();
  if (!sharp) return [];
  const feitas: VersaoFeita[] = [];
  for (const l of larguras) {
    try {
      const base = sharp(Buffer.from(principal), { limitInputPixels: MAX_LADO * MAX_LADO, failOn: "error" }).resize({ width: l, withoutEnlargement: true });
      const saida = mime === "image/png" ? base.png({ compressionLevel: 9 }) : mime === "image/webp" ? base.webp({ quality: 80 }) : base.jpeg({ quality: 82 });
      const limpa = limparImagem(new Uint8Array(await saida.toBuffer()));
      if (limpa) feitas.push({ largura: l, bytes: limpa });
    } catch {
      // sem esta versão: o cartão usa a principal
    }
  }
  return feitas;
}
