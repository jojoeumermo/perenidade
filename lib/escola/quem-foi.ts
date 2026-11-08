// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// content/escola/quem-foi-lucia-maria.md tem o texto publicado: escrito em primeira pessoa pelo neto, o criador do
// Instituto, só com os fatos anotados em docs/escola-revolucionaria/FONTES-LUCIA-MARIA.md. Se um dia o arquivo voltar a
// ter só o marcador antigo (ou ficar vazio), a Escola mostra um aviso curto no lugar dele.

export const MARCADOR_QUEM_FOI = "[TEXTO A ENVIAR PELA COORDENAÇÃO]";
export const AVISO_SEM_TEXTO = "A coordenação está escrevendo este texto. Em breve ele aparece aqui.";
export const semMarcador = (texto: string) => (!texto || texto === MARCADOR_QUEM_FOI ? AVISO_SEM_TEXTO : texto);

/**
 * Para o 2º quadro da abertura (10 s, texto puro num <p>): só o primeiro parágrafo do Markdown, cortado antes do
 * primeiro intertítulo, sem marcas de ênfase nem links. O texto inteiro mora na página "Quem foi Lúcia Maria".
 */
export function aberturaDoQuemFoi(markdown: string): string {
  const antesDoIntertitulo = markdown.replace(/\r\n/g, "\n").split(/^#{1,6} /m)[0];
  const paragrafo = antesDoIntertitulo.trim().split(/\n\s*\n/)[0] ?? "";
  const limpo = paragrafo
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|\*|_)(.+?)\1/g, "$2")
    .replace(/\s+/g, " ")
    .trim();
  return semMarcador(limpo);
}
