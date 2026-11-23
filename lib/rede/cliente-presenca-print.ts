// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, itens 6 e 1: as chamadas do status online por escolha e das escolhas da proteção contra print
// (supabase/migracoes/20261127-p4-presenca-print.sql). Atrás de "alumia-p4-presenca-print" (lib/recursos.ts) e da mesma chave no
// banco. Com NEXT_PUBLIC_ALUMIA_PREVIA=sim, um dublê com dados de exemplo e nada vai ao servidor.
// Privacidade: nenhuma chamada daqui diz ao servidor que alguém VIU um story ou um perfil, nem que tirou print. Sem "@/" de propósito.
import { ligado } from "../recursos";
import { chamar, type Chamar } from "./cliente";
import { alumia2Ligada } from "./rotas-novas";

/** O interruptor do grupo (o banco confere de novo em cada chamada). */
export const FLAG_PRESENCA_PRINT = "alumia-p4-presenca-print" as const;

/** A tela pode usar o grupo? "rede-v2" + "alumia-2" + "alumia-p4-presenca-print". */
export function presencaPrintLigada(): boolean {
  return alumia2Ligada() && ligado(FLAG_PRESENCA_PRINT);
}

export interface MinhasEscolhas {
  /** Mostro "ativo recentemente" à minha roda de confiança? */
  presenca: boolean;
  /** A minha foto de perfil é protegida contra print? */
  foto: boolean;
}

export interface Protegidos<T extends string = string> {
  /** Os ids (stories) ou @ (fotos) protegidos, só entre os que eu já posso ver. */
  itens: T[];
  /** O meu codinome, para a marca d'água. */
  marca: string;
}

export interface ClienteDePresencaEPrint {
  readonly previa: boolean;
  minhas: () => Promise<MinhasEscolhas>;
  ligarPresenca: (sim: boolean) => Promise<MinhasEscolhas>;
  /** "Estou aqui": o servidor só sobrescreve a hora cheia de quem ligou o status. Devolve se o status está ligado. */
  marcar: () => Promise<boolean>;
  /** "Ativo recentemente" de @handle, como eu posso ver (só sim ou não). */
  presencaDe: (handle: string) => Promise<boolean>;
  protegerFoto: (sim: boolean) => Promise<MinhasEscolhas>;
  protegerStory: (story: string, sim: boolean) => Promise<boolean>;
  storiesProtegidos: (ids: string[]) => Promise<Protegidos>;
  fotosProtegidas: (handles: string[]) => Promise<Protegidos>;
}

/** O cliente de verdade sobre uma forma de chamar (os testes passam uma simulada). */
export function criarClienteDePresencaEPrint(c: Chamar): ClienteDePresencaEPrint {
  return {
    previa: false,
    minhas: () => c<MinhasEscolhas>("rede_p4_pp_minhas"),
    ligarPresenca: (sim) => c<MinhasEscolhas>("rede_p4_presenca_ligar", { p_sim: sim }),
    marcar: () => c<boolean>("rede_p4_presenca_marcar"),
    presencaDe: (handle) => c<{ recente: boolean }>("rede_p4_presenca_de", { p_handle: handle }).then((r) => r?.recente === true),
    protegerFoto: (sim) => c<MinhasEscolhas>("rede_p4_foto_proteger", { p_sim: sim }),
    protegerStory: (story, sim) => c<{ protegido: boolean }>("rede_p4_story_proteger", { p_story: story, p_sim: sim }).then((r) => r?.protegido === true),
    storiesProtegidos: (ids) =>
      ids.length === 0
        ? Promise.resolve({ itens: [], marca: "" })
        : c<{ stories: string[]; marca: string }>("rede_p4_pp_stories", { p_stories: ids.slice(0, 100) }).then((r) => ({ itens: r?.stories ?? [], marca: r?.marca ?? "" })),
    fotosProtegidas: (handles) =>
      handles.length === 0
        ? Promise.resolve({ itens: [], marca: "" })
        : c<{ handles: string[]; marca: string }>("rede_p4_fotos_protegidas", { p_handles: handles.slice(0, 60) }).then((r) => ({ itens: r?.handles ?? [], marca: r?.marca ?? "" })),
  };
}

/** De quanto em quanto tempo, no máximo, a aba avisa "estou aqui" (o servidor só escreve quando a hora cheia muda). */
export const INTERVALO_DO_ESTOU_AQUI = 30 * 60_000;

/** A aba avisa agora? Só com o status ligado, a aba à vista e meia hora desde a última vez (0: nunca avisou). */
export function precisaMarcar(agora: number, ultimaVez: number, desligado: boolean, visivel: boolean): boolean {
  return !desligado && visivel && (ultimaVez === 0 || agora - ultimaVez >= INTERVALO_DO_ESTOU_AQUI);
}

/** O codinome da prévia para a marca d'água (nenhum dado de verdade). */
export const MARCA_DA_PREVIA = "Você (prévia)";

/**
 * O dublê da prévia: guarda as escolhas só na memória da aba. Todo story da prévia e a foto de @faisca (o perfil de exemplo) vêm
 * protegidos, para a tela mostrar a proteção; o status de @faisca aparece como "ativo recentemente".
 */
export function criarClienteDaPrevia(): ClienteDePresencaEPrint {
  const minhas: MinhasEscolhas = { presenca: false, foto: false };
  const stories = new Map<string, boolean>();
  return {
    previa: true,
    minhas: async () => ({ ...minhas }),
    ligarPresenca: async (sim) => {
      minhas.presenca = sim;
      return { ...minhas };
    },
    marcar: async () => minhas.presenca,
    presencaDe: async (handle) => handle === "faisca",
    protegerFoto: async (sim) => {
      minhas.foto = sim;
      return { ...minhas };
    },
    protegerStory: async (story, sim) => {
      stories.set(story, sim);
      return sim;
    },
    storiesProtegidos: async (ids) => ({ itens: ids.filter((id) => stories.get(id) ?? true), marca: MARCA_DA_PREVIA }),
    fotosProtegidas: async (handles) => ({ itens: handles.filter((h) => h === "faisca"), marca: MARCA_DA_PREVIA }),
  };
}

const previa = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";
let doCliente: ClienteDePresencaEPrint | null = null;

/** O cliente que as telas usam: o de verdade, ou o dublê da prévia. */
export function clienteDePresencaEPrint(): ClienteDePresencaEPrint {
  doCliente ??= previa ? criarClienteDaPrevia() : criarClienteDePresencaEPrint(chamar);
  return doCliente;
}
