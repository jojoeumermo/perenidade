// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A meta da petição (onda 13, L1-20): a faixa de ladrilhos até a meta, e o que só quem organiza vê: mudar a meta e o documento de
// entrega. O total só aparece a partir de 3 (abaixo disso a faixa fica apagada para todo mundo) e NINGUÉM vê quem assinou: o
// documento traz o texto, para quem é, o número e as datas. Nenhum nome, nem para quem organiza.
import { useState } from "react";
import { Botao } from "../ui/Botao";
import { Ladrilhos } from "./Vaquinha";
import { clienteDoApoio } from "./cliente";
import { casasDaMeta, documentoDaEntrega, lerMetaDaPeticao, type PeticaoComMeta } from "./regras";
import { fraseDoApoio, preencherApoio, type TextosDoApoio } from "./textos";
import "./apoio.css";

const numero = (n: number, lang: string) => n.toLocaleString(lang === "pt" ? "pt-BR" : lang);

/** A faixa da meta: só quando há meta. Com menos de 3 assinaturas, apagada (o número não aparece). */
export function PlacarDaMeta({ p, t, lang }: { p: PeticaoComMeta; t: TextosDoApoio; lang: string }) {
  if (p.meta === null) return null;
  const tp = t.peticao;
  return (
    <div className="ap-meta ap-meta-peticao">
      <Ladrilhos
        acesas={casasDaMeta(p.total, p.meta)}
        chegou={p.chegou}
        rotulo={p.total !== null ? preencherApoio(tp.ladrilhos, { n: numero(p.total, lang), meta: numero(p.meta, lang) }) : preencherApoio(tp.meta, { meta: numero(p.meta, lang) })}
      />
      <p className="ap-meta-numero">
        {/* O total já está grande logo acima: aqui só a meta. */}
        <span className="ap-frase">{preencherApoio(tp.meta, { meta: numero(p.meta, lang) })}</span>
        {p.chegou ? <span className="ap-carimbo al-cond">{tp.chegou}</span> : null}
      </p>
    </div>
  );
}

/** Só quem organiza: mudar a meta e gerar o documento de entrega. */
export function CuidarDaPeticao({ p, t, lang, aoMudar }: { p: PeticaoComMeta; t: TextosDoApoio; lang: string; aoMudar: (p: PeticaoComMeta) => void }) {
  const tp = t.peticao;
  const cli = clienteDoApoio();
  const [meta, setMeta] = useState(p.meta === null ? "" : String(p.meta));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [doc, setDoc] = useState<string | null>(null);
  if (!p.organiza) return null;

  const salvarMeta = async (valor: number | null) => {
    setOcupado(true);
    setErro("");
    try {
      const r = await cli.peticaoMeta(p.id, valor);
      if (r) aoMudar(r);
    } catch (e) {
      setErro(fraseDoApoio(t, e));
    } finally {
      setOcupado(false);
    }
  };
  const gerar = async () => {
    setOcupado(true);
    setErro("");
    try {
      setDoc(documentoDaEntrega(await cli.peticaoEntrega(p.id), tp.documento, lang));
    } catch (e) {
      setErro(fraseDoApoio(t, e));
    } finally {
      setOcupado(false);
    }
  };
  const baixar = () => {
    if (!doc) return;
    const url = URL.createObjectURL(new Blob([doc], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tp.documento.titulo.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-")}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const imprimir = () => {
    if (!doc) return;
    // Uma moldura só para a impressão: o documento, sem a tela em volta. Nada sai do aparelho.
    const f = document.createElement("iframe");
    f.className = "ap-impressao";
    f.setAttribute("aria-hidden", "true");
    document.body.appendChild(f);
    const d = f.contentDocument;
    if (!d) return f.remove();
    const pre = d.createElement("pre");
    pre.style.cssText = "white-space:pre-wrap;font:14px/1.6 Georgia,serif;margin:2cm";
    pre.textContent = doc;
    d.body.appendChild(pre);
    f.contentWindow?.print();
    setTimeout(() => f.remove(), 1000);
  };
  const lida = lerMetaDaPeticao(meta);

  return (
    <div className="ap-cuidar">
      {p.aberta ? (
        <details className="ap-detalhe">
          <summary>{tp.mudarMeta}</summary>
          <form className="ap-linha" onSubmit={(e) => { e.preventDefault(); if (lida !== "numero") void salvarMeta(lida); }}>
            <label className="ap-campo">
              <span>{tp.metaCampo}</span>
              <input className="al-ato-form-campo" inputMode="numeric" value={meta} aria-invalid={lida === "numero" || undefined} onChange={(e) => setMeta(e.target.value)} />
              <small className="al-q-ajuda">{lida === "numero" ? tp.metaInvalida : tp.metaAjuda}</small>
            </label>
            <div className="ap-botoes">
              <Botao type="submit" variante="contorno" tamanho="p" disabled={ocupado || lida === "numero"}>{tp.salvarMeta}</Botao>
              {p.meta !== null ? <Botao variante="fantasma" tamanho="p" disabled={ocupado} onClick={() => { setMeta(""); void salvarMeta(null); }}>{tp.tirarMeta}</Botao> : null}
            </div>
          </form>
        </details>
      ) : null}
      <details className="ap-detalhe" onToggle={(e) => { if (!(e.currentTarget as HTMLDetailsElement).open) setDoc(null); }}>
        <summary>{tp.entregar}</summary>
        <p className="al-q-ajuda">{tp.entregarAjuda}</p>
        {p.total === null ? <p className="al-q-ajuda">{tp.poucas}</p> : doc === null ? (
          <Botao variante="contorno" tamanho="p" disabled={ocupado} aria-busy={ocupado || undefined} onClick={() => void gerar()}>{tp.gerar}</Botao>
        ) : (
          <>
            <pre className="ap-documento" tabIndex={0}>{doc}</pre>
            <div className="ap-botoes">
              <Botao variante="primario" tamanho="p" onClick={baixar}>{tp.baixar}</Botao>
              <Botao variante="contorno" tamanho="p" onClick={imprimir}>{tp.imprimir}</Botao>
              <Botao variante="fantasma" tamanho="p" onClick={() => setDoc(null)}>{tp.fechar}</Botao>
            </div>
          </>
        )}
      </details>
      {erro ? <p role="alert" className="al-ato-erro">{erro}</p> : null}
    </div>
  );
}
