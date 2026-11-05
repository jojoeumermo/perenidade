// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Enquanto content/escola/quem-foi-lucia-maria.md tem só o marcador da coordenação, a Escola (ligada desde 05/11/2026)
// mostra um aviso curto no lugar do marcador. Quando o texto chegar, ele aparece como está.

export const MARCADOR_QUEM_FOI = "[TEXTO A ENVIAR PELA COORDENAÇÃO]";
export const AVISO_SEM_TEXTO = "A coordenação está escrevendo este texto. Em breve ele aparece aqui.";
export const semMarcador = (texto: string) => (!texto || texto === MARCADOR_QUEM_FOI ? AVISO_SEM_TEXTO : texto);
