// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "@/components/Link";
import { BackendError, getClient } from "@/lib/backend";
import { alumia, type InstanciaBloqueada, type PerfilDeFora, type PostDeFora, type SeguidoDeFora, type SituacaoDaFederacao } from "@/lib/rede/cliente-alumia";
import { preencher } from "@/lib/rede/preencher";
import { carregarTextosDaAlumia, type TextosDaAlumia } from "@/lib/rede/textos-alumia";
import { enderecos } from "@/lib/rede/tipos";
import { codigoDoErro, textoDoErro } from "../erros";
import { EsqueletoDaLinha } from "../Esqueletos";
import type { PropsDaTelaDoPacote } from "../registro";

/** O token da sessão: as rotas do servidor repassam ao banco, que confere tudo como a própria pessoa. */
async function token(): Promise<string> {
  const { data } = await (await getClient()).auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw new BackendError("entre_primeiro");
  return t;
}

async function pedirRota<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(caminho, { ...init, headers: { ...init.headers, Authorization: `Bearer ${await token()}` } }).catch(() => {
    throw new BackendError("sem_conexao");
  });
  const corpo = (await r.json().catch(() => null)) as (T & { erro?: string }) | null;
  if (!r.ok || !corpo) throw new BackendError(corpo?.erro ?? (r.status === 404 ? "nao_encontrado" : "falha"));
  return corpo;
}

const botao = "min-h-11 cursor-pointer rounded-full px-5 font-sans font-bold disabled:cursor-default disabled:opacity-60";
const botaoCheio = `${botao} bg-[#c21f16] text-white hover:bg-[#1f1a14]`;
const botaoVazado = `${botao} border-[1.5px] border-ink hover:bg-parchment-deep`;
const campo = "min-h-11 w-full rounded-lg border border-rule bg-folha px-3 font-sans";

