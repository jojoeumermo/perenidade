// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { Botao } from "../ui/Botao";
import { EstadoDaAlumia } from "../ui/Estado";
import { Icone } from "../publicar/alumia2/icones";
import Link from "@/components/Link";
import type { PropsDaTelaDoPacote } from "../registro";
import { redeMod } from "@/lib/rede/cliente-moderacao";
import { preencher } from "@/lib/rede/preencher";
import { enderecos } from "@/lib/rede/tipos";
import { enderecosModeracao, type Decisao, type MinhaDenuncia } from "@/lib/rede/tipos-moderacao";
import type { TextosDaModeracao } from "@/lib/rede/textos-moderacao";
import { dataCurta, estilo, mensagemDeErro, useTextosMod } from "./base";

function DecisaoCartao({ d, lang, s, sm, aoMudar }: { d: Decisao; lang: string; s: PropsDaTelaDoPacote["s"]; sm: TextosDaModeracao; aoMudar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const acoes = sm.decisoes.acao as Record<string, string>;
  const andamento = sm.decisoes.recurso as Record<string, string>;

  async function enviar() {
    setOcupado(true);
    setErro("");
    try {
      await redeMod.recorrer(d.id, texto.trim());
      aoMudar();
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <li className="px-[18px] py-3 font-sans">
      <p className="font-bold">{acoes[d.acao] ?? d.acao} <span className="text-sm font-normal text-ink-soft">({dataCurta(d.criado_em, lang)})</span></p>
      {d.regra && <p className="text-sm">{preencher(sm.decisoes.regra, { regra: d.regra })}</p>}
      <p className="text-sm">{preencher(sm.decisoes.motivo, { motivo: d.motivo })}</p>
      {d.alvo && <Link href={enderecos.post(lang, d.alvo)} className="text-sm underline">{sm.fila.alvo.post}</Link>}
      {d.recurso ? (
        <p className="mt-1 text-sm font-bold">{andamento[d.recurso.situacao]}</p>
      ) : d.pode_recorrer ? (
        <>
          <p className="mt-1 text-sm text-ink-soft">{preencher(sm.decisoes.prazo, { data: dataCurta(d.prazo, lang) })}</p>
          {aberto ? (
            <div className="mt-2 space-y-2">
              <label className="block text-sm">
                {sm.decisoes.recursoTexto}
                <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} maxLength={2000} className={`${estilo.campo} mt-1`} />
              </label>
              {erro && <p role="alert" className="text-sm text-oxblood">{erro}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={ocupado || texto.trim().length < 10} className={estilo.botaoForte} onClick={() => void enviar()}>{sm.decisoes.enviarRecurso}</button>
                <button type="button" className={estilo.botao} onClick={() => setAberto(false)}>{sm.cancelar}</button>
              </div>
            </div>
          ) : (
            <button type="button" className={`${estilo.botao} mt-2`} onClick={() => setAberto(true)}>{sm.decisoes.recorrer}</button>
          )}
        </>
      ) : d.acao !== "avisar" ? (
        <p className="mt-1 text-sm text-ink-soft">{sm.decisoes.prazoPassou}</p>
      ) : null}
    </li>
  );
}

/** "Denúncias e recursos" (/alumia/denuncias): as denúncias que eu fiz, com protocolo e andamento, e as decisões sobre o que escrevi, com o recurso de 30 dias. */
export default function TelaDenuncias({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const sm = useTextosMod(lang);
  const [aba, setAba] = useState<"minhas" | "decisoes">("minhas");
  const [minhas, setMinhas] = useState<MinhaDenuncia[] | null>(null);
  const [decisoes, setDecisoes] = useState<Decisao[] | null>(null);
  const [erro, setErro] = useState("");
  const [rodada, setRodada] = useState(0);

  useEffect(() => {
    if (!situacao.logado) return;
    let vivo = true;
    redeMod.minhasDenuncias().then((x) => vivo && setMinhas(x)).catch((e) => vivo && setErro(mensagemDeErro(s, null, e)));
    redeMod.minhasDecisoes().then((x) => vivo && setDecisoes(x)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [situacao.logado, rodada, s]);

  if (!situacao.logado) return sm ? <EstadoDaAlumia icone="cadeado" titulo={sm.decisoes.titulo} texto={sm.entreParaVer} /> : <p className="px-[18px] py-8 font-sans text-ink-soft">{s.estados.carregando}</p>;
  if (erro) return <EstadoDaAlumia erro titulo={sm?.decisoes.titulo} texto={erro}><Botao variante="claro" pilula icone={<Icone nome="desfazer" />} onClick={() => window.location.reload()}>{s.estados.tentar}</Botao></EstadoDaAlumia>;
  if (!sm || !minhas || !decisoes) return <p className="px-[18px] py-8 font-sans" role="status">{s.estados.carregando}</p>;
  const categorias = sm.categorias as Record<string, { rotulo: string }>;
  const andamento = sm.decisoes.andamento as Record<string, string>;
  return (
    <div>
      <h1 className="border-b border-rule px-[18px] py-3 font-serif text-2xl font-semibold">{sm.decisoes.titulo}</h1>
      <div role="tablist" aria-label={sm.decisoes.titulo} className="flex border-b border-rule">
        {(["minhas", "decisoes"] as const).map((a) => (
          <button key={a} type="button" role="tab" aria-selected={aba === a} onClick={() => setAba(a)} className={`${estilo.aba} ${aba === a ? "border-b-[3px] border-[#c21f16]" : "text-ink-soft hover:bg-parchment-deep"}`}>
            {sm.decisoes.abas[a]}
          </button>
        ))}
      </div>
      {aba === "minhas" ? (
        minhas.length === 0 ? (
          <p className="px-[18px] py-6 font-sans text-ink-soft">{sm.decisoes.semDenuncias}</p>
        ) : (
          <ul className="divide-y divide-rule">
            {minhas.map((d) => (
              <li key={d.protocolo} className="px-[18px] py-3 font-sans">
                <p className="font-bold">{preencher(sm.fila.protocolo, { protocolo: d.protocolo })} <span className="text-sm font-normal text-ink-soft">({dataCurta(d.criado_em, lang)})</span></p>
                <p className="text-sm">{(sm.fila.alvo as Record<string, string>)[d.alvo_tipo]} · {categorias[d.categoria]?.rotulo ?? d.categoria}</p>
                <p className="text-sm font-semibold">{andamento[d.situacao]}</p>
                {d.regra && <p className="text-sm text-ink-soft">{preencher(sm.decisoes.regra, { regra: d.regra })}</p>}
              </li>
            ))}
          </ul>
        )
      ) : decisoes.length === 0 ? (
        <p className="px-[18px] py-6 font-sans text-ink-soft">{sm.decisoes.semDecisoes}</p>
      ) : (
        <ul className="divide-y divide-rule">
          {decisoes.map((d) => <DecisaoCartao key={d.id} d={d} lang={lang} s={s} sm={sm} aoMudar={() => setRodada((n) => n + 1)} />)}
        </ul>
      )}
      <p className="px-[18px] py-4 font-sans text-sm"><Link href={enderecosModeracao.cuidado(lang)} className="underline">{sm.cuidado.titulo}</Link></p>
    </div>
  );
}
