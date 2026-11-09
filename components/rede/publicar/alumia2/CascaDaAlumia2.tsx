// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { htmlLang, localeNames, localePath, locales } from "@/i18n/config";
import { getClient, hasSession } from "@/lib/backend";
import { avisos } from "@/lib/rede/cliente-avisos";
import { redePub } from "@/lib/rede/cliente-publicar";
import { preencher } from "@/lib/rede/preencher";
import { enderecoNoFediverso } from "@/lib/rede/publicar/alumia2";
import { encaixeAtivo } from "@/lib/rede/rota-alumia";
import { sairRapido as sairRapidoDaRede } from "@/lib/rede/saida";
import type { TextosDaRede } from "@/lib/rede/textos";
import { enderecos, type Situacao } from "@/lib/rede/tipos";
import { enderecosDescoberta } from "@/lib/rede/tipos-descoberta";
import type { ItemDoMenu } from "../../Casca";
import { ENCAIXES } from "../../encaixes";
import { EsqueletoDaCasca } from "../../Esqueletos";
import { enderecoDoSite } from "../../VoltarAoSite";
import { Avatar16 } from "../../ui/Avatar16";
import { Faixa } from "../../ui/Faixa";
import { Lampiao } from "../../ui/Lampiao";
import { useAlumia2 } from "./contexto";
import { Icone, type NomeDoIcone } from "./icones";
import { AoVivoDuble, AtosPertoDuble, ComunidadesAtivasDuble } from "./previa/Dubles";

/** O que a casca nova sabe abrir no compositor: o tipo já escolhido (o "Chamar ato" do compositor da linha abre no Ato). */
export type TipoAoEscrever = "post" | "ato" | "enquete" | "longo" | "imagem";

type Chave = Extract<ItemDoMenu, "inicio" | "explorar" | "chamados" | "comunidades" | "nucleos" | "avisos" | "conversas" | "salvos" | "perfil">;

interface Destino {
  chave: Chave;
  icone: NomeDoIcone;
  rotulo: (t: NonNullable<ReturnType<typeof useAlumia2>>["t"]) => string;
  href: (lang: string, s: Situacao) => string | null;
}

// O menu das pranchas (computador-inicio), na ordem delas. "chamados" é o item Atos: a F2 troca o destino pelo encaixe; sem ela,
// vai para /alumia/atos (a rota nova da F0, que só existe com "alumia-2", a mesma flag desta casca).
const DESTINOS: Destino[] = [
  { chave: "inicio", icone: "inicio", rotulo: (t) => t.menu.inicio, href: (l) => enderecos.linha(l) },
  { chave: "explorar", icone: "explorar", rotulo: (t) => t.menu.explorar, href: (l) => enderecosDescoberta.explorar(l) },
  { chave: "chamados", icone: "atos", rotulo: (t) => t.menu.atos, href: (l) => `${enderecos.linha(l)}/atos` },
  { chave: "comunidades", icone: "comunidades", rotulo: (t) => t.menu.comunidades, href: (l) => `${enderecos.linha(l)}/comunidades` },
  { chave: "nucleos", icone: "nucleos", rotulo: (t) => t.menu.nucleos, href: (l) => `${enderecos.linha(l)}/nucleos` },
  { chave: "avisos", icone: "avisos", rotulo: (t) => t.menu.avisos, href: (l) => `${enderecos.linha(l)}/avisos` },
  { chave: "conversas", icone: "conversas", rotulo: (t) => t.menu.conversas, href: (l, s) => (s.logado ? `${enderecos.linha(l)}/conversas` : null) },
  { chave: "salvos", icone: "salvos", rotulo: (t) => t.menu.salvos, href: (l, s) => (s.logado ? `${enderecos.linha(l)}/salvos` : null) },
  { chave: "perfil", icone: "perfil", rotulo: (t) => t.menu.perfil, href: (l, s) => (s.handle ? enderecos.perfil(l, s.handle) : s.logado ? `${enderecos.linha(l)}/editar-perfil` : null) },
];

/** A barra de baixo do celular (prancha celular-inicio): Início, Explorar, [+], Atos, Perfil. */
const BARRA: Chave[] = ["inicio", "explorar", "chamados", "perfil"];

function hrefDe(d: Destino, lang: string, s: TextosDaRede, situacao: Situacao): string | null {
  const troca = ENCAIXES.menu.find((m) => m.substitui === d.chave);
  return troca ? troca.href({ lang, s, situacao }) : d.href(lang, situacao);
}

