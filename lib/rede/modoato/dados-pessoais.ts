// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O aviso de dado pessoal antes de publicar, com o que faltava (frente 9C): a placa de carro (o padrão Mercosul, ABC1D23, e o
// antigo, ABC-1234) e o telefone fixo. Os de sempre (CPF, celular, e-mail, endereço com número) vêm da checagem do compositor
// (lib/rede/publicar/checagem.ts), que o banco espelha e BLOQUEIA; os dois daqui só AVISAM: uma placa pode ser de um carro da
// polícia num relato, e o número pode ser o de um plantão público. A pessoa decide. Tudo no aparelho, nada é guardado.
// Sem "@/": roda no Node dos testes.
import { checarTexto, type TipoDeAchado } from "../publicar/checagem";

export type TipoDoAviso = Exclude<TipoDeAchado, "odio"> | "placa" | "fixo";

export interface AchadoPessoal {
  tipo: TipoDoAviso;
  trecho: string;
  /** Bloqueia (o banco recusa de qualquer jeito) ou só avisa (a pessoa pode mandar assim mesmo). */
  bloqueia: boolean;
}

// Mercosul: três letras, um número, uma letra, dois números (maiúsculas ou minúsculas: ninguém digita placa com Shift).
const PLACA_MERCOSUL = /(?<![\p{L}\d])[a-z]{3}[-\s]?\d[a-z]\d{2}(?![\p{L}\d])/iu;
// Antiga: três letras MAIÚSCULAS, hífen opcional, quatro números ("ato 2026" em minúsculas não é placa).
const PLACA_ANTIGA = /(?<![\p{L}\d])[A-Z]{3}-?\d{4}(?![\p{L}\d])/u;
// Fixo: DDD e oito números começando de 2 a 5 ("(11) 3333-4444"). O celular (com o 9) já é da checagem do compositor.
const FIXO = /(?<!\d)\(?\d{2}\)?\s?[2-5]\d{3}[-\s]?\d{4}(?!\d)/;

/** Os dados pessoais de um texto: primeiro os que bloqueiam, depois os que só avisam. */
export function acharDadosPessoais(texto: string): AchadoPessoal[] {
  const achados: AchadoPessoal[] = checarTexto(texto).bloqueia.map((a) => ({ tipo: a.tipo as TipoDoAviso, trecho: a.trecho, bloqueia: true }));
  const casar = (re: RegExp, tipo: TipoDoAviso) => {
    const m = texto.match(re);
    if (m && !achados.some((a) => a.trecho.includes(m[0].trim()))) achados.push({ tipo, trecho: m[0].trim().slice(0, 60), bloqueia: false });
  };
  casar(PLACA_MERCOSUL, "placa");
  casar(PLACA_ANTIGA, "placa");
  casar(FIXO, "fixo");
  return achados;
}
