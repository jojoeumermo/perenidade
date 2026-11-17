// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os interruptores da frente 12B. Ouvir em voz alta, o áudio na resposta e a transcrição aprovada vêm com a Alumia nova
// ("rede-v2" + "alumia-2"). O vídeo curto no post fica atrás de "alumia-video-post", só pelo nome: enquanto a junção não põe o
// nome em lib/recursos.ts (RECURSOS e SO_PELO_NOME), ele só liga com o nome escrito na variável de montagem, nunca por "todos".
// Na tela, o interruptor só mostra o botão; quem libera o envio e a leitura é o banco (interno.rede_o12m_video_ligado, decisão
// do painel). Sem "@/" de propósito.
import { lerRecursos, ligado, SO_PELO_NOME, type Recurso } from "../../recursos";
import { alumia2Ligada } from "../rotas-novas";

export const RECURSO_DO_VIDEO = "alumia-video-post";

/** Voz, áudio na resposta e transcrição: com a Alumia nova. */
export function midiaLigada(): boolean {
  return alumia2Ligada();
}

/**
 * O vídeo no post aparece nesta montagem? Depois da junção, vale a regra de todos os recursos (variável e painel). Antes, só com o
 * nome escrito na variável. `lista` e `conhecidos` existem para o teste (com `lista`, a Alumia nova não é conferida).
 */
export function videoNoPostLigado(lista?: Set<string>, conhecidos: readonly string[] = SO_PELO_NOME): boolean {
  if (!lista && !alumia2Ligada()) return false;
  if (conhecidos.includes(RECURSO_DO_VIDEO)) return ligado(RECURSO_DO_VIDEO as Recurso, lista);
  const base = lista ?? lerRecursos(process.env.NEXT_PUBLIC_RECURSOS);
  return base.has(RECURSO_DO_VIDEO) && !base.has(`-${RECURSO_DO_VIDEO}`);
}
