// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Prompt 4, item 133: o link "Ler como texto" da conversa, para o leitor de fios (/alumia/fio/[id]).
import Link from "@/components/Link";
import { localePath } from "@/i18n/config";
import { useTextosDasPontes } from "./usarTextos";

export function LerComoTexto({ id, lang }: { id: string; lang: string }) {
  const t = useTextosDasPontes(lang);
  if (!t) return null;
  return (
    <p className="px-[18px] py-1">
      <Link href={localePath(lang, `/alumia/fio/${id}`)} className="inline-flex min-h-11 items-center font-semibold underline" data-p4-ler-como-texto>
        {t.fio.abrir}
      </Link>
    </p>
  );
}
