// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As duas partes da roda que não são de todo mundo: a fila da mediação (denúncias de correção, julgadas sem saber de quem é a
// redação nem quem corrigiu) e a agenda dos temas, para a coordenação.
import { useCallback, useEffect, useId, useState } from "react";
import { LIMITES_DA_REDACAO, redacao, type DenunciaNaFila, type SemanaDaAgenda } from "./cliente";
import { LeituraRecebida } from "./Devolutiva";
import { FolhaDeLer } from "./Folha";
import { dataNoIdioma, por, textoDoErro, type TextosDaRedacao } from "./textos";

function Denuncia({ lang, t, d, aoMudar }: { lang: string; t: TextosDaRedacao; d: DenunciaNaFila; aoMudar: () => void }) {
  const tm = t.mediacao;
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const idNota = useId();
  const afastar = async () => {
    try {
      const r = await redacao.afastar(d.id);
      setAviso(r === "feito" ? tm.feito : r === "sem_lacre" ? tm.semLacre : tm.decidida);
      return true;
    } catch (e) {
      setErro(textoDoErro(t.erros, e));
      return false;
    }
  };
  const decidir = async (abusiva: boolean) => {
    setEnviando(true);
    setErro(null);
    try {
      const r = await redacao.mediar(d.id, abusiva, nota);
      if (r.afastamento === "pendente") await afastar();
      else setAviso(r.afastamento === "sem_lacre" ? tm.semLacre : tm.decidida);
      setTimeout(aoMudar, 1600);
    } catch (e) {
      setErro(textoDoErro(t.erros, e));
    }
    setEnviando(false);
  };
  return (
    <li className="rd-denuncia-fila">
      <p className="rd-selo al-cond">{dataNoIdioma(lang, d.criada_em, true)}</p>
      <p className="rd-leitura-tema">{d.tema}</p>
      <div className="rd-motivo">
        <h4 className="al-cond">{tm.motivo}</h4>
        <p>{d.motivo}</p>
      </div>
      <h4 className="rd-sub al-cond">{tm.aCorrecao}</h4>
      <ul className="rd-recebidas"><LeituraRecebida t={t} n={1} c={{ ...d.correcao, denuncia: null }} /></ul>
      <details className="rd-meu-texto">
        <summary>{tm.verRedacao}</summary>
        <FolhaDeLer titulo={d.titulo} texto={d.texto} />
      </details>
      {aviso ? <p className="rd-ok" role="status">{aviso}</p> : d.afastamento === "pendente" ? (
        <div className="rd-acoes">
          <span className="rd-confirma">{tm.pendente}</span>
          <button type="button" className="al-botao al-botao-primario al-botao-p" disabled={enviando} onClick={async () => { setEnviando(true); if (await afastar()) setTimeout(aoMudar, 1600); setEnviando(false); }}>{tm.tentarDeNovo}</button>
        </div>
      ) : (
        <>
          <label htmlFor={idNota} className="rd-rotulo">{tm.nota}</label>
          <textarea id={idNota} className="rd-campo" rows={2} maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} />
          <div className="rd-acoes">
            <button type="button" className="al-botao al-botao-primario al-botao-m" disabled={enviando} onClick={() => decidir(true)}>{tm.abusiva}</button>
            <button type="button" className="al-botao al-botao-contorno al-botao-m" disabled={enviando} onClick={() => decidir(false)}>{tm.naoAbusiva}</button>
          </div>
        </>
      )}
      {erro && <p className="rd-erro" role="alert">{erro}</p>}
    </li>
  );
}

