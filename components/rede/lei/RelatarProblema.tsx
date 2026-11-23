// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { rpc } from "@/lib/backend";
import { aparelhoDoRelato, medidaDaTela, telaLimpa, versaoLimpa } from "@/lib/rede/beta/tela";
import { por, type TextosDaLei } from "./textos";

/**
 * "Relatar um problema" na ajuda da Alumia (P5, A21): o texto da pessoa e, preenchidos sozinhos, a tela em que ela está (sem nada
 * que diga quem é), o tipo de aparelho e a versão do site. Vai para public.alumia_relato_enviar, que guarda sem conta, sem endereço
 * de rede e sem hora, e cai na fila do painel de admin da Alumia. Só para quem está dentro (a porta da Alumia confere).
 * `de` é o endereço da tela de onde a pessoa veio (?de= na ajuda); sem ele, a própria ajuda.
 */
export function RelatarProblema({ t, logado }: { t: TextosDaLei["ajuda"]["relatar"]; logado: boolean }) {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<"" | "enviando" | "enviado" | "erro" | "curto">("");
  // A tela só desenha no navegador (o registro carrega a ajuda sem servidor): o que vai junto é lido uma vez, na primeira pintura.
  const [junto] = useState<{ tela: string; aparelho: string; medida: string } | null>(() => {
    if (typeof window === "undefined") return null;
    const de = new URLSearchParams(window.location.search).get("de") ?? "";
    const tela = telaLimpa(de.startsWith("/") ? de : window.location.pathname);
    return { tela, aparelho: aparelhoDoRelato(navigator.userAgent, window.innerWidth), medida: medidaDaTela(window.innerWidth, window.innerHeight) };
  });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (texto.trim().length < 10) return setEstado("curto");
    if (!junto) return;
    setEstado("enviando");
    try {
      const versao = await fetch("/versao.txt", { cache: "no-store" }).then((r) => (r.ok ? r.text() : "")).then(versaoLimpa).catch(() => "");
      await rpc("alumia_relato_enviar", { p: { texto: texto.trim(), tela: junto.tela, aparelho: junto.aparelho, medida: junto.medida, versao } });
      setTexto("");
      setEstado("enviado");
    } catch {
      setEstado("erro");
    }
  }

  return (
    <section className="le-faq-mais" aria-labelledby="le-relatar">
      <h2 id="le-relatar" className="al-cond">{t.titulo}</h2>
      <p>{t.texto}</p>
      {!logado ? (
        <p>{t.entrar}</p>
      ) : (
        <form onSubmit={(e) => void enviar(e)} className="mt-3 grid gap-2">
          <label htmlFor="le-relatar-texto" className="font-bold">{t.campo}</label>
          <textarea
            id="le-relatar-texto"
            className="min-h-28 w-full rounded-lg border border-[var(--al-superficie-2)] bg-[var(--al-fundo)] p-3 text-[var(--al-texto)]"
            maxLength={2000}
            value={texto}
            aria-describedby="le-relatar-ajuda le-relatar-junto"
            onChange={(e) => {
              setTexto(e.target.value);
              if (estado === "curto" || estado === "enviado") setEstado("");
            }}
          />
          <p id="le-relatar-ajuda" className="text-sm">{t.ajudaCampo}</p>
          {junto ? <p id="le-relatar-junto" className="text-sm">{por(t.vaiJunto, { tela: junto.tela || "/", aparelho: junto.aparelho })}</p> : null}
          <div aria-live="polite" className="text-sm">
            {estado === "enviado" ? <p role="status">{t.enviado}</p> : null}
            {estado === "erro" ? <p role="alert">{t.erro}</p> : null}
            {estado === "curto" ? <p role="alert">{t.curto}</p> : null}
          </div>
          <button type="submit" disabled={estado === "enviando"} className="al2-aperta min-h-11 justify-self-start rounded-full bg-[var(--al-vermelho)] px-5 font-bold text-white disabled:opacity-60">
            {estado === "enviando" ? t.enviando : t.enviar}
          </button>
        </form>
      )}
    </section>
  );
}
