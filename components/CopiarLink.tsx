// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { useI18n } from "./I18n";

/** Copia o endereço desta página com a âncora do item: para compartilhar uma checagem, um verbete, um autor. */
export function CopiarLink({ id, className = "" }: { id: string; className?: string }) {
  const { t } = useI18n();
  const [feito, setFeito] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`${location.origin}${location.pathname}#${id}`);
          setFeito(true);
          window.setTimeout(() => setFeito(false), 2000);
        } catch {
          location.hash = id;
        }
      }}
      className={`cursor-pointer font-sans text-xs text-ink-soft underline hover:text-oxblood ${className}`}
    >
      {feito ? t.lists.copied : t.lists.copyLink}
    </button>
  );
}
