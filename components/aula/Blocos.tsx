// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { Fragment, type ReactNode, useEffect, useState } from "react";
import { L, useI18n } from "../I18n";

// Os blocos da aula-experiência: pedaços da aula que não são texto corrido. Quem escreve abre um bloco de código com o
// nome dele (```provocacao, ```navidareal, ```escondido, ```formula, ```historia, ```realidade, ```leve, ```roda) e
// escreve dentro em texto simples. O guia completo está em docs/MODELO-DE-AULA.md.

/** Negrito, itálico, código e links internos dentro de uma linha: o suficiente para os blocos, sem carregar outro leitor. */
function linha(texto: string, chave = 0): ReactNode[] {
  const partes: ReactNode[] = [];
  const padrao = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(\/[^)\s]*\))/g;
  let fim = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = padrao.exec(texto))) {
    if (m.index > fim) partes.push(texto.slice(fim, m.index));
    const p = m[0];
    const k = `${chave}-${i++}`;
    if (p.startsWith("**")) partes.push(<strong key={k}>{p.slice(2, -2)}</strong>);
    else if (p.startsWith("`")) partes.push(<code key={k}>{p.slice(1, -1)}</code>);
    else if (p.startsWith("[")) {
      const [, rotulo, href] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(p) ?? [];
      partes.push(
        <L key={k} href={href}>
          {rotulo}
        </L>,
      );
    } else partes.push(<em key={k}>{p.slice(1, -1)}</em>);
    fim = m.index + p.length;
  }
  if (fim < texto.length) partes.push(texto.slice(fim));
  return partes;
}

