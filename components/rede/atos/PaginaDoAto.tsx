// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "@/components/Link";
import { Botao } from "../ui/Botao";
import type { PropsDaTelaDoPacote } from "../registro";
import { AtoAberto } from "./AtoAberto";
import { PainelDoFarol } from "./Farol";
import { Icone } from "./partes";
import { avisarAto, frase, useAto, useTextosDosAtos } from "./usar";
import { codigoDoErro } from "@/lib/rede/atos/erros";
import { linkDeApoioSeguro } from "@/lib/rede/atos/chegar";
import { doCampoLocal, paraCampoLocal } from "@/lib/rede/atos/tempo";
import { atos as cliente, PREVIA_DOS_ATOS } from "@/lib/rede/cliente-atos";
import { preencherAto, type TextosDosAtos } from "@/lib/rede/textos-atos";
import { LIMITES_DO_ATO, type Ato, type SituacaoDoAto } from "@/lib/rede/tipos-atos";
import "./atos.css";

/**
 * A página de um ato (/alumia/ato/[id]; prancha celular-modo-atos): o ato aberto com Você vai, Conversa, Chegar e Chamar; embaixo,
 * o lembrete na agenda (.ics feito no aparelho, com avisos 24 h e 2 h antes), o farol da coordenação e o link de apoio externo, quando houver. Quem chamou o ato vê o total exato (só ela) e
 * pode adiar, cancelar ou confirmar de novo; quem confirmou recebe o aviso "ato_mudou" (o servidor manda).
 */
export default function PaginaDoAto({ lang, params, situacao }: PropsDaTelaDoPacote) {
  const t = useTextosDosAtos(lang);
  const { estado, recarregar } = useAto(params.id ?? "");
  if (!t) return <div className="al-ato-pagina" aria-busy="true" />;
  return (
    <div className="al-ato-pagina">
      <header className="al-atos-cabeca">
        <Link href={`/${lang}/alumia/atos`} className="al-atos-voltar" aria-label={t.pagina.todos}>
          {Icone.voltar(26)}
        </Link>
        <Link href={`/${lang}/alumia/atos`} className="al-cond al-atos-titulo" style={{ color: "inherit", textDecoration: "none" }}>
          {t.tela.titulo}
        </Link>
        {/* no celular, o lugar dos botões flutuantes do site (veja .al-atos-vaga em atos.css) */}
        <span className="al-atos-vaga" aria-hidden />
      </header>
      {PREVIA_DOS_ATOS ? <p className="al-atos-previa">{t.tela.previa}</p> : null}
      {estado.fase === "carregando" ? (
        <p className="al-atos-ajuda" aria-busy="true">
          {t.tela.carregando}
        </p>
      ) : estado.fase === "erro" ? (
        <div className="al-atos-vazio" role="alert">
          <p>{codigoDoErro(estado.erro) === "nao_encontrado" ? t.pagina.naoAchado : codigoDoErro(estado.erro) === "generico" ? t.tela.erro : frase(t, estado.erro)}</p>
          <Botao variante="contorno" onClick={recarregar}>
            {t.tela.tentar}
          </Botao>
        </div>
      ) : (
        <>
          <AtoAberto
            ato={estado.dados}
            t={t}
            lang={lang}
            logado={situacao.logado || PREVIA_DOS_ATOS}
            nivel={1}
            depois={<MaisDoAto ato={estado.dados} t={t} />}
          />
          <PainelDoFarol ato={estado.dados} t={t} lang={lang} />
          {estado.dados.meu ? <PainelDeQuemChamou ato={estado.dados} t={t} /> : null}
        </>
      )}
    </div>
  );
}

/** O link de apoio externo (só https; nada de pagamento aqui). O lembrete na agenda fica na coluna de ações. */
function MaisDoAto({ ato, t }: { ato: Ato; t: TextosDosAtos }) {
  const apoio = linkDeApoioSeguro(ato.link_apoio);
  if (!apoio) return null;
  return (
    <div className="al-ato-pagina-mais">
      <a href={apoio} target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer" className="al-botao al-botao-m al-botao-contorno" title={t.acoes.apoioAjuda}>
        <span className="al-botao-icone">{Icone.fora(18)}</span>
        {t.acoes.apoio}
      </a>
    </div>
  );
}

/**
 * Só para quem chamou: o total exato (ninguém mais vê), e adiar / cancelar / confirmar de novo. Adiar pede a nova data (futura,
 * até um ano); o motivo aparece no ato. O servidor confere de novo que é mesmo quem organizou.
 */
