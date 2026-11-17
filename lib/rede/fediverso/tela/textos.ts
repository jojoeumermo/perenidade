// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos de gente de fora na tela da Alumia: i18n/rede/fediverso/{pt,en,es,fr,ru,zh}.json (pt é o final; os outros cinco são
// rascunho marcado). Carrega só o idioma pedido, sob demanda, e guarda em memória. Sem "@/" de propósito (roda no Node nos testes).
import { useEffect, useState } from "react";
import type pt from "../../../../i18n/rede/fediverso/pt.json";

export type TextosDoFediverso = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../../i18n/rede/fediverso/pt.json"),
  en: () => import("../../../../i18n/rede/fediverso/en.json"),
  es: () => import("../../../../i18n/rede/fediverso/es.json"),
  fr: () => import("../../../../i18n/rede/fediverso/fr.json"),
  ru: () => import("../../../../i18n/rede/fediverso/ru.json"),
  zh: () => import("../../../../i18n/rede/fediverso/zh.json"),
};

const guardados = new Map<string, TextosDoFediverso>();
const pedidos = new Map<string, Promise<TextosDoFediverso>>();

/** Os textos do idioma pedido; idioma desconhecido (ou que não carregou) cai no português. */
export function carregarTextosDoFediverso(lang: string): Promise<TextosDoFediverso> {
  const idioma = lang in CARREGAR ? lang : "pt";
  const pronto = guardados.get(idioma);
  if (pronto) return Promise.resolve(pronto);
  let pedido = pedidos.get(idioma);
  if (!pedido) {
    pedido = CARREGAR[idioma]()
      .catch(() => CARREGAR.pt())
      .then((m) => {
        const t = m.default as TextosDoFediverso;
        guardados.set(idioma, t);
        return t;
      });
    // Se nem o português veio, o próximo pedido tenta de novo.
    pedido.catch(() => pedidos.delete(idioma));
    pedidos.set(idioma, pedido);
  }
  return pedido;
}

/** Os textos na tela: nulo enquanto carregam (a tela mostra o esqueleto), depois o idioma pedido. */
export function useTextosDoFediverso(lang: string): TextosDoFediverso | null {
  const idioma = lang in CARREGAR ? lang : "pt";
  // O que já está na memória sai direto no desenho; o estado só guarda o que chegou depois, com o idioma a que pertence.
  const [chegou, setChegou] = useState<{ idioma: string; t: TextosDoFediverso } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDoFediverso(idioma).then((t) => vivo && setChegou((antes) => (antes?.idioma === idioma && antes.t === t ? antes : { idioma, t })), () => undefined);
    return () => {
      vivo = false;
    };
  }, [idioma]);
  return guardados.get(idioma) ?? (chegou?.idioma === idioma ? chegou.t : null);
}

/** O código de erro das rotas e do banco vira o texto do idioma; o que não se conhece vira a mensagem genérica. */
export function textoDoErroDeFora(t: Pick<TextosDoFediverso, "erros">, codigo: string | null | undefined): string {
  const erros = t.erros as Record<string, string>;
  const chave = (codigo ?? "").split(":")[0];
  return (Object.hasOwn(erros, chave) && erros[chave]) || erros.falha;
}
