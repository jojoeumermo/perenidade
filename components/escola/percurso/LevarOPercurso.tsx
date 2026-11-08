// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDoPercurso } from "@/i18n/escola/percurso";
import { nomeDoArquivo } from "@/lib/escola/conquistas";
import { montarCopia } from "@/lib/estudo";

/**
 * "Seu percurso fica guardado só neste aparelho. Levar para outro aparelho · Baixar" (prancha Cel-Percurso).
 * Levar abre o QR de Meus dados (components/progresso/LevarProgresso.tsx). Baixar salva a cópia de segurança do estudo
 * (o mesmo formato que Meus dados e o Caderno restauram), com nome neutro. Nada sai do aparelho por aqui: o arquivo é
 * montado no navegador. A militância não entra no arquivo (ela mora no banco, não no aparelho).
 */
export function LevarOPercurso({ t, lang }: { t: TextosDoPercurso["levar"]; lang: Locale }) {
  const [aviso, setAviso] = useState("");

  function baixar() {
    let copia;
    try {
      copia = montarCopia(window.localStorage);
    } catch {
      copia = null;
    }
    if (!copia || Object.keys(copia.dados).length === 0) {
      setAviso(t.vazio);
      return;
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(copia)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeDoArquivo(new Date());
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setAviso(t.baixado);
  }

  return (
    <div>
      <p className="ep-levar">
        {t.texto} <Link href={`${localePath(lang, "/meus-dados")}#levar-progresso`}>{t.levar}</Link> ·{" "}
        <button type="button" onClick={baixar}>
          {t.baixar}
        </button>
      </p>
      <p className="ep-levar-aviso" role="status" aria-live="polite">
        {aviso}
      </p>
    </div>
  );
}
