// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { type Locale, localeNames, locales } from "@/i18n/config";
import { useI18n } from "../I18n";

/**
 * O painel em outros idiomas, para voluntários de fora do Brasil.
 *
 * O texto do painel está escrito em português dentro dos componentes. Em vez de reescrever cada um, os dicionários
 * em i18n/painel/<idioma>.json trazem a tradução de cada frase (a chave é a frase em português, como aparece na
 * tela) e este componente troca o texto na página: na abertura e a cada mudança que o React faz. Frases com partes
 * variáveis viram modelos ("Escreva “{0}”"). O que a equipe escreve (mensagens, recados, pautas, o texto das aulas)
 * fica dentro de um elemento com data-original: este componente não mexe ali, mas a tradução do navegador continua
 * podendo traduzir. O que não pode mudar de jeito nenhum leva translate="no", como a folha do certificado e o termo
 * do podcast, que são documentos em português. A lista de frases sai de scripts/textos-do-painel.mjs.
 */

type Dicionario = Record<string, string>;

const dicionarios: Partial<Record<Locale, () => Promise<{ default: Dicionario }>>> = {
  en: () => import("@/i18n/painel/en.json"),
  es: () => import("@/i18n/painel/es.json"),
  fr: () => import("@/i18n/painel/fr.json"),
  ru: () => import("@/i18n/painel/ru.json"),
  zh: () => import("@/i18n/painel/zh.json"),
};

const ATRIBUTOS = ["placeholder", "title", "aria-label", "alt"] as const;
const PULAR = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT"]);
const normalizar = (texto: string) => texto.replace(/\s+/g, " ").trim();
const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Modelo {
  regra: RegExp;
  alvo: string;
  /** Qual {n} cada grupo da regra captura, na ordem em que aparecem na frase. */
  ordem: number[];
  /** O maior trecho fixo da frase: só se testa a regra quando ele aparece no texto. */
  pista: string;
  /** Quantas letras fixas a frase tem: no empate de pista, ganha a mais específica. */
  fixo: number;
}

/** Monta o tradutor de um dicionário: frases inteiras por busca direta, modelos com {n} por expressão regular. */
function tradutor(dicionario: Dicionario) {
  const exatos = new Map<string, string>();
  const modelos: Modelo[] = [];
  for (const [pt, alvo] of Object.entries(dicionario)) {
    if (!/\{\d+\}/.test(pt)) {
      exatos.set(pt, alvo);
      continue;
    }
    const partes = pt.split(/\{\d+\}/);
    const ordem = [...pt.matchAll(/\{(\d+)\}/g)].map((achado) => Number(achado[1]));
    const fonte = partes.map(escapar).join("([\\s\\S]+?)");
    modelos.push({
      regra: new RegExp(`^${fonte}$`),
      alvo,
      ordem,
      pista: partes.reduce((maior, parte) => (parte.trim().length > maior.length ? parte.trim() : maior), ""),
      fixo: partes.join("").length,
    });
  }
  // Os modelos mais específicos primeiro ("Alternativa {0} é a certa" antes de "Alternativa {0} certa").
  modelos.sort((a, b) => b.pista.length - a.pista.length || b.fixo - a.fixo);

  const nucleo = (texto: string): string | null => {
    const direto = exatos.get(texto);
    if (direto !== undefined) return direto;
    for (const modelo of modelos) {
      if (modelo.pista && !texto.includes(modelo.pista)) continue;
      const achado = modelo.regra.exec(texto);
      if (!achado) continue;
      // As partes variáveis também são traduzidas quando são uma frase conhecida (o nome de uma função, um idioma) ou
      // outro modelo ("Restam 3 códigos (gerados em …)"), com os mesmos espaços nas pontas.
      return modelo.alvo.replace(/\{(\d+)\}/g, (_, n: string) => {
        const valor = achado[modelo.ordem.indexOf(Number(n)) + 1] ?? "";
        const traduzido = normalizar(valor).length < 2 ? null : nucleo(normalizar(valor));
        return traduzido === null ? valor : `${/^\s*/.exec(valor)?.[0] ?? ""}${traduzido}${/\s*$/.exec(valor)?.[0] ?? ""}`;
      });
    }
    // Rótulos juntados num texto só ("Tradução · Revisão") e pares "rótulo: valor" ("função: Revisão", "Aulas enviadas: 3"):
    // cada pedaço por si. Um título como "Inglês: conversação e leitura" fica inteiro (rótulo maiúsculo e valor com letras).
    if (texto.includes(" · ")) {
      const juntos = texto.split(" · ").map((pedaco) => nucleo(pedaco) ?? pedaco).join(" · ");
      return juntos === texto ? null : juntos;
    }
    const par = /^([^:]{2,40}): (.+)$/.exec(texto);
    const rotulo = par ? exatos.get(par[1]) : undefined;
    if (par && rotulo !== undefined && (/^\p{Ll}/u.test(par[1]) || !/\p{L}/u.test(par[2]))) return `${rotulo}: ${nucleo(par[2]) ?? par[2]}`;
    return null;
  };

  /** A tradução do texto, com os mesmos espaços nas pontas; null quando não há tradução. */
  return (texto: string): string | null => {
    const limpo = normalizar(texto);
    if (limpo.length < 2 || !/\p{L}/u.test(limpo)) return null;
    const traduzido = nucleo(limpo);
    if (traduzido === null) return null;
    return `${/^\s*/.exec(texto)?.[0] ?? ""}${traduzido}${/\s*$/.exec(texto)?.[0] ?? ""}`;
  };
}

