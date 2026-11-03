// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Transparência do acompanhante (Etapa 4, E4-10, R1-64): os provedores de IA que PODEM responder ao assistente, com o
// mesmo id e o mesmo nome de supabase/functions/assistente/provedores.ts (a Edge Function não pode ser importada pelo
// site). `npm run testar:acompanhante` lê aquele arquivo e falha se esta lista divergir. Quais estão ligados, e em que
// ordem, a coordenação escolhe no painel (Controles do site); o site público não sabe e não diz.
// Sem os atalhos "@/" de propósito (roda no Node nos testes).

export interface ProvedorPublico {
  id: string;
  nome: string;
  /** Entende foto? (quem não entende é pulado nos pedidos com imagem) */
  visao: boolean;
}

export const PROVEDORES_PUBLICOS: readonly ProvedorPublico[] = [
  { id: "anthropic", nome: "Claude (Anthropic)", visao: true },
  { id: "groq", nome: "Groq", visao: false },
  { id: "cerebras", nome: "Cerebras", visao: false },
  { id: "gemini", nome: "Gemini (Google)", visao: true },
  { id: "openrouter", nome: "OpenRouter", visao: false },
];

/**
 * O limite diário padrão, para quando o banco não diz: os valores de partida de interno.assistente_config() em
 * supabase/install.sql (10 perguntas por conta e 200 no site inteiro, por dia). A coordenação pode mudar no painel; a
 * RPC pública assistente_estado hoje devolve só "ligado", então a página mostra o padrão com essa ressalva.
 */
export const LIMITE_PADRAO = { porPessoa: 10, porDia: 200 } as const;

/** O limite que o banco devolveu (se um dia assistente_estado trouxer "por_pessoa"), ou null. */
export function limiteDoEstado(estado: unknown): number | null {
  const v = (estado as { por_pessoa?: unknown } | null)?.por_pessoa;
  return typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 5000 ? v : null;
}
