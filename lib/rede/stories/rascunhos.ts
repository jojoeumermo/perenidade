// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// P5 (A16): os rascunhos de story, SÓ no aparelho (IndexedDB "lucia-alumia-rascunhos"; nada vai ao servidor). Guardam os quadros
// como estão na tela de criar, com a foto e o vídeo do jeito que a pessoa escolheu (o endereço "blob:" não sobrevive: a tela refaz
// ao abrir). Cuidados: até 10 rascunhos e 30 dias (o mais velho sai); nada é guardado no modo seguro; a base está na lista da saída
// do site (lib/modo-seguro.ts), então "Sair de tudo" a apaga; vídeo acima de 100 MB não vira rascunho. A parte pura (podar,
// resumir) roda no Node nos testes. Sem "@/".
import type { PublicoDoStory } from "../tipos-stories";
import type { Quadro } from "./quadros";
import { estaLigado as modoSeguro } from "../../modo-seguro";

export const BASE_DOS_RASCUNHOS = "lucia-alumia-rascunhos";
const LOJA = "rascunhos";
export const MAXIMO_DE_RASCUNHOS = 10;
export const VIDA_DO_RASCUNHO = 30 * 24 * 60 * 60 * 1000;
export const VIDEO_MAXIMO_NO_RASCUNHO = 100 * 1024 * 1024;

/** Um quadro como vai para a base: sem os endereços locais (o Blob vai inteiro). */
export type QuadroGuardado = Omit<Quadro, "midia"> & { midia: { tipo: "imagem"; blob: Blob } | { tipo: "video"; blob: Blob; duracao: number } | null };

export interface Rascunho {
  id: string;
  atualizado: number;
  publico: PublicoDoStory;
  comunidade: string | null;
  quadros: QuadroGuardado[];
}

/** O que a lista mostra de cada rascunho (sem abrir a mídia). */
export interface ResumoDoRascunho {
  id: string;
  atualizado: number;
  quadros: number;
  /** O texto do primeiro quadro que tem texto (até 60 letras). */
  texto: string;
  cor: Quadro["cor"];
  /** A primeira foto (para a miniatura). */
  foto: Blob | null;
}

/** Os que ficam: os de até 30 dias, os 10 mais novos. Puro. */
export function podarRascunhos<R extends { id: string; atualizado: number }>(lista: readonly R[], agora: number): { ficam: R[]; saem: string[] } {
  const ordem = [...lista].sort((a, b) => b.atualizado - a.atualizado);
  const ficam = ordem.filter((r) => agora - r.atualizado <= VIDA_DO_RASCUNHO).slice(0, MAXIMO_DE_RASCUNHOS);
  const vivos = new Set(ficam.map((r) => r.id));
  return { ficam, saem: ordem.filter((r) => !vivos.has(r.id)).map((r) => r.id) };
}

/** O resumo para a lista. Puro. */
export function resumir(r: Rascunho): ResumoDoRascunho {
  const comTexto = r.quadros.find((q) => q.texto.trim());
  const foto = r.quadros.find((q) => q.midia?.tipo === "imagem")?.midia?.blob ?? null;
  return { id: r.id, atualizado: r.atualizado, quadros: r.quadros.length, texto: (comTexto?.texto.trim() ?? "").slice(0, 60), cor: r.quadros[0]?.cor ?? "azul", foto };
}

/** Os quadros da tela como vão para a base (sem os endereços locais). Erro "grande" se um vídeo passa do limite. Puro. */
export function paraGuardar(quadros: readonly Quadro[]): QuadroGuardado[] {
  return quadros.map((q) => {
    if (q.midia?.tipo === "video" && q.midia.blob.size > VIDEO_MAXIMO_NO_RASCUNHO) throw new Error("grande");
    const midia = q.midia ? (q.midia.tipo === "video" ? { tipo: "video" as const, blob: q.midia.blob, duracao: q.midia.duracao } : { tipo: "imagem" as const, blob: q.midia.blob }) : null;
    return { ...q, midia };
  });
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((pronto, falhou) => {
    if (typeof indexedDB === "undefined") return falhou(new Error("sem_armazenamento"));
    const p = indexedDB.open(BASE_DOS_RASCUNHOS, 1);
    p.onupgradeneeded = () => {
      if (!p.result.objectStoreNames.contains(LOJA)) p.result.createObjectStore(LOJA, { keyPath: "id" });
    };
    p.onsuccess = () => pronto(p.result);
    p.onerror = () => falhou(p.error ?? new Error("sem_armazenamento"));
  });
}

function pedir<T>(fazer: (loja: IDBObjectStore) => IDBRequest<T>, modo: IDBTransactionMode): Promise<T> {
  return abrir().then(
    (base) =>
      new Promise<T>((pronto, falhou) => {
        const tr = base.transaction(LOJA, modo);
        const p = fazer(tr.objectStore(LOJA));
        tr.oncomplete = () => {
          base.close();
          pronto(p.result);
        };
        tr.onerror = () => {
          base.close();
          falhou(tr.error ?? new Error("falha"));
        };
        tr.onabort = () => {
          base.close();
          falhou(tr.error ?? new Error("falha"));
        };
      }),
  );
}

/** Todos os rascunhos (já podados: os vencidos e os além de 10 saem da base aqui). */
export async function listarRascunhos(agora = Date.now()): Promise<Rascunho[]> {
  const todos = (await pedir((l) => l.getAll() as IDBRequest<Rascunho[]>, "readonly")) ?? [];
  const { ficam, saem } = podarRascunhos(todos, agora);
  for (const id of saem) await apagarRascunho(id).catch(() => undefined);
  return ficam;
}

/** Guarda (ou atualiza) um rascunho. Erros: "modo_seguro", "grande", "sem_armazenamento", "falha". */
export async function guardarRascunho(r: Omit<Rascunho, "quadros" | "atualizado"> & { quadros: readonly Quadro[] }): Promise<Rascunho> {
  if (modoSeguro()) throw new Error("modo_seguro");
  const pronto: Rascunho = { id: r.id, publico: r.publico, comunidade: r.comunidade, atualizado: Date.now(), quadros: paraGuardar(r.quadros) };
  await pedir((l) => l.put(pronto), "readwrite");
  await listarRascunhos().catch(() => undefined);
  return pronto;
}

export function apagarRascunho(id: string): Promise<undefined> {
  return pedir((l) => l.delete(id) as IDBRequest<undefined>, "readwrite");
}

export function apagarTodosOsRascunhos(): Promise<undefined> {
  return pedir((l) => l.clear() as IDBRequest<undefined>, "readwrite");
}

/** Um id para o rascunho novo (só identifica o rascunho na base do aparelho). */
export function novoIdDeRascunho(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Navegador sem randomUUID: o id continua aleatório de verdade. Math.random não serve (sorteio previsível — regra da rede).
  if (!c?.getRandomValues) throw new Error("sem_criptografia");
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  return `${Date.now().toString(36)}-${Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("")}`;
}
