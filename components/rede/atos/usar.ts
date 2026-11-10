// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os ganchos das telas dos atos: textos, dados (pelo cliente de lib/rede/cliente-atos.ts, ou pelo dublê na prévia) e o
// "Você vai". Um mesmo ato pode estar em três lugares da tela ao mesmo tempo (faixa, cartão, coluna da direita): a confirmação
// num deles atualiza os outros pelo pequeno quadro de avisos abaixo, sem pedir de novo ao servidor.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { atos as cliente } from "@/lib/rede/cliente-atos";
import { fraseDoErro } from "@/lib/rede/atos/erros";
import { vibrar, VIBRA_DO_FAROL } from "@/lib/rede/atos/movimento";
import { carregarTextosDosAtos, type TextosDosAtos } from "@/lib/rede/textos-atos";
import type { Ato, Corrente, EstadoDoFarol, FarolDoAto, FiltroDosAtos } from "@/lib/rede/tipos-atos";

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

/** Ouve as mudanças de UM ato (o chamado embutido num post acompanha o "Você vai" dado na faixa ou no cartão). */
export function useOuvirAto(id: string, aoMudar: (a: Ato) => void): void {
  const filtro = useCallback((a: Ato) => {
    if (a.id === id) aoMudar(a);
  }, [id, aoMudar]);
  useOuvirAtos(filtro);
}

/** A frase do erro no idioma da tela (o código do servidor vira a frase certa: ato_cancelado, muitos_pedidos…). */
export function frase(t: TextosDosAtos, e: unknown): string {
  return fraseDoErro(t.erros, e);
}

// ───── o farol (um quadro por ato: a faixa e o ato aberto leem o mesmo, e só um relógio pergunta ao servidor) ─────
type QuadroDoFarol = { farol: FarolDoAto | null; ouvintes: Set<() => void>; relogio?: number; carregando?: boolean };
const farois = new Map<string, QuadroDoFarol>();
const CHAVE_VISTO = (id: string) => `lucia:rede:atos:farol:${id}`;

function lerVisto(id: string): string | null {
  try {
    return localStorage.getItem(CHAVE_VISTO(id));
  } catch {
    return null;
  }
}
function gravarVisto(id: string, quando: string | null): void {
  try {
    if (quando) localStorage.setItem(CHAVE_VISTO(id), quando);
  } catch {
    // sem armazenamento: só não lembra
  }
}

/** O farol está perto do ato (6 h antes até 12 h depois)? Só aí a tela pergunta de novo a cada 30 s. */
export function farolAoVivo(inicio: string, agora = Date.now()): boolean {
  const t = Date.parse(inicio);
  return Number.isFinite(t) && agora > t - 6 * 3_600_000 && agora < t + 12 * 3_600_000;
}

async function buscarFarol(id: string): Promise<void> {
  const q = farois.get(id);
  if (!q || q.carregando) return;
  q.carregando = true;
  try {
    const f = await cliente.farol(id);
    const antes = q.farol;
    q.farol = f;
    // mudou enquanto a tela estava aberta (e este aparelho ainda não viu): vibra curto-curto-longo
    if (antes && f?.mudado_em && antes.mudado_em !== f.mudado_em && lerVisto(id) !== f.mudado_em) {
      vibrar(VIBRA_DO_FAROL);
    }
    for (const o of q.ouvintes) o();
  } catch {
    // farol é extra: se falhar, a tela segue sem ele
  } finally {
    q.carregando = false;
  }
}

/**
 * O farol de um ato, para quem confirmou ou coordena. `novo` diz se mudou desde a última vez que este aparelho viu (a faixa
 * pulsa); `visto()` marca como visto. `pedir` é da coordenação.
 */
export function useFarol(ato: Pick<Ato, "id" | "inicio" | "vou_eu" | "meu" | "situacao"> | null) {
  const id = ato && (ato.vou_eu || ato.meu) ? ato.id : null;
  const aoVivo = !!ato && farolAoVivo(ato.inicio);
  const [, setVolta] = useState(0);
  useEffect(() => {
    if (!id) return;
    let q = farois.get(id);
    if (!q) {
      q = { farol: null, ouvintes: new Set() };
      farois.set(id, q);
      void buscarFarol(id);
    }
    const ouvir = () => setVolta((v) => v + 1);
    q.ouvintes.add(ouvir);
    if (aoVivo && !q.relogio) {
      q.relogio = window.setInterval(() => {
        if (document.visibilityState === "visible") void buscarFarol(id);
      }, 30_000);
    }
    return () => {
      q.ouvintes.delete(ouvir);
      if (!q.ouvintes.size && q.relogio) {
        window.clearInterval(q.relogio);
        q.relogio = undefined;
      }
    };
  }, [id, aoVivo]);
  const farol = id ? (farois.get(id)?.farol ?? null) : null;
  const novo = !!id && !!farol?.mudado_em && lerVisto(id) !== farol.mudado_em;
  const visto = useCallback(() => {
    if (id && farol?.mudado_em) gravarVisto(id, farol.mudado_em);
  }, [id, farol?.mudado_em]);
  const pedir = useCallback(
    async (estado: EstadoDoFarol, texto = "") => {
      if (!id) return null;
      const f = await cliente.farolPedir(id, estado, texto);
      const q = farois.get(id);
      if (q) {
        q.farol = f;
        for (const o of q.ouvintes) o();
      }
      return f;
    },
    [id],
  );
  return { farol, novo, visto, pedir };
}

// ───── correntes de solidariedade (pela cidade escrita) ─────
export function useCorrentes(cidade: string | null, ligado = true) {
  const [lista, setLista] = useState<Corrente[] | null>(null);
  const [volta, setVolta] = useState(0);
  useEffect(() => {
    if (!cidade || !ligado) return;
    let vivo = true;
    cliente
      .correntes(cidade)
      .then((l) => vivo && setLista(l))
      .catch(() => vivo && setLista([]));
    return () => {
      vivo = false;
    };
  }, [cidade, ligado, volta]);
  const trocar = useCallback((k: Corrente) => setLista((l) => (l ? l.map((x) => (x.id === k.id ? k : x)) : l)), []);
  const juntar = useCallback((k: Corrente) => setLista((l) => [k, ...(l ?? []).filter((x) => x.id !== k.id)]), []);
  return { lista: cidade && ligado ? lista : [], trocar, juntar, recarregar: () => setVolta((v) => v + 1) };
}