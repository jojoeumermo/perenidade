// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

/**
 * A janela de confirmação da casa, no lugar do confirm() e do prompt() do navegador (P5, A17), em todas as telas do site, da
 * Escola e da Alumia. O confirm() do navegador mostrava "JavaScript de …" e o endereço, não seguia o visual nem o idioma e, no
 * celular, parecia um aviso de golpe. O modelo é a janela do chat (components/rede/chat/Confirmar.tsx): um <dialog> modal que
 * prende o foco, fecha com Esc e com toque fora, começa em "Cancelar" (nada se apaga com um Enter distraído) e, ao fechar, devolve
 * o foco a quem abriu.
 *
 * É uma função que devolve uma promessa, para trocar o confirm() sem mexer no resto da tela: `if (!(await confirmar(texto)))
 * return;`. Monta o <dialog> com o DOM, sem React, e só com textContent (nada do texto vira HTML). Na Alumia a janela veste a pele
 * dela (.al-pele, os tokens dos dois temas); no site e na Escola, os tokens do site.
 */

type Idioma = "pt" | "en" | "es" | "fr" | "ru" | "zh";

const BOTOES: Record<Idioma, { cancelar: string; confirmar: string; ok: string; copiar: string }> = {
  pt: { cancelar: "Cancelar", confirmar: "Confirmar", ok: "OK", copiar: "Copiar" },
  en: { cancelar: "Cancel", confirmar: "Confirm", ok: "OK", copiar: "Copy" },
  es: { cancelar: "Cancelar", confirmar: "Confirmar", ok: "Aceptar", copiar: "Copiar" },
  fr: { cancelar: "Annuler", confirmar: "Confirmer", ok: "OK", copiar: "Copier" },
  ru: { cancelar: "Отмена", confirmar: "Подтвердить", ok: "ОК", copiar: "Копировать" },
  zh: { cancelar: "取消", confirmar: "确认", ok: "确定", copiar: "复制" },
};

/** Os botões no idioma da página (o <html lang> que o layout põe); fora da lista, português. */
function botoes() {
  const l = (typeof document === "undefined" ? "pt" : document.documentElement.lang || "pt").slice(0, 2).toLowerCase() as Idioma;
  return BOTOES[l] ?? BOTOES.pt;
}

export interface OpcoesDaPergunta {
  /** O texto do botão que faz (padrão: "Confirmar"). */
  sim?: string;
  /** O texto do botão que desiste (padrão: "Cancelar"). */
  nao?: string;
  /** A ação apaga ou tira alguma coisa: o botão que faz fica vermelho. */
  perigo?: boolean;
}

const CLASSE_BOTAO =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full px-5 py-2 text-sm font-bold transition-[filter,background-color] focus-visible:outline-2 focus-visible:outline-offset-2";
const CLASSE_LEVE = `${CLASSE_BOTAO} border border-[var(--al-superficie-2,var(--rule))] bg-transparent text-[var(--al-texto,var(--ink))] hover:bg-[var(--al-superficie-2,var(--parchment-deep))]`;
const CLASSE_FAZ = `${CLASSE_BOTAO} border border-transparent bg-[var(--al-texto,var(--ink))] text-[var(--al-fundo,var(--parchment))] hover:brightness-110`;
const CLASSE_PERIGO = `${CLASSE_BOTAO} border border-transparent bg-[var(--al-vermelho,var(--oxblood))] text-white hover:brightness-110`;

let aberta: Promise<unknown> = Promise.resolve();

