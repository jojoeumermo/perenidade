// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { Botao } from "../ui/Botao";
import { EstadoDaAlumia } from "../ui/Estado";
import { Icone } from "../publicar/alumia2/icones";
import type { PropsDaTelaDoPacote } from "../registro";
import { redeMod } from "@/lib/rede/cliente-moderacao";
import { preencher } from "@/lib/rede/preencher";
import { gravarSilenciosLocais, lerSilenciosLocais, type SilencioLocal } from "@/lib/rede/silenciar-local";
import type { Silenciado } from "@/lib/rede/tipos-moderacao";
import type { PrazoDaSoneca } from "@/lib/rede/comunidade-moderacao";
import { dataCurta, estilo, mensagemDeErro, useTextosMod } from "./base";
import { EscolhaDoPrazo, fraseDaSoneca } from "./Soneca";

function armazem(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * "O que eu silenciei" (/alumia/silenciados): a lista da conta (no servidor) e a deste aparelho; dá para desfazer, para silenciar
 * uma palavra e para pôr uma comunidade em soneca com prazo (1 dia, 1 semana, 1 mês ou até desfazer).
 */
export default function TelaSilenciados({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const sm = useTextosMod(lang);
  const [conta, setConta] = useState<Silenciado[] | null>(null);
  // A tela só roda no navegador (import dinâmico sem SSR): dá para ler o aparelho já no primeiro render.
  const [local, setLocal] = useState<SilencioLocal[]>(() => lerSilenciosLocais(armazem()));
  const [palavra, setPalavra] = useState("");
  const [soAparelho, setSoAparelho] = useState(false);
  const [comunidade, setComunidade] = useState("");
  const [prazo, setPrazo] = useState<PrazoDaSoneca>(7);
  const [feito, setFeito] = useState("");
  const [erro, setErro] = useState("");
  const [rodada, setRodada] = useState(0);

  useEffect(() => {
    if (!situacao.logado) return;
    let vivo = true;
    redeMod.silenciados().then((x) => vivo && setConta(x)).catch((e) => vivo && setErro(mensagemDeErro(s, null, e)));
    return () => {
      vivo = false;
    };
  }, [situacao.logado, rodada, s]);

  if (!situacao.logado) return <p className="px-[18px] py-8 font-sans text-ink-soft">{sm?.entreParaVer ?? s.estados.carregando}</p>;
  if (!sm || !conta) return erro ? <EstadoDaAlumia erro titulo={sm?.silenciados.titulo} texto={erro}><Botao variante="claro" pilula icone={<Icone nome="desfazer" />} onClick={() => window.location.reload()}>{s.estados.tentar}</Botao></EstadoDaAlumia> : <p className="px-[18px] py-8 font-sans" role="status">{s.estados.carregando}</p>;
  const tipos = sm.silenciados.tipo as Record<string, string>;

  async function desfazer(id: string) {
    setErro("");
    try {
      await redeMod.silenciarRemover(id);
      setRodada((n) => n + 1);
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    }
  }
  function desfazerLocal(i: number) {
    const lista = local.filter((_, k) => k !== i);
    setLocal(lista);
    gravarSilenciosLocais(armazem(), lista);
  }
  async function adicionar() {
    const valor = palavra.trim();
    if (valor.length < 2) return;
    setErro("");
    try {
      if (soAparelho) {
        const lista = [...local.filter((x) => !(x.tipo === "palavra" && x.valor === valor)), { tipo: "palavra" as const, valor }];
        setLocal(lista);
        gravarSilenciosLocais(armazem(), lista);
      } else {
        await redeMod.silenciar("palavra", valor);
        setRodada((n) => n + 1);
      }
      setPalavra("");
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    }
  }

  async function sonecaDaComunidade() {
    const valor = comunidade.trim().toLowerCase().replace(/^.*\/c\//, "").replace(/[/?#].*$/, "");
    if (valor.length < 2 || !sm) return;
    setErro("");
    setFeito("");
    try {
      await redeMod.silenciar("comunidade", valor, prazo);
      setComunidade("");
      setFeito(fraseDaSoneca(sm, lang, prazo));
      setRodada((n) => n + 1);
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    }
  }

  return (
    <div className="al3-tela m9 font-sans">
      <h1 className="border-b border-rule px-[18px] py-3 font-serif text-2xl font-semibold">{sm.silenciados.titulo}</h1>
      <p className="px-[18px] py-3 text-sm text-ink-soft">{sm.silenciados.ajuda}</p>
      <div className="space-y-2 px-[18px] pb-3">
        <label className="block text-sm font-bold">
          {sm.silenciados.palavra}
          <input value={palavra} onChange={(e) => setPalavra(e.target.value)} maxLength={60} placeholder={sm.silenciados.palavraDica} className={`${estilo.campo} mt-1 font-normal`} />
        </label>
        <label className="flex min-h-11 w-full cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={soAparelho} onChange={(e) => setSoAparelho(e.target.checked)} />
          {sm.silenciar.soAparelho}
        </label>
        <button type="button" disabled={palavra.trim().length < 2} aria-describedby={palavra.trim().length < 2 ? "sil-dica-palavra" : undefined} className={estilo.botaoForte} onClick={() => void adicionar()}>{sm.silenciados.adicionar}</button>
        {palavra.trim().length < 2 && <p id="sil-dica-palavra" className="text-xs text-ink-soft">{sm.silenciados.dicaPalavra}</p>}
      </div>
      <div className="m9-soneca border-t border-rule px-[18px] py-3">
        <p className="text-sm text-ink-soft">{sm.o9.soneca.explica}</p>
        <label className="m9-campo">
          {sm.o9.soneca.comunidadeCampo}
          <input value={comunidade} onChange={(e) => setComunidade(e.target.value)} maxLength={120} placeholder={sm.o9.soneca.comunidadeDica} />
        </label>
        <EscolhaDoPrazo sm={sm} valor={prazo} aoMudar={setPrazo} />
        <div>
          <button type="button" disabled={comunidade.trim().length < 2} aria-describedby={comunidade.trim().length < 2 ? "sil-dica-comunidade" : undefined} className="al-botao al-botao-primario al-botao-m" onClick={() => void sonecaDaComunidade()}>{sm.o9.soneca.comunidade}</button>
          {comunidade.trim().length < 2 && <p id="sil-dica-comunidade" className="mt-1 text-xs text-ink-soft">{sm.o9.soneca.dicaComunidade}</p>}
        </div>
        {feito && <p role="status" className="m9-status">{feito}</p>}
      </div>
      {erro && <p role="alert" className="px-[18px] pb-2 text-sm text-oxblood">{erro}</p>}

      <h2 className="border-y border-rule bg-parchment-deep px-[18px] py-2 font-bold">{sm.silenciados.naConta}</h2>
      {conta.length === 0 ? (
        <p className="px-[18px] py-4 text-ink-soft">{sm.silenciados.vazio}</p>
      ) : (
        <ul className="divide-y divide-rule">
          {conta.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-[18px] py-2">
              <span className="break-words">
                <span className="text-xs text-ink-soft">{tipos[c.tipo]}: </span>
                {c.rotulo}
                {c.ate && <span className="text-xs text-ink-soft"> · {preencher(sm.silenciados.ate, { data: dataCurta(c.ate, lang) })}</span>}
              </span>
              <button type="button" className={estilo.botao} onClick={() => void desfazer(c.id)}>{sm.silenciados.desfazer}</button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="border-y border-rule bg-parchment-deep px-[18px] py-2 font-bold">{sm.silenciados.noAparelho}</h2>
      {local.length === 0 ? (
        <p className="px-[18px] py-4 text-ink-soft">{sm.silenciados.vazio}</p>
      ) : (
        <ul className="divide-y divide-rule">
          {local.map((c, i) => (
            <li key={`${c.tipo}:${c.valor}`} className="flex items-center justify-between gap-2 px-[18px] py-2">
              <span className="break-words"><span className="text-xs text-ink-soft">{tipos[c.tipo]}: </span>{c.valor}</span>
              <button type="button" className={estilo.botao} onClick={() => desfazerLocal(i)}>{sm.silenciados.desfazer}</button>
            </li>
          ))}
        </ul>
      )}
      <p className="px-[18px] py-3 text-xs text-ink-soft">{sm.silenciados.limpar}</p>
    </div>
  );
}
