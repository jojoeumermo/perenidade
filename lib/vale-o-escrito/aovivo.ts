// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito: o que fazer com uma linha que chega ao vivo (o aviso do Broadcast manda só {id, acao}; a entrada vem de public.vale_publicada). Puro: sem
// disco, sem "@/", sem rede (o canal em si fica em components/vale-o-escrito/useAoVivo.ts). A linha vem do banco, então
// NÃO é confiável: passa pelas mesmas regras de regras.ts que os arquivos (entrada sem fonte ou sem situação não aparece)
// e as pessoas só entram se já constam do conjunto conferido (nome de pessoa nunca chega pelo canal).

import { validarEntrada } from "./regras";
import type { DadosDoObservatorio } from "./visual";
import type { Entrada } from "./tipos";

/** O formato da linha de public.vale_publicada(id) (ou da tabela interna, nos testes). */
export interface LinhaDeEntrada {
  id?: string;
  dossie?: string;
  doc?: unknown;
  retirado_em?: string | null;
}

export type ResultadoDaLinha = { tipo: "pôr"; entrada: Entrada } | { tipo: "tirar"; id: string } | { tipo: "ignorar"; motivo: string };

/**
 * Converte a linha buscada em ação: pôr (acrescentar ou trocar), tirar ou ignorar. Linha retirada ou inválida
 * nunca é posta. Referências a pessoas ou organizações desconhecidas são cortadas (o canal não traz nomes), e o que
 * sobrou é conferido de novo, com arquivo do Internet Archive obrigatório (entrada publicada).
 */
export function acaoDaLinha(linha: LinhaDeEntrada | null | undefined, conhecidos: Pick<DadosDoObservatorio, "pessoas" | "organizacoes">): ResultadoDaLinha {
  if (!linha || typeof linha !== "object") return { tipo: "ignorar", motivo: "linha vazia" };
  if (linha.retirado_em) return { tipo: "tirar", id: String(linha.id ?? "") };
  const doc = linha.doc as Entrada | undefined;
  if (!doc || typeof doc !== "object" || typeof doc.id !== "string") return { tipo: "ignorar", motivo: "sem documento" };
  if (linha.id && doc.id !== linha.id) return { tipo: "ignorar", motivo: "id diferente do documento" };
  const pessoasConhecidas = new Set(conhecidos.pessoas.map((p) => p.id));
  const orgsConhecidas = new Set(conhecidos.organizacoes.map((o) => o.id));
  const limpa: Entrada = {
    ...doc,
    pessoas: Array.isArray(doc.pessoas) ? doc.pessoas.filter((p) => pessoasConhecidas.has(p?.pessoaId)) : [],
    organizacoes: Array.isArray(doc.organizacoes) ? doc.organizacoes.filter((o) => orgsConhecidas.has(o)) : [],
  };
  const c = validarEntrada(limpa, { publicada: true });
  if (!c.ok) return { tipo: "ignorar", motivo: c.erros.join("; ") };
  return { tipo: "pôr", entrada: limpa };
}
