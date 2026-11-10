// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { deFora } from "@/lib/rede/fediverso/tela/cliente";
import { textoDoErroDeFora, type TextosDoFediverso } from "@/lib/rede/fediverso/tela/textos";
import { CATEGORIAS_DE_DENUNCIA, type CategoriaDeDenuncia } from "@/lib/rede/fediverso/tela/tipos";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";

const LIMITE_DO_TEXTO = 1000;

interface Feita {
  protocolo: string | null;
  encaminhada: boolean;
  ja: boolean;
}

/**
 * Denunciar um post (ou uma conta) de fora à mediação daqui: o motivo, um texto opcional e a caixa "avisar também o servidor de
 * origem" (desmarcada: a pessoa escolhe). No fim mostra o protocolo. `alvo` é o endereço https da nota ou do ator. Na prévia
 * nada sai da tela.
 */
export function DenunciarDeFora({ alvo, t, previa = false, aoFechar, className = "" }: { alvo: string; t: TextosDoFediverso; previa?: boolean; aoFechar: () => void; className?: string }) {
  const [categoria, setCategoria] = useState<CategoriaDeDenuncia | null>(null);
  const [texto, setTexto] = useState("");
  const [encaminhar, setEncaminhar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [feita, setFeita] = useState<Feita | null>(null);
  const id = useId();
  const primeiro = useRef<HTMLInputElement>(null);
  const fim = useRef<HTMLDivElement>(null);
  // O formulário abre por um item de menu que some: o foco vem para o primeiro motivo; depois de enviar, para o protocolo.
  useEffect(() => {
    primeiro.current?.focus();
  }, []);
  useEffect(() => {
    if (feita) fim.current?.focus();
  }, [feita]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!categoria || enviando) return;
    setEnviando(true);
    setErro("");
    const r = previa ? { ok: true as const, dado: { protocolo: "EXEMPLO-0001", encaminhada: encaminhar, ja: false } } : await deFora.denunciar(alvo, categoria, texto.trim(), encaminhar);
    setEnviando(false);
    if (!r.ok) return setErro(textoDoErroDeFora(t, r.erro));
    setFeita({ protocolo: r.dado.protocolo, encaminhada: r.dado.encaminhada, ja: r.dado.ja });
  }

  const caixa = `mt-2 rounded-xl border border-[var(--al-superficie-2)] bg-[var(--al-superficie)] p-3 text-sm text-[var(--al-texto)] ${className}`.trim();

  if (feita) {
    return (
      <div ref={fim} tabIndex={-1} role="status" className={`${caixa} outline-none`}>
        <p className="font-bold">{preencher(feita.ja ? t.denuncia.jaEnviada : t.denuncia.enviada, { protocolo: feita.protocolo ?? "—" })}</p>
        {encaminhar && !feita.ja && !feita.encaminhada && <p className="mt-1 text-[var(--al-texto-2)]">{t.denuncia.naoEncaminhada}</p>}
        <div className="mt-2 flex justify-end">
          <Botao variante="contorno" tamanho="p" onClick={aoFechar}>
            {t.denuncia.fechar}
          </Botao>
        </div>
      </div>
    );
  }

  return (
    <form className={caixa} onSubmit={enviar} aria-labelledby={`${id}-titulo`}>
      <fieldset className="m-0 min-w-0 border-0 p-0" disabled={enviando}>
        <legend id={`${id}-titulo`} className="mb-1 p-0 text-[0.9375rem] font-extrabold">
          {t.denuncia.titulo}
        </legend>
        <div className="grid gap-x-3 sm:grid-cols-2">
          {CATEGORIAS_DE_DENUNCIA.map((c, i) => (
            <label key={c} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg px-1">
              <input ref={i === 0 ? primeiro : undefined} type="radio" name={`${id}-categoria`} value={c} checked={categoria === c} onChange={() => setCategoria(c)} required className="h-4 w-4 shrink-0 accent-[var(--al-vermelho)]" />
              <span>{t.denuncia.categorias[c]}</span>
            </label>
          ))}
        </div>
        <label htmlFor={`${id}-texto`} className="mt-2 block font-semibold text-[var(--al-texto-2)]">
          {t.denuncia.texto}
        </label>
        <textarea
          id={`${id}-texto`}
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, LIMITE_DO_TEXTO))}
          maxLength={LIMITE_DO_TEXTO}
          rows={3}
          className="mt-1 block w-full resize-y rounded-lg border border-[var(--al-superficie-2)] bg-[var(--al-fundo)] px-2.5 py-2 text-[0.9375rem] text-[var(--al-texto)]"
        />
        <label className="mt-1 flex min-h-[44px] cursor-pointer items-center gap-2">
          <input type="checkbox" checked={encaminhar} onChange={(e) => setEncaminhar(e.target.checked)} className="h-4 w-4 shrink-0 accent-[var(--al-vermelho)]" />
          <span>{t.denuncia.encaminhar}</span>
        </label>
      </fieldset>
      <div aria-live="polite">
        {erro && (
          <p role="alert" className="mt-1 font-semibold text-[var(--al-vermelho-texto,var(--al-vermelho))]">
            {erro}
          </p>
        )}
      </div>
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <Botao variante="fantasma" tamanho="p" onClick={aoFechar} disabled={enviando}>
          {t.denuncia.fechar}
        </Botao>
        <Botao type="submit" tamanho="p" disabled={!categoria || enviando} aria-busy={enviando}>
          {t.denuncia.enviar}
        </Botao>
      </div>
    </form>
  );
}

export default DenunciarDeFora;
