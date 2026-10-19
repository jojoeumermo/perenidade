// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuadroDoEditor } from "@/components/EstudioDePratica";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { type AreaDoEstudio, EDITORES, editor, ESCRITORIO, ESTUDIOS } from "@/lib/estudio";
import { paginaMeta } from "@/lib/seo";

/** Só os que rodam no navegador têm página para abrir (o LightCraft é programa de computador). */
const abriveis = EDITORES.filter((e) => !e.baixar);
export const dynamicParams = false;
export function generateStaticParams() {
  return abriveis.map((e) => ({ editor: e.id }));
}

const areaDo = (id: string) => (Object.keys(ESTUDIOS) as AreaDoEstudio[]).find((a) => (ESTUDIOS[a] as readonly string[]).includes(id));

export async function generateMetadata({ params }: PageProps<"/[lang]/estudio-de-pratica/abrir/[editor]">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  const { editor: id } = await params;
  const ed = editor(id);
  return paginaMeta(lang, `/estudio-de-pratica/abrir/${id}`, `${ed?.nome ?? ""} · ${t.practiceStudio.title}`, t.practiceStudio.insideNote);
}

/** O programa do Estúdio de prática aberto dentro do site, sem mandar o aluno para outro endereço. */
export default async function AbrirEditor({ params }: PageProps<"/[lang]/estudio-de-pratica/abrir/[editor]">) {
  const { lang, t } = await loadLang(params);
  const { editor: id } = await params;
  const ed = abriveis.find((e) => e.id === id);
  const area = areaDo(id);
  const escritorio = (ESCRITORIO as readonly string[]).includes(id);
  if (!ed || (!area && !escritorio)) notFound();
  const s = t.practiceStudio;
  return (
    <div className="mx-auto max-w-[96rem] px-3 py-4">
      <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-sans text-sm">
        {area ? (
          <>
            <Link href={localePath(lang, `/estantes/${area}`)} className="text-ink-soft hover:text-oxblood">← {t.areas[area][0]}</Link>
            <Link href={localePath(lang, "/estudio-de-pratica")} className="text-ink-soft hover:text-oxblood">{s.back}</Link>
          </>
        ) : (
          <Link href={localePath(lang, "/laboratorios/escritorio")} className="text-ink-soft hover:text-oxblood">← {t.labs.escritorio}</Link>
        )}
      </p>
      <h1 className="mt-2 font-serif text-3xl font-semibold">{ed.nome}</h1>
      <QuadroDoEditor s={s} id={ed.id} nome={ed.nome} />
    </div>
  );
}
