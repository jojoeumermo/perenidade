// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A parte dos atos da ação coletiva (Prompt 4): os selos de acessibilidade (95), a ciranda (96), a previsão do tempo (97) e o
// panfleto com QR (94). A ficha do ato vem do banco (rede_p4_ato: só título, data, cidade e ponto público, nunca quem organiza ou
// confirmou); a previsão vem da nossa rota, pela cidade do ato; o panfleto é desenhado neste aparelho.
import { useEffect, useId, useState } from "react";
import { acaoColetiva, idDoAto, SELOS_DO_ATO, type AtoMeu, type FichaDoAto, type SeloDoAto } from "@/lib/rede/coletiva/cliente";
import { diaPrevisivel, linhasDoPanfleto, linkDoAto, qrDoPanfleto, type Previsao } from "@/lib/rede/coletiva/regras";
import { Botao } from "../ui/Botao";
import { useCarga } from "../memoria/usar";
import { com, escapar, fraseDoErro, imprimirSozinho, type TextosDaColetiva } from "./textos";

type Props = { t: TextosDaColetiva; lang: string };
type Msg = { texto: string; erro: boolean } | null;

/** O dia (AAAA-MM-DD) de um instante no horário de Brasília. */
const diaEmBrasilia = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
const quandoDoAto = (lang: string, iso: string) =>
  new Intl.DateTimeFormat(lang, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

export function AbaAtos({ t, lang }: Props) {
  const meus = useCarga<AtoMeu[]>("meus-atos", () => acaoColetiva.meusAtos());
  const [aberto, setAberto] = useState<string | null>(null);
  const [colado, setColado] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const id = useId();
  return (
    <div className="ac-bloco">
      <p className="ac-miudo">{t.ato.sobre}</p>
      {meus.erro ? <p className="ac-erro" role="alert">{fraseDoErro(t, meus.erro)}</p> : null}
      {meus.dado && meus.dado.length > 0 && (
        <section className="ac-bloco" aria-labelledby={`${id}-m`}>
          <h2 id={`${id}-m`} className="ac-subtitulo">{t.ato.meus}</h2>
          <div className="ac-acoes">
            {meus.dado.map((a) => (
              <Botao key={a.id} variante={aberto === a.id ? "claro" : "contorno"} pressionado={aberto === a.id} onClick={() => { setAberto(a.id); setMsg(null); }}>
                {a.titulo} · {a.cidade}
              </Botao>
            ))}
          </div>
        </section>
      )}
      <form className="ac-form" onSubmit={(e) => {
        e.preventDefault();
        const x = idDoAto(colado);
        if (!x) return setMsg({ texto: t.ato.naoAchei, erro: true });
        setMsg(null);
        setAberto(x);
      }}>
        <label htmlFor={`${id}-c`}>{t.ato.colar}</label>
        <input id={`${id}-c`} type="text" value={colado} onChange={(e) => setColado(e.target.value)} autoComplete="off" spellCheck={false} />
        <div className="ac-acoes"><Botao type="submit" variante="contorno">{t.ato.abrir}</Botao></div>
      </form>
      {msg && <p className={msg.erro ? "ac-erro" : "ac-ok"} role={msg.erro ? "alert" : "status"}>{msg.texto}</p>}
      {aberto && <FichaDoAtoAberta key={aberto} t={t} lang={lang} ato={aberto} />}
    </div>
  );
}

function FichaDoAtoAberta({ t, lang, ato }: Props & { ato: string }) {
  const { dado, erro, trocar } = useCarga<FichaDoAto>(`ato:${ato}`, () => acaoColetiva.ato(ato));
  const [msg, setMsg] = useState<Msg>(null);
  const id = useId();
  const fazer = async (f: () => Promise<FichaDoAto>) => {
    try {
      trocar(await f());
      setMsg(null);
      return true;
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
      return false;
    }
  };
  if (erro) return <p className="ac-erro" role="alert">{t.ato.naoAchei}</p>;
  if (!dado) return <p className="ac-miudo" role="status">{t.comum.carregando}</p>;
  return (
    <article className="ac-bloco" aria-labelledby={`${id}-t`}>
      <div className="ac-cartao">
        <p className="ac-etiqueta">{quandoDoAto(lang, dado.inicio)}</p>
        <h2 id={`${id}-t`} className="ac-subtitulo">{dado.titulo}</h2>
        <p className="ac-miudo">{[dado.ponto, dado.cidade].filter(Boolean).join(" · ")}</p>
      </div>
      {msg && <p className={msg.erro ? "ac-erro" : "ac-ok"} role={msg.erro ? "alert" : "status"}>{msg.texto}</p>}
      <Acessibilidade t={t} ficha={dado} fazer={fazer} />
      <Ciranda t={t} ficha={dado} fazer={fazer} />
      <Tempo t={t} ficha={dado} />
      <Panfleto t={t} lang={lang} ficha={dado} />
    </article>
  );
}

type Fazer = (f: () => Promise<FichaDoAto>) => Promise<boolean>;

// ───── 95 · Selos de acessibilidade ─────
function Acessibilidade({ t, ficha, fazer }: { t: TextosDaColetiva; ficha: FichaDoAto; fazer: Fazer }) {
  const id = useId();
  const [marcados, setMarcados] = useState<SeloDoAto[]>(ficha.selos);
  return (
    <section className="ac-bloco" aria-labelledby={`${id}-t`} data-item="95">
      <h3 id={`${id}-t`} className="ac-subtitulo">{t.ato.acessibilidade}</h3>
      {ficha.organizo ? (
        <form className="ac-form" onSubmit={(e) => { e.preventDefault(); void fazer(() => acaoColetiva.selos(ficha.id, marcados)); }}>
          <fieldset>
            <legend className="sr-only">{t.ato.acessibilidade}</legend>
            {SELOS_DO_ATO.map((s) => (
              <label key={s} className="ac-opcao">
                <input type="checkbox" checked={marcados.includes(s)} onChange={(e) => setMarcados((m) => (e.target.checked ? [...m, s] : m.filter((x) => x !== s)))} />
                {t.ato.selos[s]}
              </label>
            ))}
          </fieldset>
          <div className="ac-acoes"><Botao type="submit">{t.comum.salvar}</Botao></div>
        </form>
      ) : ficha.selos.length ? (
        <ul className="ac-lista">{ficha.selos.map((s) => <li key={s} className="ac-etiqueta">✓ {t.ato.selos[s]}</li>)}</ul>
      ) : <p className="ac-miudo">{t.ato.semSelos}</p>}
    </section>
  );
}

// ───── 96 · Ciranda ─────
function Ciranda({ t, ficha, fazer }: { t: TextosDaColetiva; ficha: FichaDoAto; fazer: Fazer }) {
  const id = useId();
  const c = ficha.ciranda;
  const [criancas, setCriancas] = useState(c?.minhas || 1);
  return (
    <section className="ac-bloco" aria-labelledby={`${id}-t`} data-item="96">
      <h3 id={`${id}-t`} className="ac-subtitulo">{t.ato.ciranda}</h3>
      <p className="ac-miudo">{t.ato.cirandaSobre}</p>
      {c ? (
        <div className="ac-cartao">
          <p><strong>{t.ato.idades}:</strong> {c.idades}</p>
          <p><strong>{t.ato.cuidado}:</strong> {c.cuidado}</p>
          <p className="ac-etiqueta" aria-live="polite">{c.lotada ? t.ato.lotada : c.poucas ? t.ato.poucas : c.sobram !== null ? com(t.ato.sobram, { n: c.sobram }) : ""}</p>
          {ficha.organizo && <p className="ac-miudo">{c.reservadas !== null ? com(t.ato.reservadas, { n: c.reservadas }) : `${t.ato.reservadas.replace("{n}", t.comum.menosDe3)}`}</p>}
          <form className="ac-form" onSubmit={(e) => { e.preventDefault(); void fazer(() => acaoColetiva.reservar(ficha.id, criancas)); }}>
            <label>{t.ato.minhas}<input type="number" min={1} max={10} value={criancas} onChange={(e) => setCriancas(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} /></label>
            <div className="ac-acoes">
              <Botao type="submit" disabled={c.lotada && !c.minhas}>{t.ato.reservar}</Botao>
              {c.minhas > 0 && <Botao variante="fantasma" onClick={() => fazer(() => acaoColetiva.reservar(ficha.id, 0))}>{t.ato.cancelarReserva}</Botao>}
              {ficha.organizo && <Botao variante="fantasma" onClick={() => fazer(() => acaoColetiva.fecharCiranda(ficha.id))}>{t.ato.fecharCiranda}</Botao>}
            </div>
          </form>
        </div>
      ) : ficha.organizo ? (
        <form className="ac-form" aria-label={t.ato.abrirCiranda} onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void fazer(() => acaoColetiva.abrirCiranda(ficha.id, { vagas: Number(f.get("vagas")), idades: String(f.get("idades")), cuidado: String(f.get("cuidado")) }));
        }}>
          <label>{t.ato.vagas}<input type="number" name="vagas" min={1} max={200} defaultValue={10} required /></label>
          <label>{t.ato.idades}<input type="text" name="idades" maxLength={60} required /></label>
          <label>{t.ato.cuidado}<input type="text" name="cuidado" maxLength={200} required /></label>
          <div className="ac-acoes"><Botao type="submit">{t.ato.abrirCiranda}</Botao></div>
        </form>
      ) : <p className="ac-miudo">{t.ato.semCiranda}</p>}
    </section>
  );
}

