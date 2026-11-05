// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { useLista } from "../comum";
import { MoldeConfiguracao } from "../moldes";
import { Campo, Esqueleto } from "../ui";
import { erroDoTelegram, erroDoWhatsapp } from "./regras";
import { useControle } from "./usarControle";

interface Canais {
  whatsapp: string;
  telegram: string;
}

/**
 * Canais no celular: o endereço do canal do WhatsApp e do grupo ou canal do Telegram do instituto, mostrados na página
 * "Receba no seu celular". Quem cria os canais é a coordenação, fora do site; aqui só fica o endereço (public.canais_salvar,
 * só coordenação e vice). O site não carrega nada de WhatsApp nem de Telegram: é só um link para a pessoa abrir se quiser.
 */
export function CanaisDoCelular() {
  const lista = useLista<Canais>("canais", {}, { quieta: true });
  const { executar, ocupado } = useControle(lista.recarregar);
  const [edicao, setEdicao] = useState<Partial<Canais>>({});
  const guardado = lista.dados;
  if (!guardado) return lista.erro ? <p role="alert" className="pn-erro">{lista.erro}</p> : <Esqueleto />;
  const whatsapp = edicao.whatsapp ?? guardado.whatsapp;
  const telegram = edicao.telegram ?? guardado.telegram;
  const erroW = erroDoWhatsapp(whatsapp);
  const erroT = erroDoTelegram(telegram);
  const sujo = whatsapp.trim() !== guardado.whatsapp || telegram.trim() !== guardado.telegram;
  async function salvar() {
    if (erroW || erroT) return;
    const r = await executar("canais_salvar", { p: { whatsapp: whatsapp.trim(), telegram: telegram.trim() } }, "Canais guardados.");
    if (r) setEdicao({});
  }
  return (
    <MoldeConfiguracao
      sujo={sujo && !erroW && !erroT}
      salvando={ocupado}
      aoSalvar={() => void salvar()}
      aoDescartar={() => setEdicao({})}
      grupos={[
        {
          id: "canais-celular",
          titulo: "Canais no celular",
          sobre: "Os dois endereços aparecem na página \"Receba no seu celular\". Deixe em branco para esconder o canal.",
          campos: (
            <div style={{ display: "grid", gap: "0.9rem", maxWidth: "40rem" }}>
              <Campo rotulo="Canal do WhatsApp" type="url" inputMode="url" value={whatsapp} onChange={(e) => setEdicao({ ...edicao, whatsapp: e.target.value })} placeholder="https://whatsapp.com/channel/…" erro={erroW} ajuda="Endereço do canal ou do grupo, copiado do próprio WhatsApp." />
              <Campo rotulo="Grupo ou canal do Telegram" type="url" inputMode="url" value={telegram} onChange={(e) => setEdicao({ ...edicao, telegram: e.target.value })} placeholder="https://t.me/…" erro={erroT} ajuda="Endereço do canal ou do grupo, copiado do próprio Telegram." />
            </div>
          ),
        },
      ]}
    />
  );
}
