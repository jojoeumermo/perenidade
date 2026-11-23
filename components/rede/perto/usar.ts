// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os ganchos do "Perto" (Prompt 4, itens 2, 7 e 8): o relógio, o círculo, as posições recebidas (da guarda da memória), o estado do
// compartilhar e a volta para casa. Nada daqui guarda posição: lê da guarda (lib/rede/perto/guarda.ts), que fica só na memória.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { compartilhar, meuCirculo, nomesDasOrigens, type PessoaDoCirculo, volta } from "@/lib/rede/perto/cliente";
import { guardaDePosicoes } from "@/lib/rede/perto/guarda";
import type { PosicaoRecebida } from "@/lib/rede/perto/posicao";
import type { Volta } from "@/lib/rede/perto/volta";

/** Um relógio que bate a cada `ms` (para as contagens na tela). */
export function useAgora(ms = 1000): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return agora;
}

export function useCirculo(): { circulo: PessoaDoCirculo[] | null; erro: unknown; recarregar: () => void } {
  const [circulo, setCirculo] = useState<PessoaDoCirculo[] | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [vez, setVez] = useState(0);
  useEffect(() => {
    let vivo = true;
    meuCirculo().then(
      (c) => vivo && (setCirculo(c), setErro(null)),
      (e) => vivo && (setCirculo([]), setErro(e)),
    );
    return () => {
      vivo = false;
    };
  }, [vez]);
  return { circulo, erro, recarregar: useCallback(() => setVez((v) => v + 1), []) };
}

let versaoDaGuarda = 0;
guardaDePosicoes.ouvir(() => versaoDaGuarda++);

/** As posições recebidas que valem agora (a guarda apaga as vencidas), e o nome de quem mandou. */
export function useRecebidas(): { posicoes: PosicaoRecebida[]; pedidos: { origem: string; autor: string }[]; nomes: Record<string, string> } {
  const versao = useSyncExternalStore((f) => guardaDePosicoes.ouvir(f), () => versaoDaGuarda, () => 0);
  const agora = useAgora(15_000);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const posicoes = guardaDePosicoes.ver(agora);
  const pedidos = guardaDePosicoes.pedidos(agora);
  const chave = [...posicoes, ...pedidos].map((p) => p.origem).join();
  // As vencidas saem da guarda (fora do desenho: apagar avisa quem ouve).
  useEffect(() => void guardaDePosicoes.vigentes(agora), [agora]);
  useEffect(() => {
    if (!chave) return;
    let vivo = true;
    nomesDasOrigens().then((n) => vivo && setNomes(n), () => undefined);
    return () => {
      vivo = false;
    };
  }, [chave, versao]);
  return { posicoes, pedidos, nomes };
}

export function useCompartilhar() {
  return useSyncExternalStore(compartilhar.ouvir, compartilhar.estado, compartilhar.estado);
}

export function useVolta(): Volta | null {
  const [, setVez] = useState(0);
  useEffect(() => volta.ouvir(() => setVez((v) => v + 1)), []);
  return typeof window === "undefined" ? null : volta.atual();
}
