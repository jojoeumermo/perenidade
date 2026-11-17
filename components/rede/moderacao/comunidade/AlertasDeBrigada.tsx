// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "@/components/Link";
import { LIMITES, moderacaoDaComunidade, tempoEscrito, type AlertaDeBrigada, type AutomodDaComunidade } from "@/lib/rede/comunidade-moderacao";
import { redeMod } from "@/lib/rede/cliente-moderacao";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaModeracao } from "@/lib/rede/textos-moderacao";
import { enderecos } from "@/lib/rede/tipos";
import { dataCurta, mensagemDeErro } from "../base";

const LENTO_DA_BRIGADA = 600;

/** Um alerta: QUANTAS contas de fora (nunca quais), o post e as três saídas (modo lento na conversa, travar, encerrar). */
function UmAlerta({ a, lang, s, sm, aoMudar }: { a: AlertaDeBrigada; lang: string; s: Pick<TextosDaRede, "erros">; sm: TextosDaModeracao; aoMudar: () => void }) {
  const t = sm.o9.brigada;
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function fazer(tarefa: () => Promise<unknown>, feito: string) {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      await tarefa();
      setAviso(feito);
      aoMudar();
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <li className="m9-alerta">
      <div className="m9-alerta-topo">
        <strong className="m9-alerta-n m9-cond">{a.contas}</strong>
        <span className="m9-alerta-texto">{preencher(t.contasTexto, { n: a.contas, min: a.minutos })}</span>
        <span className="m9-carimbo">{a.comunidade}</span>
        {a.travado && <span className="m9-carimbo" data-tom="alerta">{t.travada}</span>}
        {a.lento > 0 && <span className="m9-carimbo" data-tom="ouro">{preencher(t.lentoLigado, { tempo: tempoEscrito(sm.o9.tempo, a.lento) })}</span>}
      </div>
      {a.trecho && <blockquote>{a.titulo ? `${a.titulo}: ` : ""}{a.trecho}</blockquote>}
      <p className="m9-alerta-meta">{preencher(t.atualizado, { quando: dataCurta(a.atualizado_em, lang) })}</p>
      <div className="m9-acoes">
        {a.lento === 0 && (
          <button type="button" className="al-botao al-botao-dourado al-botao-p" disabled={ocupado} onClick={() => void fazer(() => redeMod.modoLento("conversa", a.post, LENTO_DA_BRIGADA, t.motivoTravar), t.feito)}>
            {t.lentoConversa}
          </button>
        )}
        {!a.travado && (
          <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled={ocupado} onClick={() => void fazer(() => redeMod.agir(null, "post", a.post, "travar", t.regraTravar, t.motivoTravar), t.feito)}>
            {t.travar}
          </button>
        )}
        <button type="button" className="al-botao al-botao-fantasma al-botao-p" disabled={ocupado} onClick={() => void fazer(() => moderacaoDaComunidade.encerrarBrigada(a.id), t.encerrado)}>
          {t.encerrar}
        </button>
        <Link href={enderecos.post(lang, a.post)} className="al-botao al-botao-fantasma al-botao-p">{t.verPost}</Link>
      </div>
      {aviso && <p className="m9-status" role="status">{aviso}</p>}
      {erro && <p className="m9-erro" role="alert">{erro}</p>}
    </li>
  );
}

/**
 * Os alertas de brigada abertos (de uma comunidade, ou de todas as que a pessoa modera) e, quando vem a comunidade, os números
 * que acendem o alerta. A Alumia não diz quem respondeu: só quantas contas de fora, a partir de 3.
 */
export function AlertasDeBrigada({ lang, s, sm, comunidade, regras, aoSalvar }: {
  lang: string;
  s: Pick<TextosDaRede, "erros">;
  sm: TextosDaModeracao;
  comunidade?: string;
  regras?: AutomodDaComunidade;
  aoSalvar?: (r: AutomodDaComunidade) => void;
}) {
  const t = sm.o9.brigada;
  const [lista, setLista] = useState<AlertaDeBrigada[] | null>(null);
  const [erro, setErro] = useState("");
  const [rodada, setRodada] = useState(0);
  const [contas, setContas] = useState(regras?.brigada?.contas ?? 10);
  const [minutos, setMinutos] = useState(regras?.brigada?.minutos ?? 30);
  const [aviso, setAviso] = useState("");
  const recarregar = useCallback(() => setRodada((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    moderacaoDaComunidade.brigadas().then(
      (l) => vivo && setLista(comunidade ? l.filter((a) => a.comunidade === comunidade) : l),
      (e) => vivo && setErro(mensagemDeErro(s, sm, e)),
    );
    return () => {
      vivo = false;
    };
  }, [comunidade, rodada, s, sm]);

  async function salvar() {
    if (!comunidade) return;
    setErro("");
    setAviso("");
    try {
      const r = await moderacaoDaComunidade.salvarAutomod(comunidade, { brigada_contas: contas, brigada_minutos: minutos });
      aoSalvar?.(r);
      setAviso(sm.o9.filtro.salvo);
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    }
  }

  const valido = contas >= LIMITES.brigadaContasMin && contas <= LIMITES.brigadaContasMax && minutos >= LIMITES.brigadaMinutosMin && minutos <= LIMITES.brigadaMinutosMax;
  return (
    <section className={`m9-secao${comunidade ? "" : " m9-largo"}`} aria-labelledby={`m9-brigada-${comunidade ?? "todas"}`}>
      <h3 id={`m9-brigada-${comunidade ?? "todas"}`} className="m9-secao-titulo m9-cond">{comunidade && <span className="m9-ladrilho" aria-hidden>3</span>}{t.titulo}</h3>
      <p className="m9-lead">{t.ajuda}</p>
      {comunidade && regras?.brigada && (
        <>
          <div className="m9-campos m9-campos-2 m9-pe">
            <label className="m9-campo">
              {t.contas}
              <input type="number" inputMode="numeric" min={LIMITES.brigadaContasMin} max={LIMITES.brigadaContasMax} value={contas} onChange={(e) => setContas(Number(e.target.value))} />
            </label>
            <label className="m9-campo">
              {t.minutos}
              <input type="number" inputMode="numeric" min={LIMITES.brigadaMinutosMin} max={LIMITES.brigadaMinutosMax} value={minutos} onChange={(e) => setMinutos(Number(e.target.value))} />
            </label>
          </div>
          <div className="m9-acoes">
            <button type="button" className="al-botao al-botao-contorno al-botao-m" disabled={!valido} onClick={() => void salvar()}>{sm.salvar}</button>
          </div>
          {aviso && <p className="m9-status" role="status">{aviso}</p>}
        </>
      )}
      <h4 className="m9-campo m9-depois">{t.alertas}</h4>
      {lista === null ? (
        erro ? null : <p className="m9-nota" role="status">{sm.carregando}</p>
      ) : lista.length === 0 ? (
        <p className="m9-vazio m9-depois-p">{t.vazio}</p>
      ) : (
        <ul className="m9-alertas m9-depois-p">
          {lista.map((a) => <UmAlerta key={a.id} a={a} lang={lang} s={s} sm={sm} aoMudar={recarregar} />)}
        </ul>
      )}
      {erro && <p className="m9-erro" role="alert">{erro}</p>}
    </section>
  );
}
