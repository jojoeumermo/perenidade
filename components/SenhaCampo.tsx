// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useState } from "react";

/** As regras de uma senha nova: tamanho, maiúscula, minúscula, número e caractere especial. */
export const REGRAS = ["length", "upper", "lower", "number", "special"] as const;
export type Regra = (typeof REGRAS)[number];

export const MINIMO = 12;

export interface SenhaLabels {
  show: string;
  hide: string;
  rulesTitle: string;
  rules: Record<Regra, string>;
  strong: string;
}

export const senhaPt: SenhaLabels = {
  show: "Mostrar a senha",
  hide: "Esconder a senha",
  rulesTitle: "A senha precisa ter",
  rules: {
    length: "pelo menos 12 caracteres",
    upper: "uma letra maiúscula",
    lower: "uma letra minúscula",
    number: "um número",
    special: "um caractere especial (!, @, #, ., ?…)",
  },
  strong: "Senha forte.",
};

const conferir: Record<Regra, (senha: string) => boolean> = {
  length: (senha) => senha.length >= MINIMO,
  upper: (senha) => /\p{Lu}/u.test(senha),
  lower: (senha) => /\p{Ll}/u.test(senha),
  number: (senha) => /\p{Nd}/u.test(senha),
  special: (senha) => /[^\p{L}\p{Nd}\s]/u.test(senha),
};

export const regrasDaSenha = (senha: string) => REGRAS.map((id) => ({ id, ok: conferir[id](senha) }));
export const senhaForte = (senha: string) => REGRAS.every((id) => conferir[id](senha));

function Olho({ aberto }: { aberto: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
      {!aberto && <path d="M4 20 20 4" />}
    </svg>
  );
}

/**
 * Campo de senha com o "olho mágico" (mostra e esconde o que foi digitado) e, para senha nova, a lista de regras
 * que vai sendo marcada enquanto a pessoa escreve. A conferência é toda aqui no navegador.
 */
export function SenhaCampo({
  id,
  value,
  onChange,
  labels = senhaPt,
  regras = false,
  className = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2",
  autoComplete = "new-password",
  required = false,
  autoFocus = false,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  labels?: SenhaLabels;
  /** Mostra a lista de regras (senha nova). */
  regras?: boolean;
  className?: string;
  autoComplete?: "new-password" | "current-password";
  required?: boolean;
  autoFocus?: boolean;
}) {
  const proprio = useId();
  const campoId = id ?? proprio;
  const [visivel, setVisivel] = useState(false);
  const lista = regrasDaSenha(value);
  const forte = lista.every((regra) => regra.ok);
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
          <p className="text-ink-soft">{forte && value ? labels.strong : labels.rulesTitle}</p>
          <ul className="mt-1 grid gap-x-4 gap-y-0.5 sm:grid-cols-2" aria-live="polite">
            {lista.map((regra) => (
              <li key={regra.id} className={`flex items-center gap-1.5 ${regra.ok ? "text-ok" : "text-ink-soft"}`}>
                <span aria-hidden className={`flex h-4 w-4 shrink-0 items-center justify-center border text-[0.65rem] font-bold ${regra.ok ? "border-ok bg-ok text-parchment" : "border-rule"}`}>
                  {regra.ok ? "✓" : ""}
                </span>
                <span className="sr-only">{regra.ok ? "✓ " : "✗ "}</span>
                {labels.rules[regra.id]}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
