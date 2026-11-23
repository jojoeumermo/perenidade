// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras puras do compositor do prompt 4 (itens 26, 27, 28, 29, 117 e 118), atrás do interruptor "alumia-p4-compositor":
// álbum de até 20 imagens, capa e capítulos do texto longo, "Mande a sua", versão curta e fonte. Sem estado, sem navegador e sem
// "@/", para os testes (scripts/testar-p4-compositor.mjs) rodarem no Node. O banco confere tudo de novo
// (supabase/migracoes/20261127-p4-compositor.sql).
import { fonteDoLinkOk, valeDoEndereco } from "../tipos-conversa";
import { LIMITE_DE_IMAGENS, LIMITE_DO_ALBUM } from "./compositor";

// ───── 27. Álbum ─────

/** O álbum (item 27): até 20 imagens por post, cada uma com a legenda da onda 12. */
export { LIMITE_DO_ALBUM };

/** O teto de imagens que a tela oferece: 20 com o interruptor ligado, 10 (a onda 12) sem ele. O banco faz igual. */
export function limiteDeImagens(albumLigado: boolean): number {
  return albumLigado ? LIMITE_DO_ALBUM : LIMITE_DE_IMAGENS;
}

// ───── 28. Imagens sem descrição ─────

/** A chave do filtro no aparelho. Começa com "lucia:rede": o "Sair rápido" a apaga junto com o resto da Rede. */
export const CHAVE_SEM_DESCRICAO = "lucia:rede:esconder-sem-descricao";

/** O post tem alguma imagem sem descrição (ALT vazio)? */
export function temImagemSemDescricao(post: { midia?: readonly { alt?: string | null }[] | null }): boolean {
  return Array.isArray(post.midia) && post.midia.some((m) => !(m?.alt ?? "").trim());
}

/** Tira da linha os posts com imagem sem descrição, quando quem lê pediu. Os outros ficam na mesma ordem. */
export function semImagensSemDescricao<T extends { midia?: readonly { alt?: string | null }[] | null }>(posts: readonly T[], esconder: boolean): T[] {
  return esconder ? posts.filter((p) => !temImagemSemDescricao(p)) : [...posts];
}

type Leitor = { getItem(chave: string): string | null };
type Escritor = { setItem(chave: string, valor: string): void; removeItem(chave: string): void };

/** O filtro está ligado neste aparelho? Armazenamento bloqueado ou estranho: desligado. */
export function lerEsconderSemDescricao(armazem: Leitor | null | undefined): boolean {
  try {
    return armazem?.getItem(CHAVE_SEM_DESCRICAO) === "1";
  } catch {
    return false;
  }
}

/** Liga ou desliga o filtro neste aparelho (só aqui: o servidor não sabe). */
export function gravarEsconderSemDescricao(armazem: Escritor | null | undefined, ligar: boolean): void {
  try {
    if (ligar) armazem?.setItem(CHAVE_SEM_DESCRICAO, "1");
    else armazem?.removeItem(CHAVE_SEM_DESCRICAO);
  } catch {
    // armazenamento bloqueado: o filtro fica desligado
  }
}

// ───── 29. "Mande a sua" ─────

/** O total do convite que a tela mostra: só a partir de 3 pessoas; abaixo disso, nenhum número (nulo). */
export function totalDoConvite(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) && n >= 3 ? Math.floor(n) : null;
}

// ───── 117. Versão curta ─────

/** A versão curta do texto longo: até 280 letras. */
export const LIMITE_DO_RESUMO = 280;

// ───── O pedido ─────

/** O que a autora escolheu no compositor do prompt 4. */
export interface EscolhasDoP4 {
  /** 117: a versão curta (só no texto longo). */
  resumo: string;
  /** 26: a ordem da imagem que é a capa (só no texto longo com imagem); nulo, sem capa. */
  capa: number | null;
  /** 29: o post é um convite "Mande a sua" (só post de abertura). */
  convite: boolean;
  /** 118: a fonte (um link ou o endereço de uma checagem do Vale o Escrito). */
  fonte: string;
}

export const ESCOLHAS_VAZIAS: EscolhasDoP4 = { resumo: "", capa: null, convite: false, fonte: "" };

/** O que vai no pedido ao banco (só o que a autora preencheu). */
export interface CamposDoP4 {
  resumo?: string;
  capa?: number;
  convite?: true;
  fonte?: { link?: string; vale?: string };
}

/** A fonte colada vira { vale } (o endereço ou o identificador de um caso do Vale o Escrito) ou { link }; inválida, nulo. */
export function fonteDoCampo(colado: string): { link?: string; vale?: string } | null {
  const t = colado.trim();
  if (!t) return null;
  const vale = /\/vale-o-escrito\/caso\//i.test(t) || !/^https?:/i.test(t) ? valeDoEndereco(t) : null;
  if (vale) return { vale };
  return fonteDoLinkOk(t) ? { link: t } : null;
}

/** As escolhas estão certas para este pedido? Devolve o primeiro problema (código) ou nulo. */
export function problemaDasEscolhas(e: EscolhasDoP4, ctx: { longo: boolean; resposta: boolean; tipo: string; imagens: number }): string | null {
  if (e.resumo.trim() && (!ctx.longo || e.resumo.trim().length > LIMITE_DO_RESUMO)) return "invalido_resumo";
  if (e.capa !== null && (!ctx.longo || e.capa < 0 || e.capa >= ctx.imagens)) return "invalido_capa";
  if (e.convite && (ctx.resposta || ctx.tipo !== "post" || ctx.longo)) return "invalido_convite";
  if (e.fonte.trim() && (ctx.resposta || !fonteDoCampo(e.fonte))) return "invalido_fonte";
  return null;
}

/** Os campos do pedido. Só o que vale para este pedido entra (a capa que caiu fora das imagens, por exemplo, sai). */
export function camposDoP4(e: EscolhasDoP4, ctx: { longo: boolean; resposta: boolean; tipo: string; imagens: number }): CamposDoP4 {
  const c: CamposDoP4 = {};
  if (ctx.resposta) return c;
  const resumo = e.resumo.trim();
  if (ctx.longo && resumo) c.resumo = resumo.slice(0, LIMITE_DO_RESUMO);
  if (ctx.longo && e.capa !== null && e.capa >= 0 && e.capa < ctx.imagens) c.capa = e.capa;
  if (!ctx.longo && ctx.tipo === "post" && e.convite) c.convite = true;
  const fonte = fonteDoCampo(e.fonte);
  if (fonte) c.fonte = fonte;
  return c;
}

/** O pedido leva alguma escolha do prompt 4 (e então vai pela função dele)? */
export function usaP4(c: CamposDoP4): boolean {
  return Object.keys(c).length > 0;
}

/** O que o cartão recebe do banco (rede_pub_p4_extras). */
export interface ExtrasDoP4 {
  resumo?: string;
  /** O id da imagem que é a capa. */
  capa?: string;
  /** Quantos capítulos (só a partir de 2). */
  capitulos?: number;
  convite?: boolean;
  /** Pessoas diferentes que responderam ao convite; só a partir de 3. */
  total?: number;
  fonte?: { link?: string; vale?: string };
}
