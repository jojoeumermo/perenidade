// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/Link";
import { htmlLang, localeNames, localePath, locales } from "@/i18n/config";
import { getClient, hasSession } from "@/lib/backend";
import { preencher } from "@/lib/rede/preencher";
import { enderecoNoFediverso } from "@/lib/rede/publicar/alumia2";
import type { TextosDaRede } from "@/lib/rede/textos";
import { enderecos, type Situacao } from "@/lib/rede/tipos";
import { enderecoDoSite } from "../../VoltarAoSite";
import { Avatar16 } from "../../ui/Avatar16";
import { useAlumia2 } from "./contexto";
import { detalhesQueFecham } from "./fechar";
import { Icone, type NomeDoIcone } from "./icones";
import type { TextosAlumia2 } from "./textos";

// O painel de perguntas frequentes do site escuta este evento (pelo nome, sem importar o módulo dele).
const alternarAjuda = () => window.dispatchEvent(new Event("lucia:alternar-assistente"));

async function sairDaConta() {
  try {
    if (hasSession()) await (await getClient()).auth.signOut();
  } catch {
    // sem serviço: não havia sessão para encerrar
  }
  window.location.reload();
}

/** O endereço da pessoa no Fediverso sem o "@" do começo, cortado com reticências quando não cabe (o inteiro fica no title). */
function Endereco({ handle, className = "" }: { handle: string; className?: string }) {
  const inteiro = enderecoNoFediverso(handle).slice(1);
  return (
    <span className={`block truncate text-[0.6875rem] text-[var(--al-texto-3)] ${className}`} title={inteiro}>
      {inteiro}
    </span>
  );
}

/**
 * Os itens da conta, todos com ícone (o computador mostra no menu da conta; o celular, no painel "Mais"): voltar ao site, perguntas
 * frequentes, os cuidados (só de membro), segurança, Fediverso e sair da conta.
 */
function ItensDaConta({ lang, situacao, t, comFediverso, aoEscolher }: { lang: string; situacao: Situacao; t: TextosAlumia2; comFediverso: boolean; aoEscolher?: () => void }) {
  const membro = situacao.logado && situacao.membro;
  const links: [string, NomeDoIcone, string][] = [
    ...(membro
      ? ([
          ["cuidado", "escudo", t.conta.regras],
          ["denuncias", "alerta", t.conta.denuncias],
          ["silenciados", "silenciar", t.conta.silenciados],
          ...(situacao.cuida ? ([["moderacao", "moderar", t.conta.moderacao]] as [string, NomeDoIcone, string][]) : []),
        ] as [string, NomeDoIcone, string][])
      : []),
    ...(situacao.logado ? ([["seguranca", "cadeado", t.conta.seguranca]] as [string, NomeDoIcone, string][]) : []),
    ...(comFediverso ? ([["fediverso", "fediverso", t.menu.fediverso]] as [string, NomeDoIcone, string][]) : []),
  ];
  return (
    <ul className="al2-conta-itens">
      <li>
        <Link href={enderecoDoSite(lang)} className="al2-conta-item" onClick={aoEscolher}>
          <Icone nome="voltar" className="h-[18px] w-[18px]" />
          {t.conta.voltarAoSite}
        </Link>
      </li>
      <li>
        <button
          type="button"
          className="al2-conta-item"
          onClick={() => {
            aoEscolher?.();
            alternarAjuda();
          }}
        >
          <Icone nome="ajuda" className="h-[18px] w-[18px]" />
          {t.conta.ajuda}
        </button>
      </li>
      {links.map(([rota, icone, texto]) => (
        <li key={rota}>
          <Link href={localePath(lang, `/alumia/${rota}`)} className="al2-conta-item" onClick={aoEscolher}>
            <Icone nome={icone} className="h-[18px] w-[18px]" />
            {texto}
          </Link>
        </li>
      ))}
      {situacao.logado && (
        <li>
          <button type="button" onClick={() => void sairDaConta()} className="al2-conta-item">
            <Icone nome="sair" className="h-[18px] w-[18px]" />
            {t.conta.sairDaConta}
          </button>
        </li>
      )}
    </ul>
  );
}

