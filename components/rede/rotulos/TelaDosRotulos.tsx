// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { lerAlvo } from "../lei/alvo";
import type { PropsDaTelaDoPacote } from "../registro";
import { type ContestacaoNaFila, type MarcaDoRotulador, type MarcaSobreMim, PREVIA_DOS_ROTULOS, type Rotulador, rotulos } from "./cliente";
import { Cabeca, Carregando, Numero } from "./pecas";
import { EFEITOS, type Efeito, ROTULOS, type Rotulo } from "./regras";
import { dataNoIdioma, por, textoDoErro, type TextosDosRotulos } from "./textos";
import { useTextosDosRotulos } from "./usarTextos";

type T = TextosDosRotulos["rotulos"];

const nomeDoRotulador = (t: T, r: { tipo: "org" | "mediacao"; nome: string | null }) => (r.tipo === "mediacao" ? t.mediacao : (r.nome ?? ""));

/** O escudo do rotulador: a palavra da organização (ou "MED" para a mediação). */
function Escudo({ r }: { r: Pick<Rotulador, "tipo" | "palavra" | "nome"> }) {
  const palavra = r.tipo === "mediacao" ? "MED" : (r.palavra ?? r.nome ?? "ORG").slice(0, 5);
  return <span className="rt-escudo al-cond" aria-hidden>{palavra}</span>;
}

/** O cartão de um rotulador: as regras, os números e o seletor do efeito (não assinar, avisar, esconder). */
function CartaoDoRotulador({ lang, t, r, aoMudar }: { lang: string; t: TextosDosRotulos; r: Rotulador; aoMudar: (efeito: Efeito | null) => Promise<void> }) {
  const tr = t.rotulos;
  const nome = useId();
  const [enviando, setEnviando] = useState(false);
  const opcoes: (Efeito | null)[] = [null, ...EFEITOS];
  const escolher = async (e: Efeito | null) => {
    setEnviando(true);
    await aoMudar(e);
    setEnviando(false);
  };
  return (
    <li className="rt-rotulador" data-tipo={r.tipo} data-assina={r.efeito ? "sim" : undefined}>
      <div className="rt-rotulador-topo">
        <Escudo r={r} />
        <div>
          <h3 className="al-cond">{nomeDoRotulador(tr, r)}</h3>
          <p className="rt-rotulador-sub">{r.tipo === "mediacao" ? tr.mediacaoSub : `@${r.handle} · ${tr.palavraOrg}`}</p>
        </div>
      </div>
      <p className="rt-rotulador-regras">{r.tipo === "mediacao" ? tr.mediacaoRegras : r.regras}</p>
      <p className="rt-numeros">
        <span>{tr.marcas}: <Numero lang={lang} n={r.marcas} menos={t.transparencia.menosDe3} className="" como="strong" /></span>
        <span>{tr.revertidas}: <Numero lang={lang} n={r.revertidas} menos={t.transparencia.menosDe3} className="" como="strong" /></span>
      </p>
      <fieldset className="rt-efeito" disabled={enviando}>
        <legend>{tr.assinar}</legend>
        <div className="rt-efeito-opcoes">
          {opcoes.map((e) => (
            <label key={e ?? "nao"}>
              <input type="radio" name={nome} value={e ?? "nao"} checked={r.efeito === e} onChange={() => escolher(e)} />
              {e ? tr.efeitos[e].nome : tr.nao}
            </label>
          ))}
        </div>
        <p className="rt-efeito-texto">{r.efeito ? tr.efeitos[r.efeito].texto : tr.naoTexto}</p>
      </fieldset>
    </li>
  );
}

