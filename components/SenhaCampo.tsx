// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useState } from "react";
import { avaliarSenha, MINIMO, REGRAS_DE_SENHA, type RegraDeSenha } from "@/lib/forca-senha";

/** As regras de uma senha nova: 12 caracteres ou mais, minúscula, maiúscula e número, não ser comum, não ser só repetição. Frase longa vale. */
export const REGRAS = REGRAS_DE_SENHA;
export type Regra = RegraDeSenha;
export { MINIMO };

export interface SenhaLabels {
  show: string;
  hide: string;
  rulesTitle: string;
  rules: Record<Regra, string>;
  strong: string;
  /** Rótulo do medidor e os quatro níveis (fraca, razoável, boa, forte). Banco de textos antigo pode não ter. */
  meterTitle?: string;
  meter?: string[];
}

export const senhaPt: SenhaLabels = {
  show: "Mostrar a senha",
  hide: "Esconder a senha",
  rulesTitle: "A senha precisa",
  rules: {
    length: "ter pelo menos 12 caracteres (uma frase longa funciona muito bem)",
    mix: "ter letra minúscula, letra maiúscula e número (ex.: Minha avó plantava 3 pés de feijão)",
    common: "não ser uma senha comum nem o seu nome com números",
    variety: "não ser só repetição (aaaa…, 1212…)",
  },
  strong: "Senha aceita.",
  meterTitle: "Força",
  meter: ["Fraca", "Razoável", "Boa", "Forte"],
};

export const regrasDaSenha = (senha: string, pessoais: string[] = []) => {
  const { regras } = avaliarSenha(senha, pessoais);
  return REGRAS.map((id) => ({ id, ok: regras[id] }));
};
export const senhaForte = (senha: string, pessoais: string[] = []) => avaliarSenha(senha, pessoais).aceita;

function Olho({ aberto }: { aberto: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
      {!aberto && <path d="M4 20 20 4" />}
    </svg>
  );
}

const CORES_DO_MEDIDOR = ["bg-oxblood", "bg-gold", "bg-ok", "bg-ok"];

/**
 * Campo de senha com o "olho mágico" (mostra e esconde o que foi digitado) e, para senha nova, a lista de regras
 * que vai sendo marcada enquanto a pessoa escreve e o medidor de força. Colar e gerenciador de senha funcionam.
 * A conferência é toda aqui no navegador.
 */
export function SenhaCampo({
  id,
  value,
  onChange,
  labels = senhaPt,
  regras = false,
  pessoais = [],
  className = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2",
  autoComplete = "new-password",
  required = false,
  autoFocus = false,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  labels?: SenhaLabels;
  /** Mostra a lista de regras e o medidor (senha nova). */
  regras?: boolean;
  /** Nome e e-mail da pessoa: a senha não pode ser eles com números. */
  pessoais?: string[];
  className?: string;
  autoComplete?: "new-password" | "current-password";
  required?: boolean;
  autoFocus?: boolean;
}) {
  const proprio = useId();
  const campoId = id ?? proprio;
  const [visivel, setVisivel] = useState(false);
  const avaliacao = avaliarSenha(value, pessoais);
  const niveis = labels.meter ?? senhaPt.meter!;
  return (
    <div>
      <div className="relative">
        <input
          id={campoId}
          type={visivel ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          autoFocus={autoFocus}
          maxLength={200}
          spellCheck={false}
          aria-describedby={regras ? `${campoId}-regras` : undefined}
          className={`${className} pr-11`}
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? labels.hide : labels.show}
          aria-pressed={visivel}
          title={visivel ? labels.hide : labels.show}
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center text-ink-soft hover:text-oxblood"
        >
          <Olho aberto={visivel} />
        </button>
      </div>
      {regras && (
        <div id={`${campoId}-regras`} className="mt-2 text-sm">
          {value && (
            <div className="mb-2 flex items-center gap-2" aria-live="polite">
              <span className="text-ink-soft">{labels.meterTitle ?? senhaPt.meterTitle}:</span>
              <span className="flex flex-1 gap-1" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={`h-1.5 flex-1 ${i <= avaliacao.forca && (avaliacao.aceita || i === 0) ? CORES_DO_MEDIDOR[avaliacao.forca] : "bg-rule"}`} />
                ))}
              </span>
              <strong className={avaliacao.aceita ? "text-ok" : "text-oxblood"}>{niveis[avaliacao.forca]}</strong>
            </div>
          )}
          <p className="text-ink-soft">{avaliacao.aceita && value ? labels.strong : labels.rulesTitle}</p>
          <ul className="mt-1 grid gap-y-0.5" aria-live="polite">
            {REGRAS.map((regra) => {
              const ok = avaliacao.regras[regra];
              return (
                <li key={regra} className={`flex items-center gap-1.5 ${ok ? "text-ok" : "text-ink-soft"}`}>
                  <span aria-hidden className={`flex h-4 w-4 shrink-0 items-center justify-center border text-[0.65rem] font-bold ${ok ? "border-ok bg-ok text-parchment" : "border-rule"}`}>
                    {ok ? "✓" : ""}
                  </span>
                  <span className="sr-only">{ok ? "✓ " : "✗ "}</span>
                  {labels.rules[regra]}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
