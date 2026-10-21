// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { lerYoutube } from "@/lib/youtube";
import { Aviso, botao, campo, useAcao, useLista } from "./comum";

interface Estado {
  no_ar: boolean;
  ao_vivo?: string;
}

/**
 * Ligar a Rádio Lúcia: o endereço da transmissão (uma live do YouTube, o canal, ou um endereço de áudio https) e o
 * botão de pôr no ar. A página da rádio mostra o player só quando está no ar. Quem transmite usa o OBS (ou o celular)
 * mandando para o YouTube; a chave de transmissão fica só com quem transmite, nunca no site.
 */
export function RadioNoAr() {
  const estado = useLista<Estado>("radio_estado");
  const acao = useAcao(estado.recarregar);
  const [endereco, setEndereco] = useState<string | null>(null);
  const valor = endereco ?? estado.dados?.ao_vivo ?? "";
  const yt = valor ? lerYoutube(valor) : null;
  const valido = !valor || Boolean(yt) || /^https:\/\/\S+$/.test(valor);
  return (
    <section className="mb-8 border-4 border-ink bg-parchment-deep p-5">
      <h2 className="font-serif text-2xl font-semibold">Rádio Lúcia ao vivo</h2>
      <p className="mt-1 text-ink-soft">Cole o endereço da transmissão e ponha no ar. Pode ser uma live do YouTube (youtube.com/watch?v=…, youtube.com/live/…), o canal (youtube.com/channel/UC…: mostra a live que estiver no ar) ou um endereço de áudio https.</p>
      <Aviso texto={estado.erro || acao.aviso} />
      <label className="mt-3 block">Endereço da transmissão<input value={valor} onChange={(e) => setEndereco(e.target.value)} placeholder="https://www.youtube.com/live/…" className={`${campo} font-mono`} /></label>
      {valor && <p className={`mt-1 text-sm ${valido ? "text-ink-soft" : "text-oxblood"}`}>{yt ? (yt.tipo === "canal" ? "✓ Canal do YouTube: aparece a live que estiver no ar." : "✓ Vídeo ou live do YouTube.") : valido ? "Endereço de áudio: toca no tocador do site." : "Endereço inválido: precisa começar com https://."}</p>}
      <p className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className={botao} disabled={acao.ocupado || !valido} onClick={() => acao.agir("radio_configurar", { p_no_ar: true, p_ao_vivo: valor }, "A Rádio Lúcia está no ar.")}>{estado.dados?.no_ar ? "Atualizar e manter no ar" : "Pôr no ar"}</button>
        {estado.dados?.no_ar && <button type="button" className="cursor-pointer underline hover:text-oxblood" disabled={acao.ocupado} onClick={() => acao.agir("radio_configurar", { p_no_ar: false, p_ao_vivo: valor }, "A rádio saiu do ar.")}>Tirar do ar</button>}
        <span className="text-sm">{estado.dados?.no_ar ? "● no ar" : "fora do ar"}</span>
      </p>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer underline">Como transmitir pelo YouTube</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>No YouTube Studio do canal do instituto, ative as transmissões ao vivo (a primeira vez o YouTube pode levar até 24 horas para liberar).</li>
          <li>Crie a transmissão: título, visibilidade “Pública” ou “Não listada” e deixe a incorporação em outros sites permitida.</li>
          <li>No computador, use o OBS Studio (gratuito): Configurações › Transmissão › YouTube, cole a chave de transmissão (ela é secreta: não mande para ninguém nem cole no site). No celular, use o próprio aplicativo do YouTube.</li>
          <li>Comece a transmitir, copie o endereço da live e cole aqui em cima. Ponha no ar.</li>
          <li>Para programação contínua (24 horas), deixe o OBS tocando uma lista de faixas com licença livre ou próprias: músicas com direitos reservados derrubam a live.</li>
        </ol>
      </details>
    </section>
  );
}
