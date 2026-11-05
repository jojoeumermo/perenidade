// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O estado da casca do painel (Zustand): as preferências da pessoa (menu recolhido, grupos abertos, fixadas, recentes,
// larguras das colunas, modo foco, modo leve, densidade), o que está aberto agora (menu do celular, paleta), os comandos
// que a seção aberta registrou para a paleta e os remendos da Optimistic UI (o que a tela já mostra antes do banco
// responder). Só as preferências se guardam, e só neste aparelho. Sem armazenamento (janela privada, bloqueio), tudo
// funciona e só não fica guardado. Contrato: docs/PAINEL-REDESENHO.md, seção 8.

import type { LucideIcon } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

export type Densidade = "confortavel" | "compacta";

export interface PreferenciasDaCasca {
  menuRecolhido: boolean;
  /** "espaco:<id>", "departamento", "fixadas" → aberto ou fechado (só o que a pessoa mexeu). */
  gruposAbertos: Record<string, boolean>;
  /** Ids de seção fixados, na ordem em que foram fixados (até 12). */
  favoritos: string[];
  /** As últimas seções usadas (até 6, sem a Mesa). */
  recentes: string[];
  /** Id do grupo de painéis → porcentagens de cada coluna. */
  larguras: Record<string, number[]>;
  modoFoco: boolean;
  modoLeve: boolean;
  densidade: Densidade;
}

/** Um comando que a seção aberta oferece na paleta (aprovar, devolver, reservar, marcar como lida…). */
export interface ComandoDaSecao {
  id: string;
  nome: string;
  sobre?: string;
  simbolo?: LucideIcon;
  /** Tecla que a própria seção já atende (só aparece na paleta como lembrete). */
  atalho?: string;
  /** Passa pelo confirmar() antes de agir. */
  perigo?: boolean;
  /** Abre uma segunda página da paleta para escolher uma pessoa da equipe. */
  pedePessoa?: boolean;
  fazer: (pessoa?: { id: string; nome: string }) => void | Promise<void>;
}

/** O que a tela mostra antes de o banco confirmar: uma função que transforma os dados da lista. */
export interface Remendo {
  id: string;
  /** Quando o banco confirmou (Infinity enquanto espera): leitura que começou depois disso já traz a mudança. */
  desde: number;
  aplicar: (dados: unknown) => unknown;
}

interface EstadoDaCasca extends PreferenciasDaCasca {
  menuCelular: boolean;
  paleta: boolean;
  comandos: Record<string, ComandoDaSecao[]>;
  remendos: Record<string, Remendo[]>;
  alternarMenu: (recolhido?: boolean) => void;
  abrirMenuCelular: (aberto: boolean) => void;
  alternarGrupo: (chave: string, padrao: boolean) => void;
  abrirGrupo: (chave: string) => void;
  fixar: (id: string) => void;
  lembrar: (id: string) => void;
  guardarLarguras: (id: string, larguras: number[]) => void;
  alternarFoco: () => void;
  alternarLeve: () => void;
  definirDensidade: (densidade: Densidade) => void;
  abrirPaleta: (aberta: boolean | ((agora: boolean) => boolean)) => void;
  registrarComandos: (dono: string, lista: ComandoDaSecao[]) => void;
  tirarComandos: (dono: string) => void;
  remendar: (chave: string, remendo: Remendo) => void;
  confirmarRemendo: (chave: string, id: string) => void;
  tirarRemendo: (chave: string, id: string) => void;
  soltarRemendos: (chave: string, ate: number) => void;
}

/** O armazenamento do navegador, mas sem nunca derrubar a tela: cada acesso em try/catch. */
const armazenamentoSeguro: StateStorage = {
  getItem: (nome) => {
    try {
      return window.localStorage.getItem(nome);
    } catch {
      return null;
    }
  },
  setItem: (nome, valor) => {
    try {
      window.localStorage.setItem(nome, valor);
    } catch {
      // Sem espaço ou bloqueado: vale até fechar o painel.
    }
  },
  removeItem: (nome) => {
    try {
      window.localStorage.removeItem(nome);
    } catch {
      // idem
    }
  },
};

