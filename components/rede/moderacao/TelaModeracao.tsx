// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "./o9.css";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { slugOk } from "@/lib/rede/tipos";
import { Botao } from "../ui/Botao";
import { EstadoDaAlumia } from "../ui/Estado";
import { Icone } from "../publicar/alumia2/icones";
import type { PropsDaTelaDoPacote } from "../registro";
import { redeMod } from "@/lib/rede/cliente-moderacao";
import type { ChecagemDisponivel, EscopoDeModeracao } from "@/lib/rede/tipos-moderacao";
import { estilo, mensagemDeErro, useTextosMod } from "./base";
import { FilaDeDenuncias } from "./FilaDeDenuncias";
import { Lugares } from "./Lugares";
import { Recursos } from "./Recursos";
import { AlertasDeBrigada } from "./comunidade/AlertasDeBrigada";

// O painel da lei (onda 8) e as ferramentas da comunidade só chegam ao navegador quando a aba abre.
const PainelDaLei = dynamic(() => import("../lei/PainelDaLei").then((m) => m.PainelDaLei), { ssr: false });
// Onda 12 (12D): os links do Instagram que esperam a conferência da mediação pelo código da bio (o banco confere o papel).
const FilaDosLinks = dynamic(() => import("../perfil/secoes/Cuidar").then((m) => m.FilaDosLinks), { ssr: false });
const FerramentasDaComunidade = dynamic(() => import("./comunidade/FerramentasDaComunidade").then((m) => m.FerramentasDaComunidade), { ssr: false });

type Aba = "denuncias" | "retidos" | "recursos" | "lei" | "alertas" | "comunidades" | "lugares" | "niveis";

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

/** As ferramentas de uma comunidade que a pessoa modera (a equipe que cuida escolhe qualquer uma pelo endereço). */
function Comunidades({ lang, s, sm, escopo }: { lang: string; s: PropsDaTelaDoPacote["s"]; sm: NonNullable<ReturnType<typeof useTextosMod>>; escopo: EscopoDeModeracao }) {
  const [escolhida, setEscolhida] = useState(escopo.comunidades[0] ?? "");
  const [outra, setOutra] = useState("");
  const slug = outra && slugOk(outra) ? outra : escolhida;
  const t = sm.o9.ferramentas;
  return (
    <div className="m9">
      <div className="m9-campos m9-campos-2">
        {escopo.comunidades.length > 0 && (
          <label className="m9-campo">
            {t.escolha}
            <select value={escolhida} onChange={(e) => { setEscolhida(e.target.value); setOutra(""); }}>
              {escopo.comunidades.map((c) => <option key={c} value={c}>{escopo.nomes?.[c] ?? c}</option>)}
            </select>
          </label>
        )}
        {escopo.cuida && (
          <label className="m9-campo">
            {t.outra}
            <input value={outra} maxLength={60} onChange={(e) => setOutra(e.target.value.trim().toLowerCase())} />
          </label>
        )}
      </div>
      <div className="m9-depois">
        {slug ? <FerramentasDaComunidade key={slug} slug={slug} lang={lang} s={s} sm={sm} /> : <p className="m9-vazio">{t.nenhuma}</p>}
      </div>
    </div>
  );
}

/**
 * O painel de moderação da Rede (/alumia/moderacao): fila de denúncias por prioridade (com o prazo de resposta e a denúncia de
 * conteúdo ilegal da onda 8), posts esperando leitura (com o motivo: filtro da comunidade, recém-chegados, lista, precaução),
 * recursos com prazo, a lei e os prazos (contas retidas por precaução de menor e recursos de conta, só para a equipe que cuida),
 * os alertas de brigada, as ferramentas de cada comunidade (filtro automático, modo lento, perguntas para entrar), modo lento e
 * listas de bloqueio dos núcleos, e a designação de líderes. Só aparece o que cabe a quem entrou: equipe que cuida, moderação de
 * comunidade, mediação de núcleo.
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

  if (!situacao.logado) return sm ? <EstadoDaAlumia icone="cadeado" titulo={sm.fila.titulo} texto={sm.entreParaVer} /> : <p className="px-[18px] py-8 font-sans text-ink-soft">{s.estados.carregando}</p>;
  if (negado) return <EstadoDaAlumia erro titulo={sm?.fila.titulo} texto={negado}><Botao variante="claro" pilula icone={<Icone nome="desfazer" />} onClick={() => window.location.reload()}>{s.estados.tentar}</Botao></EstadoDaAlumia>;
  if (!sm || !escopo) return <p className="px-[18px] py-8 font-sans" role="status">{s.estados.carregando}</p>;
  const modera = escopo.cuida || escopo.comunidades.length > 0 || escopo.nucleos.length > 0;
  if (!modera) return <EstadoDaAlumia icone="moderar" titulo={sm.fila.titulo} texto={sm.semPermissao} />;
  const abas: Aba[] = [
    "denuncias", "retidos", "recursos",
    ...(escopo.cuida ? (["lei"] as const) : []),
    "alertas",
    ...(escopo.comunidades.length > 0 || escopo.cuida ? (["comunidades"] as const) : []),
    "lugares",
    ...(escopo.coord ? (["niveis"] as const) : []),
  ];
  const rotulos: Record<Aba, string> = { ...(sm.fila.abas as Record<Exclude<Aba, "lei" | "alertas" | "comunidades">, string>), ...sm.o9.abas };
  return (
    <div className="al3-tela m9 m9-tela">
      <header className="m9-cabeca">
        <h1 className="m9-cond">{sm.fila.titulo}</h1>
      </header>
      <div role="tablist" aria-label={sm.fila.titulo} className="m9-abas">
        {abas.map((a) => (
          <button key={a} type="button" role="tab" id={`m9-aba-${a}`} aria-controls="m9-painel" aria-selected={aba === a} className="m9-aba" onClick={() => setAba(a)}>
            {rotulos[a]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="m9-painel" aria-labelledby={`m9-aba-${aba}`} className="m9-painel">
        {aba === "denuncias" && <FilaDeDenuncias lang={lang} s={s} sm={sm} checagens={checagens} comunidades={escopo.comunidades} nomes={escopo.nomes} retidos={false} />}
        {aba === "retidos" && <FilaDeDenuncias lang={lang} s={s} sm={sm} checagens={checagens} comunidades={escopo.comunidades} nomes={escopo.nomes} retidos />}
        {aba === "retidos" && escopo.cuida && <FilaDosLinks lang={lang} />}
        {aba === "recursos" && <Recursos lang={lang} s={s} sm={sm} />}
        {aba === "lei" && <PainelDaLei lang={lang} />}
        {aba === "alertas" && <div className="m9"><AlertasDeBrigada lang={lang} s={s} sm={sm} /></div>}
        {aba === "comunidades" && <Comunidades lang={lang} s={s} sm={sm} escopo={escopo} />}
        {aba === "lugares" && <Lugares s={s} sm={sm} escopo={escopo} />}
        {aba === "niveis" && <Lideres s={s} sm={sm} />}
      </div>
    </div>
  );
}
