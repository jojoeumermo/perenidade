// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { lerYoutube, playerDoYoutube } from "@/lib/youtube";
import { Aviso, botao, botaoClaro, campo, useAcao, useLista } from "./comum";

interface Estado {
  no_ar: boolean;
  ao_vivo?: string;
}

/**
 * A Rádio Lúcia pelo YouTube, com uma fase de preparação: guardar o endereço da transmissão sem pôr no ar, testar o
 * player aqui dentro (só a equipe vê, pelo youtube-nocookie) e, quando for a hora, pôr no ar para o público. Quem
 * transmite usa o OBS (ou o celular) mandando para o YouTube; a chave de transmissão fica só com quem transmite, nunca
 * no site.
 */
export function RadioNoAr() {
  const estado = useLista<Estado>("radio_estado");
  const acao = useAcao(estado.recarregar);
  const [endereco, setEndereco] = useState<string | null>(null);
  const [testando, setTestando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const guardado = estado.dados?.ao_vivo ?? "";
  const valor = endereco ?? guardado;
  const yt = valor ? lerYoutube(valor) : null;
  const valido = !valor || Boolean(yt) || /^https:\/\/\S+$/.test(valor);
  const noAr = Boolean(estado.dados?.no_ar);
  const mudou = valor !== guardado;
  const passos: [string, boolean][] = [
    ["Endereço da transmissão guardado", Boolean(guardado) && !mudou],
    ["É do YouTube (vídeo, live ou canal)", Boolean(yt)],
    ["Testado aqui no painel", testando],
    ["No ar para o público", noAr],
  ];
  return (
    <section className="mb-8 border-2 border-ink bg-folha p-5 shadow-[5px_5px_0_var(--sombra)]">
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-prelo-texto">{noAr ? "● No ar" : "Em preparação · fora do ar"}</p>
      <h2 className="mt-1 font-serif text-2xl font-semibold">Rádio Lúcia pelo YouTube</h2>
      <p className="mt-1 max-w-3xl text-ink-soft">
        Prepare a transmissão sem mostrar nada ao público: guarde o endereço, teste o player aqui e só ponha no ar quando a equipe decidir. No site, o player do YouTube só carrega
        depois do clique de quem quer ouvir, pelo endereço sem cookies de publicidade (youtube-nocookie.com).
      </p>
      <Aviso texto={estado.erro || acao.aviso} />

      <ol className="mt-4 grid gap-2 sm:grid-cols-4">
        {passos.map(([nome, feito], i) => (
          <li key={nome} className={`flex items-start gap-2 border-2 p-2.5 text-sm ${feito ? "border-ok" : "border-ink/30"}`}>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center font-mono text-xs font-bold ${feito ? "bg-ok text-white" : "border-2 border-ink/40"}`}>{feito ? "✓" : i + 1}</span>
            <span className="leading-snug">{nome}</span>
          </li>
        ))}
      </ol>

      <label className="mt-5 block">
        Endereço da transmissão
        <input value={valor} onChange={(e) => { setEndereco(e.target.value); setTestando(false); }} placeholder="https://www.youtube.com/live/… ou https://www.youtube.com/channel/UC…" className={`${campo} font-mono`} />
      </label>
      {valor && (
        <p className={`mt-1 text-sm ${valido ? "text-ink-soft" : "text-oxblood"}`}>
          {yt ? (yt.tipo === "canal" ? "Canal do YouTube: o site mostra a live que estiver no ar no canal (o melhor para uma rádio contínua)." : "Vídeo ou live do YouTube.") : valido ? "Endereço de áudio: toca no tocador do site." : "Endereço inválido: precisa começar com https://."}
        </p>
      )}
      <p className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className={botao} disabled={acao.ocupado || !valido || !valor || (!mudou && Boolean(guardado))} onClick={() => acao.agir("radio_configurar", { p_no_ar: noAr, p_ao_vivo: valor }, noAr ? "Endereço atualizado; a rádio continua no ar." : "Endereço guardado. A rádio continua fora do ar.")}>
          Guardar o endereço{noAr ? "" : " (fora do ar)"}
        </button>
        <button type="button" className={botaoClaro} disabled={!yt} onClick={() => setTestando((t) => !t)}>
          {testando ? "Fechar o teste" : "Testar o player aqui"}
        </button>
      </p>
      {testando && yt && (
        <div className="mt-4">
          <div className="aspect-video w-full max-w-3xl border-2 border-ink bg-[#17130e]">
            <iframe src={playerDoYoutube(yt)} title="Teste da Rádio Lúcia (só a equipe vê)" className="h-full w-full border-0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" />
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            Se aparecer “vídeo indisponível” ou “a incorporação foi desativada”, falta liberar a incorporação na transmissão (YouTube Studio › a live › Incorporação permitida). Num canal sem live no ar, o
            player avisa que não há transmissão.
          </p>
        </div>
      )}

      <div className="mt-5 border-t-2 border-dashed border-ink/30 pt-4">
        <p className="font-semibold">Quando for a hora de abrir ao público</p>
        {noAr ? (
          <p className="mt-2 flex flex-wrap items-center gap-3">
            <span className="text-sm">A página da rádio mostra o player para todo mundo.</span>
            <button type="button" className="cursor-pointer underline hover:text-oxblood" disabled={acao.ocupado} onClick={() => acao.agir("radio_configurar", { p_no_ar: false, p_ao_vivo: guardado }, "A rádio saiu do ar.")}>
              Tirar do ar
            </button>
          </p>
        ) : confirmar ? (
          <p className="mt-2 flex flex-wrap items-center gap-3">
            <span className="text-sm">O player aparece na página pública da rádio. Pôr no ar agora?</span>
            <button type="button" className={botao} disabled={acao.ocupado || !guardado} onClick={async () => { await acao.agir("radio_configurar", { p_no_ar: true, p_ao_vivo: guardado }, "A Rádio Lúcia está no ar."); setConfirmar(false); }}>
              Sim, pôr no ar
            </button>
            <button type="button" className="cursor-pointer underline" onClick={() => setConfirmar(false)}>
              Ainda não
            </button>
          </p>
        ) : (
          <p className="mt-2">
            <button type="button" className={botaoClaro} disabled={!guardado} onClick={() => setConfirmar(true)}>
              Pôr no ar para o público…
            </button>
          </p>
        )}
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-semibold underline">Passo a passo: transmitir a rádio pelo YouTube</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5">
          <li>No YouTube Studio do canal do instituto, ative as transmissões ao vivo (na primeira vez o YouTube pode levar até 24 horas para liberar).</li>
          <li>Em “Transmitir”, crie uma transmissão contínua: título, visibilidade “Pública” (ou “Não listada” para os testes) e <strong>incorporação permitida</strong>. Marque que não é conteúdo para crianças.</li>
          <li>Instale o OBS Studio (gratuito). Em Configurações › Transmissão, escolha YouTube e cole a chave de transmissão. Ela é secreta: não mande para ninguém nem cole no site.</li>
          <li>Rádio é áudio: monte uma cena com uma imagem fixa (o cartaz da Rádio Lúcia) e as fontes de áudio (microfone, a playlist). Em Saída: vídeo 1280×720 a 30 quadros, 1500 kbps; áudio AAC 128 kbps. Gasta pouca internet de quem transmite.</li>
          <li>Comece a transmitir. Copie o endereço do <strong>canal</strong> (youtube.com/channel/UC…): assim o site sempre mostra a live que estiver no ar, mesmo quando a transmissão é recriada.</li>
          <li>Cole aqui, guarde e teste. Só ponha no ar quando a equipe decidir.</li>
          <li>Programação contínua (24 horas): deixe o OBS tocando uma lista de faixas com licença livre ou próprias. Música com direitos reservados derruba a live e pode dar advertência no canal.</li>
        </ol>
      </details>
    </section>
  );
}
