// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/I18n";
import Link from "@/components/Link";
import { htmlLang, localePath } from "@/i18n/config";
import { BackendError, hasBackend, rpc } from "@/lib/backend";

/**
 * As novidades de um território, postadas pelo próprio coletivo parceiro (supabase/migracoes/20261109-territorios-parceiros.sql).
 * Todo mundo lê; quem a coordenação ligou ao território vê também o formulário para postar e o "tirar do ar" das
 * próprias postagens. As últimas de todos os territórios aparecem também no Jornal (DosTerritorios, abaixo).
 */

export interface PostDoTerritorio {
  id: string;
  territorio: string;
  titulo: string;
  texto: string;
  link: string;
  criado_em: string;
  minha?: boolean;
}

const T: Record<string, { titulo: string; vazio: string; escrever: string; campoTitulo: string; campoTexto: string; campoLink: string; postar: string; postado: string; tirar: string; falhou: string; jornal: string; jornalTexto: string; ver: string }> = {
  pt: { titulo: "Novidades do território", vazio: "O coletivo ainda não postou novidades aqui.", escrever: "Postar uma novidade do território", campoTitulo: "Título", campoTexto: "O que está acontecendo (pelo menos 20 letras)", campoLink: "Link (opcional, https://)", postar: "Postar", postado: "Postado. Já aparece aqui e no Jornal.", tirar: "Tirar do ar", falhou: "Não foi possível postar. Confira os campos e tente de novo.", jornal: "Dos territórios", jornalTexto: "O que os coletivos parceiros contam dos seus territórios, escrito por eles.", ver: "Ver o território" },
  en: { titulo: "News from the territory", vazio: "The collective has not posted news here yet.", escrever: "Post news from the territory", campoTitulo: "Title", campoTexto: "What is happening (at least 20 letters)", campoLink: "Link (optional, https://)", postar: "Post", postado: "Posted. It already shows here and in the Journal.", tirar: "Take down", falhou: "Could not post. Check the fields and try again.", jornal: "From the territories", jornalTexto: "What the partner collectives tell about their territories, written by them.", ver: "See the territory" },
  es: { titulo: "Novedades del territorio", vazio: "El colectivo todavía no publicó novedades aquí.", escrever: "Publicar una novedad del territorio", campoTitulo: "Título", campoTexto: "Qué está pasando (al menos 20 letras)", campoLink: "Enlace (opcional, https://)", postar: "Publicar", postado: "Publicado. Ya aparece aquí y en el Periódico.", tirar: "Quitar", falhou: "No se pudo publicar. Revisa los campos e inténtalo de nuevo.", jornal: "De los territorios", jornalTexto: "Lo que los colectivos aliados cuentan de sus territorios, escrito por ellos.", ver: "Ver el territorio" },
  fr: { titulo: "Nouvelles du territoire", vazio: "Le collectif n’a pas encore publié de nouvelles ici.", escrever: "Publier une nouvelle du territoire", campoTitulo: "Titre", campoTexto: "Ce qui se passe (au moins 20 lettres)", campoLink: "Lien (facultatif, https://)", postar: "Publier", postado: "Publié. Visible ici et dans le Journal.", tirar: "Retirer", falhou: "Impossible de publier. Vérifiez les champs et réessayez.", jornal: "Des territoires", jornalTexto: "Ce que les collectifs partenaires racontent de leurs territoires, écrit par eux.", ver: "Voir le territoire" },
  ru: { titulo: "Новости территории", vazio: "Коллектив пока ничего здесь не публиковал.", escrever: "Опубликовать новость территории", campoTitulo: "Заголовок", campoTexto: "Что происходит (не меньше 20 букв)", campoLink: "Ссылка (необязательно, https://)", postar: "Опубликовать", postado: "Опубликовано. Уже видно здесь и в Газете.", tirar: "Снять", falhou: "Не удалось опубликовать. Проверьте поля и попробуйте снова.", jornal: "С территорий", jornalTexto: "Что коллективы-партнёры рассказывают о своих территориях, их словами.", ver: "Открыть территорию" },
  zh: { titulo: "地区动态", vazio: "这个团体还没有在这里发布动态。", escrever: "发布地区动态", campoTitulo: "标题", campoTexto: "正在发生什么（至少 20 个字）", campoLink: "链接（可选，https://）", postar: "发布", postado: "已发布。现在这里和报纸上都能看到。", tirar: "撤下", falhou: "发布失败。请检查各项后重试。", jornal: "来自各地区", jornalTexto: "合作团体讲述自己地区的事，由他们亲自撰写。", ver: "查看地区" },
};

