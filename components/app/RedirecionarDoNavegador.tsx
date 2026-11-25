// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { localePath } from "@/i18n/config";
import { useI18n } from "../I18n";
import { textosDoAppNovo } from "./textos-app";

/**
 * As rotas /app são da experiência do aplicativo INSTALADO (o <html data-app> é posto antes da primeira pintura por
 * lib/prefs-script.ts). Quem abre uma delas no navegador (link digitado, busca) vai para o endereço equivalente do site.
 * O aviso abaixo quase nunca aparece: o redirect acontece no primeiro efeito. Sem o aplicativo instalado detectado, o
 * conteúdo da rota não é nem montado na tela (o CSS esconde .so-no-app fora do data-app).
 */
export function RedirecionarDoNavegador() {
  const router = useRouter();
  const { lang } = useI18n();
  const n = textosDoAppNovo(lang);

  useEffect(() => {
    if (!document.documentElement.hasAttribute("data-app")) router.replace(localePath(lang, "/"));
  }, [router, lang]);

  return (
    <p className="aviso-abrir-site" role="status">
      {n.abrindoNoApp}{" "}
      <a href={localePath(lang, "/")}>{n.irParaOSite}</a>
    </p>
  );
}

/**
 * Quem JÁ tinha o aplicativo instalado antes desta versão entra pelo start_url antigo (a inicial do site). No
 * aplicativo, a inicial leva direto para a experiência própria (/app); no navegador, nada acontece.
 */
export function LevarParaOApp() {
  const router = useRouter();
  const pathname = usePathname();
  const { lang } = useI18n();

  useEffect(() => {
    const raizDoSite = localePath(lang, "/");
    if (document.documentElement.hasAttribute("data-app") && (pathname === raizDoSite || pathname === `${raizDoSite}/`)) {
      router.replace(localePath(lang, "/app"));
    }
  }, [router, pathname, lang]);

  return null;
}
