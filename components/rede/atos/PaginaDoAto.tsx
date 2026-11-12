// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "@/components/Link";
import { Botao } from "../ui/Botao";
import { NaoExiste } from "../ui/NaoExiste";
import type { PropsDaTelaDoPacote } from "../registro";
import { PorNoStoryDoAto } from "../stories/encaixe";
import { AtoAberto } from "./AtoAberto";
import { Caronas } from "./Caronas";
import { PainelDoFarol } from "./Farol";
import { Peticao } from "./Peticao";
import { QuadroDeTarefas } from "./QuadroDeTarefas";
import { Icone } from "./partes";
import { avisarAto, frase, useAto, useTextosDosAtos } from "./usar";
import { codigoDoErro } from "@/lib/rede/atos/erros";
import { linkDeApoioSeguro } from "@/lib/rede/atos/chegar";
import { lerLinkDeApoio, lerMeta } from "@/lib/rede/atos/quadros";
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
      ) : estado.fase === "erro" && codigoDoErro(estado.erro) === "nao_encontrado" ? (
        // Não existe (ou não pode ver): o estado da casa, com caminho de volta. "Tentar de novo" fica só para falha de rede.
        <NaoExiste lang={lang} texto={t.pagina.naoAchado} />
      ) : estado.fase === "erro" ? (
        <div className="al-atos-vazio" role="alert">
          <p>{codigoDoErro(estado.erro) === "generico" ? t.tela.erro : frase(t, estado.erro)}</p>
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
            depois={<MaisDoAto ato={estado.dados} t={t} lang={lang} logado={situacao.logado || PREVIA_DOS_ATOS} />}
          />
          <PainelDoFarol ato={estado.dados} t={t} lang={lang} />
          <QuadroDeTarefas ato={estado.dados} t={t} logado={situacao.logado || PREVIA_DOS_ATOS} />
          <Caronas ato={estado.dados} t={t} lang={lang} logado={situacao.logado || PREVIA_DOS_ATOS} />
          <Peticao ato={estado.dados} t={t} lang={lang} logado={situacao.logado || PREVIA_DOS_ATOS} />
          {estado.dados.meu ? <PainelDeQuemChamou ato={estado.dados} t={t} /> : null}
          <p className="al-ato-nota">{t.mosaico.atraso}</p>
        </>
      )}
    </div>
  );
}

/** O "Pôr no story" e o link de apoio externo (só https; nada de pagamento aqui). O lembrete na agenda fica na coluna de ações. */
function MaisDoAto({ ato, t, lang, logado }: { ato: Ato; t: TextosDosAtos; lang: string; logado: boolean }) {
  const apoio = linkDeApoioSeguro(ato.link_apoio);
  const story = ato.situacao !== "cancelado" ? <PorNoStoryDoAto lang={lang} logado={logado} id={ato.id} /> : null;
  if (!apoio) return story ? <div className="al-ato-pagina-mais">{story}</div> : null;
  return (
    <div className="al-ato-pagina-mais">
      {story}
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
          {erro ? (
            <p id={idErro} role="alert" className="al-ato-erro">
              {erro}
            </p>
          ) : null}
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
      {erro && !modo ? (
        <p id={idErro} role="alert" className="al-ato-erro">
          {erro}
        </p>
      ) : null}
      <MetaEApoio ato={ato} t={t} />
    </section>
  );
}

/**
 * Só para quem chamou: a meta de presença e o link de apoio, editáveis depois de chamar (rede_ato_editar). A meta é um número da
 * organização (o mosaico acende em relação a ela, nunca menos de 30); o link só https, sem telefone. O servidor confere de novo.
 */
