// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os ganchos do grupo presença e print (prompt 4): o "ativo recentemente" de um perfil, a foto protegida, os stories protegidos e o
// "estou aqui" da casca. Tudo atrás de "alumia-p4-presenca-print": desligado, nada é pedido. As respostas moram só na memória da
// aba (nada é gravado no aparelho) e envelhecem em cinco minutos.
import { useEffect, useState } from "react";
import { clienteDePresencaEPrint, precisaMarcar, presencaPrintLigada, type Protegidos } from "@/lib/rede/cliente-presenca-print";

const VALIDADE = 5 * 60_000;
const ligadoAgora = presencaPrintLigada();

type Guardado<T> = { valor: T; ate: number };
const presencas = new Map<string, Guardado<boolean>>();
const fotos = new Map<string, Guardado<{ sim: boolean; marca: string }>>();

/** "Ativo recentemente" de @handle (só a roda de confiança da pessoa recebe sim). Desligado ou sem conta: falso, sem chamada. */
export function usePresencaRecente(handle: string | null | undefined, logado: boolean): boolean {
  const [resposta, setResposta] = useState<{ handle: string; sim: boolean } | null>(null);
  useEffect(() => {
    if (!ligadoAgora || !logado || !handle) return;
    const ja = presencas.get(handle);
    let vivo = true;
    const pronto = (sim: boolean) => vivo && setResposta({ handle, sim });
    if (ja && ja.ate > Date.now()) {
      void Promise.resolve(ja.valor).then(pronto);
    } else {
      clienteDePresencaEPrint()
        .presencaDe(handle)
        .then((sim) => {
          presencas.set(handle, { valor: sim, ate: Date.now() + VALIDADE });
          pronto(sim);
        })
        .catch(() => pronto(false));
    }
    return () => {
      vivo = false;
    };
  }, [handle, logado]);
  return Boolean(ligadoAgora && handle && resposta?.handle === handle && resposta.sim);
}

/** A foto de perfil de @handle é protegida? E o codinome de quem lê, para a marca d'água. */
export function useFotoProtegida(handle: string | null | undefined, logado: boolean): { protegida: boolean; marca: string } {
  const [resposta, setResposta] = useState<{ handle: string; sim: boolean; marca: string } | null>(null);
  useEffect(() => {
    if (!ligadoAgora || !logado || !handle) return;
    let vivo = true;
    const ja = fotos.get(handle);
    const pronto = (v: { sim: boolean; marca: string }) => vivo && setResposta({ handle, ...v });
    if (ja && ja.ate > Date.now()) {
      void Promise.resolve(ja.valor).then(pronto);
    } else {
      clienteDePresencaEPrint()
        .fotosProtegidas([handle])
        .then((r) => {
          const v = { sim: r.itens.includes(handle), marca: r.marca };
          fotos.set(handle, { valor: v, ate: Date.now() + VALIDADE });
          pronto(v);
        })
        .catch(() => pronto({ sim: false, marca: "" }));
    }
    return () => {
      vivo = false;
    };
  }, [handle, logado]);
  const ok = Boolean(ligadoAgora && handle && resposta?.handle === handle);
  return { protegida: ok && resposta!.sim, marca: ok ? resposta!.marca : "" };
}

/** Esquece a resposta guardada da minha foto (depois de eu mudar a escolha nos ajustes). */
export function esquecerFoto(handle: string | null | undefined): void {
  if (handle) fotos.delete(handle);
}

/** Quais destes stories estão protegidos (só entre os que eu vejo) e a minha marca. `chave` muda quando a lista muda. */
export function useStoriesProtegidos(ids: readonly string[]): { protegidos: ReadonlySet<string>; marca: string; mudar: (id: string, sim: boolean) => void } {
  const chave = ids.join(",");
  const [resposta, setResposta] = useState<{ chave: string; r: Protegidos } | null>(null);
  const [mudados, setMudados] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!ligadoAgora || !chave) return;
    let vivo = true;
    clienteDePresencaEPrint()
      .storiesProtegidos(chave.split(","))
      .then((r) => vivo && setResposta({ chave, r }))
      .catch(() => vivo && setResposta({ chave, r: { itens: [], marca: "" } }));
    return () => {
      vivo = false;
    };
  }, [chave]);
  const base = resposta?.chave === chave ? resposta.r : { itens: [], marca: "" };
  const protegidos = new Set(base.itens);
  for (const [id, sim] of Object.entries(mudados)) {
    if (sim) protegidos.add(id);
    else protegidos.delete(id);
  }
  return { protegidos, marca: base.marca, mudar: (id, sim) => setMudados((m) => ({ ...m, [id]: sim })) };
}

/** O grupo está ligado nesta montagem? (Para as telas decidirem se desenham alguma coisa.) */
export const presencaEPrintLigados = (): boolean => ligadoAgora;

/** Quando a aba avisou por último (0: nunca) e se o servidor disse que o status está desligado. Fora do componente de propósito:
 * cada tela monta a casca de novo, e trocar de tela não pode virar uma chamada nova. */
let ultima = 0;
let parado = false;

/**
 * O "estou aqui" da casca: com o grupo ligado e conta aprovada, avisa o servidor ao abrir a Alumia e depois no máximo a cada meia
 * hora, com a aba à vista. O servidor só sobrescreve a hora cheia de quem ligou o status; quem não ligou recebe "não" e a aba para
 * de chamar até a pessoa ligar nos Ajustes.
 */
export function useMarcarPresenca(pode: boolean): void {
  useEffect(() => {
    if (!ligadoAgora || !pode) return;
    const marcar = () => {
      if (!precisaMarcar(Date.now(), ultima, parado, document.visibilityState !== "hidden")) return;
      ultima = Date.now();
      clienteDePresencaEPrint()
        .marcar()
        .then((ligada) => {
          if (!ligada) parado = true;
        })
        .catch(() => {
          parado = true;
        });
    };
    marcar();
    const id = window.setInterval(marcar, 60_000);
    return () => window.clearInterval(id);
  }, [pode]);
}

/** Depois de ligar o status nos Ajustes, a casca volta a avisar (já na próxima volta do relógio). */
export function voltarAMarcar(): void {
  parado = false;
  ultima = 0;
}
