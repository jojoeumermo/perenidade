// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Botao } from "../ui/Botao";
import { frase } from "./usar";
import { useAnuncio, useQuadro } from "./usarQuadro";
import { codigoDoErro } from "@/lib/rede/atos/erros";
import { conferirPeticao } from "@/lib/rede/atos/quadros";
import { dataLonga, doCampoLocal } from "@/lib/rede/atos/tempo";
import { atos as cliente } from "@/lib/rede/cliente-atos";
import { preencherAto, type TextosDosAtos } from "@/lib/rede/textos-atos";
import { LIMITES_DO_ATO, type Ato, type PeticaoDoAto } from "@/lib/rede/tipos-atos";
import "./quadros.css";

/**
 * O abaixo-assinado do ato (PLANO-ALUMIA §4.2, "petição sem lista"): para quem, o que pede, o prazo e o total. NINGUÉM vê quem
 * assinou, nem quem criou; o total só aparece a partir de 3 e anda de 15 em 15 minutos (a mesma regra do mosaico, para ninguém
 * deduzir quem acabou de assinar). A petição não está no post: nunca sai para o Fediverso. Só quem organiza o ato abre e encerra.
 */
export function Peticao({ ato, t, lang, logado }: { ato: Ato; t: TextosDosAtos; lang: string; logado: boolean }) {
  const carregar = useCallback(() => cliente.peticao(ato.id), [ato.id]);
  const { estado, trocar } = useQuadro<PeticaoDoAto | null>(carregar, ato.id);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const [anuncio, anunciar] = useAnuncio();
  const idTitulo = useId();
  const idExplica = useId();

  if (estado.fase !== "pronto") return null;
  const p = estado.dados;
  if (!p && !ato.meu) return null;

  const assinar = async () => {
    if (!p || ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      const nova = await cliente.peticaoAssinar(p.id, !p.assinei);
      trocar(nova);
      anunciar(p.assinei ? t.peticao.tirado : t.peticao.assinado);
    } catch (e) {
      setErro(frase(t, e));
    } finally {
      setOcupado(false);
    }
  };
  const encerrar = async () => {
    if (!p || ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      trocar(await cliente.peticaoEncerrar(p.id));
      setEncerrando(false);
      anunciar(t.peticao.encerrada);
    } catch (e) {
      setErro(frase(t, e));
    } finally {
      setOcupado(false);
    }
  };

  if (!p) {
    // Só quem organiza chega aqui: o convite para abrir a petição do ato.
    return (
      <section className="al-q al-q-peticao al-q-peticao-nova" aria-labelledby={idTitulo}>
        <header className="al-q-cabeca">
          <h2 id={idTitulo} className="al-cond al-q-titulo">
            {t.peticao.titulo}
          </h2>
          <p className="al-q-explica">{t.peticao.criarAjuda}</p>
        </header>
        {criando ? (
          <NovaPeticao
            t={t}
            aoFechar={() => setCriando(false)}
            aoAbrir={async (pedido) => {
              trocar(await cliente.peticaoCriar(ato.id, pedido));
              setCriando(false);
            }}
          />
        ) : ato.situacao !== "cancelado" ? (
          <div className="al-q-acoes">
            <Botao variante="contorno" onClick={() => setCriando(true)}>
              {t.peticao.criar}
            </Botao>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="al-q al-q-peticao" aria-labelledby={idTitulo} aria-describedby={idExplica} data-aberta={p.aberta ? "sim" : undefined}>
      <header className="al-q-cabeca">
        <h2 id={idTitulo} className="al-cond al-q-titulo">
          {t.peticao.titulo}
          {!p.aberta ? <span className="al-q-carimbo">{t.peticao.encerrada}</span> : null}
        </h2>
        <p className="al-q-para">{preencherAto(t.peticao.para, { alvo: p.alvo })}</p>
      </header>
      <blockquote className="al-q-texto">{p.texto}</blockquote>
      <div className="al-q-placar">
        <p className="al-q-total" aria-live="off">
          {p.total !== null ? (
            <>
              {/* O número grande no meio da frase do idioma ("{n} assinaturas", "Подписей: {n}"). */}
              <span className="sr-only">{preencherAto(t.peticao.total, { n: p.total.toLocaleString(lang) })}</span>
              <span aria-hidden className="al-q-numero-rotulo">
                {t.peticao.total.split("{n}")[0]}
                <span className="al-cond al-q-numero">{p.total.toLocaleString(lang)}</span>
                {t.peticao.total.split("{n}")[1] ?? ""}
              </span>
            </>
          ) : (
            <span className="al-q-poucas">{t.peticao.poucas}</span>
          )}
        </p>
        {p.prazo ? (
          <p className="al-q-linha">
            <time dateTime={p.prazo}>{preencherAto(t.peticao.prazo, { data: dataLonga(p.prazo, lang) })}</time>
          </p>
        ) : null}
      </div>
      <p id={idExplica} className="al-q-explica">
        {t.peticao.explica}
      </p>
      <div className="al-q-acoes">
        {p.aberta || p.assinei ? (
          <Botao
            variante={p.assinei ? "claro" : "primario"}
            pressionado={p.assinei}
            disabled={ocupado || !logado}
            aria-busy={ocupado || undefined}
            title={!logado ? t.peticao.entrar : undefined}
            onClick={() => void assinar()}
          >
            {p.assinei ? t.peticao.assinei : t.peticao.assinar}
          </Botao>
        ) : null}
        {p.assinei ? (
          <Botao variante="fantasma" tamanho="p" disabled={ocupado} onClick={() => void assinar()}>
            {t.peticao.tirar}
          </Botao>
        ) : null}
        {p.organiza && p.aberta ? (
          encerrando ? (
            <>
              <Botao variante="contorno" disabled={ocupado} onClick={() => void encerrar()}>
                {t.peticao.encerrarCerto}
              </Botao>
              <Botao variante="fantasma" disabled={ocupado} onClick={() => setEncerrando(false)}>
                {t.peticao.deixar}
              </Botao>
            </>
          ) : (
            <Botao variante="fantasma" onClick={() => setEncerrando(true)}>
              {t.peticao.encerrar}
            </Botao>
          )
        ) : null}
      </div>
      {!logado ? <p className="al-q-ajuda">{t.peticao.entrar}</p> : null}
      {erro ? (
        <p role="alert" className="al-ato-erro">
          {erro}
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>
    </section>
  );
}

function NovaPeticao({ t, aoFechar, aoAbrir }: { t: TextosDosAtos; aoFechar: () => void; aoAbrir: (p: { alvo: string; texto: string; prazo: string | null }) => Promise<void> }) {
  const [alvo, setAlvo] = useState("");
  const [texto, setTexto] = useState("");
  const [prazo, setPrazo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const primeiro = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => {
    primeiro.current?.focus();
  }, []);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const prazoIso = prazo ? doCampoLocal(prazo) : null;
    const p = conferirPeticao(alvo, texto, prazoIso);
    if (p.alvo || p.texto || p.prazo) {
      setErro(p.alvo === "dado_pessoal" || p.texto === "dado_pessoal" ? t.erros.dado_pessoal : p.prazo ? t.erros.data : t.erros.texto);
      return;
    }
    setOcupado(true);
    setErro(null);
    try {
      await aoAbrir({ alvo: alvo.replace(/\s+/g, " ").trim(), texto: texto.trim(), prazo: prazoIso });
    } catch (e) {
      setErro(codigoDoErro(e) === "generico" ? t.tela.erro : frase(t, e));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <form
      className="al-q-form"
      onSubmit={(e) => void enviar(e)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !ocupado) {
          e.preventDefault();
          aoFechar();
        }
      }}
      noValidate
    >
      <label className="al-q-campo">
        <span>{t.peticao.alvo}</span>
        <input ref={primeiro} className="al-ato-form-campo" value={alvo} onChange={(e) => setAlvo(e.target.value)} placeholder={t.peticao.alvoExemplo} maxLength={LIMITES_DO_ATO.alvoMax} autoComplete="off" />
      </label>
      <label className="al-q-campo">
        <span>{t.peticao.texto}</span>
        <textarea className="al-ato-form-campo al-ato-form-chamado" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={t.peticao.textoExemplo} maxLength={LIMITES_DO_ATO.peticaoMax} aria-describedby={`${id}-conta`} />
        <small id={`${id}-conta`} className="al-q-ajuda" aria-live="polite">
          {texto.length > LIMITES_DO_ATO.peticaoMax - 150 ? preencherAto(t.peticao.restam, { n: LIMITES_DO_ATO.peticaoMax - texto.length }) : ""}
        </small>
      </label>
      <label className="al-q-campo">
        <span>{t.peticao.prazoRotulo}</span>
        <input className="al-ato-form-campo" type="datetime-local" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
      </label>
      {erro ? (
        <p role="alert" className="al-ato-erro">
          {erro}
        </p>
      ) : null}
      <div className="al-q-acoes">
        <Botao type="submit" variante="primario" disabled={ocupado} aria-busy={ocupado || undefined}>
          {t.peticao.abrir}
        </Botao>
        <Botao variante="fantasma" onClick={aoFechar} disabled={ocupado}>
          {t.peticao.deixar}
        </Botao>
      </div>
    </form>
  );
}
