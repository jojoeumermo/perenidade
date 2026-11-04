// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito, pacote "publico": a parte pura dos dois formulários sem conta (enviar uma fonte e pedir correção ou
// direito de resposta). Monta o pedido que vai para as funções do banco (vale_enviar, vale_corrigir) e confere antes de
// enviar, com as mesmas regras de regras.ts. Sem "@/" e sem disco, de propósito: roda no Node (npm run testar:vale-o-escrito)
// e é leve o bastante para o componente de cliente.
//
// Proteção contra spam, sem rastreamento e sem CAPTCHA de terceiros:
//  1. campo-isca "site" (gente não vê, robô preenche; tem de vir vazio);
//  2. tempo mínimo de preenchimento: o botão só libera depois de TEMPO_MINIMO_DA_TELA_MS, e o pedido leva "tempoMs"; o
//     banco descarta em silêncio o que chega antes de TEMPO_MINIMO_NO_BANCO_MS (supabase/migracoes/2026-11-vale-o-escrito.sql);
//  3. limite por origem no banco (interno.limite), e o hash da origem que fica nas linhas leva o sal do dia
//     (interno.vale_hash_origem). O endereço de rede nunca é guardado em claro.
//
// Base legal (conferida no planalto.gov.br em 04/11/2026):
//  - Lei 13.188/2015, art. 3º, caput e §2º: o direito de resposta ou retificação é do ofendido e, em certos casos, do
//    representante legal e de familiares próximos. A lei não lista os dados de identificação; por isso, no direito de
//    resposta, pedimos nome, qualidade de quem pede e contato (validarCorrecao exige nome e contato).
//  - LGPD (Lei 13.709/2018), art. 7º, II (obrigação legal, no pedido de correção) e IX (legítimo interesse, no envio de
//    fontes); art. 18 (direitos do titular) é atendido pelo mesmo formulário.

import type { Correcao, EnvioDoPublico } from "./tipos";

/** O botão do formulário só libera depois deste tempo (ms) com a página aberta. */
export const TEMPO_MINIMO_DA_TELA_MS = 4000;
/** O banco descarta em silêncio o que chega antes disto (ms). Menor que o da tela, para não pegar gente lenta de rede. */
export const TEMPO_MINIMO_NO_BANCO_MS = 3000;

/** Quem pede o direito de resposta (Lei 13.188/2015, art. 3º, caput e §2º). */
export const QUALIDADES_DE_QUEM_PEDE = ["ofendido", "representante", "familiar"] as const;
export type QualidadeDeQuemPede = (typeof QUALIDADES_DE_QUEM_PEDE)[number];

/** Rótulo da qualidade que vai escrito no começo do texto do pedido (a curadoria lê em português). */
export const ROTULO_DA_QUALIDADE: Record<QualidadeDeQuemPede, string> = {
  ofendido: "a própria pessoa citada",
  representante: "representante legal da pessoa ou organização citada",
  familiar: "cônjuge, descendente, ascendente ou irmão da pessoa citada (no exterior ou falecida; art. 3º, §2º, II)",
};

/** Código de uma ficha: letras minúsculas sem acento, números e hífen (o mesmo formato de Entrada.id). */
export const CODIGO_DE_FICHA = /^[a-z0-9][a-z0-9-]{1,79}$/;

/** Os campos como a pessoa os digita no formulário de envio. */
export interface CamposDoEnvio {
  url: string;
  descricao: string;
  trecho: string;
  dossie: string;
  contato: string;
  leuOAviso: boolean;
  /** Campo-isca. */
  isca: string;
}

/** O que vai para vale_enviar: o envio, mais o tempo (ms) que a pessoa levou para preencher. */
export type PedidoDeEnvio = EnvioDoPublico & { tempoMs: number };

/** Monta o pedido de envio (só texto limpo; campo vazio não vai). */
export function montarEnvio(c: CamposDoEnvio, tempoMs: number): PedidoDeEnvio {
  return {
    url: c.url.trim(),
    descricao: c.descricao.trim(),
    ...(c.trecho.trim() ? { trecho: c.trecho.trim() } : {}),
    ...(c.dossie ? { dossie: c.dossie } : {}),
    ...(c.contato.trim() ? { contato: c.contato.trim() } : {}),
    leuOAviso: c.leuOAviso,
    site: c.isca,
    tempoMs: Math.max(0, Math.round(tempoMs)),
  };
}

/** Os campos como a pessoa os digita no formulário de correção. */
export interface CamposDaCorrecao {
  entradaId: string;
  tipo: Correcao["tipo"];
  texto: string;
  comprovanteUrl: string;
  nome: string;
  contato: string;
  qualidade: QualidadeDeQuemPede;
  /** Campo-isca. */
  isca: string;
}

/** O que vai para vale_corrigir: a correção, mais o tempo (ms) de preenchimento. */
export type PedidoDeCorrecao = Correcao & { tempoMs: number };

/**
 * Monta o pedido de correção. No direito de resposta a qualidade de quem pede entra no começo do texto
 * ("[Qualidade: ...] ..."), porque a tabela guarda só nome e contato; a curadoria confere a legitimidade ali.
 */
export function montarCorrecao(c: CamposDaCorrecao, tempoMs: number): PedidoDeCorrecao {
  const texto = c.texto.trim();
  return {
    entradaId: c.entradaId.trim().toLowerCase(),
    tipo: c.tipo,
    texto: c.tipo === "direito_de_resposta" ? `[Qualidade: ${ROTULO_DA_QUALIDADE[c.qualidade]}] ${texto}` : texto,
    ...(c.comprovanteUrl.trim() ? { comprovanteUrl: c.comprovanteUrl.trim() } : {}),
    ...(c.nome.trim() ? { nome: c.nome.trim() } : {}),
    ...(c.contato.trim() ? { contato: c.contato.trim() } : {}),
    site: c.isca,
    tempoMs: Math.max(0, Math.round(tempoMs)),
  };
}

/** O erro do banco ("muitos_pedidos", "invalido:...", "sem_conexao") em uma das duas mensagens do formulário. */
export function tipoDeErro(codigo: string | undefined): "muitos" | "invalido" | "erro" {
  if (!codigo) return "erro";
  if (codigo === "muitos_pedidos") return "muitos";
  if (codigo.startsWith("invalido")) return "invalido";
  return "erro";
}
