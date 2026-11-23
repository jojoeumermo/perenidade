// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A parte das organizações da ação coletiva (Prompt 4): a chave Pix oficial (100), a sala de imprensa (124), a vitrine da economia
// solidária (125), a página de links (126) e as frentes entre organizações (123). Tudo é de organizações, nunca de pessoas: nenhuma
// resposta diz quem gere ou quantas pessoas são; os links de fora abrem sem levar nada de quem clica.
import { useId, useState } from "react";
import { acaoColetiva, CATEGORIAS, idDoAto, type CategoriaDaVitrine, type Frente, type ItemDaVitrine, type Minhas, type OrgResumo, type PaginaDaOrg } from "@/lib/rede/coletiva/cliente";
import { Botao } from "../ui/Botao";
import { useCarga } from "../memoria/usar";
import { dataCurta, fraseDoErro, type TextosDaColetiva } from "./textos";

type Props = { t: TextosDaColetiva; lang: string };
type Msg = { texto: string; erro: boolean } | null;

const LinkDeFora = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a className="ac-link" href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>
);

export function AbaOrgs({ t, lang, inicial = null }: Props & { inicial?: string | null }) {
  const minhas = useCarga<Minhas>("minhas", () => acaoColetiva.minhas());
  const [handle, setHandle] = useState<string | null>(inicial);
  const [escrito, setEscrito] = useState("");
  const id = useId();
  const orgs = minhas.dado?.orgs ?? [];
  return (
    <div className="ac-bloco">
      <form className="ac-form" onSubmit={(e) => { e.preventDefault(); const h = escrito.trim().replace(/^@/, "").toLowerCase(); if (h) setHandle(h); }}>
        <label htmlFor={`${id}-h`}>{t.orgs.abrir}</label>
        <input id={`${id}-h`} type="text" value={escrito} onChange={(e) => setEscrito(e.target.value)} maxLength={40} autoComplete="off" spellCheck={false} />
        <div className="ac-acoes"><Botao type="submit" variante="contorno">{t.orgs.ver}</Botao></div>
      </form>
      {orgs.length > 0 && (
        <section className="ac-bloco" aria-labelledby={`${id}-s`}>
          <h2 id={`${id}-s`} className="ac-subtitulo">{t.orgs.suas}</h2>
          <div className="ac-acoes">
            {orgs.map((o) => <Botao key={o.handle} variante={handle === o.handle ? "claro" : "contorno"} pressionado={handle === o.handle} onClick={() => setHandle(o.handle)}>@{o.handle}</Botao>)}
          </div>
        </section>
      )}
      {handle && <PaginaDaOrganizacao key={handle} t={t} lang={lang} handle={handle} />}
      <Vitrine t={t} lang={lang} />
      <Frentes t={t} lang={lang} minhas={orgs} />
    </div>
  );
}

