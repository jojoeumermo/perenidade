// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As ações do ato, cada uma com a sua função (prancha celular-modo-atos e computador-inicio):
//   Você vai / Eu vou  confirma ou desfaz (o mosaico acende na hora; ninguém vê quem confirmou);
//   Conversa           leva à conversa do ato (a conversa do post do chamado), com o número de respostas;
//   Chegar             abre o mapa livre de fora com o ponto público do ato (sem Referer; a Alumia não vê a posição);
//   Chamar             compartilha pelo aparelho ou copia o link (só o nome do ato, quando e onde).
import { useState } from "react";
import Link from "@/components/Link";
import { Botao, LinkBotao } from "../ui/Botao";
import { chamarAto, hrefDoChegar, Icone } from "./partes";
import { useVou } from "./usar";
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
          {t.acoes.erroVou}
        </span>
      ) : null}
    </>
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
  const [copiado, setCopiado] = useState(false);
  const chamar = async () => {
    const r = await chamarAto(ato, lang);
    if (r === "copiado") {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 4000);
    }
  };
  return { chamar, copiado };
}

/** O botão só de ícone do Chamar (cartão do computador). */
export function BotaoChamarIcone({ ato, t, lang }: PropsDasAcoes) {
  const { chamar, copiado } = useChamar(ato, lang);
  return (
    <span className="al-ato-chamar-icone">
      <Botao variante="contorno" tamanho="m" aria-label={t.acoes.chamarAjuda} title={t.acoes.chamarAjuda} onClick={chamar} icone={Icone.chamar(18)} className="al-ato-quadrado-p" />
      <span role="status" className="al-ato-copiado">
        {copiado ? t.acoes.copiado : ""}
      </span>
    </span>
  );
}

/**
 * A coluna de ações da tela dos atos (prancha celular-modo-atos): quadrados com o rótulo embaixo. "Você vai" fica claro
 * (papel) quando confirmado; a conversa mostra o número de respostas embaixo, como na prancha.
 */
export function ColunaDeAcoes({ ato, t, lang, logado = true }: PropsDasAcoes) {
  const { alternar, ocupado, erro } = useVou(ato);
  const { chamar, copiado } = useChamar(ato, lang);
  const cancelado = ato.situacao === "cancelado";
  return (
    <div className="al-ato-coluna">
      {cancelado ? null : logado ? (
        <div className="al-ato-acao">
          <button
            type="button"
            className={`al-ato-quadrado${ato.vou_eu ? " al-ato-quadrado-ligado" : " al-ato-quadrado-vou"}`}
            aria-pressed={ato.vou_eu}
            aria-busy={ocupado}
            aria-labelledby={`al-vou-${ato.id}`}
            onClick={alternar}
          >
            {Icone.visto(30)}
          </button>
          <span id={`al-vou-${ato.id}`} className="al-ato-acao-rotulo">
            {ato.vou_eu ? t.acoes.voceVai : t.acoes.euVou}
          </span>
          {erro ? (
            <span role="alert" className="al-ato-erro">
              {t.acoes.erroVou}
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
        <a href={hrefDoChegar(ato)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="al-ato-quadrado" aria-label={t.acoes.chegar} aria-describedby={`al-chegar-${ato.id}`} title={t.acoes.chegarAjuda}>
          {Icone.pino(26)}
        </a>
        <span className="al-ato-acao-rotulo">{t.acoes.chegar}</span>
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
        <span role="status" className="al-ato-copiado">
          {copiado ? t.acoes.copiado : ""}
        </span>
      </div>
    </div>
  );
}