export function Mediacao({ lang, t }: { lang: string; t: TextosDaRedacao }) {
  const [fila, setFila] = useState<DenunciaNaFila[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(() => {
    redacao.mediacao().then(setFila, (e) => {
      setFila([]);
      setErro(textoDoErro(t.erros, e));
    });
  }, [t.erros]);
  useEffect(() => carregar(), [carregar]);
  const tm = t.mediacao;
  return (
    <section className="rd-bloco" aria-labelledby="rd-mediacao-t">
      <h2 id="rd-mediacao-t" className="rd-bloco-titulo al-cond">{tm.titulo}</h2>
      <p className="rd-chamada-bloco">{tm.chamada}</p>
      {erro && <p className="rd-erro" role="alert">{erro}</p>}
      {fila === null ? <p className="rd-dica">{t.carregando}</p> : fila.length === 0 ? <p className="rd-vazio">{tm.vazio}</p> : (
        <ul className="rd-fila">{fila.map((d) => <Denuncia key={d.id} lang={lang} t={t} d={d} aoMudar={carregar} />)}</ul>
      )}
    </section>
  );
}

function SemanaDosTemas({ lang, t, s, atual, aoSalvar }: { lang: string; t: TextosDaRedacao; s: SemanaDaAgenda; atual: boolean; aoSalvar: () => void }) {
  const tt = t.temas;
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(s.titulo ?? "");
  const [mot, setMot] = useState(s.motivadores ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const idT = useId();
  const idM = useId();
  const salvar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      await redacao.definirTema(s.semana, titulo, mot);
      setEditando(false);
      aoSalvar();
    } catch (e) {
      setErro(textoDoErro(t.erros, e));
    }
    setEnviando(false);
  };
  const ok = titulo.trim().length >= LIMITES_DA_REDACAO.temaMin && titulo.trim().length <= LIMITES_DA_REDACAO.temaMax && mot.trim().length <= LIMITES_DA_REDACAO.motivadoresMax;
  return (
    <li className="rd-semana" data-atual={atual ? "sim" : undefined} data-vazia={s.titulo ? undefined : "sim"}>
      <div className="rd-semana-topo">
        <p className="rd-semana-data al-cond">{atual ? tt.estaSemana : por(tt.semana, { data: dataNoIdioma(lang, s.semana) })}</p>
        <p className="rd-semana-n">{s.redacoes !== null ? por(tt.redacoes, { n: s.redacoes }) : s.titulo && !s.editavel ? tt.poucas : ""}</p>
      </div>
      {!editando ? (
        <>
          <p className="rd-semana-titulo" data-vazio={s.titulo ? undefined : "sim"}>{s.titulo ?? tt.semTema}</p>
          {s.editavel ? (
            <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => setEditando(true)}>{s.titulo ? tt.editar : tt.lancar}</button>
          ) : s.titulo ? <p className="rd-dica">{tt.fechado}</p> : null}
        </>
      ) : (
        <div className="rd-semana-form">
          <label htmlFor={idT} className="rd-rotulo">{tt.tituloCampo}</label>
          <input id={idT} className="rd-campo" maxLength={LIMITES_DA_REDACAO.temaMax} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <label htmlFor={idM} className="rd-rotulo">{tt.motivadoresCampo}</label>
          <textarea id={idM} className="rd-campo" rows={4} maxLength={LIMITES_DA_REDACAO.motivadoresMax} value={mot} onChange={(e) => setMot(e.target.value)} />
          {erro && <p className="rd-erro" role="alert">{erro}</p>}
          <div className="rd-acoes">
            <button type="button" className="al-botao al-botao-primario al-botao-p" disabled={enviando || !ok} onClick={salvar}>{tt.salvar}</button>
            <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => setEditando(false)}>{t.devolutivas.cancelar}</button>
          </div>
        </div>
      )}
    </li>
  );
}

export function Temas({ lang, t, semanaAtual, aoMudar }: { lang: string; t: TextosDaRedacao; semanaAtual: string; aoMudar: () => void }) {
  const [agenda, setAgenda] = useState<SemanaDaAgenda[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(() => {
    redacao.temas().then(setAgenda, (e) => {
      setAgenda([]);
      setErro(textoDoErro(t.erros, e));
    });
  }, [t.erros]);
  useEffect(() => carregar(), [carregar]);
  const tt = t.temas;
  return (
    <section className="rd-bloco" aria-labelledby="rd-temas-t">
      <h2 id="rd-temas-t" className="rd-bloco-titulo al-cond">{tt.titulo}</h2>
      <p className="rd-chamada-bloco">{tt.chamada}</p>
      {erro && <p className="rd-erro" role="alert">{erro}</p>}
      {agenda === null ? <p className="rd-dica">{t.carregando}</p> : (
        <ul className="rd-agenda">
          {agenda.map((s) => <SemanaDosTemas key={`${s.semana}-${s.titulo ?? ""}`} lang={lang} t={t} s={s} atual={s.semana === semanaAtual} aoSalvar={() => { carregar(); aoMudar(); }} />)}
        </ul>
      )}
    </section>
  );
}
