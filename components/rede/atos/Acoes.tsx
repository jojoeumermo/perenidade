// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As ações do ato, cada uma com a sua função (prancha celular-modo-atos e computador-inicio):
//   Você vai / Eu vou  confirma ou desfaz (o mosaico acende na hora; ninguém vê quem confirmou);
//   Conversa           leva à conversa do ato (a conversa do post do chamado), com o número de respostas;
//   Chegar             abre o mapa livre de fora com o ponto público do ato (sem Referer; a Alumia não vê a posição);
//   Chamar             compartilha pelo aparelho ou copia o link (só o nome do ato, quando e onde).
import { useRef, useState } from "react";
import Link from "@/components/Link";
import { Botao, LinkBotao } from "../ui/Botao";
import { Chegar } from "./Chegar";
import { baixarIcs, chamarAto, enderecoDoAto, Icone } from "./partes";
import { frase, useVou } from "./usar";
import { podeMexer, MOLAS, vibrar } from "@/lib/rede/atos/movimento";
import { enderecos } from "@/lib/rede/tipos";
import { preencherAto, type TextosDosAtos } from "@/lib/rede/textos-atos";
import type { Ato } from "@/lib/rede/tipos-atos";

export interface PropsDasAcoes {
  ato: Ato;
  t: TextosDosAtos;
  lang: string;
  /** Sem entrar não dá para confirmar: o botão leva à entrada. */
  logado?: boolean;
}

/** O botão "Você vai" / "Eu vou" dos cartões (largo). */
export function BotaoVou({ ato, t, lang, logado = true, tamanho = "m", className = "" }: PropsDasAcoes & { tamanho?: "m" | "g"; className?: string }) {
  const { alternar, ocupado, erro } = useVou(ato);
  if (ato.situacao === "cancelado") return null;
  if (!logado) {
    return (
      <LinkBotao href={`/${lang}/entrar`} variante="primario" tamanho={tamanho} className={className}>
        {t.acoes.entrarParaIr}
      </LinkBotao>
    );
  }
  return (
    <>
      <Botao
        variante={ato.vou_eu ? "claro" : "primario"}
        tamanho={tamanho}
        pressionado={ato.vou_eu}
        aria-busy={ocupado}
        icone={ato.vou_eu ? Icone.visto(20) : undefined}
        onClick={alternar}
        title={ato.vou_eu ? t.acoes.vouAjuda : undefined}
        className={className}
      >
        {ato.vou_eu ? t.acoes.voceVai : t.acoes.euVou}
      </Botao>
      {erro ? (
        <span role="alert" className="al-ato-erro">
          {frase(t, erro)}
        </span>
      ) : null}
    </>
  );
}

/**
 * As faíscas douradas do "Você vai": oito pedacinhos saem do botão em roda e caem (Web Animations; some sozinho). Sem movimento,
 * nada. É o único confete da Alumia, e só para quem acabou de confirmar.
 */
export function soltarFaiscas(el: HTMLElement | null): void {
  if (!el || !podeMexer()) return;
  el.animate([{ scale: 0.82 }, { scale: 1 }], { duration: MOLAS.quique.duracao, easing: MOLAS.quique.easing });
  for (let i = 0; i < 9; i++) {
    const p = document.createElement("span");
    p.className = "al-ato-faisca";
    p.setAttribute("aria-hidden", "true");
    el.appendChild(p);
    const ang = (i / 9) * Math.PI * 2 + Math.random() * 0.5;
    const r = 34 + Math.random() * 18;
    const x = Math.cos(ang) * r;
    const y = Math.sin(ang) * r;
    p.animate(
      [
        { transform: "translate(0,0) rotate(0deg) scale(1)", opacity: 1 },
        { transform: `translate(${x}px,${y}px) rotate(${120 + i * 40}deg) scale(0.9)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${x * 1.1}px,${y + 26}px) rotate(${220 + i * 40}deg) scale(0.4)`, opacity: 0 },
      ],
      { duration: 720 + Math.random() * 200, easing: "cubic-bezier(.2,.7,.3,1)" },
    ).onfinish = () => p.remove();
  }
}

/** "Lembrete na agenda": baixa o .ics feito no aparelho (avisos 24 h e 2 h antes, pela própria agenda). */
export function BotaoLembrete({ ato, t, lang, tamanho = "m" }: PropsDasAcoes & { tamanho?: "p" | "m" }) {
  const [baixado, setBaixado] = useState(false);
  if (ato.situacao === "cancelado") return null;
  return (
    <span className="al-ato-lembrete">
      <Botao
        variante="contorno"
        tamanho={tamanho}
        icone={Icone.sino(18)}
        title={t.acoes.lembreteAjuda}
        onClick={() => {
          baixarIcs(ato, lang);
          setBaixado(true);
          window.setTimeout(() => setBaixado(false), 5000);
        }}
      >
        {t.acoes.lembrete}
      </Botao>
      <span role="status" className="al-ato-copiado">
        {baixado ? t.acoes.baixado : ""}
      </span>
    </span>
  );
}

