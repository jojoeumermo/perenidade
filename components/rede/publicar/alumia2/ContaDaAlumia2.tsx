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
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import { ENCAIXES, type ContextoDoEncaixe } from "../../encaixes";
import { enderecoDoSite } from "../../VoltarAoSite";
import { Avatar16 } from "../../ui/Avatar16";
import { Avatar } from "../../perfil/Avatar";
import { redePerfil } from "@/lib/rede/cliente-perfil";
import { origemDaImagem } from "@/lib/rede/perfil";
import { ouvirRostoDaConta, rostoGuardado, trocarRostoDaConta } from "@/lib/rede/rosto-da-conta";
import { chamar } from "@/lib/rede/cliente";
import { useFotoPublica } from "@/lib/rede/fotos-publicas";
import { lembrarRosto, useRostoDe } from "@/lib/rede/rostos";
import { LinkBotao } from "../../ui/Botao";
import { useAlumia2 } from "./contexto";
import { detalhesQueFecham } from "./fechar";
import { Icone, type NomeDoIcone } from "./icones";
import { AjusteDaPausa } from "./LembreteDePausa";
import type { TextosAlumia2 } from "./textos";
import { entradaDaAlumia } from "@/lib/rede/alumia";

/**
 * O rosto da própria conta (A10 do Prompt 5), na mesma ordem do cabeçalho do perfil (components/rede/perfil/livre/Cabecalho.tsx):
 * a foto de quem escolheu aparecer com nome e foto, o rosto de pixels pintado no perfil, o desenho ou a foto escolhida em Editar
 * perfil, e o desenho automático do @nome só quando não há nada disso. Antes o menu mostrava sempre o automático. Lido uma vez por
 * aba e trocado na hora pelo Editar perfil (lib/rede/rosto-da-conta.ts).
 */
function RostoDaConta({ situacao, tamanho }: { situacao: Situacao; tamanho: number }) {
  const [, redesenhar] = useState(0);
  const pode = Boolean(situacao.logado && situacao.membro);
  const handle = situacao.handle ?? situacao.codinome ?? "?";
  const publica = useFotoPublica(situacao.handle ?? "");
  const px = useRostoDe(situacao.handle ?? "");
  useEffect(() => {
    const parar = ouvirRostoDaConta(() => redesenhar((n) => n + 1));
    if (pode && rostoGuardado() === null) {
      redePerfil.meu().then(
        (m) => trocarRostoDaConta(m?.avatar ?? null),
        () => undefined,
      );
      // O rosto de pixels do perfil livre: lido uma vez, ele passa a valer no Avatar16 da rede inteira (lib/rede/rostos.ts).
      if (situacao.handle) {
        const meuHandle = situacao.handle;
        chamar<{ rosto?: unknown } | null>("rede_perfil_aparencia", { p_handle: meuHandle }).then(
          (a) => lembrarRosto(meuHandle, typeof a?.rosto === "string" ? a.rosto : null),
          () => undefined,
        );
      }
    }
    return parar;
  }, [pode, situacao.handle]);
  const imagem = pode ? (rostoGuardado()?.imagem ?? null) : null;
  if (!publica && !px && imagem && origemDaImagem(imagem, "avatar")) return <Avatar imagem={imagem} codinome={situacao.codinome ?? "?"} tamanho={tamanho} />;
  return <Avatar16 handle={handle} tamanho={tamanho} className="shrink-0" />;
}

