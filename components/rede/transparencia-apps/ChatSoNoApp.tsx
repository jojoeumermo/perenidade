// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import type { TextosDoApp } from "./textos";
import "./app.css";

/**
 * O que as páginas do chat mostram com o recurso "alumia-chat-so-app" ligado (lib/rede/transparencia-apps/recurso.ts): só o
 * aviso e o link para baixar e conferir o app. Sem nenhuma importação do chat: a página que mostra isto não leva nenhum código de
 * chave ao navegador (o teste e2e/so-app.spec.ts confere os pedidos e os pedaços de JavaScript baixados).
 */
export function ChatSoNoApp({ lang, t, voltar = `/${lang}/alumia` }: { lang: string; t: TextosDoApp; voltar?: string | null }) {
  return (
    <section className="ap-so-app" aria-labelledby="ap-so-app-titulo" data-chat-so-app="">
      <h1 id="ap-so-app-titulo">{t.soApp.titulo}</h1>
      <p>{t.soApp.texto}</p>
      <p className="ap-acoes">
        <Link className="ap-botao" href={`/${lang}/alumia/app`}>
          {t.soApp.baixar}
        </Link>
        {voltar && (
          <Link className="ap-botao ap-botao-leve" href={voltar}>
            {t.soApp.voltar}
          </Link>
        )}
      </p>
    </section>
  );
}
