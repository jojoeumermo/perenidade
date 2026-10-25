// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { useEffect, useState } from "react";
import { localePath, type Locale } from "@/i18n/config";
import { hasBackend, rpc } from "@/lib/backend";
import { Avatar } from "./painel/Avatar";

interface Educador {
  id: string;
  nome: string;
  bio: string;
  avatar: string;
  disciplinas: string[] | null;
  curriculo?: Record<string, string>;
}

const textos: Record<string, { quem: string; de: string; todos: string; anterior: string; proximo: string; vazio: string; ensina: string }> = {
  pt: { quem: "Quem ensina", de: "Educador de", todos: "Conheça toda a equipe", anterior: "Educador anterior", proximo: "Próximo educador", vazio: "Esta disciplina ainda procura educadores. Quer ensinar?", ensina: "Ensina" },
  en: { quem: "Who teaches", de: "Educator of", todos: "Meet the whole team", anterior: "Previous educator", proximo: "Next educator", vazio: "This discipline is still looking for educators. Want to teach?", ensina: "Teaches" },
  es: { quem: "Quién enseña", de: "Educador de", todos: "Conoce a todo el equipo", anterior: "Educador anterior", proximo: "Siguiente educador", vazio: "Esta disciplina todavía busca educadores. ¿Quieres enseñar?", ensina: "Enseña" },
  ru: { quem: "Кто преподаёт", de: "Преподаватель:", todos: "Вся команда", anterior: "Предыдущий", proximo: "Следующий", vazio: "Этой дисциплине ещё нужны преподаватели. Хотите преподавать?", ensina: "Преподаёт" },
  fr: { quem: "Qui enseigne", de: "Éducateur de", todos: "Découvrir toute l'équipe", anterior: "Éducateur précédent", proximo: "Éducateur suivant", vazio: "Cette discipline cherche encore des éducateurs. Vous voulez enseigner ?", ensina: "Enseigne" },
  zh: { quem: "授课者", de: "教师：", todos: "认识整个团队", anterior: "上一位", proximo: "下一位", vazio: "这门学科还在寻找教师。想来教吗？", ensina: "教授" },
};

const NOMES_DOS_ENDERECOS: Record<string, string> = { portfolio: "Portfólio", lattes: "Lattes", site: "Site", instagram: "Instagram", youtube: "YouTube", linkedin: "LinkedIn", github: "GitHub" };