function dataCurta(lang: string, iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : lang, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** Um post de fora: só texto, com o aviso de conteúdo fechando o texto quando há. */
function PostDeForaCartao({ p, t, lang }: { p: PostDeFora; t: TextosDaAlumia; lang: string }) {
  const texto = <p className="mt-1 whitespace-pre-line break-words">{p.texto}</p>;
  return (
    <article className="border-b border-rule px-[18px] py-3 font-sans">
      <p className="text-sm text-ink-soft">
        {p.nome && <strong className="text-ink">{p.nome} </strong>}
        {p.handle && <span>@{p.handle} · </span>}
        {dataCurta(lang, p.publicado)}
      </p>
      {p.aviso ? (
        <details className="mt-1">
          <summary className="min-h-11 cursor-pointer py-2 font-bold">{preencher(t.fed.linha.aviso, { aviso: p.aviso })}</summary>
          {texto}
        </details>
      ) : (
        texto
      )}
      {p.url && (
        <a href={p.url} rel="noopener noreferrer nofollow ugc" target="_blank" className="mt-1 inline-flex min-h-11 items-center text-sm underline">
          {t.fed.buscar.abrirLa}
        </a>
      )}
    </article>
  );
}

/**
 * A Alumia no Fediverso (/comunidade/fediverso): ligar ou desligar a federação do próprio perfil (desligada por padrão, com
 * consentimento específico e destacado: LGPD arts. 7º, I, 8º, 11, I, e 33, VIII), achar e seguir alguém de outra instância e ler
 * os posts públicos de quem se segue lá. `params.federacao` diz se o servidor está com a federação ligada (lib/rede/fediverso/servidor.ts).
 */
export default function Fediverso({ lang, s, situacao, params }: PropsDaTelaDoPacote) {
  const [t, setT] = useState<TextosDaAlumia | null>(null);
  const [fed, setFed] = useState<SituacaoDaFederacao | null>(null);
  const [aceito, setAceito] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [recado, setRecado] = useState("");
  const [erro, setErro] = useState("");
  const [conta, setConta] = useState("");
  const [achado, setAchado] = useState<PerfilDeFora | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState("");
  const [seguidos, setSeguidos] = useState<SeguidoDeFora[]>([]);
  const [linha, setLinha] = useState<PostDeFora[] | null>(null);
  const [dominio, setDominio] = useState("");
  const [motivo, setMotivo] = useState("");
  const [bloqueadas, setBloqueadas] = useState<InstanciaBloqueada[] | null>(null);
  const ligadaNoServidor = params.federacao === "1";

  const erroDe = useCallback((e: unknown) => {
    const codigo = codigoDoErro(e);
    return (t?.fed.erros as Record<string, string> | undefined)?.[codigo] ?? textoDoErro(s, e);
  }, [s, t]);

  useEffect(() => {
    let vivo = true;
    carregarTextosDaAlumia(lang).then((x) => vivo && setT(x)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang]);

  const recarregar = useCallback(() => {
    alumia.situacao().then(setFed).catch((e) => setErro(textoDoErro(s, e)));
    // A mediação abre já vendo as instâncias bloqueadas (antes, a lista só aparecia depois de bloquear uma).
    if (situacao.cuida) alumia.bloqueadas().then(setBloqueadas).catch(() => undefined);
    if (!situacao.logado || !situacao.membro) return;
    alumia.seguindo().then(setSeguidos).catch(() => undefined);
    alumia.linha().then(setLinha).catch(() => setLinha([]));
  }, [s, situacao.logado, situacao.membro, situacao.cuida]);

  useEffect(() => {
    if (!ligadaNoServidor) return;
    recarregar();
  }, [ligadaNoServidor, recarregar]);

  async function ligar(sim: boolean) {
    if (!t || !fed) return;
    if (!sim && !window.confirm(t.fed.consentimento.desligarConfirma)) return;
    setOcupado(true);
    setErro("");
    setRecado("");
    try {
      setFed(await alumia.ligar(sim, sim ? fed.versao : null));
      setRecado(sim ? t.fed.consentimento.ligou : t.fed.consentimento.desligou);
      setAceito(false);
      if (!sim) setSeguidos([]);
    } catch (e) {
      setErro(erroDe(e));
    } finally {
      setOcupado(false);
    }
  }

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (!t) return;
    setErroBusca("");
    setAchado(null);
    if (!/^@?[^@\s]+@[^@\s]+\.[^@\s]+$/.test(conta.trim())) {
      setErroBusca(t.fed.buscar.invalido);
      return;
    }
    setBuscando(true);
    try {
      setAchado(await pedirRota<PerfilDeFora>(`/api/fediverso/buscar?conta=${encodeURIComponent(conta.trim())}`));
    } catch (e2) {
      setErroBusca(erroDe(e2));
    } finally {
      setBuscando(false);
    }
  }

  async function seguir(ator: string, sim: boolean) {
    setOcupado(true);
    setErroBusca("");
    try {
      const r = await pedirRota<{ seguindo: "nao" | "pedido" }>("/api/fediverso/seguir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ator, sim }) });
      setAchado((a) => (a && a.ator === ator ? { ...a, seguindo: r.seguindo } : a));
      alumia.seguindo().then(setSeguidos).catch(() => undefined);
    } catch (e) {
      setErroBusca(erroDe(e));
    } finally {
      setOcupado(false);
    }
  }

  async function bloquear(sim: boolean, alvo = dominio) {
    if (!t) return;
    setOcupado(true);
    setErro("");
    setRecado("");
    try {
      setBloqueadas(await alumia.bloquear(alvo.trim().toLowerCase(), sim, motivo));
      setRecado(t.fed.mediacao.feito);
      if (sim) {
        setDominio("");
        setMotivo("");
      }
    } catch (e) {
      setErro(erroDe(e));
    } finally {
      setOcupado(false);
    }
  }

  async function maisDaLinha() {
    const ultimo = linha?.at(-1);
    if (!ultimo) return;
    const r = await alumia.linha(ultimo.publicado).catch(() => []);
    setLinha((atual) => [...(atual ?? []), ...r.filter((p) => !(atual ?? []).some((x) => x.id === p.id))]);
  }

  if (!t) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  const f = t.fed;
  const membro = situacao.logado && situacao.membro;

  return (
    <div className="font-sans">
      <header className="border-b border-rule px-[18px] py-4">
        <h1 className="font-serif text-2xl font-extrabold">{f.titulo}</h1>
        <p className="mt-1 text-ink-soft">{f.lead}</p>
      </header>

      {!ligadaNoServidor ? (
        <p className="px-[18px] py-6 text-ink-soft">{f.foraDoAr}</p>
      ) : (
        <>
          <div aria-live="polite" className="px-[18px]">
            {recado && <p role="status" className="mt-3 rounded-lg bg-parchment-deep px-3 py-2">{recado}</p>}
            {erro && <p role="alert" className="mt-3 text-oxblood">{erro}</p>}
          </div>

          {/* A federação do próprio perfil: desligada por padrão; ligar pede o consentimento específico e destacado. */}
          <section aria-labelledby="fed-estado" className="border-b border-rule px-[18px] py-4">
            <h2 id="fed-estado" className="font-serif text-lg font-semibold">{f.endereco}</h2>
            {!fed ? (
              <p className="mt-2 text-ink-soft">{s.estados.carregando}</p>
            ) : fed.ligado ? (
              <>
                <p className="mt-2 break-all text-lg font-bold">@{fed.handle}@{params.dominio}</p>
                <p className="mt-1 text-sm text-ink-soft">{preencher(f.ligadaDesde, { quando: dataCurta(lang, fed.desde) })}</p>
                <p className="mt-1 text-sm text-ink-soft">{preencher(f.numeros, { seguidores: fed.seguidores ?? 0, seguindo: fed.seguindo ?? 0 })}</p>
                <button type="button" disabled={ocupado} onClick={() => void ligar(false)} className={`${botaoVazado} mt-3`}>
                  {f.consentimento.desligar}
                </button>
              </>
            ) : !fed.pode ? (
              <>
                <p className="mt-2">{f.desligada}</p>
                <p className="mt-1 text-ink-soft">{(f.motivos as Record<string, string>)[fed.motivo ?? ""] ?? f.motivos.consentimento}</p>
                {fed.motivo === "sem_handle" && (
                  <Link href={`${enderecos.linha(lang)}/editar-perfil`} className="mt-2 inline-flex min-h-11 items-center underline">
                    {s.menu.perfil}
                  </Link>
                )}
              </>
            ) : (
              <>
                <p className="mt-2">{f.desligada}</p>
                <div className="mt-3 rounded-lg border-[1.5px] border-[#c21f16] p-4">
                  <h3 className="font-bold">{f.consentimento.titulo}</h3>
                  <ul className="mt-2 list-disc space-y-2 pl-5">
                    {f.consentimento.itens.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-start gap-3">
                    <input id="fed-aceito" type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[#c21f16]" />
                    <label htmlFor="fed-aceito" className="cursor-pointer text-sm">{f.consentimento.caixa}</label>
                  </div>
                  <button type="button" disabled={!aceito || ocupado} onClick={() => void ligar(true)} className={`${botaoCheio} mt-3`}>
                    {f.consentimento.ligar}
                  </button>
                </div>
              </>
            )}
          </section>

          {membro && (
            <>
              {/* Achar alguém de fora: quem busca é o servidor; o navegador nunca fala com a outra instância. */}
              <section aria-labelledby="fed-buscar" className="border-b border-rule px-[18px] py-4">
                <h2 id="fed-buscar" className="font-serif text-lg font-semibold">{f.buscar.titulo}</h2>
                <form onSubmit={(e) => void buscar(e)} className="mt-2 flex flex-wrap gap-2">
                  <label htmlFor="fed-conta" className="sr-only">{f.buscar.rotulo}</label>
                  <input id="fed-conta" value={conta} onChange={(e) => setConta(e.target.value)} placeholder={f.buscar.exemplo} autoComplete="off" spellCheck={false} maxLength={300} className={`${campo} min-w-0 flex-1`} />
                  <button type="submit" disabled={buscando} className={botaoCheio}>
                    {buscando ? f.buscar.buscando : f.buscar.botao}
                  </button>
                </form>
                <p className="mt-1 text-sm text-ink-soft">{f.buscar.ajuda}</p>
                {erroBusca && <p role="alert" className="mt-2 text-oxblood">{erroBusca}</p>}
                {achado?.local && achado.handle && (
                  <p className="mt-3">
                    {f.buscar.local}{" "}
                    <Link href={enderecos.perfil(lang, achado.handle)} className="underline">{f.buscar.abrirPerfil}</Link>
                  </p>
                )}
                {achado && !achado.local && achado.ator && (
                  <div className="mt-3 rounded-lg border border-rule bg-folha">
                    <div className="flex flex-wrap items-start gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{achado.nome || achado.handle}</p>
                        <p className="break-all text-sm text-ink-soft">@{achado.handle}</p>
                        {achado.resumo && <p className="mt-1 whitespace-pre-line text-sm">{achado.resumo}</p>}
                      </div>
                      {achado.ligado ? (
                        achado.seguindo === "nao" ? (
                          <button type="button" disabled={ocupado} onClick={() => void seguir(achado.ator as string, true)} className={botaoCheio}>{f.seguir.seguir}</button>
                        ) : (
                          <button type="button" disabled={ocupado} onClick={() => void seguir(achado.ator as string, false)} className={botaoVazado}>
                            {achado.seguindo === "sim" ? f.seguir.seguindo : f.seguir.pedido} · {f.seguir.deixar}
                          </button>
                        )
                      ) : null}
                    </div>
                    {!achado.ligado && <p className="border-t border-rule px-3 py-2 text-sm text-ink-soft">{f.seguir.precisaLigar}</p>}
                    <h3 className="border-t border-rule px-3 pt-3 font-bold">{f.buscar.posts}</h3>
                    {achado.posts && achado.posts.length > 0 ? (
                      achado.posts.map((p) => <PostDeForaCartao key={p.id} p={p} t={t} lang={lang} />)
                    ) : (
                      <p className="px-3 py-3 text-sm text-ink-soft">{f.buscar.semPosts}</p>
                    )}
                  </div>
                )}
              </section>

              <section aria-labelledby="fed-seguindo" className="border-b border-rule px-[18px] py-4">
                <h2 id="fed-seguindo" className="font-serif text-lg font-semibold">{f.seguindo.titulo}</h2>
                {seguidos.length === 0 ? (
                  <p className="mt-2 text-ink-soft">{f.seguindo.vazio}</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {seguidos.map((x) => (
                      <li key={x.ator} className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 flex-1 break-all">
                          <strong>{x.nome || x.handle || x.ator}</strong>
                          {x.handle && <span className="text-sm text-ink-soft"> @{x.handle}</span>}
                          {!x.aceito && <span className="text-sm text-ink-soft"> · {f.seguindo.esperando}</span>}
                        </span>
                        <button type="button" disabled={ocupado} onClick={() => void seguir(x.ator, false)} className={botaoVazado}>{f.seguir.deixar}</button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="fed-linha">
                <header className="border-b border-rule px-[18px] py-4">
                  <h2 id="fed-linha" className="font-serif text-lg font-semibold">{f.linha.titulo}</h2>
                  <p className="mt-1 text-sm text-ink-soft">{f.linha.lead}</p>
                </header>
                {linha === null ? (
                  <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={2} />
                ) : linha.length === 0 ? (
                  <p className="px-[18px] py-6 text-ink-soft">{f.linha.vazio}</p>
                ) : (
                  <>
                    {linha.map((p) => <PostDeForaCartao key={p.id} p={p} t={t} lang={lang} />)}
                    {linha.length % 30 === 0 && (
                      <div className="px-[18px] py-4 text-center">
                        <button type="button" onClick={() => void maisDaLinha()} className={botaoVazado}>{f.linha.mais}</button>
                      </div>
                    )}
                  </>
                )}
              </section>
            </>
          )}

          {situacao.cuida && (
            <section aria-labelledby="fed-mediacao" className="border-t border-rule px-[18px] py-4">
              <h2 id="fed-mediacao" className="font-serif text-lg font-semibold">{f.mediacao.titulo}</h2>
              <p className="mt-1 text-sm text-ink-soft">{f.mediacao.ajuda}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="block text-sm">
                  {f.mediacao.rotulo}
                  <input value={dominio} onChange={(e) => setDominio(e.target.value)} placeholder={f.mediacao.exemplo} autoComplete="off" spellCheck={false} maxLength={253} className={`${campo} mt-1`} />
                </label>
                <label className="block text-sm">
                  {f.mediacao.motivo}
                  <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} className={`${campo} mt-1`} />
                </label>
              </div>
              <button type="button" disabled={ocupado || !dominio.trim()} onClick={() => void bloquear(true)} className={`${botaoCheio} mt-3`}>{f.mediacao.bloquear}</button>
              {bloqueadas && (
                <>
                  <h3 className="mt-4 font-bold">{f.mediacao.lista}</h3>
                  {bloqueadas.length === 0 ? (
                    <p className="text-sm text-ink-soft">{f.mediacao.nenhuma}</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {bloqueadas.map((b) => (
                        <li key={b.dominio} className="flex flex-wrap items-center gap-2">
                          <span className="min-w-0 flex-1 break-all">
                            <strong>{b.dominio}</strong>
                            {b.motivo && <span className="text-sm text-ink-soft"> · {b.motivo}</span>}
                          </span>
                          <button type="button" disabled={ocupado} onClick={() => void bloquear(false, b.dominio)} className={botaoVazado}>{f.mediacao.desbloquear}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
