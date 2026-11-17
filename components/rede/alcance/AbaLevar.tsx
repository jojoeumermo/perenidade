// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A aba "Levar" da comunidade (encaixe abasDaComunidade, frente 13C): o QR da página da comunidade, feito no aparelho, e o RSS dos
// posts abertos à internet, quando a rota dele responde (só comunidade aberta, e nunca com a trava da entrada ligada).
import { useEffect, useId, useState } from "react";
import { rotaResponde } from "@/lib/rede/alcance/cliente";
import { rotasDoAlcance } from "@/lib/rede/alcance/regras";
import { preencher } from "@/lib/rede/preencher";
import type { ContextoDoEncaixe } from "../encaixes";
import { baixarArquivo, copiarTexto, enderecoDaTela, origemAqui, useQr, useTextosDoAlcance } from "./usar";
import "./alcance.css";

export default function AbaLevar({ lang, slug }: ContextoDoEncaixe & { slug: string }) {
  const id = useId();
  const t = useTextosDoAlcance(lang);
  const endereco = enderecoDaTela(lang, `/c/${slug}`);
  const qr = useQr(endereco);
  const rss = rotasDoAlcance.rss(origemAqui(), "comunidade", slug, lang);
  const [temRss, setTemRss] = useState<boolean | null>(null);
  const [copiado, setCopiado] = useState("");
  useEffect(() => {
    let vivo = true;
    rotaResponde(rss, true).then((ok) => vivo && setTemRss(ok));
    return () => {
      vivo = false;
    };
  }, [rss]);
  if (!t) return null;
  async function copiar(texto: string) {
    setCopiado((await copiarTexto(texto)) ? texto : "");
  }
  return (
    <section className="alc alc-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="alc-cond alc-bloco-titulo">
        <i aria-hidden className="alc-ladrilho" />
        {t.comunidade.titulo}
      </h2>
      <div className="alc-perfil">
        <span className="alc-qr">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- QR feito no aparelho, em data URL.
            <img src={qr} alt={preencher(t.qr.alt, { nome: slug })} width={168} height={168} />
          ) : (
            <span className="alc-nota" role="status">{qr === "" ? t.qr.falhou : t.qr.fazendo}</span>
          )}
        </span>
        <div className="alc-qr-lado">
          <p className="alc-sub">{t.qr.tituloComunidade}</p>
          <p className="alc-nota">{t.qr.ajuda}</p>
          <code className="alc-endereco">{endereco}</code>
          <div className="alc-acoes">
            <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => void copiar(endereco)}>
              {copiado === endereco ? t.folha.copiado : t.folha.copiar}
            </button>
            {qr ? (
              <button type="button" className="al-botao al-botao-fantasma al-botao-p" onClick={() => baixarArquivo(qr, `alumia-qr-${slug}.png`)}>
                {t.qr.baixar}
              </button>
            ) : null}
          </div>
          <p className="alc-sub">{t.comunidade.rss}</p>
          {temRss === null ? (
            <p className="alc-nota" role="status">{t.comunidade.conferindo}</p>
          ) : temRss ? (
            <>
              <p className="alc-nota">{t.comunidade.rssAjuda}</p>
              <code className="alc-endereco">{rss}</code>
              <div className="alc-acoes">
                <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => void copiar(rss)}>
                  {copiado === rss ? t.folha.copiado : t.folha.copiar}
                </button>
                <a className="al-botao al-botao-fantasma al-botao-p" href={rss} target="_blank" rel="noopener noreferrer">
                  {t.comunidade.rssAbrir}
                </a>
              </div>
            </>
          ) : (
            <p className="alc-vazio">{t.comunidade.rssIndisponivel}</p>
          )}
        </div>
      </div>
    </section>
  );
}
