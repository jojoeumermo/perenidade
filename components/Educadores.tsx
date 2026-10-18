// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "next/link";
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
}

const textos: Record<string, { quem: string; de: string; todos: string; anterior: string; proximo: string; vazio: string; ensina: string }> = {
  pt: { quem: "Quem ensina", de: "Educador de", todos: "Conheça toda a equipe", anterior: "Educador anterior", proximo: "Próximo educador", vazio: "Esta disciplina ainda procura educadores. Quer ensinar?", ensina: "Ensina" },
  en: { quem: "Who teaches", de: "Educator of", todos: "Meet the whole team", anterior: "Previous educator", proximo: "Next educator", vazio: "This discipline is still looking for educators. Want to teach?", ensina: "Teaches" },
  es: { quem: "Quién enseña", de: "Educador de", todos: "Conoce a todo el equipo", anterior: "Educador anterior", proximo: "Siguiente educador", vazio: "Esta disciplina todavía busca educadores. ¿Quieres enseñar?", ensina: "Enseña" },
  ru: { quem: "Кто преподаёт", de: "Преподаватель:", todos: "Вся команда", anterior: "Предыдущий", proximo: "Следующий", vazio: "Этой дисциплине ещё нужны преподаватели. Хотите преподавать?", ensina: "Преподаёт" },
  zh: { quem: "授课者", de: "教师：", todos: "认识整个团队", anterior: "上一位", proximo: "下一位", vazio: "这门学科还在寻找教师。想来教吗？", ensina: "教授" },
};

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
            {atual.bio && <p className="mt-1">{atual.bio}</p>}
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

/** Todos os educadores, para a página "Quem somos". */
export function ListaDeEducadores({ lang, nomes }: { lang: Locale; nomes: Record<string, string[]> }) {
  const s = textos[lang] ?? textos.pt;
  const lista = useEducadores();
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
              {e.bio && <p className="mt-1">{e.bio}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