function PaginaDaOrganizacao({ t, lang, handle }: Props & { handle: string }) {
  const { dado, erro, trocar } = useCarga<PaginaDaOrg>(`org:${handle}`, () => acaoColetiva.org(handle));
  const [msg, setMsg] = useState<Msg>(null);
  const id = useId();
  const fazer = async (f: () => Promise<PaginaDaOrg>) => {
    try {
      trocar(await f());
      setMsg(null);
      return true;
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
      return false;
    }
  };
  if (erro) return <p className="ac-erro" role="alert">{t.orgs.naoAchei}</p>;
  if (!dado) return <p className="ac-miudo" role="status">{t.comum.carregando}</p>;
  const g = dado.gerencio;
  const im = dado.imprensa;
  return (
    <article className="ac-bloco" aria-labelledby={`${id}-t`}>
      <div className="ac-cartao">
        <p className="ac-etiqueta">@{dado.handle} · {dado.selo ? t.orgs.selo : t.orgs.semSelo}</p>
        <h2 id={`${id}-t`} className="ac-subtitulo">{dado.nome}</h2>
      </div>
      {msg && <p className={msg.erro ? "ac-erro" : "ac-ok"} role={msg.erro ? "alert" : "status"}>{msg.texto}</p>}

      {/* 100 · Pix oficial */}
      <section className="ac-bloco" data-item="100" aria-labelledby={`${id}-pix`}>
        <h3 id={`${id}-pix`} className="ac-subtitulo">{t.orgs.pix}</h3>
        <p className="ac-miudo">{t.orgs.pixSobre}</p>
        <p className="ac-cartao">{dado.pix ?? t.orgs.semPix}</p>
        {g && dado.selo && (
          <form className="ac-form" onSubmit={(e) => { e.preventDefault(); void fazer(() => acaoColetiva.definirPix(dado.handle, String(new FormData(e.currentTarget).get("chave") ?? ""))); }}>
            <label>{t.orgs.definirPix}<input type="text" name="chave" defaultValue={dado.pix ?? ""} maxLength={80} autoComplete="off" /></label>
            <div className="ac-acoes"><Botao type="submit">{t.comum.salvar}</Botao></div>
          </form>
        )}
      </section>

      {/* 124 · Sala de imprensa */}
      <section className="ac-bloco" data-item="124" aria-labelledby={`${id}-im`}>
        <h3 id={`${id}-im`} className="ac-subtitulo">{t.orgs.imprensa}</h3>
        {im ? (
          <div className="ac-cartao">
            {im.sobre && <p>{im.sobre}</p>}
            {(im.email || im.telefone) && <p><strong>{t.orgs.contato}:</strong> {[im.email, im.telefone].filter(Boolean).join(" · ")}</p>}
            {im.cores.length > 0 && <div className="ac-cores" aria-label={t.orgs.cores}>{im.cores.map((c) => <span key={c} className="ac-cor" style={{ background: c }} title={c} />)}</div>}
            {im.kit && <LinkDeFora href={im.kit}>{t.orgs.kit}</LinkDeFora>}
            {im.releases.length > 0 && (
              <>
                <h4>{t.orgs.releases}</h4>
                <ul className="ac-lista">
                  {im.releases.map((r) => (
                    <li key={r.id} className="ac-cartao">
                      <p className="ac-etiqueta">{dataCurta(lang, r.dia)}</p>
                      <h4>{r.titulo}</h4>
                      <p>{r.texto}</p>
                      <div className="ac-acoes">
                        {r.link && <LinkDeFora href={r.link}>{t.comum.abrirFora}</LinkDeFora>}
                        {g && <Botao variante="fantasma" onClick={() => fazer(() => acaoColetiva.tirarRelease(r.id))}>{t.comum.tirar}</Botao>}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : <p className="ac-miudo">{t.orgs.semImprensa}</p>}
        {g && (
          <>
            <form className="ac-form" aria-label={t.orgs.contato} onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void fazer(() => acaoColetiva.salvarImprensa(dado.handle, { email: String(f.get("email")), telefone: String(f.get("telefone")), sobre: String(f.get("sobre")), cores: String(f.get("cores")).split(/[\s,]+/).filter(Boolean).slice(0, 4), kit: String(f.get("kit")) }));
            }}>
              <p className="ac-miudo">{t.orgs.contatoAviso}</p>
              <label>{t.orgs.email}<input type="email" name="email" defaultValue={im?.email ?? ""} maxLength={120} /></label>
              <label>{t.orgs.telefone}<input type="tel" name="telefone" defaultValue={im?.telefone ?? ""} maxLength={20} /></label>
              <label>{t.comum.texto} {t.comum.opcional}<textarea name="sobre" defaultValue={im?.sobre ?? ""} maxLength={1000} /></label>
              <label>{t.orgs.cores}<input type="text" name="cores" defaultValue={im?.cores.join(" ") ?? ""} maxLength={40} /></label>
              <label>{t.orgs.kit} {t.comum.opcional}<input type="url" name="kit" defaultValue={im?.kit ?? ""} maxLength={500} /></label>
              <div className="ac-acoes"><Botao type="submit">{t.comum.salvar}</Botao></div>
            </form>
            <form className="ac-form" aria-label={t.orgs.release} onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              if (await fazer(() => acaoColetiva.publicarRelease(dado.handle, { titulo: String(f.get("titulo")), texto: String(f.get("texto")), dia: String(f.get("dia")), link: String(f.get("link")) }))) form.reset();
            }}>
              <h4>{t.orgs.release}</h4>
              <label>{t.comum.titulo}<input type="text" name="titulo" required minLength={3} maxLength={160} /></label>
              <label>{t.comum.texto}<textarea name="texto" required minLength={20} maxLength={6000} /></label>
              <label>{t.comum.data}<input type="date" name="dia" required defaultValue={new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())} /></label>
              <label>{t.comum.link} {t.comum.opcional}<input type="url" name="link" maxLength={500} /></label>
              <div className="ac-acoes"><Botao type="submit">{t.comum.salvar}</Botao></div>
            </form>
          </>
        )}
      </section>

      {/* 125 · Vitrine (da organização) */}
      {(dado.vitrine?.length || (g && dado.selo)) ? (
        <section className="ac-bloco" data-item="125" aria-labelledby={`${id}-vi`}>
          <h3 id={`${id}-vi`} className="ac-subtitulo">{t.orgs.vitrine}</h3>
          <ListaDaVitrine t={t} itens={dado.vitrine ?? []} tirar={g ? (x) => fazer(() => acaoColetiva.tirarDaVitrine(x)) : undefined} />
          {g && dado.selo && (
            <form className="ac-form" aria-label={t.orgs.porNaVitrine} onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              if (await fazer(() => acaoColetiva.porNaVitrine(dado.handle, { nome: String(f.get("nome")), sobre: String(f.get("sobre")), categoria: String(f.get("categoria")) as CategoriaDaVitrine, cidade: String(f.get("cidade")), link: String(f.get("link")) }))) form.reset();
            }}>
              <label>{t.orgs.nome}<input type="text" name="nome" required minLength={2} maxLength={120} /></label>
              <label>{t.comum.texto}<textarea name="sobre" maxLength={500} /></label>
              <label>{t.orgs.categoria}<select name="categoria">{CATEGORIAS.map((c) => <option key={c} value={c}>{t.orgs.categorias[c]}</option>)}</select></label>
              <label>{t.comum.cidade}<input type="text" name="cidade" maxLength={80} /></label>
              <label>{t.comum.link}<input type="url" name="link" required maxLength={500} /></label>
              <div className="ac-acoes"><Botao type="submit">{t.orgs.porNaVitrine}</Botao></div>
            </form>
          )}
        </section>
      ) : null}

      {/* 126 · Links */}
      <section className="ac-bloco" data-item="126" aria-labelledby={`${id}-li`}>
        <h3 id={`${id}-li`} className="ac-subtitulo">{t.orgs.links}</h3>
        {dado.links?.length ? (
          <ul className="ac-lista">{dado.links.map((l) => <li key={l.url}><LinkDeFora href={l.url}>{l.titulo}</LinkDeFora></li>)}</ul>
        ) : <p className="ac-miudo">{t.orgs.semLinks}</p>}
        {g && (
          <form className="ac-form" onSubmit={(e) => {
            e.preventDefault();
            const linhas = String(new FormData(e.currentTarget).get("links") ?? "").split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((x) => x[0] && x[1]);
            void fazer(() => acaoColetiva.salvarLinks(dado.handle, linhas.slice(0, 20).map(([titulo, url]) => ({ titulo, url }))));
          }}>
            <label>{t.orgs.editarLinks}<textarea name="links" defaultValue={(dado.links ?? []).map((l) => `${l.titulo} | ${l.url}`).join("\n")} /></label>
            <div className="ac-acoes"><Botao type="submit">{t.comum.salvar}</Botao></div>
          </form>
        )}
      </section>
    </article>
  );
}

