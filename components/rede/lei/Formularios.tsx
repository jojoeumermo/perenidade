// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os dois formulários da página de regras: o pedido de revisão da minha conta (para quem está suspensa ou retida, e funciona
// mesmo sem passar pela porta da Alumia) e a denúncia de conteúdo ilegal (com protocolo e prazo de resposta).
import { useEffect, useId, useState } from "react";
import Link from "@/components/Link";
import { lerAlvo } from "./alvo";
import { codigoDoErro, quando, Rico } from "./base";
import { type DecisaoDaConta, lei, type MinhaConta, PREVIA_DA_LEI } from "./cliente";
import { por, type TextosDaLei } from "./textos";
import { PRAZOS_DAS_DENUNCIAS } from "./versao";

/** Uma decisão sobre a minha conta, com o andamento do recurso e o pedido de revisão. */
function Decisao({ lang, t, d, aoPedir }: { lang: string; t: TextosDaLei; d: DecisaoDaConta; aoPedir: (id: string, texto: string) => Promise<string | null> }) {
  const r = t.regras.revisao;
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const id = useId();
  const enviar = async () => {
    setEnviando(true);
    setErro(await aoPedir(d.id, texto));
    setEnviando(false);
  };
  return (
    <li className="le-decisao">
      <h3 className="al-cond">
        {r.acoes[d.acao]}
        <small>{d.automatica ? r.automatica : r.pessoa} · {quando(lang, d.criado_em)}</small>
      </h3>
      {d.regra && <p>{por(r.regra, { regra: (r.regras as Record<string, string>)[d.regra] ?? d.regra.replace(/_/g, " ") })}</p>}
      {d.motivo && <p>{por(r.motivo, { motivo: d.motivo })}</p>}
      {d.recurso ? (
        <p>
          <span className={`le-selo al-cond${d.recurso.situacao === "revertido" ? " le-selo-ouro" : ""}`}>
            {por(r.situacoes[d.recurso.situacao], { quando: quando(lang, d.recurso.responder_ate) })}
          </span>
        </p>
      ) : d.pode_recorrer ? (
        <>
          <p>{por(r.prazo, { quando: quando(lang, d.prazo, false) })}</p>
          {!aberto ? (
            <div className="le-acoes" style={{ marginTop: "0.6rem" }}>
              <button type="button" className="al-botao al-botao-claro al-botao-m" onClick={() => setAberto(true)}>{r.pedir}</button>
            </div>
          ) : (
            <div style={{ marginTop: "0.7rem" }}>
              <div className="le-campo">
                <label htmlFor={`${id}-texto`}>{r.campo}</label>
                <textarea id={`${id}-texto`} value={texto} maxLength={2000} onChange={(e) => setTexto(e.target.value)} aria-describedby={`${id}-ajuda`} aria-invalid={erro === "invalido:texto" || undefined} />
                <p id={`${id}-ajuda`} className="le-ajuda">{r.campoAjuda}</p>
              </div>
              <div className="le-acoes">
                <button type="button" className="al-botao al-botao-primario al-botao-m" disabled={enviando || texto.trim().length < 10} onClick={enviar}>
                  {enviando ? t.comum.enviando : t.comum.enviar}
                </button>
                <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={() => setAberto(false)}>{t.comum.cancelar}</button>
              </div>
              {erro && <p className="le-erro" role="alert">{(r.erros as Record<string, string>)[erro] ?? t.comum.erro}</p>}
            </div>
          )}
        </>
      ) : (
        <p className="le-ajuda">{r.vencido}</p>
      )}
    </li>
  );
}

