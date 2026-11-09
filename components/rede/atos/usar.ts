// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os ganchos das telas dos atos: textos, dados (pelo cliente de lib/rede/cliente-atos.ts, ou pelo dublê na prévia) e o
// "Você vai". Um mesmo ato pode estar em três lugares da tela ao mesmo tempo (faixa, cartão, coluna da direita): a confirmação
// num deles atualiza os outros pelo pequeno quadro de avisos abaixo, sem pedir de novo ao servidor.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { atos as cliente } from "@/lib/rede/cliente-atos";
import { carregarTextosDosAtos, type TextosDosAtos } from "@/lib/rede/textos-atos";
import type { Ato, FiltroDosAtos } from "@/lib/rede/tipos-atos";

export function useTextosDosAtos(lang: string): TextosDosAtos | null {
  const [t, setT] = useState<TextosDosAtos | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDosAtos(lang)
      .then((x) => vivo && setT(x))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang]);
  return t;
}

/** A tela é de computador (768 px ou mais)? No servidor e antes de montar, responde "não" (celular primeiro). */
export function useTelaLarga(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const m = window.matchMedia("(min-width: 768px)");
      m.addEventListener("change", avisar);
      return () => m.removeEventListener("change", avisar);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => false,
  );
}

// ───── o quadro de avisos dos atos já carregados (id → versão mais nova) ─────
const ouvintes = new Set<(a: Ato) => void>();

/** Avisa todas as peças da tela que um ato mudou (depois do "Você vai", de adiar ou cancelar). */
export function avisarAto(a: Ato): void {
  for (const ouvir of ouvintes) ouvir(a);
}

function useOuvirAtos(aoMudar: (a: Ato) => void): void {
  useEffect(() => {
    ouvintes.add(aoMudar);
    return () => {
      ouvintes.delete(aoMudar);
    };
  }, [aoMudar]);
}

type Estado<T> = { fase: "carregando" } | { fase: "erro"; erro: string } | { fase: "pronto"; dados: T };

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Uma lista de atos (Perto pela cidade escrita, Seguindo, ou os de uma comunidade). Sem cidade, "Perto" nem pergunta ao servidor. */
export function useListaDeAtos(filtro: FiltroDosAtos, opcoes: { cidade?: string | null; comunidade?: string | null; ligado?: boolean }) {
  const { cidade = null, comunidade = null, ligado = true } = opcoes;
  const [estado, setEstado] = useState<Estado<Ato[]>>({ fase: "carregando" });
  const [volta, setVolta] = useState(0);
  useEffect(() => {
    if (!ligado || (filtro === "perto" && !cidade && !comunidade)) return;
    let vivo = true;
    queueMicrotask(() => vivo && setEstado({ fase: "carregando" }));
    cliente
      .atos(filtro, { cidade, comunidade })
      .then((p) => vivo && setEstado({ fase: "pronto", dados: p.itens }))
      .catch((e) => vivo && setEstado({ fase: "erro", erro: mensagem(e) }));
    return () => {
      vivo = false;
    };
  }, [filtro, cidade, comunidade, ligado, volta]);
  const trocar = useCallback((a: Ato) => setEstado((s) => (s.fase === "pronto" ? { ...s, dados: s.dados.map((x) => (x.id === a.id ? a : x)) } : s)), []);
  useOuvirAtos(trocar);
  return { estado, recarregar: () => setVolta((v) => v + 1) };
}

/** Um ato (a página do ato). */
export function useAto(id: string) {
  const [estado, setEstado] = useState<Estado<Ato>>({ fase: "carregando" });
  const [volta, setVolta] = useState(0);
  useEffect(() => {
    let vivo = true;
    cliente
      .ato(id)
      .then((a) => vivo && setEstado({ fase: "pronto", dados: a }))
      .catch((e) => vivo && setEstado({ fase: "erro", erro: mensagem(e) }));
    return () => {
      vivo = false;
    };
  }, [id, volta]);
  const trocar = useCallback((a: Ato) => setEstado((s) => (s.fase === "pronto" && s.dados.id === a.id ? { fase: "pronto", dados: a } : s)), []);
  useOuvirAtos(trocar);
  return { estado, recarregar: () => setVolta((v) => v + 1) };
}

/** O próximo ato da pessoa (a faixa do início). Nulo quando não há; erro vira nulo (a faixa só some). */
export function useProximoAto(ligado = true): Ato | null {
  const [ato, setAto] = useState<Ato | null>(null);
  useEffect(() => {
    if (!ligado) return;
    let vivo = true;
    cliente
      .proximo()
      .then((a) => vivo && setAto(a))
      .catch(() => vivo && setAto(null));
    return () => {
      vivo = false;
    };
  }, [ligado]);
  const trocar = useCallback((a: Ato) => setAto((x) => (x && x.id === a.id ? a : x)), []);
  useOuvirAtos(trocar);
  return ato;
}

/**
 * O "Você vai": muda na hora (o botão e o cartão dourado) e confirma no servidor; a proporção do mosaico vem da resposta. Se o
 * servidor recusar, volta ao que era e mostra o erro.
 */
export function useVou(ato: Ato) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const alternar = useCallback(async () => {
    if (ocupado || ato.situacao === "cancelado") return;
    const sim = !ato.vou_eu;
    setOcupado(true);
    setErro(null);
    avisarAto({ ...ato, vou_eu: sim });
    try {
      const r = await cliente.vou(ato.id, sim);
      avisarAto({ ...ato, vou_eu: r.vou_eu, acesos: r.acesos, total: ato.meu ? r.total : null });
    } catch (e) {
      avisarAto(ato);
      setErro(mensagem(e));
    } finally {
      setOcupado(false);
    }
  }, [ato, ocupado]);
  return { alternar, ocupado, erro };
}
