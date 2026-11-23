// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O dublê da urna para a prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim): a tela do voto secreto em limiar sem banco, com dados de
// exemplo e nada guardado. Serve para olhar e fotografar as telas; não cifra nem decifra nada (a cifra de verdade está em
// lib/rede/voto/limiar.ts e é provada por scripts/testar-r2-voto*.mjs).
import type { EstadoDaUrna } from "./urna";
import type { TipoDaVotacao } from "./limiar";

const NOMES = ["Coruja do Morro", "Maré Alta", "Jatobá", "Lua Nova", "Pedra Lisa"];
const espera = () => new Promise((ok) => setTimeout(ok, 350));

/** O estado de exemplo: a prévia mostra cada etapa pelo começo do id ("a…" sem chave, "b…" com chave, "c…" urna fechada). */
function estadoDeExemplo(tipo: TipoDaVotacao, alvo: string, fechada: boolean): EstadoDaUrna {
  const comChave = fechada || !alvo.startsWith("a");
  return {
    tipo, alvo, situacao: fechada ? "fechada" : "aberta", possoCriar: !comChave, possoGuardar: true,
    chave: comChave ? ({ tipo, alvo, n: 5, k: 3 } as EstadoDaUrna["chave"]) : null,
    conferencia: comChave ? "ok" : null, identidades: comChave ? "nao_conferida" : null, impressao: comChave ? "4821 0937 5512" : null,
    guardias: comChave ? NOMES.map((nome, i) => ({ indice: i + 1, usuario: `exemplo-${i}`, nome })) : [],
    apurada: false, abridora: fechada ? 2 : null, entregues: fechada ? 2 : null, meuIndice: 2, entreguei: false, cedulas: fechada,
  };
}

export function urnaDePrevia() {
  const vistos = new Map<string, EstadoDaUrna>();
  const pegar = (tipo: TipoDaVotacao, alvo: string, fechada: boolean) => {
    const chave = `${tipo}:${alvo}`;
    if (!vistos.has(chave)) vistos.set(chave, estadoDeExemplo(tipo, alvo, fechada));
    return vistos.get(chave) as EstadoDaUrna;
  };
  let minha = false;
  return {
    async estado(tipo: TipoDaVotacao, alvo: string, fechada = false) {
      await espera();
      return { ...pegar(tipo, alvo, fechada) };
    },
    async minhaChave() {
      await espera();
      return { identidade: true, diretorio: true, publicada: minha, aqui: minha, confere: minha };
    },
    async criarMinhaChave() {
      await espera();
      minha = true;
    },
    async guardiasPossiveis() {
      await espera();
      return NOMES.map((nome, i) => ({ usuario: `exemplo-${i}`, nome, eu: i === 1, assinada: i !== 4, voto: null, identidade: null, assinatura: null }));
    },
    async publicarChave(tipo: TipoDaVotacao, alvo: string) {
      await espera();
      const e = pegar(tipo, alvo, false);
      Object.assign(e, { possoCriar: false, chave: { tipo, alvo, n: 5, k: 3 }, conferencia: "ok", identidades: "nao_conferida", impressao: "4821 0937 5512", guardias: NOMES.map((nome, i) => ({ indice: i + 1, usuario: `exemplo-${i}`, nome })) });
      return "4821 0937 5512";
    },
    async conferirMinhaParte() {
      await espera();
      return "ok" as const;
    },
    async entregarParte(tipo: TipoDaVotacao, alvo: string) {
      await espera();
      const e = pegar(tipo, alvo, true);
      Object.assign(e, { entreguei: true, entregues: (e.entregues ?? 0) + 1 });
      return { entregues: e.entregues ?? 0, abridora: 2, souAbridora: true };
    },
    async apurar(tipo: TipoDaVotacao, alvo: string) {
      await espera();
      const e = pegar(tipo, alvo, true);
      if ((e.entregues ?? 0) < 3) return { faltam: 3 - (e.entregues ?? 0) };
      Object.assign(e, { apurada: true, cedulas: false });
      return { apuradas: 27, nulas: 1 };
    },
  };
}
