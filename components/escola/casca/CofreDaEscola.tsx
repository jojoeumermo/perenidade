// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { TextosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import { abrirCofre, apagarCofre, criarCofre, type EstadoDoCofre, estadoDoCofre, fecharCofre, FRASE_MINIMA } from "@/lib/escola/cofre";

type T = TextosDaFormacaoBase["casca"];

/** Até quando o convite para criar o cofre fica guardado depois de "Agora não" (7 dias). */
const ADIADO = "lucia:escola:cofre-adiado";
const SETE_DIAS = 7 * 24 * 60 * 60_000;

/** O estado do cofre, atualizado quando ele abre, fecha ou é apagado (em qualquer parte da aba). */
export function useCofre(): EstadoDoCofre | null {
  const [estado, setEstado] = useState<EstadoDoCofre | null>(null);
  useEffect(() => {
    const ver = () => setEstado(estadoDoCofre());
    ver();
    globalThis.addEventListener("lucia:escola-cofre", ver);
    return () => globalThis.removeEventListener("lucia:escola-cofre", ver);
  }, []);
  return estado;
}

function adiado(): boolean {
  try {
    return Number(localStorage.getItem(ADIADO) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

/**
 * A faixa do cofre no alto do conteúdo da Escola: o convite para criar (sem cofre), o pedido da frase (cofre fechado) ou
 * nada (cofre aberto; o "Fechar o cofre" fica na coluna). lib/escola/cofre.ts explica a cifra.
 */
export function FaixaDoCofre({ t, estado }: { t: T; estado: EstadoDoCofre | null }) {
  const [criando, setCriando] = useState(false);
  const [frase, setFrase] = useState("");
  const [repetir, setRepetir] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [escondido, setEscondido] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEscondido(adiado());
  }, []);

  if (estado === null || estado === "aberto") return null;
  if (estado === "sem-cofre" && escondido) return null;

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (frase.length < FRASE_MINIMA) return setErro(t.cofreCurta);
    if (frase !== repetir) return setErro(t.cofreDiferente);
    setOcupado(true);
    const ok = await criarCofre(frase);
    setOcupado(false);
    setFrase("");
    setRepetir("");
    setErro(ok ? "" : t.cofreCurta);
  }

  async function abrir(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    const ok = await abrirCofre(frase);
    setOcupado(false);
    setFrase("");
    setErro(ok ? "" : t.cofreErrada);
  }

  if (estado === "fechado") {
    return (
      <section className="ef-cofre" aria-labelledby="ef-cofre-titulo">
        <h2 id="ef-cofre-titulo" className="ef-t">
          {t.cofreTitulo}
        </h2>
        <p>{t.cofreFechado}</p>
        <form onSubmit={abrir} className="ef-cofre-form">
          <label>
            <span className="sr-only">{t.cofreFrase}</span>
            <input type="password" autoComplete="off" value={frase} onChange={(e) => setFrase(e.target.value)} placeholder={t.cofreFrase} required />
          </label>
          <button type="submit" className="ef-botao-ouro" disabled={ocupado}>
            {ocupado ? t.cofreAbrindo : t.cofreAbrir}
          </button>
        </form>
        {erro && (
          <p role="alert" className="ef-cofre-erro">
            {erro}
          </p>
        )}
        <button
          type="button"
          className="ef-cofre-esqueci"
          onClick={() => {
            if (window.confirm(t.cofreEsqueciConfirma)) apagarCofre();
          }}
        >
          {t.cofreEsqueci}
        </button>
      </section>
    );
  }

  return (
    <section className="ef-cofre" aria-labelledby="ef-cofre-titulo">
      <h2 id="ef-cofre-titulo" className="ef-t">
        {t.cofreTitulo}
      </h2>
      <p>{t.cofreConvite}</p>
      {criando ? (
        <form onSubmit={criar} className="ef-cofre-form ef-cofre-form-criar">
          <label>
            <span className="sr-only">{t.cofreFrase}</span>
            <input type="password" autoComplete="new-password" minLength={FRASE_MINIMA} value={frase} onChange={(e) => setFrase(e.target.value)} placeholder={t.cofreFrase} required />
          </label>
          <label>
            <span className="sr-only">{t.cofreRepetir}</span>
            <input type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} placeholder={t.cofreRepetir} required />
          </label>
          <p className="ef-cofre-aviso">{t.cofreAviso}</p>
          <button type="submit" className="ef-botao-ouro" disabled={ocupado}>
            {t.cofreCriar}
          </button>
        </form>
      ) : (
        <div className="ef-cofre-form">
          <button type="button" className="ef-botao-ouro" onClick={() => setCriando(true)}>
            {t.cofreCriar}
          </button>
          <button
            type="button"
            className="ef-botao-vazado"
            onClick={() => {
              try {
                localStorage.setItem(ADIADO, String(Date.now() + SETE_DIAS));
              } catch {
                // sem armazenamento: o convite volta na próxima visita
              }
              setEscondido(true);
            }}
          >
            {t.cofreDepois}
          </button>
        </div>
      )}
      {erro && (
        <p role="alert" className="ef-cofre-erro">
          {erro}
        </p>
      )}
    </section>
  );
}

/** O "Fechar o cofre" da coluna, só com o cofre aberto. */
export function FecharCofre({ t, estado }: { t: T; estado: EstadoDoCofre | null }) {
  if (estado !== "aberto") return null;
  return (
    <button type="button" className="ef-sair" onClick={fecharCofre}>
      {t.cofreFechar}
    </button>
  );
}