/** Uma marca na minha conta ou num post meu, com a contestação. */
function MarcaMinha({ lang, t, m, aoContestar }: { lang: string; t: T; m: MarcaSobreMim; aoContestar: (texto: string) => Promise<string | null> }) {
  const [abrir, setAbrir] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const id = useId();
  const enviar = async () => {
    setEnviando(true);
    const e = await aoContestar(texto.trim());
    setEnviando(false);
    setErro(e);
    if (!e) setAbrir(false);
  };
  return (
    <li className="rt-marca" data-situacao={m.situacao}>
      <div className="rt-marca-topo">
        <span className="rt-selo rt-selo-rotulo al-cond">{t.nomes[m.rotulo].nome}</span>
        <span className="rt-selo al-cond">{t.situacoes[m.situacao]}</span>
        <span>{m.alvo_tipo === "perfil" ? t.naConta : t.noPost}</span>
        <span>· {nomeDoRotulador(t, m)}</span>
        <span>· {dataNoIdioma(lang, m.criado_em, true)}</span>
      </div>
      {m.trecho && <blockquote>{m.trecho}</blockquote>}
      <p><strong>{t.motivo}:</strong> {m.motivo}</p>
      {m.decisao && <p><strong>{t.decisao}:</strong> {m.decisao}</p>}
      {m.pode_contestar && !abrir && (
        <div className="rt-acoes">
          <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => setAbrir(true)}>{t.contestar}</button>
        </div>
      )}
      {abrir && (
        <div className="rt-campo" style={{ marginTop: "0.6rem" }}>
          <label htmlFor={id}>{t.contestarRotulo}</label>
          <textarea id={id} value={texto} maxLength={1000} onChange={(e) => setTexto(e.target.value)} />
          <small>{t.contestarAjuda}</small>
          <div className="rt-acoes">
            <button type="button" className="al-botao al-botao-primario al-botao-p" disabled={enviando || texto.trim().length < 10} onClick={enviar}>{t.enviar}</button>
            <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => setAbrir(false)}>{t.cancelar}</button>
          </div>
          {erro && <p className="rt-erro" role="alert">{erro}</p>}
        </div>
      )}
    </li>
  );
}

/** Retirar uma marca: o botão abre o campo do motivo (10 letras ou mais, vai para o registro). */
function Retirar({ t, aoRetirar }: { t: T; aoRetirar: (porque: string) => Promise<void> }) {
  const [aberto, setAberto] = useState(false);
  const [porque, setPorque] = useState("");
  if (!aberto) {
    return (
      <div className="rt-acoes">
        <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => setAberto(true)}>{t.retirar}</button>
      </div>
    );
  }
  return (
    <div className="rt-campo" style={{ marginTop: "0.5rem" }}>
      <textarea aria-label={t.retirarMotivo} placeholder={t.retirarMotivo} value={porque} maxLength={500} onChange={(e) => setPorque(e.target.value)} />
      <div className="rt-acoes">
        <button type="button" className="al-botao al-botao-primario al-botao-p" disabled={porque.trim().length < 10} onClick={() => aoRetirar(porque.trim())}>{t.retirar}</button>
        <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => setAberto(false)}>{t.cancelar}</button>
      </div>
    </div>
  );
}