function emblemaDe(chave: Chave, lang: string, s: TextosDaRede, situacao: Situacao): number | null {
  const troca = ENCAIXES.menu.find((m) => m.substitui === chave);
  return troca?.emblema?.({ lang, s, situacao }) ?? null;
}

async function sairDaConta() {
  try {
    if (hasSession()) await (await getClient()).auth.signOut();
  } catch {
    // sem serviço: não havia sessão para encerrar
  }
  window.location.reload();
}

/**
 * A casca da Alumia nova (flag "alumia-2"; pranchas computador-inicio e celular-inicio). Computador (≥ 1024 px): menu à esquerda
 * com a marca (lampião, ALUMIA, Instituto Lúcia), os nove destinos, Escrever, a conta com o endereço do Fediverso e Sair rápido;
 * coluna do meio; coluna da direita com busca, o que as frentes encaixam (ao vivo, atos perto, comunidades ativas) e o cartão do
 * Fediverso. Celular: marca, busca e avisos no alto; barra de baixo Início, Explorar, +, Atos, Perfil. Nada de lista de pessoas;
 * os números dos emblemas são agregados (avisos não lidos da própria pessoa).
 */
export function CascaDaAlumia2({
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
  aoEscrever: (tipo?: TipoAoEscrever) => void;
  children: React.ReactNode;
}) {
  const al2 = useAlumia2();
  const caminho = usePathname() ?? "";
  const membroLogado = Boolean(situacao?.logado && situacao?.membro);
  const [naoLidos, setNaoLidos] = useState(0);
  const [doBanco, setDoBanco] = useState<{ conversas: number; atos: number } | null>(null);
  useEffect(() => {
    if (!membroLogado || al2?.previa) return;
    let vivo = true;
    // Os emblemas numa chamada só (rede_alumia_emblemas, só números da própria pessoa); num banco sem a F1, só os avisos, como hoje.
    redePub
      .emblemas()
      .then(
        (e) => {
          if (!vivo || !e) return;
          if (typeof e.avisos === "number") setNaoLidos(e.avisos);
          setDoBanco({ conversas: Number(e.conversas) || 0, atos: Number(e.atos) || 0 });
        },
        () => avisos.contar().then((n) => vivo && typeof n === "number" && setNaoLidos(n)),
      )
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [membroLogado, ativo, al2?.previa]);

  if (!situacao || !al2) return <EsqueletoDaCasca rotulo={s.estados.carregando} />;
  const { t, previa } = al2;
  const pode = situacao.logado && situacao.membro;
  // Na prévia, os números das pranchas (Avisos 5, Atos 2); de verdade, os da própria pessoa (e o dos atos vem da F2).
  const avisosN = previa ? 5 : naoLidos;
  // Atos: o número da F2 (encaixe) quando ela chega; até lá, os atos que a própria pessoa confirmou e ainda vão acontecer.
  const emblemas: Partial<Record<Chave, number | null>> = {
    avisos: avisosN,
    conversas: previa ? null : (doBanco?.conversas ?? null),
    chamados: previa ? 2 : (emblemaDe("chamados", lang, s, situacao) ?? doBanco?.atos ?? null),
  };
  const sairRapido = () => void sairRapidoDaRede(enderecoDoSite(lang), ENCAIXES.aoSairRapido);
  const atualDe = (d: Destino, href: string | null) => ativo === d.chave || (href !== null && d.chave !== "inicio" && encaixeAtivo(href, caminho));
  const ctx = { lang, s, situacao };
  const direitaEncaixada = ENCAIXES.colunaDireita;

  return (
    <div className="al2 min-h-screen bg-[var(--al-fundo)]">
      <Faixa />
      <a href="#rede-linha" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-[var(--al-fundo)] focus:p-2">{s.casca.saltarParaConteudo}</a>
      <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)] pb-[calc(4.75rem+var(--recuo-baixo,0px))] lg:grid-cols-[250px_minmax(0,600px)_300px] lg:justify-center lg:pb-0 xl:grid-cols-[290px_minmax(0,600px)_330px]">
        {/* ───── Menu (computador) ───── */}
        {/* Sem rótulo próprio: o ponto de referência é o <nav> dentro (dois rótulos iguais confundem o leitor de tela). */}
        <div className="hidden border-r border-[var(--al-linha)] px-5 lg:block">
          <div className="sticky top-0 flex min-h-[calc(100vh-6px)] flex-col py-6">
            <Link href={enderecos.linha(lang)} className="flex items-center gap-3 px-2" aria-label={t.marca.inicio}>
              <Lampiao tamanho={34} />
              <span className="leading-none">
                <span className="al-cond block text-[2rem] font-black uppercase tracking-tight">{t.marca.nome}</span>
                <span className="block font-[family-name:var(--al-fonte-marca)] text-[0.95rem] italic text-[var(--al-texto-2)]">{t.marca.instituto}</span>
              </span>
            </Link>
            <nav className="mt-6" aria-label={t.menu.principal}>
              <ul className="space-y-0.5">
                {DESTINOS.map((d) => {
                  const href = hrefDe(d, lang, s, situacao);
                  const atual = atualDe(d, href);
                  const n = emblemas[d.chave] ?? null;
                  const conteudo = (
                    <>
                      <Icone nome={d.icone} className="h-[22px] w-[22px]" grosso={atual} />
                      <span>{d.rotulo(t)}</span>
                      {n !== null && n > 0 && (
                        <span className={`al2-emblema ${d.chave === "avisos" ? "al2-emblema-vermelho" : "al2-emblema-dourado"}`}>
                          <span aria-hidden>{n > 99 ? "99+" : n}</span>
                          <span className="sr-only">{preencher(d.chave === "avisos" ? t.menu.avisosNovos : t.menu.emblema, { n })}</span>
                        </span>
                      )}
                    </>
                  );
                  return (
                    <li key={d.chave}>
                      {href ? (
                        <Link href={href} className="al2-menu-item" aria-current={atual ? "page" : undefined}>
                          {conteudo}
                        </Link>
                      ) : (
                        <span className="al2-menu-item" aria-disabled="true" title={t.menu.entreParaUsar}>
                          {conteudo}
                          <span className="ml-auto text-[0.65rem] font-bold">{t.menu.entreParaUsar}</span>
                        </span>
                      )}
                    </li>
                  );
                })}
                {/* Itens novos que as frentes encaixam (sem "substitui"). */}
                {ENCAIXES.menu
                  .filter((m) => !m.substitui)
                  .map((m) => {
                    const href = m.href(ctx);
                    if (!href) return null;
                    const n = m.emblema?.(ctx) ?? null;
                    return (
                      <li key={m.chave}>
                        <Link href={href} className="al2-menu-item" aria-current={encaixeAtivo(href, caminho) ? "page" : undefined}>
                          <svg aria-hidden viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            {m.icone}
                          </svg>
                          <span>{m.rotulo(ctx)}</span>
                          {n !== null && n > 0 && <span className="al2-emblema al2-emblema-dourado">{n}</span>}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </nav>
            {pode && (
              <button type="button" onClick={() => aoEscrever()} className="al-botao al-botao-primario al-botao-g mt-6 w-full">
                <Icone nome="escrever" className="h-5 w-5" />
                {t.menu.escrever}
              </button>
            )}
            <div className="mt-auto space-y-3 pt-8">
              <Conta lang={lang} s={s} situacao={situacao} />
              <button type="button" onClick={sairRapido} className="al-botao al-botao-contorno al-botao-m w-full" title={t.conta.sairRapidoAjuda}>
                {t.conta.sairRapido}
              </button>
            </div>
          </div>
        </div>

        {/* ───── Coluna do meio ───── */}
        <main id="rede-linha" className="min-w-0 border-[var(--al-linha)] lg:border-r" aria-label={t.linha.titulo}>
          {/* Celular: marca, busca, avisos e Sair rápido no alto (prancha celular-inicio). */}
          <header className="flex items-center gap-2 px-4 pb-1 pt-4 lg:hidden">
            <Link href={enderecos.linha(lang)} className="flex min-w-0 items-center gap-2.5" aria-label={t.marca.inicio}>
              <Lampiao tamanho={30} />
              <span className="leading-none">
                <span className="al-cond block text-[1.75rem] font-black uppercase tracking-tight">{t.marca.nome}</span>
                <span className="block font-[family-name:var(--al-fonte-marca)] text-[0.85rem] italic text-[var(--al-texto-2)]">{t.marca.instituto}</span>
              </span>
            </Link>
            <Link href={localePath(lang, "/alumia/buscar")} className="al2-acao ml-auto" aria-label={t.menu.buscar} title={t.menu.buscar}>
              <Icone nome="lupa" className="h-6 w-6" />
            </Link>
            <Link href={`${enderecos.linha(lang)}/avisos`} className="al2-acao relative" aria-label={avisosN > 0 ? preencher(t.menu.avisosNovos, { n: avisosN }) : t.menu.avisos}>
              <Icone nome="avisos" className="h-6 w-6" />
              {avisosN > 0 && (
                <span aria-hidden className="al2-emblema al2-emblema-vermelho absolute -right-0.5 -top-0.5 ml-0">
                  {avisosN > 99 ? "99+" : avisosN}
                </span>
              )}
            </Link>
            <button type="button" onClick={sairRapido} className="al2-acao" aria-label={t.conta.sairRapido} title={t.conta.sairRapidoAjuda}>
              <Icone nome="sair" className="h-6 w-6" />
            </button>
          </header>
          {children}
          {/* Celular: a conta, os cuidados e os idiomas no pé (o menu do computador não aparece aqui). */}
          <div className="space-y-3 border-t border-[var(--al-linha)] px-4 py-5 lg:hidden">
            <Conta lang={lang} s={s} situacao={situacao} />
            <p className="text-xs text-[var(--al-texto-3)]">{t.direita.rodape}</p>
          </div>
        </main>

        {/* ───── Coluna da direita (computador) ───── */}
        <aside className="hidden px-5 py-6 lg:block" aria-label={t.direita.rotulo}>
          <div className="space-y-6">
            <form action={localePath(lang, "/alumia/buscar")} method="get" role="search">
              <label className="sr-only" htmlFor="al2-busca">{t.direita.buscar}</label>
              <span className="relative block">
                <Icone nome="lupa" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--al-texto-3)]" />
                <input id="al2-busca" name="q" type="search" placeholder={t.direita.buscar} className="al2-campo min-h-12 !rounded-xl !py-2 !pl-10 text-sm" />
              </span>
            </form>
            {direitaEncaixada.map((Peca, i) => (
              <Peca key={i} {...ctx} />
            ))}
            {/* Na prévia, sem as frentes donas, os dublês das pranchas (ao vivo F4, atos perto F2, comunidades ativas F3). */}
            {previa && direitaEncaixada.length === 0 && (
              <>
                <AoVivoDuble t={t} lang={lang} />
                <AtosPertoDuble t={t} lang={lang} />
                <ComunidadesAtivasDuble t={t} lang={lang} />
              </>
            )}
            <CartaoDoFediverso lang={lang} situacao={situacao} />
            <p className="text-xs leading-relaxed text-[var(--al-texto-3)]">{t.direita.rodape}</p>
          </div>
        </aside>
      </div>

      {/* ───── Barra de baixo (celular) ───── */}
      <nav aria-label={t.menu.barra} className="al2-barra-baixo no-print fixed inset-x-0 bottom-0 z-30 pb-[var(--recuo-baixo,0px)] lg:hidden">
        <ul className="mx-auto grid max-w-[600px] grid-cols-5 items-center">
          {BARRA.map((chave, i) => {
            const d = DESTINOS.find((x) => x.chave === chave) as Destino;
            const href = hrefDe(d, lang, s, situacao);
            const atual = atualDe(d, href);
            const n = emblemas[chave] ?? null;
            const item = (
              <li key={chave}>
                {href ? (
                  <Link href={href} className="al2-barra-item" aria-current={atual ? "page" : undefined}>
                    <span className="relative">
                      <Icone nome={d.icone} className="h-7 w-7" grosso={atual} />
                      {n !== null && n > 0 && <span aria-hidden className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--al-dourado)]" />}
                    </span>
                    {d.rotulo(t)}
                    {n !== null && n > 0 && <span className="sr-only">({t.menu.novidade})</span>}
                  </Link>
                ) : (
                  <span className="al2-barra-item opacity-50" aria-disabled="true" title={t.menu.entreParaUsar}>
                    <Icone nome={d.icone} className="h-7 w-7" />
                    {d.rotulo(t)}
                    <span className="sr-only">({t.menu.entreParaUsar})</span>
                  </span>
                )}
              </li>
            );
            if (i !== 2) return item;
            return [
              <li key="escrever" className="grid place-items-center">
                <button type="button" onClick={() => aoEscrever()} disabled={!pode} aria-label={t.menu.escrever} title={pode ? t.menu.escrever : t.menu.entreParaUsar} className="al2-mais grid h-14 w-[4.5rem] place-items-center rounded-2xl disabled:cursor-not-allowed disabled:opacity-40">
                  <Icone nome="mais" className="h-8 w-8" grosso />
                </button>
              </li>,
              item,
            ];
          })}
        </ul>
      </nav>
    </div>
  );
}