async function sairDaConta() {
  try {
    if (hasSession()) await (await getClient()).auth.signOut({ scope: "local" });
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

/** Um item de menu com ícone: um link, ou um botão (sair da conta, reabrir os termos). */
type ItemComIcone = { chave: string; icone: NomeDoIcone | React.ReactNode; texto: string; emblema?: number | null; rotuloDoEmblema?: string } & ({ href: string } | { aoClicar: () => void });

function ListaComIcones({ itens, aoEscolher }: { itens: ItemComIcone[]; aoEscolher?: () => void }) {
  return (
    <ul className="al2-conta-itens">
      {itens.map((item) => {
        const icone =
          typeof item.icone === "string" ? (
            <Icone nome={item.icone as NomeDoIcone} className="h-[18px] w-[18px]" />
          ) : (
            <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              {item.icone}
            </svg>
          );
        const n = item.emblema ?? 0;
        return (
          <li key={item.chave}>
            {"href" in item ? (
              <Link href={item.href} className="al2-conta-item" onClick={aoEscolher}>
                {icone}
                {item.texto}
                {n > 0 && (
                  <>
                    <span aria-hidden className="al2-emblema al2-emblema-dourado ml-auto">{n > 99 ? "99+" : n}</span>
                    {item.rotuloDoEmblema && <span className="sr-only">{item.rotuloDoEmblema}</span>}
                  </>
                )}
              </Link>
            ) : (
              <button
                type="button"
                className="al2-conta-item"
                onClick={() => {
                  aoEscolher?.();
                  item.aoClicar();
                }}
              >
                {icone}
                {item.texto}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Os itens que as frentes encaixam num lugar da casca (P5, A9: "conta" ou "seguranca"), para quem pode abrir. */
function encaixadosEm(lugar: "conta" | "seguranca", ctx: ContextoDoEncaixe, jaTem: string[]): ItemComIcone[] {
  const itens: ItemComIcone[] = [];
  for (const m of ENCAIXES.menu) {
    if (m.substitui || m.lugar !== lugar) continue;
    const href = m.href(ctx);
    if (href === null || jaTem.includes(href)) continue;
    itens.push({ chave: `encaixe-${m.chave}`, icone: m.icone, texto: m.rotulo(ctx), href });
  }
  return itens;
}

/**
 * O menu da conta (P5, A9), o mesmo no "⋯" do computador e no painel "Mais" do celular: como a pessoa lê (aparência e leitura; a
 * linha do tempo, com os temas que segue e os posts que se repetem), convidar, a ajuda, voltar ao site e sair da conta. O que
 * protege a pessoa mora no painel de Segurança (ItensDaSeguranca); a moderação tem entrada própria no menu.
 */
function ItensDaConta({ lang, s, situacao, t, aoEscolher }: { lang: string; s: TextosDaRede; situacao: Situacao; t: TextosAlumia2; aoEscolher?: () => void }) {
  const membro = situacao.logado && situacao.membro;
  const rota = (r: string) => localePath(lang, `/alumia/${r}`);
  // Tema, letra, contraste, movimento e ocultar números: vale também para quem só está olhando (fica no aparelho).
  const leitura: ItemComIcone[] = [{ chave: "aparencia", icone: "sol", texto: t.conta.aparencia, href: rota("aparencia") }];
  const linha: ItemComIcone[] = membro
    ? [
        { chave: "temas", icone: "tema", texto: t.conta.temas, href: rota("temas") },
        { chave: "series", icone: "repetir", texto: t.conta.series, href: rota("series") },
      ]
    : [];
  const resto: ItemComIcone[] = [
    ...encaixadosEm("conta", { lang, s, situacao }, []),
    // P5 (A5): a ajuda da própria Alumia (as perguntas frequentes dela), não as do site do instituto.
    { chave: "ajuda", icone: "ajuda", texto: t.conta.ajuda, href: rota("ajuda") },
    { chave: "site", icone: "voltar", texto: t.conta.voltarAoSite, href: enderecoDoSite(lang) },
  ];
  if (situacao.logado) resto.push({ chave: "sair", icone: "sair", texto: t.conta.sairDaConta, aoClicar: () => void sairDaConta() });
  return (
    <>
      <ListaComIcones itens={leitura} aoEscolher={aoEscolher} />
      {linha.length > 0 && (
        <div className="al2-conta-grupo">
          <p className="al2-conta-secao">{t.conta.linhaDoTempo}</p>
          <ListaComIcones itens={linha} aoEscolher={aoEscolher} />
        </div>
      )}
      <div className="al2-conta-grupo">
        <ListaComIcones itens={resto} aoEscolher={aoEscolher} />
      </div>
    </>
  );
}

// A janela dos termos (components/rede/lei/JanelaDosTermos.tsx, P5 A6) escuta este evento. Pelo nome, sem importar o módulo dela:
// a janela chega sob demanda, e este menu não a traz junto.
const abrirOsTermos = () => window.dispatchEvent(new CustomEvent("alumia:abrir-termos", { detail: "termos" }));

/**
 * O painel de Segurança (P5, A9), num lugar só: senha, autenticador e pânico, aparelhos conectados, silenciados, minhas denúncias,
 * regras e cuidado, os termos (reabre a janela de A6), a privacidade no Fediverso, o que a Alumia guarda e a conta com os dados.
 * As frentes podem pendurar mais itens aqui (lugar "seguranca" no encaixe), como os avisos de segurança (A8).
 */
export function ItensDaSeguranca({ lang, s, situacao, t, aoEscolher, emblema = null }: { lang: string; s: TextosDaRede; situacao: Situacao; t: TextosAlumia2; aoEscolher?: () => void; emblema?: number | null }) {
  const membro = situacao.logado && situacao.membro;
  const rota = (r: string) => localePath(lang, `/alumia/${r}`);
  const conta: ItemComIcone[] = [];
  if (situacao.logado) {
    // A8: os avisos da conta não lidos (entrada nova, autenticador, entrada aprovada) moram no bloco de avisos desta tela.
    conta.push({ chave: "seguranca", icone: "cadeado", texto: t.seguranca.conta, href: rota("seguranca"), emblema, rotuloDoEmblema: emblema ? preencher(t.menu.emblema, { n: emblema }) : undefined });
    if (rotaNovaLigada("aparelhos")) conta.push({ chave: "aparelhos", icone: "aparelho", texto: t.seguranca.aparelhos, href: rota("aparelhos") });
  }
  const cuidado: ItemComIcone[] = membro
    ? [
        { chave: "silenciados", icone: "silenciar", texto: t.seguranca.silenciados, href: rota("silenciados") },
        { chave: "denuncias", icone: "alerta", texto: t.seguranca.denuncias, href: rota("denuncias") },
        { chave: "cuidado", icone: "escudo", texto: t.seguranca.regras, href: rota("cuidado") },
      ]
    : [];
  // Logado, os termos abrem na janela (A6), para reler sem sair da tela; quem só está olhando lê na página deles.
  const regras: ItemComIcone[] = [
    situacao.logado
      ? { chave: "termos", icone: "livro", texto: t.seguranca.termos, aoClicar: abrirOsTermos }
      : { chave: "termos", icone: "livro", texto: t.seguranca.termos, href: rota("termos") },
    { chave: "fediverso", icone: "fediverso", texto: t.seguranca.fediverso, href: rota("fediverso") },
  ];
  if (rotaNovaLigada("o-que-guardamos")) regras.push({ chave: "guardamos", icone: "pasta", texto: t.seguranca.guardamos, href: rota("o-que-guardamos") });
  if (situacao.logado) regras.push({ chave: "meus-dados", icone: "perfil", texto: t.seguranca.minhaConta, href: rota("meus-dados") });
  const jaTem = [...conta, ...cuidado, ...regras].flatMap((i) => ("href" in i ? [i.href] : []));
  const primeiros = [...conta, ...encaixadosEm("seguranca", { lang, s, situacao }, jaTem)];
  return (
    <>
      {primeiros.length > 0 && <ListaComIcones itens={primeiros} aoEscolher={aoEscolher} />}
      {cuidado.length > 0 && (
        <div className="al2-conta-grupo">
          <ListaComIcones itens={cuidado} aoEscolher={aoEscolher} />
        </div>
      )}
      <div className="al2-conta-grupo">
        <ListaComIcones itens={regras} aoEscolher={aoEscolher} />
      </div>
    </>
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
    <>
    <details ref={detalhesQueFecham} className="al2-conta group relative rounded-2xl border border-[var(--al-linha)] bg-[var(--al-superficie)]">
      <summary className="relative flex cursor-pointer list-none items-center gap-3 rounded-2xl p-3 [&::-webkit-details-marker]:hidden">
        {situacao.logado ? (
          <>
            <RostoDaConta situacao={situacao} tamanho={36} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[0.9375rem] font-extrabold">{situacao.codinome ?? t.conta.visitante}</span>
              {situacao.handle && <Endereco handle={situacao.handle} />}
            </span>
          </>
        ) : (
          <>
            {/* Visitante: o rosto neutro (ainda sem os 16 cartões, que nascem do @nome). */}
            <span aria-hidden className="al2-conta-rosto-vazio">
              <Icone nome="perfil" className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-extrabold">{t.conta.visitante}</span>
          </>
        )}
        <Icone nome="pontos" className="h-5 w-5 shrink-0 text-[var(--al-texto-3)] transition-transform duration-200 group-open:rotate-90" />
        <span className="sr-only">{t.conta.abrir}</span>
      </summary>
      <div className="al2-conta-menu" role="group" aria-label={t.conta.rotulo}>
        <ItensDaConta lang={lang} s={s} situacao={situacao} t={t} />
        <Idiomas lang={lang} rotulo={t.conta.idiomas} />
        <AjusteDaPausa />
        <p className="px-2 pt-2 text-xs leading-relaxed text-[var(--al-texto-3)]">{s.casca.sairRapidoAjuda}</p>
      </div>
    </details>
    {/* Visitante: o atalho para entrar, fora do <summary> (um link dentro dele não se abre pelo teclado). */}
    {!situacao.logado && (
      <LinkBotao href={entradaDaAlumia(lang, "/alumia")} variante="claro" pilula className="al2-aperta w-full">
        {s.entrada.jaTenhoConta}
      </LinkBotao>
    )}
    </>
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
  /** O nome inteiro, quando o rótulo é curto (vai como descrição, não como nome acessível). */
  titulo?: string;
}

/**
 * Um painel lateral modal (<dialog>): prende o foco, fecha com Esc, com toque fora e ao trocar de tela (com o movimento de saída,
 * quando há movimento), e o navegador devolve o foco ao botão que abriu. O "Mais" do celular e o painel de Segurança usam o mesmo.
 */
function usePainelLateral() {
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

  const propsDoDialogo = {
    ref: painel,
    className: "al2-painel-mais",
    onToggle: (e: React.SyntheticEvent<HTMLDialogElement>) => setAberto(e.currentTarget.open),
    onClose: () => setAberto(false),
    onCancel: (e: React.SyntheticEvent<HTMLDialogElement>) => {
      e.preventDefault();
      fechar();
    },
    onClick: (e: React.MouseEvent<HTMLDialogElement>) => {
      // Toque no fundo escurecido (fora do miolo) fecha.
      if (e.target === e.currentTarget) fechar();
    },
  };
  return { aberto, abrir: () => painel.current?.showModal(), fechar, propsDoDialogo };
}

/**
 * O botão Segurança do menu do computador (P5, A9): abre o painel de Segurança ao lado, com tudo o que protege a pessoa num lugar
 * só (ItensDaSeguranca). Acende quando a tela atual é uma das dele. No celular, os mesmos itens moram no painel "Mais".
 */
export function BotaoSeguranca({ lang, s, situacao, atual, emblema = null }: { lang: string; s: TextosDaRede; situacao: Situacao; atual: boolean; emblema?: number | null }) {
  const al2 = useAlumia2();
  const { aberto, abrir, fechar, propsDoDialogo } = usePainelLateral();
  if (!al2) return null;
  const { t } = al2;
  return (
    <>
      <button type="button" className="al2-menu-item w-full" aria-haspopup="dialog" aria-expanded={aberto} data-atual={atual ? "" : undefined} onClick={abrir} title={t.seguranca.abrir}>
        <Icone nome="escudo" className="h-[22px] w-[22px]" grosso={atual} />
        <span>{t.seguranca.titulo}</span>
        {(emblema ?? 0) > 0 && (
          <>
            <span aria-hidden className="al2-emblema al2-emblema-dourado">{(emblema ?? 0) > 99 ? "99+" : emblema}</span>
            <span className="sr-only">{preencher(t.menu.emblema, { n: emblema ?? 0 })}</span>
          </>
        )}
        {atual && <span className="sr-only">({t.menu.aqui})</span>}
      </button>
      <dialog {...propsDoDialogo} aria-labelledby="al2-seguranca-titulo">
        <div className="al2-painel-mais-miolo">
          <header className="flex items-center gap-3">
            <h2 id="al2-seguranca-titulo" className="al-cond flex items-center gap-2 text-[1.75rem]">
              <Icone nome="escudo" className="h-6 w-6 text-[var(--al-vermelho)]" grosso />
              {t.seguranca.titulo}
            </h2>
            <button type="button" className="al2-acao ml-auto" onClick={() => fechar()} aria-label={t.seguranca.fechar} title={t.seguranca.fechar}>
              <Icone nome="fechar" className="h-6 w-6" />
            </button>
          </header>
          <p className="text-sm leading-relaxed text-[var(--al-texto-2)]">{t.seguranca.intro}</p>
          <nav aria-label={t.seguranca.titulo} className="al2-painel-bloco">
            <ItensDaSeguranca lang={lang} s={s} situacao={situacao} t={t} aoEscolher={() => fechar(false)} emblema={emblema} />
          </nav>
        </div>
      </dialog>
    </>
  );
}

/**
 * O "Mais" do celular: um botão no alto que abre um painel lateral com o Sair rápido, o que não cabe na barra de baixo
 * (Comunidades, Núcleos e turmas, Conversas, Salvos, Calendário, Organizações, a moderação para quem modera e o que as frentes
 * pendurarem), a Segurança, a conta e os idiomas (P5, A9: os mesmos grupos do computador).
 */
export function BotaoMais({ lang, s, situacao, destinos, naConta, aoSairRapido, emblemaDaSeguranca = null }: {
  lang: string;
  s: TextosDaRede;
  situacao: Situacao;
  destinos: DestinoDoMais[];
  /** A tela atual é uma das da conta (Segurança, Regras e cuidado…): o "Mais" acende, porque os itens dela moram aqui. */
  naConta: boolean;
  aoSairRapido: () => void;
  /** A8: os avisos da conta não lidos, no item da conta dentro do bloco Segurança (e no pontinho do "Mais"). */
  emblemaDaSeguranca?: number | null;
}) {
  const al2 = useAlumia2();
  const { aberto, abrir, fechar, propsDoDialogo } = usePainelLateral();

  if (!al2) return null;
  const { t } = al2;
  const aqui = naConta || destinos.some((d) => d.atual);
  const novidade = destinos.some((d) => (d.emblema ?? 0) > 0) || (emblemaDaSeguranca ?? 0) > 0;

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
        onClick={abrir}
      >
        <Icone nome="menu" className="h-6 w-6" />
        {novidade && <span aria-hidden className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--al-dourado-fundo)] ring-2 ring-[var(--al-fundo)]" />}
      </button>
      <dialog {...propsDoDialogo} aria-labelledby="al2-mais-titulo">
        <div className="al2-painel-mais-miolo">
          <header className="flex items-center gap-3">
            <h2 id="al2-mais-titulo" className="al-cond text-[1.75rem]">
              {t.menu.mais}
            </h2>
            <button type="button" className="al2-acao ml-auto" onClick={() => fechar()} aria-label={t.menu.fechar} title={t.menu.fechar}>
              <Icone nome="fechar" className="h-6 w-6" />
            </button>
          </header>

          {/* O Sair rápido é a primeira coisa do painel (no celular ele saiu do alto para o alto ficar como na prancha). */}
          <div className="mt-4 space-y-1.5">
            <button type="button" onClick={aoSairRapido} className="al-botao al-botao-contorno al-botao-m al2-aperta w-full">
              <Icone nome="sair" className="h-5 w-5" />
              {t.conta.sairRapido}
            </button>
            <p className="text-xs leading-relaxed text-[var(--al-texto-3)]">{t.conta.sairRapidoAjuda}</p>
          </div>

          {situacao.logado && (
            <Link href={situacao.handle ? enderecos.perfil(lang, situacao.handle) : `${enderecos.linha(lang)}/editar-perfil`} className="al2-painel-conta" style={{ ["--i" as string]: 0 }}>
              <RostoDaConta situacao={situacao} tamanho={44} />
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

          <section aria-labelledby="al2-mais-seguranca" className="al2-painel-bloco">
            <h3 id="al2-mais-seguranca" className="al2-conta-secao">
              <Icone nome="escudo" className="h-4 w-4" />
              {t.seguranca.titulo}
            </h3>
            <ItensDaSeguranca lang={lang} s={s} situacao={situacao} t={t} aoEscolher={() => fechar(false)} emblema={emblemaDaSeguranca} />
          </section>

          <section aria-labelledby="al2-mais-conta" className="al2-painel-bloco">
            <h3 id="al2-mais-conta" className="al2-conta-secao">
              {t.conta.rotulo}
            </h3>
            <ItensDaConta lang={lang} s={s} situacao={situacao} t={t} aoEscolher={() => fechar(false)} />
          </section>

          <div className="al2-painel-bloco">
            <Idiomas lang={lang} rotulo={t.conta.idiomas} colunas={3} />
          </div>
          <div className="al2-painel-bloco">
            <AjusteDaPausa />
          </div>

          <div className="al2-painel-bloco">
            <p className="text-xs leading-relaxed text-[var(--al-texto-3)]">{t.direita.rodape}</p>
          </div>
        </div>
      </dialog>
    </>
  );
}