/** Pôr uma marca em nome de um rotulador e ver (e retirar) as que valem. */
function Rotular({ lang, t, meus }: { lang: string; t: T; meus: Rotulador[] }) {
  const [rotulador, setRotulador] = useState(meus[0]?.id ?? "");
  const [alvo, setAlvo] = useState("");
  const [rotulo, setRotulo] = useState<Rotulo>("golpe");
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [lista, setLista] = useState<MarcaDoRotulador[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const ids = { em: useId(), alvo: useId(), rotulo: useId(), motivo: useId() };
  const atual = meus.find((r) => r.id === rotulador) ?? meus[0];

  const carregar = useCallback(() => {
    if (!rotulador) return;
    rotulos.meus(rotulador).then(setLista, () => setLista([]));
  }, [rotulador]);
  useEffect(() => carregar(), [carregar]);

  const lido = lerAlvo(alvo);
  const alvoOk = !!lido && (lido.tipo === "post" || lido.tipo === "perfil");
  const marcar = async () => {
    if (!lido || !alvoOk) return;
    setEnviando(true);
    try {
      await rotulos.marcar(rotulador, lido.tipo as "post" | "perfil", lido.alvo, rotulo, motivo.trim());
      setMsg({ ok: true, texto: t.marcado });
      setAlvo("");
      setMotivo("");
      carregar();
    } catch (e) {
      setMsg({ ok: false, texto: textoDoErro(t.erros, e) });
    }
    setEnviando(false);
  };
  const retirar = async (m: MarcaDoRotulador, porque: string) => {
    try {
      await rotulos.retirar(m.id, porque);
      setMsg({ ok: true, texto: t.retirada });
      carregar();
    } catch (e) {
      setMsg({ ok: false, texto: textoDoErro(t.erros, e) });
    }
  };

  return (
    <section className="rt-bloco" aria-labelledby="rt-rotular-t">
      <h2 id="rt-rotular-t" className="rt-bloco-titulo al-cond">{t.rotularTitulo}</h2>
      <div className="rt-duas">
        <div className="rt-form">
          <p>{por(t.rotularChamada, { nome: atual ? nomeDoRotulador(t, atual) : "" })}</p>
          <div className="rt-campos">
            {meus.length > 1 && (
              <div className="rt-campo rt-campo-largo">
                <label htmlFor={ids.em}>{t.em}</label>
                <select id={ids.em} value={rotulador} onChange={(e) => setRotulador(e.target.value)}>
                  {meus.map((r) => <option key={r.id} value={r.id}>{nomeDoRotulador(t, r)}</option>)}
                </select>
              </div>
            )}
            <div className="rt-campo rt-campo-largo">
              <label htmlFor={ids.alvo}>{t.alvo}</label>
              <input id={ids.alvo} value={alvo} maxLength={300} onChange={(e) => setAlvo(e.target.value)} aria-invalid={alvo.trim() !== "" && !alvoOk} aria-describedby={`${ids.alvo}-a`} />
              <small id={`${ids.alvo}-a`}>{alvo.trim() !== "" && !alvoOk ? t.alvoInvalido : t.alvoAjuda}</small>
            </div>
            <div className="rt-campo rt-campo-largo">
              <label htmlFor={ids.rotulo}>{t.rotulo}</label>
              <select id={ids.rotulo} value={rotulo} onChange={(e) => setRotulo(e.target.value as Rotulo)} aria-describedby={`${ids.rotulo}-a`}>
                {ROTULOS.map((r) => <option key={r} value={r}>{t.nomes[r].nome}</option>)}
              </select>
              <small id={`${ids.rotulo}-a`}>{t.nomes[rotulo].quer}</small>
            </div>
            <div className="rt-campo rt-campo-largo">
              <label htmlFor={ids.motivo}>{t.motivoRotulo}</label>
              <textarea id={ids.motivo} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />
            </div>
          </div>
          <div className="rt-acoes">
            <button type="button" className="al-botao al-botao-primario" disabled={enviando || !alvoOk || motivo.trim().length < 10} aria-describedby={!alvoOk || motivo.trim().length < 10 ? "rt-dica-marcar" : undefined} onClick={marcar}>{t.marcar}</button>
          </div>
          {(!alvoOk || motivo.trim().length < 10) && <small id="rt-dica-marcar" className="rt-dica">{t.dicaMarcar}</small>}
          {msg && <p className={msg.ok ? "rt-ok" : "rt-erro"} role={msg.ok ? "status" : "alert"}>{msg.texto}</p>}
        </div>
        <div>
          <h3 className="al-cond" style={{ margin: "0 0 0.6rem", fontSize: "1.45rem" }}>{t.valendoTitulo}</h3>
          {lista === null ? <Carregando rotulo={t.carregando} /> : lista.length === 0 ? <p className="rt-texto">{t.valendoVazio}</p> : (
            <ul className="rt-marcas">
              {lista.map((m) => (
                <li key={m.id} className="rt-marca" data-situacao={m.situacao}>
                  <div className="rt-marca-topo">
                    <span className="rt-selo rt-selo-rotulo al-cond">{t.nomes[m.rotulo].nome}</span>
                    <span className="rt-selo al-cond">{t.situacoes[m.situacao]}</span>
                    <span>{m.conta}{m.handle ? ` · @${m.handle}` : ""}</span>
                    <span>· {dataNoIdioma(lang, m.criado_em, true)}</span>
                    {m.minha && <span>· {t.suaMarca}</span>}
                  </div>
                  {m.trecho && <blockquote>{m.trecho}</blockquote>}
                  <p><strong>{t.motivo}:</strong> {m.motivo}</p>
                  <Retirar t={t} aoRetirar={(porque) => retirar(m, porque)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/** Uma organização com selo abre (ou fecha) o serviço de rótulos. */
function AbrirServico({ t }: { t: T }) {
  const [org, setOrg] = useState("");
  const [regras, setRegras] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const ids = { org: useId(), regras: useId() };
  const ir = async (aberto: boolean) => {
    try {
      await rotulos.abrir(org.trim(), regras.trim(), aberto);
      setMsg({ ok: true, texto: aberto ? t.aberto : t.fechado });
    } catch (e) {
      setMsg({ ok: false, texto: textoDoErro(t.erros, e) });
    }
  };
  return (
    <details className="rt-bloco rt-detalhes">
      <summary className="al-cond">{t.abrirTitulo}</summary>
      <div className="rt-form" style={{ marginTop: "0.8rem" }}>
        <p>{t.abrirChamada}</p>
        <div className="rt-campo">
          <label htmlFor={ids.org}>{t.org}</label>
          <input id={ids.org} value={org} maxLength={41} onChange={(e) => setOrg(e.target.value)} placeholder="@" />
        </div>
        <div className="rt-campo">
          <label htmlFor={ids.regras}>{t.regras}</label>
          <textarea id={ids.regras} value={regras} maxLength={1500} onChange={(e) => setRegras(e.target.value)} />
        </div>
        <div className="rt-acoes">
          <button type="button" className="al-botao al-botao-primario" disabled={org.trim().length < 2 || regras.trim().length < 40} onClick={() => ir(true)}>{t.abrir}</button>
          <button type="button" className="al-botao al-botao-contorno" disabled={org.trim().length < 2 || regras.trim().length < 40} onClick={() => ir(false)}>{t.fechar}</button>
        </div>
        {msg && <p className={msg.ok ? "rt-ok" : "rt-erro"} role={msg.ok ? "status" : "alert"}>{msg.texto}</p>}
      </div>
    </details>
  );
}

/** A fila das contestações, para a mediação. Quem pôs a marca vê, mas não decide. */
function FilaDaMediacao({ lang, t }: { lang: string; t: T }) {
  const [fila, setFila] = useState<ContestacaoNaFila[] | null>(null);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const carregar = useCallback(() => {
    rotulos.fila().then(setFila, () => setFila([]));
  }, []);
  useEffect(() => carregar(), [carregar]);
  const decidir = async (c: ContestacaoNaFila, decisao: "manter" | "reverter") => {
    try {
      await rotulos.decidir(c.id, decisao, (motivos[c.id] ?? "").trim());
      setMsg({ ok: true, texto: t.decidido });
      carregar();
    } catch (e) {
      setMsg({ ok: false, texto: textoDoErro(t.erros, e) });
    }
  };
  return (
    <section className="rt-bloco" aria-labelledby="rt-fila-t">
      <h2 id="rt-fila-t" className="rt-bloco-titulo al-cond">{t.filaTitulo}</h2>
      {msg && <p className={msg.ok ? "rt-ok" : "rt-erro"} role={msg.ok ? "status" : "alert"} style={{ marginBottom: "0.8rem" }}>{msg.texto}</p>}
      {fila === null ? <Carregando rotulo={t.carregando} /> : fila.length === 0 ? <p className="rt-texto">{t.filaVazia}</p> : (
        <ul className="rt-marcas">
          {fila.map((c) => {
            const motivo = (motivos[c.id] ?? "").trim();
            return (
              <li key={c.id} className="rt-marca" data-situacao="contestado">
                <div className="rt-marca-topo">
                  <span className="rt-selo rt-selo-rotulo al-cond">{t.nomes[c.rotulo].nome}</span>
                  <span>{nomeDoRotulador(t, c)}</span>
                  <span>· {c.conta}</span>
                  <span>· {dataNoIdioma(lang, c.contestado_em, true)}</span>
                </div>
                {c.trecho && <blockquote>{c.trecho}</blockquote>}
                <p><strong>{t.motivo}:</strong> {c.motivo}</p>
                <p><strong>{t.contestacao}:</strong> {c.contestacao}</p>
                {c.pode ? (
                  <div className="rt-campo" style={{ marginTop: "0.5rem" }}>
                    <textarea aria-label={t.decisaoMotivo} placeholder={t.decisaoMotivo} value={motivos[c.id] ?? ""} maxLength={500}
                      onChange={(e) => setMotivos((m) => ({ ...m, [c.id]: e.target.value }))} />
                    <div className="rt-acoes">
                      <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled={motivo.length < 10} aria-describedby={motivo.length < 10 ? `rt-dica-${c.id}` : undefined} onClick={() => decidir(c, "manter")}>{t.manter}</button>
                      <button type="button" className="al-botao al-botao-primario al-botao-p" disabled={motivo.length < 10} aria-describedby={motivo.length < 10 ? `rt-dica-${c.id}` : undefined} onClick={() => decidir(c, "reverter")}>{t.reverter}</button>
                    </div>
                    {motivo.length < 10 && <small id={`rt-dica-${c.id}`} className="rt-dica">{t.dicaDecisao}</small>}
                  </div>
                ) : (
                  <p className="rt-nota">{t.naoPode}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Os rótulos (/alumia/rotulos): como funciona, os rotuladores (assinar com "avisar" ou "esconder"), as marcas sobre mim com a
 * contestação, rotular (para quem marca em nome de uma organização com selo ou da mediação), abrir o serviço da organização e a
 * fila das contestações (mediação). Quem assina não aparece para ninguém.
 */
export default function TelaDosRotulos({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const textos = useTextosDosRotulos(lang);
  const [catalogo, setCatalogo] = useState<Rotulador[] | null>(null);
  const [sobreMim, setSobreMim] = useState<MarcaSobreMim[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const membro = situacao.logado && situacao.membro && !situacao.suspenso;

  const carregar = useCallback(() => {
    if (!membro) return;
    rotulos.catalogo().then(setCatalogo, () => setCatalogo([]));
    rotulos.sobreMim().then(setSobreMim, () => setSobreMim([]));
  }, [membro]);
  useEffect(() => carregar(), [carregar]);

  if (!textos) return <Carregando rotulo={s.estados.carregando} />;
  const t = textos.rotulos;

  const mudar = async (r: Rotulador, efeito: Efeito | null) => {
    setErro(null);
    try {
      const novo = await rotulos.assinar(r.id, efeito);
      setCatalogo((c) => c?.map((x) => (x.id === r.id ? { ...x, efeito: novo.efeito } : x)) ?? c);
    } catch (e) {
      setErro(textoDoErro(t.erros, e));
    }
  };
  const contestar = async (m: MarcaSobreMim, texto: string): Promise<string | null> => {
    try {
      await rotulos.contestar(m.id, texto);
      setSobreMim((l) => l?.map((x) => (x.id === m.id ? { ...x, situacao: "contestado", pode_contestar: false, contestado_em: new Date().toISOString() } : x)) ?? l);
      return null;
    } catch (e) {
      return textoDoErro(t.erros, e);
    }
  };
  const meus = (catalogo ?? []).filter((r) => r.posso);

  return (
    <article className="rt-pagina">
      <Cabeca lang={lang} carimbo={t.carimbo} titulo={t.titulo} chamada={t.chamada} />

      <ol className="rt-como">
        {t.como.map((c) => (
          <li key={c.titulo}>
            <h3 className="al-cond">{c.titulo}</h3>
            <p>{c.texto}</p>
          </li>
        ))}
      </ol>

      <section className="rt-bloco" aria-labelledby="rt-rotuladores-t">
        <h2 id="rt-rotuladores-t" className="rt-bloco-titulo al-cond">{t.rotuladoresTitulo}</h2>
        {!membro ? <p className="rt-texto">{t.entrar}</p> : catalogo === null ? <Carregando rotulo={t.carregando} /> : (
          <>
            <ul className="rt-rotuladores">
              {catalogo.map((r) => <CartaoDoRotulador key={r.id} lang={lang} t={textos} r={r} aoMudar={(e) => mudar(r, e)} />)}
            </ul>
            {erro && <p className="rt-erro" role="alert">{erro}</p>}
            <p className="rt-aviso-ninguem">{t.ninguemVe}</p>
          </>
        )}
      </section>

      {membro && (
        <section className="rt-bloco" aria-labelledby="rt-sobre-mim-t">
          <h2 id="rt-sobre-mim-t" className="rt-bloco-titulo al-cond">{t.sobreMimTitulo}</h2>
          {sobreMim === null ? <Carregando rotulo={t.carregando} /> : sobreMim.length === 0 ? <p className="rt-texto">{t.sobreMimVazio}</p> : (
            <ul className="rt-marcas">
              {sobreMim.map((m) => <MarcaMinha key={m.id} lang={lang} t={t} m={m} aoContestar={(texto) => contestar(m, texto)} />)}
            </ul>
          )}
        </section>
      )}

      {membro && meus.length > 0 && <Rotular lang={lang} t={t} meus={meus} />}
      {membro && (situacao.cuida || PREVIA_DOS_ROTULOS) && <FilaDaMediacao lang={lang} t={t} />}
      {membro && <AbrirServico t={t} />}
    </article>
  );
}
