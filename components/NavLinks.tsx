// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fill, localeNames, localePath, locales } from "@/i18n/config";
import { hasBackend, rpc, signOut, useMe } from "@/lib/backend";
import { AVATARES } from "./painel/Avatar";
import { KEYS, setItem, useHydrated, useStored } from "@/lib/storage";
import { useI18n } from "./I18n";

/** Abre a janela do "Mais" (components/MaisGaveta.tsx), que mora uma vez só no layout. */
export const ABRIR_MAIS = "lucia:abrir-mais";
export const SAIR_MAIS = "lucia:sair-mais";
export const abrirMais = (mouse = false) => window.dispatchEvent(new CustomEvent(ABRIR_MAIS, { detail: { mouse } }));

/** O que já está no menu do topo do computador: a janela do "Mais" não repete. */
export const MAIS_NO_MENU = ["/trilhas", "/acervo", "/jornal", "/podcasts", "/comunidade", "/saude", "/dedicatoria", "/apoie"];

export function NavLinks() {
  const pathname = usePathname();
  const { lang, t } = useI18n();
  const novo = useEpisodioNovo();
  // No menu, o que se usa todo dia, o Mural de Saúde e a Dedicatória (Lúcia é quem inspirou tudo isto); o resto mora
  // no "Mais" (MAIS_NO_MENU diz quais não repetem lá).
  const links: [string, string][] = [
    [t.nav.disciplines, "/trilhas"],
    [t.nav.library, "/acervo"],
    [t.nav.journal, "/jornal"],
    [t.nav.podcasts, "/podcasts"],
    [t.nav.community, "/comunidade"],
    [t.nav.health, "/saude"],
    [t.nav.dedication, "/dedicatoria"],
  ];
  const item = "item-do-menu whitespace-nowrap border-b-4 py-2.5";
  // Passar o mouse por cima do "Mais" abre a janela depois de um instante (quem só atravessa o menu não a abre);
  // sair do botão sem entrar na janela fecha. Toque e teclado continuam pelo clique.
  const espera = useRef<number | undefined>(undefined);
  return (
    <>
      {links.map(([label, path]) => {
        const href = localePath(lang, path);
        const active = pathname === href || pathname.startsWith(`${href}/`) || (path === "/trilhas" && pathname.includes("/estantes/"));
        return (
          <Link key={path} href={href} aria-current={active ? "page" : undefined} className={`${item} ${active ? "border-[#c21f16] font-bold" : "border-transparent hover:border-[#c21f16]"}`}>
            {label}
            {path === "/podcasts" && novo && (
              <>
                <span aria-hidden className="ml-1 inline-block h-2 w-2 -translate-y-1.5 rounded-full bg-[#c21f16]" />
                <span className="sr-only"> · {t.radio.newEpisode}</span>
              </>
            )}
          </Link>
        );
      })}
      {/* "Mais" abre a janela flutuante com o resto do site; sem JavaScript, o link leva à página /explorar. */}
      <Link
        href={localePath(lang, "/explorar")}
        aria-haspopup="dialog"
        aria-current={pathname === localePath(lang, "/explorar") ? "page" : undefined}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          window.clearTimeout(espera.current);
          abrirMais();
        }}
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          window.clearTimeout(espera.current);
          espera.current = window.setTimeout(() => abrirMais(true), 220);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "mouse") return;
          window.clearTimeout(espera.current);
          window.dispatchEvent(new Event(SAIR_MAIS));
        }}
        className={`${item} inline-flex items-center gap-1.5 border-transparent hover:border-[#c21f16]`}
      >
        {t.nav.more}
        <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </Link>
    </>
  );
}

const raizes = ["", "trilhas", "acervo", "comunidade", "explorar"];

/**
 * Só no aplicativo: voltar à tela anterior. Lá não existe a seta do navegador, e as abas de baixo só levam às
 * cinco telas principais; em qualquer outra, a seta aparece no canto de cima.
 */
export function AppBack() {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, t } = useI18n();
  if (raizes.includes(pathname.split("/").slice(2).join("/"))) return null;
  return (
    <button
      type="button"
      aria-label={t.common.back}
      onClick={() => (window.history.length > 1 ? router.back() : router.push(`/${lang}`))}
      className="app-voltar -ml-2 hidden h-10 w-9 shrink-0 cursor-pointer items-center justify-center text-ink app:max-md:flex"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}

