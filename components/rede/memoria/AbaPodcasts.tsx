// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 119. Podcast do núcleo ou da comunidade: cada episódio é um post com áudio da comunidade, que a mediação escolhe e titula. Ouvir é
// no próprio post (o caminho de sempre do áudio, só para quem vê o post). O RSS (app/api/rede/podcast/<endereço>) sai só da
// comunidade aberta e só com os episódios que já podem sair da Alumia; não leva quem publicou nem o texto do post, e ninguém conta
// quem ouve.
import { useId, useState, type FormEvent } from "react";
import Link from "@/components/Link";
import { confirmar } from "@/components/perguntar";
import { idDoPost, memoriaDaLuta, type ListaDePodcasts, type Podcast } from "@/lib/rede/memoria/cliente";
import { slugOk } from "@/lib/rede/memoria/regras";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import { dataCurta, fraseDoErroDaMemoria, type TextosDaMemoria } from "./textos";
import { useCarga } from "./usar";

function UmPodcast({ t, lang, slug, aoVoltar }: { t: TextosDaMemoria; lang: string; slug: string; aoVoltar: () => void }) {
  const { dado, erro, trocar } = useCarga<Podcast>(`p:${slug}`, () => memoriaDaLuta.podcast(slug));
  const [falha, setFalha] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function por(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const post = idDoPost(String(f.get("post") ?? ""));
    if (!post) return setFalha(t.erros.nao_encontrado);
    setOcupado(true);
    try {
      trocar(await memoriaDaLuta.porEpisodio({ podcast: slug, post, titulo: String(f.get("titulo") ?? ""), notas: String(f.get("notas") ?? "") }));
      setFalha(null);
      form.reset();
    } catch (x) {
      setFalha(fraseDoErroDaMemoria(t, x));
    } finally {
      setOcupado(false);
    }
  }

  async function tirar(id: string, titulo: string) {
    if (!(await confirmar(preencher(t.podcasts.tirarPergunta, { titulo }), { perigo: true }))) return;
    try {
      trocar(await memoriaDaLuta.tirarEpisodio(id));
    } catch (x) {
      setFalha(fraseDoErroDaMemoria(t, x));
    }
  }

  return (
    <div className="ml-bloco">
      <div className="ml-acoes"><Botao variante="fantasma" tamanho="p" onClick={aoVoltar}>← {t.podcasts.voltar}</Botao></div>
      {erro ? <p className="ml-erro" role="alert">{fraseDoErroDaMemoria(t, erro)}</p> : null}
      {!dado && !erro && <p className="ml-miudo" role="status">{t.comum.carregando}</p>}
      {dado && (
        <>
          <p className="ml-etiqueta">{dado.comunidade_nome}</p>
          <h2 className="ml-subtitulo">{dado.titulo}</h2>
          {dado.sobre && <p className="ml-chamada">{dado.sobre}</p>}
          {dado.rss ? (
            <div className="ml-bloco">
              <div className="ml-acoes"><a className="ml-link" href={`/api/rede/podcast/${encodeURIComponent(dado.slug)}`} type="application/rss+xml">{t.podcasts.rss}</a></div>
              <p className="ml-miudo">{t.podcasts.rssAjuda}</p>
            </div>
          ) : <p className="ml-miudo">{t.podcasts.semRss}</p>}
          {falha && <p className="ml-erro" role="alert">{falha}</p>}
          {dado.episodios.length === 0 ? <p className="ml-miudo">{t.podcasts.episodiosVazio}</p> : (
            <ul className="ml-lista">
              {dado.episodios.map((e) => (
                <li key={e.id} className="ml-cartao">
                  <p className="ml-etiqueta">
                    {[preencher(t.podcasts.episodio, { numero: e.numero }), dataCurta(lang, e.criado_em), e.duracao ? preencher(t.podcasts.duracao, { segundos: Math.round(e.duracao) }) : ""].filter(Boolean).join(" · ")}
                  </p>
                  <h3>{e.titulo}</h3>
                  {e.notas && <p>{e.notas}</p>}
                  <div className="ml-acoes">
                    <Link className="ml-link" href={`/${lang}/alumia/p/${e.post}`}>{t.podcasts.ouvir}</Link>
                    {dado.modero && <Botao variante="fantasma" tamanho="p" onClick={() => tirar(e.id, e.titulo)}>{t.comum.tirar}</Botao>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {dado.modero && (
            <form className="ml-form" onSubmit={por} aria-label={t.podcasts.porEpisodio}>
              <label>{t.podcasts.post}<input type="text" name="post" required autoComplete="off" /></label>
              <label>{t.comum.titulo}<input type="text" name="titulo" required minLength={3} maxLength={120} /></label>
              <label>{t.podcasts.notas} {t.comum.opcional}<textarea name="notas" maxLength={2000} /></label>
              <div className="ml-acoes"><Botao type="submit" disabled={ocupado}>{t.podcasts.porEpisodio}</Botao></div>
            </form>
          )}
        </>
      )}
    </div>
  );
}

export function AbaPodcasts({ t, lang }: { t: TextosDaMemoria; lang: string }) {
  const { dado, erro, carregando, recarregar } = useCarga<ListaDePodcasts>("podcasts", () => memoriaDaLuta.podcasts());
  const [aberto, setAberto] = useState<string | null>(null);
  const [criar, setCriar] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const id = useId();

  async function criarPodcast(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const slug = String(f.get("slug") ?? "").trim().toLowerCase();
    if (!slugOk(slug)) return setMensagem({ texto: t.erros.invalido, erro: true });
    setOcupado(true);
    try {
      const p = await memoriaDaLuta.criarPodcast({ comunidade: String(f.get("comunidade") ?? ""), slug, titulo: String(f.get("titulo") ?? ""), sobre: String(f.get("sobre") ?? "") });
      setMensagem({ texto: t.podcasts.criado, erro: false });
      setCriar(false);
      recarregar();
      setAberto(p.slug);
    } catch (x) {
      setMensagem({ texto: fraseDoErroDaMemoria(t, x), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  if (aberto) return <UmPodcast t={t} lang={lang} slug={aberto} aoVoltar={() => { setAberto(null); recarregar(); }} />;

  return (
    <section className="ml-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="ml-subtitulo">{t.abas.podcasts}</h2>
      <p className="ml-miudo">{t.podcasts.sobre}</p>
      {mensagem && <p className={mensagem.erro ? "ml-erro" : "ml-ok"} role={mensagem.erro ? "alert" : "status"}>{mensagem.texto}</p>}
      {erro ? <p className="ml-erro" role="alert">{fraseDoErroDaMemoria(t, erro)}</p> : null}
      {carregando && !dado ? <p className="ml-miudo" role="status">{t.comum.carregando}</p> : null}
      {dado && dado.posso_criar.length > 0 && (
        criar ? (
          <form className="ml-form" onSubmit={criarPodcast} aria-label={t.podcasts.criar}>
            <label>{t.comum.comunidade}
              <select name="comunidade" required defaultValue={dado.posso_criar[0]?.slug}>{dado.posso_criar.map((c) => <option key={c.slug} value={c.slug}>{c.nome}</option>)}</select>
            </label>
            <label>{t.comum.titulo}<input type="text" name="titulo" required minLength={3} maxLength={80} /></label>
            <label>{t.podcasts.endereco}<input type="text" name="slug" required pattern="[a-z0-9\-]{3,40}" autoCapitalize="none" autoComplete="off" spellCheck={false} /></label>
            <label>{t.podcasts.sobreCampo} {t.comum.opcional}<textarea name="sobre" maxLength={1000} /></label>
            <div className="ml-acoes">
              <Botao type="submit" disabled={ocupado}>{t.podcasts.criar}</Botao>
              <Botao type="button" variante="fantasma" onClick={() => setCriar(false)}>{t.comum.cancelar}</Botao>
            </div>
          </form>
        ) : (
          <div className="ml-acoes"><Botao variante="contorno" onClick={() => setCriar(true)}>{t.podcasts.criar}</Botao></div>
        )
      )}
      {dado && dado.podcasts.length === 0 && <p className="ml-miudo">{t.podcasts.vazio}</p>}
      {dado && dado.podcasts.length > 0 && (
        <ul className="ml-lista">
          {dado.podcasts.map((p) => (
            <li key={p.slug} className="ml-cartao">
              <p className="ml-etiqueta">{p.comunidade_nome}</p>
              <h3>{p.titulo}</h3>
              {p.sobre && <p>{p.sobre}</p>}
              <div className="ml-acoes"><Botao variante="contorno" tamanho="p" onClick={() => setAberto(p.slug)}>{t.podcasts.ver}</Botao></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
