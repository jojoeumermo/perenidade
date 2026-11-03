// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { chavesDeEstudo, montarCopia } from "@/lib/estudo";
import { desligarModoSeguro, estaLigado, ligarModoSeguro, sairRapido, tresEsc } from "@/lib/modo-seguro";
import { useTextosDaBusca } from "./busca/TextosDaBusca";
import "@/styles/escola-busca.css";

/** O modo seguro está ligado nesta aba? Relido quando liga ou desliga (false na primeira pintura, como no servidor). */
export function useModoSeguro(): boolean {
  const [ligado, setLigado] = useState(false);
  useEffect(() => {
    const atualizar = () => setLigado(estaLigado());
    const id = window.setTimeout(atualizar, 0);
    window.addEventListener("lucia:modo-seguro", atualizar);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("lucia:modo-seguro", atualizar);
    };
  }, []);
  return ligado;
}

/**
 * A saída rápida (Etapa 4, R1-94), montada no layout de todas as páginas, painel incluído. Com o modo seguro ligado:
 * um botão "Sair" discreto e fixo no canto (44 px) e a tecla Esc apertada 3 vezes em 1 segundo. Desligado, não desenha
 * nada e não escuta teclado. Fica sempre disponível, com ou sem a Escola.
 */
export function SaidaRapida() {
  const contexto = useTextosDaBusca();
  const ligado = useModoSeguro();
  const instantes = useRef<number[]>([]);

  useEffect(() => {
    if (!ligado) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const conta = tresEsc(instantes.current, e.timeStamp || performance.now());
      instantes.current = conta.instantes;
      if (conta.sair) void sairRapido();
    };
    // Na fase de captura: um campo ou uma janela que "come" o Esc não impede a saída.
    window.addEventListener("keydown", tecla, true);
    return () => window.removeEventListener("keydown", tecla, true);
  }, [ligado]);

  if (!ligado || !contexto) return null;
  const s = contexto.textos.seguro;
  return (
    <button type="button" onClick={() => void sairRapido()} aria-label={s.sairRotulo} title={s.sairRotulo} className="saida-rapida no-print" data-saida-rapida>
      {s.sair}
    </button>
  );
}

const botao = "inline-flex min-h-11 cursor-pointer items-center bg-ink px-5 py-2.5 font-sans text-sm font-semibold text-parchment hover:bg-oxblood";
const botaoClaro = "inline-flex min-h-11 cursor-pointer items-center border-2 border-ink px-5 py-2.5 font-sans text-sm font-semibold hover:border-oxblood hover:text-oxblood";

/** Os controles da página /modo-seguro: baixar a cópia antes, ligar ou desligar, e sair agora. */
export function PainelDoModoSeguro() {
  const contexto = useTextosDaBusca();
  const ligado = useModoSeguro();
  const [temEstudo, setTemEstudo] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    const ver = () => {
      try {
        setTemEstudo(chavesDeEstudo(localStorage).length > 0);
      } catch {
        setTemEstudo(false);
      }
    };
    const id = window.setTimeout(ver, 0);
    window.addEventListener("lucia:estudo", ver);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("lucia:estudo", ver);
    };
  }, []);

  if (!contexto) return null;
  const s = contexto.textos.seguro;

  function baixar() {
    try {
      const copia = montarCopia(localStorage);
      if (Object.keys(copia.dados).length === 0) {
        setAviso(s.semEstudo);
        return;
      }
      const url = URL.createObjectURL(new Blob([JSON.stringify(copia, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `instituto-lucia-copia-${copia.feita.slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setAviso(s.baixou);
    } catch {
      setAviso(s.semEstudo);
    }
  }

  return (
    <div className="font-sans text-sm">
      {!ligado && (
        <section aria-labelledby="ms-antes" className="border border-rule bg-parchment-deep p-5">
          <h2 id="ms-antes" className="font-serif text-2xl font-semibold">
            {s.antesTitulo}
          </h2>
          <p className="mt-2 text-ink-soft">{s.antesLead}</p>
          {temEstudo && (
            <p className="mt-3">
              <button type="button" className={botaoClaro} onClick={baixar} data-baixar-copia>
                {s.baixar}
              </button>
            </p>
          )}
        </section>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {ligado ? (
          <>
            <button type="button" className={botao} onClick={() => void sairRapido()}>
              {s.sairAgora}
            </button>
            <button
              type="button"
              className={botaoClaro}
              onClick={() => {
                desligarModoSeguro();
                setAviso(s.desligadoAgora);
              }}
            >
              {s.desligar}
            </button>
          </>
        ) : (
          <button
            type="button"
            className={botao}
            data-ligar-modo-seguro
            onClick={() => {
              ligarModoSeguro();
              setAviso(estaLigado() ? s.ligadoAgora : s.semSessao);
            }}
          >
            {s.ligar}
          </button>
        )}
      </div>
      <p role="status" className="mt-3 min-h-5 font-semibold">
        {ligado ? s.ligadoAgora : aviso}
      </p>
    </div>
  );
}
