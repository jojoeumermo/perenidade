// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, useId } from "react";

interface Comum {
  rotulo: string;
  ajuda?: string;
  erro?: string;
}

function Bloco({ id, rotulo, ajuda, erro, children }: Comum & { id: string; children: ReactNode }) {
  return (
    <div className="pn-campo-bloco">
      <label htmlFor={id} className="pn-rotulo">
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

/** Campo de uma linha, com rótulo, ajuda e erro ligados para o leitor de tela. */
export function Campo({ rotulo, ajuda, erro, className = "", ...resto }: Comum & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Bloco id={id} rotulo={rotulo} ajuda={ajuda} erro={erro}>
      <input id={id} className={`pn-campo ${className}`} {...ligacoes(id, ajuda, erro)} {...resto} />
    </Bloco>
  );
}

/** Caixa de texto de várias linhas. */
export function Area({ rotulo, ajuda, erro, className = "", ...resto }: Comum & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Bloco id={id} rotulo={rotulo} ajuda={ajuda} erro={erro}>
      <textarea id={id} className={`pn-campo ${className}`} {...ligacoes(id, ajuda, erro)} {...resto} />
    </Bloco>
  );
}

/** Lista de escolha do navegador (boa no celular e no leitor de tela). */
export function Selecao({ rotulo, ajuda, erro, className = "", children, ...resto }: Comum & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Bloco id={id} rotulo={rotulo} ajuda={ajuda} erro={erro}>
      <select id={id} className={`pn-campo ${className}`} {...ligacoes(id, ajuda, erro)} {...resto}>
        {children}
      </select>
    </Bloco>
  );
}

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
