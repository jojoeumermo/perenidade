// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O controle dos modos da sala de voz (Prompt 4, itens 23 a 25) num aparelho: guarda o estado (lib/rede/voz/modos.ts), responde aos
// recados "sala" que chegam pela sala (lib/rede/voz/sala.ts) e manda os da anfitriã. A tela (components/rede/voz/SalaDeVoz.tsx) e o
// teste usam o mesmo controle. A sala é ligada depois (`ligar`), porque ela precisa destes ganchos para nascer.
// Sem "@/": roda no Node nos testes.
import * as Modos from "./modos";
import type { EstadoDaSala } from "./modos";

export interface SalaDosModos {
  mandarModo(modo: unknown, para?: string | null): Promise<void>;
  religar(): Promise<void>;
  desligarDe(usuario: string): void;
  mudo(sim: boolean): void;
  participantes(): { usuario: string }[];
}

export function criarControleDosModos(eu: string, aoMudar: (e: EstadoDaSala) => void = () => undefined) {
  let estado = Modos.estadoInicial();
  let sala: SalaDosModos | null = null;
  const presentes = () => new Set([eu, ...(sala?.participantes().map((p) => p.usuario) ?? [])]);

  function trocar(novo: EstadoDaSala) {
    const antes = estado;
    estado = novo;
    if (sala) {
      // Fui aprovada (ou a espera desligou): mando "olá" de novo, e quem está liga de volta.
      if (Modos.esperando(antes, eu) && !Modos.esperando(novo, eu)) void sala.religar().catch(() => undefined);
      // Quem saiu da lista de aprovadas (recusada depois de entrar) é desligada daqui.
      if (novo.espera) for (const p of sala.participantes()) if (!Modos.podeLigar(novo, eu, p.usuario)) sala.desligarDe(p.usuario);
      // No palco, sem a vez: o microfone fica desligado NESTE aparelho.
      if (!Modos.possoFalar(novo, eu)) sala.mudo(true);
    }
    aoMudar(novo);
  }

  /** Como anfitriã: troca o estado e manda a todos. */
  async function publicar(novo: EstadoDaSala) {
    if (novo === estado) return;
    trocar(novo);
    await sala?.mandarModo({ k: "estado", e: novo }, null);
  }

  return {
    estado: () => estado,
    ligar(s: SalaDosModos) {
      sala = s;
    },
    /** Os ganchos que a sala recebe ao nascer. */
    ganchos: {
      podeLigar: (quem: string) => Modos.podeLigar(estado, eu, quem),
      /** Alguém disse "olá": a anfitriã anota quem bate (na espera) e manda o estado a quem chegou (palco, espera, ritmo). */
      aoOla(quem: string) {
        if (estado.anfitria !== eu) return;
        void publicar(Modos.bateu(estado, eu, quem)).then(() => sala?.mandarModo({ k: "estado", e: estado }, quem)).catch(() => undefined);
      },
      aoModo(de: string, bruto: unknown) {
        const r = Modos.lerRecadoDeModo(bruto);
        if (!r) return;
        if (r.k === "estado") {
          const novo = Modos.aceitarEstado(estado, de, r.e, presentes());
          if (novo) trocar(novo);
          return;
        }
        if (r.k === "mao" && estado.anfitria === eu) void publicar(Modos.mao(estado, eu, de, r.sim)).catch(() => undefined);
      },
    },
    acoes: {
      palco: (sim: boolean) => publicar(Modos.ligarPalco(estado, eu, sim)),
      vez: (quem: string, sim: boolean) => publicar(Modos.darVez(estado, eu, quem, sim)),
      espera: (sim: boolean) => publicar(Modos.ligarEspera(estado, eu, sim, presentes())),
      decidir: (quem: string, entra: boolean) => publicar(Modos.decidir(estado, eu, quem, entra)),
      ritmo: (r: { foco: number; pausa: number } | null, agora = Date.now()) => publicar(Modos.ligarRitmo(estado, eu, r, agora)),
      /** Levantar ou abaixar a mão (vai à anfitriã; ela põe na fila e manda o estado a todos). */
      async mao(sim: boolean) {
        if (!estado.anfitria || !estado.palco) return;
        await sala?.mandarModo({ k: "mao", sim }, estado.anfitria);
      },
    },
  };
}

export type ControleDosModos = ReturnType<typeof criarControleDosModos>;