const ID_DE_SECAO = /^[a-z-]{2,30}$/;
const listaDeIds = (lista: unknown, limite: number) => (Array.isArray(lista) ? lista.filter((x): x is string => typeof x === "string" && ID_DE_SECAO.test(x)).slice(0, limite) : []);

const PADRAO: PreferenciasDaCasca = {
  menuRecolhido: false,
  gruposAbertos: {},
  favoritos: [],
  recentes: [],
  larguras: {},
  modoFoco: false,
  modoLeve: false,
  densidade: "confortavel",
};

/**
 * Na primeira vez (nada guardado com o nome novo), lê as chaves antigas do painel uma vez: ninguém perde o que já tinha
 * escolhido (menu recolhido, grupos abertos, atalhos fixados, modo foco, modo leve).
 */
function lerChavesAntigas(): Partial<PreferenciasDaCasca> {
  if (typeof window === "undefined") return {};
  const ler = (chave: string) => armazenamentoSeguro.getItem(chave) as string | null;
  const json = (chave: string): unknown => {
    try {
      return JSON.parse(ler(chave) || "null");
    } catch {
      return null;
    }
  };
  const grupos = json("lucia:painel-grupos");
  const atalhos = json("lucia:painel-atalhos") as { fixadas?: unknown; recentes?: unknown } | null;
  return {
    menuRecolhido: ler("lucia:painel-compacto") === "1",
    modoFoco: ler("lucia:painel-foco") === "1",
    modoLeve: ler("lucia:painel-leve") === "1",
    gruposAbertos: grupos && typeof grupos === "object" && !Array.isArray(grupos) ? Object.fromEntries(Object.entries(grupos).filter(([, v]) => typeof v === "boolean")) : {},
    favoritos: listaDeIds(atalhos?.fixadas, 12),
    recentes: listaDeIds(atalhos?.recentes, 6),
  };
}

/** Confere o que veio do armazenamento: qualquer coisa estranha volta ao padrão, campo por campo. */
function limpar(guardado: unknown): Partial<PreferenciasDaCasca> {
  if (!guardado || typeof guardado !== "object") return {};
  const g = guardado as Record<string, unknown>;
  const larguras: Record<string, number[]> = {};
  if (g.larguras && typeof g.larguras === "object") {
    for (const [id, valores] of Object.entries(g.larguras as Record<string, unknown>)) {
      if (Array.isArray(valores) && valores.every((v) => typeof v === "number" && v > 0 && v <= 100)) larguras[id] = valores as number[];
    }
  }
  return {
    menuRecolhido: g.menuRecolhido === true,
    modoFoco: g.modoFoco === true,
    modoLeve: g.modoLeve === true,
    densidade: g.densidade === "compacta" ? "compacta" : "confortavel",
    gruposAbertos: g.gruposAbertos && typeof g.gruposAbertos === "object" ? Object.fromEntries(Object.entries(g.gruposAbertos as Record<string, unknown>).filter(([, v]) => typeof v === "boolean")) as Record<string, boolean> : {},
    favoritos: listaDeIds(g.favoritos, 12),
    recentes: listaDeIds(g.recentes, 6),
    larguras,
  };
}

