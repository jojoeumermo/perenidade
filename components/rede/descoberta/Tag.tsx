// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/Link";
import { conversa } from "@/lib/rede/cliente-conversa";
import { redeDescoberta } from "@/lib/rede/cliente-descoberta";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaAlumia3 } from "@/lib/rede/textos-conversa";
import { ORDENS, enderecosDescoberta, tagOk, type Ordem, type PaginaDaTag, type PaginaOrdenada } from "@/lib/rede/tipos-descoberta";
import { textoDoErro } from "../erros";
import type { PropsDaTelaDoPacote } from "../registro";
import { FaixaDaPrevia, IconeSino, IconeVoltar, previa, useTextosAlumia3 } from "../conversa/base3";
import { pular } from "../conversa/movimento";
import { ListaOrdenada } from "./ListaOrdenada";
import { descobertaDaPrevia } from "./previa";
import { useTextosDescoberta } from "./textos";
// O visual novo (só com "rede-v2" + "alumia-2": a folha só vale dentro de [data-al="2"]).
import "../conversa/alumia3.css";

/**
 * A página de um #tema (/alumia/tag/[tag]): o #TEMA grande em Archivo condensada, "Seguir #tema" (Onda B: só a pessoa vê o que
 * segue; não muda a ordem de nada, é um atalho no Explorar) e os posts que o trazem, na ordem escrita escolhida, só os que a
 * pessoa pode ver.
 */
export default function Tag({ lang, s, situacao, params, aoEscrever }: PropsDaTelaDoPacote) {
  const d = useTextosDescoberta(lang);
  const t = useTextosAlumia3(lang);
  const tag = params.tag ?? "";
  const [linha, setLinha] = useState<PaginaDaTag["linha"]>(null);
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  if (!d || !t) return <p role="status" className="px-[18px] py-6 font-sans text-ink-soft">{s.estados.carregando}</p>;
  if (!tagOk(tag)) return <p role="alert" className="px-[18px] py-8 font-sans text-ink-soft">{s.estados.naoEncontrado}</p>;
  const fonte = previa() ? descobertaDaPrevia : redeDescoberta;
  return (
    <div className="al3-tela al3-tag">
      <FaixaDaPrevia t={t} />
      <header className="al3-tag-capa">
        <Link href={enderecosDescoberta.explorar(lang)} className="al3-voltar" aria-label={d.tag.voltar}>
          <IconeVoltar />
        </Link>
        <h1 className="al3-cond al3-tag-titulo">
          <span className="al3-sr">{preencher(d.tag.titulo, { tag })}</span>
          <span aria-hidden>
            <span className="al3-tag-cerquilha">#</span>
            {tag}
          </span>
        </h1>
        {linha && <p className="al3-tag-regra">{preencher(d.tag.regraDaLinha, { titulo: linha.titulo, regra: linha.regra })}</p>}
        {situacao.logado && situacao.membro && (
          <SeguirTag tag={tag} t={t} aoAvisar={(texto, erro = false) => setAviso({ texto, erro })} erroDe={(e) => textoDoErro(s, e)} />
        )}
        {aviso && (
          <p className="al3-tag-aviso al3-entra" role={aviso.erro ? "alert" : "status"} key={aviso.texto}>
            {aviso.texto}
          </p>
        )}
      </header>
      <ListaOrdenada
        lang={lang}
        s={s}
        d={d}
        logado={situacao.logado}
        chave={`tag:${tag}`}
        ordens={ORDENS}
        ordemInicial="novos"
        carregar={(ordem, cursor) => fonte.tag(tag, ordem as Ordem, cursor)}
        aoPagina={(p: PaginaOrdenada) => setLinha((p as PaginaDaTag).linha ?? null)}
        vazio={d.tag.vazio}
        aoResponder={aoEscrever}
      />
    </div>
  );
}

/** "Seguir #tema": muda na hora, o sino balança, e o banco confirma (ou desfaz). Banco sem a migração: o botão não aparece. */
function SeguirTag({ tag, t, aoAvisar, erroDe }: { tag: string; t: TextosDaAlumia3; aoAvisar: (texto: string, erro?: boolean) => void; erroDe: (e: unknown) => string }) {
  const [seguindo, setSeguindo] = useState<{ tag: string; sim: boolean | null } | null>(previa() ? { tag, sim: false } : null);
  const [ocupado, setOcupado] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (previa()) return;
    let vivo = true;
    conversa
      .seguindo(null, tag)
      .then((r) => vivo && setSeguindo({ tag, sim: r.tag === true }))
      .catch(() => vivo && setSeguindo({ tag, sim: null }));
    return () => {
      vivo = false;
    };
  }, [tag]);
  const sim = seguindo?.tag === tag ? seguindo.sim : previa() ? false : null;
  if (sim === null) return null;
  async function alternar() {
    if (ocupado) return;
    const quer = !sim;
    setSeguindo({ tag, sim: quer });
    pular(botao.current, 1.08);
    if (previa()) return aoAvisar(preencher(quer ? t.descoberta.seguiuTag : t.descoberta.deixouTag, { tag }));
    setOcupado(true);
    try {
      const r = await conversa.seguirTag(tag, quer);
      setSeguindo({ tag, sim: r.seguindo });
      aoAvisar(preencher(r.seguindo ? t.descoberta.seguiuTag : t.descoberta.deixouTag, { tag }));
    } catch (e) {
      setSeguindo({ tag, sim: !quer });
      aoAvisar(erroDe(e), true);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <div className="al3-tag-seguir">
      <button ref={botao} type="button" className="al3-seguir" aria-pressed={sim} disabled={ocupado} onClick={() => void alternar()}>
        <IconeSino aceso={sim} />
        {preencher(sim ? t.descoberta.seguindoTag : t.descoberta.seguirTag, { tag })}
      </button>
      <p className="al3-regra">{t.descoberta.seguirTagRegra}</p>
    </div>
  );
}
