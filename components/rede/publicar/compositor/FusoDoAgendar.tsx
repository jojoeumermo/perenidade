// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useState } from "react";
import { cidadeDoFuso, diferencaDoFuso, FUSOS_DO_BRASIL, fusoDoAparelho, fusoValido, instanteNoFuso, quandoNoFuso, todosOsFusos } from "@/lib/rede/publicar/compositor";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDoCompositor } from "./textos";

const CHAVE = "lucia:alumia:fuso-do-agendar:v1";

/** O fuso que a pessoa escolheu da última vez NESTE aparelho; sem escolha, o do relógio do aparelho (ela troca na lista). */
export function fusoGuardado(): string {
  try {
    const f = window.localStorage.getItem(CHAVE);
    if (f && fusoValido(f)) return f;
  } catch {
    // sem armazenamento (janela privada): vale o do relógio
  }
  return fusoDoAparelho();
}

export function guardarFuso(f: string) {
  try {
    window.localStorage.setItem(CHAVE, f);
  } catch {
    // sem armazenamento: a escolha vale só agora
  }
}

/**
 * A escolha do fuso no "mais tarde" (onda 12, 12A; L2-33): os fusos do Brasil primeiro, com o nome das cidades, e os outros do mundo
 * embaixo. A hora que a pessoa marcou vale NESTE fuso; embaixo, quando o post sai no fuso escolhido. O banco converte de novo com a
 * lista dele (pg_timezone_names). Nada aqui vem do endereço de rede: o ponto de partida é o relógio do aparelho, e a pessoa troca.
 */
export function FusoDoAgendar({ t, lang, fuso, aoMudar, local }: { t: TextosDoCompositor; lang: string; fuso: string; aoMudar: (f: string) => void; local: string }) {
  // A diferença de cada fuso é a de quando o cartão abriu (o horário de verão de outro país pode mudar no meio do ano).
  const [agora] = useState(() => Date.now());
  const outros = useMemo(() => {
    const brasil = new Set<string>(FUSOS_DO_BRASIL);
    return todosOsFusos().filter((f) => !brasil.has(f) && f !== "UTC");
  }, []);
  const cidades = t.fuso.cidades as Record<string, string>;
  const rotulo = (f: string) => {
    const dif = diferencaDoFuso(f, agora, lang);
    const nome = cidades[f.split("/").pop() ?? ""] ?? cidadeDoFuso(f);
    return dif ? `${nome} (${dif})` : nome;
  };
  const instante = local ? instanteNoFuso(local, fuso) : null;
  return (
    <div className="mt-2">
      <label className="block">
        <span className="al2-rotulo">{t.fuso.rotulo}</span>
        <select
          className="al2-campo min-h-11"
          value={fuso}
          onChange={(e) => {
            aoMudar(e.target.value);
            guardarFuso(e.target.value);
          }}
          aria-describedby="cp-fuso-ajuda"
        >
          <optgroup label={t.fuso.doBrasil}>
            {FUSOS_DO_BRASIL.map((f) => (
              <option key={f} value={f}>
                {rotulo(f)}
              </option>
            ))}
          </optgroup>
          <optgroup label={t.fuso.outros}>
            {/* O fuso escolhido fora das duas listas (um nome antigo que o aparelho guardou) continua aparecendo. */}
            {!outros.includes(fuso) && !(FUSOS_DO_BRASIL as readonly string[]).includes(fuso) && <option value={fuso}>{rotulo(fuso)}</option>}
            <option value="UTC">UTC</option>
            {outros.map((f) => (
              <option key={f} value={f}>
                {f.replace(/_/g, " ")}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <p id="cp-fuso-ajuda" className="mt-1 text-xs text-[var(--al-texto-3)]">
        {t.fuso.ajuda}
      </p>
      {instante && (
        <p className="al2-nota mt-1" role="status">
          {preencher(t.fuso.vaiSair, { quando: quandoNoFuso(instante.toISOString(), fuso, lang) })}
        </p>
      )}
    </div>
  );
}
