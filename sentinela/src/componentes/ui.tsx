// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
import { useState, type ReactNode } from "react";
import { nomeEstado, nomeGravidade } from "../lib/formato.ts";

export function Titulo({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-5">
      <h2 className="titulo font-serif text-2xl font-semibold">{children}</h2>
      {sub && <p className="mt-1 font-sans text-sm text-ink-soft">{sub}</p>}
    </header>
  );
}

export function Cartao({ children, titulo, className = "", acao }: { children: ReactNode; titulo?: ReactNode; className?: string; acao?: ReactNode }) {
  return (
    <section className={`cartao surge ${className}`}>
      {(titulo || acao) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          {titulo && <h3 className="rotulo">{titulo}</h3>}
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

/** Um número grande com rótulo: a figura, quando o dado é um só. */
export function Figura({ rotulo, valor, detalhe, heroi = false }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; heroi?: boolean }) {
  return (
    <div>
      <p className="rotulo">{rotulo}</p>
      <p className={heroi ? "numero-heroi mt-2" : "mono mt-1 font-sans text-2xl font-semibold"}>{valor}</p>
      {detalhe && <p className="mt-1 font-sans text-xs text-ink-soft">{detalhe}</p>}
    </div>
  );
}

const icones: Record<string, string> = {
  info: "M12 8v.01M12 11v5",
  baixa: "M12 8v5M12 16v.01",
  media: "M12 8v5M12 16v.01M4 20h16L12 4z",
  alta: "M12 8v5M12 16v.01M4 20h16L12 4z",
  critica: "M12 9v4M12 17v.01M5 19h14L12 5z",
  ok: "M5 13l4 4L19 7",
};
const cores: Record<string, string> = { info: "var(--ink-soft)", baixa: "var(--estado-bom)", media: "var(--estado-atencao)", alta: "var(--estado-serio)", critica: "var(--estado-critico)", ok: "var(--estado-bom)" };

/** Gravidade: ícone + palavra + cor, nunca só a cor. */
export function Gravidade({ valor }: { valor: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-sans text-xs font-medium" style={{ color: cores[valor] ?? "var(--ink)" }}>
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={icones[valor] ?? icones.info} />
      </svg>
      {nomeGravidade[valor] ?? valor}
    </span>
  );
}

export function Estado({ valor }: { valor: string }) {
  const tom = /resolvido|executada|contido/.test(valor) ? "border-ok text-ok" : /falhou|recusada|aberto/.test(valor) ? "border-oxblood text-oxblood" : "border-ink-soft text-ink-soft";
  return <span className={`inline-block border px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider ${tom}`}>{nomeEstado[valor] ?? valor}</span>;
}

export function NoAr({ valor }: { valor: boolean | null | undefined }) {
  if (valor === null || valor === undefined) return <span className="font-sans text-xs text-ink-soft">sem leitura</span>;
  return (
    <span className="inline-flex items-center gap-1 font-sans text-xs font-medium" style={{ color: valor ? "var(--estado-bom)" : "var(--estado-critico)" }}>
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d={valor ? "M5 13l4 4L19 7" : "M6 6l12 12M18 6L6 18"} />
      </svg>
      {valor ? "no ar" : "fora"}
    </span>
  );
}

export function Aviso({ texto, ok = false }: { texto: string; ok?: boolean }) {
  if (!texto) return null;
  return <p role="status" className={`aviso ${ok ? "aviso-ok" : ""}`}>{texto}</p>;
}

export function Abas<T extends string>({ opcoes, atual, escolher }: { opcoes: { id: T; nome: string; conta?: number }[]; atual: T; escolher: (id: T) => void }) {
  return (
    <div role="tablist" className="abas">
      {opcoes.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={atual === o.id} className={`aba ${atual === o.id ? "aba-ativa" : ""}`} onClick={() => escolher(o.id)}>
          {o.nome}
          {Boolean(o.conta) && <span className="ml-1.5 bg-oxblood px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold text-parchment">{o.conta}</span>}
        </button>
      ))}
    </div>
  );
}

export function Carregando({ erro }: { erro?: string }) {
  if (erro) return <Aviso texto={erro} />;
  return <p className="mono text-xs text-ink-soft">Carregando…</p>;
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="font-sans text-sm text-ink-soft">{children}</p>;
}

/** Tabela simples; cada coluna diz como mostrar o valor. */
export function Tabela<T>({ linhas, colunas, chave, vazio = "Nada por aqui." }: { linhas: T[]; colunas: { nome: string; valor: (l: T) => ReactNode; classe?: string }[]; chave: (l: T) => string | number; vazio?: string }) {
  if (!linhas.length) return <Vazio>{vazio}</Vazio>;
  return (
    <div className="overflow-x-auto">
      <table className="tabela">
        <thead>
          <tr>{colunas.map((c) => <th key={c.nome}>{c.nome}</th>)}</tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={chave(l)}>
              {colunas.map((c) => <td key={c.nome} className={c.classe}>{c.valor(l)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Um bloco que abre e fecha. */
export function Dobra({ titulo, children, aberto = false }: { titulo: ReactNode; children: ReactNode; aberto?: boolean }) {
  const [ab, setAb] = useState(aberto);
  return (
    <div className="border-t border-rule py-2">
      <button type="button" className="flex w-full items-center justify-between text-left font-sans text-sm" onClick={() => setAb(!ab)} aria-expanded={ab}>
        <span>{titulo}</span>
        <span className="mono text-xs text-ink-soft">{ab ? "fechar" : "abrir"}</span>
      </button>
      {ab && <div className="mt-2">{children}</div>}
    </div>
  );
}

/** Confirmação em duas etapas para o que não se desfaz com facilidade. */
export function Confirmar({ texto, onConfirmar, classe = "botao" }: { texto: string; onConfirmar: () => void; classe?: string }) {
  const [pedindo, setPedindo] = useState(false);
  if (!pedindo) return <button type="button" className={classe} onClick={() => setPedindo(true)}>{texto}</button>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2 font-sans text-sm">
      <span>Tem certeza?</span>
      <button type="button" className="botao" onClick={() => { setPedindo(false); onConfirmar(); }}>Sim, {texto.toLowerCase()}</button>
      <button type="button" className="botao-claro" onClick={() => setPedindo(false)}>Não</button>
    </span>
  );
}
