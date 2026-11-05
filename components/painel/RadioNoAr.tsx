// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Check, MonitorPlay, Radio, Save, X } from "lucide-react";
import { useState } from "react";
import { lerYoutube, playerDoYoutube } from "@/lib/youtube";
import { Aviso, useAcao, useLista } from "./comum";
import { Botao, Campo, Cartao, Esqueleto, Faixa } from "./ui";

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
    <Cartao className="mb-8" titulo="Rádio Lúcia pelo YouTube">
      {/* O estado da rádio numa faixa: no ar (bordô, com o ponto) ou em preparação. A palavra diz; a cor acompanha. */}
      <Faixa tom={noAr ? "bordo" : "info"} titulo={noAr ? "No ar" : "Em preparação · fora do ar"} className="mt-2">
        Prepare a transmissão sem mostrar nada ao público: guarde o endereço, teste o player aqui e só ponha no ar quando a equipe decidir. No site, o player do YouTube só carrega
        depois do clique de quem quer ouvir, pelo endereço sem cookies de publicidade (youtube-nocookie.com).
      </Faixa>
      {estado.erro && <Faixa tom="erro" className="mt-2" acao={<Botao pequeno onClick={estado.recarregar}>Tentar de novo</Botao>}>{estado.erro}</Faixa>}
      <Aviso texto={acao.aviso} />
      {estado.dados === null && !estado.erro && <Esqueleto linhas={2} />}

      <ol className="mt-2 grid gap-2 sm:grid-cols-4">
        {passos.map(([nome, feito], i) => (
          <li key={nome} className={`flex items-start gap-2 rounded-[var(--pn-raio)] border p-2.5 text-sm ${feito ? "border-ok bg-[var(--pn-superficie)]" : "border-[var(--pn-borda)]"}`}>
            <span aria-hidden className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${feito ? "bg-ok text-[var(--pn-superficie)]" : "border border-[var(--pn-borda-forte)] text-ink-soft"}`}>{feito ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
            <span className="leading-snug">
              {feito && <span className="sr-only">✓ </span>}
              {nome}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-5">
        <Campo rotulo="Endereço da transmissão" value={valor} onChange={(e) => { setEndereco(e.target.value); setTestando(false); }} placeholder="https://www.youtube.com/live/… ou https://www.youtube.com/channel/UC…" className="font-mono" />
      </div>
      {valor && (
        <p className={`mt-1 text-sm ${valido ? "text-ink-soft" : "text-oxblood"}`}>
          {yt ? (yt.tipo === "canal" ? "Canal do YouTube: o site mostra a live que estiver no ar no canal (o melhor para uma rádio contínua)." : "Vídeo ou live do YouTube.") : valido ? "Endereço de áudio: toca no tocador do site." : "Endereço inválido: precisa começar com https://."}
        </p>
      )}
      <p className="mt-3 flex flex-wrap items-center gap-2">
        <Botao variante="principal" simbolo={Save} carregando={acao.ocupado} disabled={acao.ocupado || !valido || !valor || (!mudou && Boolean(guardado))} onClick={() => acao.agir("radio_configurar", { p_no_ar: noAr, p_ao_vivo: valor }, noAr ? "Endereço atualizado; a rádio continua no ar." : "Endereço guardado. A rádio continua fora do ar.")}>
          Guardar o endereço{noAr ? "" : " (fora do ar)"}
        </Botao>
        <Botao simbolo={testando ? X : MonitorPlay} disabled={!yt} aria-pressed={testando} onClick={() => setTestando((t) => !t)}>
          {testando ? "Fechar o teste" : "Testar o player aqui"}
        </Botao>
      </p>
      {testando && yt && (
        <div className="mt-4">
          <div className="aspect-video w-full max-w-3xl overflow-hidden rounded-[var(--pn-raio-cartao)] border border-[var(--pn-borda)] bg-[var(--pn-menu-fundo)]">
            <iframe src={playerDoYoutube(yt)} title="Teste da Rádio Lúcia (só a equipe vê)" className="h-full w-full border-0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" />
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            Se aparecer “vídeo indisponível” ou “a incorporação foi desativada”, falta liberar a incorporação na transmissão (YouTube Studio › a live › Incorporação permitida). Num canal sem live no ar, o
            player avisa que não há transmissão.
          </p>
        </div>
      )}

      <div className="mt-5 border-t border-dashed border-[var(--pn-borda-forte)] pt-4">
        <p className="font-semibold">Quando for a hora de abrir ao público</p>
        {noAr ? (
          <Faixa tom="bordo" className="mt-2" acao={<Botao pequeno disabled={acao.ocupado} onClick={() => acao.agir("radio_configurar", { p_no_ar: false, p_ao_vivo: guardado }, "A rádio saiu do ar.")}>Tirar do ar</Botao>}>
            A página da rádio mostra o player para todo mundo.
          </Faixa>
        ) : confirmar ? (
          <Faixa
            tom="aviso"
            className="mt-2"
            acao={
              <>
                <Botao variante="principal" pequeno simbolo={Radio} carregando={acao.ocupado} disabled={acao.ocupado || !guardado} onClick={async () => { await acao.agir("radio_configurar", { p_no_ar: true, p_ao_vivo: guardado }, "A Rádio Lúcia está no ar."); setConfirmar(false); }}>
                  Sim, pôr no ar
                </Botao>
                <Botao variante="discreto" pequeno onClick={() => setConfirmar(false)}>
                  Ainda não
                </Botao>
              </>
            }
          >
            O player aparece na página pública da rádio. Pôr no ar agora?
          </Faixa>
        ) : (
          <p className="mt-2">
            <Botao simbolo={Radio} disabled={!guardado} onClick={() => setConfirmar(true)}>
              Pôr no ar para o público…
            </Botao>
          </p>
        )}
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer rounded-[var(--pn-raio)] font-semibold">Passo a passo: transmitir a rádio pelo YouTube</summary>
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
    </Cartao>
  );
}
