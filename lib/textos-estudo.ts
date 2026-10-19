// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Locale } from "@/i18n/config";
import en from "@/i18n/estudo/en.json";
import es from "@/i18n/estudo/es.json";
import fr from "@/i18n/estudo/fr.json";
import pt from "@/i18n/estudo/pt.json";
import ru from "@/i18n/estudo/ru.json";
import zh from "@/i18n/estudo/zh.json";

// Os textos dos recursos novos (Meu estudo, exercícios, turma, nivelamento…) ficam num dicionário à parte, em
// i18n/estudo/. O português é a referência e está completo; os outros idiomas podem ter só parte das chaves (ou
// nenhuma): o que faltar aparece em português, e a página mostra o aviso de "ainda não traduzido".
// Para traduzir, copie as chaves de pt.json para o arquivo do idioma e troque os textos.

export type TextosDoEstudo = typeof pt;

const parciais: Record<Locale, unknown> = { pt, en, es, zh, ru, fr };

type Arvore = { [chave: string]: unknown };
const objeto = (valor: unknown): valor is Arvore => typeof valor === "object" && valor !== null && !Array.isArray(valor);

/** Junta a tradução por cima do português e diz se faltou alguma chave. */
function juntar(base: unknown, traducao: unknown): { valor: unknown; completo: boolean } {
  if (objeto(base)) {
    const saida: Arvore = {};
    let completo = objeto(traducao);
    for (const [chave, filho] of Object.entries(base)) {
      const r = juntar(filho, objeto(traducao) ? traducao[chave] : undefined);
      saida[chave] = r.valor;
      completo &&= r.completo;
    }
    return { valor: saida, completo };
  }
  if (Array.isArray(base)) {
    const ok = Array.isArray(traducao) && traducao.length === base.length && traducao.every((item) => typeof item === typeof base[0]);
    return { valor: ok ? traducao : base, completo: ok };
  }
  const ok = typeof traducao === typeof base && (typeof traducao !== "string" || traducao.trim() !== "");
  return { valor: ok ? traducao : base, completo: ok };
}

const guardados = new Map<Locale, { s: TextosDoEstudo; traduzido: boolean }>();

/** Os textos no idioma pedido; `traduzido` é falso quando algum trecho caiu no português. */
export function textosDoEstudo(lang: Locale): { s: TextosDoEstudo; traduzido: boolean } {
  const pronto = guardados.get(lang);
  if (pronto) return pronto;
  const { valor, completo } = lang === "pt" ? { valor: pt, completo: true } : juntar(pt, parciais[lang]);
  const resultado = { s: valor as TextosDoEstudo, traduzido: completo };
  guardados.set(lang, resultado);
  return resultado;
}
