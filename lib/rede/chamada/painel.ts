// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O andamento de UMA chamada da conversa a dois nesta aba (Prompt 4, itens 139 e 140): ligar, tocar, atender, recusar, desligar, o
// tempo de espera e o fim que chega da outra pessoa. As ações de verdade (o toque pelo chat, a sala, o microfone) vêm de fora
// (lib/rede/chamada/cliente.ts no navegador, de mentira nos testes). Só na memória: nada vai ao disco, nada fica registrado depois
// que a chamada acaba. Uma chamada por vez: com uma aberta, outra que toque fica tocando até vencer (não atende sozinha).
// Sem "@/" de propósito (roda no Node nos testes).
import { type GuardaDosToques, type ToqueRecebido } from "./guarda";
import { type CorpoDoToque, type FimDaChamada, TOQUE_VALE_MS } from "./toque";

/** Quanto quem atendeu espera a conexão abrir antes de desistir. */
export const ESPERA_DA_CONEXAO_MS = 30_000;

/** O que a sala aberta oferece ao painel (a de lib/rede/voz/sala.ts). */
export interface SalaDaChamada {
  mudo(sim: boolean): void;
  camera(sim: boolean): void;
  sair(): Promise<void>;
}

/** Quem está do outro lado (a conta e o que chega dela: o áudio e, numa chamada de vídeo, a câmera). */
export interface Outro {
  usuario: string;
  fluxo: MediaStream | null;
}

export interface AcoesDaChamada {
  ligar(conversa: string, video: boolean, aoMudar: (p: Outro[]) => void): Promise<{ toque: CorpoDoToque; sala: SalaDaChamada; camera: MediaStream | null }>;
  atender(toque: CorpoDoToque, comCamera: boolean, aoMudar: (p: Outro[]) => void): Promise<{ sala: SalaDaChamada; camera: MediaStream | null }>;
  avisarFim(conversa: string, toque: CorpoDoToque, fim: FimDaChamada): Promise<void>;
  agora?: () => number;
  agendar?: (fazer: () => void, ms: number) => () => void;
}

export type Fase = "parada" | "ligando" | "conectando" | "em_chamada" | "acabou";
/** Por que acabou (a tela traduz): o fim que veio da outra pessoa, ou o que aconteceu aqui. */
export type Motivo = FimDaChamada | "nao_atendeu" | "nao_conectou" | "saiu" | "eu" | "erro";

export interface EstadoDaChamada {
  fase: Fase;
  conversa: string | null;
  nome: string;
  video: boolean;
  /** Eu liguei (true) ou atendi (false). */
  liguei: boolean;
  outros: Outro[];
  mudo: boolean;
  camera: boolean;
  /** A minha câmera, para a prévia pequena (só numa chamada de vídeo com a câmera ligada). */
  minhaCamera: MediaStream | null;
  /** Desde quando a chamada está de pé (para o cronômetro da tela). */
  desde: number | null;
  motivo: Motivo | null;
  /** O código do erro (microfone negado, sem retransmissão...), quando motivo = "erro". */
  erro: string | null;
}

const PARADA: EstadoDaChamada = { fase: "parada", conversa: null, nome: "", video: false, liguei: false, outros: [], mudo: false, camera: false, minhaCamera: null, desde: null, motivo: null, erro: null };