/** Traduz o painel aberto quando o idioma do endereço não é o português. Não desenha nada. */
export function TraduzirPainel() {
  const { lang } = useI18n();

  useEffect(() => {
    const carregar = dicionarios[lang];
    if (!carregar) return;
    let ativo = true;
    let observador: MutationObserver | null = null;
    const confirmar = window.confirm;
    const avisar = window.alert;

    void carregar().then(({ default: dicionario }) => {
      if (!ativo) return;
      const traduzir = tradutor(dicionario);
      // O que já foi trocado: assim a página sabe distinguir a própria tradução de um texto novo do React.
      const textos = new WeakMap<Text, string>();
      const atributos = new WeakMap<Element, Map<string, string>>();

      // data-traduzir reabre a tradução dentro de um data-original (o bloco do painel dentro do caderno do site).
      const protegido = (elemento: Element | null) => {
        if (!elemento || elemento.closest('[translate="no"], [contenteditable="true"]')) return Boolean(elemento);
        const original = elemento.closest("[data-original]");
        const traduzir = elemento.closest("[data-traduzir]");
        return Boolean(original && !(traduzir && original.contains(traduzir)));
      };

      const texto = (no: Text) => {
        const atual = no.nodeValue ?? "";
        if (textos.get(no) === atual) return;
        const pai = no.parentElement;
        if (!pai || PULAR.has(pai.tagName) || protegido(pai)) return;
        const novo = traduzir(atual);
        if (novo === null || novo === atual) return;
        textos.set(no, novo);
        no.nodeValue = novo;
      };

      const atributo = (elemento: Element, nome: string) => {
        const atual = elemento.getAttribute(nome);
        if (!atual) return;
        const feitos = atributos.get(elemento) ?? new Map<string, string>();
        if (feitos.get(nome) === atual) return;
        const novo = traduzir(atual);
        if (novo === null || novo === atual) return;
        feitos.set(nome, novo);
        atributos.set(elemento, feitos);
        elemento.setAttribute(nome, novo);
      };

      const percorrer = (raiz: Node) => {
        if (raiz.nodeType === Node.TEXT_NODE) return texto(raiz as Text);
        if (!(raiz instanceof Element) || PULAR.has(raiz.tagName)) return;
        if (protegido(raiz)) {
          // Um bloco do painel dentro de texto protegido (data-traduzir) se traduz por si.
          raiz.querySelectorAll("[data-traduzir]").forEach((bloco) => {
            if (!protegido(bloco)) percorrer(bloco);
          });
          return;
        }
        for (const nome of ATRIBUTOS) atributo(raiz, nome);
        for (const elemento of raiz.querySelectorAll(ATRIBUTOS.map((nome) => `[${nome}]`).join(","))) {
          if (!protegido(elemento)) for (const nome of ATRIBUTOS) atributo(elemento, nome);
        }
        const andador = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
        for (let no = andador.nextNode(); no; no = andador.nextNode()) texto(no as Text);
      };

      percorrer(document.body);
      observador = new MutationObserver((mudancas) => {
        for (const mudanca of mudancas) {
          if (mudanca.type === "characterData") texto(mudanca.target as Text);
          else if (mudanca.type === "attributes" && mudanca.attributeName) atributo(mudanca.target as Element, mudanca.attributeName);
          else mudanca.addedNodes.forEach(percorrer);
        }
      });
      observador.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATRIBUTOS] });

      // As perguntas de confirmação ("Apagar esta aula?") também saem no idioma escolhido.
      window.confirm = (mensagem?: string) => confirmar.call(window, mensagem ? (traduzir(mensagem) ?? mensagem) : mensagem);
      window.alert = (mensagem?: unknown) => avisar.call(window, typeof mensagem === "string" ? (traduzir(mensagem) ?? mensagem) : mensagem);
    });

    return () => {
      ativo = false;
      observador?.disconnect();
      window.confirm = confirmar;
      window.alert = avisar;
    };
  }, [lang]);

  return null;
}

/** Escolha do idioma dentro do painel: troca o endereço e mantém a seção aberta. */
export function IdiomaDoPainel({ className = "" }: { className?: string }) {
  const { lang, t } = useI18n();
  const router = useRouter();
  return (
    <select
      aria-label={t.common.language}
      title={t.common.language}
      value={lang}
      translate="no"
      onChange={(e) => router.replace(`/${e.target.value}/painel${window.location.search}`)}
      className={`cursor-pointer border border-[#3a3226] bg-[#17130e] px-1.5 py-1 text-xs text-[#efe4c8] hover:border-[#d4a24c] ${className}`}
    >
      {locales.map((codigo) => (
        <option key={codigo} value={codigo} lang={codigo}>
          {localeNames[codigo]}
        </option>
      ))}
    </select>
  );
}
