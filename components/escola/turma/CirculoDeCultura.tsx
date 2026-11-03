// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import Link from "@/components/Link";
import { fill, type Locale, localePath } from "@/i18n/config";
import type { TextosDaTurma } from "@/i18n/escola/turma";
import {
  apagarCirculo,
  CHAVE_DOS_CIRCULOS,
  type Circulo,
  guardarCirculo,
  lerCirculos,
  listaLimpa,
  MAX_CIRCULOS,
  MAX_PALAVRA,
  MAX_PALAVRAS,
  MAX_PERGUNTA,
  MAX_PERGUNTAS,
  MAX_TEMA,
  novoCirculo,
  sequenciaDoCirculo,
} from "@/lib/escola/turma-do-curso";
import type { SearchEntry, SearchHit } from "@/lib/search";
import { codificarSequencia, MAX_AULAS } from "@/lib/turma";

type S = TextosDaTurma["circulo"];

const hojeAqui = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

function lerGuardados(): Circulo[] {
  try {
    return lerCirculos(localStorage.getItem(CHAVE_DOS_CIRCULOS));
  } catch {
    return [];
  }
}

function gravar(lista: Circulo[]): boolean {
  try {
    if (lista.length)
      localStorage.setItem(CHAVE_DOS_CIRCULOS, JSON.stringify(lista));
    else localStorage.removeItem(CHAVE_DOS_CIRCULOS);
    window.dispatchEvent(new Event("lucia:estudo"));
    return true;
  } catch {
    return false;
  }
}

type Buscador = (consulta: string, limite?: number) => SearchHit[];
let buscador: Promise<Buscador> | null = null;
/** O índice leve do site (/<idioma>/indice-leve.json) e o mesmo motor da busca, montados uma vez por página aberta. */
function carregarBuscador(lang: Locale): Promise<Buscador> {
  buscador ??= Promise.all([
    fetch(localePath(lang, "/indice-leve.json")).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<SearchEntry[]>;
    }),
    import("@/lib/search"),
    import("@/content/busca.json"),
  ]).then(([entradas, { buildSearch }, sinonimos]) =>
    buildSearch(
      entradas.filter((e) => e.kind === "aula"),
      (sinonimos as { default?: Record<string, string> }).default ??
        (sinonimos as unknown as Record<string, string>),
    ),
  );
  buscador.catch(() => {
    buscador = null;
  });
  return buscador;
}

/** "/trilhas/<trilha>/<aula>" → "trilha/aula" (ou null). */
const idDaAula = (href: string) =>
  /^\/trilhas\/([a-z0-9-]+)\/([a-z0-9-]+)$/.exec(href)?.slice(1).join("/") ??
  null;

function Passo({
  n,
  titulo,
  texto,
  s,
  children,
}: {
  n: number;
  titulo: string;
  texto: string;
  s: S;
  children: React.ReactNode;
}) {
  return (
    <section
      className="circulo-passo"
      aria-labelledby={`circulo-passo-${n}`}
      data-passo={n}
    >
      <p className="rotulo">{fill(s.passo, { n })}</p>
      <h2 id={`circulo-passo-${n}`} className="turma-bloco-titulo">
        {titulo}
      </h2>
      <p className="turma-bloco-texto">{texto}</p>
      {children}
    </section>
  );
}

/**
 * O círculo de cultura digital (D1-18): a ferramenta de quem facilita o encontro, toda neste aparelho, em 5 passos.
 * As palavras, o tema, as perguntas e as aulas ficam em "lucia:escola:circulos" (até 10 círculos, apagáveis); nada vai
 * ao servidor. A sequência vira um link do modo turma (lib/turma.ts, com a sequência depois do "#") com QR.
 */
