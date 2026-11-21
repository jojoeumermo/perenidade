// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useTextosAlumia2 } from "../publicar/alumia2/textos";
import type { PropsDaTelaDoPacote } from "../registro";
import { NaoExiste } from "../ui/NaoExiste";

/**
 * As identidades da conta (/alumia/identidades). R1 (A2.2): a base existe no banco (interno.rede_identidades e as contas extras
 * de lib/rede/contas-extra.ts, que hoje servem às contas de organização), mas a troca de identidade não existe: não há como
 * entrar na segunda identidade. Em vez do "em construção" meio exposto, a tela responde como endereço que não existe, e a rota
 * passa a depender do interruptor próprio "alumia-identidades" (desligado), que aparece no painel único de admin.
 */
export default function TelaDasIdentidades({ lang }: PropsDaTelaDoPacote) {
  const t = useTextosAlumia2(lang);
  return <NaoExiste lang={lang} texto={t?.naoEncontrada.texto ?? ""} />;
}
