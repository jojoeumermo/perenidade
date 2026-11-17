// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As peças de tela dos posts restritos cifrados (P21): o selo do compositor (com os custos de docs/rede/POSTS-RESTRITOS.md) e o
// texto do cartão, aberto neste aparelho. A biblioteca do MLS só é baixada quando um post cifrado aparece (import dinâmico).
import { useEffect, useState, type ReactNode } from "react";
import { Icone } from "../alumia2/icones";
import { ABERTOS_NA_PREVIA } from "./previa";
import type { TextosDoRestrito } from "./textos";
import "./restrito.css";

/**
 * O selo do compositor quando o post vai cifrado: diz para quem (núcleo ou comunidade) e, num "O que muda com a cifra" que abre
 * no toque, os custos (busca só no aparelho, aviso sem prévia, denúncia com o trecho aberto, nunca federa).
 */
export function SeloDaCifra({ t, onde, nota }: { t: TextosDoRestrito; onde: "nucleo" | "comunidade"; nota?: ReactNode }) {
  return (
    <div className="al-restrito-selo" role="note">
      <p className="al-restrito-linha">
        <Icone nome="cadeado" className="h-4 w-4 shrink-0" />
        <span className="font-bold">{t.selo}</span>
      </p>
      <p className="al-restrito-explica">{onde === "nucleo" ? t.explicaNucleo : t.explicaComunidade}</p>
      <details className="al-restrito-custos">
        <summary>{t.custosTitulo}</summary>
        <ul>
          {t.custos.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </details>
      {nota}
    </div>
  );
}

type PostDoGrupo = { id: string; grupo?: string | null; corpo_grupo?: string | null; autor: { id: string | null } };

/**
 * O texto de um post cifrado: abre neste aparelho e entrega o texto a `mostrar` (o cartão põe no TextoDoPost de sempre). Enquanto
 * abre, "Abrindo neste aparelho…"; se não abre, "Não dá para abrir neste aparelho". Na prévia, o dublê (./previa.ts).
 */
export function TextoDoGrupo({ post, t, previa, mostrar }: { post: PostDoGrupo; t: TextosDoRestrito | null; previa: boolean; mostrar: (texto: string) => ReactNode }) {
  const chave = `${post.id}:${post.corpo_grupo ?? ""}`;
  const [aberto, setAberto] = useState<{ chave: string; texto: string | null } | null>(null);
  useEffect(() => {
    let vivo = true;
    const abrir = previa
      ? Promise.resolve(ABERTOS_NA_PREVIA[post.id] ?? null)
      : import("./aparelho").then((m) => m.abrirNoAparelho(post));
    abrir.then(
      (texto) => vivo && setAberto({ chave, texto }),
      () => vivo && setAberto({ chave, texto: null }),
    );
    return () => {
      vivo = false;
    };
    // O post só muda de verdade quando muda o id ou o corpo (a chave).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, previa]);

  const atual = aberto?.chave === chave ? aberto : null;
  if (atual?.texto) {
    return (
      <>
        <p className="al-restrito-marca">
          <Icone nome="cadeado" className="h-3.5 w-3.5 shrink-0" />
          <span>{t?.selo}</span>
        </p>
        {mostrar(atual.texto)}
      </>
    );
  }
  if (!atual) {
    return (
      <p className="al-restrito-fechado" role="status" aria-live="polite">
        <Icone nome="cadeado" className="h-4 w-4 shrink-0" />
        <span>{t?.abrindo}</span>
      </p>
    );
  }
  return (
    <div className="al-restrito-fechado">
      <Icone nome="cadeado" className="h-4 w-4 shrink-0" />
      <span>
        <span className="block font-bold">{t?.naoAbre}</span>
        <span className="block text-[0.8125rem]">{t?.naoAbreAjuda}</span>
      </span>
    </div>
  );
}

/**
 * Deixa este aparelho pronto para os posts cifrados do grupo (publica os pacotes de chave, se faltarem), para quem escrever já pôr
 * este aparelho no grupo. A página da comunidade fechada monta isto para quem é membro. Não desenha nada.
 */
export function AparelhoProntoParaOGrupo({ previa }: { previa: boolean }) {
  useEffect(() => {
    if (previa) return;
    void import("./aparelho").then((m) => m.prepararOAparelho());
  }, [previa]);
  return null;
}
