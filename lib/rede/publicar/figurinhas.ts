// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O pacote da casa de figurinhas para post e resposta (onda 12, 12A). Os desenhos estão em components/rede/figurinhas/PacoteDaCasa.tsx
// (SVG feito no código, nas cores do Mosaico; nenhuma imagem de fora). O banco aceita só estes nomes (interno.rede_o12_figurinhas e
// a regra da tabela interno.rede_o12_post, em supabase/migracoes/20261118-alumia-o12-compositor.sql): o teste confere que as três
// listas são a mesma. Sem "@/" de propósito (roda no Node nos testes).

export const FIGURINHAS = ["punho", "lampiao", "megafone", "estrela", "cravo", "coracao", "livro", "sol", "cafe", "presente", "na-luta", "valeu"] as const;

export type NomeDaFigurinha = (typeof FIGURINHAS)[number];

export function eFigurinha(nome: unknown): nome is NomeDaFigurinha {
  return typeof nome === "string" && (FIGURINHAS as readonly string[]).includes(nome);
}

/**
 * O texto que vai no post quando ele é só a figurinha: o nome dela entre colchetes, no idioma de quem publica ("[Figurinha: Punho
 * erguido]"). É o que o leitor de tela e o Fediverso recebem; no cartão da Alumia, a figurinha aparece no lugar dele.
 */
export function textoDaFigurinha(modelo: string, nome: string): string {
  return modelo.replace("{nome}", nome).slice(0, 500);
}
