// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Combinar pelo chat" das caronas do ato: o ENCAIXE entre a Faixa 1 (atos) e a Faixa 2 (chat privado cifrado). A Faixa 1 não
// sabe quem ofereceu a carona (nenhuma função devolve) e não mexe no chat; a Faixa 2 registra aqui a função que abre a conversa
// privada com a dona da carona, resolvendo `carona.id` → pessoa NO SERVIDOR (interno.rede_ato_caronas.quem), sem nunca mostrar o
// id a quem pediu. Pedido em docs/rede/PEDIDOS-ENTRE-FAIXAS.md (10/11/2026). Enquanto ninguém registrar, o botão aparece
// desligado com a explicação. Sem "@/" de propósito.

export interface CaronaParaConversa {
  /** O id da carona (rede_ato_caronas.id). */
  id: string;
  /** O id do ato (o post do chamado). */
  ato: string;
}

/** Abre a conversa privada com quem publicou a carona (a Faixa 2 implementa; pode navegar para a conversa). */
export type AbrirConversaDaCarona = (carona: CaronaParaConversa) => Promise<void> | void;

let abridor: AbrirConversaDaCarona | null = null;
const ouvintes = new Set<() => void>();

/** A Faixa 2 chama isto ao carregar o encaixe do chat. Devolve a função que desfaz o registro. */
export function registrarConversaDaCarona(f: AbrirConversaDaCarona): () => void {
  abridor = f;
  for (const o of ouvintes) o();
  return () => {
    if (abridor === f) abridor = null;
    for (const o of ouvintes) o();
  };
}

/** Já dá para combinar pelo chat? */
export function conversaDaCaronaPronta(): boolean {
  return abridor !== null;
}

/** Para useSyncExternalStore: avisa quando o registro muda. */
export function ouvirConversaDaCarona(aoMudar: () => void): () => void {
  ouvintes.add(aoMudar);
  return () => {
    ouvintes.delete(aoMudar);
  };
}

/** Abre a conversa (ou recusa com "sem_chat" quando a Faixa 2 ainda não registrou). */
export async function combinarCarona(carona: CaronaParaConversa): Promise<void> {
  if (!abridor) throw new Error("sem_chat");
  await abridor(carona);
}