/** Só o primeiro nome, e curto: o cabeçalho tem de caber em uma linha no celular. */
const firstName = (name: string) => name.trim().split(/\s+/)[0].slice(0, 24);

/**
 * "Entrar" para quem não tem sessão; para quem tem, o rosto da conta (o ícone escolhido em Minha conta, ou a inicial)
 * que abre o menu da pessoa. O nome e o ícone ficam guardados no navegador para aparecer de imediato na próxima página.
 */
export function AccountLink() {
  const { lang, t } = useI18n();
  const hydrated = useHydrated();
  const session = useStored(KEYS.session);
  const saved = useStored(KEYS.name);
  const savedAvatar = useStored(KEYS.avatar);
  const me = useMe();
  // Antes do código do segundo fator a sessão ainda não é da pessoa: o cabeçalho não a cumprimenta nem guarda o nome.
  const confirmada = me.status === "in" && (!me.me.exige_segundo_fator || me.me.segundo_fator);
  const pendente = me.status === "in" && !confirmada;
  const loaded = confirmada ? firstName(me.me.nome) : "";
  const loadedAvatar = confirmada ? (me.me.avatar ?? "") : "";
  // Só guarda o nome e o ícone enquanto há sessão: depois do Sair, a resposta antiga do serviço não os escreve de volta.
  useEffect(() => {
    if (session && loaded && loaded !== saved) setItem(KEYS.name, loaded);
    else if (pendente && saved) setItem(KEYS.name, null);
  }, [session, loaded, saved, pendente]);
  useEffect(() => {
    if (session && confirmada && loadedAvatar !== savedAvatar) setItem(KEYS.avatar, loadedAvatar || null);
    else if (pendente && savedAvatar) setItem(KEYS.avatar, null);
  }, [session, confirmada, pendente, loadedAvatar, savedAvatar]);
  if (!hydrated) return null;
  const name = session && !pendente ? loaded || saved : "";
  if (!name) {
    return (
      <Link href={localePath(lang, session && !pendente ? "/painel" : "/entrar")} className="whitespace-nowrap font-sans text-xs text-ink-soft hover:text-oxblood sm:text-sm">
        {session && !pendente ? t.nav.panel : t.nav.signIn}
      </Link>
    );
  }
  return <MenuDaConta name={name} avatar={confirmada ? loadedAvatar : savedAvatar} />;
}

