// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 78. Mediações: as conversas mediadas em que a pessoa está (como mediadora ou parte). Só as três leem; as partes pelo codinome.
// Não é cifrada (a tela diz). No fim, as falas somem e fica só o acordo, por 30 dias.
import { useId, useState, type FormEvent } from "react";
import { conta, type Mediacao } from "@/lib/rede/conta/cliente";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import { fraseDoErro, useCarga, type TextosDaConta } from "./textos";

function UmaMediacao({ t, lang, m, aoMudar }: { t: TextosDaConta; lang: string; m: Mediacao; aoMudar: (m: Mediacao) => void }) {
  const id = useId();
  const [erro, setErro] = useState<string | null>(null);
  const [fala, setFala] = useState("");
  const [acordo, setAcordo] = useState(m.acordo);
  const fazer = async (f: () => Promise<Mediacao>) => {
    try {
      aoMudar(await f());
      setErro(null);
    } catch (x) {
      setErro(fraseDoErro(t, x));
    }
  };
  const eu = m.partes.find((p) => p.eu);
  const outras = m.partes.filter((p) => !p.eu).map((p) => p.codinome);
  return (
    <li className="ct-cartao" data-situacao={m.situacao}>
      <p className="ct-etiqueta">{(t.mediacao.situacoes as Record<string, string>)[m.situacao]}</p>
      <p>{preencher(t.mediacao.comunidade, { nome: m.comunidade?.nome ?? "" })} · {preencher(t.mediacao.mediadora, { nome: m.mediadora })}</p>
      <p>{preencher(t.mediacao.partes, { nomes: outras.join(", ") })}</p>
      {m.situacao === "convite" && m.sou === "parte" && eu?.aceite === "pendente" && (
        <div className="ct-acoes">
          <Botao onClick={() => void fazer(() => conta.responderMediacao(m.id, true))}>{t.mediacao.aceitar}</Botao>
          <Botao variante="contorno" onClick={() => void fazer(() => conta.responderMediacao(m.id, false))}>{t.mediacao.recusar}</Botao>
        </div>
      )}
      {m.situacao === "aberta" && (
        <>
          <p className="ct-miudo">{t.mediacao.naoCifrada}</p>
          <ol className="ct-lista" aria-live="polite">
            {m.falas.map((f) => (
              <li key={f.id}>
                <p className="ct-etiqueta">{f.codinome} · {new Intl.DateTimeFormat(lang, { timeStyle: "short" }).format(new Date(f.quando))}</p>
                <p>{f.texto}</p>
              </li>
            ))}
          </ol>
          <form className="ct-form" onSubmit={(e: FormEvent) => { e.preventDefault(); void fazer(() => conta.falar(m.id, fala)).then(() => setFala("")); }}>
            <label htmlFor={`${id}-f`}>{t.mediacao.fala}<textarea id={`${id}-f`} maxLength={1000} value={fala} onChange={(e) => setFala(e.target.value)} /></label>
            <div className="ct-acoes"><Botao type="submit" disabled={!fala.trim()}>{t.mediacao.falar}</Botao></div>
          </form>
          {m.sou === "mediadora" ? (
            <form className="ct-form" onSubmit={(e: FormEvent) => { e.preventDefault(); void fazer(() => conta.proporAcordo(m.id, acordo)); }}>
              <label htmlFor={`${id}-a`}>{t.mediacao.textoDoAcordo}<textarea id={`${id}-a`} maxLength={1500} value={acordo} onChange={(e) => setAcordo(e.target.value)} /></label>
              <div className="ct-acoes"><Botao type="submit">{t.mediacao.propor}</Botao></div>
            </form>
          ) : (
            m.acordo && (
              <div className="ct-cartao">
                <p className="ct-etiqueta">{t.mediacao.acordo}</p>
                <p>{m.acordo}</p>
                <div className="ct-acoes">
                  <Botao onClick={() => void fazer(() => conta.aceitarAcordo(m.id, !eu?.acordo_ok))}>{eu?.acordo_ok ? t.mediacao.retirarAceite : t.mediacao.aceitarAcordo}</Botao>
                </div>
              </div>
            )
          )}
          {m.partes.filter((p) => p.acordo_ok).map((p) => <p key={p.codinome} className="ct-miudo">{p.codinome} {t.mediacao.aceitouAcordo}</p>)}
          <div className="ct-acoes"><Botao variante="fantasma" onClick={() => void fazer(() => conta.encerrarMediacao(m.id))}>{t.mediacao.encerrar}</Botao></div>
        </>
      )}
      {m.situacao === "acordo" && <div className="ct-cartao"><p className="ct-etiqueta">{t.mediacao.acordo}</p><p>{m.acordo}</p></div>}
      {erro && <p className="ct-erro" role="alert">{erro}</p>}
    </li>
  );
}

export function AbaMediacoes({ t, lang }: { t: TextosDaConta; lang: string }) {
  const { dado, erro, trocar } = useCarga<{ itens: Mediacao[] }>("mediacoes", () => conta.mediacoes());
  return (
    <div className="ct-bloco">
      <h2 className="ct-subtitulo al-cond">{t.mediacao.titulo}</h2>
      <p className="ct-miudo">{t.mediacao.sobre}</p>
      {erro ? <p className="ct-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {dado && dado.itens.length === 0 && <p className="ct-miudo">{t.mediacao.nenhuma}</p>}
      <ul className="ct-lista">
        {dado?.itens.map((m) => <UmaMediacao key={m.id} t={t} lang={lang} m={m} aoMudar={(n) => trocar({ itens: dado.itens.map((x) => (x.id === n.id ? n : x)) })} />)}
      </ul>
    </div>
  );
}
