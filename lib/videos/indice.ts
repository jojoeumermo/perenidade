// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O índice dos vídeos curtos (gerado por npm run video:legendar): título, aula e duração. Pequeno, vai para o navegador.
import indice from "./indice.json";

export type EntradaDeVideo = { titulo: string; aula: string; segundos: number };
export const INDICE_DE_VIDEOS = indice as Record<string, EntradaDeVideo>;

/** Os vídeos de uma aula (trilha/aula), para a página da aula mostrar sozinha. */
export const videosDaAula = (trilha: string, aula: string) =>
  Object.entries(INDICE_DE_VIDEOS)
    .filter(([, v]) => v.aula === `${trilha}/${aula}`)
    .map(([id]) => id);
