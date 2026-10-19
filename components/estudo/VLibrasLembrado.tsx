// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect } from "react";
import { carregarVLibras, vlibrasLembrado } from "@/lib/vlibras";

/** Liga o VLibras sozinho só quando a pessoa marcou "lembrar neste aparelho" ao ativar. Não desenha nada. */
export default function VLibrasLembrado() {
  useEffect(() => {
    if (vlibrasLembrado()) void carregarVLibras().catch(() => undefined);
  }, []);
  return null;
}
