// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A roda de redação (/alumia/redacao, onda 11, frente 11D): o tema da semana no alto, as partes da roda em abas (escrever, corrigir,
// devolutivas e, para quem pode, mediação e temas) e, ao lado, a troca da pessoa e as regras da roda escritas.
import "./redacao.css";
import { useCallback, useEffect, useState } from "react";
import { EsqueletoDaLinha } from "../../Esqueletos";
import type { PropsDaTelaDoPacote } from "../../registro";
import { conferirRedacao, LIMITES_DA_REDACAO, redacao, type Ficha, type Roda } from "./cliente";
import { Mediacao, Temas } from "./Coordenacao";
import { Devolutiva } from "./Devolutiva";
import { FichaDeCorrecao } from "./FichaDeCorrecao";
import { FolhaDeEscrever } from "./Folha";
import { dataNoIdioma, por, textoDoErro, type TextosDaRedacao } from "./textos";
import { useTextosDaRedacao } from "./usarTextos";

type Aba = "escrever" | "corrigir" | "devolutivas" | "mediacao" | "temas";

// O rascunho fica só neste aparelho, com o prefixo da Alumia (o "Sair rápido" apaga junto).
const CHAVE_DO_RASCUNHO = "lucia:rede:redacao:rascunho";
function lerRascunho(semana: string): { titulo: string; texto: string } {
  try {
    const r = JSON.parse(localStorage.getItem(CHAVE_DO_RASCUNHO) ?? "null") as { semana?: string; titulo?: string; texto?: string } | null;
    if (r && r.semana === semana) return { titulo: String(r.titulo ?? ""), texto: String(r.texto ?? "") };
  } catch {
    // sem armazenamento: começa vazio
  }
  return { titulo: "", texto: "" };
}
function gravarRascunho(semana: string, titulo: string, texto: string) {
  try {
    if (!titulo && !texto) localStorage.removeItem(CHAVE_DO_RASCUNHO);
    else localStorage.setItem(CHAVE_DO_RASCUNHO, JSON.stringify({ semana, titulo, texto }));
  } catch {
    // sem armazenamento: o rascunho só vive nesta aba
  }
}

function Escrever({ t, roda, aoEntregar }: { t: TextosDaRedacao; roda: Roda; aoEntregar: () => void }) {
  const te = t.escrever;
  const [titulo, setTitulo] = useState(() => lerRascunho(roda.semana).titulo);
  const [texto, setTexto] = useState(() => lerRascunho(roda.semana).texto);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => gravarRascunho(roda.semana, titulo, texto), [roda.semana, titulo, texto]);
  if (roda.afastada_ate) return null;
  if (!roda.tema) return <p className="rd-vazio">{roda.pode_tema ? t.tema.semTemaCoord : t.tema.semTema}</p>;
  if (roda.entreguei) return <p className="rd-ok">{te.jaEntregou}</p>;
  const entregar = async () => {
    const falta = conferirRedacao(titulo, texto);
    if (falta) {
      setErro(t.erros[`invalido:${falta}` as keyof TextosDaRedacao["erros"]] ?? t.erros.generico);
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await redacao.entregar(titulo, texto);
      gravarRascunho(roda.semana, "", "");
      aoEntregar();
    } catch (e) {
      setErro(textoDoErro(t.erros, e));
    }
    setEnviando(false);
  };
  return (
    <section className="rd-bloco" aria-labelledby="rd-escrever-t">
      <h2 id="rd-escrever-t" className="rd-bloco-titulo al-cond">{te.titulo}</h2>
      <label htmlFor="rd-titulo" className="rd-rotulo">{te.tituloCampo}</label>
      <input id="rd-titulo" className="rd-campo rd-campo-titulo" maxLength={LIMITES_DA_REDACAO.tituloMax} value={titulo} disabled={enviando} onChange={(e) => setTitulo(e.target.value)} />
      <FolhaDeEscrever t={t} valor={texto} aoMudar={setTexto} desligada={enviando} />
      {erro && <p className="rd-erro" role="alert">{erro}</p>}
      <div className="rd-acoes">
        <button type="button" className="al-botao al-botao-primario al-botao-g" disabled={enviando || !texto.trim()} onClick={entregar}>{enviando ? te.entregando : te.entregar}</button>
        <span className="rd-dica">{te.rascunho}</span>
      </div>
    </section>
  );
}

