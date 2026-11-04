// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Silenciar só neste aparelho": a lista fica no navegador (nada vai ao servidor, nada sincroniza) e filtra o que a tela mostra.
// A opção que sincroniza na conta é rede_mod_silenciar. Lógica pura, sem "@/", para o teste rodar no Node.

/** A chave no armazenamento do aparelho. Começa com "lucia:rede": o "Sair rápido" a apaga junto com o resto da Rede. */
export const CHAVE_DO_SILENCIO_LOCAL = "lucia:rede:silenciados";

export interface SilencioLocal {
  tipo: "pessoa" | "palavra" | "comunidade" | "conversa";
  /** @handle (sem o @), palavra, slug da comunidade ou id da conversa (raiz). */
  valor: string;
  /** ISO; vazio = até desfazer. */
  ate?: string | null;
}

/** O que a conferência precisa de um post. */
export interface PostParaFiltrar {
  autor: { handle: string | null };
  titulo: string | null;
  texto: string;
  comunidade: string | null;
  raiz: string;
}

/** Minúsculas e sem acento, para a palavra silenciada valer com ou sem acento. */
export const normalizarTexto = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Este post está silenciado neste aparelho? */
export function silenciadoNoAparelho(post: PostParaFiltrar, lista: SilencioLocal[], agora: number = Date.now()): boolean {
  const corpo = normalizarTexto(`${post.titulo ?? ""} ${post.texto}`);
  return lista.some((s) => {
    if (s.ate && new Date(s.ate).getTime() <= agora) return false;
    if (s.tipo === "pessoa") return post.autor.handle !== null && post.autor.handle === s.valor;
    if (s.tipo === "comunidade") return post.comunidade === s.valor;
    if (s.tipo === "conversa") return post.raiz === s.valor;
    return s.valor.length >= 2 && corpo.includes(normalizarTexto(s.valor));
  });
}

type Leitor = { getItem(chave: string): string | null };
type Escritor = { setItem(chave: string, valor: string): void };

const TIPOS = ["pessoa", "palavra", "comunidade", "conversa"];

/** Lê a lista do aparelho; qualquer coisa estranha vira lista vazia (o armazenamento pode estar bloqueado ou adulterado). */
export function lerSilenciosLocais(armazem: Leitor | null): SilencioLocal[] {
  try {
    const bruto = armazem?.getItem(CHAVE_DO_SILENCIO_LOCAL);
    if (!bruto) return [];
    const lista: unknown = JSON.parse(bruto);
    if (!Array.isArray(lista)) return [];
    return lista
      .filter((x): x is SilencioLocal => {
        const s = x as SilencioLocal | null;
        return typeof s === "object" && s !== null && TIPOS.includes(s.tipo) && typeof s.valor === "string" && s.valor.length > 0 && s.valor.length <= 80;
      })
      .slice(0, 200);
  } catch {
    return [];
  }
}

/** Grava a lista (no máximo 200). Devolve falso se o armazenamento não deixou. */
export function gravarSilenciosLocais(armazem: Escritor | null, lista: SilencioLocal[]): boolean {
  try {
    if (!armazem) return false;
    armazem.setItem(CHAVE_DO_SILENCIO_LOCAL, JSON.stringify(lista.slice(0, 200)));
    return true;
  } catch {
    return false;
  }
}
