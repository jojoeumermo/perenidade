// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A sala de voz no navegador (lib/rede/voz/sala.ts): o canal de combinação pelo Realtime do serviço (só blocos cifrados, num
// canal com nome sorteado do grupo e da sala), as credenciais do servidor de retransmissão (app/api/alumia/voz/retransmissao) e a
// chave da sala pelo MLS do grupo (lib/rede/grupo-mls.ts). Documento: docs/rede/VOZ.md.
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getClient } from "../../backend";
import { criarChaveiroDeGrupo, guardaNoNavegador } from "../grupo-chaveiro";
import { chamar } from "../cliente";
import { type CanalDaSala, type ChaveDaSala, criarSalaDeVoz, type Participante } from "./sala";

let chaveiro: ReturnType<typeof criarChaveiroDeGrupo> | null = null;
const chaveiroDosGrupos = () => (chaveiro ??= criarChaveiroDeGrupo({ chamar: (f, a) => chamar(f, a), guarda: guardaNoNavegador() }));

async function nomeDoCanal(grupo: string, sala: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`alumia-voz:1:${grupo}:${sala}`)));
  return `voz-${[...bytes.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function canalDoRealtime(grupo: string, sala: string): Promise<CanalDaSala> {
  const supabase = await getClient();
  const canal: RealtimeChannel = supabase.channel(await nomeDoCanal(grupo, sala), { config: { broadcast: { self: false, ack: false } } });
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

async function servidoresDeRetransmissao(grupo: string): Promise<RTCIceServer[]> {
  const supabase = await getClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("entre_primeiro");
  const r = await fetch("/api/alumia/voz/retransmissao", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ grupo }) });
  const corpo = (await r.json().catch(() => null)) as { iceServers?: RTCIceServer[]; erro?: string } | null;
  if (corpo?.erro === "desligada") throw new Error("voz_desligada");
  if (!r.ok || !corpo?.iceServers?.length) throw new Error(corpo?.erro ?? "voz_sem_retransmissao");
  return corpo.iceServers;
}

/** Entra na sala de voz do grupo: pede o microfone, liga para quem já está. Devolve a sala (para mudo e sair). */
export async function entrarNaSalaDeVoz(opcoes: { eu: string; grupo: string; sala: string; aoMudar: (p: Participante[]) => void }) {
  const grupos = chaveiroDosGrupos();
  const chave: ChaveDaSala = {
    atual: () => grupos.chaveDeVoz(opcoes.grupo, opcoes.eu, opcoes.sala),
    daEpoca: async (epoca) => (await grupos.chaveDeVoz(opcoes.grupo, opcoes.eu, opcoes.sala, epoca))?.chave ?? null,
  };
  if (!(await chave.atual())) throw new Error("sem_chave");
  const [iceServers, canal] = await Promise.all([servidoresDeRetransmissao(opcoes.grupo), canalDoRealtime(opcoes.grupo, opcoes.sala)]);
  const microfone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
  const sala = criarSalaDeVoz({ eu: opcoes.eu, sala: `${opcoes.grupo}:${opcoes.sala}`, chave, canal, iceServers, aoMudar: opcoes.aoMudar });
  await sala.entrar(microfone);
  return sala;
}
