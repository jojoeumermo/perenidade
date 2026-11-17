// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useState } from "react";
import { redePub } from "@/lib/rede/cliente-publicar";
import { preencher } from "@/lib/rede/preencher";
import { marcarLido } from "@/lib/rede/tipos-b1";
import { chaveDoLink, tempoAteSumir } from "@/lib/rede/publicar/vida";
import type { Post } from "@/lib/rede/tipos";
import type { VidaDoPost } from "@/lib/rede/tipos-publicar";
import { Icone } from "../alumia2/icones";
import { esquecerVida, vidaDe } from "./carregar";
import type { TextosDaVida } from "./textos";

/** O post como o cartão recebe, com o que a onda 9 pode mandar junto (arquivados e o post recém-publicado). */
export type PostComVida = Post & { arquivado_em?: string | null; nao_listado?: boolean };

/**
 * A vida do post para o cartão: o que já veio no post (prazo, roda, arquivado, não listado) e, para quem tem conta, o que o banco
 * diz por lote (rede_pub_vida). Post de exemplo (prévia) fica só com o que veio nele.
 */
export function useVidaDoPost(post: PostComVida, buscar: boolean): VidaDoPost {
  const doPost: VidaDoPost = {
    ...(post.expira_em ? { expira_em: post.expira_em } : {}),
    ...(post.meu && (post.publico as string) === "roda" ? { roda: true } : {}),
    ...(post.meu && (post.publico as string) === "eu" ? { so_eu: true } : {}),
    ...(post.meu && post.arquivado_em ? { arquivado: true } : {}),
    ...(post.meu && post.nao_listado ? { nao_listado: true } : {}),
  };
  const [doBanco, setDoBanco] = useState<VidaDoPost | null>(null);
  useEffect(() => {
    if (!buscar) return;
    let vivo = true;
    void vidaDe(post.id).then((v) => vivo && setDoBanco(v));
    return () => {
      vivo = false;
    };
  }, [buscar, post.id]);
  return { ...doPost, ...(doBanco ?? {}) };
}

const SELO = "inline-flex min-h-6 items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-extrabold uppercase tracking-wide";
const TOM = {
  neutro: "border-[var(--al-superficie-2)] text-[var(--al-texto-2)]",
  roda: "border-[color-mix(in_srgb,var(--al-com-1)_55%,transparent)] bg-[color-mix(in_srgb,var(--al-com-1)_14%,transparent)] text-[var(--al-texto)]",
  prazo: "border-[color-mix(in_srgb,var(--al-dourado)_55%,transparent)] bg-[color-mix(in_srgb,var(--al-dourado)_12%,transparent)] text-[var(--al-texto)]",
};

/** Os selos da vida do post: arquivado, só eu, só a roda e não listado (só a autora vê) e "some em…" (quem vê o post). */
export function SelosDaVida({ vida, t, agora }: { vida: VidaDoPost; t: TextosDaVida; agora: number }) {
  const falta = agora ? tempoAteSumir(vida.expira_em, agora) : null;
  if (!vida.arquivado && !vida.so_eu && !vida.roda && !vida.nao_listado && !falta) return null;
  const tempo = falta ? preencher(t.cartao[falta.unidade], { n: falta.n }) : "";
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {vida.arquivado && (
        <span className={`${SELO} ${TOM.neutro}`}>
          <Icone nome="pasta" className="h-3.5 w-3.5" />
          {t.cartao.arquivado}
        </span>
      )}
      {vida.so_eu && (
        <span className={`${SELO} ${TOM.neutro}`}>
          <Icone nome="cadeado" className="h-3.5 w-3.5" />
          {t.cartao.soEu}
        </span>
      )}
      {vida.roda && (
        <span className={`${SELO} ${TOM.roda}`}>
          <Icone nome="roda" className="h-3.5 w-3.5" />
          {t.cartao.roda}
        </span>
      )}
      {vida.nao_listado && (
        <span className={`${SELO} ${TOM.neutro}`}>
          <Icone nome="compartilhar" className="h-3.5 w-3.5" />
          {t.cartao.naoListado}
        </span>
      )}
      {falta && (
        <span className={`${SELO} ${TOM.prazo}`}>
          <Icone nome="relogio" className="h-3.5 w-3.5" />
          {preencher(t.cartao.someEm, { tempo })}
        </span>
      )}
    </div>
  );
}

/** O item "Arquivar" / "Desarquivar" do menu do cartão (só a autora). Na prévia, só muda na tela. */
export function ArquivarNoMenu({
  post,
  t,
  arquivado,
  previa,
  aoMudar,
  aoErro,
  classe,
}: {
  post: Post;
  t: TextosDaVida;
  arquivado: boolean;
  previa: boolean;
  aoMudar: (arquivado: boolean, nota: string) => void;
  aoErro: (e: unknown) => void;
  classe: string;
}) {
  const [ocupado, setOcupado] = useState(false);
  async function mudar() {
    if (ocupado) return;
    const quer = !arquivado;
    setOcupado(true);
    try {
      if (!previa) {
        const r = await redePub.arquivar(post.id, quer);
        esquecerVida(post.id);
        aoMudar(r.arquivado, r.arquivado ? t.cartao.arquivadoFeito : t.cartao.desarquivadoFeito);
      } else {
        aoMudar(quer, quer ? t.cartao.arquivadoFeito : t.cartao.desarquivadoFeito);
      }
    } catch (e) {
      aoErro(e);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <button type="button" className={classe} disabled={ocupado} onClick={() => void mudar()}>
      <Icone nome={arquivado ? "desfazer" : "pasta"} className="h-[18px] w-[18px]" />
      {arquivado ? t.cartao.desarquivar : t.cartao.arquivar}
    </button>
  );
}

/**
 * "Leia antes de repostar" (L3-23): o post tem link e a pessoa não abriu o link neste aparelho. Pergunta, sem impedir: abrir o
 * link (marca como aberto) ou repostar assim mesmo. Nada sai do aparelho.
 */
export function PerguntaLeiaAntes({ t, link, aoRepostar, aoFechar }: { t: TextosDaVida; link: string; aoRepostar: () => void; aoFechar: () => void }) {
  const id = useId();
  const marcar = () => {
    const chave = chaveDoLink(link);
    if (chave) marcarLido(chave);
  };
  return (
    <div className="mt-2 rounded-xl border border-[color-mix(in_srgb,var(--al-dourado)_45%,transparent)] bg-[color-mix(in_srgb,var(--al-dourado)_10%,var(--al-superficie))] p-3" role="group" aria-labelledby={`al2-leia-${id}`}>
      <p id={`al2-leia-${id}`} className="font-bold text-[var(--al-texto)]">
        {t.cartao.leiaTitulo}
      </p>
      <p className="text-sm text-[var(--al-texto-2)]">{t.cartao.leiaTexto}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          className="al-botao al-botao-primario al-botao-p"
          onClick={() => {
            marcar();
            aoFechar();
          }}
        >
          {t.cartao.abrirLink}
        </a>
        <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={aoRepostar}>
          {t.cartao.repostarAssim}
        </button>
        <button type="button" className="al2-acao" onClick={aoFechar}>
          {t.cartao.cancelar}
        </button>
      </div>
    </div>
  );
}

/** Um clique num link de fora dentro do cartão (a prévia do link, por exemplo) marca o link como aberto neste aparelho. */
export function marcarLinkAberto(alvo: EventTarget | null): void {
  const a = alvo instanceof Element ? alvo.closest("a[href]") : null;
  const chave = chaveDoLink(a?.getAttribute("href") ?? null);
  if (chave) marcarLido(chave);
}
