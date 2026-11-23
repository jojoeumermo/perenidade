// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useRef, useState } from "react";
import { aplicarMarca, type Marca } from "@/lib/rede/texto/inserir";
import { preencher } from "@/lib/rede/preencher";
import { TextoFormatado, type ImagemDoTexto } from "./TextoFormatado";
import { useTextosDoTexto, type TextosDoTexto } from "./textos";
import "./texto.css";

const BOTOES: { marca: Marca; rotulo: keyof TextosDoTexto["barra"]; exemplo: keyof TextosDoTexto["exemplo"]; sinal: string }[] = [
  { marca: "negrito", rotulo: "negrito", exemplo: "negrito", sinal: "B" },
  { marca: "italico", rotulo: "italico", exemplo: "italico", sinal: "I" },
  { marca: "titulo", rotulo: "titulo", exemplo: "titulo", sinal: "H" },
  { marca: "lista", rotulo: "lista", exemplo: "item", sinal: "•" },
  { marca: "citacao", rotulo: "citacao", exemplo: "citacao", sinal: "❝" },
  { marca: "link", rotulo: "link", exemplo: "link", sinal: "↗" },
  { marca: "codigo", rotulo: "codigo", exemplo: "codigo", sinal: "`c`" },
  { marca: "blocoDeCodigo", rotulo: "blocoDeCodigo", exemplo: "blocoDeCodigo", sinal: "{ }" },
  { marca: "formula", rotulo: "formula", exemplo: "formula", sinal: "∑" },
];

/**
 * O campo de texto formatado: a barra de sinais, a área de escrever e "Ver como fica" (a mesma tela que quem lê vai ver, com a
 * limpeza do aparelho; o banco limpa de novo ao guardar). Serve ao texto longo do compositor (quem junta pendura no lugar do
 * textarea do "Texto longo") e à questão. `imagens` são as anexadas: cada uma ganha o botão "Pôr a imagem N aqui".
 */
export function EditorDeTexto({
  lang,
  valor,
  aoMudar,
  rotulo,
  max,
  linhas = 8,
  imagens = [],
  obrigatorio = false,
  id: idDado,
}: {
  lang: string;
  valor: string;
  aoMudar: (novo: string) => void;
  rotulo: string;
  max: number;
  linhas?: number;
  imagens?: readonly ImagemDoTexto[];
  obrigatorio?: boolean;
  id?: string;
}) {
  const t = useTextosDoTexto(lang);
  const idProprio = useId();
  const id = idDado ?? `txf-${idProprio}`;
  const campo = useRef<HTMLTextAreaElement>(null);
  const [vendo, setVendo] = useState(false);
  const [ajuda, setAjuda] = useState(false);

  function marcar(marca: Marca, exemplo: string) {
    const el = campo.current;
    const r = aplicarMarca(valor, el?.selectionStart ?? valor.length, el?.selectionEnd ?? valor.length, marca, exemplo);
    if (r.valor.length > max) return;
    aoMudar(r.valor);
    requestAnimationFrame(() => {
      const x = campo.current;
      if (!x) return;
      x.focus();
      x.setSelectionRange(r.inicio, r.fim);
    });
  }

  if (!t) return <p role="status" className="txf-carregando">…</p>;
  return (
    <div className="txf-editor">
      <div className="txf-editor-cabeca">
        <label htmlFor={id} className="txf-editor-rotulo">
          {rotulo}
        </label>
        <div className="txf-abas" role="group" aria-label={t.barra.rotulo}>
          <button type="button" className="txf-aba" aria-pressed={!vendo} onClick={() => setVendo(false)}>
            {t.barra.escrever}
          </button>
          <button type="button" className="txf-aba" aria-pressed={vendo} onClick={() => setVendo(true)}>
            {t.barra.verComoFica}
          </button>
        </div>
      </div>
      {!vendo && (
        <div className="txf-barra" role="toolbar" aria-label={t.barra.rotulo} aria-controls={id}>
          {BOTOES.map((b) => (
            <button key={b.marca} type="button" className="txf-botao" title={t.barra[b.rotulo]} aria-label={t.barra[b.rotulo]} onClick={() => marcar(b.marca, t.exemplo[b.exemplo])}>
              <span aria-hidden="true">{b.sinal}</span>
            </button>
          ))}
          {imagens.slice(0, 20).map((_, i) => (
            <button
              key={`imagem${i + 1}`}
              type="button"
              className="txf-botao txf-botao-imagem"
              onClick={() => marcar(`imagem${i + 1}`, imagens[i]?.alt || t.exemplo.imagem)}
            >
              {preencher(t.barra.imagem, { n: i + 1 })}
            </button>
          ))}
          <button type="button" className="txf-botao txf-botao-ajuda" aria-expanded={ajuda} aria-controls={`${id}-ajuda`} onClick={() => setAjuda((x) => !x)}>
            {t.barra.ajuda}
          </button>
        </div>
      )}
      <textarea
        ref={campo}
        id={id}
        className="txf-area"
        value={valor}
        maxLength={max}
        rows={linhas}
        required={obrigatorio}
        hidden={vendo}
        spellCheck
        onChange={(e) => aoMudar(e.target.value)}
      />
      {vendo && (
        <div className="txf-previa" aria-live="polite">
          <p className="txf-carimbo txf-previa-carimbo">{t.previa.titulo}</p>
          {valor.trim() ? <TextoFormatado texto={valor} lang={lang} imagens={imagens} /> : <p className="txf-vazio">{t.previa.vazia}</p>}
        </div>
      )}
      <p className="txf-contador" aria-live="polite">
        {valor.length} / {max}
      </p>
      {ajuda && !vendo && <AjudaDoTexto id={`${id}-ajuda`} t={t} />}
    </div>
  );
}

/** "Como formatar": o que escrever e no que vira. */
export function AjudaDoTexto({ id, t }: { id?: string; t: TextosDoTexto }) {
  return (
    <section id={id} className="txf-ajuda" aria-label={t.ajuda.titulo}>
      <p className="txf-carimbo">{t.ajuda.titulo}</p>
      <p>{t.ajuda.intro}</p>
      <dl>
        {t.ajuda.itens.map((x) => (
          <div key={x.escreva}>
            <dt>
              <code>{x.escreva}</code>
            </dt>
            <dd>{x.vira}</dd>
          </div>
        ))}
      </dl>
      <p>{t.ajuda.cifrao}</p>
      <p>{t.ajuda.imagens}</p>
    </section>
  );
}
