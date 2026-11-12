// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do APARELHO dos posts restritos (C1; docs/rede/POSTS-RESTRITOS.md): guarda o par de grupo da pessoa, publica a parte
// pública, abre a chave de cada grupo (do embrulho feito para ela), cria a versão seguinte quando o grupo mudou e cifra/abre os
// posts. A cifra é a de lib/rede/cifra-grupo.ts; o banco é supabase/migracoes/20261112-rede-grupos-cifrados.sql.
//
// `criarChaveiroDeGrupo` recebe como chamar o banco e onde guardar o par (no navegador: o cliente da Alumia e o IndexedDB próprio,
// apagado pelo "Sair rápido"; nos testes: o banco local e a memória). As chaves dos grupos ficam só na memória da aba. Sem "@/".
import {
  abrirPostDeGrupo, cifrarPostDeGrupo, contextoDoEmbrulhoDeGrupo, desembrulharChaveDeGrupo, embrulharChaveDeGrupo, novaChaveDeGrupo, novoParDeGrupo,
  type ParDeGrupo, publicaDeGrupo, versaoDoPostDeGrupo,
} from "./cifra-grupo";

export type ChamarOBanco = <T>(funcao: string, argumentos: Record<string, unknown>) => Promise<T>;
export interface GuardaDoPar {
  ler: (usuario: string) => Promise<ParDeGrupo | null>;
  guardar: (usuario: string, par: ParDeGrupo) => Promise<void>;
}
interface EstadoDoGrupo {
  atual: number | null;
  membros: { usuario: string; publica: string }[];
  meus: { versao: number; embrulho: string }[];
  precisa_nova: boolean;
}

const codigo = (e: unknown) => String((e as { message?: unknown })?.message ?? e);

export function criarChaveiroDeGrupo({ chamar, guarda }: { chamar: ChamarOBanco; guarda: GuardaDoPar }) {
  /** grupo → versão → chave aberta (só na memória). */
  const chaves = new Map<string, Map<number, Uint8Array>>();

  /** O par desta pessoa: o guardado, ou um novo (publicado no banco). */
  async function meuPar(usuario: string): Promise<ParDeGrupo> {
    const guardado = await guarda.ler(usuario);
    if (guardado) return guardado;
    const par = novoParDeGrupo();
    await chamar("rede_grupo_chave_publicar", { p_publica: publicaDeGrupo(par) });
    await guarda.guardar(usuario, par);
    return par;
  }

  /** Lê o estado do grupo e abre as versões cujo embrulho é desta pessoa. */
  async function carregar(grupo: string, usuario: string): Promise<EstadoDoGrupo> {
    const par = await meuPar(usuario);
    const estado = await chamar<EstadoDoGrupo>("rede_grupo_estado", { p_grupo: grupo });
    const abertas = chaves.get(grupo) ?? new Map<number, Uint8Array>();
    for (const m of estado.meus) {
      if (abertas.has(m.versao)) continue;
      const chave = await desembrulharChaveDeGrupo(m.embrulho, par, contextoDoEmbrulhoDeGrupo(grupo, m.versao, usuario));
      if (chave) abertas.set(m.versao, chave);
    }
    chaves.set(grupo, abertas);
    return estado;
  }

  /** Cria a versão seguinte, embrulhada para cada membro do grupo que tem chave publicada. */
  async function novaVersao(grupo: string, usuario: string, estado: EstadoDoGrupo): Promise<number> {
    const versao = (estado.atual ?? 0) + 1;
    const chave = novaChaveDeGrupo();
    const embrulhos = await Promise.all(
      estado.membros.map(async (m) => ({ para: m.usuario, embrulho: await embrulharChaveDeGrupo(chave, m.publica, contextoDoEmbrulhoDeGrupo(grupo, versao, m.usuario)) })),
    );
    try {
      await chamar("rede_grupo_versao_nova", { p_grupo: grupo, p_versao: versao, p_embrulhos: embrulhos });
    } catch (e) {
      if (codigo(e).includes("versao_ocupada")) return -1;
      throw e;
    }
    chaves.get(grupo)?.set(versao, chave) ?? chaves.set(grupo, new Map([[versao, chave]]));
    return versao;
  }

  return {
    /** Garante o par desta pessoa (cria e publica na primeira vez). */
    preparar: (usuario: string) => meuPar(usuario).then(() => undefined),

    /** Cifra um post para o grupo. Cria a versão seguinte da chave quando o grupo mudou (alguém entrou, saiu ou trocou de par). */
    async cifrar(grupo: string, usuario: string, texto: string): Promise<string> {
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        const estado = await carregar(grupo, usuario);
        if (!estado.membros.some((m) => m.usuario === usuario)) throw new Error("sem_chave");
        let versao = estado.atual;
        if (estado.precisa_nova || versao === null || !chaves.get(grupo)?.has(versao)) versao = await novaVersao(grupo, usuario, estado);
        if (versao === -1) continue;
        const chave = chaves.get(grupo)?.get(versao as number);
        if (!chave) throw new Error("sem_chave");
        return cifrarPostDeGrupo(chave, versao as number, grupo, usuario, texto);
      }
      throw new Error("versao_ocupada");
    },

    /** Abre um post do grupo (nulo se esta pessoa não tem a chave daquela versão, ou se o post foi mexido). */
    async abrir(grupo: string, usuario: string, autor: string, corpo: string): Promise<string | null> {
      const versao = versaoDoPostDeGrupo(corpo);
      if (versao === null) return null;
      if (!chaves.get(grupo)?.has(versao)) await carregar(grupo, usuario).catch(() => undefined);
      const chave = chaves.get(grupo)?.get(versao);
      return chave ? abrirPostDeGrupo(chave, corpo, grupo, autor) : null;
    },

    /** Esquece as chaves da memória (o "Sair rápido" chama). */
    esquecer: () => chaves.clear(),
  };
}