function ListaDaVitrine({ t, itens, tirar }: { t: TextosDaColetiva; itens: ItemDaVitrine[]; tirar?: (id: string) => void }) {
  if (!itens.length) return <p className="ac-miudo">{t.orgs.vitrineVazia}</p>;
  return (
    <ul className="ac-lista">
      {itens.map((x) => (
        <li key={x.id} className="ac-cartao">
          <p className="ac-etiqueta">{t.orgs.categorias[x.categoria]}{x.cidade ? ` · ${x.cidade}` : ""}{x.org ? ` · @${x.org.handle}` : ""}</p>
          <h4>{x.nome}</h4>
          {x.sobre && <p>{x.sobre}</p>}
          <div className="ac-acoes">
            <LinkDeFora href={x.link}>{t.comum.abrirFora}</LinkDeFora>
            {tirar && <Botao variante="fantasma" onClick={() => tirar(x.id)}>{t.comum.tirar}</Botao>}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ───── 125 · A vitrine geral ─────
function Vitrine({ t }: Props) {
  const id = useId();
  const [categoria, setCategoria] = useState("");
  const [cidade, setCidade] = useState("");
  const [busca, setBusca] = useState({ categoria: "", cidade: "" });
  const { dado, erro } = useCarga<ItemDaVitrine[]>(`v:${busca.categoria}:${busca.cidade}`, () => acaoColetiva.vitrine(busca.categoria, busca.cidade));
  return (
    <section className="ac-bloco" aria-labelledby={`${id}-t`} data-item="125">
      <h2 id={`${id}-t`} className="ac-subtitulo">{t.orgs.vitrine}</h2>
      <p className="ac-miudo">{t.orgs.vitrineSobre}</p>
      <form className="ac-form" onSubmit={(e) => { e.preventDefault(); setBusca({ categoria, cidade: cidade.trim() }); }}>
        <label>{t.orgs.categoria}
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">{t.orgs.todas}</option>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{t.orgs.categorias[c]}</option>)}
          </select>
        </label>
        <label>{t.comum.cidade}<input type="text" value={cidade} onChange={(e) => setCidade(e.target.value)} maxLength={80} /></label>
        <div className="ac-acoes"><Botao type="submit" variante="contorno">{t.orgs.ver}</Botao></div>
      </form>
      {erro ? <p className="ac-erro" role="alert">{fraseDoErro(t, erro)}</p> : dado ? <ListaDaVitrine t={t} itens={dado} /> : <p className="ac-miudo" role="status">{t.comum.carregando}</p>}
    </section>
  );
}

// ───── 123 · Frentes entre organizações ─────
function Frentes({ t, lang, minhas }: Props & { minhas: OrgResumo[] }) {
  const id = useId();
  const lista = useCarga<{ slug: string; nome: string; orgs: number }[]>("frentes", () => acaoColetiva.frentes());
  const [aberta, setAberta] = useState<string | null>(null);
  const [criar, setCriar] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  return (
    <section className="ac-bloco" aria-labelledby={`${id}-t`} data-item="123">
      <h2 id={`${id}-t`} className="ac-subtitulo">{t.orgs.frentes}</h2>
      <p className="ac-miudo">{t.orgs.frentesSobre}</p>
      {msg && <p className={msg.erro ? "ac-erro" : "ac-ok"} role={msg.erro ? "alert" : "status"}>{msg.texto}</p>}
      {minhas.length > 0 && (criar ? (
        <form className="ac-form" aria-label={t.orgs.novaFrente} onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            const nova = await acaoColetiva.criarFrente({ org: String(f.get("org")), slug: String(f.get("slug")), nome: String(f.get("nome")), sobre: String(f.get("sobre")) });
            setCriar(false);
            setMsg(null);
            lista.recarregar();
            setAberta(nova.slug);
          } catch (x) {
            setMsg({ texto: fraseDoErro(t, x), erro: true });
          }
        }}>
          <label>{t.orgs.pela}<select name="org">{minhas.map((o) => <option key={o.handle} value={o.handle}>@{o.handle}</option>)}</select></label>
          <label>{t.orgs.nome}<input type="text" name="nome" required minLength={3} maxLength={80} /></label>
          <label>{t.orgs.endereco}<input type="text" name="slug" required pattern="[a-z0-9\-]{3,40}" maxLength={40} autoComplete="off" /></label>
          <label>{t.comum.texto} {t.comum.opcional}<textarea name="sobre" maxLength={1000} /></label>
          <div className="ac-acoes"><Botao type="submit">{t.comum.salvar}</Botao><Botao variante="fantasma" onClick={() => setCriar(false)}>{t.comum.cancelar}</Botao></div>
        </form>
      ) : <div className="ac-acoes"><Botao variante="contorno" onClick={() => setCriar(true)}>{t.orgs.novaFrente}</Botao></div>)}
      {lista.erro ? <p className="ac-erro" role="alert">{fraseDoErro(t, lista.erro)}</p> : null}
      {lista.dado && !lista.dado.length && <p className="ac-miudo">{t.orgs.semFrentes}</p>}
      <div className="ac-acoes">
        {lista.dado?.map((f) => <Botao key={f.slug} variante={aberta === f.slug ? "claro" : "contorno"} pressionado={aberta === f.slug} onClick={() => setAberta(f.slug)}>{f.nome}</Botao>)}
      </div>
      {aberta && <PaginaDaFrente key={aberta} t={t} lang={lang} slug={aberta} minhas={minhas} aoSumir={() => { setAberta(null); lista.recarregar(); }} />}
    </section>
  );
}

function PaginaDaFrente({ t, lang, slug, minhas, aoSumir }: Props & { slug: string; minhas: OrgResumo[]; aoSumir: () => void }) {
  const { dado, erro, trocar } = useCarga<Frente>(`frente:${slug}`, () => acaoColetiva.frente(slug));
  const [msg, setMsg] = useState<Msg>(null);
  const id = useId();
  const fazer = async (f: () => Promise<Frente & { apagada?: boolean }>) => {
    try {
      const r = await f();
      if (r.apagada) return aoSumir();
      trocar(r);
      setMsg(null);
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
    }
  };
  if (erro) return <p className="ac-erro" role="alert">{fraseDoErro(t, erro)}</p>;
  if (!dado) return <p className="ac-miudo" role="status">{t.comum.carregando}</p>;
  const minhaDentro = dado.orgs.find((o) => minhas.some((m) => m.handle === o.handle));
  return (
    <article className="ac-cartao" aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`}>{dado.nome}</h3>
      {dado.sobre && <p>{dado.sobre}</p>}
      {msg && <p className={msg.erro ? "ac-erro" : "ac-ok"} role={msg.erro ? "alert" : "status"}>{msg.texto}</p>}
      <h4>{t.orgs.orgsDaFrente}</h4>
      <ul className="ac-lista">{dado.orgs.map((o) => <li key={o.handle}>{o.nome} (@{o.handle}){o.selo ? ` · ${t.orgs.selo}` : ""}</li>)}</ul>
      {dado.para_responder.map((o) => (
        <div key={o.handle} className="ac-acoes">
          <span>@{o.handle}</span>
          <Botao onClick={() => fazer(() => acaoColetiva.responderFrente(dado.id, o.handle, true))}>{t.orgs.aceitar}</Botao>
          <Botao variante="fantasma" onClick={() => fazer(() => acaoColetiva.responderFrente(dado.id, o.handle, false))}>{t.orgs.recusar}</Botao>
        </div>
      ))}
      <h4>{t.orgs.atosDaFrente}</h4>
      {dado.atos.length ? (
        <ul className="ac-lista">
          {dado.atos.map((a) => (
            <li key={a.id} className="ac-acoes">
              <a className="ac-link" href={`/${lang}/alumia/ato/${a.id}`}>{a.titulo} · {a.cidade} · {dataCurta(lang, a.inicio)}</a>
              {dado.gerencio && <Botao variante="fantasma" onClick={() => fazer(() => acaoColetiva.atoNaFrente(dado.id, a.id, false))}>{t.comum.tirar}</Botao>}
            </li>
          ))}
        </ul>
      ) : <p className="ac-miudo">—</p>}
      {dado.gerencio && (
        <>
          <form className="ac-form" onSubmit={(e) => {
            e.preventDefault();
            const ato = idDoAto(String(new FormData(e.currentTarget).get("ato") ?? ""));
            if (!ato) return setMsg({ texto: t.ato.naoAchei, erro: true });
            void fazer(() => acaoColetiva.atoNaFrente(dado.id, ato, true));
          }}>
            <label>{t.orgs.atoNaFrente}<input type="text" name="ato" autoComplete="off" spellCheck={false} /></label>
            <div className="ac-acoes"><Botao type="submit" variante="contorno">{t.comum.salvar}</Botao></div>
          </form>
          <form className="ac-form" onSubmit={(e) => {
            e.preventDefault();
            const h = String(new FormData(e.currentTarget).get("org") ?? "").trim().replace(/^@/, "").toLowerCase();
            if (h) void fazer(() => acaoColetiva.convidarNaFrente(dado.id, h));
          }}>
            <label>{t.orgs.convidar}<input type="text" name="org" maxLength={40} autoComplete="off" spellCheck={false} /></label>
            <div className="ac-acoes"><Botao type="submit" variante="contorno">{t.orgs.convidar.replace(/\s*\(@\)$/, "")}</Botao></div>
          </form>
          {dado.convidadas.length > 0 && <p className="ac-miudo">{dado.convidadas.map((o) => `@${o.handle}`).join(", ")}</p>}
          {minhaDentro && <div className="ac-acoes"><Botao variante="fantasma" onClick={() => fazer(() => acaoColetiva.responderFrente(dado.id, minhaDentro.handle, false))}>{t.orgs.sair}</Botao></div>}
        </>
      )}
    </article>
  );
}
