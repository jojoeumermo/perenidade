// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { meusDados } from "@/lib/rede/meusdados/cliente";
import type { TextosDeMeusDados } from "@/lib/rede/meusdados/textos";
import { Botao } from "../ui/Botao";

/**
 * O passo do código do aplicativo autenticador: exportar e apagar a conta pedem o código digitado agora (o banco exige o segundo
 * fator dos últimos 10 minutos). O campo já vem focado, aceita colar o código inteiro e confirma sozinho no sexto número.
 */
export function PedidoDeCodigo({ t, aoConfirmar, aoVoltar, perigo = false }: { t: TextosDeMeusDados; aoConfirmar: () => void; aoVoltar: () => void; perigo?: boolean }) {
  const id = useId();
  const campo = useRef<HTMLInputElement>(null);
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => campo.current?.focus(), []);

  async function confirmar(valor = codigo) {
    if (ocupado || valor.replace(/\D/g, "").length !== 6) return;
    setOcupado(true);
    setErro("");
    try {
      const r = await meusDados.confirmarCodigo(valor);
      if (r === "ok") return aoConfirmar();
      setCodigo("");
      setErro(r === "sem_fator" ? t.codigo.semFator : t.codigo.errado);
      campo.current?.focus();
    } catch {
      setErro(t.erros.falha);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form
      className="md-codigo"
      data-perigo={perigo || undefined}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void confirmar();
      }}
    >
      <p className="md-codigo-titulo al-cond" id={`${id}-t`}>{t.codigo.titulo}</p>
      <p className="md-codigo-texto">{t.codigo.texto}</p>
      <label className="md-campo-rotulo" htmlFor={`${id}-c`}>{t.codigo.rotulo}</label>
      <input
        ref={campo}
        id={`${id}-c`}
        className="md-campo md-campo-codigo"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={7}
        value={codigo}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-e` : undefined}
        onChange={(e) => {
          const limpo = e.target.value.replace(/\D/g, "").slice(0, 6);
          setCodigo(limpo);
          if (limpo.length === 6) void confirmar(limpo);
        }}
      />
      {erro ? (
        <p className="md-erro" id={`${id}-e`} role="alert">
          {erro}
        </p>
      ) : null}
      <div className="md-acoes">
        <Botao type="submit" variante={perigo ? "primario" : "claro"} disabled={ocupado || codigo.length !== 6} aria-busy={ocupado || undefined}>
          {t.codigo.confirmar}
        </Botao>
        <Botao variante="fantasma" onClick={aoVoltar} disabled={ocupado}>
          {t.codigo.voltar}
        </Botao>
      </div>
    </form>
  );
}
