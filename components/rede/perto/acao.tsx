// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A ação de um botão do "Perto" (Prompt 4, lote perto): ocupado, o erro e o recado de feito, com os avisos para a tela.
import { useState } from "react";
import { textoDoErro, type TextosDoPerto } from "./textos";

type T = TextosDoPerto;

export function useAcao(t: T) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");
  const fazer = async (acao: () => Promise<string | void>) => {
    setOcupado(true);
    setErro("");
    setFeito("");
    try {
      const msg = await acao();
      if (msg) setFeito(msg);
    } catch (e) {
      setErro(textoDoErro(t.erros, e));
    } finally {
      setOcupado(false);
    }
  };
  const avisos = (
    <>
      {erro && <p role="alert" className="pt-erro">{erro}</p>}
      {feito && <p role="status" className="pt-ok">{feito}</p>}
    </>
  );
  return { ocupado, fazer, avisos };
}
