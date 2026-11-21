// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { rede } from "@/lib/rede/cliente";
import { preencher } from "@/lib/rede/preencher";
import { capitulosDoTexto, fonteDoCapitulo } from "@/lib/rede/texto/formatado";
import type { Post } from "@/lib/rede/tipos";
import { TextoFormatado } from "../../texto/TextoFormatado";
import { useImagensDoPost } from "../../texto/usarImagensDoPost";
import { enderecoDaMidia } from "../api";
import type { TextosDoP4 } from "./textos";
import "./p4.css";

const FOCAVEIS = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A leitura em páginas do texto longo (prompt 4, item 26): a capa (a imagem que a autora escolheu), o índice dos capítulos e um
 * capítulo por página, com Anterior e Próxima (e as setas do teclado). Tudo feito no aparelho a partir do próprio texto (os "## "
 * abrem capítulos; lib/rede/texto/formatado.ts): nada de novo vai ao servidor além do post, que a pessoa já podia abrir. A linha
 * traz só o resumo do texto: o corpo inteiro vem de rede_post (com rede_ve, como na página do post). Esc fecha; o foco volta para o
 * botão que abriu.
 */
export default function LeituraEmPaginas({ post, capa, t, lang, aoFechar }: { post: Post; capa: string | null; t: TextosDoP4; lang: string; aoFechar: () => void }) {
  const [corpo, setCorpo] = useState<string | null>(post.corpo ?? null);
  const [erro, setErro] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [srcDaCapa, setSrcDaCapa] = useState<string | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const corpoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (corpo !== null) return;
    let vivo = true;
    rede.post(post.id).then(
      (r) => vivo && setCorpo(r?.post?.corpo ?? r?.post?.texto ?? ""),
      () => vivo && setErro(true),
    );
    return () => {
      vivo = false;
    };
  }, [corpo, post.id]);

  useEffect(() => {
    if (!capa) return;
    let vivo = true;
    enderecoDaMidia(capa).then(
      (src) => vivo && setSrcDaCapa(src),
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [capa]);

  const capitulos = useMemo(() => (corpo ? capitulosDoTexto(corpo) : []), [corpo]);
  const total = Math.max(1, capitulos.length);
  const fonte = useMemo(() => (corpo ? fonteDoCapitulo(corpo, pagina) : ""), [corpo, pagina]);
  const imagens = useImagensDoPost(corpo ?? "", post.midia);
  const midiaDaCapa = capa ? post.midia.find((m) => m.id === capa) : undefined;

  // Abrir: o foco vai para a caixa; fechar: volta para quem abriu. Esc fecha; as setas trocam de página (fora de um campo).
  useEffect(() => {
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    caixa.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        aoFechar();
      } else if (e.key === "ArrowRight") setPagina((p) => Math.min(p + 1, total - 1));
      else if (e.key === "ArrowLeft") setPagina((p) => Math.max(p - 1, 0));
    };
    window.addEventListener("keydown", tecla);
    return () => {
      window.removeEventListener("keydown", tecla);
      if (antes?.isConnected) antes.focus();
    };
  }, [aoFechar, total]);

  // Trocar de página volta ao alto do texto.
  useEffect(() => {
    corpoRef.current?.scrollTo({ top: 0 });
  }, [pagina]);

  function prenderTab(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab") return;
    const lista = Array.from(caixa.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? []).filter((x) => x.getClientRects().length > 0);
    if (!lista.length) return;
    const [primeiro, ultimo] = [lista[0], lista[lista.length - 1]];
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  const titulo = post.titulo ?? "";
  const nomeDoCapitulo = (i: number) => capitulos[i]?.titulo ?? t.leitura.abertura;
  return (
    <div ref={caixa} tabIndex={-1} className="al2 p4c-leitura p4c-leitura-entra" role="dialog" aria-modal="true" aria-labelledby="p4c-leitura-titulo" onKeyDown={prenderTab} onClick={(e) => e.stopPropagation()}>
      <div className="p4c-leitura-topo">
        <h2 id="p4c-leitura-titulo" className="min-w-0 truncate text-base font-black">{titulo || t.leitura.titulo}</h2>
        <button type="button" className="p4c-botao" onClick={aoFechar}>{t.leitura.fechar}</button>
      </div>
      <div ref={corpoRef} className="p4c-leitura-corpo">
        <div className="p4c-leitura-miolo">
          {corpo === null && !erro && <p role="status">{t.leitura.carregando}</p>}
          {erro && <p role="alert">{t.leitura.erro}</p>}
          {corpo !== null && (
            <>
              {pagina === 0 && srcDaCapa && (
                // eslint-disable-next-line @next/next/no-img-element -- endereço assinado do depósito da Alumia, por pouco tempo
                <img className="p4c-capa" src={srcDaCapa} alt={midiaDaCapa?.alt || t.leitura.capa} />
              )}
              {capitulos.length > 1 && (
                <nav aria-label={t.leitura.indice}>
                  <p className="al2-rotulo">{t.leitura.indice}</p>
                  <ol className="p4c-indice">
                    {capitulos.map((_, i) => (
                      <li key={i}>
                        <button type="button" aria-current={i === pagina ? "page" : undefined} aria-label={`${t.leitura.irPara}: ${nomeDoCapitulo(i)}`} onClick={() => setPagina(i)}>
                          {nomeDoCapitulo(i)}
                        </button>
                      </li>
                    ))}
                  </ol>
                </nav>
              )}
              <article aria-live="polite">
                {capitulos[pagina]?.titulo && <h3 className="mb-3 text-xl font-black">{capitulos[pagina].titulo}</h3>}
                <TextoFormatado texto={fonte} lang={lang} imagens={imagens} nivel={4} />
              </article>
            </>
          )}
        </div>
      </div>
      <div className="p4c-pagina">
        <button type="button" disabled={pagina === 0} onClick={() => setPagina((p) => Math.max(p - 1, 0))}>{t.leitura.anterior}</button>
        <span className="text-sm tabular-nums" aria-live="polite">{preencher(t.leitura.pagina, { n: pagina + 1, total })}</span>
        <button type="button" disabled={pagina >= total - 1} onClick={() => setPagina((p) => Math.min(p + 1, total - 1))}>{t.leitura.proxima}</button>
      </div>
    </div>
  );
}
