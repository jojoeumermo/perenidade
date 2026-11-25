// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { localePath } from "@/i18n/config";
import { site } from "@/lib/site";
import { useI18n } from "../I18n";
import { RAIZ_DO_APP, abaDoEndereco, ehRaizDaAba, type AbaDoApp } from "./modo";
import { voltarOuSubir } from "./navegacao";
import { fecharTelaDaVez } from "./telas";
import { textosDoApp } from "./textos";
import { textosDoAppNovo } from "./textos-app";
import { comTransicao, esperarARota, semMovimento, type Direcao } from "./transicoes";

type AbaDoAppNovo = Exclude<AbaDoApp, "comunidade">;

const ABAS_DO_APP: readonly AbaDoAppNovo[] = ["inicio", "estudar", "jogos", "eu"];
const RAIZ_DA_ABA_DO_APP: Record<AbaDoAppNovo, string> = {
  inicio: RAIZ_DO_APP,
  estudar: `${RAIZ_DO_APP}/estudar`,
  jogos: `${RAIZ_DO_APP}/jogos`,
  eu: `${RAIZ_DO_APP}/eu`,
};

const ICONES: Record<AbaDoAppNovo, React.ReactNode> = {
  inicio: <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10" />,
  estudar: <path d="M4 5.5h7v14H4zM13 5.5h7v14h-7zM4 9.5h7M13 9.5h7" />,
  jogos: <path d="M7 8h10a4 4 0 0 1 4 4.2l-.6 3.6a2.4 2.4 0 0 1-4.1 1.3L15 15.5H9l-1.3 1.6a2.4 2.4 0 0 1-4.1-1.3L3 12.2A4 4 0 0 1 7 8zM8 10.5v3M6.5 12h3M16 11.5h.01M18 13h.01" />,
  eu: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5" />,
};

/**
 * A casca da experiência própria do aplicativo instalado (app/[lang]/app/...): barra de cima e abas de baixo NOVAS, sem a
 * Alumia, no desenho do aplicativo. Só aparece com <html data-app> (app/app-instalado.css esconde tudo fora dele): no
 * navegador o HTML existe mas não aparece, e as rotas /app ainda por cima levam a pessoa ao site (RedirecionarDoNavegador).
 * O gesto de voltar, as transições e as marcas em <html> continuam com a casca de sempre (components/app/CascaDoApp.tsx):
 * aqui entram só as duas barras.
 */
export function ShellDoApp() {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, t } = useI18n();
  const s = textosDoApp(lang);
  const n = textosDoAppNovo(lang);
  const aba = abaDoEndereco(pathname);
  const raiz = ehRaizDaAba(pathname);

  const pathRef = useRef(pathname);
  const langRef = useRef(lang);
  const avisarRota = useRef<(() => void) | null>(null);
  const tituloRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    pathRef.current = pathname;
    langRef.current = lang;
    // Quem registra a troca de endereço para o "voltar" é a casca (CascaDoApp): registrar de novo aqui
    // contaria duas vezes a mesma navegação e quebraria o andouNoSite.
    avisarRota.current?.();
    avisarRota.current = null;
  }, [pathname, lang]);

  // Nas telas de dentro, o título da página na barra, como a barra do celular faz (lê o h1 quando ele sai da tela).
  useEffect(() => {
    const titulo = tituloRef.current;
    if (!titulo) return;
    if (raiz) {
      titulo.dataset.visivel = "";
      titulo.textContent = "";
      return;
    }
    const h1 = document.querySelector<HTMLElement>("main h1");
    titulo.textContent = h1?.textContent?.trim() ?? document.title.split(" — ")[0];
    if (!h1) {
      titulo.dataset.visivel = "";
      return;
    }
    delete titulo.dataset.visivel;
    const observador = new IntersectionObserver(([entrada]) => {
      if (!entrada.isIntersecting && entrada.boundingClientRect.top < 80) titulo.dataset.visivel = "";
      else delete titulo.dataset.visivel;
    }, { rootMargin: "-64px 0px 0px 0px" });
    observador.observe(h1);
    return () => observador.disconnect();
  }, [pathname, raiz]);

  const ir = (href: string, direcao: Direcao) => {
    const espera = esperarARota();
    avisarRota.current = espera.avisar;
    void comTransicao(direcao, () => {
      router.push(href);
      return espera.promessa;
    });
  };

  const voltar = () => {
    if (fecharTelaDaVez()) return;
    const espera = esperarARota();
    avisarRota.current = espera.avisar;
    void comTransicao("voltar", () => {
      voltarOuSubir(router, pathRef.current, langRef.current);
      return espera.promessa;
    });
  };

  return (
    <div className="shell-do-app no-print no-focus">
      <header className="shell-topo" data-raiz={raiz || undefined}>
        {raiz ? (
          <Link href={localePath(lang, RAIZ_DO_APP)} className="shell-marca" aria-label={site.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca-96.png" alt="" width={30} height={30} />
            <span>{site.name}</span>
          </Link>
        ) : (
          <button type="button" className="shell-icone" onClick={voltar} aria-label={t.common.back}>
            <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )}
        <span ref={tituloRef} className="shell-titulo" aria-hidden={raiz} />
        <span className="shell-acoes">
          <Link href={localePath(lang, "/app/estudar/buscar")} className="shell-icone" aria-label={n.buscar}>
            <svg aria-hidden viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="M15.5 15.5 20 20" />
            </svg>
          </Link>
        </span>
      </header>

      <nav aria-label={s.menu} className="shell-abas">
        <ul>
          {ABAS_DO_APP.map((item) => {
            const href = localePath(lang, RAIZ_DA_ABA_DO_APP[item]);
            const aberta = aba === item;
            return (
              <li key={item}>
                <Link
                  href={href}
                  aria-current={aberta ? "page" : undefined}
                  data-aberta={aberta || undefined}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                    e.preventDefault();
                    if (!aberta) return ir(href, "aba");
                    if (!ehRaizDaAba(pathname)) return ir(href, "voltar");
                    window.scrollTo({ top: 0, behavior: semMovimento() ? "auto" : "smooth" });
                  }}
                >
                  <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={aberta ? 2.1 : 1.8} strokeLinecap="round" strokeLinejoin="round">
                    {ICONES[item]}
                  </svg>
                  <span>{s.abas[item]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
