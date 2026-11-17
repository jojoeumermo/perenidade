// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { protecao } from "@/lib/rede/cliente-protecao";
import { carregarTextosDaProtecao, encher, quandoLegivel, type TextosDaProtecao } from "@/lib/rede/textos-protecao";
import type { SituacaoDaProtecao } from "@/lib/rede/tipos-protecao";
import type { ContextoDoEncaixe } from "../encaixes";
import "./protecao.css";

// As duas faixas leem a mesma situação: um pedido só por vez, guardado por um instante (as duas montam juntas no Início).
let pedidoDaSituacao: Promise<SituacaoDaProtecao> | null = null;
function situacaoCompartilhada(): Promise<SituacaoDaProtecao> {
  if (!pedidoDaSituacao) {
    pedidoDaSituacao = protecao.situacao();
    const limpar = () => setTimeout(() => (pedidoDaSituacao = null), 3000);
    pedidoDaSituacao.then(limpar, limpar);
  }
  return pedidoDaSituacao;
}

/**
 * No alto do Início (encaixe topoDaLinha), só para a própria pessoa e só quando há algo, em duas faixas separadas: o modo
 * protegido ligado (carimbo, até quando e "Desligar agora", logo abaixo do modo ato) e, por último, num aviso neutro, as marcações
 * que esperam o aceite dela. Cada faixa é uma peça (parte "protegido" e parte "marcacoes"), e a ordem entre as faixas das frentes
 * é a de components/rede/encaixes.tsx (TOPO_DA_LINHA): a barra do modo ato, o modo protegido, as outras e as marcações por último.
 */
export default function NoTopoDaProtecao({ lang, situacao, parte }: ContextoDoEncaixe & { parte: "protegido" | "marcacoes" }) {
  const [t, setT] = useState<TextosDaProtecao | null>(null);
  const [st, setSt] = useState<SituacaoDaProtecao | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [nota, setNota] = useState("");
  const dentro = situacao.logado && situacao.membro;
  useEffect(() => {
    if (!dentro) return;
    let vivo = true;
    void carregarTextosDaProtecao(lang).then((x) => vivo && setT(x));
    situacaoCompartilhada().then((x) => vivo && setSt(x)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang, dentro]);
  if (!dentro || !t || !st) return null;
  const ligada = st.blindagem_ate !== null;
  if (parte === "marcacoes") {
    if (st.marcacoes_pendentes === 0) return null;
    return (
      <p className="pt-topo pt-topo-neutro pt-topo-marcacoes">
        <span>{t.topo.pendentes}</span>
        <Link href={`/${lang}/alumia/seguranca#sg-ajuste-protecao`}>{t.topo.ver}</Link>
      </p>
    );
  }
  if (!ligada && !nota) return null;
  async function desligar() {
    if (!t || !st) return;
    setOcupado(true);
    try {
      await protecao.blindagem(0);
      setSt({ ...st, blindagem_ate: null });
      setNota(t.blindagem.desligou);
    } catch {
      setNota(t.erro);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <>
      {ligada && (
        <section className="pt-topo pt-topo-protegido" aria-labelledby="pt-topo-protegido-t">
          <span id="pt-topo-protegido-t" className="pt-topo-carimbo al-cond">{t.blindagem.rotulo}</span>
          <span>{encher(t.blindagem.ligada, { quando: quandoLegivel(st.blindagem_ate as string, lang) })}</span>
          <button type="button" className="pt-topo-botao" disabled={ocupado} onClick={() => void desligar()}>
            {t.blindagem.desligar}
          </button>
        </section>
      )}
      {nota && !ligada && (
        <p className="pt-topo pt-topo-neutro" role="status">
          {nota}
        </p>
      )}
    </>
  );
}
