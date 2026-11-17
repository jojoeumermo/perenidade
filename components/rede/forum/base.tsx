// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import { forum, topicosDeExemplo, type EstadoDoTopico, type ForumDaConversa } from "@/lib/rede/forum-conversa";
import type { TextosDaRede } from "@/lib/rede/textos";
import { carregarTextosDoForum, textoDeErroDoForum, type TextosDoForum } from "@/lib/rede/textos-forum-conversa";
import { codigoDoErro, textoDoErro } from "../erros";
import { previa } from "../conversa/base3";

const cache = new Map<string, TextosDoForum>();

/** Os textos do fórum no idioma da página (um pedaço só, carregado quando a primeira tela do fórum abre). */
export function useTextosDoForum(lang: string, ativo = true): TextosDoForum | null {
  const [chegou, setChegou] = useState<{ lang: string; texto: TextosDoForum } | null>(null);
  useEffect(() => {
    if (!ativo || cache.has(lang)) return;
    let vivo = true;
    carregarTextosDoForum(lang)
      .then((texto) => {
        cache.set(lang, texto);
        if (vivo) setChegou({ lang, texto });
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang, ativo]);
  return cache.get(lang) ?? (chegou?.lang === lang ? chegou.texto : null);
}

/** O erro em texto: primeiro os do fórum, depois os da Rede. */
export function erroDoForum(tf: TextosDoForum, s: TextosDaRede, e: unknown): string {
  return textoDeErroDoForum(tf, codigoDoErro(e)) ?? textoDoErro(s, e);
}

/** A situação do tópico como carimbo: ícone e texto (nunca só a cor), torto como carimbo de tinta. */
export function CarimboDoEstado({ estado, tf, pequeno = false }: { estado: EstadoDoTopico; tf: TextosDoForum; pequeno?: boolean }) {
  return (
    <span className={`f10-carimbo${pequeno ? " f10-carimbo-p" : ""}`} data-estado={estado} title={tf.estado.regra[estado]}>
      <IconeDoEstado estado={estado} />
      {tf.estado[estado]}
    </span>
  );
}

export function IconeDoEstado({ estado }: { estado: EstadoDoTopico }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      {estado === "resolvido" ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : estado === "encaminhado" ? <path d="M4 12h13M12 6l6 6-6 6" /> : <circle cx="12" cy="12" r="6.5" />}
    </svg>
  );
}

/** O que o fórum sabe da conversa aberta (nulo enquanto carrega, ou se o banco ainda não tem o fórum). */
export function useForumDaConversa(raiz: string | null, versao: number): { dado: ForumDaConversa | null; trocar: (novo: ForumDaConversa) => void } {
  const [estado, setEstado] = useState<{ chave: string; dado: ForumDaConversa | null } | null>(null);
  const chave = `${raiz}:${versao}`;
  useEffect(() => {
    if (!raiz) return;
    let vivo = true;
    const pedir = previa() ? Promise.resolve(forumDaPrevia(raiz)) : forum.topico(raiz);
    pedir
      .then((dado) => vivo && setEstado({ chave, dado }))
      // Sem a migração do fórum (ou sem permissão de ler), a conversa segue como era: nada do fórum aparece.
      .catch(() => {
        if (vivo) setEstado({ chave, dado: null });
      });
    return () => {
      vivo = false;
    };
  }, [raiz, chave]);
  const trocar = useCallback((novo: ForumDaConversa) => setEstado({ chave, dado: novo }), [chave]);
  return { dado: estado?.chave === chave ? estado.dado : null, trocar };
}

/** Na prévia: os tópicos de exemplo são tópicos; a conversa da Lia mostra uma resposta que continua no fórum. */
function forumDaPrevia(raiz: string): ForumDaConversa {
  const pagina = topicosDeExemplo("exemplo");
  const item = [...pagina.fixados, ...pagina.itens].find((t) => t.id === raiz) ?? null;
  return {
    raiz,
    topico: Boolean(item),
    item,
    pode_mudar: Boolean(item),
    modero: true,
    veio_de: item?.veio ? "00000000-0000-4000-8000-0000000000c1" : null,
    continua: [],
  };
}
