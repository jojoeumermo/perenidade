// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useId, useRef, useState } from "react";
import Link from "@/components/Link";
import { localePath } from "@/i18n/config";
import type { Post } from "@/lib/rede/tipos";
import { COAUTORAS_NO_MAXIMO, fonteDoLinkOk, linhaDaCoautoria, textoDosPedidosDeFonte, valeDoEndereco, type PessoaDoCartao } from "@/lib/rede/tipos-conversa";
import type { ContextoDoEncaixe } from "../encaixes";
import { LinkDoLeitor } from "../protecao/LinkDoLeitor";
import { casoPublicado, coautoria } from "./cliente";
import { encher, textoDoErro, type TextosDaCoautoria } from "./textos";
import { useAbrirPainel, useCoautoriaDoCartao, type PainelDaCoautoria } from "./use-cartao";
import "./coautoria.css";

/** O @ que a pessoa escreveu, sem o @ e sem espaço; nulo se não tem a forma de um @ daqui. */
const handleDigitado = (texto: string): string | null => {
  const h = texto.trim().replace(/^@/, "").toLowerCase();
  return /^[a-z0-9_]{3,20}$/.test(h) ? h : null;
};

/**
 * O que a frente 12C pendura embaixo do texto do cartão (encaixe anexosDoCartao):
 *  - "Assinado junto com …": só quem ACEITOU; para quem foi chamada, aceitar ou recusar ali mesmo, e depois deixar de assinar;
 *  - a fonte que a autora pôs (link de fora e/ou a ficha do caso no Vale o Escrito, link interno);
 *  - para a autora e a mediação, se pediram a fonte (o número só a partir de 3);
 *  - o "Fonte?" de quem lê (o pedido vai sem o nome);
 *  - os painéis da autora que o menu "mais" abre: assinar junto, pôr a fonte, marcar na foto.
 */