// ───── 97 · Previsão do tempo ─────
function Tempo({ t, ficha }: { t: TextosDaColetiva; ficha: FichaDoAto }) {
  const id = useId();
  const dia = diaEmBrasilia(ficha.inicio);
  const hoje = diaEmBrasilia(new Date().toISOString());
  const previsivel = diaPrevisivel(dia, hoje) && ficha.cidade.trim().length >= 2;
  const [estado, setEstado] = useState<{ previsao: Previsao | null; falhou: boolean } | null>(null);
  useEffect(() => {
    if (!previsivel) return;
    let vivo = true;
    // Só a cidade do ato e o dia vão à nossa rota (sem cookie): nada da pessoa, nunca a posição dela.
    fetch(`/api/rede/coletiva/tempo?cidade=${encodeURIComponent(ficha.cidade.trim().toLowerCase())}&dia=${dia}`, { credentials: "omit" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { previsao: Previsao | null }) => vivo && setEstado({ previsao: j.previsao, falhou: !j.previsao }))
      .catch(() => vivo && setEstado({ previsao: null, falhou: true }));
    return () => { vivo = false; };
  }, [previsivel, ficha.cidade, dia]);
  const p = estado?.previsao;
  return (
    <section className="ac-bloco" aria-labelledby={`${id}-t`} data-item="97">
      <h3 id={`${id}-t`} className="ac-subtitulo">{t.ato.tempo}</h3>
      {!previsivel ? <p className="ac-miudo">{t.ato.tempoFora}</p>
        : !estado ? <p className="ac-miudo" role="status">{t.comum.carregando}</p>
          : p ? (
            <div className="ac-cartao" aria-live="polite">
              <p className="ac-etiqueta">{t.ato.tempos[p.tipo]}</p>
              {p.minima !== null && p.maxima !== null && <p>{com(t.ato.temperatura, { min: p.minima, max: p.maxima })}</p>}
              {p.chuva !== null && <p>{com(t.ato.chuva, { n: p.chuva })}</p>}
            </div>
          ) : <p className="ac-miudo">{t.ato.tempoFalhou}</p>}
      <p className="ac-miudo">{t.ato.tempoSobre}</p>
    </section>
  );
}

