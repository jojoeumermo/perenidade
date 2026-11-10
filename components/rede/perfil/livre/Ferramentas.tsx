// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As ferramentas do editor do perfil livre: o editor de pixels do rosto, o tear da faixa própria, a escolha de cor com laudo de
// contraste e a ordem das abas. Tudo por teclado (setas, Espaço, Enter) e por toque/mouse, com rótulos para leitor de tela.
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  ABAS_DO_PERFIL, CORES_DA_FAIXA, CORES_DA_PALETA, CORES_DO_ROSTO, laudoDeContraste, LADO_DO_ROSTO, MODELOS_DE_FAIXA, PALETA_DO_PERFIL, PROPORCOES_DA_FAIXA,
  corHexValida, hexDoAcento, pintarRosto, variaveisDoAcento, type AbaDoPerfil,
} from "@/lib/rede/aparencia";
import { preencher } from "@/lib/rede/preencher";
import { comTransicao } from "./PaginaDoPerfil";
import type { TextosDoPerfilLivre } from "./textos";

/** Move o foco num grupo de rádio com setas (o padrão WAI-ARIA): devolve o índice novo ou nulo. */
function setas(e: KeyboardEvent, i: number, n: number, colunas = n): number | null {
  const mapa: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: colunas, ArrowUp: -colunas };
  if (e.key === "Home") return 0;
  if (e.key === "End") return n - 1;
  const d = mapa[e.key];
  if (d === undefined) return null;
  return (i + d + n) % n;
}

// ───────────────────────────── Cor do perfil ─────────────────────────────

export function EscolhaDeCor({ acento, aoMudar, t }: { acento: string; aoMudar: (a: string) => void; t: TextosDoPerfilLivre }) {
  const grupo = useRef<HTMLDivElement>(null);
  const livre = corHexValida(acento);
  const hex = hexDoAcento(acento);
  const laudo = laudoDeContraste(hex);
  const v = variaveisDoAcento(acento);
  const opcoes = CORES_DA_PALETA;
  const atual = Math.max(0, CORES_DA_PALETA.indexOf(acento as (typeof CORES_DA_PALETA)[number]));
  return (
    <div className="pfe-bloco">
      <h3 className="pfe-titulo" id="pfe-cor">{t.cores.titulo}</h3>
      <p className="pfe-ajuda">{t.cores.ajuda}</p>
      <div ref={grupo} role="radiogroup" aria-labelledby="pfe-cor" className="pfe-amostras">
        {CORES_DA_PALETA.map((c, i) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={acento === c}
            tabIndex={i === atual ? 0 : -1}
            className="pfe-amostra"
            style={{ ["--c" as string]: PALETA_DO_PERFIL[c] }}
            onClick={() => aoMudar(c)}
            onKeyDown={(e) => {
              const n = setas(e, i, opcoes.length);
              if (n === null) return;
              e.preventDefault();
              aoMudar(CORES_DA_PALETA[n]);
              (grupo.current?.querySelectorAll<HTMLElement>("[role=radio]")[n])?.focus();
            }}
          >
            <span className="sr-only">{t.cores.paleta[c]}</span>
          </button>
        ))}
      </div>
      <label className="pfe-livre" data-marcada={livre ? "" : undefined}>
        <span className="pfe-amostra pfe-amostra-livre" style={{ ["--c" as string]: livre ? hex : "transparent" }}>
          <input
            type="color"
            value={hex}
            onChange={(e) => {
              const c = e.target.value.toLowerCase();
              if (corHexValida(c)) aoMudar(c);
            }}
          />
          <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" className="pfe-conta-gotas">
            <path d="M12 3s6 6.3 6 10.5A6 6 0 0 1 6 13.5C6 9.3 12 3 12 3z" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </span>
        <span>{t.cores.livre}</span>
      </label>
      {livre ? <p className="pfe-ajuda">{t.cores.livreAjuda}</p> : null}
      <div className="pfe-laudo" aria-live="polite">
        <span className="pfe-laudo-amostra pfe-laudo-noite" style={{ color: v["--pf-acento-noite"] }}>Aa</span>
        <span className="pfe-laudo-amostra pfe-laudo-papel" style={{ color: v["--pf-acento-papel"] }}>Aa</span>
        <span className="pfe-laudo-amostra" style={{ background: hex, color: v["--pf-sobre-acento"] }}>Aa</span>
        <span className="pfe-laudo-texto">
          {preencher(t.cores.contraste, { noite: laudo.noite.toFixed(1).replace(".", ","), papel: laudo.papel.toFixed(1).replace(".", ",") })}{" "}
          <strong>{laudo.ajustada ? t.cores.ajustada : t.cores.passa}</strong>
        </span>
      </div>
    </div>
  );
}

