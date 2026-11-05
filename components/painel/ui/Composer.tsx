// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { LucideIcon } from "lucide-react";
import { AtSign } from "lucide-react";
import { type KeyboardEvent, useId, useLayoutEffect, useRef, useState } from "react";
import { cx } from "./cx";
import { Kbd } from "./Kbd";

const simples = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export interface ComandoDoComposer {
  id: string;
  nome: string;
  sobre?: string;
  simbolo?: LucideIcon;
  /** Recebe o texto sem o "/comando" e devolve o texto novo. */
  inserir: (texto: string) => string;
}

export interface PropsDoComposer {
  rotulo: string;
  valor: string;
  aoMudar: (texto: string) => void;
  aoEnviar?: () => void;
  comandos?: ComandoDoComposer[];
  /** "@" abre a lista de menção quando vem a lista de pessoas. */
  pessoas?: { id: string; nome: string }[];
  /** "enter": Enter envia e Shift+Enter quebra a linha. "ctrl-enter": Ctrl+Enter envia. */
  enviarCom?: "enter" | "ctrl-enter";
  maxLength?: number;
  placeholder?: string;
  desligado?: boolean;
  className?: string;
  /** Mostra a linha de ajuda com as teclas. */
  ajuda?: boolean;
}

type Lista = { tipo: "comando"; inicio: number; termo: string } | { tipo: "pessoa"; inicio: number; termo: string } | null;

/**
 * O campo de escrever do painel: cresce com o texto; "/" no começo da linha abre os comandos (filtrados pelo que vem
 * depois da barra); "@" abre a menção; setas e Enter escolhem, Esc fecha; Ctrl B e Ctrl I cercam a seleção com ** e _.
 * A saída é o mesmo texto simples de sempre (nada de HTML): as mensagens cifradas, a busca local e o Formatado continuam.
 */
export function Composer({ rotulo, valor, aoMudar, aoEnviar, comandos = [], pessoas, enviarCom = "enter", maxLength, placeholder, desligado, className, ajuda }: PropsDoComposer) {
  const id = useId();
  const caixa = useRef<HTMLTextAreaElement>(null);
  const [lista, setLista] = useState<Lista>(null);
  const [escolhido, setEscolhido] = useState(0);

  // Cresce com o texto, até o máximo do tema (depois rola).
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [valor]);

  const opcoes =
    lista?.tipo === "comando"
      ? comandos.filter((c) => simples(`${c.id} ${c.nome}`).includes(simples(lista.termo))).slice(0, 8)
      : lista?.tipo === "pessoa"
        ? (pessoas ?? []).filter((p) => simples(p.nome).includes(simples(lista.termo))).slice(0, 8)
        : [];

  /** Olha o que está antes do cursor: "/algo" no começo da linha ou "@algo" depois de um espaço. */
  function conferir(texto: string, cursor: number) {
    const antes = texto.slice(0, cursor);
    const linha = antes.slice(antes.lastIndexOf("\n") + 1);
    const barra = /^\/([^\s/]*)$/.exec(linha);
    if (barra && comandos.length) {
      setLista({ tipo: "comando", inicio: cursor - linha.length, termo: barra[1] });
      setEscolhido(0);
      return;
    }
    const arroba = /(^|\s)@([^\s@]*)$/.exec(antes);
    if (arroba && pessoas?.length) {
      setLista({ tipo: "pessoa", inicio: cursor - arroba[2].length - 1, termo: arroba[2] });
      setEscolhido(0);
      return;
    }
    setLista(null);
  }

  function escolher(i: number) {
    const el = caixa.current;
    if (!lista || !el) return;
    const cursor = el.selectionStart;
    const antes = valor.slice(0, lista.inicio);
    const depois = valor.slice(cursor);
    if (lista.tipo === "comando") {
      const comando = opcoes[i] as ComandoDoComposer | undefined;
      if (!comando) return;
      aoMudar(comando.inserir(antes + depois));
    } else {
      const pessoa = opcoes[i] as { id: string; nome: string } | undefined;
      if (!pessoa) return;
      aoMudar(`${antes}@${pessoa.nome} ${depois}`);
    }
    setLista(null);
    requestAnimationFrame(() => el.focus());
  }

  function cercar(marca: string) {
    const el = caixa.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    aoMudar(`${valor.slice(0, a)}${marca}${valor.slice(a, b)}${marca}${valor.slice(b)}`);
    requestAnimationFrame(() => el.setSelectionRange(a + marca.length, b + marca.length));
  }

  function teclar(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (lista && opcoes.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setEscolhido((i) => (i + (e.key === "ArrowDown" ? 1 : opcoes.length - 1)) % opcoes.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        escolher(escolhido);
        return;
      }
    }
    if (lista && e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setLista(null);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === "b" || e.key === "i")) {
      e.preventDefault();
      cercar(e.key === "b" ? "**" : "_");
      return;
    }
    if (e.key === "Enter" && aoEnviar && !e.nativeEvent.isComposing) {
      const envia = enviarCom === "enter" ? !e.shiftKey && !e.ctrlKey && !e.metaKey : e.ctrlKey || e.metaKey;
      if (envia) {
        e.preventDefault();
        aoEnviar();
      }
    }
  }

  const idLista = `${id}-lista`;
  const aberta = Boolean(lista && opcoes.length);
  return (
    <div className={cx("pn-composer", className)}>
      <label htmlFor={id} className="sr-only">
        {rotulo}
      </label>
      <textarea
        ref={caixa}
        id={id}
        rows={1}
        className="pn-campo"
        value={valor}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={desligado}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={aberta}
        aria-controls={aberta ? idLista : undefined}
        aria-activedescendant={aberta ? `${idLista}-${escolhido}` : undefined}
        onChange={(e) => {
          aoMudar(e.target.value);
          conferir(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={teclar}
        onBlur={() => setLista(null)}
      />
      {aberta && (
        <ul id={idLista} role="listbox" aria-label={lista?.tipo === "pessoa" ? "Mencionar alguém" : "Comandos"} className="pn-composer-lista">
          {opcoes.map((o, i) => {
            const comando = lista?.tipo === "comando" ? (o as ComandoDoComposer) : null;
            const Simbolo = comando?.simbolo ?? (comando ? null : AtSign);
            return (
              <li
                key={o.id}
                id={`${idLista}-${i}`}
                role="option"
                aria-selected={i === escolhido}
                className="pn-composer-opcao"
                // mousedown, não click: o clique tiraria o foco da caixa antes de escolher.
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(i);
                }}
              >
                {Simbolo && <Simbolo aria-hidden />}
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontWeight: 600 }}>{comando ? `/${comando.id}` : o.nome}</span>
                  {comando && <span className="pn-composer-dica">{comando.sobre ?? comando.nome}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {ajuda && (
        <p className="pn-composer-dica">
          {comandos.length > 0 && (
            <>
              <Kbd>/</Kbd> comandos ·{" "}
            </>
          )}
          <Kbd>Ctrl B</Kbd> negrito · <Kbd>Ctrl I</Kbd> itálico · <Kbd>{enviarCom === "enter" ? "Enter" : "Ctrl Enter"}</Kbd> envia
        </p>
      )}
    </div>
  );
}
