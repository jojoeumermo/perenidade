// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { TextosDaFormacao } from "@/i18n/escola/formacao";
import { apagarFicha, CAMPOS_DA_FICHA, gravarFicha, lerFicha, MUDOU_O_DIARIO, pareceDadoPessoal, podeGravar, type CampoDaFicha, type FichaDeRegistro } from "@/lib/escola/diario";
import { preencher } from "@/lib/escola/textos";
import { useHydrated } from "@/lib/storage";

/** A ficha guardada deste caderno, relida quando outra parte da página (ou outra aba) muda o diário. */
function useFicha(caderno: string): [FichaDeRegistro | null, () => void] {
  const [ficha, setFicha] = useState<FichaDeRegistro | null>(null);
  const reler = () => setFicha(lerFicha(caderno));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a ficha só existe no aparelho
    setFicha(lerFicha(caderno));
    const ouvir = () => setFicha(lerFicha(caderno));
    window.addEventListener(MUDOU_O_DIARIO, ouvir);
    window.addEventListener("storage", ouvir);
    return () => {
      window.removeEventListener(MUDOU_O_DIARIO, ouvir);
      window.removeEventListener("storage", ouvir);
    };
  }, [caderno]);
  return [ficha, reler];
}

/**
 * A tarefa no mundo do caderno (prancha Caderno), com a ficha de registro: o que fiz, onde, com quem (sem nomes), o que
 * aprendi e o que levo ao núcleo (a sistematização do trabalho de base). Tudo fica SÓ neste aparelho
 * (lib/escola/diario.ts): marcar como feita e a ficha servem para a pessoa contar no núcleo, não vão ao servidor.
 */
export function TarefaDoCaderno({ lang, caderno, texto, t }: { lang: Locale; caderno: string; texto: string; t: TextosDaFormacao["caderno"]["tarefa"] }) {
  const hidratado = useHydrated();
  const [ficha, reler] = useFicha(caderno);
  const [aberta, setAberta] = useState(false);
  const [rascunho, setRascunho] = useState<Partial<Record<CampoDaFicha, string>> | null>(null);
  const [aviso, setAviso] = useState("");
  const id = useId();
  const pode = hidratado && podeGravar();
  const campos = rascunho ?? ficha?.campos ?? {};

  const marcar = () => {
    gravarFicha(caderno, { campos: ficha?.campos ?? {}, feita: ficha?.feita ? null : Date.now() });
    reler();
  };
  const guardar = () => {
    if (Object.values(campos).some((v) => v && pareceDadoPessoal(v))) return setAviso(t.dadoPessoal);
    gravarFicha(caderno, { campos, feita: ficha?.feita ?? null });
    setRascunho(null);
    reler();
    setAviso(t.guardada);
  };
  const apagar = () => {
    apagarFicha(caderno);
    setRascunho(null);
    reler();
    setAviso(t.apagada);
  };
  const data = ficha?.feita ? new Intl.DateTimeFormat(lang, { day: "numeric", month: "long" }).format(new Date(ficha.feita)) : "";

  return (
    <section aria-labelledby={`${id}-t`} className="eff-cartao eff-tarefa">
      <h2 id={`${id}-t`} className="ef-t">
        {t.titulo}
      </h2>
      <p>{texto}</p>
      {!pode && hidratado ? (
        <p className="eff-pequeno">{t.seguro}</p>
      ) : (
        <>
          <div className="eff-tarefa-botoes">
            <button type="button" className="ef-botao-escuro" onClick={marcar} aria-pressed={Boolean(ficha?.feita)}>
              {ficha?.feita ? t.desmarcar : t.marcar}
            </button>
            <button type="button" className="eff-botao-linha" aria-expanded={aberta} aria-controls={`${id}-ficha`} onClick={() => setAberta((a) => !a)}>
              {t.fichaAbrir}
            </button>
          </div>
          {ficha?.feita && <p className="eff-pequeno">{preencher(t.feita, { data })}</p>}
          {aberta && (
            <div id={`${id}-ficha`} className="eff-ficha">
              <h3 className="ef-t">{t.ficha}</h3>
              <p className="eff-pequeno">{t.fichaLead}</p>
              {CAMPOS_DA_FICHA.map((c) => (
                <label key={c} className="eff-campo">
                  <span>{t.campos[c]}</span>
                  <textarea rows={2} maxLength={600} value={campos[c] ?? ""} onChange={(e) => setRascunho({ ...campos, [c]: e.target.value })} />
                </label>
              ))}
              <div className="eff-tarefa-botoes">
                <button type="button" className="ef-botao-escuro" onClick={guardar}>
                  {t.guardar}
                </button>
                {ficha && (
                  <button type="button" className="eff-botao-linha" onClick={apagar}>
                    {t.apagar}
                  </button>
                )}
              </div>
            </div>
          )}
          <p role="status" className="eff-pequeno">
            {aviso}
          </p>
        </>
      )}
    </section>
  );
}
