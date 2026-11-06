// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { localePath } from "@/i18n/config";
import { getClient, hasSession } from "@/lib/backend";
import { avisos } from "@/lib/rede/cliente-avisos";
import type { TextosDaRede } from "@/lib/rede/textos";
import { enderecos, type Situacao } from "@/lib/rede/tipos";
import { enderecosDescoberta } from "@/lib/rede/tipos-descoberta";
import { EsqueletoDaCasca } from "./Esqueletos";
import { enderecoDoSite, MarcaDaAlumia } from "./MolduraDaAlumia";

/** Os destinos do menu (computador) e da barra de baixo (celular). `href` nulo = a tela ainda não existe: aparece apagado. */
export type ItemDoMenu = "inicio" | "comunidades" | "explorar" | "chamados" | "nucleos" | "avisos" | "salvos" | "fediverso" | "perfil";

interface Destino {
  chave: ItemDoMenu;
  icone: React.ReactNode;
  href: (lang: string, situacao: Situacao | null) => string | null;
}

// Cada pacote liga o seu destino aqui quando a rota dele existir (docs/rede/V2.md): avisos, salvos, chamados e núcleos.
const DESTINOS: Destino[] = [
  { chave: "inicio", icone: <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10" />, href: (l) => enderecos.linha(l) },
  { chave: "comunidades", icone: <path d="M4 5h16v11H10l-4.5 4v-4H4z" />, href: (l) => `${enderecos.linha(l)}/comunidades` },
  { chave: "explorar", icone: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z" />, href: (l) => enderecosDescoberta.explorar(l) },
  { chave: "chamados", icone: <path d="M5 4v16M5 5h13l-2.5 4 2.5 4H5" />, href: () => null },
  { chave: "nucleos", icone: <path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 20c0-3.5 3-6 7-6s7 2.5 7 6" />, href: (l) => `${enderecos.linha(l)}/nucleos` },
  { chave: "avisos", icone: <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20h4" />, href: (l) => `${enderecos.linha(l)}/avisos` },
  { chave: "salvos", icone: <path d="M6 4h12v16l-6-4-6 4z" />, href: (l, s) => (s?.logado ? `${enderecos.linha(l)}/salvos` : null) },
  // Alumia no Fediverso (docs/rede/FEDIVERSO.md): ligar a federação no perfil, achar e seguir @pessoa@instancia.
  { chave: "fediverso", icone: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 9h17M3.5 15h17M12 3c2.5 2.6 3.6 5.6 3.6 9s-1.1 6.4-3.6 9c-2.5-2.6-3.6-5.6-3.6-9S9.5 5.6 12 3z" />, href: (l) => `${enderecos.linha(l)}/fediverso` },
  { chave: "perfil", icone: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5" />, href: (l, s) => (s?.handle ? enderecos.perfil(l, s.handle) : `${enderecos.linha(l)}/editar-perfil`) },
];
/** A barra de baixo do celular: Início, Comunidades, Escrever (no meio), Avisos, Perfil. */
const BARRA: ItemDoMenu[] = ["inicio", "comunidades", "avisos", "perfil"];

function Icone({ children, ativo }: { children: React.ReactNode; ativo?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={ativo ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

/** "Sair rápido": apaga o que a Alumia guardou neste aparelho e vai para uma página neutra do site (a página inicial do instituto). */
function sairRapido(lang: string) {
  try {
    for (const armazem of [window.localStorage, window.sessionStorage]) {
      for (const chave of Object.keys(armazem)) if (chave.startsWith("lucia:rede")) armazem.removeItem(chave);
    }
  } catch {
    // sem armazenamento: nada para apagar
  }
  window.location.replace(enderecoDoSite(lang));
}

/** Sair da conta neste endereço (a sessão da Alumia é guardada à parte da do site: docs/rede/ALUMIA-DOMINIO.md). */
async function sairDaConta() {
  try {
    if (hasSession()) await (await getClient()).auth.signOut();
  } catch {
    // sem serviço: não havia sessão para encerrar
  }
  window.location.reload();
}

/**
 * A casca da Rede v2. Computador: três colunas (menu à esquerda, 640 px de leitura no meio, busca e segurança à direita).
 * Celular: uma coluna, busca no alto e barra de baixo (Início, Comunidades, Escrever, Avisos, Perfil); o botão Escrever abre a
 * tela cheia (components/rede/Escrever.tsx). A barra do site fica escondida enquanto a Rede está aberta, para não haver duas.
 * Enquanto a situação da pessoa não chegou, mostra o esqueleto da casca inteira (a página não pula quando os dados chegam).
 */
export function Casca({
  lang,
  s,
  situacao,
  ativo,
  aoEscrever,
  children,
}: {
  lang: string;
  s: TextosDaRede;
  situacao: Situacao | null;
  ativo: ItemDoMenu;
  aoEscrever: () => void;
  children: React.ReactNode;
}) {
  // O número de avisos não lidos (grupos) no menu e na barra de baixo; sem a migração de avisos no banco, fica sem número.
  const membroLogado = Boolean(situacao?.logado && situacao?.membro);
  const [naoLidos, setNaoLidos] = useState(0);
  useEffect(() => {
    if (!membroLogado) return;
    let vivo = true;
    avisos.contar().then((n) => { if (vivo && typeof n === "number") setNaoLidos(n); }, () => {});
    return () => { vivo = false; };
  }, [membroLogado, ativo]);
  if (!situacao) return <EsqueletoDaCasca rotulo={s.estados.carregando} />;
  const pode = situacao.logado && situacao.membro;
  const fraco = "pointer-events-none opacity-40";
  return (
    <div className="rede-lucia mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)] pb-[calc(4.5rem+var(--recuo-baixo,0px))] md:pb-0 xl:grid-cols-[250px_minmax(0,640px)_300px] xl:justify-center">
      {/* Enquanto a Rede está aberta, a barra de baixo do site sai de cena no celular. */}
      <style>{"@media (max-width: 767px) { .abas-do-celular { display: none !important; } }"}</style>
      <a href="#rede-linha" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-parchment focus:p-2">{s.casca.saltarParaConteudo}</a>

      <aside className="hidden px-5 py-6 xl:block" aria-label={s.menu.principal}>
        <div className="sticky top-[calc(var(--altura-topo,0px)+1rem)]">
          <p className="flex items-center gap-2 font-serif text-2xl font-extrabold"><MarcaDaAlumia className="h-7 w-7" />{s.marca}</p>
          <nav className="mt-4" aria-label={s.menu.principal}>
            <ul className="space-y-1">
              {DESTINOS.map((d) => {
                const href = d.href(lang, situacao);
                const classes = `flex min-h-11 items-center gap-3 rounded-full px-3 font-sans text-lg ${ativo === d.chave ? "bg-[#1f1a14] font-bold text-[#f4ecd8]" : "hover:bg-parchment-deep"}`;
                return (
                  <li key={d.chave}>
                    {href ? (
                      <Link href={href} className={classes} aria-current={ativo === d.chave ? "page" : undefined}>
                        <Icone ativo={ativo === d.chave}>{d.icone}</Icone>
                        {s.menu[d.chave]}
                        {d.chave === "avisos" && naoLidos > 0 && <Emblema n={naoLidos} />}
                      </Link>
                    ) : (
                      <span className={`${classes} ${fraco}`} aria-disabled="true">
                        <Icone>{d.icone}</Icone>
                        {s.menu[d.chave]}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
          {pode && (
            <button type="button" onClick={() => aoEscrever()} className="mt-4 min-h-12 w-full cursor-pointer rounded-full bg-[#c21f16] px-5 font-sans text-lg font-bold text-white hover:bg-[#1f1a14]">
              {s.menu.escrever}
            </button>
          )}
        </div>
      </aside>

      <main id="rede-linha" className="min-w-0 border-rule bg-parchment xl:border-x" aria-label={s.marca}>
        {/* No celular: a marca, a busca e o "sair rápido" ficam no alto, no lugar das colunas dos lados. */}
        <div className="flex items-center gap-2 border-b border-rule px-4 py-2 xl:hidden">
          <p className="flex items-center gap-1.5 font-serif text-lg font-extrabold"><MarcaDaAlumia className="h-5 w-5" />{s.marca}</p>
          <form action={localePath(lang, "/comunidade/buscar")} method="get" role="search" className="ml-auto min-w-0 flex-1">
            <label className="sr-only" htmlFor="rede-busca-celular">{s.menu.busca}</label>
            <input id="rede-busca-celular" name="q" type="search" placeholder={s.menu.busca} className="min-h-11 w-full rounded-full border border-rule bg-folha px-4 font-sans" />
          </form>
          <button type="button" onClick={() => sairRapido(lang)} className="min-h-11 shrink-0 cursor-pointer rounded-full border-[1.5px] border-ink px-3 font-sans text-sm font-bold" title={s.casca.sairRapidoAjuda}>
            {s.casca.sairRapido}
          </button>
        </div>
        {children}
      </main>

      <aside className="hidden px-5 py-6 xl:block" aria-label={s.menu.busca}>
        <div className="sticky top-[calc(var(--altura-topo,0px)+1rem)] space-y-4 font-sans">
          <form action={localePath(lang, "/comunidade/buscar")} method="get" role="search">
            <label className="sr-only" htmlFor="rede-busca">{s.menu.busca}</label>
            <input id="rede-busca" name="q" type="search" placeholder={s.menu.busca} className="min-h-11 w-full rounded-full border border-rule bg-folha px-4" />
          </form>
          <div className="rounded-[14px] bg-[#1f1a14] p-4 text-sm text-[#f4ecd8] shadow-[5px_5px_0_#c21f16]">
            <p>{s.casca.cartaoSeguranca}</p>
            <p className="mt-2 text-xs opacity-80">{s.denuncia.sigilo}</p>
          </div>
          {pode && (
            <nav aria-label={s.casca.cuidados.titulo}>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {[
                  ["cuidado", s.casca.cuidados.regras],
                  ["denuncias", s.casca.cuidados.denuncias],
                  ["silenciados", s.casca.cuidados.silenciados],
                  ...(situacao.cuida ? [["moderacao", s.casca.cuidados.moderacao]] : []),
                ].map(([rota, texto]) => (
                  <li key={rota}>
                    <Link href={localePath(lang, `/comunidade/${rota}`)} className="inline-flex min-h-11 items-center underline">{texto}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <button type="button" onClick={() => sairRapido(lang)} className="min-h-11 w-full cursor-pointer rounded-full border-[1.5px] border-ink px-4 text-sm font-bold hover:bg-parchment-deep" title={s.casca.sairRapidoAjuda}>
            {s.casca.sairRapido}
          </button>
          <p className="text-xs text-ink-soft">{s.casca.sairRapidoAjuda}</p>
          {situacao.logado && (
            <button type="button" onClick={() => void sairDaConta()} className="min-h-11 w-full cursor-pointer rounded-full px-4 text-sm underline hover:bg-parchment-deep">
              {s.alumia.sairDaConta}
            </button>
          )}
        </div>
      </aside>

      {/* A barra de baixo do celular. */}
      <nav aria-label={s.menu.barra} className="no-print fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-[#c21f16] bg-[#1f1a14] pb-[var(--recuo-baixo,0px)] md:hidden">
        <ul className="grid grid-cols-5">
          {BARRA.slice(0, 2).map((chave) => (
            <ItemDaBarra key={chave} chave={chave} lang={lang} s={s} situacao={situacao} ativo={ativo} naoLidos={naoLidos} />
          ))}
          <li>
            <button
              type="button"
              onClick={() => aoEscrever()}
              disabled={!pode}
              aria-label={s.menu.escrever}
              className="mx-auto -mt-4 grid h-14 w-14 cursor-pointer place-items-center rounded-full bg-[#c21f16] text-white shadow-[0_2px_0_#000] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </li>
          {BARRA.slice(2).map((chave) => (
            <ItemDaBarra key={chave} chave={chave} lang={lang} s={s} situacao={situacao} ativo={ativo} naoLidos={naoLidos} />
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** O número de avisos não lidos, em bolinha (99+ no teto). */
function Emblema({ n }: { n: number }) {
  return <span className="ml-auto grid min-w-6 place-items-center rounded-full bg-[#c21f16] px-1.5 text-xs font-bold leading-6 text-white">{n > 99 ? "99+" : n}</span>;
}

function ItemDaBarra({ chave, lang, s, situacao, ativo, naoLidos }: { chave: ItemDoMenu; lang: string; s: TextosDaRede; situacao: Situacao; ativo: ItemDoMenu; naoLidos: number }) {
  const d = DESTINOS.find((x) => x.chave === chave);
  if (!d) return null;
  const href = d.href(lang, situacao);
  const classes = `flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 font-sans text-[0.7rem] leading-tight ${ativo === chave ? "bg-[#c21f16] font-bold text-white" : "text-[#f4ecd8]"}`;
  const conteudo = (
    <>
      <Icone ativo={ativo === chave}>{d.icone}</Icone>
      <span className="max-w-full truncate">
        {s.menu[chave]}
        {chave === "avisos" && naoLidos > 0 && <span className="ml-1 font-bold text-[#f0a79f]">({naoLidos > 99 ? "99+" : naoLidos})</span>}
      </span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className={classes} aria-current={ativo === chave ? "page" : undefined}>
          {conteudo}
        </Link>
      ) : (
        <span className={`${classes} opacity-40`} aria-disabled="true">
          {conteudo}
        </span>
      )}
    </li>
  );
}
