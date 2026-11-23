// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import type { Comunidade } from "@/lib/rede/tipos";

/**
 * "Sobre a comunidade" na coluna da direita (Prompt 5, A11: a comunidade com as regras ao lado, como no Reddit). A página da
 * comunidade publica aqui o que ela já carregou (nenhum pedido a mais ao banco) e limpa ao sair; a coluna da direita da casca
 * desenha o cartão só enquanto o endereço é o da comunidade. Só o que a página pública já mostra: nome, descrição, como se entra
 * e as regras. Nada de membros nem de quem modera.
 */
export interface SobreDaComunidade {
  comunidade: Pick<Comunidade, "slug" | "nome" | "descricao" | "regras">;
  /** O texto de "como se entra" já no idioma da página. */
  comoEntra: string;
  rotulos: { regras: string; comoEntra: string; verTudo: string };
  /** Leva a página para a aba Sobre, com o foco nas regras. */
  verTudo: () => void;
}

let atual: SobreDaComunidade | null = null;
const ouvintes = new Set<() => void>();

/** A página da comunidade diz o que carregou (ou nulo, ao sair). */
export function publicarSobreAoLado(sobre: SobreDaComunidade | null) {
  atual = sobre;
  for (const o of ouvintes) o();
}

function ouvir(o: () => void) {
  ouvintes.add(o);
  return () => {
    ouvintes.delete(o);
  };
}

/** O cartão da coluna da direita. Fora da página de uma comunidade, não desenha nada. */
export function SobreAoLado() {
  const sobre = useSyncExternalStore(ouvir, () => atual, () => null);
  const caminho = usePathname() ?? "";
  if (!sobre) return null;
  const { comunidade: c, rotulos } = sobre;
  // Só na página desta comunidade (/<lang>/alumia/c/<slug>, e /wiki): ao trocar de tela antes da limpeza, nada fica para trás.
  if (!new RegExp(`/alumia/c/${c.slug}(/wiki)?/?$`).test(caminho)) return null;
  return (
    <section className="al3-sobre-lado" aria-labelledby="al3-sobre-lado-titulo">
      <h2 id="al3-sobre-lado-titulo" className="al3-cond">{c.nome}</h2>
      {c.descricao && <p className="al3-sobre-lado-texto">{c.descricao}</p>}
      <p className="al3-sobre-lado-texto">
        <strong>{rotulos.comoEntra}:</strong> {sobre.comoEntra}
      </p>
      {c.regras.length > 0 && (
        <>
          <h3>{rotulos.regras}</h3>
          <ol className="al3-sobre-lado-regras">
            {c.regras.map((r) => (
              <li key={r.numero}>
                {r.texto ? (
                  <details>
                    <summary>{r.titulo}</summary>
                    <p>{r.texto}</p>
                  </details>
                ) : (
                  <span>{r.titulo}</span>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
      <button type="button" className="al3-sobre-lado-ver" onClick={sobre.verTudo}>
        {rotulos.verTudo}
      </button>
    </section>
  );
}
