// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import NextLink from "./Link";
import { createContext, useContext, useMemo, type ComponentProps } from "react";
import { localePath, type Locale } from "@/i18n/config";
import { extraSections, type CoreDict } from "@/i18n/core";

const Context = createContext<{ lang: Locale; t: CoreDict } | null>(null);

/**
 * Põe os textos ao alcance dos componentes do navegador. O layout manda o núcleo sem as seções extras (pickBase); a rota
 * que precisa de uma delas (t.areas) aninha outro provedor só com ela, e os dois se juntam aqui:
 * <I18nProvider lang={lang} t={pickSections(t, ["areas"])}>.
 */
export function I18nProvider({ lang, t, children }: { lang: Locale; t: Partial<CoreDict>; children: React.ReactNode }) {
  const pai = useContext(Context);
  const valor = useMemo(() => ({ lang, t: (pai ? { ...pai.t, ...t } : t) as CoreDict }), [lang, t, pai]);
  return <Context.Provider value={valor}>{children}</Context.Provider>;
}

// Em desenvolvimento, ler uma seção extra numa rota que não a acrescentou dá um erro que diz o que fazer, em vez do
// "cannot read properties of undefined" sem pista. Em produção o objeto vai direto, sem custo.
type Valor = { lang: Locale; t: CoreDict };
const avisos = new WeakMap<Valor, Valor>();
function comAviso(valor: Valor): Valor {
  if (process.env.NODE_ENV === "production") return valor;
  let embrulhado = avisos.get(valor);
  if (!embrulhado) {
    const t = new Proxy(valor.t, {
      get(alvo, chave, recebedor) {
        if (typeof chave === "string" && !(chave in alvo) && (extraSections as readonly string[]).includes(chave)) {
          throw new Error(`t.${chave} não chegou a esta rota: acrescente <I18nProvider lang={lang} t={pickSections(t, ["${chave}"])}> na página (veja extraSections em i18n/core.ts).`);
        }
        return Reflect.get(alvo, chave, recebedor);
      },
    });
    embrulhado = { lang: valor.lang, t };
    avisos.set(valor, embrulhado);
  }
  return embrulhado;
}

/** Idioma e textos comuns da página atual, para componentes do navegador. */
export function useI18n() {
  const value = useContext(Context);
  if (!value) throw new Error("useI18n precisa estar dentro de I18nProvider");
  return comAviso(value);
}

/** Link interno que acrescenta o prefixo do idioma atual: <L href="/trilhas">. */
export function L({ href, ...props }: Omit<ComponentProps<typeof NextLink>, "href"> & { href: string }) {
  const { lang } = useI18n();
  return <NextLink href={localePath(lang, href)} {...props} />;
}
