// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { EB_Garamond, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Link from "@/components/Link";
import pt from "@/i18n/pt.json";
import { prefsScript } from "@/lib/prefs";
import { site } from "@/lib/site";

// O "não encontrado" de endereço que nenhuma rota atende (/pt/pagina-que-nao-existe, /pt/trilhas/nome-errado).
// O layout do site depende do idioma do endereço, e aqui não há idioma: a página vem inteira, em português (a língua
// principal do site), com a marca, o papel e as letras de sempre, em vez da tela branca em inglês do Next.
const serif = EB_Garamond({ variable: "--font-serif-display", subsets: ["latin"] });
const ui = Inter({ variable: "--font-ui", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-archive", subsets: ["latin"], weight: ["400", "500"] });

const t = pt.notFound;

export const metadata: Metadata = {
  title: `${t.title} — ${site.name}`,
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="pt-BR" className={`${serif.variable} ${ui.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: prefsScript }} />
      </head>
      <body className="pont min-h-dvh">
        <header className="border-b-[3px] border-ink bg-parchment">
          <Link href="/pt" className="mx-auto flex max-w-[78rem] items-center gap-3.5 px-4 py-4 text-ink hover:text-ink sm:px-6 lg:px-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca-96.png" alt="" width={52} height={52} className="h-12 w-12" />
            <span className="text-[1.7rem] font-semibold leading-none tracking-tight">{site.name}</span>
          </Link>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-20 text-center">
          <p className="rotulo">{t.eyebrow}</p>
          <h1 className="mt-3 text-5xl font-semibold leading-tight [text-wrap:balance]">{t.title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-xl text-ink-soft">{t.text}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/pt/busca" className="botao botao-prelo">
              {t.search}
            </Link>
            <Link href="/pt" className="botao botao-papel">
              {t.home}
            </Link>
          </div>
          <p className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 font-sans text-sm">
            <Link href="/pt/trilhas" className="underline hover:text-oxblood">
              {pt.nav.disciplines}
            </Link>
            <Link href="/pt/acervo" className="underline hover:text-oxblood">
              {pt.nav.library}
            </Link>
            <Link href="/pt/comecar" className="underline hover:text-oxblood">
              {pt.nav.start}
            </Link>
          </p>
        </main>
      </body>
    </html>
  );
}
