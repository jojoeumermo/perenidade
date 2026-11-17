// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { OPCOES_DO_LENTO, tempoEscrito } from "@/lib/rede/comunidade-moderacao";
import { redeMod } from "@/lib/rede/cliente-moderacao";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaModeracao } from "@/lib/rede/textos-moderacao";
import { mensagemDeErro } from "../base";

/** O texto de uma opção do modo lento ("Desligado", "1 post a cada 10 min"). */
export function rotuloDoLento(sm: TextosDaModeracao, segundos: number): string {
  return segundos === 0 ? sm.o9.lento.desligado : preencher(sm.o9.lento.cada, { tempo: tempoEscrito(sm.o9.tempo, segundos) });
}

/** O modo lento da comunidade em minutos e horas (o banco aceita de 5 s a 24 h). Quem modera não espera; fica no registro. */
export function ModoLento({ slug, s, sm, segundos, aoMudar }: { slug: string; s: Pick<TextosDaRede, "erros">; sm: TextosDaModeracao; segundos: number; aoMudar: (n: number) => void }) {
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const opcoes = (OPCOES_DO_LENTO as readonly number[]).includes(segundos) ? [...OPCOES_DO_LENTO] : [...OPCOES_DO_LENTO, segundos].sort((a, b) => a - b);

  async function mudar(n: number) {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    setAviso("");
    try {
      await redeMod.modoLento("comunidade", slug, n);
      aoMudar(n);
      setAviso(sm.o9.lento.feito);
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="m9-secao" aria-labelledby={`m9-lento-${slug}`}>
      <h3 id={`m9-lento-${slug}`} className="m9-secao-titulo m9-cond"><span className="m9-ladrilho" aria-hidden>2</span>{sm.o9.lento.titulo}</h3>
      <p className="m9-lead">{sm.o9.lento.ajuda}</p>
      <label className="m9-campo">
        {sm.o9.lento.titulo}
        <select value={segundos} disabled={ocupado} onChange={(e) => void mudar(Number(e.target.value))}>
          {opcoes.map((n) => <option key={n} value={n}>{rotuloDoLento(sm, n)}</option>)}
        </select>
      </label>
      {aviso && <p className="m9-status" role="status">{aviso}</p>}
      {erro && <p className="m9-erro" role="alert">{erro}</p>}
    </section>
  );
}