export type ChaveiroDeGrupo = ReturnType<typeof criarChaveiroDeGrupo>;

// ── No navegador: o par fica num IndexedDB próprio ("lucia-alumia-grupos"), que o "Sair rápido" apaga inteiro ──

const BANCO_DOS_GRUPOS = "lucia-alumia-grupos";
const PARES = "pares";

function abrirBancoDosGrupos(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BANCO_DOS_GRUPOS, 1);
    pedido.onupgradeneeded = () => {
      if (!pedido.result.objectStoreNames.contains(PARES)) pedido.result.createObjectStore(PARES);
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

/** A guarda do par no navegador. Sem IndexedDB (alguns modos privados), o par vive só na memória da aba. */
export function guardaNoNavegador(): GuardaDoPar {
  const memoria = new Map<string, ParDeGrupo>();
  const naGaveta = async <T,>(modo: IDBTransactionMode, agir: (g: IDBObjectStore) => IDBRequest): Promise<T> => {
    const banco = await abrirBancoDosGrupos();
    try {
      return await new Promise<T>((resolve, reject) => {
        const pedido = agir(banco.transaction(PARES, modo).objectStore(PARES));
        pedido.onsuccess = () => resolve(pedido.result as T);
        pedido.onerror = () => reject(pedido.error);
      });
    } finally {
      banco.close();
    }
  };
  return {
    async ler(usuario) {
      try {
        return (await naGaveta<ParDeGrupo | undefined>("readonly", (g) => g.get(usuario))) ?? memoria.get(usuario) ?? null;
      } catch {
        return memoria.get(usuario) ?? null;
      }
    },
    async guardar(usuario, par) {
      memoria.set(usuario, par);
      await naGaveta("readwrite", (g) => g.put(par, usuario)).catch(() => undefined);
    },
  };
}

/** O "Sair rápido": apaga do aparelho o par de grupo de todas as contas (nunca lança, nem espera mais que `limiteMs`). */
export async function apagarParesDeGrupo(limiteMs = 300): Promise<void> {
  try {
    if (typeof indexedDB === "undefined") return;
    await new Promise<void>((pronto) => {
      const relogio = setTimeout(pronto, limiteMs);
      const fim = () => {
        clearTimeout(relogio);
        pronto();
      };
      try {
        const pedido = indexedDB.deleteDatabase(BANCO_DOS_GRUPOS);
        pedido.onsuccess = fim;
        pedido.onerror = fim;
      } catch {
        fim();
      }
    });
  } catch {
    // nunca lança: a pessoa precisa sair já
  }
}