/** Parágrafos (linha em branco separa) e listas ("- " no começo da linha). */
export function TextoSimples({ texto, className = "" }: { texto: string; className?: string }) {
  const blocos = texto.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={className}>
      {blocos.map((bloco, i) => {
        const linhas = bloco.split("\n").map((l) => l.trim());
        if (linhas.every((l) => /^[-*] /.test(l)))
          return (
            <ul key={i} className="bloco-lista">
              {linhas.map((l, j) => (
                <li key={j}>{linha(l.slice(2), j)}</li>
              ))}
            </ul>
          );
        if (linhas.every((l) => /^\d+[.)] /.test(l)))
          return (
            <ol key={i} className="bloco-lista bloco-numerada">
              {linhas.map((l, j) => (
                <li key={j}>{linha(l.replace(/^\d+[.)] /, ""), j)}</li>
              ))}
            </ol>
          );
        return (
          <p key={i}>
            {linhas.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {linha(l, j)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/** "# Título" na primeira linha vira o título do bloco; o resto é o texto. */
function titulado(spec: string): { titulo: string; corpo: string } {
  const [primeira, ...resto] = spec.split("\n");
  return /^#\s+/.test(primeira ?? "") ? { titulo: primeira.replace(/^#\s+/, "").trim(), corpo: resto.join("\n").trim() } : { titulo: "", corpo: spec.trim() };
}

/** Um campo de texto que fica guardado só no aparelho, por aula e por bloco. */
function useGuardado(chave: string): [string, (v: string) => void] {
  const [valor, setValor] = useState("");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- o texto guardado só existe no navegador
      setValor(localStorage.getItem(chave) ?? "");
    } catch {
      // sem armazenamento
    }
  }, [chave]);
  const guardar = (v: string) => {
    setValor(v);
    try {
      if (v) localStorage.setItem(chave, v);
      else localStorage.removeItem(chave);
    } catch {
      // sem armazenamento: vale só enquanto a página está aberta
    }
  };
  return [valor, guardar];
}

const chaveDe = (pathname: string, tipo: string, spec: string) => {
  let h = 0;
  for (const c of spec) h = (h * 31 + c.charCodeAt(0)) | 0;
  return `lucia:bloco:${pathname.replace(/^\/[a-z]{2}(?=\/)/, "")}:${tipo}:${(h >>> 0).toString(36)}`;
};

/** A provocação que abre a aula: uma pergunta da vida de quem trabalha, para pensar antes de ler. */
export function Provocacao({ spec }: { spec: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [nota, setNota] = useGuardado(chaveDe(pathname, "provocacao", spec));
  const { titulo, corpo } = titulado(spec);
  return (
    <aside className="bloco bloco-provocacao">
      <p className="bloco-rotulo">{t.lesson.blocks.provocacao}</p>
      <TextoSimples texto={titulo || corpo} className="bloco-pergunta" />
      {titulo && corpo && <TextoSimples texto={corpo} className="bloco-texto" />}
      <label className="no-print mt-4 block font-sans text-sm text-ink-soft">
        {t.lesson.blocks.provocacaoPrompt}
        <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} maxLength={2000} className="bloco-campo" />
      </label>
    </aside>
  );
}

/** A caixa preta "Na vida real". */
export function NaVidaReal({ spec }: { spec: string }) {
  const { t } = useI18n();
  const { titulo, corpo } = titulado(spec);
  return (
    <aside className="bloco bloco-preto">
      <p className="bloco-rotulo">{titulo || t.lesson.blocks.navidareal}</p>
      <TextoSimples texto={corpo} className="bloco-texto" />
    </aside>
  );
}

/** "Por que isso te foi escondido": o que a escola e a mídia costumam deixar de fora, e a quem isso serve. */
export function Escondido({ spec }: { spec: string }) {
  const { t } = useI18n();
  const { titulo, corpo } = titulado(spec);
  return (
    <aside className="bloco bloco-escondido">
      <span aria-hidden className="bloco-carimbo">
        ★
      </span>
      <p className="bloco-rotulo">{t.lesson.blocks.escondido}</p>
      {titulo && <p className="bloco-titulo">{titulo}</p>}
      <TextoSimples texto={corpo} className="bloco-texto" />
    </aside>
  );
}

/** A fórmula (ou a regra) em destaque: a primeira linha grande, numa caixa com contorno; as outras, a legenda. */
export function Formula({ spec }: { spec: string }) {
  const { t } = useI18n();
  const [formula, ...legenda] = spec.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <figure className="bloco-formula" role="group" aria-label={`${t.lesson.blocks.formula}: ${spec.replace(/\n/g, ". ")}`}>
      <span className="bloco-formula-caixa">{formula}</span>
      {legenda.length > 0 && <figcaption className="bloco-formula-legenda">{legenda.join(" · ")}</figcaption>}
    </figure>
  );
}

/** Uma história de luta ligada ao conteúdo: o caso concreto, com data e lugar no título. */
export function Historia({ spec }: { spec: string }) {
  const { t } = useI18n();
  const { titulo, corpo } = titulado(spec);
  return (
    <aside className="bloco bloco-historia">
      <p className="bloco-rotulo">
        <span className="bloco-tarja">★ {t.lesson.blocks.historia}</span>
      </p>
      {titulo && <p className="bloco-titulo">{titulo}</p>}
      <TextoSimples texto={corpo} className="bloco-texto" />
    </aside>
  );
}

/** Um exercício que mexe com a realidade de quem estuda: a pergunta e um espaço para responder, guardado no aparelho. */
export function Realidade({ spec }: { spec: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [resposta, setResposta] = useGuardado(chaveDe(pathname, "realidade", spec));
  const { titulo, corpo } = titulado(spec);
  return (
    <aside className="bloco bloco-realidade">
      <p className="bloco-rotulo">{titulo || t.lesson.blocks.realidade}</p>
      <TextoSimples texto={corpo} className="bloco-texto" />
      <label className="no-print mt-3 block font-sans text-sm text-ink-soft">
        {t.lesson.blocks.realidadePrompt}
        <textarea value={resposta} onChange={(e) => setResposta(e.target.value)} rows={3} maxLength={4000} className="bloco-campo" />
      </label>
    </aside>
  );
}

/** Leve para a sua comunidade: como ensinar isso a outra pessoa, em casa, no trabalho, no bairro. */
export function Leve({ spec }: { spec: string }) {
  const { t } = useI18n();
  const { titulo, corpo } = titulado(spec);
  return (
    <aside className="bloco bloco-leve">
      <p className="bloco-rotulo">{titulo || t.lesson.blocks.leve}</p>
      <TextoSimples texto={corpo} className="bloco-texto" />
    </aside>
  );
}

/** Perguntas para discutir na sala da disciplina, com o caminho direto para ela. */
export function Roda({ spec, sala }: { spec: string; sala?: string }) {
  const { t } = useI18n();
  const { titulo, corpo } = titulado(spec);
  return (
    <aside className="bloco bloco-roda">
      <p className="bloco-rotulo">{titulo || t.lesson.blocks.roda}</p>
      <TextoSimples texto={corpo} className="bloco-texto" />
      <p className="no-print mt-3 font-sans text-sm font-bold">
        <L href={sala ? `/comunidade?sala=${sala}` : "/comunidade"}>{t.lesson.blocks.rodaLink} →</L>
      </p>
    </aside>
  );
}

export const BLOCOS_DA_AULA = ["provocacao", "navidareal", "escondido", "formula", "historia", "realidade", "leve", "roda"] as const;
