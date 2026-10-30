// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { localePath } from "@/i18n/config";
import type { SecaoDoSite } from "@/lib/secoes-do-site";
import { site } from "@/lib/site";
import { normalize } from "@/lib/text";
import { KEYS, setItem, useStored } from "@/lib/storage";
import { abrirAcessibilidade } from "./A11yWidget";
import { useI18n } from "./I18n";
import { Ladrilhos } from "./celular/Atalhos";
import { ABRIR_MAIS, LanguageSwitcher, MAIS_NO_MENU, SAIR_MAIS } from "./NavLinks";

const USADOS = "lucia:mais-usados";

/** Quem somos, as regras e os dados da pessoa: no computador vão para a linha miúda do pé da janela, não para as colunas. */
const NO_RODAPE = ["/sobre", "/quem-somos", "/dedicatoria", "/conduta", "/uso", "/direitos-autorais", "/privacidade", "/termos", "/meus-dados"];

function lerUsados(): Record<string, number> {
  try {
    const valor = JSON.parse(localStorage.getItem(USADOS) ?? "{}");
    return valor && typeof valor === "object" ? valor : {};
  } catch {
    return {};
  }
}

function contarUso(path: string) {
  try {
    const usados = lerUsados();
    usados[path] = (usados[path] ?? 0) + 1;
    localStorage.setItem(USADOS, JSON.stringify(usados));
  } catch {
    // sem armazenamento, sem lembrança
  }
}

/**
 * O "Mais" numa janela só, sem rolagem infinita: todas as seções que não cabem no menu, por objetivo, em colunas,
 * com uma busca no alto e, quando houver, as três que a pessoa mais abre (lembradas só neste aparelho).
 * No celular vira uma folha de tela inteira com os grupos recolhidos.
 */
export interface TextosDoMais {
  titulo: string;
  busca: string;
  maisUsadas: string;
  rodape: string;
  instagram: string;
  comeceAqui: string;
  comeceTexto: string;
  sigaTexto: string;
  apoieTexto: string;
  apoie: string;
  lembranca: string;
}