export const usePainel = create<EstadoDaCasca>()(
  persist(
    (set) => ({
      ...PADRAO,
      menuCelular: false,
      paleta: false,
      comandos: {},
      remendos: {},
      alternarMenu: (recolhido) => set((s) => ({ menuRecolhido: recolhido ?? !s.menuRecolhido })),
      abrirMenuCelular: (aberto) => set({ menuCelular: aberto }),
      alternarGrupo: (chave, padrao) => set((s) => ({ gruposAbertos: { ...s.gruposAbertos, [chave]: !(s.gruposAbertos[chave] ?? padrao) } })),
      abrirGrupo: (chave) => set((s) => ({ gruposAbertos: { ...s.gruposAbertos, [chave]: true } })),
      fixar: (id) => set((s) => ({ favoritos: s.favoritos.includes(id) ? s.favoritos.filter((x) => x !== id) : [...s.favoritos, id].slice(0, 12) })),
      lembrar: (id) => set((s) => (id === "mesa" || !ID_DE_SECAO.test(id) || s.recentes[0] === id ? s : { recentes: [id, ...s.recentes.filter((x) => x !== id)].slice(0, 6) })),
      guardarLarguras: (id, larguras) => set((s) => ({ larguras: { ...s.larguras, [id]: larguras.map((n) => Math.round(n * 10) / 10) } })),
      alternarFoco: () => set((s) => ({ modoFoco: !s.modoFoco })),
      alternarLeve: () => set((s) => ({ modoLeve: !s.modoLeve })),
      definirDensidade: (densidade) => set({ densidade }),
      abrirPaleta: (aberta) => set((s) => ({ paleta: typeof aberta === "function" ? aberta(s.paleta) : aberta })),
      registrarComandos: (dono, lista) => set((s) => ({ comandos: { ...s.comandos, [dono]: lista } })),
      tirarComandos: (dono) =>
        set((s) => {
          if (!(dono in s.comandos)) return s;
          const resto = { ...s.comandos };
          delete resto[dono];
          return { comandos: resto };
        }),
      remendar: (chave, remendo) => set((s) => ({ remendos: { ...s.remendos, [chave]: [...(s.remendos[chave] ?? []), remendo] } })),
      confirmarRemendo: (chave, id) => set((s) => ({ remendos: { ...s.remendos, [chave]: (s.remendos[chave] ?? []).map((r) => (r.id === id ? { ...r, desde: Date.now() } : r)) } })),
      tirarRemendo: (chave, id) => set((s) => ({ remendos: { ...s.remendos, [chave]: (s.remendos[chave] ?? []).filter((r) => r.id !== id) } })),
      soltarRemendos: (chave, ate) =>
        set((s) => {
          const lista = s.remendos[chave];
          if (!lista?.some((r) => r.desde < ate)) return s;
          return { remendos: { ...s.remendos, [chave]: lista.filter((r) => r.desde >= ate) } };
        }),
    }),
    {
      name: "lucia:painel-casca",
      version: 1,
      storage: createJSONStorage(() => armazenamentoSeguro),
      // Só as preferências se guardam: o menu do celular, a paleta, os comandos e os remendos são do momento.
      partialize: (s): PreferenciasDaCasca => ({
        menuRecolhido: s.menuRecolhido,
        gruposAbertos: s.gruposAbertos,
        favoritos: s.favoritos,
        recentes: s.recentes,
        larguras: s.larguras,
        modoFoco: s.modoFoco,
        modoLeve: s.modoLeve,
        densidade: s.densidade,
      }),
      migrate: (guardado) => limpar(guardado) as EstadoDaCasca,
      // Nada guardado ainda: as chaves antigas, uma vez. Guardado: conferido campo por campo.
      merge: (guardado, atual) => ({ ...atual, ...(guardado ? limpar(guardado) : lerChavesAntigas()) }),
    },
  ),
);

/**
 * A seção registra os comandos dela na paleta enquanto está montada (e tira ao sair). "deps" diz quando a lista muda
 * (por exemplo, o id do item aberto). Os comandos só chamam funções que a seção já tem.
 */
export function useComandosDaSecao(comandos: ComandoDaSecao[], deps: unknown[]): void {
  const dono = useId();
  const atuais = useRef(comandos);
  useEffect(() => {
    atuais.current = comandos;
  });
  const registrar = usePainel((s) => s.registrarComandos);
  const tirar = usePainel((s) => s.tirarComandos);
  const chave = JSON.stringify(deps);
  const ids = comandos.map((c) => c.id).join("|");
  useEffect(() => {
    // A paleta chama sempre a versão de agora da função (sem registrar de novo a cada desenho da seção).
    registrar(
      dono,
      atuais.current.map((c) => ({ ...c, fazer: (pessoa?: { id: string; nome: string }) => (atuais.current.find((x) => x.id === c.id) ?? c).fazer(pessoa) })),
    );
    return () => tirar(dono);
  }, [dono, registrar, tirar, chave, ids]);
}

/** Todos os comandos registrados agora, numa lista só (a paleta mostra em "Nesta seção"). */
export const comandosDeAgora = (s: { comandos: Record<string, ComandoDaSecao[]> }) => Object.values(s.comandos).flat();
