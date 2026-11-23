// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A parede que gira (P5, A1): a cada ~10 segundos, todos os painéis da parede da entrada trocam de figura, entre as silhuetas de
// sempre e as pessoas do Memorial que têm foto de licença livre (lib/rede/entrada/memorial-na-parede.ts). Aqui só a parte pura,
// que roda no navegador e nos testes (sem "@/" de propósito): qual leva de figuras aparece agora e o que pode entrar na parede.
import type { CreditoDaFigura, FiguraDaEntrada } from "./figuras";

/** De quanto em quanto tempo a parede troca. */
export const INTERVALO_DA_PAREDE_MS = 10_000;

/**
 * A licença deixa usar a foto na parede (com o crédito)? Domínio público, CC0 e CC BY / CC BY-SA, de qualquer versão. Fica fora o
 * que proíbe obra derivada (ND) ou uso fora de contexto não comercial (NC), e o que não diz a licença.
 */
export function licencaLivre(licenca: string | null | undefined): boolean {
  const l = (licenca ?? "").trim();
  if (!l || /\b(ND|NC)\b/i.test(l)) return false;
  return /dom[ií]nio p[uú]blico|public domain|^PD\b|^CC0\b|^CC BY(-SA)?\b/i.test(l);
}

/**
 * A leva `n` da parede: `quantas` figuras seguidas do conjunto, dando a volta no fim. A leva 0 é a parede de sempre (as primeiras
 * do conjunto). Nunca repete figura dentro da mesma leva; com menos figuras do que painéis, devolve o conjunto inteiro.
 */
export function levaDaParede<T>(conjunto: readonly T[], n: number, quantas: number): T[] {
  if (conjunto.length <= quantas || quantas <= 0) return [...conjunto];
  const inicio = (((n * quantas) % conjunto.length) + conjunto.length) % conjunto.length;
  return Array.from({ length: quantas }, (_, i) => conjunto[(inicio + i) % conjunto.length]);
}

/** Junta as figuras de sempre com as novas, sem repetir (pelo id e pelo nome), as de sempre primeiro. */
export function juntarFiguras(sempre: readonly FiguraDaEntrada[], novas: readonly FiguraDaEntrada[]): FiguraDaEntrada[] {
  const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  const vistos = new Set<string>();
  const saida: FiguraDaEntrada[] = [];
  for (const f of [...sempre, ...novas]) {
    const chaves = [`id:${f.id}`, `nome:${normal(f.nome)}`];
    if (chaves.some((c) => vistos.has(c))) continue;
    for (const c of chaves) vistos.add(c);
    saida.push(f);
  }
  return saida;
}

/** Uma figura vinda de fora (a resposta da rota) é uma figura de verdade, com foto do próprio site e crédito? */
export function figuraValida(f: unknown): f is FiguraDaEntrada {
  if (!f || typeof f !== "object") return false;
  const x = f as Partial<FiguraDaEntrada> & { credito?: Partial<CreditoDaFigura> };
  return typeof x.id === "string" && /^[a-z0-9-]{1,80}$/.test(x.id) && typeof x.nome === "string" && x.nome.length > 0 && x.nome.length <= 120
    && typeof x.src === "string" && /^(alumia\/entrada|imagens\/memorial)\/[a-z0-9-]+\.webp$/.test(x.src)
    && Boolean(x.credito && typeof x.credito.autor === "string" && x.credito.autor && licencaLivre(x.credito.licenca) && typeof x.credito.fonte === "string" && /^https:\/\//.test(x.credito.fonte));
}