// ───────────────────────────── Cartões de escolha (clima, modelo) ─────────────────────────────

export function CartoesDeEscolha<V extends string>({
  rotulo,
  opcoes,
  valor,
  aoMudar,
  nomes,
  ajudas,
  desenho,
}: {
  rotulo: string;
  opcoes: readonly V[];
  valor: V;
  aoMudar: (v: V) => void;
  nomes: Record<V, string>;
  ajudas: Record<V, string>;
  desenho: (v: V) => React.ReactNode;
}) {
  const grupo = useRef<HTMLDivElement>(null);
  const id = `pfe-${rotulo.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="pfe-bloco">
      <h3 className="pfe-titulo" id={id}>{rotulo}</h3>
      <div ref={grupo} role="radiogroup" aria-labelledby={id} className="pfe-cartoes">
        {opcoes.map((o, i) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={valor === o}
            tabIndex={valor === o ? 0 : -1}
            className="pfe-cartao"
            onClick={() => aoMudar(o)}
            onKeyDown={(e) => {
              const n = setas(e, i, opcoes.length);
              if (n === null) return;
              e.preventDefault();
              aoMudar(opcoes[n]);
              (grupo.current?.querySelectorAll<HTMLElement>("[role=radio]")[n])?.focus();
            }}
          >
            <span aria-hidden className="pfe-cartao-desenho">{desenho(o)}</span>
            <span className="pfe-cartao-nome">{nomes[o]}</span>
            <span className="pfe-cartao-ajuda">{ajudas[o]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────── A faixa tecida própria ─────────────────────────────

export function TearDaFaixa({ faixa, aoMudar, t }: { faixa: readonly number[]; aoMudar: (f: number[]) => void; t: TextosDoPerfilLivre }) {
  const [fio, setFio] = useState(0);
  const fios = useRef<HTMLDivElement>(null);
  const cores = useRef<HTMLDivElement>(null);
  const nomes = t.cores.coresDaFaixa;
  return (
    <div className="pfe-bloco">
      <h3 className="pfe-titulo" id="pfe-faixa">{t.cores.faixa}</h3>
      <p className="pfe-ajuda">{t.cores.faixaAjuda}</p>
      <div ref={fios} role="radiogroup" aria-labelledby="pfe-faixa" className="pfe-fios">
        {faixa.map((c, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={fio === i}
            tabIndex={fio === i ? 0 : -1}
            aria-label={preencher(t.cores.fioEscolhido, { n: i + 1, cor: nomes[c] ?? "" })}
            className="pfe-fio"
            style={{ flexGrow: PROPORCOES_DA_FAIXA[i], background: CORES_DA_FAIXA[c] }}
            onClick={() => setFio(i)}
            onKeyDown={(e) => {
              const n = setas(e, i, faixa.length);
              if (n === null) return;
              e.preventDefault();
              setFio(n);
              (fios.current?.querySelectorAll<HTMLElement>("[role=radio]")[n])?.focus();
            }}
          />
        ))}
      </div>
      <div ref={cores} role="radiogroup" aria-label={preencher(t.cores.fio, { n: fio + 1 })} className="pfe-amostras pfe-amostras-p">
        {CORES_DA_FAIXA.map((cor, i) => (
          <button
            key={cor}
            type="button"
            role="radio"
            aria-checked={faixa[fio] === i}
            tabIndex={faixa[fio] === i ? 0 : -1}
            className="pfe-amostra"
            style={{ ["--c" as string]: cor }}
            onClick={() => {
              const f = [...faixa];
              f[fio] = i;
              aoMudar(f);
            }}
            onKeyDown={(e) => {
              const n = setas(e, i, CORES_DA_FAIXA.length);
              if (n === null) return;
              e.preventDefault();
              const f = [...faixa];
              f[fio] = n;
              aoMudar(f);
              (cores.current?.querySelectorAll<HTMLElement>("[role=radio]")[n])?.focus();
            }}
          >
            <span className="sr-only">{nomes[i]}</span>
          </button>
        ))}
      </div>
      <p className="pfe-ajuda pfe-rotulo-pequeno">{t.cores.modelos}</p>
      <div className="pfe-modelos">
        {Object.entries(MODELOS_DE_FAIXA).map(([nome, f]) => (
          <button key={nome} type="button" className="pfe-modelo" onClick={() => aoMudar([...f])} aria-pressed={f.join() === faixa.join()}>
            <span aria-hidden className="pfe-modelo-faixa">
              {f.map((c, i) => (
                <i key={i} style={{ flexGrow: PROPORCOES_DA_FAIXA[i], background: CORES_DA_FAIXA[c] }} />
              ))}
            </span>
            {t.cores.modelosNomes[nome as keyof typeof t.cores.modelosNomes] ?? nome}
          </button>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────── O rosto em pixels ─────────────────────────────

export function EditorDePixels({ px, aoMudar, aoTracoFim, aoSortear, t }: { px: string; aoMudar: (px: string, traco: boolean) => void; aoTracoFim: () => void; aoSortear: () => void; t: TextosDoPerfilLivre }) {
  const [pincel, setPincel] = useState(3);
  const [espelhar, setEspelhar] = useState(true);
  const [foco, setFoco] = useState(27);
  const grade = useRef<HTMLDivElement>(null);
  const pintando = useRef(false);
  const atual = useRef(px);
  useEffect(() => {
    atual.current = px;
  }, [px]);
  const cheios = px.replace(/0/g, "").length;
  const nomes = t.rosto.cores;

  function pintar(i: number, traco: boolean) {
    const novo = pintarRosto(atual.current, i, pincel, espelhar);
    if (novo !== atual.current) {
      atual.current = novo;
      aoMudar(novo, traco);
    }
  }
  function celulaEm(e: PointerEvent): number | null {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-i]");
    return el && grade.current?.contains(el) ? Number(el.dataset.i) : null;
  }
  function teclar(e: KeyboardEvent) {
    const n = setas(e, foco, 64, LADO_DO_ROSTO);
    if (n !== null) {
      e.preventDefault();
      setFoco(n);
      grade.current?.querySelector<HTMLElement>(`[data-i="${n}"]`)?.focus();
      return;
    }
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      pintar(foco, false);
    } else if (/^[0-9]$/.test(e.key)) {
      setPincel(Number(e.key));
    }
  }

  return (
    <div className="pfe-pixels">
      <div
        ref={grade}
        role="grid"
        aria-label={t.rosto.grade}
        className="pfe-grade"
        onKeyDown={teclar}
        onPointerDown={(e) => {
          const i = celulaEm(e);
          if (i === null) return;
          e.preventDefault();
          pintando.current = true;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setFoco(i);
          pintar(i, true);
        }}
        onPointerMove={(e) => {
          if (!pintando.current) return;
          const i = celulaEm(e);
          if (i !== null) pintar(i, true);
        }}
        onPointerUp={() => {
          if (pintando.current) aoTracoFim();
          pintando.current = false;
        }}
        onPointerCancel={() => {
          if (pintando.current) aoTracoFim();
          pintando.current = false;
        }}
      >
        {Array.from({ length: LADO_DO_ROSTO }, (_, l) => (
          <div role="row" key={l} className="pfe-grade-linha">
            {Array.from({ length: LADO_DO_ROSTO }, (_, c) => {
              const i = l * LADO_DO_ROSTO + c;
              const d = Number(px[i]);
              return (
                <button
                  key={c}
                  type="button"
                  role="gridcell"
                  data-i={i}
                  tabIndex={i === foco ? 0 : -1}
                  aria-label={preencher(t.rosto.ladrilho, { l: l + 1, c: c + 1, cor: d === 0 ? t.rosto.vazio : nomes[d] })}
                  className="pfe-px"
                  style={{ background: d === 0 ? undefined : CORES_DO_ROSTO[d] }}
                  data-cheio={d === 0 ? undefined : ""}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="pfe-pixels-lado">
        <div role="radiogroup" aria-label={t.rosto.pincel} className="pfe-amostras pfe-amostras-p">
          {CORES_DO_ROSTO.map((cor, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={pincel === i}
              tabIndex={pincel === i ? 0 : -1}
              className={`pfe-amostra ${i === 0 ? "pfe-amostra-borracha" : ""}`}
              style={{ ["--c" as string]: cor || "transparent" }}
              title={`${nomes[i]} (${i})`}
              onClick={() => setPincel(i)}
              onKeyDown={(e) => {
                const n = setas(e, i, CORES_DO_ROSTO.length);
                if (n === null) return;
                e.preventDefault();
                setPincel(n);
                (e.currentTarget.parentElement?.querySelectorAll<HTMLElement>("[role=radio]")[n])?.focus();
              }}
            >
              <span className="sr-only">{nomes[i]}</span>
            </button>
          ))}
        </div>
        <label className="pfe-chave">
          <input type="checkbox" checked={espelhar} onChange={(e) => setEspelhar(e.target.checked)} />
          <span>{t.rosto.espelhar}</span>
        </label>
        <div className="pfe-linha-botoes">
          <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={aoSortear}>
            {t.rosto.sortear}
          </button>
          <button type="button" className="al-botao al-botao-fantasma al-botao-p" onClick={() => aoMudar("0".repeat(64), false)}>
            {t.rosto.limpar}
          </button>
        </div>
        {cheios < 6 ? (
          <p className="pfe-aviso" role="status">
            {t.rosto.poucos}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ───────────────────────────── As abas ─────────────────────────────

export function OrdemDasAbas({ abas, aoMudar, t }: { abas: readonly AbaDoPerfil[]; aoMudar: (a: AbaDoPerfil[]) => void; t: TextosDoPerfilLivre }) {
  const fora = ABAS_DO_PERFIL.filter((a) => !abas.includes(a));
  const lista = [...abas, ...fora];
  function mover(a: AbaDoPerfil, d: -1 | 1) {
    const i = abas.indexOf(a);
    const j = i + d;
    if (i < 0 || j < 0 || j >= abas.length) return;
    const nova = [...abas];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    comTransicao(() => aoMudar(nova));
    requestAnimationFrame(() => document.getElementById(`pfe-aba-${a}-${d < 0 ? "sobe" : "desce"}`)?.focus());
  }
  return (
    <div className="pfe-bloco">
      <h3 className="pfe-titulo">{t.abas.titulo}</h3>
      <p className="pfe-ajuda">{t.abas.ajuda}</p>
      <ol className="pfe-abas">
        {lista.map((a) => {
          const ligada = abas.includes(a);
          const i = abas.indexOf(a);
          const nome = t.abas.nomes[a];
          return (
            <li key={a} className="pfe-aba" data-ligada={ligada ? "" : undefined} style={{ viewTransitionName: `pfe-aba-${a}` }}>
              <label className="pfe-chave">
                <input
                  type="checkbox"
                  checked={ligada}
                  disabled={a === "posts"}
                  aria-label={preencher(t.abas.mostrar, { aba: nome })}
                  onChange={(e) => comTransicao(() => aoMudar(e.target.checked ? [...abas, a] : abas.filter((x) => x !== a)))}
                />
                <span>{nome}</span>
                {a === "posts" ? <small>{t.abas.sempre}</small> : null}
              </label>
              {ligada ? (
                <span className="pfe-abas-setas">
                  <button type="button" id={`pfe-aba-${a}-sobe`} className="pfe-icone" disabled={i === 0} aria-label={preencher(t.abas.subir, { aba: nome })} onClick={() => mover(a, -1)}>
                    <svg aria-hidden viewBox="0 0 16 16"><path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  </button>
                  <button type="button" id={`pfe-aba-${a}-desce`} className="pfe-icone" disabled={i === abas.length - 1} aria-label={preencher(t.abas.descer, { aba: nome })} onClick={() => mover(a, 1)}>
                    <svg aria-hidden viewBox="0 0 16 16"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  </button>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