export default function AnexoDaCoautoria({ lang, post, situacao }: ContextoDoEncaixe & { post: Post }) {
  const { c, t, renovar } = useCoautoriaDoCartao(post.id, lang);
  const [painel, setPainel] = useState<PainelDaCoautoria | null>(null);
  const [nota, setNota] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const idRegra = useId();
  useAbrirPainel(post.id, useCallback((p: PainelDaCoautoria) => setPainel(p), []));

  if (!t) return null;
  const autora = c.convites !== null;
  const pedidos = textoDosPedidosDeFonte(c.pedidos_fonte, t.fonte);
  const chip = situacao.logado && !c.fonte && (c.pode_pedir_fonte || c.pedi_fonte);
  const nada = c.coautores.length === 0 && !c.meu_convite && !c.fonte && !pedidos && !chip && !painel && !nota;
  if (nada) return null;

  const agir = async (tarefa: () => Promise<unknown>, feito: string) => {
    setOcupado(true);
    try {
      await tarefa();
      setNota({ texto: feito });
      renovar();
      return true;
    } catch (e) {
      setNota({ texto: textoDoErro(t, e), erro: true });
      return false;
    } finally {
      setOcupado(false);
    }
  };

  return (
    // Os toques aqui dentro não abrem o post (o cartão inteiro é clicável).
    <div className="co-anexo" onClick={(e) => e.stopPropagation()}>
      {c.coautores.length > 0 && (
        <p className="co-assinado">
          <Ladrilhos />
          <span>{encher(t.assinar.linha, { nomes: linhaDaCoautoria(c.coautores, lang) })}</span>
          {c.meu_convite === "aceita" && (
            <button type="button" className="co-botao co-botao-leve" disabled={ocupado} onClick={() => void agir(() => coautoria.sair(post.id), t.assinar.saiu)}>
              {t.assinar.sair}
            </button>
          )}
        </p>
      )}

      {c.meu_convite === "convite" && (
        <div className="co-convite" role="group" aria-label={encher(t.assinar.convidadaTitulo, { codinome: post.autor.codinome })}>
          <p className="co-convite-titulo al-cond">{encher(t.assinar.convidadaTitulo, { codinome: post.autor.codinome })}</p>
          <p className="co-texto">{t.assinar.convidadaTexto}</p>
          <div className="co-linha">
            <button type="button" className="co-botao co-botao-cheio" disabled={ocupado} onClick={() => void agir(() => coautoria.decidir(post.id, true), t.assinar.aceitou)}>
              {t.assinar.aceitar}
            </button>
            <button type="button" className="co-botao" disabled={ocupado} onClick={() => void agir(() => coautoria.decidir(post.id, false), t.assinar.recusou)}>
              {t.assinar.recusar}
            </button>
          </div>
        </div>
      )}

      {c.fonte && (
        <p className="co-fonte">
          <span className="co-carimbo al-cond">{t.fonte.daAutora}</span>
          {c.fonte.link && (
            <LinkDoLeitor href={c.fonte.link} lang={lang} className="co-link">
              {c.fonte.link.replace(/^https?:\/\//, "").slice(0, 70)}
            </LinkDoLeitor>
          )}
          {c.fonte.vale && <SeloDoVale lang={lang} vale={c.fonte.vale} t={t} />}
        </p>
      )}

      {(pedidos || chip) && (
        <div className="co-linha co-linha-fonte">
          {chip && (
            <button
              type="button"
              className="co-chip"
              aria-pressed={c.pedi_fonte}
              aria-label={c.pedi_fonte ? t.fonte.desfazerRotulo : t.fonte.pedirRotulo}
              aria-describedby={idRegra}
              disabled={ocupado}
              onClick={() => void agir(() => coautoria.pedirFonte(post.id, !c.pedi_fonte), c.pedi_fonte ? t.fonte.pedidoDesfeito : t.fonte.pedidoFeito)}
            >
              <span aria-hidden className="co-chip-marca">?</span>
              {c.pedi_fonte ? t.fonte.pedida : t.fonte.pedir}
            </button>
          )}
          {pedidos && <span className="co-pedidos">{pedidos}</span>}
          <span id={idRegra} className="co-oculto">{t.fonte.regra}</span>
        </div>
      )}

      {autora && painel === "assinar" && (
        <PainelAssinar post={post.id} t={t} convites={c.convites ?? []} coautores={c.coautores} pode={c.pode_convidar} aoFechar={() => setPainel(null)} renovar={renovar} />
      )}
      {autora && painel === "fonte" && <PainelFonte post={post.id} lang={lang} t={t} atual={c.fonte} aoFechar={() => setPainel(null)} renovar={renovar} />}
      {autora && painel === "marcar" && c.marcar_pode && (
        <PainelMarcar post={post.id} t={t} esperando={c.marcacoes_esperando ?? []} aoFechar={() => setPainel(null)} renovar={renovar} />
      )}

      {nota && (
        <p className="co-nota" role={nota.erro ? "alert" : "status"} data-erro={nota.erro ? "" : undefined}>
          {nota.texto}
        </p>
      )}
    </div>
  );
}

/** O selo que leva à ficha do caso no Vale o Escrito (link interno, no idioma da página). */
export function SeloDoVale({ lang, vale, t }: { lang: string; vale: string; t: TextosDaCoautoria }) {
  return (
    <Link href={localePath(lang, `/vale-o-escrito/caso/${vale}`)} className="co-vale" title={t.vale.abrir}>
      <svg aria-hidden viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.2 4.2L19 7" />
      </svg>
      <span>{t.vale.selo}</span>
    </Link>
  );
}

function Ladrilhos() {
  return (
    <span className="co-ladrilhos" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

function Cabeca({ titulo, explica, fechar, aoFechar }: { titulo: string; explica: string; fechar: string; aoFechar: () => void }) {
  return (
    <>
      <div className="co-painel-alto">
        <p className="co-painel-titulo al-cond">{titulo}</p>
        <button type="button" className="co-botao co-botao-leve" onClick={aoFechar}>
          {fechar}
        </button>
      </div>
      <p className="co-texto">{explica}</p>
    </>
  );
}

/** Lista de pessoas da autora (convites sem resposta, marcações esperando), cada uma com "Tirar". */
function ListaDaAutora({ pessoas, rotulo, tirar, ocupado, aoTirar }: { pessoas: PessoaDoCartao[]; rotulo: string; tirar: string; ocupado: boolean; aoTirar: (h: string) => void }) {
  if (pessoas.length === 0) return null;
  return (
    <ul className="co-lista">
      {pessoas.map((p) => (
        <li key={p.handle ?? p.codinome} className="co-item">
          <span>
            <strong>{p.codinome}</strong>
            {p.handle && <small>@{p.handle}</small>}
          </span>
          <span className="co-item-estado">{rotulo}</span>
          {p.handle && (
            <button type="button" className="co-botao co-botao-leve" disabled={ocupado} onClick={() => aoTirar(p.handle as string)}>
              {tirar}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function PainelAssinar({ post, t, convites, coautores, pode, aoFechar, renovar }: {
  post: string; t: TextosDaCoautoria; convites: PessoaDoCartao[]; coautores: PessoaDoCartao[]; pode: boolean; aoFechar: () => void; renovar: () => void;
}) {
  const [campo, setCampo] = useState("");
  const [nota, setNota] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const id = useId();
  const handle = handleDigitado(campo);
  const cheio = !pode || coautores.length + convites.length >= COAUTORAS_NO_MAXIMO;

  async function convidar() {
    if (!handle) return;
    setOcupado(true);
    try {
      const r = await coautoria.convidar(post, handle);
      setNota({ texto: r.estado === "feita" ? t.assinar.jaFeito : t.assinar.feito });
      setCampo("");
      renovar();
    } catch (e) {
      setNota({ texto: textoDoErro(t, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }
  async function tirar(h: string) {
    setOcupado(true);
    try {
      await coautoria.tirar(post, h);
      renovar();
    } catch (e) {
      setNota({ texto: textoDoErro(t, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="co-painel" aria-labelledby={`${id}-t`}>
      <span id={`${id}-t`} hidden>{t.assinar.titulo}</span>
      <Cabeca titulo={t.assinar.titulo} explica={t.assinar.explica} fechar={t.assinar.fechar} aoFechar={aoFechar} />
      <ListaDaAutora pessoas={convites} rotulo={t.assinar.esperando} tirar={t.assinar.tirar} ocupado={ocupado} aoTirar={(h) => void tirar(h)} />
      {cheio ? (
        <p className="co-texto co-forte">{t.assinar.cheio}</p>
      ) : (
        <form
          className="co-form"
          onSubmit={(e) => {
            e.preventDefault();
            void convidar();
          }}
        >
          <label htmlFor={`${id}-h`}>{t.assinar.campo}</label>
          <input id={`${id}-h`} className="co-campo" value={campo} onChange={(e) => setCampo(e.target.value)} autoComplete="off" spellCheck={false} maxLength={21} placeholder="@" />
          <button type="submit" className="co-botao co-botao-cheio" disabled={ocupado || !handle}>
            {t.assinar.convidar}
          </button>
        </form>
      )}
      {nota && <p className="co-nota" role={nota.erro ? "alert" : "status"} data-erro={nota.erro ? "" : undefined}>{nota.texto}</p>}
    </section>
  );
}

function PainelFonte({ post, lang, t, atual, aoFechar, renovar }: {
  post: string; lang: string; t: TextosDaCoautoria; atual: { link: string | null; vale: string | null } | null; aoFechar: () => void; renovar: () => void;
}) {
  const [link, setLink] = useState(atual?.link ?? "");
  const [vale, setVale] = useState(atual?.vale ?? "");
  const [nota, setNota] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const id = useId();
  const caso = vale.trim() ? valeDoEndereco(vale) : null;
  const linkOk = !link.trim() || fonteDoLinkOk(link);
  const valeOk = !vale.trim() || caso !== null;
  const algo = Boolean(link.trim() || vale.trim());

  async function salvar() {
    setOcupado(true);
    try {
      if (caso && (await casoPublicado(lang, caso)) === false) {
        setNota({ texto: t.vale.naoAchou, erro: true });
        return;
      }
      await coautoria.darFonte(post, { link: link.trim() || null, vale: caso });
      setNota({ texto: t.fonte.posta });
      renovar();
    } catch (e) {
      setNota({ texto: textoDoErro(t, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }
  async function tirar() {
    setOcupado(true);
    try {
      await coautoria.tirarFonte(post);
      setLink("");
      setVale("");
      setNota({ texto: t.fonte.tirada });
      renovar();
    } catch (e) {
      setNota({ texto: textoDoErro(t, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="co-painel" aria-label={t.fonte.titulo}>
      <Cabeca titulo={t.fonte.titulo} explica={t.fonte.explica} fechar={t.assinar.fechar} aoFechar={aoFechar} />
      <form
        className="co-form co-form-coluna"
        onSubmit={(e) => {
          e.preventDefault();
          if (algo && linkOk && valeOk) void salvar();
        }}
      >
        <label htmlFor={`${id}-l`}>{t.fonte.linkRotulo}</label>
        <input id={`${id}-l`} className="co-campo" type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} maxLength={500} placeholder="https://" aria-invalid={!linkOk} />
        <label htmlFor={`${id}-v`}>{t.vale.rotulo}</label>
        <input id={`${id}-v`} className="co-campo" value={vale} onChange={(e) => setVale(e.target.value)} maxLength={300} aria-describedby={`${id}-vd`} aria-invalid={!valeOk} spellCheck={false} />
        <small id={`${id}-vd`} className="co-dica">{valeOk ? t.vale.dica : t.vale.naoAchou}</small>
        <div className="co-linha">
          <button type="submit" className="co-botao co-botao-cheio" disabled={ocupado || !algo || !linkOk || !valeOk}>
            {t.fonte.salvar}
          </button>
          {atual && (
            <button type="button" className="co-botao" disabled={ocupado} onClick={() => void tirar()}>
              {t.fonte.tirar}
            </button>
          )}
        </div>
      </form>
      {nota && <p className="co-nota" role={nota.erro ? "alert" : "status"} data-erro={nota.erro ? "" : undefined}>{nota.texto}</p>}
    </section>
  );
}

function PainelMarcar({ post, t, esperando, aoFechar, renovar }: { post: string; t: TextosDaCoautoria; esperando: PessoaDoCartao[]; aoFechar: () => void; renovar: () => void }) {
  const [campo, setCampo] = useState("");
  const [nota, setNota] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const caixa = useRef<HTMLInputElement>(null);
  const id = useId();
  const handle = handleDigitado(campo);

  async function marcar() {
    if (!handle) return;
    setOcupado(true);
    try {
      const r = await coautoria.marcar(post, handle);
      setNota({ texto: r.estado === "feita" ? t.marcar.jaFeita : r.estado === "aprovada" ? t.marcar.aprovada : t.marcar.feita });
      setCampo("");
      renovar();
      caixa.current?.focus();
    } catch (e) {
      setNota({ texto: textoDoErro(t, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }
  async function tirar(h: string) {
    setOcupado(true);
    try {
      await coautoria.desmarcar(post, h);
      renovar();
    } catch (e) {
      setNota({ texto: textoDoErro(t, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="co-painel" aria-label={t.marcar.titulo}>
      <Cabeca titulo={t.marcar.titulo} explica={t.marcar.explica} fechar={t.assinar.fechar} aoFechar={aoFechar} />
      <ListaDaAutora pessoas={esperando} rotulo={t.marcar.esperando} tirar={t.marcar.tirar} ocupado={ocupado} aoTirar={(h) => void tirar(h)} />
      <form
        className="co-form"
        onSubmit={(e) => {
          e.preventDefault();
          void marcar();
        }}
      >
        <label htmlFor={`${id}-h`}>{t.marcar.campo}</label>
        <input ref={caixa} id={`${id}-h`} className="co-campo" value={campo} onChange={(e) => setCampo(e.target.value)} autoComplete="off" spellCheck={false} maxLength={21} placeholder="@" />
        <button type="submit" className="co-botao co-botao-cheio" disabled={ocupado || !handle}>
          {t.marcar.marcar}
        </button>
      </form>
      {nota && <p className="co-nota" role={nota.erro ? "alert" : "status"} data-erro={nota.erro ? "" : undefined}>{nota.texto}</p>}
    </section>
  );
}
