// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { localePath } from "@/i18n/config";
import { useI18n } from "./I18n";
import { abrirMais } from "./NavLinks";

const icons: Record<string, React.ReactNode> = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10" />,
  disciplines: <path d="M4 5.5h7v14H4zM13 5.5h7v14h-7zM4 9.5h7M13 9.5h7" />,
  library: <path d="M5 4v16M9.5 4v16M14 5l4.5 14.5M3 20h18" />,
  community: <path d="M4 5h16v11H10l-4.5 4v-4H4z" />,
  more: <path d="M5 7h14M5 12h14M5 17h14" />,
};

/**
 * Navegação de celular: fica embaixo, ao alcance do polegar, na faixa preta com o fio vermelho do prelo. Em telas
 * largas não aparece (lá o menu do topo cabe inteiro). "Mais" abre a janela com todo o resto do site.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { lang, t } = useI18n();
  const items: [string, string, string][] = [
    ["home", t.nav.home, "/"],
    ["disciplines", t.nav.disciplines, "/trilhas"],
    ["library", t.nav.library, "/acervo"],
    ["community", t.nav.community, "/comunidade"],
    ["more", t.nav.more, "/explorar"],
  ];
  return (
    <nav aria-label={t.nav.main} className="app-abas abas-do-celular no-print no-focus fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-[#c21f16] bg-[#1f1a14] pb-[var(--recuo-baixo)] md:hidden">
      <ul className="grid grid-cols-5">
        {items.map(([icon, label, path]) => {
          const href = localePath(lang, path);
          const active = path === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`) || (path === "/trilhas" && pathname.includes("/estantes/"));
          return (
            <li key={path}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-haspopup={path === "/explorar" ? "dialog" : undefined}
                onClick={(e) => {
                  if (path !== "/explorar" || e.metaKey || e.ctrlKey) return;
                  e.preventDefault();
                  abrirMais();
                }}
                className={`aba-do-celular relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 font-sans text-[0.7rem] leading-tight ${active ? "aba-aberta bg-[#c21f16] font-bold text-white" : "text-[#e9dcbc] hover:text-white"}`}
              >
                <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.1 : 1.8} strokeLinecap="round" strokeLinejoin="round">
                  {icons[icon]}
                </svg>
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