export function CirculoDeCultura({ s, lang }: { s: S; lang: Locale }) {
  const [guardados, setGuardados] = useState<Circulo[]>([]);
  const [atual, setAtual] = useState<Circulo>(() => novoCirculo("2000-01-01"));
  const [palavra, setPalavra] = useState("");
  const [pergunta, setPergunta] = useState("");
  const [busca, setBusca] = useState<{
    estado: "parado" | "carregando" | "falhou" | "pronto";
    achadas: SearchHit[];
  }>({ estado: "parado", achadas: [] });
  const [link, setLink] = useState("");
  const [qr, setQr] = useState("");
  const [titulos, setTitulos] = useState<Record<string, string>>({});

  // Começa no aparelho: lê os círculos guardados e põe a data de hoje no círculo novo.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setGuardados(lerGuardados());
      setAtual((c) => ({ ...c, data: hojeAqui() }));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  /** Muda o círculo aberto e guarda no aparelho (o tema fica como digitado; palavras e perguntas, sem repetir). */
  function mudar(muda: (c: Circulo) => Circulo) {
    setLink("");
    const mudado = muda(atual);
    const novo = {
      ...mudado,
      palavras: listaLimpa(mudado.palavras, MAX_PALAVRAS, MAX_PALAVRA),
      perguntas: listaLimpa(mudado.perguntas, MAX_PERGUNTAS, MAX_PERGUNTA),
    };
    setAtual(novo);
    const lista = guardarCirculo(lerGuardados(), novo);
    if (gravar(lista)) setGuardados(lista);
  }

  const sequencia = useMemo(
    () => sequenciaDoCirculo(atual.tema, atual.aulas),
    [atual.tema, atual.aulas],
  );

  useEffect(() => {
    if (!link) return;
    let vivo = true;
    import("qrcode")
      .then((q) =>
        q.toDataURL(link, {
          errorCorrectionLevel: "L",
          margin: 1,
          width: 240,
          color: { dark: "#1f1a14", light: "#ffffff" },
        }),
      )
      .then((url) => vivo && setQr(url))
      .catch(() => vivo && setQr(""));
    return () => {
      vivo = false;
    };
  }, [link]);

  async function buscar() {
    if (!atual.tema) return;
    setBusca({ estado: "carregando", achadas: [] });
    try {
      const procurar = await carregarBuscador(lang);
      const achadas = procurar(atual.tema, 20).filter((h) =>
        idDaAula(h.entry.href),
      );
      setTitulos((t) => ({
        ...t,
        ...Object.fromEntries(
          achadas.map((h) => [idDaAula(h.entry.href)!, h.entry.title]),
        ),
      }));
      setBusca({ estado: "pronto", achadas });
    } catch {
      setBusca({ estado: "falhou", achadas: [] });
    }
  }

  function gerarLink() {
    if (!sequencia) return;
    setLink(
      `${window.location.origin}${localePath(lang, "/turma")}#${codificarSequencia(sequencia)}`,
    );
  }

  const pedido = fill(s.p5Modelo, { tema: atual.tema || "…" });
  const semAula = busca.estado === "pronto" && busca.achadas.length === 0;

  return (
    <div className="circulo" data-circulo="">
      <Passo n={1} titulo={s.p1Titulo} texto={s.p1Texto} s={s}>
        <form
          className="circulo-campo"
          onSubmit={(e) => {
            e.preventDefault();
            if (!palavra.trim()) return;
            mudar((c) => ({
              ...c,
              palavras: [...c.palavras, palavra].slice(0, MAX_PALAVRAS),
            }));
            setPalavra("");
          }}
        >
          <label className="block w-full">
            <span className="turma-rotulo-campo">{s.p1Campo}</span>
            <input
              className="turma-input"
              value={palavra}
              maxLength={MAX_PALAVRA}
              onChange={(e) => setPalavra(e.target.value)}
              data-circulo-palavra=""
            />
          </label>
          <button
            type="submit"
            className="botao botao-tinta"
            disabled={atual.palavras.length >= MAX_PALAVRAS}
          >
            {s.p1Acrescentar}
          </button>
        </form>
        {atual.palavras.length ? (
          <ul className="circulo-palavras" data-circulo-palavras="">
            {atual.palavras.map((p) => (
              <li key={p}>
                <span>{p}</span>
                <button
                  type="button"
                  className="circulo-tirar"
                  aria-label={fill(s.p1Tirar, { palavra: p })}
                  onClick={() =>
                    mudar((c) => ({
                      ...c,
                      palavras: c.palavras.filter((x) => x !== p),
                    }))
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="turma-nota">{s.p1Vazio}</p>
        )}
      </Passo>

      <Passo n={2} titulo={s.p2Titulo} texto={s.p2Texto} s={s}>
        {atual.palavras.length > 0 && (
          <ul className="circulo-sugestoes">
            {atual.palavras.map((p) => (
              <li key={p}>
                <button
                  type="button"
                  className="circulo-chip"
                  onClick={() => mudar((c) => ({ ...c, tema: p }))}
                >
                  {fill(s.p2Usar, { palavra: p })}
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="mt-3 block">
          <span className="turma-rotulo-campo">{s.p2Campo}</span>
          <input
            className="turma-input"
            value={atual.tema}
            maxLength={MAX_TEMA}
            onChange={(e) => mudar((c) => ({ ...c, tema: e.target.value }))}
            data-circulo-tema=""
          />
        </label>
      </Passo>

      <Passo n={3} titulo={s.p3Titulo} texto={s.p3Texto} s={s}>
        <ul className="turma-roteiro">
          {s.p3Guias.map((g) => (
            <li key={g}>{g}</li>
          ))}
          {atual.perguntas.map((p) => (
            <li key={p} className="circulo-pergunta-propria">
              <span>{p}</span>{" "}
              <button
                type="button"
                className="circulo-tirar"
                aria-label={fill(s.p1Tirar, { palavra: p })}
                onClick={() =>
                  mudar((c) => ({
                    ...c,
                    perguntas: c.perguntas.filter((x) => x !== p),
                  }))
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <form
          className="circulo-campo"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pergunta.trim()) return;
            mudar((c) => ({
              ...c,
              perguntas: [...c.perguntas, pergunta].slice(0, MAX_PERGUNTAS),
            }));
            setPergunta("");
          }}
        >
          <label className="block w-full">
            <span className="turma-rotulo-campo">{s.p3Campo}</span>
            <input
              className="turma-input"
              value={pergunta}
              maxLength={MAX_PERGUNTA}
              onChange={(e) => setPergunta(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="botao"
            disabled={atual.perguntas.length >= MAX_PERGUNTAS}
          >
            {s.p3Acrescentar}
          </button>
        </form>
      </Passo>

      <Passo n={4} titulo={s.p4Titulo} texto={s.p4Texto} s={s}>
        {!atual.tema ? (
          <p className="turma-nota">{s.semTema}</p>
        ) : (
          <button
            type="button"
            className="botao botao-tinta"
            onClick={() => void buscar()}
            disabled={busca.estado === "carregando"}
            data-circulo-buscar=""
          >
            {s.p4Buscar}
          </button>
        )}
        <p role="status" className="turma-nota">
          {busca.estado === "carregando"
            ? s.p4Carregando
            : busca.estado === "falhou"
              ? s.p4Falhou
              : semAula
                ? s.p4Nada
                : ""}
        </p>
        {busca.achadas.length > 0 && (
          <ul className="circulo-achadas" data-circulo-achadas="">
            {busca.achadas.map((h) => {
              const id = idDaAula(h.entry.href)!;
              const dentro = atual.aulas.includes(id);
              return (
                <li key={id}>
                  <span className="min-w-0">
                    <span className="font-semibold">{h.entry.title}</span>
                    <span className="block text-sm text-ink-soft">
                      {h.entry.context}
                    </span>
                  </span>
                  <button
                    type="button"
                    className={dentro ? "botao" : "botao botao-tinta"}
                    disabled={!dentro && atual.aulas.length >= MAX_AULAS}
                    onClick={() =>
                      mudar((c) => ({
                        ...c,
                        aulas: dentro
                          ? c.aulas.filter((a) => a !== id)
                          : [...c.aulas, id],
                      }))
                    }
                    aria-pressed={dentro}
                  >
                    {dentro ? s.p4Tirar : s.p4Escolher}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {atual.aulas.length > 0 && (
          <div className="circulo-sequencia">
            <p className="font-semibold">
              {fill(s.p4Escolhidas, { n: atual.aulas.length, max: MAX_AULAS })}
            </p>
            <ol className="turma-roteiro">
              {atual.aulas.map((id) => (
                <li key={id}>
                  {titulos[id] ?? id}{" "}
                  <button
                    type="button"
                    className="circulo-tirar"
                    aria-label={s.p4Tirar}
                    onClick={() =>
                      mudar((c) => ({
                        ...c,
                        aulas: c.aulas.filter((a) => a !== id),
                      }))
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="botao botao-tinta mt-3"
              onClick={gerarLink}
              disabled={!sequencia}
              data-circulo-gerar=""
            >
              {s.p4Gerar}
            </button>
          </div>
        )}
        {link && (
          <div className="circulo-link" data-circulo-link="">
            <label className="block">
              <span className="turma-rotulo-campo">{s.p4Link}</span>
              <input
                className="turma-input font-mono text-xs"
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
              />
            </label>
            <p className="mt-2 flex flex-wrap gap-4">
              <CopyButton text={link} label={s.copiar} done={s.copiado} />
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-oxblood"
              >
                {s.p4Abrir}
              </a>
            </p>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element -- imagem gerada no aparelho (data:)
              <img
                src={qr}
                alt={s.p4Qr}
                width={240}
                height={240}
                className="mt-3 border border-rule bg-white p-1"
              />
            )}
          </div>
        )}
      </Passo>

      <Passo n={5} titulo={s.p5Titulo} texto={s.p5Texto} s={s}>
        <p className="circulo-pedido" data-circulo-pedido="">
          {pedido}
        </p>
        <p className="mt-3 flex flex-wrap items-center gap-4">
          <Link
            href={localePath(lang, "/contribuir")}
            className="botao botao-tinta"
          >
            {s.p5Pedir}
          </Link>
          {atual.tema && (
            <CopyButton text={pedido} label={s.copiar} done={s.copiado} />
          )}
        </p>
      </Passo>

      <section
        className="turma-bloco"
        aria-labelledby="circulos-guardados"
        data-circulos-guardados=""
      >
        <h2 id="circulos-guardados" className="turma-bloco-titulo">
          {s.guardadosTitulo}
        </h2>
        <p className="turma-bloco-texto">
          {fill(s.guardadosTexto, { max: MAX_CIRCULOS })}
        </p>
        <p className="mt-3">
          <button
            type="button"
            className="botao"
            onClick={() => {
              setLink("");
              setBusca({ estado: "parado", achadas: [] });
              setAtual(novoCirculo(hojeAqui()));
            }}
          >
            {s.novo}
          </button>
        </p>
        {guardados.length > 0 && (
          <>
            <ul className="turma-lista">
              {[...guardados].reverse().map((c) => (
                <li key={c.id} className="circulo-guardado">
                  <span className="min-w-0">
                    <span className="font-semibold">
                      {c.tema || s.semTitulo}
                    </span>{" "}
                    <span className="text-sm text-ink-soft">· {c.data}</span>
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      className="botao"
                      onClick={() => {
                        setLink("");
                        setBusca({ estado: "parado", achadas: [] });
                        setAtual(c);
                      }}
                    >
                      {s.abrir}
                    </button>
                    <button
                      type="button"
                      className="botao"
                      onClick={() => {
                        const lista = apagarCirculo(guardados, c.id);
                        if (gravar(lista)) setGuardados(lista);
                        if (atual.id === c.id)
                          setAtual(novoCirculo(hojeAqui()));
                      }}
                    >
                      {s.apagar}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3">
              <button
                type="button"
                className="botao"
                data-circulos-apagar-tudo=""
                onClick={() => {
                  if (gravar([])) setGuardados([]);
                  setLink("");
                  setAtual(novoCirculo(hojeAqui()));
                }}
              >
                {s.apagarTudo}
              </button>
            </p>
          </>
        )}
        <p className="turma-nota text-sm">{s.guardado}</p>
      </section>
    </div>
  );
}