/** Pedir revisão da minha conta (/alumia/regras#revisao). */
export function PedirRevisao({ lang, t, logado }: { lang: string; t: TextosDaLei; logado: boolean }) {
  const r = t.regras.revisao;
  const [conta, setConta] = useState<MinhaConta | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [pronto, setPronto] = useState<string | null>(null);
  const comConta = logado || PREVIA_DA_LEI;

  useEffect(() => {
    if (!comConta) return;
    let vivo = true;
    lei.minhaConta().then(
      (c) => vivo && setConta(c),
      () => vivo && setFalhou(true),
    );
    return () => {
      vivo = false;
    };
  }, [comConta]);

  const pedir = async (acao: string, texto: string): Promise<string | null> => {
    try {
      const feito = await lei.recorrerConta(acao, texto);
      setPronto(por(r.pronto, { quando: quando(lang, feito.responder_ate) }));
      setConta(await lei.minhaConta());
      return null;
    } catch (e) {
      return codigoDoErro(e);
    }
  };

  return (
    <section className="le-form" id="revisao" aria-labelledby="le-revisao-t">
      <h2 id="le-revisao-t" className="al-cond">{r.titulo}</h2>
      <p>{r.texto}</p>
      {!comConta || conta?.logado === false ? (
        <>
          <p className="le-ajuda">{r.semConta}</p>
          <div className="le-acoes" style={{ marginTop: "0.6rem" }}>
            <Link href={`/${lang}/alumia`} className="al-botao al-botao-claro al-botao-m">{r.entrar}</Link>
          </div>
        </>
      ) : falhou ? (
        <p className="le-erro" role="alert">{t.comum.erro}</p>
      ) : !conta ? (
        <p className="le-ajuda" aria-live="polite">{t.comum.carregando}</p>
      ) : (
        <>
          {conta.retida && (
            <p className="le-faixa-conta">
              {por(r.retida, { desde: quando(lang, conta.retida.desde), ate: quando(lang, conta.retida.responder_ate) })}
            </p>
          )}
          {!conta.retida && conta.suspensa && <p className="le-faixa-conta">{r.suspensa}</p>}
          {conta.decisoes && conta.decisoes.length > 0 ? (
            <ul className="le-decisoes">
              {conta.decisoes.map((d) => <Decisao key={d.id} lang={lang} t={t} d={d} aoPedir={pedir} />)}
            </ul>
          ) : (
            <p className="le-vazio">{r.nada}</p>
          )}
          {pronto && <p className="le-ok" role="status">{pronto}</p>}
        </>
      )}
    </section>
  );
}

/** A denúncia de conteúdo ilegal (/alumia/regras#ilegal). */
export function DenunciarIlegal({ lang, t, logado }: { lang: string; t: TextosDaLei; logado: boolean }) {
  const f = t.regras.ilegal;
  const [alvo, setAlvo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState<string | null>(null);
  const id = useId();
  const comConta = logado || PREVIA_DA_LEI;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setPronto(null);
    const lido = lerAlvo(alvo);
    if (!lido) {
      setErro(f.alvoInvalido);
      return;
    }
    setEnviando(true);
    try {
      const r = await lei.denunciar(lido.tipo, lido.alvo, descricao.trim());
      setPronto(r.ja ? por(f.ja, { protocolo: r.protocolo }) : por(f.pronto, { protocolo: r.protocolo, quando: quando(lang, r.responder_ate) }));
      if (!r.ja) {
        setAlvo("");
        setDescricao("");
      }
    } catch (e2) {
      const c = codigoDoErro(e2);
      setErro(c === "nao_encontrado" || c === "invalido:alvo" ? f.naoEncontrado : c === "sem_permissao" ? f.proprio : t.comum.erro);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="le-form" id="ilegal" aria-labelledby="le-ilegal-t">
      <h2 id="le-ilegal-t" className="al-cond">{f.titulo}</h2>
      <p>{por(f.texto, { horas: PRAZOS_DAS_DENUNCIAS.ilegal })}</p>
      {!comConta ? (
        <p className="le-ajuda"><Rico lang={lang} texto={f.semConta} /></p>
      ) : (
        <form onSubmit={enviar} noValidate>
          <div className="le-campo">
            <label htmlFor={`${id}-alvo`}>{f.alvo}</label>
            <input id={`${id}-alvo`} value={alvo} maxLength={300} onChange={(e) => setAlvo(e.target.value)} aria-describedby={`${id}-alvo-ajuda`} aria-invalid={erro === f.alvoInvalido || undefined} autoComplete="off" spellCheck={false} />
            <p id={`${id}-alvo-ajuda`} className="le-ajuda">{f.alvoAjuda}</p>
          </div>
          <div className="le-campo">
            <label htmlFor={`${id}-desc`}>{f.descricao}</label>
            <textarea id={`${id}-desc`} value={descricao} maxLength={2000} onChange={(e) => setDescricao(e.target.value)} aria-describedby={`${id}-desc-ajuda`} />
            <p id={`${id}-desc-ajuda`} className="le-ajuda">{f.descricaoAjuda}</p>
          </div>
          <div className="le-acoes">
            <button type="submit" className="al-botao al-botao-primario al-botao-m" disabled={enviando || !alvo.trim()}>
              {enviando ? t.comum.enviando : f.enviar}
            </button>
          </div>
          {erro && <p className="le-erro" role="alert">{erro}</p>}
          {pronto && <p className="le-ok" role="status"><Rico lang={lang} texto={pronto} /></p>}
        </form>
      )}
    </section>
  );
}