export function criarPainelDaChamada(guarda: GuardaDosToques, acoes: AcoesDaChamada) {
  const agora = acoes.agora ?? (() => Date.now());
  const agendar = acoes.agendar ?? ((fazer: () => void, ms: number) => {
    const t = setTimeout(fazer, ms);
    return () => clearTimeout(t);
  });
  let estado: EstadoDaChamada = PARADA;
  let toque: CorpoDoToque | null = null;
  let sala: SalaDaChamada | null = null;
  let cancelarEspera: (() => void) | null = null;
  /** Cada chamada tem a sua vez: resposta atrasada de uma chamada que já acabou não mexe na seguinte. */
  let vez = 0;
  const ouvintes = new Set<() => void>();
  /** A fase de agora (lida de novo depois de cada espera: o estado muda enquanto o microfone e a rede respondem). */
  const fase = (): Fase => estado.fase;

  const mudar = (parte: Partial<EstadoDaChamada>) => {
    estado = { ...estado, ...parte };
    for (const o of ouvintes) {
      try {
        o();
      } catch {
        // um ouvinte quebrado não derruba os outros
      }
    }
  };
  const pararEspera = () => {
    cancelarEspera?.();
    cancelarEspera = null;
  };

  /** Fecha a sala e o microfone e mostra o fim. `avisar`: manda o fim à outra pessoa (dentro do cifrado). */
  async function terminar(motivo: Motivo, avisar: FimDaChamada | null, erro: string | null = null) {
    pararEspera();
    const t = toque;
    const s = sala;
    const conversa = estado.conversa;
    toque = null;
    sala = null;
    vez++;
    mudar({ fase: "acabou", outros: [], minhaCamera: null, desde: null, motivo, erro });
    await s?.sair().catch(() => undefined);
    if (t && conversa && avisar) await acoes.avisarFim(conversa, t, avisar).catch(() => undefined);
  }

  function aoMudar(minhaVez: number) {
    return (outros: Outro[]) => {
      if (minhaVez !== vez) return;
      if (outros.length) {
        const primeira = estado.fase !== "em_chamada";
        pararEspera();
        mudar({ fase: "em_chamada", outros: [...outros], desde: estado.desde ?? agora() });
        // Quem liga avisa que um aparelho atendeu: os outros aparelhos da pessoa param de tocar.
        if (primeira && estado.liguei && toque && estado.conversa) void acoes.avisarFim(estado.conversa, toque, "atendida").catch(() => undefined);
      } else if (estado.fase === "em_chamada") {
        void terminar("saiu", null);
      } else mudar({ outros: [] });
    };
  }

  // O fim que chega da outra pessoa (recusou, desistiu, desligou). "atendida" não fecha a chamada de quem atendeu: só para de tocar
  // nos outros aparelhos (a guarda já cuida).
  guarda.ouvirFins((id, fim) => {
    if (!toque || toque.id !== id || fim === "atendida") return;
    void terminar(fim, null);
  });

  return {
    estado: () => estado,
    ouvir(fazer: () => void): () => void {
      ouvintes.add(fazer);
      return () => void ouvintes.delete(fazer);
    },

    /** Liga para a outra pessoa desta conversa. Com uma chamada aberta, não faz nada. */
    async ligar(conversa: string, nome: string, video: boolean): Promise<void> {
      if (estado.fase === "ligando" || estado.fase === "conectando" || estado.fase === "em_chamada") return;
      const minha = ++vez;
      mudar({ ...PARADA, fase: "ligando", conversa, nome, video, liguei: true, camera: video });
      try {
        const r = await acoes.ligar(conversa, video, aoMudar(minha));
        if (minha !== vez) {
          // Desligou enquanto o toque saía: fecha o que abriu e avisa o fim.
          await r.sala.sair().catch(() => undefined);
          await acoes.avisarFim(conversa, r.toque, "cancelou").catch(() => undefined);
          return;
        }
        toque = r.toque;
        sala = r.sala;
        mudar({ minhaCamera: r.camera });
        // Sem resposta no prazo do toque: desiste e avisa (o toque já venceu do outro lado).
        if (fase() === "ligando") cancelarEspera = agendar(() => void (minha === vez && fase() === "ligando" && terminar("nao_atendeu", "cancelou")), TOQUE_VALE_MS);
      } catch (e) {
        if (minha === vez) await terminar("erro", null, codigoDoErro(e));
      }
    },

    /** Atende o toque (com a câmera ou não, numa chamada de vídeo). */
    async atender(recebido: ToqueRecebido, comCamera: boolean): Promise<void> {
      if (estado.fase === "ligando" || estado.fase === "conectando" || estado.fase === "em_chamada") return;
      guarda.encerrar(recebido.corpo.id);
      const minha = ++vez;
      toque = recebido.corpo;
      mudar({ ...PARADA, fase: "conectando", conversa: recebido.conversa, nome: recebido.nome, video: recebido.corpo.video, liguei: false, camera: recebido.corpo.video && comCamera });
      try {
        const r = await acoes.atender(recebido.corpo, comCamera, aoMudar(minha));
        if (minha !== vez) {
          await r.sala.sair().catch(() => undefined);
          return;
        }
        sala = r.sala;
        mudar({ minhaCamera: r.camera });
        if (fase() === "conectando") cancelarEspera = agendar(() => void (minha === vez && fase() === "conectando" && terminar("nao_conectou", "desligou")), ESPERA_DA_CONEXAO_MS);
      } catch (e) {
        if (minha === vez) await terminar("erro", "desligou", codigoDoErro(e));
      }
    },

    /** Recusa o toque: para de tocar aqui e avisa quem ligou. */
    async recusar(recebido: ToqueRecebido): Promise<void> {
      guarda.encerrar(recebido.corpo.id);
      await acoes.avisarFim(recebido.conversa, recebido.corpo, "recusou").catch(() => undefined);
    },

    /** Desliga (ou desiste de ligar). */
    async desligar(): Promise<void> {
      if (estado.fase === "parada" || estado.fase === "acabou") return;
      const fim: FimDaChamada = estado.fase === "ligando" ? "cancelou" : "desligou";
      if (!toque) {
        // O toque ainda não saiu: a vez nova faz o ligar() em andamento fechar e avisar sozinho.
        vez++;
        mudar({ fase: "acabou", outros: [], minhaCamera: null, desde: null, motivo: "eu", erro: null });
        return;
      }
      await terminar("eu", fim);
    },

    mudo(sim: boolean): void {
      sala?.mudo(sim);
      mudar({ mudo: sim });
    },

    camera(sim: boolean): void {
      if (!estado.video) return;
      sala?.camera(sim);
      mudar({ camera: sim });
    },

    /** Some o "acabou" da tela. */
    fechar(): void {
      if (estado.fase === "acabou") mudar(PARADA);
    },

    /** "Sair rápido" e fechar a página: fecha a sala na hora, sem esperar nada da rede. */
    sairJa(): void {
      pararEspera();
      const s = sala;
      toque = null;
      sala = null;
      vez++;
      estado = PARADA;
      void s?.sair().catch(() => undefined);
      for (const o of ouvintes) {
        try {
          o();
        } catch {
          // idem
        }
      }
    },
  };
}

export type PainelDaChamada = ReturnType<typeof criarPainelDaChamada>;

/** O código curto de um erro (o "NotAllowedError" do microfone negado, ou a mensagem do nosso erro). */
export function codigoDoErro(e: unknown): string {
  const nome = (e as { name?: string })?.name;
  if (nome === "NotAllowedError" || nome === "NotFoundError" || nome === "NotReadableError") return nome;
  const m = String((e as { codigo?: string })?.codigo ?? (e as Error)?.message ?? "");
  return /^[a-z_]{3,40}$/.test(m) ? m : "outro";
}
