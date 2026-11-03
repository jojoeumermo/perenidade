// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import Link from "@/components/Link";
import type { TextosDaFormatura } from "@/i18n/escola/formatura";
import { contarEscola } from "@/lib/escola/banco";
import { criterioDeFormatura, type EntradaDoCriterio, formar } from "@/lib/escola/formatura";

/**
 * O botão "Minha formatura" e a tela de parabéns. Pede confirmação antes ("Confirmo: terminei este curso") porque não há
 * "desfazer". Só aparece quando o critério está cumprido. A única coisa que sai do aparelho é o +1 anônimo
 * "escola_formatura" (contarEscola); a tela de parabéns não tem som e não se mexe com "reduzir movimento" ligado.
 */
export function Cerimonia({ s, entrada, tituloDoCurso, base }: { s: TextosDaFormatura["cerimonia"]; entrada: EntradaDoCriterio; tituloDoCurso: string; base: string }) {
  const [passo, setPasso] = useState<"ocioso" | "confirmando" | "feito" | "erro">("ocioso");
  const criterio = criterioDeFormatura(entrada);

  if (passo === "feito") {
    return (
      <div className="formatura-parabens" role="status" data-parabens="">
        <h3 className="formatura-h3">{s.parabens}</h3>
        <p>{s.parabensTexto}</p>
        <ul className="formatura-links">
          <li>
            <Link href={`${base}/formatura/registro`} className="formatura-botao">
              {s.verRegistro}
            </Link>
          </li>
          <li>
            <Link href={`${base}/formatura/mural`} className="formatura-link">
              {s.verMural}
            </Link>
          </li>
          <li>
            <Link href={`${base}/formatura/memoria`} className="formatura-link">
              {s.verMemoria}
            </Link>
          </li>
          <li>
            <Link href={`${base}/cursos`} className="formatura-link">
              {s.proximoCurso}
            </Link>
          </li>
        </ul>
      </div>
    );
  }
  if (criterio.jaFormada) {
    return (
      <p>
        <Link href={`${base}/formatura/registro`} className="formatura-botao">
          {s.verRegistro}
        </Link>
      </p>
    );
  }
  if (!criterio.pode) return null;
  if (passo === "confirmando" || passo === "erro") {
    return (
      <div className="formatura-cartao" role="alertdialog" aria-label={s.confirmarTitulo} data-confirmando="">
        <p>
          <strong>{s.confirmarTitulo}</strong>
        </p>
        <p>{s.confirmarTexto}</p>
        {passo === "erro" ? (
          <p role="alert" className="formatura-erro">
            {s.erro}
          </p>
        ) : null}
        <div className="formatura-barra">
          <button
            type="button"
            className="formatura-botao"
            onClick={() => setPasso(formar({ ...entrada, tituloDoCurso, contar: contarEscola }).ok ? "feito" : "erro")}
          >
            {s.confirmo}
          </button>
          <button type="button" className="formatura-botao-fraco" onClick={() => setPasso("ocioso")}>
            {s.aindaNao}
          </button>
        </div>
      </div>
    );
  }
  return (
    <button type="button" className="formatura-botao" onClick={() => setPasso("confirmando")} data-minha-formatura="">
      {s.minhaFormatura}
    </button>
  );
}