/** A conta no alto da folha do celular: quem entrou vê o nome e o caminho do painel; quem não entrou, o "Entrar". */
function ContaNoMais({ aoAbrir }: { aoAbrir: (path: string) => void }) {
  const { lang, t } = useI18n();
  const sessao = useStored(KEYS.session);
  const nome = useStored(KEYS.name);
  const path = sessao ? "/painel" : "/entrar";
  return (
    <Link href={localePath(lang, path)} onClick={() => aoAbrir(path)} className="flex items-center gap-3 rounded-[1.15rem] border-[1.5px] border-[#1f1a14] bg-[#1f1a14] px-3.5 py-3 text-[#f4ecd8] shadow-[3px_3px_0_#c21f16] hover:text-[#f4ecd8]">
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[#d4a24c] bg-[#6e1f1a] font-serif text-xl font-semibold">
        {sessao && nome ? [...nome][0]?.toLocaleUpperCase(lang) : "★"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-sans text-base font-bold">{sessao && nome ? nome : t.nav.signIn}</span>
        {sessao && <span className="block truncate font-sans text-[0.8rem] text-[#d9ccac]">{t.nav.openPanel}</span>}
      </span>
      <span aria-hidden className="font-sans text-2xl leading-none">›</span>
    </Link>
  );
}

/** Claro ou escuro, como o botão do cabeçalho do computador, numa chave de duas posições. */
function TemaNoMais() {
  const { t } = useI18n();
  const [escuro, setEscuro] = useState(false);
  useEffect(() => {
    const raiz = document.documentElement;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o tema só existe no navegador
    setEscuro((raiz.getAttribute("data-theme") ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark");
  }, []);
  const escolher = (valor: "light" | "dark") => {
    document.documentElement.setAttribute("data-theme", valor);
    setItem(KEYS.theme, valor);
    setEscuro(valor === "dark");
  };
  const opcao = "h-9 flex-1 cursor-pointer rounded-full border-0 font-sans text-[0.82rem] font-bold";
  return (
    <div role="group" aria-label={t.celular.tema} className="flex flex-1 rounded-full border-[1.5px] border-ink bg-folha p-1">
      <button type="button" aria-pressed={!escuro} onClick={() => escolher("light")} className={`${opcao} ${escuro ? "bg-transparent text-ink" : "bg-ink text-parchment"}`}>
        {t.celular.claro}
      </button>
      <button type="button" aria-pressed={escuro} onClick={() => escolher("dark")} className={`${opcao} ${escuro ? "bg-ink text-parchment" : "bg-transparent text-ink"}`}>
        {t.celular.escuro}
      </button>
    </div>
  );
}

export function MaisGaveta({ secoes, textos }: { secoes: SecaoDoSite[]; textos: TextosDoMais }) {
  const { lang, t } = useI18n();
  const pathname = usePathname();
  // A janela guarda em que página foi aberta: trocou de página, ela some sozinha (sem efeito que feche).
  const [abertaEm, setAbertaEm] = useState<string | null>(null);
  const aberta = abertaEm !== null && abertaEm === pathname;
  const setAberta = (valor: boolean) => setAbertaEm(valor ? pathname : null);
  // Aberta pelo mouse (passando por cima do "Mais"): não puxa o foco nem trava a página, e fecha sozinha um instante
  // depois que o mouse sai do botão e da janela. Pelo clique, pelo teclado ou pelo toque, é a janela de sempre.
  const [peloMouse, setPeloMouse] = useState(false);
  const [topo, setTopo] = useState(0);
  const fechar = useRef<number | undefined>(undefined);
  const cancelarFechar = () => window.clearTimeout(fechar.current);
  const fecharLogo = () => {
    cancelarFechar();
    fechar.current = window.setTimeout(() => setAbertaEm(null), 380);
  };
  const pathnameAtual = useRef(pathname);
  const abertaRef = useRef(false);
  useEffect(() => {
    pathnameAtual.current = pathname;
    abertaRef.current = aberta;
  }, [pathname, aberta]);
  const [busca, setBusca] = useState("");
  const [usados, setUsados] = useState<Record<string, number>>({});
  const campo = useRef<HTMLInputElement>(null);
  const antes = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const abrir = (e: Event) => {
      const mouse = Boolean((e as CustomEvent<{ mouse?: boolean }>).detail?.mouse);
      window.clearTimeout(fechar.current);
      // Já aberta: passar o mouse não muda nada; um clique a torna a janela de sempre, com o foco na busca.
      if (abertaRef.current) {
        if (!mouse) setPeloMouse(false);
        return;
      }
      antes.current = document.activeElement as HTMLElement | null;
      setUsados(lerUsados());
      setBusca("");
      setPeloMouse(mouse);
      // Onde termina o cabeçalho agora (a faixa de avisos acima dele rola com a página): a janela abre logo abaixo.
      setTopo(Math.round(document.querySelector(".cabecalho-site")?.getBoundingClientRect().bottom ?? 0));
      setAbertaEm(pathnameAtual.current);
    };
    const sair = () => {
      window.clearTimeout(fechar.current);
      fechar.current = window.setTimeout(() => setAbertaEm(null), 380);
    };
    window.addEventListener(ABRIR_MAIS, abrir);
    window.addEventListener(SAIR_MAIS, sair);
    return () => {
      window.removeEventListener(ABRIR_MAIS, abrir);
      window.removeEventListener(SAIR_MAIS, sair);
      window.clearTimeout(fechar.current);
    };
  }, []);

  useEffect(() => {
    if (!aberta || peloMouse) return;
    const raiz = document.documentElement;
    raiz.style.setProperty("overflow", "hidden");
    const foco = window.setTimeout(() => campo.current?.focus(), 30);
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbertaEm(null);
    };
    window.addEventListener("keydown", tecla);
    return () => {
      raiz.style.removeProperty("overflow");
      window.clearTimeout(foco);
      window.removeEventListener("keydown", tecla);
      antes.current?.focus?.();
    };
  }, [aberta, peloMouse]);

  // Aberta pelo mouse, o Esc também fecha.
  useEffect(() => {
    if (!aberta || !peloMouse) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbertaEm(null);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberta, peloMouse]);

  const termo = normalize(busca.trim());
  const filtradas = useMemo(
    () => secoes.map((s) => ({ ...s, items: s.items.filter((i) => !termo || normalize(`${i.label} ${i.description}`).includes(termo)) })).filter((s) => s.items.length > 0),
    [secoes, termo],
  );
  // No computador as colunas não repetem o menu do topo nem o que vai para o pé da janela; com busca, entra tudo.
  const colunas = useMemo(
    () => filtradas.map((s) => ({ ...s, items: termo ? s.items : s.items.filter((i) => !MAIS_NO_MENU.includes(i.path) && !NO_RODAPE.includes(i.path)) })).filter((s) => s.items.length > 0),
    [filtradas, termo],
  );
  const rodape = useMemo(() => secoes.flatMap((s) => s.items).filter((i) => NO_RODAPE.includes(i.path)), [secoes]);
  const todas = useMemo(() => secoes.flatMap((s) => s.items), [secoes]);
  const preferidas = Object.entries(usados)
    .sort((a, b) => b[1] - a[1])
    .map(([path]) => todas.find((item) => item.path === path))
    .filter((item): item is SecaoDoSite["items"][number] => Boolean(item))
    .slice(0, 3);

  if (!aberta) return null;

  const ir = (path: string) => contarUso(path);

  return (
    <div
      style={{ "--fim-do-topo": `${topo}px` } as React.CSSProperties}
      className={`mais-veu no-print fixed inset-x-0 bottom-0 z-50 flex items-start justify-center md:px-4 ${
        peloMouse ? "top-0 bg-[#1f1a14]/20 md:top-[var(--fim-do-topo)] md:pt-2" : "top-0 bg-[#1f1a14]/45 md:pt-[calc(var(--fim-do-topo)+0.5rem)]"
      }`}
      onClick={() => setAberta(false)}
    >
      <div
        role="dialog"
        aria-modal={peloMouse ? undefined : "true"}
        aria-label={textos.titulo}
        onClick={(e) => e.stopPropagation()}
        onPointerEnter={(e) => e.pointerType === "mouse" && cancelarFechar()}
        onPointerLeave={(e) => peloMouse && e.pointerType === "mouse" && fecharLogo()}
        className="mais-janela flex h-full w-full max-w-[78rem] flex-col border-ink bg-folha text-ink md:h-auto md:max-h-[calc(100dvh-var(--fim-do-topo)-1.5rem)] md:border-2 md:shadow-[8px_8px_0_var(--prelo)]"
      >
        <div className="flex items-center gap-3 border-b-2 border-ink px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-3 md:px-7 md:pt-5 md:pb-4">
          <label className="flex min-w-0 flex-1 items-center gap-2.5 border-2 border-ink bg-parchment px-3">
            <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="M15.5 15.5 20 20" />
            </svg>
            <span className="sr-only">{t.lists.find}</span>
            <input
              ref={campo}
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              maxLength={60}
              placeholder={textos.busca}
              className="min-w-0 flex-1 bg-transparent py-2.5 font-sans text-base outline-none placeholder:text-ink-soft"
            />
          </label>
          <button type="button" onClick={() => setAberta(false)} aria-label={t.a11y.close} className="botao botao-papel h-11 w-11 shrink-0 p-0">
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] md:px-7 md:pt-5">
          {filtradas.length === 0 && <p className="py-6 text-lg text-ink-soft">{t.lists.none}</p>}

          {/* No computador: uma linha de atalhos (o que a pessoa mais abre, ou por onde começar) e as seções em quatro
              colunas, só com os nomes; a descrição fica na dica. Nada que já esteja no menu do topo se repete aqui. */}
          <div className="hidden md:block">
            {!termo && preferidas.length > 0 && (
              <p className="mb-5 flex flex-wrap items-center gap-2 border-b border-rule pb-4">
                <span className="mr-2 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-prelo-texto">{textos.maisUsadas}</span>
                {preferidas.map((item) => (
                  <Link key={item.path} href={localePath(lang, item.path)} onClick={() => ir(item.path)} className="bg-ink px-3.5 py-1.5 font-sans text-sm font-semibold text-parchment hover:bg-[#c21f16] hover:text-white">
                    {item.label}
                  </Link>
                ))}
              </p>
            )}
            <div className="gap-x-9 md:columns-3 lg:columns-4">
              {colunas.map((secao, i) => (
                <nav key={secao.title} aria-label={secao.title} className="mb-6">
                  <p className={`mb-2 break-after-avoid border-b-2 pb-1.5 font-mono text-[0.72rem] uppercase tracking-[0.18em] ${i === 1 ? "border-[#c21f16] text-prelo-texto" : "border-ink"}`}>{secao.title}</p>
                  <ul>
                    {secao.items.map((item) => (
                      <li key={item.path} className="break-inside-avoid">
                        <Link
                          href={localePath(lang, item.path)}
                          onClick={() => ir(item.path)}
                          title={item.description}
                          className="mais-item block py-[0.32rem] font-sans text-[0.95rem] font-medium text-ink underline-offset-4 hover:text-prelo-texto hover:underline"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
          </div>

          {/* No celular: a conta, os ladrilhos do dia a dia, o que a pessoa mais abre e cada grupo numa lista de aplicativo
              (o primeiro aberto, os outros recolhidos; com busca, todos abertos). No fim, o tema, o idioma e o apoio. */}
          <div className="mais-do-celular space-y-5 md:hidden">
            {!termo && <ContaNoMais aoAbrir={ir} />}
            {!termo && <Ladrilhos chaves={["radio", "podcasts", "journal", "news", "glossary", "labs", "questionBank", "health"]} rotulo={t.celular.atalhos} aoAbrir={ir} />}
            {preferidas.length > 0 && !termo && (
              <p className="flex flex-wrap items-center gap-2">
                <span className="rotulo mr-1">{textos.maisUsadas}</span>
                {preferidas.map((item) => (
                  <Link key={item.path} href={localePath(lang, item.path)} onClick={() => ir(item.path)} className="chip rounded-full font-semibold">
                    {item.label}
                  </Link>
                ))}
              </p>
            )}
            {filtradas.map((secao, i) => (
              <details key={secao.title} open={Boolean(termo) || i === 0} className="lista-de-app group">
                <summary className="linha-de-app cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="flex-1 font-mono text-[0.72rem] font-medium uppercase tracking-[0.16em] text-prelo-texto">{secao.title}</span>
                  <span className="font-mono text-xs text-ink-soft">{secao.items.length}</span>
                  <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 text-ink-soft transition-transform group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </summary>
                <ul>
                  {secao.items.map((item) => (
                    <li key={item.path} className="border-t border-[var(--cel-fio)]">
                      <Link href={localePath(lang, item.path)} onClick={() => ir(item.path)} className="linha-de-app">
                        <span className="min-w-0 flex-1">
                          <span className="block leading-snug">{item.label}</span>
                          {item.short && <span className="mt-0.5 block truncate text-[0.78rem] font-normal text-ink-soft">{item.short}</span>}
                        </span>
                        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-ink-soft" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            {!termo && (
              <div className="flex flex-wrap items-center gap-2.5">
                <TemaNoMais />
                <label className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-ink bg-folha px-3 font-sans text-sm font-bold [&_select]:max-w-[7.5rem] [&_select]:border-0 [&_select]:bg-transparent">
                  <span className="sr-only">{t.common.language}</span>
                  <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
                  </svg>
                  <LanguageSwitcher wide />
                </label>
                {/* No aplicativo, o painel de acessibilidade mora aqui (o botão redondo não flutua por cima do conteúdo). */}
                <button
                  type="button"
                  onClick={() => {
                    setAbertaEm(null);
                    window.setTimeout(abrirAcessibilidade, 50);
                  }}
                  className="hidden h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-ink bg-folha px-4 font-sans text-sm font-bold app:flex"
                >
                  <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="4.5" r="1.5" fill="currentColor" />
                    <path d="M5 8.5c4.5 1.5 9.5 1.5 14 0M12 9.5v5.5m0 0-3.5 6m3.5-6 3.5 6" />
                  </svg>
                  {t.a11y.button}
                </button>
              </div>
            )}
            {!termo && (
              <div className="grid grid-cols-2 gap-2.5">
                <a href={site.instagram} target="_blank" rel="noopener noreferrer me" className="botao botao-instagram-cor h-12 w-full gap-2 text-sm">
                  @{site.instagramUser}
                </a>
                <Link href={localePath(lang, "/apoie")} onClick={() => ir("/apoie")} className="botao botao-prelo h-12 w-full">
                  {textos.apoie}
                </Link>
              </div>
            )}
          </div>

          <p className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-3 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-ink-soft">
            <span className="md:hidden">{textos.rodape}</span>
            <span className="hidden flex-wrap gap-x-4 gap-y-1 font-sans text-[0.8rem] normal-case tracking-normal md:flex">
              {rodape.map((item) => (
                <Link key={item.path} href={localePath(lang, item.path)} onClick={() => ir(item.path)} className="text-ink-soft hover:text-prelo-texto hover:underline">
                  {item.label}
                </Link>
              ))}
            </span>
            <a href={site.instagram} target="_blank" rel="noopener noreferrer me" className="text-ink underline hover:text-prelo-texto">
              {textos.instagram} · @{site.instagramUser} ↗
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
