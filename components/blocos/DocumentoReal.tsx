// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useState } from "react";
import { type Locale } from "@/i18n/config";
import en from "@/i18n/escola/vida/en.json";
import es from "@/i18n/escola/vida/es.json";
import fr from "@/i18n/escola/vida/fr.json";
import pt from "@/i18n/escola/vida/pt.json";
import ru from "@/i18n/escola/vida/ru.json";
import zh from "@/i18n/escola/vida/zh.json";
import { escolher } from "@/lib/escola/textos";
import { lerDocumento } from "@/lib/interativos-mais";
import { ligado } from "@/lib/recursos";
import { useI18n } from "../I18n";

// Documento real com áreas explicadas (E4-11, bloco ```documento das aulas). Baixa só quando a aula usa o bloco
// (components/blocos/Interativo.tsx o carrega com next/dynamic). Os textos vêm dos JSON da Escola importados AQUI, no
// próprio pedaço que baixa, sem tocar o núcleo do i18n. Toque ou Enter numa área abre a explicação; o leitor de tela lê
// o nome de cada área e o texto aparece embaixo.

const TEXTOS = { pt: pt.documento, en: en.documento, es: es.documento, fr: fr.documento, ru: ru.documento, zh: zh.documento };

export function DocumentoReal({ spec }: { spec: string }) {
  const { lang } = useI18n() as { lang: Locale };
  const s = escolher(TEXTOS, lang);
  const doc = useMemo(() => lerDocumento(spec), [spec]);
  const [aberta, setAberta] = useState<number | null>(null);
  if (!ligado("escola")) return null;
  if (!doc) return <pre className="text-sm">{spec}</pre>;
  const area = aberta !== null ? doc.areas[aberta] : null;

  return (
    <figure className="no-print my-6 border-l-2 border-gold bg-parchment-deep p-4 font-sans text-sm" data-documento-real="">
      <p>
        <span className="vida-selo">{s.selo}</span>
      </p>
      <div className="documento-quadro mt-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- imagem do próprio site, já otimizada no envio */}
        <img src={doc.imagem} alt={doc.descricao} onClick={() => setAberta(null)} />
        {doc.areas.map((a, i) => (
          <button
            key={`${a.nome}-${i}`}
            type="button"
            className="documento-area"
            aria-label={`${a.nome}. ${a.texto}`}
            aria-pressed={aberta === i}
            onClick={(e) => {
              e.stopPropagation();
              setAberta(aberta === i ? null : i);
            }}
            style={{ left: `${a.x}%`, top: `${a.y}%`, width: `${a.w}%`, height: `${a.h}%` }}
          />
        ))}
      </div>
      {area ? (
        <div className="mt-3 border-l-2 border-oxblood bg-parchment p-3" role="status">
          <p className="font-semibold">{area.nome}</p>
          {area.texto ? (
            <p className="mt-1">
              <span className="font-semibold">{s.significa}:</span> {area.texto}
            </p>
          ) : null}
          {area.conferir ? (
            <p className="mt-1">
              <span className="font-semibold">{s.conferir}:</span> {area.conferir}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-ink-soft">{s.toque}</p>
      )}
      <figcaption className="mt-3 text-xs text-ink-soft">
        {doc.semDadosPessoais ? <span>{s.semDados}. </span> : null}
        <span className="font-semibold">{s.fonte}:</span>{" "}
        <a href={doc.fonte} target="_blank" rel="noreferrer" className="break-all underline hover:text-oxblood">
          {s.verOriginal}
        </a>
        . <span className="font-semibold">{s.licenca}:</span> {doc.licenca}
      </figcaption>
    </figure>
  );
}
