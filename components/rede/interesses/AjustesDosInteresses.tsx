// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Ajustes → Interesses na linha (onda 11, 11F): o resumo do que a pessoa marcou no questionário, o botão para mudar (abre o
// mesmo questionário) e o de apagar. Tudo neste aparelho (lib/rede/interesses.ts); nada vai ao servidor por aqui.
import { useEffect, useState } from "react";
import { guardarInteresses, lerInteresses, type Interesses } from "@/lib/rede/interesses";
import type { ContextoDoEncaixe } from "../encaixes";
import { Questionario, ResumoDosInteresses } from "./Questionario";
import { useTextosDosInteresses } from "./textos";
import "./interesses.css";

export function AjustesDosInteresses({ lang }: ContextoDoEncaixe) {
  const t = useTextosDosInteresses(lang);
  const [atuais, setAtuais] = useState<Interesses | null>(null);
  const [lido, setLido] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    // Lido depois de montar: o servidor não sabe o que este aparelho guardou.
    const x = window.setTimeout(() => {
      setAtuais(lerInteresses());
      setLido(true);
    }, 0);
    return () => window.clearTimeout(x);
  }, []);

  if (!t || !lido) return null;
  if (aberto) {
    return (
      <Questionario
        lang={lang}
        inicial={atuais}
        comLinkDaRegra
        aoTerminar={(i) => {
          guardarInteresses(i);
          setAtuais(i);
          setAberto(false);
          setAviso(t.ajustes.salvo);
        }}
        aoPular={() => setAberto(false)}
      />
    );
  }
  return (
    <div className="in-ajustes">
      <p className="in-ajustes-texto">{atuais ? t.ajustes.texto : t.ajustes.vazio}</p>
      {atuais && (
        <div className="in-quadro in-quadro-baixo">
          <ResumoDosInteresses t={t} i={atuais} />
        </div>
      )}
      <div className="in-botoes">
        <button
          type="button"
          className="in-botao in-botao-cheio"
          onClick={() => {
            setAviso("");
            setAberto(true);
          }}
        >
          {atuais ? t.ajustes.editar : t.ajustes.responder}
        </button>
        {atuais && (
          <button
            type="button"
            className="in-botao in-botao-contorno"
            onClick={() => {
              guardarInteresses(null);
              setAtuais(null);
              setAviso(t.ajustes.apagado);
            }}
          >
            {t.ajustes.apagar}
          </button>
        )}
      </div>
      <p className="in-ajustes-nota">{t.ajustes.outroAparelho}</p>
      {aviso && (
        <p role="status" className="in-ajustes-aviso">
          {aviso}
        </p>
      )}
    </div>
  );
}
