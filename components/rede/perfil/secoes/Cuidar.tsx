// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Onda 12, 12D: as peças de quem cuida.
//   CuidarDosPacotes      a equipe que cuida (coordenação, curadoria, educação, mediação) cria os pacotes e CONVIDA pelo @; a
//                         pessoa entra só se aceitar. Vê quem está dentro (o mesmo que o pacote mostra) e só o NÚMERO de convites.
//   FilaDoVoluntariado    para o painel de controle (coordenação e admin): confirmar ou recusar, com motivo, as linhas do
//                         histórico de voluntariado. Fica na aba Pessoas do painel.
//   FilaDosLinks          para a mediação (/alumia/moderacao): os links do Instagram que esperam conferência pelo código da bio.
// Nenhuma decide quem pode: o banco confere o papel em cada função e responde "sem_permissao" a quem não é.
import { useCallback, useEffect, useId, useState } from "react";
import Link from "@/components/Link";
import { linkLimpo } from "@/lib/rede/aparencia";
import {
  convidarParaPacote, decidirLink, decidirVoluntariado, filaDoVoluntariado, filaDosLinks, pacotesParaCuidar, salvarPacote, textoDoErroDoPerfil,
  type LinkNaFila, type PacoteParaCuidar, type VoluntariadoNaFila,
} from "@/lib/rede/cliente-secoes-perfil";
import { preencher } from "@/lib/rede/preencher";
import { enderecoDoPacote, periodoEmTexto, slugDoPacoteOk } from "@/lib/rede/secoes-perfil";
import { enderecos } from "@/lib/rede/tipos";
import { useTextosDasSecoes, type TextosDasSecoes } from "./textos";
import "./secoes.css";

const erroDe = (t: TextosDasSecoes, e: unknown) => textoDoErroDoPerfil(t.erros as Record<string, string>, e);

