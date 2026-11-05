// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type LucideIcon, Search, X } from "lucide-react";
import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, useId, useRef } from "react";
import { cx } from "./cx";

interface Comum {
  rotulo: string;
  ajuda?: string;
  erro?: string;
}

function Bloco({ id, rotulo, ajuda, erro, children, rotuloEscondido }: Comum & { id: string; children: ReactNode; rotuloEscondido?: boolean }) {
  return (
    <div className="pn-campo-bloco">
      <label htmlFor={id} className={rotuloEscondido ? "sr-only" : "pn-rotulo"}>
        {rotulo}
      </label>
      {children}
      {ajuda && !erro && (
        <p id={`${id}-ajuda`} className="pn-ajuda">
          {ajuda}
        </p>
      )}
      {erro && (
        <p id={`${id}-erro`} role="alert" className="pn-erro">
          {erro}
        </p>
      )}
    </div>
  );
}

const ligacoes = (id: string, ajuda?: string, erro?: string) => ({ "aria-invalid": erro ? true : undefined, "aria-describedby": erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined });

/** Campo de uma linha, com rótulo, ajuda e erro ligados para o leitor de tela. "simbolo" põe um ícone Lucide à esquerda. */
export const Campo = forwardRef<HTMLInputElement, Comum & InputHTMLAttributes<HTMLInputElement> & { simbolo?: LucideIcon }>(function Campo({ rotulo, ajuda, erro, className = "", simbolo: Simbolo, ...resto }, ref) {
  const id = useId();
  const campo = <input ref={ref} id={id} className={cx("pn-campo", className)} {...ligacoes(id, ajuda, erro)} {...resto} />;
  return (
    <Bloco id={id} rotulo={rotulo} ajuda={ajuda} erro={erro}>
      {Simbolo ? (
        <span className="pn-campo-com-simbolo">
          <Simbolo aria-hidden />
          {campo}
        </span>
      ) : (
        campo
      )}
    </Bloco>
  );
});

/** Caixa de texto de várias linhas. */
export const Area = forwardRef<HTMLTextAreaElement, Comum & TextareaHTMLAttributes<HTMLTextAreaElement>>(function Area({ rotulo, ajuda, erro, className = "", ...resto }, ref) {
  const id = useId();
  return (
    <Bloco id={id} rotulo={rotulo} ajuda={ajuda} erro={erro}>
      <textarea ref={ref} id={id} className={cx("pn-campo", className)} {...ligacoes(id, ajuda, erro)} {...resto} />
    </Bloco>
  );
});

/** Lista de escolha do navegador (boa no celular e no leitor de tela). */
export const Selecao = forwardRef<HTMLSelectElement, Comum & SelectHTMLAttributes<HTMLSelectElement>>(function Selecao({ rotulo, ajuda, erro, className = "", children, ...resto }, ref) {
  const id = useId();
  return (
    <Bloco id={id} rotulo={rotulo} ajuda={ajuda} erro={erro}>
      <select ref={ref} id={id} className={cx("pn-campo", className)} {...ligacoes(id, ajuda, erro)} {...resto}>
        {children}
      </select>
    </Bloco>
  );
});

/** Caixa de marcar com o texto ao lado. */
export function Marca({ rotulo, ajuda, ...resto }: { rotulo: string; ajuda?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="pn-marca">
        <input id={id} type="checkbox" {...resto} aria-describedby={ajuda ? `${id}-ajuda` : undefined} />
        <span>{rotulo}</span>
      </label>
      {ajuda && (
        <p id={`${id}-ajuda`} className="pn-ajuda" style={{ marginLeft: "1.6rem" }}>
          {ajuda}
        </p>
      )}
    </div>
  );
}

/**
 * Campo de busca: lupa à esquerda, "Esc" limpa, o botão de limpar aparece com texto. O rótulo fica para o leitor de tela
 * (visível com "rotuloVisivel").
 */
export function Busca({ rotulo, valor, aoMudar, placeholder, rotuloVisivel, className, autoFocus, aoEnter }: { rotulo: string; valor: string; aoMudar: (valor: string) => void; placeholder?: string; rotuloVisivel?: boolean; className?: string; autoFocus?: boolean; aoEnter?: () => void }) {
  const id = useId();
  const campo = useRef<HTMLInputElement>(null);
  return (
    <Bloco id={id} rotulo={rotulo} rotuloEscondido={!rotuloVisivel}>
      <span className={cx("pn-campo-com-simbolo pn-busca", className)}>
        <Search aria-hidden />
        <input
          ref={campo}
          id={id}
          type="search"
          className="pn-campo"
          value={valor}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={(e) => aoMudar(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && valor) {
              e.preventDefault();
              e.stopPropagation();
              aoMudar("");
            } else if (e.key === "Enter" && aoEnter) {
              e.preventDefault();
              aoEnter();
            }
          }}
        />
        {valor && (
          <button
            type="button"
            className="pn-busca-limpar"
            aria-label="Limpar a busca"
            onClick={() => {
              aoMudar("");
              campo.current?.focus();
            }}
          >
            <X aria-hidden width={14} height={14} />
          </button>
        )}
      </span>
    </Bloco>
  );
}
