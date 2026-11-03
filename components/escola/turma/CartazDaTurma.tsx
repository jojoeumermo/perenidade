// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { Cartaz } from "@/components/Cartaz";
import Link from "@/components/Link";
import { fill, type Locale, localePath } from "@/i18n/config";
import type { TextosDaTurma } from "@/i18n/escola/turma";
import {
  frasesDoCartaz,
  MAX_FRASE,
  MAX_FRASES,
  pareceNomeCompleto,
  semestreDoCartaz,
} from "@/lib/escola/turma-do-curso";

type S = TextosDaTurma["cartaz"];

// As cores do Caderno do Povo (app/globals.css), as mesmas do cartaz na tela.
const PAPEL = "#fbf7ec";
const TINTA = "#1c1712";
const PRELO = "#c21f16";
const CINZA = "#5c5245";

const hojeAqui = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

/** Quebra um texto em linhas que cabem na largura (chinês, sem espaço, quebra por caractere). */
function linhas(
  ctx: CanvasRenderingContext2D,
  texto: string,
  largura: number,
): string[] {
  const saida: string[] = [];
  const pedacos = /\s/.test(texto) ? texto.split(/(\s+)/) : [...texto];
  let atual = "";
  for (const p of pedacos) {
    const teste = atual + p;
    if (ctx.measureText(teste.trim()).width > largura && atual.trim()) {
      saida.push(atual.trim());
      atual = p.trimStart();
    } else atual = teste;
  }
  if (atual.trim()) saida.push(atual.trim());
  return saida;
}

const fonteDe = (seletor: string, reserva: string) => {
  const el = document.querySelector(seletor);
  return el ? getComputedStyle(el).fontFamily || reserva : reserva;
};

/** O cartaz em PNG (1600 x 2263, a proporção do A4), desenhado no aparelho. */
async function desenhar(
  titulo: string,
  olho: string,
  slogan: string,
  frases: string[],
  rodape: string,
): Promise<Blob> {
  await document.fonts?.ready;
  const L = 1600;
  const A = 2263;
  const M = 110;
  const canvas = document.createElement("canvas");
  canvas.width = L;
  canvas.height = A;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("sem canvas");
  const sans = fonteDe(
    "[data-cartaz-folha] .jornal-cartaz-nome",
    "system-ui, sans-serif",
  );
  const serif = fonteDe("[data-cartaz-folha] .cartaz-frase", "Georgia, serif");
  ctx.fillStyle = PAPEL;
  ctx.fillRect(0, 0, L, A);
  ctx.textBaseline = "top";
  ctx.fillStyle = CINZA;
  ctx.font = `500 30px ${sans}`;
  ctx.fillText(slogan.toUpperCase(), M, M, (L - 2 * M) / 2);
  const larguraOlho = ctx.measureText(olho.toUpperCase()).width;
  ctx.fillText(
    olho.toUpperCase(),
    Math.max(M, L - M - larguraOlho),
    M,
    L - 2 * M,
  );
  // A faixa vermelha com o título em letra pesada.
  const yFaixa = M + 60;
  ctx.font = `italic 900 120px ${sans}`;
  const tituloLinhas = linhas(ctx, titulo.toUpperCase(), L - 2 * M - 80);
  const altFaixa = 80 + tituloLinhas.length * 118;
  ctx.fillStyle = PRELO;
  ctx.fillRect(M, yFaixa, L - 2 * M, altFaixa);
  ctx.strokeStyle = TINTA;
  ctx.lineWidth = 6;
  ctx.strokeRect(M, yFaixa, L - 2 * M, altFaixa);
  ctx.fillStyle = "#ffffff";
  tituloLinhas.forEach((l, i) =>
    ctx.fillText(l, M + 40, yFaixa + 44 + i * 118, L - 2 * M - 80),
  );
  // O fio duplo.
  const yFio = yFaixa + altFaixa + 24;
  ctx.fillStyle = TINTA;
  ctx.fillRect(M, yFio, L - 2 * M, 6);
  ctx.fillRect(M, yFio + 12, L - 2 * M, 2);
  // As frases, em duas colunas, com aspas e o fio vermelho da margem.
  const colunas = frases.length > 8 ? 2 : 1;
  const largura = (L - 2 * M - (colunas - 1) * 60) / colunas;
  const tamanho = frases.length > 16 ? 30 : frases.length > 8 ? 36 : 44;
  ctx.font = `400 ${tamanho}px ${serif}`;
  const porColuna = Math.ceil(frases.length / colunas);
  for (let c = 0; c < colunas; c++) {
    let y = yFio + 70;
    for (const frase of frases.slice(c * porColuna, (c + 1) * porColuna)) {
      const x = M + c * (largura + 60);
      const ls = linhas(ctx, `“${frase}”`, largura - 30);
      const alt = ls.length * tamanho * 1.3;
      if (y + alt > A - M - 80) break;
      ctx.fillStyle = PRELO;
      ctx.fillRect(x, y, 6, alt - tamanho * 0.3);
      ctx.fillStyle = TINTA;
      ls.forEach((l, i) =>
        ctx.fillText(l, x + 30, y + i * tamanho * 1.3, largura - 30),
      );
      y += alt + tamanho * 0.9;
    }
  }
  ctx.fillStyle = CINZA;
  ctx.font = `500 28px ${sans}`;
  ctx.fillText(rodape, M, A - M - 30, L - 2 * M);
  return new Promise((ok, falha) =>
    canvas.toBlob(
      (b) => (b ? ok(b) : falha(new Error("sem imagem"))),
      "image/png",
    ),
  );
}