/** Os idiomas como links de verdade, mantendo a tela aberta, numa grade de duas colunas (nada de linhas tortas). */
function Idiomas({ lang, rotulo, colunas = 2 }: { lang: string; rotulo: string; colunas?: 2 | 3 }) {
  let partes = (usePathname() ?? "").split("/").filter(Boolean);
  if ((locales as readonly string[]).includes(partes[0])) partes = partes.slice(1);
  if (partes[0] === "alumia" || partes[0] === "comunidade") partes = partes.slice(1);
  const resto = ["alumia", ...partes].join("/");
  return (
    <nav aria-label={rotulo} className="al2-idiomas">
      <p className="al2-conta-secao">
        <Icone nome="idioma" className="h-4 w-4" />
        {rotulo}
      </p>
      <ul className={`grid gap-1 ${colunas === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {locales.map((code) => (
          <li key={code}>
            <a href={`/${code}/${resto}`} hrefLang={htmlLang[code]} lang={htmlLang[code]} aria-current={code === lang ? "true" : undefined} className="al2-idioma">
              <span className="truncate">{localeNames[code]}</span>
              {code === lang && <Icone nome="visto" className="ml-auto h-4 w-4 shrink-0" grosso />}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * A conta no pé do menu do computador: rosto de 16 cartões, codinome e o endereço do Fediverso (cortado com reticências). O "⋯"
 * abre um menu ao LADO do menu da esquerda, ancorado embaixo (não cobre Atos, Escrever nem o resto do menu), com os itens da conta
 * e os idiomas.
 */
export function Conta({ lang, s, situacao }: { lang: string; s: TextosDaRede; situacao: Situacao }) {
  const al2 = useAlumia2();
  if (!al2) return null;
  const { t } = al2;
  return (
    <details ref={detalhesQueFecham} className="al2-conta group relative rounded-xl border border-[var(--al-linha)] bg-[var(--al-superficie)]">
      <summary className="relative flex cursor-pointer list-none items-center gap-3 rounded-xl p-3 [&::-webkit-details-marker]:hidden">
        {situacao.logado ? (
          <>
            <Avatar16 handle={situacao.handle ?? situacao.codinome ?? "?"} tamanho={36} className="shrink-0" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[0.9375rem] font-extrabold">{situacao.codinome ?? t.conta.visitante}</span>
              {situacao.handle && <Endereco handle={situacao.handle} />}
            </span>
          </>
        ) : (
          <span className="flex-1 text-[0.9375rem] font-extrabold">{t.conta.visitante}</span>
        )}
        <Icone nome="pontos" className="h-5 w-5 shrink-0 text-[var(--al-texto-3)] transition-transform duration-200 group-open:rotate-90" />
        <span className="sr-only">{t.conta.abrir}</span>
      </summary>
      <div className="al2-conta-menu" role="group" aria-label={t.conta.rotulo}>
        <ItensDaConta lang={lang} situacao={situacao} t={t} comFediverso />
        <Idiomas lang={lang} rotulo={t.conta.idiomas} />
        <p className="px-2 pt-2 text-xs leading-relaxed text-[var(--al-texto-3)]">{s.casca.sairRapidoAjuda}</p>
      </div>
    </details>
  );
}

/** Um destino do painel "Mais". */
export interface DestinoDoMais {
  chave: string;
  href: string | null;
  rotulo: string;
  icone: NomeDoIcone | React.ReactNode;
  atual: boolean;
  emblema: number | null;
}

/**
 * O "Mais" do celular: um botão no alto (ao lado do Sair rápido) que abre um painel lateral com o que não cabe na barra de baixo
 * (Comunidades, Núcleos, Conversas, Salvos, Calendário, Organizações, Fediverso e o que as frentes pendurarem), a conta e os
 * idiomas. É um <dialog> modal: prende o foco, fecha com Esc, com toque fora e ao trocar de tela, e devolve o foco ao botão.
 */
export function BotaoMais({ lang, situacao, destinos, naConta, aoSairRapido }: {
  lang: string;
  situacao: Situacao;
  destinos: DestinoDoMais[];
  /** A tela atual é uma das da conta (Segurança, Regras e cuidado…): o "Mais" acende, porque os itens dela moram aqui. */
  naConta: boolean;
  aoSairRapido: () => void;
}) {
  const al2 = useAlumia2();
  const caminho = usePathname() ?? "";
  const painel = useRef<HTMLDialogElement>(null);
  const [aberto, setAberto] = useState(false);

  const fechar = useCallback((comMovimento = true) => {
    const d = painel.current;
    if (!d?.open) return;
    const parado = !comMovimento || window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.hasAttribute("data-parado");
    if (parado) {
      d.close();
      return;
    }
    d.dataset.fechando = "";
    window.setTimeout(() => {
      delete d.dataset.fechando;
      d.close();
    }, 200);
  }, []);

  // Trocar de tela fecha o painel (os links dele navegam sem recarregar).
  useEffect(() => {
    fechar(false);
  }, [caminho, fechar]);

  if (!al2) return null;
  const { t } = al2;
  const aqui = naConta || destinos.some((d) => d.atual);
  const novidade = destinos.some((d) => (d.emblema ?? 0) > 0);

  return (
    <>
      <button
        type="button"
        className="al2-acao al2-botao-mais relative"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={aqui ? `${t.menu.maisAbrir} (${t.menu.aqui})` : t.menu.maisAbrir}
        title={t.menu.mais}
        data-atual={aqui ? "" : undefined}
        onClick={() => painel.current?.showModal()}
      >
        <Icone nome="menu" className="h-6 w-6" />
        {novidade && <span aria-hidden className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--al-dourado)] ring-2 ring-[var(--al-fundo)]" />}
      </button>
      <dialog
        ref={painel}
        className="al2-painel-mais"
        aria-labelledby="al2-mais-titulo"
        onToggle={(e) => setAberto((e.currentTarget as HTMLDialogElement).open)}
        onClose={() => setAberto(false)}
        onCancel={(e) => {
          e.preventDefault();
          fechar();
        }}
        onClick={(e) => {
          // Toque no fundo escurecido (fora do miolo) fecha.
          if (e.target === e.currentTarget) fechar();
        }}
      >
        <div className="al2-painel-mais-miolo">
          <header className="flex items-center gap-3">
            <h2 id="al2-mais-titulo" className="al-cond text-[1.75rem]">
              {t.menu.mais}
            </h2>
            <button type="button" className="al2-acao ml-auto" onClick={() => fechar()} aria-label={t.menu.fechar} title={t.menu.fechar}>
              <Icone nome="fechar" className="h-6 w-6" />
            </button>
          </header>

          {situacao.logado && (
            <Link href={situacao.handle ? enderecos.perfil(lang, situacao.handle) : `${enderecos.linha(lang)}/editar-perfil`} className="al2-painel-conta" style={{ ["--i" as string]: 0 }}>
              <Avatar16 handle={situacao.handle ?? situacao.codinome ?? "?"} tamanho={44} className="shrink-0" />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-base font-extrabold">{situacao.codinome ?? t.conta.visitante}</span>
                {situacao.handle ? <Endereco handle={situacao.handle} className="text-xs" /> : <span className="block text-xs text-[var(--al-texto-3)]">{t.conta.verPerfil}</span>}
              </span>
              <Icone nome="chevron" className="h-5 w-5 shrink-0 text-[var(--al-texto-3)]" />
            </Link>
          )}

          <nav aria-label={t.menu.maisTitulo}>
            <ul className="grid grid-cols-2 gap-2">
              {destinos.map((d, i) => {
                const icone = typeof d.icone === "string" ? <Icone nome={d.icone as NomeDoIcone} className="h-6 w-6" grosso={d.atual} /> : (
                  <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    {d.icone}
                  </svg>
                );
                const n = d.emblema ?? 0;
                const miolo = (
                  <>
                    <span className="relative">
                      {icone}
                      {n > 0 && <span aria-hidden className="al2-emblema al2-emblema-dourado absolute -right-3 -top-2 ml-0">{n > 99 ? "99+" : n}</span>}
                    </span>
                    <span className="truncate">{d.rotulo}</span>
                    {n > 0 && <span className="sr-only">{preencher(t.menu.emblema, { n })}</span>}
                  </>
                );
                return (
                  <li key={d.chave} style={{ ["--i" as string]: i + 1 }}>
                    {d.href ? (
                      <Link href={d.href} className="al2-painel-destino" aria-current={d.atual ? "page" : undefined}>
                        {miolo}
                      </Link>
                    ) : (
                      <span className="al2-painel-destino" aria-disabled="true">
                        {miolo}
                        <span className="text-[0.65rem] font-bold">{t.menu.entreParaUsar}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          <section aria-labelledby="al2-mais-conta" className="al2-painel-bloco">
            <h3 id="al2-mais-conta" className="al2-conta-secao">
              {t.conta.rotulo}
            </h3>
            <ItensDaConta lang={lang} situacao={situacao} t={t} comFediverso={false} aoEscolher={() => fechar(false)} />
          </section>

          <div className="al2-painel-bloco">
            <Idiomas lang={lang} rotulo={t.conta.idiomas} colunas={3} />
          </div>

          <div className="al2-painel-bloco space-y-2">
            <button type="button" onClick={aoSairRapido} className="al-botao al-botao-contorno al-botao-m al2-aperta w-full">
              <Icone nome="sair" className="h-5 w-5" />
              {t.conta.sairRapido}
            </button>
            <p className="text-xs leading-relaxed text-[var(--al-texto-3)]">{t.conta.sairRapidoAjuda}</p>
            <p className="text-xs leading-relaxed text-[var(--al-texto-3)]">{t.direita.rodape}</p>
          </div>
        </div>
      </dialog>
    </>
  );
}
