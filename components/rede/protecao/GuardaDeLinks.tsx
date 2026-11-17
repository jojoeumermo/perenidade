// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { carregarTextosDaProtecao, type TextosDaProtecao } from "@/lib/rede/textos-protecao";
import type { ContextoDoEncaixe } from "../encaixes";
import { Botao } from "../ui/Botao";
import { analisarLink, type AnaliseDeLink } from "./link-suspeito";
import "./protecao.css";

/**
 * O aviso de link suspeito. Fica preso à casca da Alumia (encaixe colunaDireita, que existe em toda tela, mesmo quando a coluna
 * não aparece) e escuta os toques em links: um link para FORA da Alumia que acende algum padrão da lista aberta
 * (./link-suspeito.ts) para antes de abrir e mostra o destino de verdade e o porquê. Tudo aqui no aparelho: o endereço não vai a
 * serviço nenhum. Link comum abre direto, sem aviso.
 */
export default function GuardaDeLinks({ lang }: ContextoDoEncaixe) {
  const [t, setT] = useState<TextosDaProtecao | null>(null);
  const [alvo, setAlvo] = useState<{ href: string; analise: AnaliseDeLink } | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const [casa, setCasa] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let vivo = true;
    void carregarTextosDaProtecao(lang).then((x) => vivo && setT(x));
    return () => {
      vivo = false;
    };
  }, [lang]);

  useEffect(() => {
    const aoTocar = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button > 1) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || !a.closest(".al2")) return;
      const bruto = a.getAttribute("href") ?? "";
      let href = bruto;
      try {
        const u = new URL(bruto, window.location.href);
        if (u.origin === window.location.origin) return;
        href = /^(javascript|data|vbscript):/i.test(bruto.trim()) ? bruto.trim() : u.href;
      } catch {
        return;
      }
      const analise = analisarLink(href);
      if (!analise.suspeito) return;
      e.preventDefault();
      e.stopPropagation();
      // A pele da Alumia (onde valem as cores dos dois temas): o aviso mora nela, fora da coluna da direita, que some abaixo de 1280 px.
      setCasa(a.closest<HTMLElement>(".al-pele") ?? document.querySelector<HTMLElement>('[data-al="2"] .al-pele, [data-al="2"]') ?? document.body);
      setAlvo({ href, analise });
    };
    document.addEventListener("click", aoTocar, true);
    document.addEventListener("auxclick", aoTocar, true);
    return () => {
      document.removeEventListener("click", aoTocar, true);
      document.removeEventListener("auxclick", aoTocar, true);
    };
  }, []);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (alvo && !d.open) d.showModal();
    if (!alvo && d.open) d.close();
  }, [alvo]);

  if (!t || !casa) return null;
  return createPortal(
    <dialog ref={dialogo} className="pt-dialogo" aria-labelledby="pt-link-titulo" onClose={() => setAlvo(null)}>
      <div className="pt-dialogo-faixa" aria-hidden />
      {alvo && (
        <div className="pt-dialogo-corpo">
          <h2 id="pt-link-titulo" className="al-cond">{t.link.titulo}</h2>
          {alvo.analise.host && (
            <>
              <p className="pt-texto" style={{ marginBottom: 0 }}>{t.link.vaiPara}</p>
              <p className="pt-destino">{alvo.analise.host}</p>
            </>
          )}
          <p className="pt-texto" style={{ marginBottom: 0, fontWeight: 700, color: "var(--al-texto)" }}>{t.link.porque}</p>
          <ul className="pt-motivos">
            {alvo.analise.motivos.map((m) => (
              <li key={m}>{t.link.motivos[m]}</li>
            ))}
          </ul>
          <div className="pt-acoes">
            <Botao variante="primario" autoFocus onClick={() => setAlvo(null)}>{t.link.voltar}</Botao>
            {alvo.analise.perigo ? (
              <p className="pt-nota">{t.link.naoAbre}</p>
            ) : (
              <Botao variante="contorno" onClick={() => {
                window.open(alvo.href, "_blank", "noopener,noreferrer");
                setAlvo(null);
              }}>
                {t.link.abrir}
              </Botao>
            )}
          </div>
        </div>
      )}
    </dialog>,
    casa,
  );
}