function PainelDeQuemChamou({ ato, t }: { ato: Ato; t: TextosDosAtos }) {
  const [modo, setModo] = useState<null | "adiado" | "cancelado">(null);
  const [data, setData] = useState(() => paraCampoLocal(ato.inicio));
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dataRuim, setDataRuim] = useState(false);
  const idErro = useId();
  // O foco acompanha: abrir "Adiar" ou "Cancelar" leva ao primeiro campo; fechar (desistir, Esc ou depois de salvar) devolve
  // ao botão que abriu (ou, se ele sumiu com a mudança, ao título do painel). Nada de foco perdido no corpo da página.
  const primeiro = useRef<HTMLInputElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const botoes = useRef<HTMLDivElement>(null);
  const voltarPara = useRef<"adiado" | "cancelado" | null>(null);
  useEffect(() => {
    if (modo) {
      primeiro.current?.focus();
      return;
    }
    const de = voltarPara.current;
    if (!de) return;
    voltarPara.current = null;
    const botao = botoes.current?.querySelector<HTMLElement>(`[data-modo="${de}"]`);
    (botao ?? titulo.current)?.focus();
  }, [modo]);
  const abrir = (m: "adiado" | "cancelado") => {
    setErro(null);
    setDataRuim(false);
    voltarPara.current = m;
    setModo(m);
  };
  const fechar = () => {
    setErro(null);
    setDataRuim(false);
    setModo(null);
  };
  const aoTecla = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Escape" && !ocupado) {
      e.preventDefault();
      fechar();
    }
  };

  const mudar = async (situacao: SituacaoDoAto, inicio?: string | null) => {
    setOcupado(true);
    setErro(null);
    try {
      const novo = await cliente.mudar(ato.id, { situacao, inicio, motivo: motivo.trim() });
      avisarAto(novo);
      if (!voltarPara.current) voltarPara.current = situacao === "confirmado" ? "adiado" : null;
      setModo(null);
      setMotivo("");
    } catch (e) {
      setErro(codigoDoErro(e) === "generico" ? t.pagina.erroMudar : frase(t, e));
    } finally {
      setOcupado(false);
    }
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (modo === "adiado") {
      const iso = doCampoLocal(data);
      const ms = iso ? new Date(iso).getTime() : NaN;
      if (!iso || !(ms > Date.now()) || ms > Date.now() + LIMITES_DO_ATO.diasMax * 86_400_000) {
        setErro(t.pagina.dataRuim);
        setDataRuim(true);
        primeiro.current?.focus();
        return;
      }
      void mudar("adiado", iso);
    } else if (modo === "cancelado") void mudar("cancelado");
  };

  return (
    <section className="al-ato-org" aria-labelledby={`al-ato-org-${ato.id}`}>
      <h2 id={`al-ato-org-${ato.id}`} ref={titulo} tabIndex={-1} className="al-cond al-ato-org-titulo">
        {t.pagina.organizou}
      </h2>
      <p>{ato.total !== null && ato.total >= 3 ? preencherAto(t.pagina.total, { n: ato.total }) : t.pagina.totalPoucas}</p>
      {modo ? (
        <form className="al-ato-org-form" onSubmit={enviar} onKeyDown={aoTecla} noValidate>
          {modo === "adiado" ? (
            <label>
              {t.pagina.novaData}
              <input
                ref={primeiro}
                type="datetime-local"
                className="al-ato-form-campo"
                value={data}
                onChange={(e) => {
                  setData(e.target.value);
                  if (dataRuim) {
                    setDataRuim(false);
                    setErro(null);
                  }
                }}
                required
                aria-invalid={dataRuim || undefined}
                aria-describedby={dataRuim ? idErro : undefined}
              />
            </label>
          ) : null}
          <label>
            {t.pagina.motivo}
            <input ref={modo === "cancelado" ? primeiro : undefined} className="al-ato-form-campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={140} placeholder={t.pagina.motivoExemplo} />
          </label>
          <p>{t.pagina.aviso}</p>
          <div className="al-ato-org-botoes">
            <Botao type="submit" variante={modo === "cancelado" ? "primario" : "dourado"} aria-busy={ocupado} disabled={ocupado}>
              {modo === "adiado" ? t.pagina.salvarAdiar : t.pagina.salvarCancelar}
            </Botao>
            <Botao variante="fantasma" onClick={fechar} disabled={ocupado}>
              {t.pagina.desistir}
            </Botao>
          </div>
        </form>
      ) : (
        <div ref={botoes} className="al-ato-org-botoes">
          {ato.situacao !== "cancelado" ? (
            <>
              <Botao variante="contorno" data-modo="adiado" onClick={() => abrir("adiado")}>
                {t.pagina.adiar}
              </Botao>
              <Botao variante="contorno" data-modo="cancelado" onClick={() => abrir("cancelado")}>
                {t.pagina.cancelar}
              </Botao>
            </>
          ) : null}
          {ato.situacao !== "confirmado" ? (
            <Botao variante="contorno" aria-busy={ocupado} disabled={ocupado} onClick={() => void mudar("confirmado")}>
              {t.pagina.confirmarDeNovo}
            </Botao>
          ) : null}
        </div>
      )}
      {erro ? (
        <p id={idErro} role="alert" className="al-ato-erro">
          {erro}
        </p>
      ) : null}
    </section>
  );
}
