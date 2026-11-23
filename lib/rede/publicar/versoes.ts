// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Imagens no tamanho de cada tela (Prompt 5, A20), sem serviço pago: no envio, o SERVIDOR faz as versões menores da imagem do post
// a partir da principal que acabou de limpar (lib/rede/publicar/versoes-servidor.ts; desde a auditoria do P5, o aparelho não manda
// versão nenhuma) e guarda ao lado dela: "<pessoa>/<id>.<ext>" ganha "<pessoa>/<id>.<ext>.v640" e ".v1080". Quem lê a versão é
// quem lê a principal (public.rede_pub_midia_pode, supabase/migracoes/20261126-p5-imagens.sql), e a faxina da mídia órfã apaga a
// versão junto com a principal. O cartão monta o srcset com o que existir: post antigo, sem versões, continua com a principal.
// Sem dependências e sem "@/": roda no servidor, no navegador e no Node dos testes.

/** As larguras das versões menores (a principal tem até 1600 px no lado maior). */
export const LARGURAS_DAS_VERSOES = [640, 1080] as const;
export type LarguraDaVersao = (typeof LARGURAS_DAS_VERSOES)[number];

/** O caminho da imagem principal de um post: "<uuid da pessoa>/<uuid>.<jpg|png|webp>". */
const PRINCIPAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export const ehCaminhoDeImagemPrincipal = (caminho: string): boolean => PRINCIPAL.test(caminho);

export const ehLarguraDeVersao = (n: number): n is LarguraDaVersao => (LARGURAS_DAS_VERSOES as readonly number[]).includes(n);

/** O caminho da versão de `largura` px da imagem principal. */
export function caminhoDaVersao(principal: string, largura: LarguraDaVersao): string {
  return `${principal}.v${largura}`;
}

/** As versões que fazem sentido para uma imagem desta largura (só as menores que ela). */
export function versoesPara(largura: number | null | undefined): LarguraDaVersao[] {
  if (!largura || largura <= 0) return [];
  return LARGURAS_DAS_VERSOES.filter((v) => v < largura);
}

/** Todos os caminhos de uma imagem principal (ela e as versões possíveis), para apagar junto. */
export function caminhosComVersoes(principal: string): string[] {
  return ehCaminhoDeImagemPrincipal(principal) ? [principal, ...LARGURAS_DAS_VERSOES.map((v) => caminhoDaVersao(principal, v))] : [principal];
}

/** O srcset a partir dos endereços que existem (largura → endereço). Vazio se só há a principal. */
export function montarSrcset(enderecos: { largura: number; url: string }[]): string {
  const validos = enderecos.filter((e) => e.url && e.largura > 0).sort((a, b) => a.largura - b.largura);
  return validos.length > 1 ? validos.map((e) => `${e.url} ${e.largura}w`).join(", ") : "";
}

/** Quanto da tela a imagem ocupa: sozinha, a coluna da linha; em grade (2 a 4), metade dela. */
export function tamanhosDaImagem(total: number): string {
  return total > 1 ? "(max-width: 640px) 50vw, 300px" : "(max-width: 640px) 100vw, 600px";
}