function Corrigir({ lang, t, roda, aoMudar }: { lang: string; t: TextosDaRedacao; roda: Roda; aoMudar: () => void }) {
  const tc = t.corrigir;
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pedindo, setPedindo] = useState(false);
  if (roda.afastada_ate) return null;
  const pedir = async () => {
    setPedindo(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await redacao.pegar();
      if ("nenhuma" in r) setAviso(r.dispensada ? tc.dispensada : tc.nenhuma);
      aoMudar();
    } catch (e) {
      setErro(textoDoErro(t.erros, e));
    }
    setPedindo(false);
  };
  const enviar = async (leitura: string, ficha: Ficha): Promise<string | null> => {
    try {
      await redacao.corrigir(leitura, ficha);
      setAviso(tc.enviada);
      aoMudar();
      return null;
    } catch (e) {
      return textoDoErro(t.erros, e);
    }
  };
  const largar = async (leitura: string) => {
    try {
      await redacao.largar(leitura);
    } catch {
      // já tinha vencido: a roda recarrega do mesmo jeito
    }
    aoMudar();
  };
  const cheia = roda.leituras.length >= 2;
  return (
    <section className="rd-bloco" aria-labelledby="rd-corrigir-t">
      <h2 id="rd-corrigir-t" className="rd-bloco-titulo al-cond">{tc.titulo}</h2>
      <p className="rd-chamada-bloco">{tc.chamada}</p>
      {/* Sem leitura aberta, o pedido em destaque; com uma aberta, ela vem primeiro e o pedido de mais uma fica depois, discreto; com
          duas, só a frase de que é preciso terminar uma. */}
      {roda.leituras.length === 0 && (
        <div className="rd-acoes">
          <button type="button" className="al-botao al-botao-dourado al-botao-g" disabled={pedindo} onClick={pedir}>{pedindo ? tc.pedindo : tc.pedir}</button>
        </div>
      )}
      {aviso && <p className="rd-ok" role="status">{aviso}</p>}
      {erro && <p className="rd-erro" role="alert">{erro}</p>}
      {roda.leituras.map((l) => (
        <FichaDeCorrecao key={l.id} lang={lang} t={t} l={l} aoEnviar={(f) => enviar(l.id, f)} aoLargar={() => largar(l.id)} />
      ))}
      {roda.leituras.length > 0 && (
        <div className="rd-acoes">
          {cheia ? <span className="rd-dica">{tc.duasAbertas}</span> : (
            <>
              <span className="rd-dica">{tc.jaLendo}</span>
              <button type="button" className="al-botao al-botao-contorno al-botao-m" disabled={pedindo} onClick={pedir}>{pedindo ? tc.pedindo : tc.pedirOutra}</button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Lado({ lang, t, roda }: { lang: string; t: TextosDaRedacao; roda: Roda }) {
  const tt = t.troca;
  const feitas = roda.corrigi.find((x) => x.semana === roda.semana)?.feitas ?? 0;
  return (
    <aside className="rd-lado">
      <section className="rd-troca" aria-labelledby="rd-troca-t">
        <h2 id="rd-troca-t" className="rd-lado-titulo al-cond">{tt.titulo}</h2>
        {roda.afastada_ate ? <p className="rd-afastada">{por(tt.afastada, { data: dataNoIdioma(lang, roda.afastada_ate) })}</p> : (
          <ul className="rd-ladrilhos">
            <li>
              <strong className="rd-n al-cond">{feitas}<small> {tt.deDuas}</small></strong>
              <span>{tt.corrigidas}</span>
              <span className="rd-pontos" aria-hidden>{[0, 1].map((i) => <i key={i} data-cheio={feitas > i ? "sim" : undefined} />)}</span>
            </li>
            <li>
              <strong className="rd-n al-cond" data-pouco={roda.esperando === null ? "sim" : undefined}>{roda.esperando ?? tt.menosDe3}</strong>
              <span>{tt.esperando}</span>
            </li>
          </ul>
        )}
      </section>
      <section className="rd-como" aria-labelledby="rd-como-t">
        <h2 id="rd-como-t" className="rd-lado-titulo al-cond">{t.como.titulo}</h2>
        <ol>
          {t.como.itens.map((c) => (
            <li key={c.titulo}>
              <h3 className="al-cond">{c.titulo}</h3>
              <p>{c.texto}</p>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}

export default function TelaDaRedacao({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const t = useTextosDaRedacao(lang);
  const [roda, setRoda] = useState<Roda | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [aba, setAba] = useState<Aba>("escrever");
  const membro = situacao.logado && situacao.membro && !situacao.suspenso;

  const carregar = useCallback(() => {
    if (!membro) return;
    redacao.roda().then((r) => {
      setRoda(r);
      setErro(null);
    }, setErro);
  }, [membro]);
  useEffect(() => carregar(), [carregar]);

  if (!t) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;

  const abas: Aba[] = ["escrever", "corrigir", "devolutivas", ...(roda?.pode_mediar ? (["mediacao"] as const) : []), ...(roda?.pode_tema ? (["temas"] as const) : [])];
  const aDevolver = roda?.minhas.filter((m) => m.situacao === "na_roda" && (m.falta_corrigir ?? 0) > 0).length ?? 0;

  return (
    <article className="rd-pagina">
      <header className="rd-cabeca">
        <p className="rd-carimbo al-cond">{t.carimbo}</p>
        <h1 className="al-cond">{t.titulo}</h1>
        <p className="rd-chamada">{t.chamada.split("**").map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p))}</p>
      </header>

      {!membro ? <p className="rd-vazio">{t.entrar}</p> : erro ? <p className="rd-erro" role="alert">{textoDoErro(t.erros, erro)}</p> : !roda ? (
        <EsqueletoDaLinha rotulo={t.carregando} quantos={3} />
      ) : (
        <>
          <section className="rd-tema" aria-labelledby="rd-tema-t" data-vazio={roda.tema ? undefined : "sim"}>
            <p className="rd-tema-rotulo al-cond">{t.tema.rotulo}</p>
            {roda.tema ? (
              <>
                <h2 id="rd-tema-t" className="rd-tema-titulo">{roda.tema.titulo}</h2>
                <p className="rd-tema-ate">{por(t.tema.ate, { data: dataNoIdioma(lang, new Date(new Date(roda.tema.ate).getTime() - 60_000).toISOString()) })}</p>
                {roda.tema.motivadores && (
                  <details className="rd-motivadores">
                    <summary>{t.tema.motivadores}</summary>
                    {roda.tema.motivadores.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)}
                  </details>
                )}
              </>
            ) : <h2 id="rd-tema-t" className="rd-tema-titulo" data-vazio="sim">{roda.pode_tema ? t.tema.semTemaCoord : t.tema.semTema}</h2>}
          </section>

          <div className="rd-grade">
            <div className="rd-principal">
              <div className="rd-abas" role="group" aria-label={t.abas.rotulo}>
                {abas.map((a) => (
                  <button key={a} type="button" className="rd-aba" aria-pressed={aba === a} onClick={() => setAba(a)}>
                    {t.abas[a]}
                    {a === "corrigir" && roda.leituras.length > 0 && <span className="rd-aba-n">{roda.leituras.length}</span>}
                    {a === "devolutivas" && aDevolver > 0 && <span className="rd-aba-n" data-cor="dourado">!</span>}
                    {a === "mediacao" && (roda.denuncias_abertas ?? 0) > 0 && <span className="rd-aba-n">{roda.denuncias_abertas}</span>}
                  </button>
                ))}
              </div>
              {roda.afastada_ate && (aba === "escrever" || aba === "corrigir") && <p className="rd-afastada">{por(t.troca.afastada, { data: dataNoIdioma(lang, roda.afastada_ate) })}</p>}
              {aba === "escrever" && <Escrever t={t} roda={roda} aoEntregar={() => { carregar(); setAba("devolutivas"); }} />}
              {aba === "corrigir" && <Corrigir lang={lang} t={t} roda={roda} aoMudar={carregar} />}
              {aba === "devolutivas" && (
                <section className="rd-bloco" aria-labelledby="rd-devolutivas-t">
                  <h2 id="rd-devolutivas-t" className="rd-bloco-titulo al-cond">{t.devolutivas.titulo}</h2>
                  {roda.minhas.length === 0 ? <p className="rd-vazio">{t.devolutivas.vazio}</p> : roda.minhas.map((m) => (
                    <Devolutiva key={m.id} lang={lang} t={t} m={m}
                      aoApagar={async () => {
                        try {
                          await redacao.apagar(m.id);
                        } catch {
                          // já tinha sumido
                        }
                        carregar();
                      }}
                      aoDenunciar={async (correcao, motivo) => {
                        try {
                          await redacao.denunciar(correcao, motivo);
                          carregar();
                          return null;
                        } catch (e) {
                          return textoDoErro(t.erros, e);
                        }
                      }} />
                  ))}
                </section>
              )}
              {aba === "mediacao" && roda.pode_mediar && <Mediacao lang={lang} t={t} />}
              {aba === "temas" && roda.pode_tema && <Temas lang={lang} t={t} semanaAtual={roda.semana} aoMudar={carregar} />}
            </div>
            <Lado lang={lang} t={t} roda={roda} />
          </div>
        </>
      )}
    </article>
  );
}
