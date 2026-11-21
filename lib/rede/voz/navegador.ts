// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A sala de voz no navegador (lib/rede/voz/sala.ts): o canal de combinação pelo Realtime do serviço (só blocos cifrados, num
// canal com nome sorteado do grupo e da sala), as credenciais do servidor de retransmissão (app/api/alumia/voz/retransmissao) e a
// chave da sala pelo MLS do grupo (lib/rede/grupos/chaveiro.ts, OpenMLS). Documento: docs/rede/VOZ.md.
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { getClient } from "../../backend";
import { chaveiroDosGrupos } from "../grupos/navegador";
import { type CanalDaSala, type ChaveDaSala, criarSalaDeVoz, type Participante } from "./sala";

async function nomeDoCanal(grupo: string, sala: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`alumia-voz:1:${grupo}:${sala}`)));
  return `voz-${[...bytes.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function canalDoRealtime(grupo: string, sala: string): Promise<CanalDaSala> {
  return abrirCanalDeVoz(await nomeDoCanal(grupo, sala));
}

let semConta: Promise<SupabaseClient> | null = null;
/**
 * Um cliente do Realtime SEM a sessão da conta, só na memória (a chamada a dois do Prompt 4): quem entra no canal da chamada não
 * apresenta conta nenhuma, e o serviço não liga o canal às duas contas.
 */
function clienteSemConta(): Promise<SupabaseClient> {
  semConta ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient((process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, ""), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "voz-sem-conta" },
    }),
  );
  return semConta;
}

/**
 * O canal de combinação pelo Realtime, pelo nome já sorteado (a chamada a dois do Prompt 4 tira o nome da chave dela e entra
 * `semConta`: sem a sessão da conta).
 */
export async function abrirCanalDeVoz(nome: string, opcoes: { semConta?: boolean } = {}): Promise<CanalDaSala> {
  const supabase = opcoes.semConta ? await clienteSemConta() : await getClient();
  const canal: RealtimeChannel = supabase.channel(nome, { config: { broadcast: { self: false, ack: false } } });
  const ouvintes: ((b: { epoca: number; iv: string; ct: string }) => void)[] = [];
  canal.on("broadcast", { event: "r" }, (m) => {
    const b = m.payload as { epoca?: unknown; iv?: unknown; ct?: unknown };
    if (typeof b?.epoca === "number" && typeof b.iv === "string" && typeof b.ct === "string" && b.ct.length < 20_000) for (const o of ouvintes) o(b as { epoca: number; iv: string; ct: string });
  });
  await new Promise<void>((pronto, falhou) => {
    canal.subscribe((estado) => {
      if (estado === "SUBSCRIBED") pronto();
      else if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT") falhou(new Error("voz_sem_canal"));
    });
  });
  return {
    enviar: async (bloco) => {
      await canal.send({ type: "broadcast", event: "r", payload: bloco });
    },
    aoReceber: (fazer) => void ouvintes.push(fazer),
    sair: async () => {
      await supabase.removeChannel(canal);
    },
  };
}

/**
 * As credenciais do TURN, por um passe anônimo (lib/rede/passes/cliente.ts) e SEM a sessão da conta (credentials: "omit"): o
 * servidor não liga a sala de voz a conta nenhuma. O grupo não vai ao servidor (que não sabe quem é de qual núcleo).
 */
export async function servidoresDeRetransmissao(): Promise<RTCIceServer[]> {
  const { gastarPasse } = await import("../passes/cliente");
  const passe = await gastarPasse();
  const r = await fetch("/api/alumia/voz/retransmissao", { method: "POST", credentials: "omit", cache: "no-store", headers: { "Content-Type": "application/json", Authorization: passe }, body: "{}" });
  const corpo = (await r.json().catch(() => null)) as { iceServers?: RTCIceServer[]; erro?: string } | null;
  if (corpo?.erro === "desligada") throw new Error("voz_desligada");
  if (!r.ok || !corpo?.iceServers?.length) throw new Error(corpo?.erro ?? "voz_sem_retransmissao");
  return corpo.iceServers;
}

/**
 * A sala com senha (Prompt 4, item 25): a senha muda o NOME da sala (o canal e o contexto da cifra), e quem não sabe a senha cai em
 * outra sala, vazia. A senha não vai a lugar nenhum. É uma porta a mais DENTRO do grupo (quem é de fora já não tem a chave da sala).
 */
export async function nomeComSenha(sala: string, senha: string): Promise<string> {
  const s = senha.normalize("NFC").trim();
  if (!s) return sala;
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`alumia-voz-senha:1:${sala}:${s}`)));
  return `${sala}~${[...bytes.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** Entra na sala de voz do grupo: pede o microfone (fora do estudo em silêncio), liga para quem já está. Devolve a sala (para mudo e sair). */
export async function entrarNaSalaDeVoz(opcoes: {
  eu: string;
  grupo: string;
  sala: string;
  aoMudar: (p: Participante[]) => void;
  /** Prompt 4, itens 23 a 25: os modos, a senha e o estudo sem microfone. */
  modos?: Parameters<typeof criarSalaDeVoz>[0]["modos"];
  senha?: string;
  semMicrofone?: boolean;
}) {
  const grupos = chaveiroDosGrupos();
  const chave: ChaveDaSala = {
    atual: () => grupos.chaveDeVoz(opcoes.grupo, opcoes.eu, opcoes.sala),
    daEpoca: async (epoca) => (await grupos.chaveDeVoz(opcoes.grupo, opcoes.eu, opcoes.sala, epoca))?.chave ?? null,
  };
  if (!(await chave.atual())) throw new Error("sem_chave");
  const nome = await nomeComSenha(opcoes.sala, opcoes.senha ?? "");
  const [iceServers, canal] = await Promise.all([servidoresDeRetransmissao(), canalDoRealtime(opcoes.grupo, nome)]);
  const microfone = opcoes.semMicrofone ? null : await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
  const sala = criarSalaDeVoz({ eu: opcoes.eu, sala: `${opcoes.grupo}:${nome}`, chave, canal, iceServers, aoMudar: opcoes.aoMudar, modos: opcoes.modos });
  await sala.entrar(microfone);
  return sala;
}
