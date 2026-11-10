// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pilula } from "../ui/Pilula";
import { ColunaDeAcoes } from "./Acoes";
import { FraseDoMosaico } from "./CartaoDoAto";
import { FaixaDoFarol } from "./Farol";
import { CarimboDoAto, Era, MosaicoDoAto } from "./partes";
import { pontoEDetalhe } from "@/lib/rede/atos/formulario";
import { dataLonga } from "@/lib/rede/atos/tempo";
import { enderecos } from "@/lib/rede/tipos";
import { preencherAto, type TextosDosAtos } from "@/lib/rede/textos-atos";
import { corValida, type Ato } from "@/lib/rede/tipos-atos";

/**
 * O chamado do ato. No celular fica em 3 linhas com "mais" (para o próximo ato aparecer embaixo já na primeira tela, como na
 * prancha); o "mais" só aparece quando o texto passa das 3 linhas. No computador, ou aberto, o chamado inteiro e quem chamou.
 */
function Chamado({ ato, t }: { ato: Ato; t: TextosDosAtos }) {
  const texto = useRef<HTMLParagraphElement>(null);
  const [aberto, setAberto] = useState(false);
  const [corta, setCorta] = useState(false);
  useEffect(() => {
    const el = texto.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const medir = () => setCorta(el.scrollHeight > el.clientHeight + 2);
    const olho = new ResizeObserver(medir);
    olho.observe(el);
    medir();
    return () => olho.disconnect();
  }, [ato.descricao]);
  const id = `al-ato-chamado-${ato.id}`;
  return (
    <div className="al-ato-chamado" data-aberto={aberto ? "" : undefined}>
      <p ref={texto} id={id} className="al-ato-aberto-chamado">
        {ato.descricao}
      </p>
      {ato.chamado_por ? <p className="al-ato-chamado-por">{preencherAto(t.chamadoPor, { handle: ato.chamado_por })}</p> : null}
      {corta || aberto ? (
        <button type="button" className="al-ato-chamado-mais" aria-expanded={aberto} aria-controls={id} onClick={() => setAberto((a) => !a)}>
          {aberto ? t.tela.menos : t.tela.mais}
        </button>
      ) : null}
    </div>
  );
}

/**
 * O ato aberto (prancha celular-modo-atos): o mosaico em cima, a comunidade e o carimbo, o nome grande, quando, onde (ponto,
 * cidade e o detalhe), o farol, o chamado e a frase do cartão dourado; à direita, a coluna Você vai / Conversa / Chegar / Chamar /
 * Lembrete. Serve à tela dos atos e à página do ato. `nivel` diz qual nível de título usar (h1 na página, h2 na tela).
 */
export function AtoAberto({ ato, t, lang, logado = true, nivel = 2, depois }: { ato: Ato; t: TextosDosAtos; lang: string; logado?: boolean; nivel?: 1 | 2; depois?: ReactNode }) {
  const { ponto, detalhe } = pontoEDetalhe(ato.onde);
  const Titulo = nivel === 1 ? "h1" : "h2";
  const cancelado = ato.situacao === "cancelado";
  return (
    <article className="al-ato-aberto" aria-labelledby={`al-ato-aberto-${ato.id}`} data-situacao={ato.situacao}>
      <MosaicoDoAto ato={ato} t={t} quebrar={31} className="al-ato-aberto-mosaico" inclinar />
      <div className="al-ato-aberto-corpo">
        <div className="al-ato-aberto-texto">
          <div className="al-ato-aberto-marcas">
            {ato.comunidade ? <Pilula texto={ato.comunidade.nome} slug={ato.comunidade.slug} cor={corValida(ato.comunidade.cor)} href={enderecos.comunidade(lang, ato.comunidade.slug)} tamanho="m" /> : null}
            <CarimboDoAto ato={ato} t={t} tamanho="g" />
          </div>
          <Titulo id={`al-ato-aberto-${ato.id}`} tabIndex={-1} className={`al-cond al-ato-aberto-titulo${cancelado ? " al-riscado" : ""}`}>
            {ato.titulo}
          </Titulo>
          <p className="al-ato-aberto-quando">
            {dataLonga(ato.inicio, lang)}
            {ato.inicio_anterior ? <> · <Era ato={ato} t={t} lang={lang} /></> : null}
          </p>
          <p className="al-ato-aberto-onde">
            {ponto}, {ato.cidade}
            {detalhe ? <> · {detalhe}</> : null}
          </p>
          {ato.motivo && ato.situacao !== "confirmado" ? <p className="al-ato-motivo">{ato.motivo}</p> : null}
          <FaixaDoFarol ato={ato} t={t} />
          <Chamado ato={ato} t={t} />
          <FraseDoMosaico ato={ato} t={t} />
          {depois}
        </div>
        <ColunaDeAcoes ato={ato} t={t} lang={lang} logado={logado} lembrete />
      </div>
    </article>
  );
}
