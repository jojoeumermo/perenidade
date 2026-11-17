// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As três partes da onda 12 no editor do perfil (/alumia/editar-perfil): Seções (a escolha e a ordem, o "Sobre", as comunidades e o
// histórico de voluntariado), Links (organizar e conferir) e Pacotes (os convites para os pacotes iniciais). Cada parte salva no
// próprio botão: são listas que vão inteiras ao banco, que confere tudo de novo (supabase/migracoes/20261118-alumia-o12-perfil.sql).
import { useEffect, useId, useMemo, useState } from "react";
import Link from "@/components/Link";
import { ALUMIA_URL, alumiaComEndereco } from "@/lib/rede/alumia";
import { linkLimpo } from "@/lib/rede/aparencia";
import {
  apagarVoluntariado, conferirLink, meusPacotes, minhasSecoes, pedirMediacao, responderPacote, salvarLinks, salvarSecoes, salvarVoluntariado,
  textoDoErroDoPerfil, type MeusPacotes, type MinhasSecoes,
} from "@/lib/rede/cliente-secoes-perfil";
import { preencher } from "@/lib/rede/preencher";
import {
  alternarSecao, arrumarLinks, arrumarSobre, enderecoDoPacote, FRENTES_DE_VOLUNTARIADO, LIMITES_DO_PERFIL, linkPedeMediacao, moverSecao, periodoEmTexto,
  periodoOk, SECOES_DO_PERFIL, tituloDoLinkOk, type FrenteDeVoluntariado, type SecaoDoPerfil,
} from "@/lib/rede/secoes-perfil";
import { site } from "@/lib/site";
import { useTextosDasSecoes, type TextosDasSecoes } from "./textos";
import "./secoes.css";

function Seta({ para }: { para: "cima" | "baixo" }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {para === "cima" ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />}
    </svg>
  );
}

function Xis() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function Estado({ texto, erro }: { texto: string; erro?: boolean }) {
  return (
    <p className="pfs-estado" role={erro ? "alert" : "status"} data-erro={erro ? "" : undefined}>
      {texto}
    </p>
  );
}

const erroDe = (t: TextosDasSecoes, e: unknown) => textoDoErroDoPerfil(t.erros as Record<string, string>, e);

// ───────────────────────────── Seções ─────────────────────────────

export function EditorDeSecoes({ lang }: { lang: string }) {
  const t = useTextosDasSecoes(lang);
  const [meu, setMeu] = useState<MinhasSecoes | null>(null);
  const [erroAoLer, setErroAoLer] = useState("");
  useEffect(() => {
    let vivo = true;
    minhasSecoes()
      .then((m) => vivo && setMeu(m))
      .catch((e) => vivo && setErroAoLer(String((e as { code?: string })?.code ?? "generico")));
    return () => {
      vivo = false;
    };
  }, []);
  if (!t) return null;
  if (erroAoLer) return <Estado erro texto={(t.erros as Record<string, string>)[erroAoLer] ?? t.erros.generico} />;
  if (!meu) return <p className="pfe-ajuda" role="status">…</p>;
  return (
    <div className="pfs-ed">
      <EscolhaDasSecoes meu={meu} t={t} aoSalvar={setMeu} />
      <Voluntariado meu={meu} t={t} aoMudar={setMeu} lang={lang} />
    </div>
  );
}

