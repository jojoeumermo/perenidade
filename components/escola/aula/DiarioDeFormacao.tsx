// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { TextosDaFormacao } from "@/i18n/escola/formacao";
import { apagarDiario, gravarEntrada, lerEntrada, LIMITES_DO_DIARIO, MUDOU_O_DIARIO, podeGravar } from "@/lib/escola/diario";
import { useHydrated } from "@/lib/storage";

/**
 * O diário de formação (prancha Aula): "Só você lê. Fica neste aparelho." Uma entrada por aula, gravada SÓ no aparelho
 * (lib/escola/diario.ts, chave lucia:escola-privado:diario): nada daqui vai ao servidor (scripts/testar-escola-cadernos.mjs
 * confere que este arquivo não chama o banco). Com o modo seguro ligado, nada é gravado. Apagar é na hora.
 */
export function DiarioDeFormacao({ aula, t }: { aula: string; t: TextosDaFormacao["aula"]["diario"] }) {
  const hidratado = useHydrated();
  const [texto, setTexto] = useState("");
  const [guardado, setGuardado] = useState(false);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();
  const pode = hidratado && podeGravar();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o diário só existe no aparelho
    setTexto(lerEntrada(aula));
    const reler = () => setTexto(lerEntrada(aula));
    window.addEventListener("storage", reler);
    window.addEventListener(MUDOU_O_DIARIO, reler);
    return () => {
      window.removeEventListener("storage", reler);
      window.removeEventListener(MUDOU_O_DIARIO, reler);
    };
  }, [aula]);

  useEffect(
    () => () => {
      if (espera.current) clearTimeout(espera.current);
    },
    [],
  );

  const mudar = (valor: string) => {
    setTexto(valor);
    setGuardado(false);
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(() => setGuardado(gravarEntrada(aula, valor)), 600);
  };

  const apagarEsta = () => {
    if (espera.current) clearTimeout(espera.current);
    gravarEntrada(aula, "");
    setTexto("");
    setGuardado(false);
  };

  const apagarTudo = () => {
    if (!window.confirm(t.confirmarTudo)) return;
    if (espera.current) clearTimeout(espera.current);
    apagarDiario();
    setTexto("");
    setGuardado(false);
  };

  return (
    <section aria-labelledby={`${id}-t`} className="efa-cartao efa-diario">
      <h2 id={`${id}-t`} className="ef-t">
        {t.titulo}
      </h2>
      <p className="efa-pequeno">{t.lead}</p>
      {hidratado && !pode ? (
        <p className="efa-pequeno">{t.seguro}</p>
      ) : (
        <>
          <label htmlFor={`${id}-campo`} className="sr-only">
            {t.rotulo}
          </label>
          <textarea id={`${id}-campo`} rows={6} maxLength={LIMITES_DO_DIARIO.entrada} placeholder={t.dica} value={texto} onChange={(e) => mudar(e.target.value)} className="efa-diario-campo" />
          <p role="status" className="efa-pequeno">
            {guardado ? t.guardado : ""}
          </p>
          <div className="efa-diario-botoes">
            {texto && (
              <button type="button" className="efa-botao-texto" onClick={apagarEsta}>
                {t.apagar}
              </button>
            )}
            <button type="button" className="efa-botao-texto" onClick={apagarTudo}>
              {t.apagarTudo}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