/** O rosto da conta no alto: a imagem subida, o ícone predefinido (em creme sobre o bordô) ou a inicial. */
function RostoDaConta({ name, avatar }: { name: string; avatar: string }) {
  const { lang } = useI18n();
  if (avatar.startsWith("data:image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatar} alt="" className="h-full w-full rounded-full object-cover" />;
  }
  const icone = avatar.startsWith("p:") ? AVATARES.find((a) => a.id === avatar.slice(2)) : null;
  if (icone) {
    return (
      <svg aria-hidden viewBox="0 0 24 24" className="h-[62%] w-[62%]" fill={icone.cheio ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={icone.d} />
      </svg>
    );
  }
  return <span aria-hidden>{[...name][0]?.toLocaleUpperCase(lang)}</span>;
}

/**
 * A conta no alto, como a foto de perfil de um aplicativo. O clique abre um menu curto com o "Olá, Fulano", os
 * caminhos da pessoa e o Sair, que apaga daqui o que é da conta (como o Sair do painel).
 */
function MenuDaConta({ name, avatar }: { name: string; avatar: string }) {
  const { lang, t } = useI18n();
  const pathname = usePathname();
  // O menu guarda em que página foi aberto: trocou de página, ele some sozinho.
  const [abertoEm, setAbertoEm] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);
  const aberto = abertoEm === pathname;
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAbertoEm(null);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbertoEm(null);
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);
  const sair = async () => {
    setSaindo(true);
    try {
      // O mesmo que o Sair do painel: o índice das conversas deste aparelho vai embora junto com a conta.
      const [{ limparIndice }, { travarAgora }] = await Promise.all([import("@/lib/busca-local"), import("@/lib/trava")]);
      await limparIndice().catch(() => undefined);
      travarAgora();
    } catch {
      // Sem o índice para apagar, sai do mesmo jeito.
    }
    // Sai e fica na mesma página: o site aberto não depende de conta (só o painel, que tem o próprio Sair).
    await signOut();
    setAbertoEm(null);
    setSaindo(false);
  };
  const itens: [string, string][] = [
    [t.nav.notebook, "/caderno"],
    [t.nav.myData, "/meus-dados"],
  ];
  return (
    <div ref={caixa} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbertoEm(aberto ? null : pathname)}
        aria-expanded={aberto}
        aria-haspopup="menu"
        aria-label={fill(t.nav.helloLabel, { name })}
        title={fill(t.nav.hello, { name })}
        className="conta-saudacao flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-ink bg-[#6e1f1a] font-serif text-xl font-semibold leading-none text-[#f4ecd8] hover:bg-[#c21f16] hover:text-white aria-expanded:shadow-[0_0_0_3px_var(--parchment),0_0_0_5px_#c21f16]"
      >
        <RostoDaConta name={name} avatar={avatar} />
      </button>
      {aberto && (
        <div role="menu" className="menu-da-conta absolute right-0 top-[calc(100%+0.6rem)] z-50 w-60 border-2 border-ink bg-folha font-sans text-[0.95rem] text-ink shadow-[6px_6px_0_var(--prelo)]">
          <p className="border-b border-rule px-4 pt-3.5 pb-3 font-serif text-[1.35rem] font-semibold leading-tight">{fill(t.nav.hello, { name })}</p>
          <Link role="menuitem" href={localePath(lang, "/painel")} className="flex items-center justify-between px-4 py-2.5 font-bold text-ink hover:bg-ink hover:text-parchment">
            {t.nav.panel} <span aria-hidden className="text-prelo-texto">→</span>
          </Link>
          {itens.map(([label, path]) => (
            <Link key={path} role="menuitem" href={localePath(lang, path)} className="block px-4 py-2.5 text-ink hover:bg-ink hover:text-parchment">
              {label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={() => void sair()}
            disabled={saindo}
            className="mt-1 flex w-full cursor-pointer items-center justify-between border-t border-rule px-4 pt-2.5 pb-3 text-left font-semibold text-prelo-texto hover:bg-[#c21f16] hover:text-white disabled:cursor-wait disabled:opacity-70"
          >
            {saindo ? t.nav.signingOut : t.nav.signOut}
            <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

/** Troca o idioma mantendo a pessoa na mesma página. */
export function LanguageSwitcher({ wide = false, globo = false }: { wide?: boolean; globo?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, t } = useI18n();
  const rest = pathname.split("/").slice(2).join("/");
  // "globo": no alto do computador aparece só o globo e a sigla; o seletor de verdade fica por cima, transparente,
  // e abre a lista com o nome de cada idioma escrito por inteiro.
  if (globo)
    return (
      <span className="relative flex h-11 items-center gap-1.5 px-1.5 font-mono text-[0.8rem] uppercase tracking-[0.08em] text-ink hover:text-oxblood">
        <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
        </svg>
        <span aria-hidden>{lang}</span>
        <select
          aria-label={t.common.language}
          value={lang}
          onChange={(e) => router.push(`/${e.target.value}${rest ? `/${rest}` : ""}`)}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {locales.map((code) => (
            <option key={code} value={code} lang={code}>
              {localeNames[code]}
            </option>
          ))}
        </select>
      </span>
    );
  return (
    <select
      aria-label={t.common.language}
      value={lang}
      onChange={(e) => router.push(`/${e.target.value}${rest ? `/${rest}` : ""}`)}
      // "wide": na página "Mais" do aplicativo o nome do idioma aparece inteiro, em letra de leitura.
      className={
        wide
          ? "min-h-10! cursor-pointer border border-rule bg-parchment px-2 py-1 font-sans text-sm! text-ink hover:border-gold"
          : "max-w-[4.75rem] cursor-pointer border border-rule bg-parchment px-1 py-1 font-mono text-xs text-ink-soft hover:border-gold sm:max-w-none sm:px-1.5"
      }
    >
      {locales.map((code) => (
        <option key={code} value={code} lang={code}>
          {localeNames[code]}
        </option>
      ))}
    </select>
  );
}

/** Atalho para a rádio, ao lado do botão de tema: um toque e a música começa. */
export function RadioLink() {
  const pathname = usePathname();
  const { lang, t } = useI18n();
  const href = localePath(lang, "/radio");
  const active = pathname === href;
  return (
    <Link
      href={href}
      aria-label={t.nav.radio}
      title={t.nav.radio}
      aria-current={active ? "page" : undefined}
      className={`flex h-8 w-7 shrink-0 items-center justify-center hover:text-oxblood sm:w-8 ${active ? "text-oxblood" : "text-ink-soft"}`}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="9" width="18" height="11" rx="1.5" />
        <path d="M7 9 17 4" />
        <circle cx="8.5" cy="14.5" r="2.5" />
        <path d="M14 13h4M14 16h4" />
      </svg>
    </Link>
  );
}

const NOVIDADE = "lucia:podcast-novidade";
const VISTO = "lucia:podcast-visto";

/**
 * Há episódio novo desde a última visita à página de podcasts? Consulta o banco no máximo a cada seis horas (a resposta
 * é só uma data) e compara com o que a pessoa já viu, guardado no próprio navegador.
 */
function useEpisodioNovo(): boolean {
  const [novo, setNovo] = useState(false);
  useEffect(() => {
    if (!hasBackend) return;
    let cancelado = false;
    const conferir = (ultimo: string | null) => {
      let visto = "";
      try {
        visto = localStorage.getItem(VISTO) ?? "";
      } catch {
        // sem armazenamento: sem aviso
      }
      if (!cancelado) setNovo(Boolean(ultimo && ultimo > visto && visto !== ""));
    };
    let guardado: { em: number; ultimo: string | null } | null = null;
    try {
      guardado = JSON.parse(localStorage.getItem(NOVIDADE) ?? "null");
    } catch {
      guardado = null;
    }
    if (guardado && Date.now() - guardado.em < 6 * 3600 * 1000) conferir(guardado.ultimo);
    else
      rpc<{ ultimo: string | null }>("podcast_novidade")
        .then((r) => {
          try {
            localStorage.setItem(NOVIDADE, JSON.stringify({ em: Date.now(), ultimo: r.ultimo }));
            // Primeira visita: marca o mais recente como visto, para o aviso valer só para o que sair depois.
            if (!localStorage.getItem(VISTO) && r.ultimo) localStorage.setItem(VISTO, r.ultimo);
          } catch {
            // sem armazenamento
          }
          conferir(r.ultimo);
        })
        .catch(() => {});
    const limpar = () => setNovo(false);
    window.addEventListener("lucia:podcast-visto", limpar);
    return () => {
      cancelado = true;
      window.removeEventListener("lucia:podcast-visto", limpar);
    };
  }, []);
  return novo;
}

/**
 * Atalho para o podcast, com um ponto vermelho quando saiu episódio novo desde a última visita. Só no celular:
 * no computador o menu do topo já tem "Podcasts", com o mesmo aviso.
 */
export function PodcastLink() {
  const pathname = usePathname();
  const { lang, t } = useI18n();
  const href = localePath(lang, "/podcasts");
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const novo = useEpisodioNovo();
  return (
    <Link
      href={href}
      aria-label={novo ? `${t.nav.podcasts} · ${t.radio.newEpisode}` : t.nav.podcasts}
      title={novo ? t.radio.newEpisode : t.nav.podcasts}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-8 w-7 shrink-0 items-center justify-center hover:text-oxblood sm:w-8 md:hidden ${active ? "text-oxblood" : "text-ink-soft"}`}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
        <rect x="3" y="14" width="4.5" height="6.5" rx="1.2" />
        <rect x="16.5" y="14" width="4.5" height="6.5" rx="1.2" />
      </svg>
      {novo && <span aria-hidden className="absolute right-0 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-parchment bg-[#c21f16]" />}
    </Link>
  );
}

/** Atalho para o giro de notícias do país, ao lado da rádio. */
export function NewsLink() {
  const pathname = usePathname();
  const { lang, t } = useI18n();
  const href = localePath(lang, "/noticias");
  const active = pathname === href;
  return (
    <Link
      href={href}
      aria-label={t.nav.news}
      title={t.nav.news}
      aria-current={active ? "page" : undefined}
      className={`max-[419px]:hidden flex h-8 w-7 shrink-0 items-center justify-center hover:text-oxblood sm:w-8 ${active ? "text-oxblood" : "text-ink-soft"}`}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 5h13v14H6a2 2 0 0 1-2-2z" />
        <path d="M17 9h3v8a2 2 0 0 1-2 2" />
        <path d="M7.5 9h6M7.5 12.5h6M7.5 16h3.5" />
      </svg>
    </Link>
  );
}
