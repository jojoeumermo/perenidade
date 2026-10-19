// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { getItem, setItem } from "@/lib/storage";
import type { TrackOption } from "../useTrackOptions";

/**
 * Ferramentas de apoio a quem escreve a aula, todas no navegador e sem IA: contador de palavras e tempo de leitura,
 * medidor de legibilidade (índice de Flesch adaptado ao português por Martins et al.), checklist viva (o que dá para
 * conferir sozinho é marcado sozinho), detector de jargão com lista por trilha, aviso de pré-requisito (tema de aula
 * que vem depois no roteiro) e o assistente de roteiro (quatro perguntas que montam o esqueleto da aula).
 */

const rotulo = "font-mono text-xs uppercase tracking-widest text-gold";
const botao = "cursor-pointer bg-ink px-4 py-2 font-medium text-parchment hover:bg-oxblood";
const campo = "mt-1 w-full border border-rule bg-parchment px-2 py-1.5";

/** Só a prosa: sem blocos de código, fórmulas, links, imagens e marcações. */
export function prosa(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\$[^$\n]+\$/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/^:::.*$/gm, " ")
    .replace(/[#>*_`|~-]/g, " ");
}

const silabas = (palavra: string) => Math.max(1, (palavra.toLowerCase().match(/[aeiouáéíóúâêôãõàü]+/g) ?? []).length);

export function legibilidade(md: string) {
  const texto = prosa(md);
  const frases = texto.split(/[.!?…]+(?:\s|$)/).map((f) => f.trim()).filter((f) => /\p{L}/u.test(f));
  const palavras = texto.match(/\p{L}+(?:['-]\p{L}+)*/gu) ?? [];
  if (!frases.length || !palavras.length) return null;
  const porFrase = palavras.length / frases.length;
  const silabasPorPalavra = palavras.reduce((n, p) => n + silabas(p), 0) / palavras.length;
  const longas = palavras.filter((p) => silabas(p) >= 4).length / palavras.length;
  // Flesch adaptado ao português (Martins, Ghiraldelo, Nunes e Oliveira Jr., 1996).
  const indice = Math.max(0, Math.min(100, 248.835 - 1.015 * porFrase - 84.6 * silabasPorPalavra));
  return { palavras: palavras.length, frases: frases.length, porFrase, longas, indice };
}

const FAIXAS: [number, string, string][] = [
  [75, "muito fácil", "anos iniciais do fundamental"],
  [50, "fácil", "anos finais do fundamental"],
  [25, "difícil", "ensino médio e superior"],
  [0, "muito difícil", "texto acadêmico"],
];
const META: Record<string, number> = { fundamental: 60, medio: 45, superior: 30 };
const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const VAZIAS = new Set(["de", "da", "do", "das", "dos", "e", "o", "a", "os", "as", "em", "no", "na", "um", "uma", "para", "por", "com", "que", "como", "se", "ao", "the", "and", "of"]);

export function FerramentasDoAutor({ titulo, corpo, questoes, fontes, trilha, slug, inserir }: { titulo: string; corpo: string; questoes: number; fontes: number; trilha?: TrackOption; slug: string; inserir: (texto: string) => void }) {
  const [aberto, setAberto] = useState(true);
  const [manuais, setManuais] = useState<Record<string, boolean>>({});
  const chaveJargao = `lucia:jargao:${trilha?.slug ?? "geral"}`;
  const [jargao, setJargao] = useState(() => getItem(chaveJargao));
  const [roteiro, setRoteiro] = useState({ final: "", erro: "", exemplo: "", antes: "" });

  const leitura = legibilidade(corpo);
  const minutos = leitura ? Math.max(1, Math.round(leitura.palavras / 200)) : 0;
  const faixa = leitura ? FAIXAS.find(([min]) => leitura.indice >= min) : undefined;
  const meta = trilha?.stage ? META[trilha.stage] : undefined;

  const texto = normalizar(prosa(corpo));
  const primeiro = corpo.trim().split(/\n\s*\n/)[0] ?? "";
  const imagens = [...corpo.matchAll(/!\[([^\]]*)\]\([^)]*\)/g)];
  const automaticos: [string, string, boolean][] = [
    ["abertura", "Abre dizendo o que a pessoa vai aprender", /aprender|nesta aula|voce vai|ao final/.test(normalizar(primeiro)) && !primeiro.trim().startsWith("#")],
    ["exemplo", "Tem pelo menos um exemplo", /por exemplo|exemplo|imagine|pense em/.test(texto)],
    ["teste", "Tem teste no final (três questões)", questoes >= 3 || /:::questao|:::pergunta/.test(corpo)],
    ["alt", "Toda imagem tem texto alternativo", imagens.every((m) => m[1].trim().length >= 3)],
    ["titulo", "Título com até 80 caracteres", titulo.trim().length > 0 && titulo.trim().length <= 80],
    ["fontes", "Cita pelo menos uma fonte", fontes > 0],
  ];
  const aMao: [string, string][] = [
    ["legenda", "Vídeos têm legenda ou transcrição"],
    ["contraste", "Imagens e tabelas legíveis no tema escuro e no celular"],
    ["titulos", "Títulos em ordem (título, depois subtítulo)"],
    ["linguagem", "Linguagem de quem conversa, sem jargão sem explicação"],
  ];

  // Jargão: termo da lista usado sem explicação por perto ("ou seja", "isto é", dois-pontos ou parênteses logo depois).
  const termos = jargao.split(/[,;\n]/).map((t) => t.trim()).filter((t) => t.length >= 2).slice(0, 80);
  const semExplicacao = termos.filter((termo) => {
    const alvo = normalizar(termo);
    const i = texto.indexOf(alvo);
    if (i < 0) return false;
    const depois = normalizar(corpo).slice(normalizar(corpo).indexOf(alvo) + alvo.length, normalizar(corpo).indexOf(alvo) + alvo.length + 60);
    return !/^\s*(\(|:|,?\s*ou seja|,?\s*isto e|,?\s*que e|,?\s*quer dizer|,?\s*significa|\s*e\s+(o|a|um|uma)\s)/.test(depois);
  });

  // Pré-requisito: o tema de uma aula que vem depois no roteiro aparece no texto.
  const plano = trilha?.plan ?? [];
  const posicao = slug ? plano.findIndex((item) => item.slug === slug) : -1;
  const adiante = posicao >= 0 ? plano.slice(posicao + 1) : [];
  const avisos = adiante
    .map((item, k) => {
      const chave = normalizar(item.title).split(/[^a-z0-9]+/).filter((p) => p.length > 4 && !VAZIAS.has(p));
      const achadas = chave.filter((p) => texto.includes(p));
      return chave.length && achadas.length >= Math.min(2, chave.length) ? { titulo: item.title, numero: posicao + k + 2 } : null;
    })
    .filter((x): x is { titulo: string; numero: number } => Boolean(x))
    .slice(0, 3);

  function montarEsqueleto() {
    const r = roteiro;
    const partes = [
      "## O que você vai aprender",
      r.final ? `Ao final desta aula, você vai conseguir ${r.final.replace(/\.$/, "")}.` : "Ao final desta aula, você vai conseguir…",
      r.antes ? `Antes de começar, é bom saber: ${r.antes.replace(/\.$/, "")}.` : "",
      "## O conceito",
      "Explique a ideia central em poucas frases, com as palavras de quem está começando.",
      "## Um exemplo do dia a dia",
      r.exemplo ? `${r.exemplo.replace(/\.$/, "")}.` : "Conte um caso concreto.",
      "## Cuidado com este erro",
      r.erro ? `Muita gente ${r.erro.replace(/^muita gente\s*/i, "").replace(/\.$/, "")}. Veja por que não é assim e como evitar.` : "O erro mais comum e como evitar.",
      "## Resumo",
      "- \n- \n- ",
    ].filter(Boolean);
    const esqueleto = partes.join("\n\n");
    inserir(corpo.trim() ? `${corpo.trim()}\n\n${esqueleto}` : esqueleto);
  }

  return (
    <section className="painel-cartao p-4" aria-label="Ferramentas de quem escreve">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={rotulo}>Ferramentas de quem escreve</p>
          <p className="mt-1 text-xs text-ink-soft">Tudo calculado aqui no navegador. Nada é enviado.</p>
        </div>
        <button type="button" className="cursor-pointer text-xs underline hover:text-oxblood" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>{aberto ? "Esconder" : "Mostrar"}</button>
      </div>
      {aberto && (
        <div className="mt-3 space-y-5 text-sm">
          <div>
            <p className="font-semibold">Leitura</p>
            {leitura ? (
              <ul className="mt-1 space-y-0.5">
                <li>{leitura.palavras} palavras · cerca de {minutos} min de leitura</li>
                <li>
                  Legibilidade: <strong>{Math.round(leitura.indice)}</strong> ({faixa?.[1]}, {faixa?.[2]})
                  {meta !== undefined && (leitura.indice >= meta ? <span className="text-ok"> · dentro da meta da etapa ✓</span> : <span className="text-oxblood"> · acima da meta da etapa (alvo: {meta} ou mais)</span>)}
                </li>
                <li>{leitura.porFrase.toFixed(1).replace(".", ",")} palavras por frase · {Math.round(leitura.longas * 100)}% de palavras longas</li>
              </ul>
            ) : (
              <p className="mt-1 text-ink-soft">Comece a escrever para ver as contas.</p>
            )}
            <p className="mt-1 text-xs text-ink-soft">Frases curtas e palavras comuns sobem o número. Fórmulas, código e links ficam fora da conta.</p>
          </div>

          <div>
            <p className="font-semibold">Checklist</p>
            <ul className="mt-1 space-y-1">
              {automaticos.map(([id, texto, ok]) => (
                <li key={id} className="flex gap-2">
                  <span aria-hidden className={ok ? "text-ok" : "text-ink-soft"}>{ok ? "✓" : "○"}</span>
                  <span>{texto}<span className="sr-only">{ok ? ": feito" : ": falta"}</span></span>
                </li>
              ))}
              {aMao.map(([id, texto]) => (
                <li key={id}>
                  <label className="flex cursor-pointer gap-2">
                    <input type="checkbox" checked={Boolean(manuais[id])} onChange={(e) => setManuais((m) => ({ ...m, [id]: e.target.checked }))} className="accent-[var(--oxblood)]" />
                    <span>{texto}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {avisos.length > 0 && (
            <div>
              <p className="font-semibold">Pré-requisitos</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {avisos.map((a) => (
                  <li key={a.numero}>O texto toca em “{a.titulo}”, que é a aula {a.numero} do roteiro, mais adiante. Explique o básico aqui ou indique que o assunto volta depois.</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="block font-semibold">
              Termos técnicos desta trilha
              <textarea
                value={jargao}
                onChange={(e) => {
                  setJargao(e.target.value);
                  setItem(chaveJargao, e.target.value.trim() ? e.target.value.slice(0, 3000) : null);
                }}
                rows={2}
                placeholder="mais-valia, proletariado, força de trabalho"
                className={`${campo} font-normal`}
              />
            </label>
            <p className="mt-1 text-xs text-ink-soft">Separe por vírgula. A lista fica neste navegador, por trilha.</p>
            {semExplicacao.length > 0 && <p className="mt-1">Usados sem explicação logo depois: {semExplicacao.map((t) => `“${t}”`).join(", ")}.</p>}
          </div>

          <details>
            <summary className="cursor-pointer font-semibold">Assistente de roteiro</summary>
            <p className="mt-1 text-xs text-ink-soft">Quatro perguntas que montam o esqueleto da aula (abertura, conceito, exemplo, erro comum e resumo). Se já houver texto, o esqueleto entra no fim.</p>
            {(
              [
                ["final", "O que a pessoa vai conseguir fazer ao final?"],
                ["erro", "Qual o erro mais comum?"],
                ["exemplo", "Que exemplo do dia a dia serve?"],
                ["antes", "O que precisa saber antes?"],
              ] as const
            ).map(([id, pergunta]) => (
              <label key={id} className="mt-2 block">
                {pergunta}
                <input value={roteiro[id]} onChange={(e) => setRoteiro((r) => ({ ...r, [id]: e.target.value.slice(0, 300) }))} className={campo} />
              </label>
            ))}
            <button type="button" className={`mt-3 ${botao}`} onClick={montarEsqueleto}>Montar o esqueleto</button>
          </details>
        </div>
      )}
    </section>
  );
}