export function CuidarDosPacotes({ lang, t, atual }: { lang: string; t: TextosDasSecoes; atual?: string }) {
  const id = useId();
  const [lista, setLista] = useState<PacoteParaCuidar[] | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [novo, setNovo] = useState({ slug: "", titulo: "", descricao: "", ordem: 0, ativo: true });
  const [convite, setConvite] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);

  const ler = useCallback(() => {
    pacotesParaCuidar().then(setLista).catch(() => setLista(null));
  }, []);
  useEffect(() => {
    ler();
  }, [ler]);

  // Quem não cuida dos pacotes não vê nada (nem que a parte existe).
  if (!lista) return null;

  async function feito(f: () => Promise<void>, texto: string) {
    setOcupado(true);
    setAviso(null);
    try {
      await f();
      setAviso({ texto });
      ler();
    } catch (e) {
      setAviso({ texto: erroDe(t, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  const ordenada = atual ? [...lista].sort((a, b) => (a.slug === atual ? -1 : b.slug === atual ? 1 : 0)) : lista;

  return (
    <section className="pfs-cuidar" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="al-cond pfs-titulo">
        <i aria-hidden className="pfs-ladrilho" />
        {t.cuidar.titulo}
      </h2>
      <p className="pfs-ed-ajuda">{t.cuidar.ajuda}</p>
      {ordenada.length === 0 ? <p className="pfs-ed-ajuda">{t.cuidar.vazio}</p> : null}
      {ordenada.map((p) => (
        <div key={p.slug} className="pfs-cuidar-pacote">
          <div className="pfs-acoes">
            <b>{p.titulo}</b>
            {!p.ativo ? <span className="pfs-situacao">{t.cuidar.fechado}</span> : null}
            {p.ha_convites ? (
              <span className="pfs-situacao">{p.convites === null ? t.cuidar.haConvites : preencher(t.cuidar.convitesEsperando, { n: p.convites.toLocaleString(lang) })}</span>
            ) : null}
            {p.slug !== atual ? (
              <Link href={enderecoDoPacote(lang, p.slug)} className="al-botao al-botao-fantasma al-botao-p">
                {t.pacotes.abrir}
              </Link>
            ) : null}
          </div>
          <p className="pfs-ed-sub">{t.cuidar.dentro}</p>
          {p.dentro.length === 0 ? (
            <p className="pfs-ed-ajuda">{t.cuidar.ninguem}</p>
          ) : (
            <ul className="pfs-handles">
              {p.dentro.map((h) => (
                <li key={h}>
                  <Link href={enderecos.perfil(lang, h)}>@{h}</Link>
                  <button type="button" className="pfs-icone" disabled={ocupado} aria-label={preencher(t.cuidar.tirar, { handle: h })} onClick={() => void feito(() => convidarParaPacote(p.slug, h, false), t.secoes.salvo)}>
                    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="pfs-acoes"
            onSubmit={(e) => {
              e.preventDefault();
              const h = (convite[p.slug] ?? "").trim().replace(/^@+/, "").toLowerCase();
              if (!/^[a-z0-9_]{3,20}$/.test(h)) return;
              void feito(() => convidarParaPacote(p.slug, h, true), t.cuidar.convidado).then(() => setConvite((c) => ({ ...c, [p.slug]: "" })));
            }}
          >
            <label className="pfs-campo">
              <span>{t.cuidar.convidar}</span>
              <input type="text" value={convite[p.slug] ?? ""} maxLength={21} autoCapitalize="none" spellCheck={false} onChange={(e) => setConvite((c) => ({ ...c, [p.slug]: e.target.value }))} />
            </label>
            <button type="submit" className="al-botao al-botao-contorno al-botao-m" disabled={ocupado || !/^@?[a-z0-9_]{3,20}$/i.test((convite[p.slug] ?? "").trim())}>
              {t.cuidar.convidarBotao}
            </button>
          </form>
        </div>
      ))}

      <form
        className="pfs-cuidar-pacote"
        onSubmit={(e) => {
          e.preventDefault();
          if (!slugDoPacoteOk(novo.slug) || novo.titulo.trim().length < 3) return;
          void feito(() => salvarPacote({ ...novo, titulo: novo.titulo.trim(), descricao: novo.descricao.trim() }), t.cuidar.salvo).then(() => setNovo({ slug: "", titulo: "", descricao: "", ordem: 0, ativo: true }));
        }}
      >
        <p className="pfs-ed-sub">{t.cuidar.novo}</p>
        <div className="pfs-cuidar-form">
          <label className="pfs-campo">
            <span>{t.cuidar.tituloDoPacote}</span>
            <input type="text" value={novo.titulo} maxLength={60} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} />
          </label>
          <label className="pfs-campo">
            <span>{t.cuidar.endereco}</span>
            <input type="text" value={novo.slug} maxLength={60} autoCapitalize="none" spellCheck={false} aria-invalid={Boolean(novo.slug) && !slugDoPacoteOk(novo.slug)} onChange={(e) => setNovo({ ...novo, slug: e.target.value.toLowerCase() })} />
          </label>
        </div>
        <label className="pfs-campo">
          <span>{t.cuidar.descricao}</span>
          <input type="text" value={novo.descricao} maxLength={280} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} />
        </label>
        <div className="pfs-acoes">
          <button type="submit" className="al-botao al-botao-primario al-botao-m" disabled={ocupado || !slugDoPacoteOk(novo.slug) || novo.titulo.trim().length < 3}>
            {t.cuidar.salvar}
          </button>
        </div>
      </form>
      {aviso ? (
        <p className="pfs-estado" role={aviso.erro ? "alert" : "status"} data-erro={aviso.erro ? "" : undefined}>
          {aviso.texto}
        </p>
      ) : null}
    </section>
  );
}

/** Para o painel de controle: a fila do histórico de voluntariado. Recusar pede motivo de 10 a 500 letras (o banco confere). */
export function FilaDoVoluntariado({ lang }: { lang: string }) {
  const t = useTextosDasSecoes(lang);
  const id = useId();
  const [fila, setFila] = useState<VoluntariadoNaFila[] | null>(null);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const ler = useCallback(() => {
    filaDoVoluntariado().then(setFila).catch(() => setFila([]));
  }, []);
  useEffect(() => {
    ler();
  }, [ler]);
  if (!t || !fila) return null;

  async function decidir(x: VoluntariadoNaFila, confirmar: boolean) {
    setOcupado(true);
    setAviso(null);
    try {
      await decidirVoluntariado(x.id, confirmar, confirmar ? null : (motivos[x.id] ?? "").trim());
      setAviso({ texto: t!.painel.voluntariado.feito });
      ler();
    } catch (e) {
      setAviso({ texto: erroDe(t!, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="pfs-ed" aria-labelledby={`${id}-t`} data-al-peca="voluntariado">
      <h3 id={`${id}-t`} className="pfs-ed-titulo">{t.painel.voluntariado.titulo}</h3>
      <p className="pfs-ed-ajuda">{t.painel.voluntariado.ajuda}</p>
      {fila.length === 0 ? <p className="pfs-ed-ajuda">{t.painel.voluntariado.vazio}</p> : null}
      <ul className="pfs-fila">
        {fila.map((x) => {
          const motivo = (motivos[x.id] ?? "").trim();
          return (
            <li key={x.id}>
              <span>
                <b>{t.voluntariado.frentes[x.frente]}</b> · {periodoEmTexto(x.de, x.ate, t.voluntariado.hoje)}
              </span>
              <span className="pfs-ed-ajuda">{x.quem}</span>
              <label className="pfs-campo">
                <span>{t.painel.voluntariado.motivo}</span>
                <input type="text" value={motivos[x.id] ?? ""} maxLength={500} onChange={(e) => setMotivos((m) => ({ ...m, [x.id]: e.target.value }))} />
              </label>
              <span className="pfs-acoes">
                <button type="button" className="al-botao al-botao-primario al-botao-p" disabled={ocupado} onClick={() => void decidir(x, true)}>
                  {t.painel.voluntariado.confirmar}
                </button>
                <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled={ocupado || motivo.length < 10} onClick={() => void decidir(x, false)}>
                  {t.painel.voluntariado.recusar}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {aviso ? (
        <p className="pfs-estado" role={aviso.erro ? "alert" : "status"} data-erro={aviso.erro ? "" : undefined}>
          {aviso.texto}
        </p>
      ) : null}
    </section>
  );
}

/** Para a mediação: os links do Instagram que esperam conferência. Abrir o perfil de lá é ação da pessoa da mediação, num clique. */
export function FilaDosLinks({ lang }: { lang: string }) {
  const t = useTextosDasSecoes(lang);
  const id = useId();
  const [fila, setFila] = useState<LinkNaFila[] | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; erro?: boolean } | null>(null);
  const ler = useCallback(() => {
    filaDosLinks().then(setFila).catch(() => setFila(null));
  }, []);
  useEffect(() => {
    ler();
  }, [ler]);
  if (!t || !fila) return null;

  async function decidir(x: LinkNaFila, ok: boolean) {
    setAviso(null);
    try {
      await decidirLink(x.id, ok);
      setAviso({ texto: t!.painel.voluntariado.feito });
      ler();
    } catch (e) {
      setAviso({ texto: erroDe(t!, e), erro: true });
    }
  }

  return (
    <section className="pfs-ed" aria-labelledby={`${id}-t`} data-al-peca="links">
      <h3 id={`${id}-t`} className="pfs-ed-titulo">{t.painel.links.titulo}</h3>
      <p className="pfs-ed-ajuda">{t.painel.links.ajuda}</p>
      {fila.length === 0 ? <p className="pfs-ed-ajuda">{t.painel.links.vazio}</p> : null}
      <ul className="pfs-fila">
        {fila.map((x) => {
          const limpo = linkLimpo(x.url);
          return (
            <li key={x.id}>
              <span>
                {limpo ? (
                  <a href={limpo.href} target="_blank" rel="noopener noreferrer nofollow">
                    {limpo.dominio}
                    {new URL(limpo.href).pathname}
                  </a>
                ) : (
                  x.url
                )}{" "}
                <span className="pfs-ed-ajuda">{preencher(t.painel.links.de, { handle: x.handle })}</span>
              </span>
              <span className="pfs-ed-link-conferir">
                <span>{t.painel.links.codigo}</span>
                <code>{x.codigo}</code>
              </span>
              <span className="pfs-acoes">
                <button type="button" className="al-botao al-botao-primario al-botao-p" onClick={() => void decidir(x, true)}>
                  {t.painel.links.esta}
                </button>
                <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => void decidir(x, false)}>
                  {t.painel.links.naoEsta}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {aviso ? (
        <p className="pfs-estado" role={aviso.erro ? "alert" : "status"} data-erro={aviso.erro ? "" : undefined}>
          {aviso.texto}
        </p>
      ) : null}
    </section>
  );
}