/**
 * O cartaz coletivo da turma que se forma (R1-68), com o componente Cartaz do site: o curso no título, o semestre e uma
 * frase de cada pessoa, digitada por quem facilita. Nenhum nome completo (um aviso aparece quando a frase parece ter
 * um). Tudo no aparelho e só na memória da página. Exporta PNG (canvas) e PDF (a impressão do navegador). Nada é
 * publicado: para ir à Galeria, a pessoa envia pela Gaveta Aberta e a coordenação acrescenta.
 */
export function CartazDaTurma({
  cursos,
  s,
  lang,
  marca,
}: {
  cursos: { slug: string; titulo: string }[];
  s: S;
  lang: Locale;
  marca: string;
}) {
  const [curso, setCurso] = useState("");
  const [semestre, setSemestre] = useState("");
  const [frase, setFrase] = useState("");
  const [frases, setFrases] = useState<string[]>([]);
  const [estado, setEstado] = useState<"livre" | "gerando" | "falhou">("livre");

  useEffect(() => {
    const id = window.setTimeout(
      () => setSemestre((v) => v || semestreDoCartaz(hojeAqui())),
      0,
    );
    return () => window.clearTimeout(id);
  }, []);

  const titulo = cursos.find((c) => c.slug === curso)?.titulo ?? "";
  const olho = fill(s.formatura, { semestre: semestre || "…" });

  async function baixarPng() {
    setEstado("gerando");
    try {
      const blob = await desenhar(titulo, olho, s.slogan, frases, marca);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${s.nomeDoArquivo}-${curso}-${semestre.replace(".", "-")}.png`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setEstado("livre");
    } catch {
      setEstado("falhou");
    }
  }

  return (
    <div className="cartaz-montador">
      <div className="banca-campos no-print">
        <label className="block">
          <span className="turma-rotulo-campo">{s.curso}</span>
          <select
            className="turma-input"
            value={curso}
            onChange={(e) => setCurso(e.target.value)}
            data-cartaz-curso=""
          >
            <option value="">{s.escolhaCurso}</option>
            {cursos.map((c) => (
              <option key={c.slug} value={c.slug} lang="pt">
                {c.titulo}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="turma-rotulo-campo">{s.semestre}</span>
          <input
            className="turma-input"
            value={semestre}
            maxLength={6}
            pattern="\d{4}\.[12]"
            onChange={(e) => setSemestre(e.target.value.replace(/[^\d.]/g, ""))}
          />
        </label>
      </div>

      <form
        className="circulo-campo no-print"
        onSubmit={(e) => {
          e.preventDefault();
          if (!frase.trim()) return;
          setFrases((lista) => frasesDoCartaz([...lista, frase]));
          setFrase("");
        }}
      >
        <label className="block w-full">
          <span className="turma-rotulo-campo">{s.frase}</span>
          <input
            className="turma-input"
            value={frase}
            maxLength={MAX_FRASE}
            onChange={(e) => setFrase(e.target.value)}
            data-cartaz-frase-campo=""
          />
        </label>
        <button
          type="submit"
          className="botao botao-tinta"
          disabled={frases.length >= MAX_FRASES}
        >
          {s.acrescentar}
        </button>
      </form>
      {frase && pareceNomeCompleto(frase) && (
        <p className="turma-aviso no-print" role="status">
          {s.avisoNome}
        </p>
      )}
      <p className="turma-nota no-print">
        {fill(s.limite, { n: frases.length, max: MAX_FRASES })}
      </p>

      {/* A folha: o que a impressão mostra (styles/escola-turma.css esconde o resto ao imprimir). */}
      <article
        className="cartaz-folha"
        data-cartaz-folha=""
        aria-label={s.titulo}
      >
        {titulo ? (
          <Cartaz eyebrow={olho} title={titulo} slogan={s.slogan} />
        ) : (
          <p className="turma-nota">{s.escolhaCurso}</p>
        )}
        {frases.length ? (
          <ol className="cartaz-frases">
            {frases.map((f, i) => (
              <li key={f} className="cartaz-frase">
                <span>“{f}”</span>
                <button
                  type="button"
                  className="circulo-tirar no-print"
                  aria-label={fill(s.tirar, { n: i + 1 })}
                  onClick={() =>
                    setFrases((lista) => lista.filter((x) => x !== f))
                  }
                >
                  ×
                </button>
                {pareceNomeCompleto(f) && (
                  <span className="cartaz-aviso-nome no-print">
                    {s.avisoNome}
                  </span>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="turma-nota">{s.vazio}</p>
        )}
        <p className="cartaz-rodape">{marca}</p>
      </article>

      <div className="turma-botoes no-print">
        <button
          type="button"
          className="botao botao-tinta"
          onClick={() => void baixarPng()}
          disabled={!titulo || frases.length === 0 || estado === "gerando"}
          aria-busy={estado === "gerando"}
          data-cartaz-png=""
        >
          {estado === "gerando" ? s.gerando : s.baixarPng}
        </button>
        <button
          type="button"
          className="botao"
          onClick={() => window.print()}
          disabled={!titulo || frases.length === 0}
          data-cartaz-pdf=""
        >
          {s.imprimir}
        </button>
      </div>
      <p className="turma-nota text-sm no-print">{s.imprimirDica}</p>
      <p role="status" className="turma-aviso no-print">
        {estado === "falhou" ? s.falhou : ""}
      </p>

      <section
        className="turma-bloco no-print"
        aria-labelledby="cartaz-galeria"
      >
        <h2 id="cartaz-galeria" className="turma-bloco-titulo">
          {s.galeriaTitulo}
        </h2>
        <p className="turma-bloco-texto">{s.galeriaTexto}</p>
        <Link href={localePath(lang, "/gaveta")} className="botao mt-3">
          {s.gaveta}
        </Link>
      </section>
    </div>
  );
}
