// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { useGuardado } from "@/components/estudo/guardado";
import { fill } from "@/i18n/config";
import { filtrarCampus, type PredioDoMapa, TOTAL_DE_PREDIOS } from "@/lib/escola/campus";
import type { TextosDoCampus } from "@/lib/escola/campus-servidor";
import { lerPassaporte, type Passaporte, visitados } from "@/lib/escola/passaporte";
import { normalize } from "@/lib/text";
import { Predio } from "./Predio";
import "@/styles/escola-campus.css";

const SEM_CARIMBO: Passaporte = {};

/**
 * O mapa do campus (E4-09, D1-1): a grade de prédios (2 colunas no celular, 4 no computador), cada um com o nome, a frase
 * de porta e as seções de dentro. Abre no "Mais" (com a busca da própria janela, em `termo`), em /explorar e em
 * /escola/campus (com o campo de busca daqui, `comBusca`). Os links funcionam sem JavaScript. O passaporte (carimbo e
 * "Conheça o campus: 3 de 8 prédios") é lido só no aparelho, depois do primeiro desenho.
 * No computador, fora do "Mais", os prédios descem em colunas de jornal (styles/escola-campus.css, .mapa-em-colunas):
 * cada cartão com a altura do que tem. Na grade de antes, o prédio Escola (o de mais seções) esticava a linha inteira e
 * deixava os vizinhos com um espaço morto enorme embaixo (T07).
 */
export function MapaDoCampus({
  predios,
  s,
  termo: termoDeFora,
  comBusca,
  aoAbrir,
  semTitulo,
  compacto,
}: {
  predios: PredioDoMapa[];
  s: TextosDoCampus["mapa"];
  /** A busca já normalizada, quando quem monta tem o seu campo (o "Mais"). */
  termo?: string;
  comBusca?: boolean;
  aoAbrir?: (path: string) => void;
  semTitulo?: boolean;
  /**
   * O mapa dentro do "Mais" (06/11/2026, segunda versão): no computador, uma grade alinhada de 4 colunas por 2 linhas,
   * todos os cartões da mesma altura (auto-rows-fr), só o nome e as 4 primeiras seções de cada prédio, com o resto no
   * "Ver tudo". As colunas de jornal da primeira versão deixavam os cartões desalinhados. No celular, a grade de gavetas.
   */
  compacto?: boolean;
}) {
  const [digitado, setDigitado] = useState("");
  const [passaporte] = useGuardado<Passaporte>(lerPassaporte, SEM_CARIMBO);
  const termo = termoDeFora ?? normalize(digitado.trim());
  const filtrados = filtrarCampus(predios, termo, normalize);
  const n = visitados(passaporte);
  return (
    <div className="mapa-do-campus" data-mapa-do-campus="">
      {!semTitulo && (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="rotulo">{s.titulo}</p>
          <p className="font-sans text-sm text-ink-soft" data-convite-do-campus={n}>
            {fill(s.convite, { n, total: TOTAL_DE_PREDIOS })}
          </p>
        </div>
      )}
      {comBusca && (
        <label className="mb-5 block max-w-md font-sans text-sm">
          {s.busca}
          <input type="search" value={digitado} onChange={(e) => setDigitado(e.target.value)} maxLength={60} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2" />
        </label>
      )}
      {filtrados.length === 0 ? (
        <p className="py-4 text-lg text-ink-soft">{s.nenhum}</p>
      ) : (
        <ul aria-label={s.rotulo} className={compacto ? "mapa-compacto grid grid-cols-2 gap-2.5 md:grid-cols-4 md:auto-rows-fr md:gap-3" : "mapa-em-colunas grid grid-cols-2 gap-2.5"}>
          {filtrados.map((p) => (
            <Predio key={p.id} predio={p} s={s} carimbo={passaporte[p.id]} aoAbrir={aoAbrir} aberto={Boolean(termo)} compacto={compacto} />
          ))}
        </ul>
      )}
      {!semTitulo && <p className="mt-3 font-sans text-xs text-ink-soft">{s.nota}</p>}
    </div>
  );
}