/** "Conversa · 48" (celular) ou "Conversa do ato · 48" (computador). */
export function BotaoConversa({ ato, t, lang, longo, tamanho = "m", className = "" }: PropsDasAcoes & { longo?: boolean; tamanho?: "m" | "g"; className?: string }) {
  const rotulo = longo ? t.acoes.conversaDoAto : t.acoes.conversa;
  return (
    <LinkBotao href={enderecos.post(lang, ato.id)} variante="contorno" tamanho={tamanho} className={className} aria-label={`${rotulo}: ${preencherAto(t.acoes.respostas, { n: ato.respostas })}`}>
      {rotulo}
      {ato.respostas > 0 ? ` · ${ato.respostas}` : ""}
    </LinkBotao>
  );
}

/** O "Chamar" com aviso de "link copiado" quando o aparelho não tem o compartilhar. */
export function useChamar(ato: Ato, lang: string) {
  const [estado, setEstado] = useState<"" | "copiado" | "falhou">("");
  const relogio = useRef<number | undefined>(undefined);
  const chamar = async () => {
    const r = await chamarAto(ato, lang);
    if (r === "copiado" || r === "falhou") {
      setEstado(r);
      window.clearTimeout(relogio.current);
      // quando nem copiar deu, o endereço fica à vista mais tempo (para a pessoa copiar à mão)
      relogio.current = window.setTimeout(() => setEstado(""), r === "falhou" ? 15000 : 4000);
    }
  };
  return { chamar, estado };
}

/** O aviso do Chamar: "link copiado" ou, se nem isso deu, o endereço do ato para copiar à mão. */
function AvisoDoChamar({ ato, t, lang, estado }: { ato: Ato; t: TextosDosAtos; lang: string; estado: "" | "copiado" | "falhou" }) {
  return (
    <span role="status" className="al-ato-copiado" data-falhou={estado === "falhou" ? "" : undefined}>
      {estado === "copiado" ? t.acoes.copiado : estado === "falhou" ? preencherAto(t.acoes.naoCopiou, { url: enderecoDoAto(lang, ato.id) }) : ""}
    </span>
  );
}

/** O botão só de ícone do Chamar (cartão do computador). */
export function BotaoChamarIcone({ ato, t, lang }: PropsDasAcoes) {
  const { chamar, estado: chamado } = useChamar(ato, lang);
  return (
    <span className="al-ato-chamar-icone">
      <Botao variante="contorno" tamanho="m" aria-label={t.acoes.chamarAjuda} title={t.acoes.chamarAjuda} onClick={chamar} icone={Icone.chamar(18)} className="al-ato-quadrado-p" />
      <AvisoDoChamar ato={ato} t={t} lang={lang} estado={chamado} />
    </span>
  );
}

/**
 * A coluna de ações da tela dos atos (prancha celular-modo-atos): quadrados com o rótulo embaixo. "Você vai" fica claro
 * (papel) quando confirmado; a conversa mostra o número de respostas embaixo, como na prancha.
 */
