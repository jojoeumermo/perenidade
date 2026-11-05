// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import * as Radix from "@radix-ui/react-dialog";
import { type FormEvent, type ReactNode, useState, useSyncExternalStore } from "react";
import { traduzirNoPainel } from "../Idioma";
import { Botao } from "./Botao";

/** Janela de diálogo (Radix só como estrutura: foco preso, Esc fecha, leitor de tela avisado). */
export function Dialogo({ aberto, aoMudar, titulo, texto, children, largo }: { aberto: boolean; aoMudar: (aberto: boolean) => void; titulo: string; texto?: string; children?: ReactNode; largo?: boolean }) {
  return (
    <Radix.Root open={aberto} onOpenChange={aoMudar}>
      <Radix.Portal>
        <Radix.Overlay className="pn-veu" />
        <Radix.Content className="pn-dialogo painel" style={largo ? { width: "min(48rem, calc(100vw - 2rem))" } : undefined}>
          <Radix.Title className="pn-dialogo-titulo">{titulo}</Radix.Title>
          {texto ? <Radix.Description className="pn-dialogo-texto">{texto}</Radix.Description> : <Radix.Description className="sr-only">{titulo}</Radix.Description>}
          {children}
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  );
}

// ───── Confirmar e perguntar ─────
// Uso (em qualquer lugar do painel, sem hook; no lugar do confirm e do prompt do navegador):
//   if (!(await confirmar({ titulo: "Apagar o rascunho?", texto: "Não dá para desfazer.", perigo: true }))) return;
//   const motivo = await perguntar({ titulo: "Motivo da recusa", rotulo: "Motivo", obrigatorio: true }); // null se cancelou
// O <DialogosDoPainel /> fica montado uma vez só, no painel.

export interface OpcoesDeConfirmacao {
  titulo: string;
  texto?: string;
  /** Texto do botão que confirma (padrão: "Confirmar"). */
  confirmar?: string;
  cancelar?: string;
  /** Ação que apaga ou não se desfaz: o botão que confirma ganha o tom de erro no texto (o fundo não muda). */
  perigo?: boolean;
}

export interface OpcoesDePergunta {
  titulo: string;
  texto?: string;
  rotulo?: string;
  valorInicial?: string;
  placeholder?: string;
  multilinha?: boolean;
  /** Se verdadeiro, o botão só confirma com texto escrito. */
  obrigatorio?: boolean;
  confirmar?: string;
  cancelar?: string;
}

type Pedido = ({ tipo: "confirmar" } & OpcoesDeConfirmacao & { resolver: (v: boolean) => void }) | ({ tipo: "perguntar" } & OpcoesDePergunta & { resolver: (v: string | null) => void });

let fila: Pedido[] = [];
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());
const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
};
const ver = () => fila[0] ?? null;

/** Abre a janela de confirmação e devolve true (confirmou) ou false (cancelou, Esc ou fora). */
export function confirmar(opcoes: OpcoesDeConfirmacao): Promise<boolean> {
  return new Promise((resolver) => {
    fila = [...fila, { tipo: "confirmar", ...opcoes, resolver }];
    avisar();
  });
}

/** Abre a janela com um campo e devolve o texto escrito, ou null se a pessoa cancelou. */
export function perguntar(opcoes: OpcoesDePergunta): Promise<string | null> {
  return new Promise((resolver) => {
    fila = [...fila, { tipo: "perguntar", ...opcoes, resolver }];
    avisar();
  });
}

function fechar(pedido: Pedido, valor: boolean | string | null) {
  fila = fila.filter((p) => p !== pedido);
  if (pedido.tipo === "confirmar") pedido.resolver(valor === true);
  else pedido.resolver(typeof valor === "string" ? valor : null);
  avisar();
}

function Pergunta({ pedido }: { pedido: Extract<Pedido, { tipo: "perguntar" }> }) {
  const [valor, setValor] = useState(pedido.valorInicial ?? "");
  const vazio = pedido.obrigatorio && !valor.trim();
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!vazio) fechar(pedido, valor);
  };
  return (
    <form onSubmit={enviar} style={{ display: "grid", gap: "0.75rem", marginTop: "0.9rem" }}>
      <label className="pn-campo-bloco">
        <span className="pn-rotulo">{pedido.rotulo ?? pedido.titulo}</span>
        {pedido.multilinha ? (
          <textarea autoFocus className="pn-campo" value={valor} placeholder={pedido.placeholder} onChange={(e) => setValor(e.target.value)} />
        ) : (
          <input autoFocus className="pn-campo" value={valor} placeholder={pedido.placeholder} onChange={(e) => setValor(e.target.value)} />
        )}
      </label>
      <div className="pn-dialogo-acoes" style={{ marginTop: 0 }}>
        <Botao onClick={() => fechar(pedido, null)}>{pedido.cancelar ?? "Cancelar"}</Botao>
        <Botao type="submit" variante="principal" disabled={vazio}>
          {pedido.confirmar ?? "Enviar"}
        </Botao>
      </div>
    </form>
  );
}