function MetaEApoio({ ato, t }: { ato: Ato; t: TextosDosAtos }) {
  const [aberto, setAberto] = useState(false);
  const [meta, setMeta] = useState(ato.meta ? String(ato.meta) : "");
  const [link, setLink] = useState(ato.link_apoio ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Qual campo está errado (aria-invalid, aria-describedby para a mensagem e o foco nele).
  const [ruim, setRuim] = useState<"meta" | "link" | null>(null);
  const [feito, setFeito] = useState("");
  const id = useId();
  const idErro = `${id}-erro`;
  const primeiro = useRef<HTMLInputElement>(null);
  const campoLink = useRef<HTMLInputElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  // Abrir leva ao primeiro campo; fechar (Desistir, Esc ou depois de salvar) devolve ao "Editar".
  const estavaAberto = useRef(false);
  useEffect(() => {
    if (aberto) primeiro.current?.focus();
    else if (estavaAberto.current) botao.current?.focus();
    estavaAberto.current = aberto;
  }, [aberto]);
  const marcar = (campo: "meta" | "link" | null, mensagem: string) => {
    setErro(mensagem);
    setRuim(campo);
    (campo === "link" ? campoLink.current : primeiro.current)?.focus();
  };
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const m = lerMeta(meta);
    const l = lerLinkDeApoio(link);
    if (m === "numero" || l === "link") {
      marcar(m === "numero" ? "meta" : "link", m === "numero" ? t.formulario.problemas.numero : t.formulario.problemas.link);
      return;
    }
    setOcupado(true);
    setErro(null);
    setRuim(null);
    try {
      const novo = await cliente.editar(ato.id, { meta: m, link_apoio: l });
      avisarAto(novo);
      setFeito(t.pagina.editado);
      setAberto(false);
      requestAnimationFrame(() => botao.current?.focus());
    } catch (e) {
      const c = codigoDoErro(e);
      marcar(c === "meta" ? "meta" : c === "link_apoio" || c === "dado_pessoal" ? "link" : null, c === "generico" ? t.pagina.erroMudar : frase(t, e));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="al-ato-org-meta">
      <p className="al-q-meta-atual">{ato.meta ? preencherAto(t.pagina.metaAtual, { n: ato.meta.toLocaleString() }) : t.pagina.semMeta}</p>
      {aberto ? (
        <form
          className="al-ato-org-form"
          onSubmit={(e) => void enviar(e)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !ocupado) {
              e.preventDefault();
              setAberto(false);
            }
          }}
          noValidate
        >
          <label>
            {t.formulario.meta}
            <input
              ref={primeiro}
              className="al-ato-form-campo"
              inputMode="numeric"
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              placeholder={t.formulario.metaExemplo}
              aria-invalid={ruim === "meta" || undefined}
              aria-describedby={`${id}-meta${ruim === "meta" ? ` ${idErro}` : ""}`}
            />
            <small id={`${id}-meta`} className="al-ato-form-ajuda">
              {t.formulario.metaAjuda}
            </small>
          </label>
          <label>
            {t.formulario.link}
            <input
              ref={campoLink}
              className="al-ato-form-campo"
              type="url"
              inputMode="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder={t.formulario.linkExemplo}
              maxLength={LIMITES_DO_ATO.linkMax}
              aria-invalid={ruim === "link" || undefined}
              aria-describedby={`${id}-link${ruim === "link" ? ` ${idErro}` : ""}`}
            />
            <small id={`${id}-link`} className="al-ato-form-ajuda">
              {t.formulario.linkAjuda}
            </small>
          </label>
          {erro ? (
            <p id={idErro} role="alert" className="al-ato-erro">
              {erro}
            </p>
          ) : null}
          <div className="al-ato-org-botoes">
            <Botao type="submit" variante="dourado" disabled={ocupado} aria-busy={ocupado || undefined}>
              {t.pagina.salvarEdicao}
            </Botao>
            <Botao variante="fantasma" onClick={() => setAberto(false)} disabled={ocupado}>
              {t.pagina.desistir}
            </Botao>
          </div>
        </form>
      ) : (
        <div className="al-ato-org-botoes">
          <Botao
            ref={botao}
            variante="contorno"
            onClick={() => {
              setFeito("");
              setErro(null);
              setRuim(null);
              setMeta(ato.meta ? String(ato.meta) : "");
              setLink(ato.link_apoio ?? "");
              setAberto(true);
            }}
          >
            {t.pagina.editar}
          </Botao>
        </div>
      )}
      {/* A confirmação é visível e é a mesma frase que o leitor de tela ouve (role="status" já anuncia). */}
      <p className={feito ? "al-q-feito" : "sr-only"} role="status">
        {feito}
      </p>
    </div>
  );
}