// ───── 94 · Panfleto com QR ─────
/** Quebra o texto em linhas de até `n` caracteres, sem partir palavra (a não ser a que sozinha passa de `n`). */
function quebrar(texto: string, n: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    const junto = atual ? `${atual} ${palavra}` : palavra;
    if (junto.length <= n) atual = junto;
    else {
      if (atual) linhas.push(atual);
      atual = palavra.length > n ? `${palavra.slice(0, n - 1)}…` : palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/** O panfleto em A4 (SVG): título grande, quando, onde, os selos e o QR da página do ato. */
function montarPanfleto(linhas: string[], qr: string, link: string): string {
  const [titulo = "", ...resto] = linhas;
  const tit = quebrar(titulo, 18).slice(0, 4);
  let y = 120;
  const partes: string[] = [];
  for (const l of tit) { partes.push(`<text x="297.5" y="${y}" font-size="52" font-weight="800" text-anchor="middle">${escapar(l)}</text>`); y += 60; }
  y += 14;
  for (const l of resto) for (const q of quebrar(l, 34).slice(0, 3)) { partes.push(`<text x="297.5" y="${y}" font-size="26" text-anchor="middle">${escapar(q)}</text>`); y += 36; }
  const lado = 300;
  const qy = Math.max(y + 20, 470);
  const qrInterno = qr.replace(/^[\s\S]*?<svg/, `<svg x="${(595 - lado) / 2}" y="${qy}" width="${lado}" height="${lado}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" width="595" height="842" font-family="sans-serif" fill="#000">`
    + `<rect width="595" height="842" fill="#fff"/>${partes.join("")}${qrInterno}`
    + `<text x="297.5" y="${qy + lado + 34}" font-size="15" text-anchor="middle">${escapar(link)}</text></svg>`;
}

function Panfleto({ t, lang, ficha }: { t: TextosDaColetiva; lang: string; ficha: FichaDoAto }) {
  const id = useId();
  const [svg, setSvg] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  async function fazerPanfleto() {
    try {
      const link = linkDoAto(window.location.origin, lang, ficha.id);
      const linhas = linhasDoPanfleto(ficha, quandoDoAto(lang, ficha.inicio), ficha.selos.map((s) => t.ato.selos[s]));
      setSvg(montarPanfleto(linhas, await qrDoPanfleto(link), link));
      setErro(false);
    } catch {
      setErro(true);
    }
  }
  const url = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
  const imprimir = () => svg && imprimirSozinho(ficha.titulo, svg, "@page{size:A4;margin:0}svg{width:100vw;height:auto}");
  return (
    <section className="ac-bloco" aria-labelledby={`${id}-t`} data-item="94">
      <h3 id={`${id}-t`} className="ac-subtitulo">{t.ato.panfleto}</h3>
      <p className="ac-miudo">{t.ato.panfletoSobre}</p>
      <div className="ac-acoes"><Botao variante="contorno" onClick={fazerPanfleto}>{t.ato.fazerPanfleto}</Botao></div>
      {erro && <p className="ac-erro" role="alert">{t.erros.outro}</p>}
      {url && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- o panfleto é desenhado aqui, em SVG, e não passa pelo otimizador */}
          <img className="ac-panfleto" src={url} alt={com(t.ato.panfletoDescricao, { titulo: ficha.titulo })} />
          <div className="ac-acoes">
            <a className="al-botao al-botao-contorno al-botao-m" href={url} download="panfleto-do-ato.svg">{t.comum.baixar}</a>
            <Botao variante="contorno" onClick={imprimir}>{t.comum.imprimir}</Botao>
          </div>
        </>
      )}
    </section>
  );
}