/** Monte uma vez só (em Painel.tsx): mostra as confirmações e perguntas pedidas por confirmar() e perguntar(), uma de cada vez. */
export function DialogosDoPainel() {
  const pedido = useSyncExternalStore(assinar, ver, () => null);
  if (!pedido) return null;
  return (
    <Dialogo key={fila.indexOf(pedido) + pedido.titulo} aberto aoMudar={(a) => !a && fechar(pedido, pedido.tipo === "confirmar" ? false : null)} titulo={pedido.titulo} texto={pedido.texto}>
      {pedido.tipo === "confirmar" ? (
        <div className="pn-dialogo-acoes">
          {/* Em ação que apaga, o foco começa em "Cancelar": um Enter sem querer não destrói nada. */}
          <Botao autoFocus={pedido.perigo} onClick={() => fechar(pedido, false)}>{pedido.cancelar ?? "Cancelar"}</Botao>
          <Botao variante={pedido.perigo ? "padrao" : "principal"} perigo={pedido.perigo} autoFocus={!pedido.perigo} onClick={() => fechar(pedido, true)}>
            {pedido.confirmar ?? "Confirmar"}
          </Botao>
        </div>
      ) : (
        <Pergunta pedido={pedido} />
      )}
    </Dialogo>
  );
}

// ───── Atalhos para quem vinha do confirm e do prompt do navegador ─────
// Recebem a mesma frase que o navegador mostrava, no lugar de um objeto: a primeira frase vira o título da janela,
// o resto vira o texto. O verbo do começo ("Apagar", "Enviar") vira o nome do botão; ações que apagam ou não se desfazem
// ganham o tom de perigo e o foco inicial em "Cancelar".

const VERBOS = ["apagar", "remover", "retirar", "tirar", "sair", "encerrar", "cancelar", "recusar", "desligar", "fechar", "pausar", "trocar", "publicar", "enviar", "aprovar", "aceitar", "mudar", "devolver", "liberar", "ligar", "gerar", "voltar", "juntar", "pôr", "assinar"];
const VERBOS_DE_PERIGO = new Set(["apagar", "remover", "retirar", "tirar", "sair", "encerrar", "cancelar", "recusar", "desligar", "fechar", "pausar"]);

/** Divide "Apagar a aula? Isso não tem volta." em título e texto. */
export function dividirFrase(mensagem: string): { titulo: string; texto?: string } {
  // A frase inteira é traduzida antes de dividir: o dicionário do painel guarda a pergunta como o navegador a mostrava.
  const limpa = traduzirNoPainel(mensagem).trim();
  const corte = limpa.match(/^([\s\S]+?[?.!])\s+([\s\S]+)$/);
  return corte ? { titulo: corte[1], texto: corte[2] } : { titulo: limpa };
}

/** Confirmação a partir de uma frase só (no lugar do confirm do navegador). Devolve true se a pessoa confirmou. */
export function confirmarFrase(mensagem: string, opcoes: { confirmar?: string; perigo?: boolean } = {}): Promise<boolean> {
  const verbo = mensagem.trim().split(/[\s:,]+/)[0]?.toLowerCase() ?? "";
  const conhecido = VERBOS.includes(verbo);
  const perigo = opcoes.perigo ?? (VERBOS_DE_PERIGO.has(verbo) || /não (tem volta|dá para desfazer|pode ser desfeita)/i.test(mensagem));
  return confirmar({
    ...dividirFrase(mensagem),
    confirmar: opcoes.confirmar ?? (conhecido ? verbo[0].toUpperCase() + verbo.slice(1) : "Confirmar"),
    perigo,
  });
}

/** Pergunta com um campo de texto (no lugar do prompt do navegador). Devolve o texto, ou null se a pessoa cancelou. */
export function perguntarTexto(mensagem: string, valorInicial: string | null = "", opcoes: { multilinha?: boolean; obrigatorio?: boolean } = {}): Promise<string | null> {
  const { titulo, texto } = dividirFrase(mensagem);
  const inicial = valorInicial ?? "";
  return perguntar({ titulo, texto, rotulo: "Sua resposta", valorInicial: inicial, multilinha: opcoes.multilinha ?? inicial.length > 80, obrigatorio: opcoes.obrigatorio });
}
