// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { ContextoDoEncaixe, Encaixe } from "../encaixes";
import { LembreteDeIdentidade } from "../identidade/Lembrete";
import { AoVivoAgora } from "./AoVivoAgora";

/**
 * Encaixe da F4 (perfis e organizações): o que esta frente pendura nas telas comuns. Hoje: o cartão "Ao vivo agora" na coluna da
 * direita (prancha computador-inicio). Tudo atrás da flag "alumia-org" (o componente confere e, desligada, não desenha nada) e das
 * regras de privacidade do PLANO-ALUMIA §6 (pessoas na sala só agregadas e a partir de 3). E, no alto da linha, o lembrete da
 * identidade: só para quem marcou no cadastro que quer aparecer com nome e foto, uma vez, e só com a escolha aberta no banco.
 */
function LembreteNoAlto({ lang, situacao }: ContextoDoEncaixe) {
  return <LembreteDeIdentidade lang={lang} membro={situacao.membro} />;
}

export const encaixe: Encaixe = {
  colunaDireita: [AoVivoAgora],
  topoDaLinha: [LembreteNoAlto],
};
