// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import type { PropsDaTelaDoPacote } from "../registro";
import { redeMod } from "@/lib/rede/cliente-moderacao";
import type { ChecagemDisponivel, EscopoDeModeracao } from "@/lib/rede/tipos-moderacao";
import { estilo, mensagemDeErro, useTextosMod } from "./base";
import { FilaDeDenuncias } from "./FilaDeDenuncias";
import { Lugares } from "./Lugares";
import { Recursos } from "./Recursos";

type Aba = "denuncias" | "retidos" | "recursos" | "lugares" | "niveis";

/** As checagens que o servidor entregou na rota (de content/checagens): [slug, título, veredito]. Qualquer coisa estranha vira lista vazia. */
function lerChecagens(bruto: string | undefined): ChecagemDisponivel[] {
  try {
    const lista: unknown = JSON.parse(bruto ?? "[]");
    if (!Array.isArray(lista)) return [];
    return lista
      .filter((x): x is [string, string, string] => Array.isArray(x) && x.length === 3 && x.every((y) => typeof y === "string"))
      .map(([slug, titulo, veredito]) => ({ slug, titulo, veredito }))
      .slice(0, 300);
  } catch {
    return [];
  }
}

/** Designar ou tirar líder (nível 4): só a coordenação. */
function Lideres({ s, sm }: { s: PropsDaTelaDoPacote["s"]; sm: NonNullable<ReturnType<typeof useTextosMod>> }) {
  const [handle, setHandle] = useState("");
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  async function mudar(sim: boolean) {
    setErro("");
    setAviso("");
    try {
      await redeMod.lider(handle.trim(), sim);
      setAviso(sm.niveis.feito);
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    }
  }
  return (
    <div className="space-y-3 px-[18px] py-4 font-sans">
      <h2 className="font-serif text-xl font-semibold">{sm.niveis.lider}</h2>
      <p className="text-sm text-ink-soft">{sm.niveis.liderAjuda}</p>
      <input value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={21} aria-label={sm.niveis.lider} className={estilo.campo} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={handle.trim().length < 3} className={estilo.botaoForte} onClick={() => void mudar(true)}>{sm.niveis.designar}</button>
        <button type="button" disabled={handle.trim().length < 3} className={estilo.botao} onClick={() => void mudar(false)}>{sm.niveis.tirar}</button>
      </div>
      {aviso && <p role="status" className="text-sm font-bold">{aviso}</p>}
      {erro && <p role="alert" className="text-sm text-oxblood">{erro}</p>}
    </div>
  );
}

/**
 * O painel de moderação da Rede (/comunidade/moderacao): fila de denúncias por prioridade, posts retidos, recursos, modo lento e listas
 * de bloqueio, e a designação de líderes. Só aparece o que cabe a quem entrou: equipe que cuida, moderação de comunidade, mediação de núcleo.
 */
export default function TelaModeracao({ lang, s, situacao, params }: PropsDaTelaDoPacote) {
  const sm = useTextosMod(lang);
  const [escopo, setEscopo] = useState<EscopoDeModeracao | null>(null);
  const [negado, setNegado] = useState("");
  const [aba, setAba] = useState<Aba>("denuncias");
  const checagens = useMemo(() => lerChecagens(params.checagens), [params.checagens]);

  useEffect(() => {
    if (!situacao.logado) return;
    let vivo = true;
    redeMod.escopo().then((x) => vivo && setEscopo(x)).catch((e) => vivo && setNegado(mensagemDeErro(s, null, e)));
    return () => {
      vivo = false;
    };
  }, [situacao.logado, s]);

  if (!situacao.logado) return <p className="px-[18px] py-8 font-sans text-ink-soft">{sm?.entreParaVer ?? s.estados.carregando}</p>;
  if (negado) return <p role="alert" className="px-[18px] py-8 font-sans text-oxblood">{negado}</p>;
  if (!sm || !escopo) return <p className="px-[18px] py-8 font-sans" role="status">{s.estados.carregando}</p>;
  const modera = escopo.cuida || escopo.comunidades.length > 0 || escopo.nucleos.length > 0;
  if (!modera) return <p className="px-[18px] py-8 font-sans text-ink-soft">{sm.semPermissao}</p>;
  const abas: Aba[] = ["denuncias", "retidos", "recursos", "lugares", ...(escopo.coord ? (["niveis"] as const) : [])];
  return (
    <div>
      <h1 className="border-b border-rule px-[18px] py-3 font-serif text-2xl font-semibold">{sm.fila.titulo}</h1>
      <div role="tablist" aria-label={sm.fila.titulo} className="sticky top-[var(--altura-topo,0px)] z-10 flex border-b border-rule bg-parchment">
        {abas.map((a) => (
          <button key={a} type="button" role="tab" aria-selected={aba === a} onClick={() => setAba(a)} className={`${estilo.aba} ${aba === a ? "border-b-[3px] border-[#c21f16]" : "text-ink-soft hover:bg-parchment-deep"}`}>
            {(sm.fila.abas as Record<string, string>)[a]}
          </button>
        ))}
      </div>
      {aba === "denuncias" && <FilaDeDenuncias lang={lang} s={s} sm={sm} checagens={checagens} comunidades={escopo.comunidades} retidos={false} />}
      {aba === "retidos" && <FilaDeDenuncias lang={lang} s={s} sm={sm} checagens={checagens} comunidades={escopo.comunidades} retidos />}
      {aba === "recursos" && <Recursos lang={lang} s={s} sm={sm} />}
      {aba === "lugares" && <Lugares s={s} sm={sm} escopo={escopo} />}
      {aba === "niveis" && <Lideres s={s} sm={sm} />}
    </div>
  );
}