export function ColunaDeAcoes({ ato, t, lang, logado = true, lembrete = false }: PropsDasAcoes & { lembrete?: boolean }) {
  const { alternar, ocupado, erro } = useVou(ato);
  const { chamar, estado: chamado } = useChamar(ato, lang);
  const cancelado = ato.situacao === "cancelado";
  const botaoVou = useRef<HTMLButtonElement>(null);
  const [aviso, setAviso] = useState("");
  const [baixado, setBaixado] = useState(false);
  const aoVou = () => {
    if (ocupado) return;
    const sim = !ato.vou_eu;
    if (sim) {
      soltarFaiscas(botaoVou.current);
      vibrar([10]);
      mostrarMosaico(botaoVou.current);
    }
    setAviso(sim ? t.acoes.vouFeito : t.acoes.vouDesfeito);
    window.setTimeout(() => setAviso(""), 4000);
    void alternar();
  };
  return (
    <div className="al-ato-coluna">
      {cancelado ? null : logado ? (
        <div className="al-ato-acao">
          <button
            ref={botaoVou}
            type="button"
            className={`al-ato-quadrado${ato.vou_eu ? " al-ato-quadrado-ligado" : " al-ato-quadrado-vou"}`}
            aria-pressed={ato.vou_eu}
            aria-busy={ocupado}
            aria-labelledby={`al-vou-${ato.id}`}
            aria-describedby={`al-vou-ajuda-${ato.id}`}
            onClick={aoVou}
          >
            {Icone.visto(30)}
          </button>
          <span id={`al-vou-${ato.id}`} className="al-ato-acao-rotulo">
            {ato.vou_eu ? t.acoes.voceVai : t.acoes.euVou}
          </span>
          <span id={`al-vou-ajuda-${ato.id}`} className="al-so-leitor">
            {t.acoes.vouAjuda}
          </span>
          <span role="status" className="al-so-leitor">
            {erro ? "" : aviso}
          </span>
          {erro ? (
            <span role="alert" className="al-ato-erro">
              {frase(t, erro)}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="al-ato-acao">
          <Link href={`/${lang}/entrar`} className="al-ato-quadrado al-ato-quadrado-vou" aria-labelledby={`al-vou-${ato.id}`}>
            {Icone.visto(30)}
          </Link>
          <span id={`al-vou-${ato.id}`} className="al-ato-acao-rotulo">
            {t.acoes.entrarParaIr}
          </span>
        </div>
      )}
      <div className="al-ato-acao">
        <Link href={enderecos.post(lang, ato.id)} className="al-ato-quadrado" aria-label={`${t.acoes.conversaDoAto}: ${preencherAto(t.acoes.respostas, { n: ato.respostas })}`}>
          {Icone.conversa(26)}
        </Link>
        <span className="al-ato-acao-rotulo al-ato-acao-numero" aria-hidden>
          {ato.respostas > 0 ? ato.respostas : t.acoes.conversa}
        </span>
      </div>
      <div className="al-ato-acao">
        <Chegar
          ato={ato}
          t={t}
          gatilho={(p) => (
            <button type="button" {...p} className="al-ato-quadrado" aria-labelledby={`al-chegar-r-${ato.id}`} aria-describedby={`al-chegar-${ato.id}`} title={t.acoes.chegarAjuda}>
              {Icone.pino(26)}
            </button>
          )}
        />
        <span id={`al-chegar-r-${ato.id}`} className="al-ato-acao-rotulo">
          {t.acoes.chegar}
        </span>
        <span id={`al-chegar-${ato.id}`} className="al-so-leitor">
          {t.acoes.chegarAjuda}
        </span>
      </div>
      <div className="al-ato-acao">
        <button type="button" className="al-ato-quadrado" onClick={chamar} aria-labelledby={`al-chamar-${ato.id}`}>
          {Icone.chamar(26)}
        </button>
        <span id={`al-chamar-${ato.id}`} className="al-ato-acao-rotulo">
          {t.acoes.chamar}
        </span>
        <AvisoDoChamar ato={ato} t={t} lang={lang} estado={chamado} />
      </div>
      {lembrete && !cancelado ? (
        <div className="al-ato-acao">
          <button
            type="button"
            className="al-ato-quadrado al-ato-quadrado-menor"
            data-feito={baixado ? "" : undefined}
            aria-labelledby={`al-lembrete-${ato.id}`}
            aria-describedby={`al-lembrete-ajuda-${ato.id}`}
            title={t.acoes.lembreteAjuda}
            onClick={() => {
              baixarIcs(ato, lang);
              setBaixado(true);
              window.setTimeout(() => setBaixado(false), 5000);
            }}
          >
            {baixado ? Icone.visto(22) : Icone.sino(22)}
          </button>
          <span id={`al-lembrete-${ato.id}`} className="al-ato-acao-rotulo">
            {t.acoes.lembreteCurto}
          </span>
          <span id={`al-lembrete-ajuda-${ato.id}`} className="al-so-leitor">
            {t.acoes.lembreteAjuda}
          </span>
          <span role="status" className="al-so-leitor">
            {baixado ? t.acoes.baixado : ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Quem acabou de confirmar vê o próprio cartão dourado cair no mosaico: se o mosaico do ato rolou para fora da tela (no celular a
 * coluna fica embaixo dele), a tela sobe até ele, suave. O mosaico espera aparecer na tela para soltar o cartão (MosaicoVivo).
 */
function mostrarMosaico(de: HTMLElement | null): void {
  const mosaico = de?.closest(".al-ato-aberto")?.querySelector<HTMLElement>(".al-ato-aberto-mosaico");
  if (!mosaico) return;
  const r = mosaico.getBoundingClientRect();
  if (r.bottom > 90 && r.top < window.innerHeight - 90) return;
  mosaico.scrollIntoView({ behavior: podeMexer() ? "smooth" : "auto", block: "center" });
}
