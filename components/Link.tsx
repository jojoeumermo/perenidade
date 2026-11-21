// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import NextLink from "next/link";
import { useSyncExternalStore, type ComponentProps } from "react";

// O <Link> do site. Igual ao do Next, menos numa coisa: quem está em economia de dados (o modo leve do site, o
// "Economizar dados" do celular) ou numa conexão 2G/3G não paga o pré-carregamento das páginas dos links que aparecem
// na tela. Numa aula ou na Comunidade isso chegava a meio megabyte por página, gasto em páginas que a pessoa talvez
// nunca abra. A página só vem quando ela toca no link.

type Conexao = { saveData?: boolean; effectiveType?: string; addEventListener?: (tipo: string, f: () => void) => void; removeEventListener?: (tipo: string, f: () => void) => void };
const conexao = () => (typeof navigator === "undefined" ? undefined : (navigator as { connection?: Conexao }).connection);

function economia() {
  const c = conexao();
  return document.documentElement.hasAttribute("data-light") || c?.saveData === true || /(^|-)(2g|3g)$/.test(c?.effectiveType ?? "");
}

// Um só observador para todos os links da página: o modo leve muda o atributo data-light em <html>.
const avisar = new Set<() => void>();
let observador: MutationObserver | null = null;
function assinar(f: () => void) {
  avisar.add(f);
  if (!observador) {
    observador = new MutationObserver(() => avisar.forEach((g) => g()));
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-light"] });
    conexao()?.addEventListener?.("change", disparar);
  }
  return () => {
    avisar.delete(f);
    if (avisar.size === 0 && observador) {
      observador.disconnect();
      observador = null;
      conexao()?.removeEventListener?.("change", disparar);
    }
  };
}
function disparar() {
  avisar.forEach((g) => g());
}

// A troca de tela animada da Alumia (Prompt 5, A17; components/rede/publicar/alumia2/TransicaoDaTela.tsx): a casca da Alumia registra
// aqui quem cuida da navegação. Sem registro (o site, a Escola, o painel), o link navega como sempre.
type NavegacaoAnimada = (href: string) => boolean;
let navegacaoAnimada: NavegacaoAnimada | null = null;
export function registrarNavegacaoAnimada(f: NavegacaoAnimada): () => void {
  navegacaoAnimada = f;
  return () => {
    if (navegacaoAnimada === f) navegacaoAnimada = null;
  };
}

export default function Link(props: ComponentProps<typeof NextLink>) {
  const poupar = useSyncExternalStore(assinar, economia, () => false);
  const { onNavigate, href, replace } = props;
  return (
    <NextLink
      {...props}
      prefetch={poupar ? false : props.prefetch}
      onNavigate={(e) => {
        onNavigate?.(e);
        // Só a navegação dentro do site (o Next chama isto só para ela), com endereço em texto e sem "replace".
        if (navegacaoAnimada && typeof href === "string" && !replace && navegacaoAnimada(href)) e.preventDefault();
      }}
    />
  );
}
