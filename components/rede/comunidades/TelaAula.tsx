// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "@/components/Link";
import { comunidades } from "@/lib/rede/cliente-comunidades";
import { enderecos, slugOk, type Post } from "@/lib/rede/tipos";
import { aulaOk } from "@/lib/rede/tipos-comunidades";
import { CartaoDePost } from "../CartaoDePost";
import { EsqueletoDaLinha } from "../Esqueletos";
import type { PropsDaTelaDoPacote } from "../registro";
import { Compositor } from "./Compositor";
import { erroCom, textosDe, useCarregar } from "./util";
// O visual novo (só com "rede-v2" + "alumia-2": a folha só vale dentro de [data-al="2"]).
import "../conversa/alumia3.css";

/**
 * "Discutir esta aula" (R4, item 38): a comunidade da disciplina filtrada por uma aula. Mostra só os posts ligados à aula (a
 * visibilidade de cada um vem do banco), deixa escrever sobre ela (o post é publicado na comunidade e ligado à aula em seguida) e
 * leva de volta à aula e à comunidade inteira. Parâmetros: `track`, `lesson` e `c` (a comunidade, vinda do botão da aula).
 */
export default function TelaAula({ lang, s, situacao, params, aoEscrever }: PropsDaTelaDoPacote) {
  const sc = textosDe(s);
  const trilha = params.track ?? "";
  const aulaSlug = params.lesson ?? "";
  const comunidade = params.c ?? "";
  const aula = `${trilha}/${aulaSlug}`;
  const valido = aulaOk(aula) && slugOk(comunidade);
  const pagina = useCarregar(() => (valido ? comunidades.pagina(comunidade) : Promise.reject(new Error("invalido"))), `aula-pagina:${comunidade}`);
  const [itens, setItens] = useState<Post[]>([]);
  const [proximo, setProximo] = useState<string | null>(null);
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">("carregando");
  const [falha, setFalha] = useState("");
  const [escrevendo, setEscrevendo] = useState(false);
  const [versao, setVersao] = useState(0);
  const [membroLocal, setMembroLocal] = useState(false);

  useEffect(() => {
    if (!valido || !sc) return;
    let vivo = true;
    comunidades
      .linhaDaAula(comunidade, aula, null, 20)
      .then((r) => {
        if (!vivo) return;
        setItens(r.itens);
        setProximo(r.proximo);
        setEstado("ok");
      })
      .catch((e) => {
        if (!vivo) return;
        setFalha(erroCom(s, sc, e));
        setEstado("erro");
      });
    return () => {
      vivo = false;
    };
  }, [valido, comunidade, aula, versao, s, sc]);

  const maisPosts = useCallback(async () => {
    if (!proximo) return;
    try {
      const r = await comunidades.linhaDaAula(comunidade, aula, proximo, 20);
      setItens((l) => [...l, ...r.itens.filter((n) => !l.some((x) => x.id === n.id))]);
      setProximo(r.proximo);
    } catch (e) {
      if (sc) setFalha(erroCom(s, sc, e));
    }
  }, [proximo, comunidade, aula, s, sc]);

  if (!sc) return <p className="px-[18px] py-8 font-sans text-ink-soft">{s.estados.emBreve}</p>;
  if (!valido) return <p role="alert" className="px-[18px] py-8 font-sans text-ink-soft">{s.estados.naoEncontrado}</p>;
  const a = sc.aula;
  const nomeDaAula = aulaSlug.replace(/-/g, " ");
  const resumo = pagina.dado;
  const pode = situacao.logado && situacao.membro;
  const dentro = membroLocal || resumo?.situacao === "membro" || resumo?.comunidade.tipo === "aberta";
  const slugReal = resumo?.comunidade.slug ?? comunidade;

  return (
    <div className="al3-tela font-sans">
      <header className="border-b border-rule px-[18px] py-4">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{a.titulo}</p>
        <h1 className="mt-1 font-serif text-2xl font-extrabold capitalize">{nomeDaAula}</h1>
        <p className="mt-1 text-sm text-ink-soft">{a.intro}</p>
        <p className="mt-3 flex flex-wrap gap-4 text-sm font-bold">
          <Link href={`/${lang}/trilhas/${trilha}/${aulaSlug}`} className="underline">{a.voltar}</Link>
          <Link href={enderecos.comunidade(lang, slugReal)} className="underline">{a.comunidade}</Link>
        </p>
        {pode && dentro && !escrevendo && (
          <button type="button" onClick={() => setEscrevendo(true)} className="mt-3 min-h-11 cursor-pointer rounded-full bg-[#c21f16] px-5 font-bold text-white hover:bg-[#1f1a14]">
            {a.escrever}
          </button>
        )}
        {pode && resumo && !dentro && <p className="mt-3 text-sm text-ink-soft">{a.entrarNaComunidade}</p>}
        {!pode && <p className="mt-3 text-sm text-ink-soft">{sc.acao.entrePrimeiro}</p>}
      </header>
      {escrevendo && pode && (
        <Compositor
          s={s}
          sc={sc}
          destino={{ comunidade: slugReal }}
          aoCancelar={() => setEscrevendo(false)}
          aoPublicar={async (post) => {
            await comunidades.ligarAula(post.id, aula, nomeDaAula);
            setMembroLocal(true);
            setEscrevendo(false);
            setVersao((n) => n + 1);
          }}
        />
      )}
      {estado === "carregando" ? (
        <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />
      ) : estado === "erro" ? (
        <p role="alert" className="px-[18px] py-8 text-ink-soft">{falha}</p>
      ) : itens.length === 0 ? (
        <p className="px-[18px] py-8 text-ink-soft">{a.vazio}</p>
      ) : (
        <div>
          {itens.map((p) => (
            <CartaoDePost key={p.id} post={p} lang={lang} s={s} logado={situacao.logado} aoResponder={(post) => aoEscrever(post)} />
          ))}
          {proximo && (
            <button type="button" onClick={maisPosts} className="m-4 min-h-11 cursor-pointer rounded-full border border-ink px-4 font-bold hover:bg-parchment-deep">{s.estados.maisPosts}</button>
          )}
        </div>
      )}
    </div>
  );
}
