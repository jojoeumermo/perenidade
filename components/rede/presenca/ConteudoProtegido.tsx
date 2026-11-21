// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Prompt 4, item 1 (a parte do navegador): o conteúdo que a autora protegeu some quando a aba perde o foco ou a janela sai da frente,
// não aceita copiar, recortar, arrastar, selecionar nem o menu do botão direito, e leva por cima uma marca d'água discreta com o
// codinome de quem lê. Nada daqui vai ao servidor: ninguém fica sabendo que a janela saiu da frente, e a autora nunca é avisada
// de print. O navegador não consegue barrar o print do sistema; o aviso fixo diz isso.
import "./presenca.css";
import { useEffect, useRef, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { ATRIBUTO_ESCONDIDO, ATRIBUTO_PROTEGIDO, deveEsconder, EVENTOS_BARRADOS, REPETICOES_DA_MARCA, textoDaMarca } from "@/lib/rede/protecao-print";

// ── O estado da janela, um só para a página inteira ──────────────────────────────────────────────────────────────────────
const janela = { foco: true, imprimindo: false, escondido: false };
const ouvintes = new Set<() => void>();
const recalcular = () => {
  const visivel = typeof document === "undefined" || document.visibilityState !== "hidden";
  const agora = deveEsconder({ visivel, foco: janela.foco, imprimindo: janela.imprimindo });
  if (agora !== janela.escondido) {
    janela.escondido = agora;
    for (const f of ouvintes) f();
  }
};
const aoPerderFoco = () => {
  janela.foco = false;
  recalcular();
};
const aoGanharFoco = () => {
  janela.foco = true;
  recalcular();
};
const antesDeImprimir = () => {
  janela.imprimindo = true;
  recalcular();
};
const depoisDeImprimir = () => {
  janela.imprimindo = false;
  recalcular();
};

function assinar(f: () => void): () => void {
  ouvintes.add(f);
  if (ouvintes.size === 1) {
    janela.foco = document.hasFocus();
    window.addEventListener("blur", aoPerderFoco);
    window.addEventListener("focus", aoGanharFoco);
    window.addEventListener("pagehide", aoPerderFoco);
    window.addEventListener("beforeprint", antesDeImprimir);
    window.addEventListener("afterprint", depoisDeImprimir);
    document.addEventListener("visibilitychange", recalcular);
    recalcular();
  }
  return () => {
    ouvintes.delete(f);
    if (ouvintes.size === 0) {
      window.removeEventListener("blur", aoPerderFoco);
      window.removeEventListener("focus", aoGanharFoco);
      window.removeEventListener("pagehide", aoPerderFoco);
      window.removeEventListener("beforeprint", antesDeImprimir);
      window.removeEventListener("afterprint", depoisDeImprimir);
      document.removeEventListener("visibilitychange", recalcular);
    }
  };
}
const nuncaAssinar = () => () => {};
const lerEscondido = () => janela.escondido;
const noServidor = () => false;

/**
 * Protege o elemento de `alvo` enquanto `ativo`: barra copiar, recortar, arrastar, selecionar e o menu do botão direito nele, e
 * devolve se o conteúdo deve estar escondido agora (a aba sumiu, a janela perdeu o foco ou a página vai para a impressão).
 */
export function useProtecaoContraPrint(alvo: RefObject<HTMLElement | null>, ativo: boolean): boolean {
  const escondido = useSyncExternalStore(ativo ? assinar : nuncaAssinar, lerEscondido, noServidor);
  useEffect(() => {
    const el = alvo.current;
    if (!ativo || !el) return;
    const barrar = (e: Event) => e.preventDefault();
    for (const ev of EVENTOS_BARRADOS) el.addEventListener(ev, barrar);
    return () => {
      for (const ev of EVENTOS_BARRADOS) el.removeEventListener(ev, barrar);
    };
  }, [alvo, ativo]);
  return ativo && escondido;
}

/** Os atributos que o elemento protegido leva (o CSS desliga a seleção e o esconde na impressão). */
export function atributosDaProtecao(ativo: boolean, escondido: boolean): Record<string, string | undefined> {
  return { [ATRIBUTO_PROTEGIDO]: ativo ? "" : undefined, [ATRIBUTO_ESCONDIDO]: ativo && escondido ? "" : undefined };
}

/**
 * A camada que vai DENTRO do elemento protegido (posicionado): a marca d'água com o codinome de quem lê e, com a janela fora da
 * frente, a capa que cobre tudo. `aviso` é o aviso fixo do limite (aparece pequeno, embaixo).
 */
export function CamadaDeProtecao({ marca, escondido, textoEscondido, aviso }: { marca: string; escondido: boolean; textoEscondido: string; aviso?: string | null }) {
  const texto = textoDaMarca(marca);
  return (
    <>
      {texto ? (
        <span className="p4-marca" aria-hidden>
          {Array.from({ length: REPETICOES_DA_MARCA }, (_, k) => (
            <span key={k}>{texto}</span>
          ))}
        </span>
      ) : null}
      {aviso ? <small className="p4-aviso-fixo">{aviso}</small> : null}
      {escondido ? (
        <span className="p4-capa" role="status">
          {textoEscondido}
        </span>
      ) : null}
    </>
  );
}

/** Um pedaço protegido (a foto do perfil, por exemplo): o embrulho com a proteção e a camada. Desligado, só o conteúdo. */
export function ConteudoProtegido({
  ativo,
  marca,
  textoEscondido,
  aviso,
  className,
  children,
}: {
  ativo: boolean;
  marca: string;
  textoEscondido: string;
  aviso?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const escondido = useProtecaoContraPrint(ref, ativo);
  if (!ativo) return <>{children}</>;
  return (
    <div ref={ref} className={`p4-protegido${className ? ` ${className}` : ""}`} {...atributosDaProtecao(ativo, escondido)}>
      {children}
      <CamadaDeProtecao marca={marca} escondido={escondido} textoEscondido={textoEscondido} aviso={aviso} />
    </div>
  );
}
