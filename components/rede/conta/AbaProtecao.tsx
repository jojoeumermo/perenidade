// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Proteção: 107 níveis prontos (com o tour por tipo de risco), 76 revisão das menções antes de aparecer e 108 checkup de
// privacidade. O nível e as menções vão ao banco (as escolhas de sempre do o9 e as do Prompt 4); o tour e a data do checkup ficam
// só nesta tela e neste aparelho.
import Link from "next/link";
import { useId, useState } from "react";
import { conta, type Prefs, type PrefsDoNivel, type MencaoNaFila } from "@/lib/rede/conta/cliente";
import { NIVEIS, RISCOS, PASSOS_DO_CHECKUP, DIAS_DO_CHECKUP, hojeTemCheckup, nivelDoRisco, type Nivel, type Risco } from "@/lib/rede/conta/regras";
import { enderecos } from "@/lib/rede/tipos";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import { fraseDoErro, guarda, useCarga, type TextosDaConta } from "./textos";

const CHAVE_DO_CHECKUP = "lucia:rede:conta:checkup";

function Niveis({ t, prefs, aoMudar }: { t: TextosDaConta; prefs: Prefs; aoMudar: (p: PrefsDoNivel) => void }) {
  const id = useId();
  const [risco, setRisco] = useState<Risco | null>(null);
  const [msg, setMsg] = useState<{ texto: string; erro: boolean } | null>(null);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const nomes = t.nivel.nomes as Record<Nivel, string>;
  async function escolher(n: Nivel) {
    setOcupado(true);
    try {
      const r = await conta.nivel(n);
      aoMudar(r);
      setSugestoes(r.sugestoes ?? []);
      setMsg({ texto: preencher(t.nivel.pronto, { nivel: nomes[n] }), erro: false });
    } catch (e) {
      setMsg({ texto: fraseDoErro(t, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }
  const sugerido = risco ? nivelDoRisco(risco) : null;
  return (
    <section className="ct-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="ct-subtitulo al-cond">{t.nivel.titulo}</h2>
      <p className="ct-miudo">{t.nivel.sobre}</p>
      <p className="ct-ok" role="status">{prefs.nivel ? preencher(t.nivel.atual, { nivel: nomes[prefs.nivel] }) : t.nivel.nenhum}</p>
      <fieldset className="ct-form">
        <legend>{t.nivel.tourTitulo}</legend>
        <p className="ct-miudo">{t.nivel.tourSobre}</p>
        {RISCOS.map((r) => (
          <label key={r} className="ct-opcao">
            <input type="radio" name={`${id}-risco`} checked={risco === r} onChange={() => setRisco(r)} />
            {(t.nivel.riscos as Record<Risco, string>)[r]}
          </label>
        ))}
        {sugerido && <p className="ct-ok" role="status">{preencher(t.nivel.sugerido, { nivel: nomes[sugerido] })}</p>}
      </fieldset>
      <ul className="ct-lista">
        {NIVEIS.map((n) => (
          <li key={n} className="ct-cartao" data-nivel={n} data-sugerido={sugerido === n || undefined}>
            <h3 className="ct-cartao-titulo">{nomes[n]}</h3>
            <p>{(t.nivel.descricoes as Record<Nivel, string>)[n]}</p>
            <div className="ct-acoes">
              <Botao variante={sugerido === n ? "primario" : "contorno"} disabled={ocupado} pressionado={prefs.nivel === n} onClick={() => void escolher(n)}>
                {preencher(t.nivel.escolher, { nivel: nomes[n] })}
              </Botao>
            </div>
          </li>
        ))}
      </ul>
      {msg && <p className={msg.erro ? "ct-erro" : "ct-ok"} role={msg.erro ? "alert" : "status"}>{msg.texto}</p>}
      {sugestoes.length > 0 && (
        <div className="ct-cartao">
          <p className="ct-etiqueta">{t.nivel.sugestoesTitulo}</p>
          <ul>
            {sugestoes.map((s) => <li key={s}>{(t.nivel.sugestoes as Record<string, string>)[s] ?? s}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

function Mencoes({ t, lang, prefs, aoMudar }: { t: TextosDaConta; lang: string; prefs: Prefs; aoMudar: (p: Prefs) => void }) {
  const id = useId();
  const { dado, erro, recarregar } = useCarga<{ itens: MencaoNaFila[] }>(`mencoes-${prefs.pendentes}`, () => conta.mencoes());
  const [msg, setMsg] = useState<string | null>(null);
  async function revisar(sim: boolean) {
    try {
      aoMudar(await conta.revisarMencoes(sim));
    } catch (e) {
      setMsg(fraseDoErro(t, e));
    }
  }
  async function decidir(post: string, aprovar: boolean) {
    try {
      await conta.decidirMencao(post, aprovar);
      aoMudar({ ...prefs, pendentes: Math.max(0, prefs.pendentes - 1) });
      recarregar();
    } catch (e) {
      setMsg(fraseDoErro(t, e));
    }
  }
  const quem = (t.mencoes.quemNomes as Record<string, string>)[prefs.mencao_quem] ?? prefs.mencao_quem;
  return (
    <section className="ct-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="ct-subtitulo al-cond">{t.mencoes.titulo}</h2>
      <p className="ct-miudo">{preencher(t.mencoes.quem, { quem })}</p>
      <label className="ct-opcao">
        <input type="checkbox" checked={prefs.mencao_revisar} onChange={(e) => void revisar(e.target.checked)} />
        {t.mencoes.revisar}
      </label>
      <p className="ct-miudo">{t.mencoes.revisarSobre}</p>
      <h3 className="ct-cartao-titulo">{t.mencoes.fila}</h3>
      {(erro || msg) && <p className="ct-erro" role="alert">{msg ?? fraseDoErro(t, erro)}</p>}
      {dado && dado.itens.length === 0 && <p className="ct-miudo">{t.mencoes.vazia}</p>}
      <ul className="ct-lista">
        {dado?.itens.map((m) => (
          <li key={m.post} className="ct-cartao">
            <p className="ct-etiqueta">{preencher(t.mencoes.de, { codinome: m.codinome, handle: m.handle ?? "" })}</p>
            <p>{m.trecho}</p>
            <div className="ct-acoes">
              <Botao variante="primario" onClick={() => void decidir(m.post, true)}>{t.mencoes.aprovar}</Botao>
              <Botao variante="contorno" onClick={() => void decidir(m.post, false)}>{t.mencoes.recusar}</Botao>
              <Link className="ct-link" href={enderecos.post(lang, m.post)}>{t.mencoes.abrir}</Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Checkup({ t, lang }: { t: TextosDaConta; lang: string }) {
  const id = useId();
  const [ultimo, setUltimo] = useState<string | null>(() => (typeof window === "undefined" ? null : guarda.getItem(CHAVE_DO_CHECKUP)));
  const [passo, setPasso] = useState<number | null>(null);
  const [fim, setFim] = useState(false);
  const total = PASSOS_DO_CHECKUP.length;
  const p = passo !== null ? (t.checkup.passos as Record<string, { titulo: string; texto: string; link: string }>)[PASSOS_DO_CHECKUP[passo]] : null;
  function terminar() {
    const agora = new Date().toISOString();
    guarda.setItem(CHAVE_DO_CHECKUP, agora);
    setUltimo(agora);
    setPasso(null);
    setFim(true);
  }
  return (
    <section className="ct-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="ct-subtitulo al-cond">{t.checkup.titulo}</h2>
      <p className="ct-miudo">{preencher(t.checkup.sobre, { dias: DIAS_DO_CHECKUP })}</p>
      <p className="ct-ok" role="status">
        {!ultimo || hojeTemCheckup(ultimo) ? t.checkup.hora : preencher(t.checkup.feito, { quando: new Intl.DateTimeFormat(lang, { dateStyle: "medium" }).format(new Date(ultimo)) })}
      </p>
      {fim && <p className="ct-ok" role="status">{t.checkup.terminado}</p>}
      {passo === null ? (
        <div className="ct-acoes">
          <Botao variante="primario" onClick={() => { setFim(false); setPasso(0); }}>{t.checkup.comecar}</Botao>
        </div>
      ) : (
        p && (
          <div className="ct-cartao" aria-live="polite">
            <p className="ct-etiqueta">{preencher(t.checkup.passo, { n: passo + 1, total })}</p>
            <h3 className="ct-cartao-titulo">{p.titulo}</h3>
            <p>{p.texto}</p>
            <div className="ct-acoes">
              {p.link && <Link className="ct-link" href={`/${lang}${p.link}`}>{t.checkup.ir}</Link>}
              {passo > 0 && <Botao variante="contorno" onClick={() => setPasso(passo - 1)}>{t.checkup.anterior}</Botao>}
              {passo < total - 1 ? <Botao variante="primario" onClick={() => setPasso(passo + 1)}>{t.checkup.proximo}</Botao> : <Botao variante="primario" onClick={terminar}>{t.checkup.terminar}</Botao>}
            </div>
          </div>
        )
      )}
    </section>
  );
}

export function AbaProtecao({ t, lang }: { t: TextosDaConta; lang: string }) {
  const { dado: prefs, erro, trocar } = useCarga<Prefs>("prefs", () => conta.prefs());
  if (erro && !prefs) return <p className="ct-erro" role="alert">{fraseDoErro(t, erro)}</p>;
  if (!prefs) return <p className="ct-miudo" role="status">{t.comum.carregando}</p>;
  return (
    <div className="ct-bloco">
      <Niveis t={t} prefs={prefs} aoMudar={trocar} />
      <Mencoes t={t} lang={lang} prefs={prefs} aoMudar={trocar} />
      <Checkup t={t} lang={lang} />
    </div>
  );
}
