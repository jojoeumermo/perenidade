// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

// Os emojis próprios do instituto (como os emojis do servidor no Stoat): desenhos simples, no traço da casa, que entram
// nas mensagens com :nome: e nas reações. Ficam no código, sem envio de imagem: o banco só guarda o nome (cifrado).
// Este arquivo não depende do navegador (lib/mensagem.ts o usa e é testado no Node).

export interface EmojiDoInstituto {
  nome: string;
  /** O caminho do desenho, numa caixa de 24 por 24. */
  desenho: string;
  cor: string;
  /** Preenchido (true) ou só o traço (false). */
  cheio: boolean;
}

export const EMOJIS_DO_INSTITUTO: Record<string, EmojiDoInstituto> = {
  estrela: { nome: "Estrela", desenho: "M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.2l7.1-.6z", cor: "#e0372b", cheio: true },
  punho: { nome: "Punho erguido", desenho: "M8 21v-6.5L6 13V8a1.5 1.5 0 0 1 3 0V6a1.5 1.5 0 0 1 3 0v-.5a1.5 1.5 0 0 1 3 0V7a1.5 1.5 0 0 1 3 0v6c0 2-1 3.5-2.5 4.5V21z", cor: "#e0372b", cheio: true },
  livro: { nome: "Livro", desenho: "M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5c-.8 0-1.5.7-1.5 1.5zM20 5.5c0-.8-.7-1.5-1.5-1.5H13v15h5.5c.8 0 1.5.7 1.5 1.5z", cor: "#d4a24c", cheio: true },
  cravo: { nome: "Cravo", desenho: "M12 22v-9M12 13c-3 0-5-2-5-4.5S9 4 12 3c3 1 5 3 5 5.5S15 13 12 13zM12 17c-2-1.5-4-1.5-5 0M12 19c2-1.5 4-1.5 5 0", cor: "#e0372b", cheio: false },
  megafone: { nome: "Megafone", desenho: "M3 10v4h3l7 4V6L6 10zM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12", cor: "#d4a24c", cheio: false },
  coracao: { nome: "Coração", desenho: "M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z", cor: "#e0372b", cheio: true },
  feito: { nome: "Feito", desenho: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM7.5 12.5l3 3 6-6.5", cor: "#3abf7e", cheio: false },
  ideia: { nome: "Ideia", desenho: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z", cor: "#faa352", cheio: false },
  fogo: { nome: "Fogo", desenho: "M12 22c4 0 7-2.8 7-6.8 0-3.7-2.6-5.7-4-9.2-1 2.2-2.2 3.2-3.5 3.6.3-2.4-.5-4.7-2.5-6.6C8.6 7.5 5 10 5 15.2 5 19.2 8 22 12 22z", cor: "#faa352", cheio: true },
  cafe: { nome: "Café", desenho: "M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3c-.5 1 .5 2 0 3M12 3c-.5 1 .5 2 0 3", cor: "#b07a4a", cheio: false },
};

/** ":estrela:" é um emoji do instituto? */
export const ehEmojiDoInstituto = (valor: string) => /^:[a-z]+:$/.test(valor) && valor.slice(1, -1) in EMOJIS_DO_INSTITUTO;