/** Monta a janela, espera a resposta e desmonta. `campo` presente = pergunta com resposta escrita (o prompt()). */
function janela(pergunta: string, opcoes: OpcoesDaPergunta & { campo?: { valor: string; soLer?: boolean } }): Promise<string | null> {
  const b = botoes();
  const dialogo = document.createElement("dialog");
  // .al-pele: dentro da Alumia, os tokens dela (styles/alumia-tokens.css); fora, a classe não faz nada.
  dialogo.className =
    "janela-da-casa al-pele m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-[var(--al-superficie-2,var(--rule))] bg-[var(--al-superficie,var(--parchment))] p-0 text-[var(--al-texto,var(--ink))] shadow-xl backdrop:bg-black/50";
  const id = `janela-${Math.random().toString(36).slice(2)}`;
  dialogo.setAttribute("aria-labelledby", id);
  const miolo = document.createElement("form");
  miolo.method = "dialog";
  miolo.className = "space-y-5 p-5";
  const texto = document.createElement("p");
  texto.id = id;
  texto.className = "whitespace-pre-line text-base leading-relaxed";
  texto.textContent = pergunta;
  miolo.append(texto);

  let entrada: HTMLInputElement | null = null;
  if (opcoes.campo) {
    entrada = document.createElement("input");
    entrada.type = "text";
    entrada.value = opcoes.campo.valor;
    entrada.readOnly = !!opcoes.campo.soLer;
    entrada.setAttribute("aria-labelledby", id);
    entrada.className =
      "block min-h-11 w-full rounded-xl border border-[var(--al-superficie-2,var(--rule))] bg-[var(--al-fundo,var(--folha,#fff))] px-3 text-base text-[var(--al-texto,var(--ink))]";
    miolo.append(entrada);
  }

  const linha = document.createElement("div");
  linha.className = "flex flex-wrap justify-end gap-2";
  const cancelar = document.createElement("button");
  cancelar.type = "button";
  cancelar.className = CLASSE_LEVE;
  cancelar.textContent = opcoes.nao ?? b.cancelar;
  const fazer = document.createElement("button");
  fazer.type = "submit";
  fazer.className = opcoes.perigo ? CLASSE_PERIGO : CLASSE_FAZ;
  fazer.textContent = opcoes.sim ?? (opcoes.campo ? b.ok : b.confirmar);
  linha.append(cancelar, fazer);
  miolo.append(linha);
  dialogo.append(miolo);

  return new Promise<string | null>((resolver) => {
    let resposta: string | null = null;
    miolo.addEventListener("submit", (e) => {
      e.preventDefault();
      resposta = entrada ? entrada.value : "sim";
      if (entrada && opcoes.campo?.soLer) {
        // Copiar: o campo selecionado vai para a área de transferência pelo caminho antigo (o novo é o que tinha falhado).
        entrada.select();
        try {
          document.execCommand("copy");
        } catch {
          // nada a fazer: o endereço ficou à vista para copiar à mão
        }
      }
      dialogo.close();
    });
    cancelar.addEventListener("click", () => dialogo.close());
    // O Esc fecha só esta janela: não sobe para quem ouve o Esc na página (o Escrever, um menu aberto), que fecharia junto ou
    // perguntaria de novo. A saída rápida (três Esc) ouve na captura e continua valendo.
    dialogo.addEventListener("keydown", (e) => {
      if (e.key === "Escape") e.stopPropagation();
    });
    dialogo.addEventListener("click", (e) => {
      if (e.target === dialogo) dialogo.close();
    });
    dialogo.addEventListener("close", () => {
      dialogo.remove();
      resolver(resposta);
    });
    document.body.append(dialogo);
    dialogo.showModal();
    if (entrada && !opcoes.campo?.soLer) {
      entrada.focus();
      entrada.select();
    } else if (entrada) {
      entrada.select();
      cancelar.focus();
    } else cancelar.focus();
  });
}

/** Uma janela por vez: a segunda espera a primeira fechar (como o confirm() do navegador, que também bloqueava). */
function emFila<T>(fazer: () => Promise<T>): Promise<T> {
  const vez = aberta.then(fazer, fazer);
  aberta = vez.catch(() => undefined);
  return vez;
}

/** O confirm() da casa: true se a pessoa confirmou; Esc, toque fora e "Cancelar" dão false. */
export function confirmar(pergunta: string, opcoes: OpcoesDaPergunta = {}): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  return emFila(() => janela(pergunta, opcoes)).then((r) => r !== null);
}

/** O prompt() da casa: o que a pessoa escreveu, ou null se desistiu. */
export function perguntar(pergunta: string, valor = "", opcoes: OpcoesDaPergunta = {}): Promise<string | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  return emFila(() => janela(pergunta, { ...opcoes, campo: { valor } }));
}

/**
 * O "copie este endereço" que antes era um prompt("", url) quando a área de transferência falhava: o endereço num campo só de
 * leitura, já selecionado, com o botão Copiar.
 */
export function mostrarParaCopiar(rotulo: string, valor: string): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  const b = botoes();
  return emFila(() => janela(rotulo || valor, { campo: { valor, soLer: true }, sim: b.copiar, nao: b.ok })).then(() => undefined);
}
