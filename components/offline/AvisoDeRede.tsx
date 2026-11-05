// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useI18n } from "../I18n";
import { CHAVE_DA_FILA, EVENTO_DA_FILA, acompanharAtualizacao, descartarFila, esvaziarFila, lerFila, pedirCasca, podeBuscarVersao, situacaoDoStatus, textosDeRede, type ItemDaFila, type SituacaoDoEnvio } from "./offline";

function assinarRede(aviso: () => void) {
  window.addEventListener("online", aviso);
  window.addEventListener("offline", aviso);
  return () => {
    window.removeEventListener("online", aviso);
    window.removeEventListener("offline", aviso);
  };
}

/** Manda um item da fila ao próprio site. Só chega aqui o que passou por enderecoDaFilaValido (/api/...). */
async function enviar(item: ItemDaFila): Promise<SituacaoDoEnvio> {
  try {
    const resposta = await fetch(item.url, { method: item.metodo, headers: { "Content-Type": item.tipo ?? "application/json" }, body: item.corpo, credentials: "same-origin" });
    return situacaoDoStatus(resposta.status);
  } catch {
    return "rede";
  }
}

const armazem = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

type ComIdle = Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (n: number) => void };

/**
 * Os avisos do funcionamento sem internet (docs/APP-OFFLINE.md), montados uma vez no layout:
 *  - "Sem internet. O que você já abriu continua aqui." enquanto o aparelho está sem rede (e a marca data-sem-internet em <html>);
 *  - a fila do que precisa de rede: quantos envios esperam, com "Descartar"; ao voltar a internet eles vão, uma vez;
 *  - "Nova versão do aplicativo. Toque para atualizar" quando o service worker novo terminou de instalar e está esperando;
 *  - ao abrir, pede ao service worker que guarde as 5 telas das abas (a barra de baixo nunca cai em "sem conexão").
 * Nada disso rastreia: a fila e o aviso vivem no aparelho e só falam com o próprio site.
 */
export function AvisoDeRede() {
  const { lang } = useI18n();
  const s = textosDeRede(lang);
  const online = useSyncExternalStore(assinarRede, () => navigator.onLine, () => true);
  const [fila, setFila] = useState(0);
  const [enviados, setEnviados] = useState(0);
  const [haNova, setHaNova] = useState(false);
  const [adiada, setAdiada] = useState(false);
  const assumir = useRef<(() => void) | null>(null);
  const pediuAtualizar = useRef(false);
  const enviando = useRef(false);

  // A marca em <html>, para o CSS e os outros pacotes lerem.
  useEffect(() => {
    const raiz = document.documentElement;
    if (online) raiz.removeAttribute("data-sem-internet");
    else raiz.setAttribute("data-sem-internet", "");
    return () => raiz.removeAttribute("data-sem-internet");
  }, [online]);

  // A fila: conta ao abrir e a cada mudança; ao ter internet, manda.
  useEffect(() => {
    const contar = () => {
      const a = armazem();
      setFila(a ? lerFila(a, Date.now()).length : 0);
    };
    const mandar = async () => {
      const a = armazem();
      if (!a || enviando.current || !navigator.onLine || lerFila(a, Date.now()).length === 0) return;
      enviando.current = true;
      try {
        const { enviados: feitos } = await esvaziarFila(a, enviar, Date.now());
        if (feitos > 0) {
          setEnviados(feitos);
          setTimeout(() => setEnviados(0), 4000);
        }
      } finally {
        enviando.current = false;
      }
    };
    const alterou = (e: StorageEvent) => {
      if (e.key === CHAVE_DA_FILA) contar();
    };
    contar();
    void mandar();
    window.addEventListener(EVENTO_DA_FILA, contar);
    window.addEventListener("storage", alterou);
    window.addEventListener("online", mandar);
    return () => {
      window.removeEventListener(EVENTO_DA_FILA, contar);
      window.removeEventListener("storage", alterou);
      window.removeEventListener("online", mandar);
    };
  }, []);

  // O service worker: aviso de versão nova, busca ao voltar ao aplicativo e a casca guardada.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let vivo = true;
    let ultimaBusca = Date.now();
    let registroAtual: ServiceWorkerRegistration | null = null;
    const haControle = !!navigator.serviceWorker.controller;
    const depoisDaTroca = () => {
      // Só recarrega quando a pessoa tocou em atualizar; a primeira instalação assume sem recarregar nada.
      if (pediuAtualizar.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", depoisDaTroca);
    navigator.serviceWorker.ready
      .then((registro) => {
        if (!vivo) return;
        registroAtual = registro;
        assumir.current = acompanharAtualizacao(registro, haControle || !!navigator.serviceWorker.controller, () => {
          if (vivo) setHaNova(true);
        });
      })
      .catch(() => undefined);
    const voltou = () => {
      if (document.visibilityState !== "visible" || !registroAtual || !podeBuscarVersao(ultimaBusca, Date.now())) return;
      ultimaBusca = Date.now();
      registroAtual.update().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", voltou);
    // A casca (5 abas) é guardada uma vez por visita, quando o aparelho está livre.
    let guardar: number | undefined;
    const janela = window as ComIdle;
    try {
      if (!sessionStorage.getItem("lucia-casca-guardada")) {
        sessionStorage.setItem("lucia-casca-guardada", "1");
        const iniciar = () => void pedirCasca(lang);
        guardar = janela.requestIdleCallback ? janela.requestIdleCallback(iniciar, { timeout: 8000 }) : window.setTimeout(iniciar, 4000);
      }
    } catch {
      // sem sessionStorage: tenta uma vez por carga
      void pedirCasca(lang);
    }
    return () => {
      vivo = false;
      navigator.serviceWorker.removeEventListener("controllerchange", depoisDaTroca);
      document.removeEventListener("visibilitychange", voltou);
      if (guardar !== undefined) {
        if (janela.cancelIdleCallback) janela.cancelIdleCallback(guardar);
        else clearTimeout(guardar);
      }
    };
  }, [lang]);

  const mostrarNova = haNova && !adiada;
  if (online && fila === 0 && enviados === 0 && !mostrarNova) return null;
  return (
    <div className="aviso-rede" role="status" aria-live="polite" data-sem-gesto>
      {!online && <p className="aviso-rede-linha">{s.semInternet}</p>}
      {fila > 0 && (
        <p className="aviso-rede-linha">
          <span>{s.fila(fila)}</span>
          <button
            type="button"
            className="aviso-rede-botao"
            onClick={() => {
              const a = armazem();
              if (a) descartarFila(a);
            }}
          >
            {s.descartar}
          </button>
        </p>
      )}
      {enviados > 0 && <p className="aviso-rede-linha">{s.enviados(enviados)}</p>}
      {mostrarNova && (
        <p className="aviso-rede-linha">
          <span>{s.novaVersao}</span>
          <button
            type="button"
            className="aviso-rede-botao aviso-rede-botao-forte"
            onClick={() => {
              pediuAtualizar.current = true;
              assumir.current?.();
            }}
          >
            {s.atualizar}
          </button>
          <button type="button" className="aviso-rede-botao" onClick={() => setAdiada(true)}>
            {s.depois}
          </button>
        </p>
      )}
    </div>
  );
}
