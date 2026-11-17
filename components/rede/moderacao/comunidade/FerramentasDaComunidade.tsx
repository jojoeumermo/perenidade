// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "../o9.css";
import { useEffect, useState } from "react";
import { moderacaoDaComunidade, type AutomodDaComunidade } from "@/lib/rede/comunidade-moderacao";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaModeracao } from "@/lib/rede/textos-moderacao";
import { mensagemDeErro } from "../base";
import { AlertasDeBrigada } from "./AlertasDeBrigada";
import { FiltroAutomatico } from "./FiltroAutomatico";
import { ModoLento } from "./ModoLento";
import { PedidosEPerguntas } from "./PedidosEPerguntas";

/**
 * As ferramentas de quem modera UMA comunidade (onda 9): o filtro automático, o modo lento, o alerta de brigada, os pedidos com
 * as respostas e as perguntas para entrar (essas duas só em comunidade restrita). Aparece na aba Sobre da página da comunidade (Moderar) e na fila de moderação, aba
 * Comunidades. O banco confere de novo quem modera em cada chamada.
 */
export function FerramentasDaComunidade({ slug, lang, s, sm, comPedidos = true, aoMudar }: {
  slug: string;
  lang: string;
  s: Pick<TextosDaRede, "erros">;
  sm: TextosDaModeracao;
  /** Os pedidos para entrar e as perguntas (só em comunidade restrita). Falso deixa os dois de fora. */
  comPedidos?: boolean;
  aoMudar?: () => void;
}) {
  const [regras, setRegras] = useState<{ slug: string; dado: AutomodDaComunidade } | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    moderacaoDaComunidade.automod(slug).then(
      (dado) => vivo && (setRegras({ slug, dado }), setErro("")),
      (e) => vivo && setErro(mensagemDeErro(s, sm, e)),
    );
    return () => {
      vivo = false;
    };
  }, [slug, s, sm]);

  if (erro) return <p className="m9-erro" role="alert">{erro}</p>;
  if (!regras || regras.slug !== slug) return <p className="m9-nota" role="status">{sm.carregando}</p>;
  const r = regras.dado;
  const atualizar = (dado: AutomodDaComunidade) => setRegras({ slug, dado });
  return (
    <div className="m9 m9-grade">
      <FiltroAutomatico key={`f:${slug}`} slug={slug} s={s} sm={sm} regras={r} aoSalvar={atualizar} />
      <ModoLento slug={slug} s={s} sm={sm} segundos={r.lento} aoMudar={(n) => atualizar({ ...r, lento: n })} />
      <AlertasDeBrigada key={`b:${slug}`} lang={lang} s={s} sm={sm} comunidade={slug} regras={r} aoSalvar={atualizar} />
      {comPedidos && r.tipo === "restrita" && <PedidosEPerguntas key={`p:${slug}`} slug={slug} lang={lang} s={s} sm={sm} restrita={r.tipo === "restrita"} aoMudar={aoMudar} />}
    </div>
  );
}

export default FerramentasDaComunidade;
