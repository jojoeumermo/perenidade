// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que o aviso da troca do chat do beta mostra no alto do Início (onda R2, components/rede/avisos/AvisoDaTroca.tsx). A data e a
// limpeza do aparelho são da conversa a dois (lib/rede/chat/r2/troca.ts e limpeza.ts, pelo contrato da onda R2); aqui só a
// decisão, para o teste rodar sem navegador:
//   - antes da data (e no próprio dia, até a virada em UTC): o aviso com a data, que a pessoa fecha nesta aba;
//   - a limpeza deste aparelho apagou agora as lojas do chat do beta: uma vez, que foram apagadas (com a data, se houver);
//   - sem data marcada, nada antes: o site não inventa data.
//
// Sem "@/" de propósito: os testes rodam este arquivo direto no Node.

export type AvisoDaTrocaNaTela =
  | { tipo: "antes"; data: string }
  | { tipo: "depois"; data: string | null }
  | null;

/**
 * `avisar`: avisarTroca() (há data e ela não passou); `data`: dataDaTrocaNaTela() (DD/MM/AAAA ou nula); `limpou`: a limpeza deste
 * aparelho apagou agora o chat do beta; `fechado`: a pessoa já fechou o aviso de antes nesta aba.
 */
export function avisoDaTroca(a: { avisar: boolean; data: string | null; limpou: boolean; fechado: boolean }): AvisoDaTrocaNaTela {
  if (a.limpou) return { tipo: "depois", data: a.data };
  if (a.avisar && a.data && !a.fechado) return { tipo: "antes", data: a.data };
  return null;
}
