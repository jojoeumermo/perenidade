// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Uma leitura aberta: a redação sorteada (sem autora) ao lado da ficha das 5 competências do ENEM. Cada competência tem a nota em
// seis ladrilhos (0, 40, 80, 120, 160, 200) e o comentário; o total soma na hora. Enviar vai pelo servidor do site (o lacre).
import { useEffect, useId, useRef, useState } from "react";
import { conferirFicha, LIMITES_DA_REDACAO, NOTAS, totalDaFicha, type Leitura } from "./cliente";
import { FolhaDeLer } from "./Folha";
import { dataNoIdioma, por, type TextosDaRedacao } from "./textos";

type Rascunho = { competencias: { nota: number | null; comentario: string }[]; geral: string };
const vazio = (): Rascunho => ({ competencias: [0, 1, 2, 3, 4].map(() => ({ nota: null, comentario: "" })), geral: "" });

function Competencia({ t, i, valor, aoMudar, desligada, erro, focar }: {
  t: TextosDaRedacao; i: number; valor: Rascunho["competencias"][number]; aoMudar: (v: Rascunho["competencias"][number]) => void; desligada: boolean;
  /** A frase do que falta nesta competência (depois de um envio incompleto), dita junto dela. */
  erro: string | null;
  /** Muda a cada envio incompleto que aponta esta competência: o foco vem para ela. */
  focar: number;
}) {
  const nome = useId();
  const comentario = useId();
  const aviso = useId();
  const caixa = useRef<HTMLFieldSetElement>(null);
  const c = t.competencias[i];
  const pronta = valor.nota !== null && valor.comentario.trim().length >= LIMITES_DA_REDACAO.comentarioMin;
  // Arrumou a competência: a frase e a borda saem na hora.
  if (pronta) erro = null;
  const faltaNota = Boolean(erro) && valor.nota === null;
  useEffect(() => {
    if (!focar || !caixa.current) return;
    caixa.current.scrollIntoView({ block: "center", behavior: "smooth" });
    const alvo = caixa.current.querySelector<HTMLElement>(valor.nota === null ? "input[type=radio]" : "textarea");
    alvo?.focus({ preventScroll: true });
    // Só quando um envio novo aponta esta competência.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focar]);
  return (
    <fieldset ref={caixa} className="rd-competencia" disabled={desligada} data-erro={erro ? "" : undefined} aria-describedby={erro ? aviso : undefined} data-pronta={pronta ? "sim" : undefined}>
      <legend>
        <span className="rd-competencia-numero al-cond" aria-hidden>{i + 1}</span>
        <span className="rd-competencia-nome al-cond">{c.nome}</span>
        <span className="rd-competencia-resumo">{c.resumo}</span>
      </legend>
      <div className="rd-notas" role="radiogroup" aria-label={`${t.corrigir.nota} · ${c.nome}`} aria-invalid={faltaNota || undefined}>
        {NOTAS.map((n) => (
          <label key={n} className="rd-nota">
            <input type="radio" name={nome} value={n} checked={valor.nota === n} onChange={() => aoMudar({ ...valor, nota: n })} />
            <span>{n}</span>
          </label>
        ))}
      </div>
      <label htmlFor={comentario} className="rd-rotulo">{t.corrigir.comentario}</label>
      <textarea id={comentario} className="rd-campo" rows={3} maxLength={LIMITES_DA_REDACAO.comentarioMax} value={valor.comentario}
        placeholder={t.corrigir.comentarioDica} onChange={(e) => aoMudar({ ...valor, comentario: e.target.value })}
        aria-invalid={(Boolean(erro) && valor.comentario.trim().length < LIMITES_DA_REDACAO.comentarioMin) || undefined} />
      {erro && <p id={aviso} className="rd-erro rd-erro-competencia">{erro}</p>}
    </fieldset>
  );
}

export function FichaDeCorrecao({ lang, t, l, aoEnviar, aoLargar }: {
  lang: string;
  t: TextosDaRedacao;
  l: Leitura;
  aoEnviar: (ficha: { competencias: { nota: number; comentario: string }[]; geral: string }) => Promise<string | null>;
  aoLargar: () => Promise<void>;
}) {
  const [f, setF] = useState<Rascunho>(vazio);
  const [erro, setErro] = useState<string | null>(null);
  // A competência que faltou no último envio (e um número que muda a cada envio, para o foco ir até ela de novo).
  const [falta, setFalta] = useState<{ i: number; vez: number } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const geral = useId();
  const tc = t.corrigir;
  const total = totalDaFicha(f.competencias);
  const enviar = async () => {
    const qual = conferirFicha(f);
    if (qual !== null) {
      setErro(qual === "geral" ? t.erros["invalido:geral"] : por(tc.falta, { n: qual + 1 }));
      setFalta(qual === "geral" ? null : { i: qual, vez: (falta?.vez ?? 0) + 1 });
      return;
    }
    setEnviando(true);
    setErro(null);
    setFalta(null);
    const e = await aoEnviar({ competencias: f.competencias.map((c) => ({ nota: c.nota ?? 0, comentario: c.comentario.trim() })), geral: f.geral.trim() });
    setEnviando(false);
    setErro(e);
  };
  return (
    <article className="rd-leitura">
      <header className="rd-leitura-topo">
        <p className="rd-selo al-cond">{tc.prazo.replace("{data}", dataNoIdioma(lang, l.prazo, true))}</p>
        <p className="rd-leitura-tema">{l.tema}</p>
        {l.motivadores && (
          <details className="rd-motivadores">
            <summary>{t.tema.motivadores}</summary>
            {l.motivadores.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)}
          </details>
        )}
        <p className="rd-cega">{tc.cega}</p>
      </header>
      <div className="rd-leitura-corpo">
        <section aria-label={tc.aRedacao} className="rd-leitura-texto">
          <h3 className="rd-sub al-cond">{tc.aRedacao}</h3>
          <FolhaDeLer titulo={l.titulo} texto={l.texto} semTitulo={tc.semTitulo} />
        </section>
        <section aria-label={tc.aFicha} className="rd-leitura-ficha">
          <h3 className="rd-sub al-cond">{tc.aFicha}</h3>
          {f.competencias.map((c, i) => (
            <Competencia key={i} t={t} i={i} valor={c} desligada={enviando}
              erro={falta?.i === i ? erro : null} focar={falta?.i === i ? falta.vez : 0}
              aoMudar={(v) => setF((x) => ({ ...x, competencias: x.competencias.map((y, j) => (j === i ? v : y)) }))} />
          ))}
          <label htmlFor={geral} className="rd-rotulo">{tc.geral}</label>
          <textarea id={geral} className="rd-campo" rows={3} maxLength={LIMITES_DA_REDACAO.geralMax} value={f.geral} disabled={enviando}
            onChange={(e) => setF((x) => ({ ...x, geral: e.target.value }))} />
          <div className="rd-total" aria-live="polite">
            <span className="al-cond">{tc.total}</span>
            <strong className="al-cond">{total}</strong>
            <span>{t.devolutivas.deMil}</span>
          </div>
          {erro && <p className="rd-erro" role="alert">{erro}</p>}
          <div className="rd-acoes">
            <button type="button" className="al-botao al-botao-primario al-botao-m" disabled={enviando} onClick={enviar}>{enviando ? tc.enviando : tc.enviar}</button>
            <button type="button" className="al-botao al-botao-contorno al-botao-m" disabled={enviando} onClick={aoLargar}>{tc.largar}</button>
          </div>
        </section>
      </div>
    </article>
  );
}
