// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "./o9.css";
import { useId, useState } from "react";
import { PRAZOS_DA_SONECA, type PrazoDaSoneca } from "@/lib/rede/comunidade-moderacao";
import { redeMod } from "@/lib/rede/cliente-moderacao";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaModeracao } from "@/lib/rede/textos-moderacao";
import type { TipoDeSilencio } from "@/lib/rede/tipos-moderacao";
import { dataCurta, mensagemDeErro } from "./base";

/** A escolha do prazo da soneca: 1 dia, 1 semana, 1 mês ou até desfazer. Botões de rádio com cara de ficha. */
export function EscolhaDoPrazo({ sm, valor, aoMudar, desligado = false }: { sm: TextosDaModeracao; valor: PrazoDaSoneca; aoMudar: (p: PrazoDaSoneca) => void; desligado?: boolean }) {
  const nome = useId();
  const rotulos = sm.o9.soneca.prazos as Record<string, string>;
  return (
    <fieldset className="m9-prazos" disabled={desligado}>
      <legend>{sm.o9.soneca.prazo}</legend>
      {PRAZOS_DA_SONECA.map((p) => (
        <label key={String(p)} className="m9-prazo">
          <input type="radio" name={nome} checked={valor === p} onChange={() => aoMudar(p)} />
          <span>{rotulos[p === null ? "sempre" : String(p)]}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** A frase de quando a soneca acaba, com a data local. */
export function fraseDaSoneca(sm: TextosDaModeracao, lang: string, dias: PrazoDaSoneca): string {
  if (dias === null) return sm.o9.soneca.feitoSempre;
  return preencher(sm.o9.soneca.feito, { data: dataCurta(new Date(Date.now() + dias * 86_400_000).toISOString(), lang) });
}

/**
 * Soneca de uma comunidade (ou de qualquer alvo do silenciar) com prazo, na conta: ninguém é avisado, e ela acaba sozinha no
 * fim do prazo (rede_mod_silenciar com p_dias). Usada em AcoesDaComunidade; quem junta pode pendurar no "…" da página da
 * comunidade da Alumia.
 */
export function Soneca({ lang, s, sm, tipo, alvo, rotulo }: { lang: string; s: Pick<TextosDaRede, "erros">; sm: TextosDaModeracao; tipo: TipoDeSilencio; alvo: string; rotulo: string }) {
  const [aberto, setAberto] = useState(false);
  const [prazo, setPrazo] = useState<PrazoDaSoneca>(7);
  const [feito, setFeito] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function silenciar() {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      await redeMod.silenciar(tipo, alvo, prazo);
      setFeito(fraseDaSoneca(sm, lang, prazo));
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    } finally {
      setOcupado(false);
    }
  }

  if (!aberto) {
    return (
      <button type="button" className="al-botao al-botao-contorno al-botao-p" aria-expanded={false} onClick={() => setAberto(true)}>
        {rotulo}
      </button>
    );
  }
  return (
    <div className="m9 m9-soneca" role="group" aria-label={rotulo}>
      <EscolhaDoPrazo sm={sm} valor={prazo} aoMudar={setPrazo} desligado={ocupado} />
      <div className="m9-acoes">
        <button type="button" className="al-botao al-botao-primario al-botao-p" disabled={ocupado} onClick={() => void silenciar()}>{rotulo}</button>
        <button type="button" className="al-botao al-botao-fantasma al-botao-p" onClick={() => setAberto(false)}>{sm.fechar}</button>
      </div>
      {feito && <p className="m9-status" role="status">{feito}</p>}
      {erro && <p className="m9-erro" role="alert">{erro}</p>}
    </div>
  );
}