/**
 * A conta: rosto de 16 cartões, codinome e o endereço do Fediverso (só com @nome escolhido). O resto (Voltar ao site, cuidados,
 * Sair da conta, idiomas) fica num "mais opções", para nada do menu de hoje sumir.
 */
function Conta({ lang, s, situacao }: { lang: string; s: TextosDaRede; situacao: Situacao }) {
  const al2 = useAlumia2();
  if (!al2) return null;
  const { t } = al2;
  const cuidados: [string, string][] = situacao.logado && situacao.membro
    ? [
        ["cuidado", t.conta.regras],
        ["denuncias", t.conta.denuncias],
        ["silenciados", t.conta.silenciados],
        ...(situacao.cuida ? ([["moderacao", t.conta.moderacao]] as [string, string][]) : []),
      ]
    : [];
  return (
    <details className="al2-conta group rounded-xl border border-[var(--al-linha)] bg-[var(--al-superficie)]">
      <summary className="relative flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
        {situacao.logado ? (
          <>
            <Avatar16 handle={situacao.handle ?? situacao.codinome ?? "?"} tamanho={36} className="shrink-0" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate pr-6 text-[0.9375rem] font-extrabold">{situacao.codinome ?? t.conta.visitante}</span>
              {situacao.handle && <span className="block break-all text-[0.6875rem] text-[var(--al-texto-3)]">{enderecoNoFediverso(situacao.handle).slice(1)}</span>}
            </span>
          </>
        ) : (
          <span className="flex-1 text-[0.9375rem] font-extrabold">{t.conta.visitante}</span>
        )}
        <Icone nome="pontos" className={`h-5 w-5 shrink-0 text-[var(--al-texto-3)] ${situacao.logado ? "absolute right-3 top-3" : ""}`} />
        <span className="sr-only">{t.conta.abrir}</span>
      </summary>
      <div className="space-y-1 border-t border-[var(--al-linha)] p-2 text-sm">
        <Link href={enderecoDoSite(lang)} className="al2-acao w-full justify-start">{t.conta.voltarAoSite}</Link>
        {cuidados.map(([rota, texto]) => (
          <Link key={rota} href={localePath(lang, `/alumia/${rota}`)} className="al2-acao w-full justify-start">{texto}</Link>
        ))}
        <Link href={`${enderecos.linha(lang)}/fediverso`} className="al2-acao w-full justify-start">{t.menu.fediverso}</Link>
        {situacao.logado ? (
          <button type="button" onClick={() => void sairDaConta()} className="al2-acao w-full justify-start">{t.conta.sairDaConta}</button>
        ) : null}
        <Idiomas lang={lang} rotulo={t.conta.idiomas} />
        <p className="px-1.5 pt-1 text-xs text-[var(--al-texto-3)]">{s.casca.sairRapidoAjuda}</p>
      </div>
    </details>
  );
}