function useTextos() {
  const { lang } = useI18n();
  return { lang, s: T[lang] ?? T.pt };
}

function Data({ quando, lang }: { quando: string; lang: string }) {
  return <time dateTime={quando}>{new Intl.DateTimeFormat(htmlLang[lang as keyof typeof htmlLang] ?? "pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(quando))}</time>;
}

export function NoticiasDoTerritorio({ slug }: { slug: string }) {
  const { lang, s } = useTextos();
  // Sem banco configurado não há o que buscar: a lista já nasce vazia.
  const [posts, setPosts] = useState<PostDoTerritorio[] | null>(hasBackend ? null : []);
  const [meu, setMeu] = useState(false);
  const [rascunho, setRascunho] = useState({ titulo: "", texto: "", link: "" });
  const [estado, setEstado] = useState<"" | "enviando" | "ok" | "erro">("");
  const carregar = useCallback(() => {
    if (!hasBackend) return;
    void rpc<PostDoTerritorio[]>("territorio_posts", { p_territorio: slug, p_limite: 20 })
      .then(setPosts)
      .catch(() => setPosts([]));
  }, [slug]);
  useEffect(() => {
    carregar();
    if (!hasBackend) return;
    void rpc<string[]>("territorio_meus")
      .then((lista) => setMeu(lista.includes(slug)))
      .catch(() => setMeu(false));
  }, [slug, carregar]);

  const pronto = rascunho.titulo.trim().length >= 5 && rascunho.texto.trim().length >= 20 && (!rascunho.link.trim() || /^https:\/\/\S+$/.test(rascunho.link.trim()));
  async function postar() {
    setEstado("enviando");
    try {
      await rpc("territorio_postar", { p: { territorio: slug, titulo: rascunho.titulo.trim(), texto: rascunho.texto.trim(), link: rascunho.link.trim() } });
      setRascunho({ titulo: "", texto: "", link: "" });
      setEstado("ok");
      carregar();
    } catch (e) {
      setEstado(e instanceof BackendError ? "erro" : "erro");
    }
  }

  return (
    <section id="noticias" className="mt-12" aria-labelledby="noticias-do-territorio">
      <h2 id="noticias-do-territorio" className="border-b-2 border-ink pb-2 font-serif text-3xl font-semibold">
        {s.titulo}
      </h2>
      {meu && (
        <form
          className="mt-5 space-y-3 border-2 border-ink bg-folha p-5 font-sans shadow-[5px_5px_0_var(--sombra)]"
          onSubmit={(e) => {
            e.preventDefault();
            if (pronto) void postar();
          }}
        >
          <p className="font-bold">{s.escrever}</p>
          <label className="block text-sm font-semibold">
            {s.campoTitulo}
            <input value={rascunho.titulo} maxLength={140} onChange={(e) => setRascunho({ ...rascunho, titulo: e.target.value })} className="mt-1 w-full border-2 border-ink bg-parchment px-3 py-2 font-normal" />
          </label>
          <label className="block text-sm font-semibold">
            {s.campoTexto}
            <textarea value={rascunho.texto} maxLength={4000} rows={4} onChange={(e) => setRascunho({ ...rascunho, texto: e.target.value })} className="mt-1 w-full border-2 border-ink bg-parchment px-3 py-2 font-normal" />
          </label>
          <label className="block text-sm font-semibold">
            {s.campoLink}
            <input type="url" value={rascunho.link} maxLength={500} onChange={(e) => setRascunho({ ...rascunho, link: e.target.value })} className="mt-1 w-full border-2 border-ink bg-parchment px-3 py-2 font-normal" />
          </label>
          <button type="submit" disabled={!pronto || estado === "enviando"} className="botao botao-tinta disabled:cursor-not-allowed disabled:opacity-60">
            {s.postar}
          </button>
          {estado === "ok" && <p role="status" className="text-sm">{s.postado}</p>}
          {estado === "erro" && <p role="alert" className="text-sm text-oxblood">{s.falhou}</p>}
        </form>
      )}
      {posts && posts.length === 0 && <p className="mt-4 text-lg text-ink-soft">{s.vazio}</p>}
      <ol className="mt-4 divide-y divide-rule">
        {(posts ?? []).map((p) => (
          <li key={p.id} className="py-5">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-soft">
              <Data quando={p.criado_em} lang={lang} />
            </p>
            <h3 className="mt-1 font-serif text-2xl font-semibold">{p.titulo}</h3>
            <p className="mt-2 whitespace-pre-line text-lg leading-relaxed">{p.texto}</p>
            {p.link && (
              <p className="mt-2 font-sans text-sm">
                <a href={p.link} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold underline decoration-[#c21f16] underline-offset-4">
                  {p.link.replace(/^https:\/\//, "").slice(0, 60)} ↗
                </a>
              </p>
            )}
            {p.minha && (
              <button type="button" className="mt-2 cursor-pointer font-sans text-sm underline hover:text-oxblood" onClick={() => void rpc("territorio_post_ocultar", { p_id: p.id, p_motivo: "" }).then(carregar)}>
                {s.tirar}
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** A seção "Dos territórios" do Jornal: as últimas novidades postadas pelos coletivos, cada uma levando ao território. */
export function DosTerritorios({ nomes }: { nomes: Record<string, string> }) {
  const { lang, s } = useTextos();
  const [posts, setPosts] = useState<PostDoTerritorio[] | null>(null);
  useEffect(() => {
    if (!hasBackend) return;
    void rpc<PostDoTerritorio[]>("territorio_posts_recentes", { p_limite: 6 })
      .then(setPosts)
      .catch(() => setPosts([]));
  }, []);
  if (!posts || posts.length === 0) return null;
  return (
    <section className="mx-auto max-w-[78rem] px-4 py-10 sm:px-6 lg:px-8" aria-labelledby="dos-territorios">
      <h2 id="dos-territorios" className="flex items-center gap-3.5">
        <span className="bg-[#1f1a14] px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#f4ecd8]">★ {s.jornal}</span>
        <span aria-hidden className="flex-1 border-t-2 border-[#1f1a14]" />
      </h2>
      <p className="mt-3 max-w-2xl text-ink-soft">{s.jornalTexto}</p>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <li key={p.id} className="cartao flex flex-col p-5">
            <p className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-prelo-texto">{nomes[p.territorio] ?? p.territorio}</p>
            <h3 className="mt-1.5 font-serif text-[1.35rem] font-semibold leading-tight">{p.titulo}</h3>
            <p className="mt-2 line-clamp-3 leading-snug text-ink-soft">{p.texto}</p>
            <p className="mt-auto flex items-center justify-between gap-3 pt-3 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-ink-soft">
              <Data quando={p.criado_em} lang={lang} />
              <Link href={localePath(lang, `/territorios/${p.territorio}#noticias`)} className="font-sans text-sm font-bold normal-case tracking-normal text-ink underline decoration-[#c21f16] underline-offset-4">
                {s.ver} →
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
