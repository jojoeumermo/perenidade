// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Combinar pelo chat" das caronas do ato: o lado da Faixa 2 do encaixe lib/rede/atos/combinar.ts (pedido da Faixa 1 em
// docs/rede/PEDIDOS-ENTRE-FAIXAS.md, 10/11/2026). Registrado em components/rede/chat/encaixe.tsx.
//
// O aparelho manda só o id da carona. Quem publicou é achado NO SERVIDOR (public.rede_dm_abrir_carona,
// supabase/migracoes/20261111-chat-caronas.sql), com as regras de sempre do chat (membro 18+, bloqueio, "quem pode me chamar",
// limite). Esta tela nunca recebe o id nem o codinome de quem ofereceu; a tela das conversas mostra com quem é só depois que a
// conversa existe. O endereço leva o id da CONVERSA (nunca o @ da pessoa), e a tela das conversas o tira do endereço ao abrir.
//
// O cliente do chat é baixado só no toque: este arquivo entra no encaixe, que vai leve na casca da Alumia.
import type { CaronaParaConversa } from "../atos/combinar";

const IDIOMA = /^\/([a-z]{2})(?:\/|$)/;

/** Abre (ou acha) a conversa com quem publicou a carona e leva a pessoa até ela. Erros sobem com o código do servidor. */
export async function abrirConversaDaCarona(carona: CaronaParaConversa): Promise<void> {
  const { chat } = await import("../cliente-chat");
  const conversa = await chat.abrirCarona(carona.id);
  // A recusa por causa da pessoa vem como resposta (para o limite do banco valer também nela); para a tela é o erro de sempre.
  if ("erro" in conversa) throw new Error(conversa.erro);
  const lang = IDIOMA.exec(window.location.pathname)?.[1] ?? "pt";
  window.location.assign(`/${lang}/alumia/conversas?conversa=${encodeURIComponent(conversa.id)}`);
}
