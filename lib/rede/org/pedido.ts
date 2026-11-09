// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conferência do pedido do selo antes de mandar (o banco confere de novo). Puro: roda no Node nos testes. A regra que importa:
// só documento PÚBLICO da organização (CNPJ, registro do partido, diploma, ata); nunca o de uma pessoa (CPF/RG), porque o pedido
// fica guardado e documento de pessoa física é dado pessoal que a Alumia não precisa (LGPD art. 6º, III: necessidade).
// Sem os atalhos "@/" de propósito.
import { LIMITES, TIPOS_DE_ORG, type PedidoDeSelo } from "../tipos-org";

/** O @ de uma organização: 3 a 20 letras minúsculas sem acento, números ou _ (a mesma regra dos perfis). */
export const HANDLE_VALIDO = /^[a-z0-9_]{3,20}$/;

/** Parece um CPF (11 dígitos, com ou sem pontos e traço)? Um CNPJ tem 14 e passa. */
export function pareceCpf(texto: string): boolean {
  return /^\s*\d{3}\.?\d{3}\.?\d{3}-?\d{2}\s*$/.test(texto);
}

export type FaltaNoPedido = "codinome" | "handle" | "tipo" | "cidade" | "documentoTipo" | "documento" | "sobre" | "maior" | "docPessoal";

/** O que falta ou está errado no pedido (nulo = pode mandar). */
export function conferirPedido(p: PedidoDeSelo): FaltaNoPedido | null {
  if (!p.codinome.trim() || p.codinome.length > 60) return "codinome";
  if (!HANDLE_VALIDO.test(p.handle)) return "handle";
  if (!(TIPOS_DE_ORG as readonly string[]).includes(p.tipo)) return "tipo";
  if (!p.cidade.trim() || p.cidade.length > 60) return "cidade";
  if (!p.documentoTipo.trim()) return "documentoTipo";
  if (!p.documento.trim() || p.documento.length > LIMITES.documento) return "documento";
  if (pareceCpf(p.documento)) return "docPessoal";
  if (!p.sobre.trim() || p.sobre.length > LIMITES.sobre) return "sobre";
  if (!p.maior) return "maior";
  return null;
}