/** Os endereços do cartão (só https, já conferidos pelo banco). */
function Enderecos({ curriculo }: { curriculo?: Record<string, string> }) {
  const pares = Object.entries(curriculo ?? {}).filter(([k, v]) => NOMES_DOS_ENDERECOS[k] && /^https:\/\//.test(v));
  if (pares.length === 0) return null;
  return (
    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {pares.map(([k, v]) => (
        <a key={k} href={v} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">{NOMES_DOS_ENDERECOS[k]} ↗</a>
      ))}
    </p>
  );
}

let guardados: Educador[] | null = null;
function useEducadores() {
  const [lista, setLista] = useState<Educador[] | null>(guardados);
  useEffect(() => {
    if (guardados || !hasBackend) return;
    let vivo = true;
    rpc<Educador[]>("educadores")
      .then((dados) => {
        guardados = dados;
        if (vivo) setLista(dados);
      })
      .catch(() => {
        if (vivo) setLista([]);
      });
    return () => {
      vivo = false;
    };
  }, []);
  return lista;
}

/** O cartão de quem ensina a disciplina, no fim de cada aula: um educador por vez, com setas para os outros. */
export function EducadoresDaDisciplina({ area, lang, nomes }: { area: string; lang: Locale; nomes: Record<string, string[]> }) {
  const s = textos[lang] ?? textos.pt;
  const lista = useEducadores();
  const [i, setI] = useState(0);
  if (!hasBackend || !lista) return null;
  const daArea = lista.filter((e) => e.disciplinas?.includes(area));
  // Disciplina sem educador ainda: o cartão não aparece (volta sozinho quando alguém entra como educador).
  if (daArea.length === 0) return null;
  const atual = daArea[((i % Math.max(daArea.length, 1)) + daArea.length) % Math.max(daArea.length, 1)];
  return (
    <aside className="no-print mt-10 border-2 border-ink bg-parchment-deep p-4 font-sans text-sm">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-ink-soft">{s.quem}</p>
      {atual ? (
        <div className="mt-2 flex items-start gap-3">
          <Avatar nome={atual.nome} avatar={atual.avatar} className="h-12 w-12 text-base" />
          <div className="min-w-0 flex-1">
            <p className="font-serif text-lg font-semibold leading-tight">{atual.nome}</p>
            <p className="text-ink-soft">{s.de} {(atual.disciplinas ?? []).map((d) => nomes[d]?.[0] ?? d).join(", ")}</p>
            {atual.curriculo?.formacao && <p className="mt-1 text-ink-soft">{atual.curriculo.formacao}</p>}
            {atual.bio && <p className="mt-1">{atual.bio}</p>}
            <Enderecos curriculo={atual.curriculo} />
          </div>
          {daArea.length > 1 && (
            <p className="flex shrink-0 items-center gap-1">
              <button type="button" aria-label={s.anterior} onClick={() => setI((n) => n - 1)} className="cursor-pointer border border-ink px-2 py-1 hover:bg-ink hover:text-parchment">←</button>
              <span className="font-mono text-xs text-ink-soft">{(((i % daArea.length) + daArea.length) % daArea.length) + 1}/{daArea.length}</span>
              <button type="button" aria-label={s.proximo} onClick={() => setI((n) => n + 1)} className="cursor-pointer border border-ink px-2 py-1 hover:bg-ink hover:text-parchment">→</button>
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-ink-soft">
          {s.vazio} <Link href={localePath(lang, "/voluntarios")} className="underline hover:text-oxblood">→</Link>
        </p>
      )}
      <p className="mt-3">
        <Link href={localePath(lang, "/quem-somos")} className="underline hover:text-oxblood">{s.todos}</Link>
      </p>
    </aside>
  );
}

/**
 * O mesmo cartão, em pé: fica ao lado do título da aula, no espaço livre à direita, nas telas largas.
 * Faixa vinho com o rótulo, o rosto grande, nome, disciplina, formação, apresentação e endereços.
 */
export function CartaoDoEducador({ area, lang, nomes }: { area: string; lang: Locale; nomes: Record<string, string[]> }) {
  const s = textos[lang] ?? textos.pt;
  const lista = useEducadores();
  const [i, setI] = useState(0);
  if (!hasBackend || !lista) return null;
  const daArea = lista.filter((e) => e.disciplinas?.includes(area));
  const n = daArea.length;
  if (n === 0) return null;
  const atual = daArea[((i % n) + n) % n];
  return (
    <aside className="no-print border-2 border-ink bg-parchment-deep font-sans text-sm shadow-[5px_5px_0_var(--ink)]">
      <p className="flex items-center justify-between bg-oxblood px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.25em] text-parchment">
        <span>{s.quem}</span>
        <span aria-hidden>★</span>
      </p>
      {atual ? (
        <div className="p-4">
          <Avatar nome={atual.nome} avatar={atual.avatar} className="aspect-square h-auto w-full border-2 border-ink text-5xl" />
          <p className="mt-3 font-serif text-xl font-semibold leading-tight">{atual.nome}</p>
          <p className="mt-0.5 text-ink-soft">{s.de} {(atual.disciplinas ?? []).map((d) => nomes[d]?.[0] ?? d).join(", ")}</p>
          {atual.curriculo?.formacao && <p className="mt-2 text-ink-soft">{atual.curriculo.formacao}</p>}
          {atual.bio && <p className="mt-2 line-clamp-6">{atual.bio}</p>}
          <Enderecos curriculo={atual.curriculo} />
          {n > 1 && (
            <p className="mt-3 flex items-center justify-between">
              <button type="button" aria-label={s.anterior} onClick={() => setI((k) => k - 1)} className="cursor-pointer border border-ink px-2 py-1 hover:bg-ink hover:text-parchment">←</button>
              <span className="font-mono text-xs text-ink-soft">{((i % n) + n) % n + 1}/{n}</span>
              <button type="button" aria-label={s.proximo} onClick={() => setI((k) => k + 1)} className="cursor-pointer border border-ink px-2 py-1 hover:bg-ink hover:text-parchment">→</button>
            </p>
          )}
        </div>
      ) : (
        <p className="p-4 text-ink-soft">
          {s.vazio} <Link href={localePath(lang, "/voluntarios")} className="underline hover:text-oxblood">→</Link>
        </p>
      )}
      <p className="border-t border-rule px-4 py-2">
        <Link href={localePath(lang, "/quem-somos")} className="underline hover:text-oxblood">{s.todos}</Link>
      </p>
    </aside>
  );
}

/** Todos os educadores, para a página "Quem somos". */
export function ListaDeEducadores({ lang, nomes }: { lang: Locale; nomes: Record<string, string[]> }) {
  const s = textos[lang] ?? textos.pt;
  const todos = useEducadores();
  // Na página da equipe só entra quem completou o cartão: foto, apresentação e pelo menos um endereço.
  const lista = todos?.filter((e) => e.avatar && e.bio?.trim() && Object.entries(e.curriculo ?? {}).some(([k, v]) => NOMES_DOS_ENDERECOS[k] && /^https:\/\//.test(v)));
  if (!hasBackend || !lista || lista.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl font-semibold">{s.quem}</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {lista.map((e) => (
          <li key={e.id} className="flex items-start gap-3 border border-rule bg-parchment-deep p-4 font-sans text-sm">
            <Avatar nome={e.nome} avatar={e.avatar} className="h-12 w-12 text-base" />
            <div className="min-w-0">
              <p className="font-serif text-lg font-semibold leading-tight">{e.nome}</p>
              <p className="text-ink-soft">{s.ensina} {(e.disciplinas ?? []).map((d) => nomes[d]?.[0] ?? d).join(", ")}</p>
              {e.curriculo?.formacao && <p className="mt-1 text-ink-soft">{e.curriculo.formacao}</p>}
              {e.bio && <p className="mt-1">{e.bio}</p>}
              <Enderecos curriculo={e.curriculo} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