function EscolhaDasSecoes({ meu, t, aoSalvar }: { meu: MinhasSecoes; t: TextosDasSecoes; aoSalvar: (m: MinhasSecoes) => void }) {
  const id = useId();
  const [secoes, setSecoes] = useState<SecaoDoPerfil[]>(meu.secoes ?? []);
  const [sobre, setSobre] = useState(meu.sobre);
  const [comunidades, setComunidades] = useState<string[]>(meu.comunidades);
  const [estado, setEstado] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const fora = SECOES_DO_PERFIL.filter((s) => !secoes.includes(s));
  const sujo = JSON.stringify(secoes) !== JSON.stringify(meu.secoes ?? []) || sobre !== meu.sobre || JSON.stringify(comunidades) !== JSON.stringify(meu.comunidades);

  async function salvar() {
    setSalvando(true);
    setEstado(null);
    try {
      const novo = await salvarSecoes({ secoes, sobre: arrumarSobre(sobre), comunidades });
      aoSalvar(novo);
      setSobre(novo.sobre);
      setEstado({ texto: t.secoes.salvo });
    } catch (e) {
      setEstado({ texto: erroDe(t, e), erro: true });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <div className="pfs-ed-bloco">
        <h3 className="pfs-ed-titulo">{t.secoes.titulo}</h3>
        <p className="pfs-ed-ajuda">{t.secoes.ajuda}</p>
        <p className="pfs-ed-sub" id={`${id}-dentro`}>{t.secoes.noPerfil}</p>
        {secoes.length === 0 ? <p className="pfs-ed-ajuda">{t.secoes.nenhuma}</p> : null}
        <ol className="pfs-ordem" aria-labelledby={`${id}-dentro`}>
          {secoes.map((s, i) => (
            <li key={s}>
              <span className="pfs-ordem-n" aria-hidden>{i + 1}</span>
              <span className="pfs-ordem-nome">
                <b>{t.secoes.nomes[s]}</b>
                <small>{t.secoes.ajudas[s]}</small>
              </span>
              <span className="pfs-ordem-botoes">
                <button type="button" className="pfs-icone" disabled={i === 0} aria-label={preencher(t.secoes.subir, { nome: t.secoes.nomes[s] })} onClick={() => setSecoes((x) => moverSecao(x, s, -1))}>
                  <Seta para="cima" />
                </button>
                <button type="button" className="pfs-icone" disabled={i === secoes.length - 1} aria-label={preencher(t.secoes.descer, { nome: t.secoes.nomes[s] })} onClick={() => setSecoes((x) => moverSecao(x, s, 1))}>
                  <Seta para="baixo" />
                </button>
                <button type="button" className="pfs-icone" aria-label={`${t.secoes.tirar}: ${t.secoes.nomes[s]}`} onClick={() => setSecoes((x) => alternarSecao(x, s, false))}>
                  <Xis />
                </button>
              </span>
            </li>
          ))}
        </ol>
        {fora.length ? (
          <>
            <p className="pfs-ed-sub" id={`${id}-fora`}>{t.secoes.fora}</p>
            <ul className="pfs-ordem" aria-labelledby={`${id}-fora`}>
              {fora.map((s) => (
                <li key={s} data-fora="">
                  <span className="pfs-ordem-n" aria-hidden>+</span>
                  <span className="pfs-ordem-nome">
                    <b>{t.secoes.nomes[s]}</b>
                    <small>{t.secoes.ajudas[s]}</small>
                  </span>
                  <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => setSecoes((x) => alternarSecao(x, s, true))}>
                    {t.secoes.mostrar}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <div className="pfs-ed-bloco">
        <h3 className="pfs-ed-titulo">{t.sobre.titulo}</h3>
        <p className="pfs-ed-ajuda">{preencher(t.sobre.ajuda, { max: LIMITES_DO_PERFIL.sobre })}</p>
        <label className="pfs-campo">
          <span>{t.sobre.rotulo}</span>
          <textarea value={sobre} maxLength={LIMITES_DO_PERFIL.sobre} onChange={(e) => setSobre(e.target.value)} aria-describedby={`${id}-contador`} />
        </label>
        <span id={`${id}-contador`} className="pfs-contador" aria-live="polite">
          {preencher(t.sobre.contador, { n: sobre.length, max: LIMITES_DO_PERFIL.sobre })}
        </span>
      </div>

      <div className="pfs-ed-bloco">
        <h3 className="pfs-ed-titulo" id={`${id}-coms`}>{t.comunidades.titulo}</h3>
        <p className="pfs-ed-ajuda">{t.comunidades.ajuda}</p>
        {meu.possiveis.length === 0 ? (
          <p className="pfs-ed-ajuda">{t.comunidades.nenhuma}</p>
        ) : (
          <>
            <ul className="pfs-marcas" aria-labelledby={`${id}-coms`}>
              {meu.possiveis.map((c) => {
                const marcada = comunidades.includes(c.slug);
                return (
                  <li key={c.slug}>
                    <button
                      type="button"
                      className="pfs-marca"
                      aria-pressed={marcada}
                      disabled={!marcada && comunidades.length >= LIMITES_DO_PERFIL.comunidades}
                      style={/^#[0-9a-f]{6}$/.test(c.cor) ? { ["--pfs-cor" as string]: c.cor } : undefined}
                      onClick={() => setComunidades((x) => (marcada ? x.filter((y) => y !== c.slug) : [...x, c.slug]))}
                    >
                      <i aria-hidden />
                      {c.nome}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="pfs-ed-ajuda">{preencher(t.comunidades.limite, { max: LIMITES_DO_PERFIL.comunidades })}</p>
          </>
        )}
        <div className="pfs-acoes">
          <button type="button" className="al-botao al-botao-primario al-botao-m" disabled={!sujo || salvando} onClick={() => void salvar()}>
            {salvando ? t.secoes.salvando : t.secoes.salvar}
          </button>
          {estado ? <Estado texto={estado.texto} erro={estado.erro} /> : null}
        </div>
      </div>
    </>
  );
}

function Voluntariado({ meu, t, aoMudar, lang }: { meu: MinhasSecoes; t: TextosDasSecoes; aoMudar: (m: MinhasSecoes) => void; lang: string }) {
  const id = useId();
  const anoAtual = new Date().getFullYear();
  const anos = useMemo(() => Array.from({ length: anoAtual + 2 - LIMITES_DO_PERFIL.anoMinimo }, (_, i) => anoAtual + 1 - i), [anoAtual]);
  const vazio = { id: undefined as string | undefined, frente: "" as FrenteDeVoluntariado | "", de: anoAtual, ate: null as number | null };
  const [form, setForm] = useState<typeof vazio | null>(null);
  const [estado, setEstado] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const valido = form && form.frente && periodoOk(form.de, form.ate);

  async function guardar() {
    if (!form || !form.frente) return;
    setOcupado(true);
    setEstado(null);
    try {
      aoMudar(await salvarVoluntariado({ id: form.id, frente: form.frente, de: form.de, ate: form.ate }));
      setForm(null);
    } catch (e) {
      setEstado({ texto: erroDe(t, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  async function tirar(idDaLinha: string) {
    setOcupado(true);
    setEstado(null);
    try {
      aoMudar(await apagarVoluntariado(idDaLinha));
    } catch (e) {
      setEstado({ texto: erroDe(t, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="pfs-ed-bloco">
      <h3 className="pfs-ed-titulo" id={`${id}-t`}>{t.voluntariado.titulo}</h3>
      <p className="pfs-ed-ajuda">{t.voluntariado.ajuda}</p>
      {meu.voluntariado.length === 0 ? <p className="pfs-ed-ajuda">{t.voluntariado.vazio}</p> : null}
      <ul className="pfs-ed-somei" aria-labelledby={`${id}-t`}>
        {meu.voluntariado.map((v) => (
          <li key={v.id}>
            <span>
              <b>{t.voluntariado.frentes[v.frente]}</b>
              <small>{periodoEmTexto(v.de, v.ate, t.voluntariado.hoje)}</small>
              <span className="pfs-situacao" data-situacao={v.situacao}>{t.voluntariado.situacoes[v.situacao]}</span>
            </span>
            <span className="pfs-ordem-botoes">
              <button type="button" className="al-botao al-botao-fantasma al-botao-p" disabled={ocupado} onClick={() => setForm({ id: v.id, frente: v.frente, de: v.de, ate: v.ate })}>
                {t.voluntariado.mudar}
              </button>
              <button type="button" className="al-botao al-botao-fantasma al-botao-p" disabled={ocupado} onClick={() => void tirar(v.id)}>
                {t.voluntariado.tirar}
              </button>
            </span>
          </li>
        ))}
      </ul>
      {form ? (
        <div className="pfs-ed-somei-form">
          <label className="pfs-campo">
            <span>{t.voluntariado.frente}</span>
            <select value={form.frente} onChange={(e) => setForm({ ...form, frente: e.target.value as FrenteDeVoluntariado })}>
              <option value="" disabled>
                …
              </option>
              {FRENTES_DE_VOLUNTARIADO.map((f) => (
                <option key={f} value={f}>
                  {t.voluntariado.frentes[f]}
                </option>
              ))}
            </select>
          </label>
          <label className="pfs-campo">
            <span>{t.voluntariado.de}</span>
            <select value={form.de} onChange={(e) => setForm({ ...form, de: Number(e.target.value), ate: form.ate !== null && form.ate < Number(e.target.value) ? Number(e.target.value) : form.ate })}>
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a.toLocaleString(lang, { useGrouping: false })}
                </option>
              ))}
            </select>
          </label>
          <label className="pfs-campo">
            <span>{t.voluntariado.ate}</span>
            <select value={form.ate ?? ""} onChange={(e) => setForm({ ...form, ate: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t.voluntariado.ateHoje}</option>
              {anos
                .filter((a) => a >= form.de)
                .map((a) => (
                  <option key={a} value={a}>
                    {a.toLocaleString(lang, { useGrouping: false })}
                  </option>
                ))}
            </select>
          </label>
          <span className="pfs-acoes">
            <button type="button" className="al-botao al-botao-primario al-botao-m" disabled={!valido || ocupado} onClick={() => void guardar()}>
              {t.voluntariado.guardar}
            </button>
            <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={() => setForm(null)}>
              {t.voluntariado.cancelar}
            </button>
          </span>
          {form.id ? <p className="pfs-ed-ajuda">{t.voluntariado.mudarVolta}</p> : null}
        </div>
      ) : (
        <div className="pfs-acoes">
          <button type="button" className="al-botao al-botao-contorno al-botao-m" disabled={meu.voluntariado.length >= LIMITES_DO_PERFIL.voluntariado} onClick={() => setForm(vazio)}>
            {t.voluntariado.acrescentar}
          </button>
          {meu.voluntariado.length >= LIMITES_DO_PERFIL.voluntariado ? <p className="pfs-ed-ajuda">{preencher(t.voluntariado.limite, { max: LIMITES_DO_PERFIL.voluntariado })}</p> : null}
        </div>
      )}
      {estado ? <Estado texto={estado.texto} erro={estado.erro} /> : null}
    </div>
  );
}

// ───────────────────────────── Links ─────────────────────────────

/** O endereço do meu perfil, o que o meu site tem de apontar com rel="me". */
export function enderecoDoMeuPerfil(lang: string, handle: string): string {
  return alumiaComEndereco ? `${ALUMIA_URL}/${lang}/u/${handle}` : `${site.url}/${lang}/alumia/u/${handle}`;
}

interface LinhaDeLink {
  chave: string;
  titulo: string;
  url: string;
}

export function EditorDeLinks({ lang, handle }: { lang: string; handle: string }) {
  const t = useTextosDasSecoes(lang);
  const id = useId();
  const [meu, setMeu] = useState<MinhasSecoes | null>(null);
  const [linhas, setLinhas] = useState<LinhaDeLink[]>([]);
  const [estado, setEstado] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [conferindo, setConferindo] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Record<string, { texto: string; erro?: boolean }>>({});

  const repor = (m: MinhasSecoes) => {
    setMeu(m);
    setLinhas(m.links.map((l) => ({ chave: l.id, titulo: l.titulo, url: l.url })));
  };
  useEffect(() => {
    let vivo = true;
    minhasSecoes()
      .then((m) => vivo && repor(m))
      .catch((e) => vivo && t && setEstado({ texto: erroDe(t, e), erro: true }));
    return () => {
      vivo = false;
    };
    // `t` só serve ao texto do erro; ler de novo quando ele chega não muda nada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!t) return null;
  if (!meu) return estado ? <Estado texto={estado.texto} erro /> : <p className="pfe-ajuda" role="status">…</p>;

  const limpos = arrumarLinks(linhas);
  const problemas = linhas.filter((l) => !tituloDoLinkOk(l.titulo) || !linkLimpo(l.url)).length;
  const sujo = JSON.stringify(linhas.map((l) => [l.titulo.trim(), linkLimpo(l.url)?.href ?? l.url])) !== JSON.stringify(meu.links.map((l) => [l.titulo, l.url]));
  const meuPerfil = enderecoDoMeuPerfil(lang, handle);
  const mover = (i: number, d: -1 | 1) =>
    setLinhas((x) => {
      const j = i + d;
      if (j < 0 || j >= x.length) return x;
      const n = [...x];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  async function salvar() {
    setSalvando(true);
    setEstado(null);
    try {
      repor(await salvarLinks(limpos));
      setEstado({ texto: t!.links.salvo });
    } catch (e) {
      setEstado({ texto: erroDe(t!, e), erro: true });
    } finally {
      setSalvando(false);
    }
  }

  async function conferir(idDoLink: string) {
    setConferindo(idDoLink);
    setResultado((r) => ({ ...r, [idDoLink]: { texto: t!.links.conferindo } }));
    const r = await conferirLink(idDoLink);
    const texto = r === "ok" ? t!.links.ok : r === "nao_achou" || r === "indisponivel" ? t!.links.naoAchou : r === "sem_servico" ? t!.links.semServico : ((t!.erros as Record<string, string>)[r] ?? t!.erros.generico);
    setResultado((x) => ({ ...x, [idDoLink]: { texto, erro: r !== "ok" } }));
    try {
      repor(await minhasSecoes());
    } catch {
      // a lista fica como estava
    }
    setConferindo(null);
  }

  async function mediacao(idDoLink: string, sim: boolean) {
    try {
      const r = await pedirMediacao(idDoLink, sim);
      setMeu((m) => (m ? { ...m, links: m.links.map((l) => (l.id === idDoLink ? { ...l, codigo: r.codigo, mediacao: r.mediacao } : l)) } : m));
    } catch (e) {
      setResultado((x) => ({ ...x, [idDoLink]: { texto: erroDe(t!, e), erro: true } }));
    }
  }

  return (
    <div className="pfs-ed">
      <div className="pfs-ed-bloco">
        <h3 className="pfs-ed-titulo" id={`${id}-t`}>{t.links.titulo}</h3>
        <p className="pfs-ed-ajuda">{preencher(t.links.ajuda, { max: LIMITES_DO_PERFIL.links })}</p>
        {linhas.length === 0 ? <p className="pfs-ed-ajuda">{t.links.vazio}</p> : null}
        <ol className="pfs-ed-links" aria-labelledby={`${id}-t`}>
          {linhas.map((l, i) => {
            const limpo = linkLimpo(l.url);
            const salvo = !sujo ? meu.links.find((x) => x.id === l.chave) : undefined;
            const nome = l.titulo.trim() || `#${i + 1}`;
            return (
              <li key={l.chave} className="pfs-ed-link">
                <div className="pfs-ed-link-campos">
                  <label className="pfs-campo">
                    <span>{t.links.tituloDoLink}</span>
                    <input type="text" value={l.titulo} maxLength={LIMITES_DO_PERFIL.tituloDoLink} aria-invalid={Boolean(l.titulo) && !tituloDoLinkOk(l.titulo)} onChange={(e) => setLinhas((x) => x.map((y) => (y.chave === l.chave ? { ...y, titulo: e.target.value } : y)))} />
                  </label>
                  <label className="pfs-campo">
                    <span>{t.links.endereco}</span>
                    <input
                      type="url"
                      inputMode="url"
                      placeholder="https://"
                      value={l.url}
                      maxLength={LIMITES_DO_PERFIL.url}
                      aria-invalid={Boolean(l.url) && !limpo}
                      onChange={(e) => setLinhas((x) => x.map((y) => (y.chave === l.chave ? { ...y, url: e.target.value.trim() } : y)))}
                      onBlur={() => limpo && limpo.href !== l.url && setLinhas((x) => x.map((y) => (y.chave === l.chave ? { ...y, url: limpo.href } : y)))}
                    />
                  </label>
                  <span className="pfs-ordem-botoes">
                    <button type="button" className="pfs-icone" disabled={i === 0} aria-label={preencher(t.links.subir, { titulo: nome })} onClick={() => mover(i, -1)}>
                      <Seta para="cima" />
                    </button>
                    <button type="button" className="pfs-icone" disabled={i === linhas.length - 1} aria-label={preencher(t.links.descer, { titulo: nome })} onClick={() => mover(i, 1)}>
                      <Seta para="baixo" />
                    </button>
                    <button type="button" className="pfs-icone" aria-label={preencher(t.links.tirar, { titulo: nome })} onClick={() => setLinhas((x) => x.filter((y) => y.chave !== l.chave))}>
                      <Xis />
                    </button>
                  </span>
                </div>
                {salvo ? (
                  <div className="pfs-ed-link-conferir">
                    {salvo.conferido ? (
                      <span className="pfs-ok">✓ {salvo.conferido === "rel_me" ? t.links.conferidoRelMe : t.links.conferidoMediacao}</span>
                    ) : linkPedeMediacao(salvo.url) ? (
                      <>
                        <span>{t.links.instagram.ajuda}</span>
                        {salvo.mediacao && salvo.codigo ? (
                          <>
                            <span>{t.links.instagram.codigo}</span>
                            <code>{salvo.codigo}</code>
                            <span className="pfs-acoes">
                              <span>{t.links.instagram.esperando}</span>
                              <button type="button" className="al-botao al-botao-fantasma al-botao-p" onClick={() => void mediacao(salvo.id, false)}>
                                {t.links.instagram.desistir}
                              </button>
                            </span>
                          </>
                        ) : (
                          <span className="pfs-acoes">
                            <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => void mediacao(salvo.id, true)}>
                              {t.links.instagram.pedir}
                            </button>
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span>{t.links.comoConferir}</span>
                        <code>{`<a rel="me" href="${meuPerfil}">Alumia</a>`}</code>
                        <span className="pfs-acoes">
                          <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled={conferindo !== null} onClick={() => void conferir(salvo.id)}>
                            {conferindo === salvo.id ? t.links.conferindo : t.links.conferir}
                          </button>
                        </span>
                      </>
                    )}
                    {resultado[salvo.id] && !salvo.conferido ? <Estado texto={resultado[salvo.id].texto} erro={resultado[salvo.id].erro} /> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
        <div className="pfs-acoes">
          <button
            type="button"
            className="al-botao al-botao-contorno al-botao-m"
            disabled={linhas.length >= LIMITES_DO_PERFIL.links}
            onClick={() => setLinhas((x) => [...x, { chave: `novo-${Date.now()}`, titulo: "", url: "" }])}
          >
            {t.links.acrescentar}
          </button>
          <button type="button" className="al-botao al-botao-primario al-botao-m" disabled={!sujo || salvando || problemas > 0} onClick={() => void salvar()}>
            {salvando ? t.secoes.salvando : t.links.salvar}
          </button>
          {problemas > 0 ? <Estado erro texto={preencher(t.links.invalido, { max: LIMITES_DO_PERFIL.tituloDoLink })} /> : estado ? <Estado texto={estado.texto} erro={estado.erro} /> : sujo && meu.links.length ? <p className="pfs-estado">{t.links.salveAntes}</p> : null}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── Pacotes ─────────────────────────────

export function EditorDePacotes({ lang }: { lang: string }) {
  const t = useTextosDasSecoes(lang);
  const id = useId();
  const [meus, setMeus] = useState<MeusPacotes | null>(null);
  const [estado, setEstado] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    meusPacotes()
      .then((m) => vivo && setMeus(m))
      .catch(() => vivo && setMeus({ convites: [], dentro: [], aparece: false }));
    return () => {
      vivo = false;
    };
  }, []);
  if (!t) return null;
  if (!meus) return <p className="pfe-ajuda" role="status">…</p>;

  async function responder(slug: string, sim: boolean) {
    setOcupado(slug);
    setEstado(null);
    try {
      setMeus(await responderPacote(slug, sim));
    } catch (e) {
      setEstado({ texto: erroDe(t!, e), erro: true });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="pfs-ed">
      <div className="pfs-ed-bloco">
        <h3 className="pfs-ed-titulo">{t.pacotes.titulo}</h3>
        <p className="pfs-ed-ajuda">{t.pacotes.ajuda}</p>
        <p className="pfs-ed-sub" id={`${id}-c`}>{t.pacotes.convites}</p>
        {meus.convites.length === 0 ? <p className="pfs-ed-ajuda">{t.pacotes.semConvites}</p> : null}
        <ul className="pfs-ordem" aria-labelledby={`${id}-c`}>
          {meus.convites.map((p) => (
            <li key={p.slug}>
              <span className="pfs-ordem-n" aria-hidden>?</span>
              <span className="pfs-ordem-nome">
                <b>{p.titulo}</b>
                <small>{p.descricao}</small>
              </span>
              <span className="pfs-ordem-botoes">
                <button type="button" className="al-botao al-botao-primario al-botao-p" disabled={ocupado !== null} onClick={() => void responder(p.slug, true)}>
                  {t.pacotes.aceitar}
                </button>
                <button type="button" className="al-botao al-botao-fantasma al-botao-p" disabled={ocupado !== null} onClick={() => void responder(p.slug, false)}>
                  {t.pacotes.recusar}
                </button>
              </span>
            </li>
          ))}
        </ul>
        <p className="pfs-ed-sub" id={`${id}-d`}>{t.pacotes.dentro}</p>
        {meus.dentro.length === 0 ? <p className="pfs-ed-ajuda">{t.pacotes.foraDeTodos}</p> : null}
        <ul className="pfs-ordem" aria-labelledby={`${id}-d`}>
          {meus.dentro.map((p) => (
            <li key={p.slug}>
              <span className="pfs-ordem-n" aria-hidden>✓</span>
              <span className="pfs-ordem-nome">
                <b>{p.titulo}</b>
                <small>{p.descricao}</small>
              </span>
              <span className="pfs-ordem-botoes">
                <Link href={enderecoDoPacote(lang, p.slug)} className="al-botao al-botao-contorno al-botao-p">
                  {t.pacotes.abrir}
                </Link>
                <button type="button" className="al-botao al-botao-fantasma al-botao-p" disabled={ocupado !== null} onClick={() => void responder(p.slug, false)}>
                  {t.pacotes.sair}
                </button>
              </span>
            </li>
          ))}
        </ul>
        <p className="pfs-ed-ajuda">{t.pacotes.fechado}</p>
        {estado ? <Estado texto={estado.texto} erro={estado.erro} /> : null}
      </div>
    </div>
  );
}