/** "Você também está no Fediverso": o endereço da pessoa, ou o convite para escolher um @nome. */
function CartaoDoFediverso({ lang, situacao }: { lang: string; situacao: Situacao }) {
  const al2 = useAlumia2();
  if (!al2) return null;
  const { t } = al2;
  return (
    <section className="al2-bloco p-4" aria-labelledby="al2-fedi">
      <h2 id="al2-fedi" className="flex items-start gap-2 text-[0.9375rem] font-extrabold leading-snug">
        <Icone nome="fediverso" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--al-dourado)]" />
        {t.direita.fediTitulo}
      </h2>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-[var(--al-texto-2)]">{t.direita.fediTexto}</p>
      {situacao.handle ? (
        <p className="mt-2 break-all text-[0.8125rem] font-extrabold">{enderecoNoFediverso(situacao.handle)}</p>
      ) : (
        <p className="mt-2 text-[0.8125rem] text-[var(--al-texto-3)]">{t.direita.fediSemNome}</p>
      )}
      <Link href={`${enderecos.linha(lang)}/fediverso`} className="mt-2 inline-block text-xs font-bold underline">{t.direita.fediVer}</Link>
    </section>
  );
}

/** Os idiomas como links de verdade, mantendo a tela aberta (como na casca de hoje). */
function Idiomas({ lang, rotulo }: { lang: string; rotulo: string }) {
  let partes = (usePathname() ?? "").split("/").filter(Boolean);
  if ((locales as readonly string[]).includes(partes[0])) partes = partes.slice(1);
  if (partes[0] === "alumia" || partes[0] === "comunidade") partes = partes.slice(1);
  const resto = ["alumia", ...partes].join("/");
  return (
    <nav aria-label={rotulo} className="px-1.5 pt-1">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--al-texto-3)]">{rotulo}</p>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {locales.map((code) => (
          <li key={code}>
            <a href={`/${code}/${resto}`} hrefLang={htmlLang[code]} lang={htmlLang[code]} aria-current={code === lang ? "true" : undefined} className={`inline-flex min-h-9 items-center underline underline-offset-2 ${code === lang ? "font-bold" : ""}`}>
              {localeNames[code]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
