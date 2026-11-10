// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "@/components/Link";
import { localePath } from "@/i18n/config";
import { avisos } from "@/lib/rede/cliente-avisos";
import { redePub } from "@/lib/rede/cliente-publicar";
import { preencher } from "@/lib/rede/preencher";
import { enderecoNoFediverso } from "@/lib/rede/publicar/alumia2";
import { encaixeAtivo } from "@/lib/rede/rota-alumia";
import { DESTINO_DA_SAIDA, sairRapido as sairRapidoDaRede } from "@/lib/rede/saida";
import type { TextosDaRede } from "@/lib/rede/textos";
import { enderecos, type Situacao } from "@/lib/rede/tipos";
import { enderecosDescoberta } from "@/lib/rede/tipos-descoberta";
import type { ItemDoMenu } from "../../Casca";
import { BuscaDaColuna } from "../../comunidades/ComunidadesAtivas";
import { ENCAIXES, type ContextoDoEncaixe } from "../../encaixes";
import { encaixe as encaixeDosAtos } from "../../atos/encaixe";
import { encaixe as encaixeDaConversa } from "../../conversa/encaixe";
import { encaixe as encaixeDaOrg } from "../../org/encaixe";
import { EsqueletoDaCasca } from "../../Esqueletos";
import { Faixa } from "../../ui/Faixa";
import { Lampiao } from "../../ui/Lampiao";
import { useAlumia2 } from "./contexto";
import { BotaoMais, Conta, type DestinoDoMais } from "./ContaDaAlumia2";
import { Icone, type NomeDoIcone } from "./icones";
import { comMovimento } from "./TopoDaLinha2";
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

/** Quantos avisos não lidos a prévia tem (a mesma conta de avisosDaPrevia, components/rede/descoberta/previa.ts). */
export const AVISOS_DA_PREVIA = 5;

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

/**
 * A coluna da direita na ordem da prancha computador-inicio: a busca (uma só, a da casca, no alto), "Ao vivo agora" (F4), "Atos
 * perto de você" (F2), "Comunidades ativas" (F3) e o que mais as frentes pendurarem. A busca que a F3 também pendura sai daqui
 * (era a segunda busca da coluna).
 */
function ordemDaDireita(pecas: readonly React.ComponentType<ContextoDoEncaixe>[]): React.ComponentType<ContextoDoEncaixe>[] {
  const prioridade = [...(encaixeDaOrg.colunaDireita ?? []), ...(encaixeDosAtos.colunaDireita ?? []), ...(encaixeDaConversa.colunaDireita ?? [])];
  const peso = (p: React.ComponentType<ContextoDoEncaixe>) => {
    const i = prioridade.indexOf(p);
    return i < 0 ? prioridade.length : i;
  };
  return pecas.filter((p) => p !== BuscaDaColuna).sort((a, b) => peso(a) - peso(b));
}

/** A última tela aberta (para a próxima entrar com movimento, e a primeira da visita entrar parada). */
let telaAnterior: string | null = null;
/** A casa da barra de baixo da tela anterior (o traço sai dela). */
let barraAnterior: number | null = null;

// Os painéis do site (components/A11yWidget.tsx e assistente/BotaoDoAssistente.tsx) escutam estes eventos. Pelo nome, sem importar
// os módulos deles: o pacote da Alumia não leva o código dos painéis.
const alternarAcessibilidade = () => window.dispatchEvent(new Event("lucia:alternar-acessibilidade"));
const alternarAjuda = () => window.dispatchEvent(new Event("lucia:alternar-assistente"));

/** Acessibilidade e perguntas frequentes como botões da casa, no pé do menu (no lugar dos redondos flutuantes do site). */
function BotoesDoSite({ t }: { t: NonNullable<ReturnType<typeof useAlumia2>>["t"] }) {
  return (
    <>
      <button type="button" className="al2-acao al2-botao-site" data-alterna-acessibilidade="" onClick={alternarAcessibilidade} aria-label={t.conta.acessibilidade} title={t.conta.acessibilidade}>
        <Icone nome="acessibilidade" className="h-[22px] w-[22px]" />
      </button>
      <button type="button" className="al2-acao al2-botao-site" onClick={alternarAjuda} aria-label={t.conta.ajuda} title={t.conta.ajuda}>
        <Icone nome="ajuda" className="h-[22px] w-[22px]" />
      </button>
    </>
  );
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
  /** "nenhum": a tela não é de nenhum item (a conversa aberta). */
  ativo: ItemDoMenu | "nenhum";
  aoEscrever: (tipo?: TipoAoEscrever) => void;
  children: React.ReactNode;
}) {
  const al2 = useAlumia2();
  const caminho = usePathname() ?? "";
  // A tela nova entra com movimento só quando veio de outra tela da Alumia (a primeira da visita aparece parada, sem pulo).
  const [entrando] = useState(() => telaAnterior !== null && telaAnterior !== caminho);
  useEffect(() => {
    telaAnterior = caminho;
  }, [caminho]);
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

  // O item atual sai do CAMINHO, não da aba da linha: no Início (/alumia), em qualquer aba (Seguindo, Minhas comunidades, Tudo), o
  // atual é sempre o Início; "Comunidades" só acende em /alumia/comunidades.
  const semBarra = (x: string) => x.replace(/\/+$/, "");
  const noInicio = semBarra(caminho) === semBarra(enderecos.linha(lang));
  // As telas de configuração (Segurança, Regras e cuidado, Silenciados…) moram na conta, não no perfil: ali o Perfil não acende
  // (no celular, quem acende é o "Mais", onde ficam esses itens).
  const noPerfil = /\/alumia\/(u\/|editar-perfil)/.test(caminho);
  const naConta = ativo === "perfil" && !noPerfil;
  const atualDe = (d: Destino, href: string | null) =>
    noInicio
      ? d.chave === "inicio"
      : d.chave === "perfil" && naConta
        ? false
        : ativo === d.chave || (href !== null && d.chave !== "inicio" && encaixeAtivo(href, caminho));

  // A casa da barra de baixo onde está a tela atual (0 Início, 1 Explorar, 2 é o "+", 3 Atos, 4 Perfil), para o traço deslizante.
  const alvoDaBarra = situacao
    ? (() => {
        const i = BARRA.findIndex((chave) => {
          const d = DESTINOS.find((x) => x.chave === chave) as Destino;
          return atualDe(d, hrefDe(d, lang, s, situacao));
        });
        return i < 0 ? null : i >= 2 ? i + 1 : i;
      })()
    : null;
  // Cada tela monta a casca de novo: o traço nasce onde estava na tela anterior e desliza até a de agora no quadro seguinte.
  const [indicador, setIndicador] = useState<number | null>(() => barraAnterior ?? alvoDaBarra);
  useEffect(() => {
    // Tela que não é de nenhum item da barra (as do "Mais"): o traço some, em vez de ficar parado no item da tela anterior.
    const id = requestAnimationFrame(() => setIndicador(alvoDaBarra));
    barraAnterior = alvoDaBarra;
    return () => cancelAnimationFrame(id);
  }, [alvoDaBarra]);

  // A vaga do botão de acessibilidade no alto do celular (alumia3.css põe o botão do site ali, rolando junto com o cabeçalho, em
  // vez de flutuar por cima do conteúdo): mede onde a vaga está na página e passa para o CSS.
  const vaga = useRef<HTMLSpanElement>(null);
  const prontoParaVaga = Boolean(situacao && al2);
  useEffect(() => {
    const el = vaga.current;
    if (!el) return;
    const raiz = document.documentElement;
    const medir = () => {
      const r = el.getBoundingClientRect();
      raiz.style.setProperty("--al2-vaga-x", `${Math.round(r.left + window.scrollX)}px`);
      raiz.style.setProperty("--al2-vaga-y", `${Math.round(r.top + window.scrollY)}px`);
    };
    medir();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(medir);
    ro?.observe(document.body);
    window.addEventListener("resize", medir);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", medir);
      raiz.style.removeProperty("--al2-vaga-x");
      raiz.style.removeProperty("--al2-vaga-y");
    };
  }, [prontoParaVaga]);

  if (!situacao || !al2) return <EsqueletoDaCasca rotulo={s.estados.carregando} />;
  const { t, previa } = al2;
  const pode = situacao.logado && situacao.membro;
  // Na prévia, os números das pranchas (Avisos 5, Atos 2; os 5 avisos não lidos são os de components/rede/descoberta/previa.ts,
  // que a tela Avisos mostra); de verdade, os da própria pessoa (e o dos atos vem da F2).
  const avisosN = previa ? AVISOS_DA_PREVIA : naoLidos;
  // Atos: o número da F2 (encaixe) quando ela chega; até lá, os atos que a própria pessoa confirmou e ainda vão acontecer.
  const emblemas: Partial<Record<Chave, number | null>> = {
    avisos: avisosN,
    conversas: previa ? null : (doBanco?.conversas ?? null),
    chamados: previa ? 2 : (emblemaDe("chamados", lang, s, situacao) ?? doBanco?.atos ?? null),
  };
  const sairRapido = () => void sairRapidoDaRede(DESTINO_DA_SAIDA, ENCAIXES.aoSairRapido);
  const ctx = { lang, s, situacao };
  const direitaEncaixada = ordemDaDireita(ENCAIXES.colunaDireita);
  // O "Mais" do celular: o que não cabe na barra de baixo. Acende quando a tela atual é uma destas (ou uma das telas da conta).
  const linha = enderecos.linha(lang);
  const destinosDoMais: DestinoDoMais[] = [
    ...(["comunidades", "nucleos", "conversas", "salvos"] as Chave[]).map((chave) => {
      const d = DESTINOS.find((x) => x.chave === chave) as Destino;
      const href = hrefDe(d, lang, s, situacao);
      return { chave, href, rotulo: d.rotulo(t), icone: d.icone, atual: atualDe(d, href), emblema: emblemas[chave] ?? null };
    }),
    { chave: "calendario", href: `${linha}/calendario`, rotulo: t.menu.calendario, icone: "calendario", atual: encaixeAtivo(`${linha}/calendario`, caminho), emblema: null },
    { chave: "organizacoes", href: `${linha}/organizacoes`, rotulo: t.menu.organizacoes, icone: "organizacao", atual: encaixeAtivo(`${linha}/organizacoes`, caminho), emblema: null },
    { chave: "fediverso", href: `${linha}/fediverso`, rotulo: t.menu.fediverso, icone: "fediverso", atual: ativo === "fediverso", emblema: null },
    ...ENCAIXES.menu
      .filter((m) => !m.substitui)
      .map((m) => {
        const href = m.href(ctx);
        return { chave: `encaixe-${m.chave}`, href, rotulo: m.rotulo(ctx), icone: m.icone as React.ReactNode, atual: href !== null && encaixeAtivo(href, caminho), emblema: m.emblema?.(ctx) ?? null };
      })
      .filter((d) => d.href !== null),
  ];

  return (
    <div className="al2 min-h-screen bg-[var(--al-fundo)]">
      <Faixa />
      {/* A prévia avisa uma vez só, colada na faixa, acima de tudo (e não no meio do Início, entre o título e os stories). */}
      {previa && (
        <p className="al2-aviso-previa" role="note">
          {t.previa.aviso}
        </p>
      )}
      <a href="#rede-linha" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-[var(--al-fundo)] focus:p-2">{s.casca.saltarParaConteudo}</a>
      {/* Uma coluna no celular; de 1024 a 1279, menu + meio; de 1280 em diante, as três colunas da prancha computador-inicio. O meio
          tem uma medida só (até 680 px: texto, ato, aula e mosaico alinhados, nada de bloco estreito com caixa larguíssima embaixo) e
          as três ficam centradas; o que sobra nas telas grandes vira margem dos dois lados, e não um meio esticado. */}
      <div className="al2-grade grid grid-cols-[minmax(0,1fr)] pb-[calc(4.75rem+var(--recuo-baixo,0px))] lg:justify-center lg:grid-cols-[clamp(220px,21vw,260px)_minmax(0,720px)] lg:pb-0 xl:grid-cols-[clamp(240px,18vw,290px)_minmax(0,680px)_clamp(340px,24vw,380px)] 2xl:grid-cols-[clamp(260px,16vw,320px)_minmax(0,720px)_clamp(360px,21vw,420px)]">
        {/* ───── Menu (computador) ───── */}
        {/* Sem rótulo próprio: o ponto de referência é o <nav> dentro (dois rótulos iguais confundem o leitor de tela). */}
        <div className="hidden border-r border-[var(--al-linha)] lg:block">
          {/* Do tamanho da tela, preso no alto: a marca e o menu rolam por dentro quando a tela é baixa; a conta e o Sair rápido ficam
              num pé que não encolhe, sempre à vista (o Sair rápido é a saída de segurança). */}
          <div className="al2-menu-lateral sticky top-0 flex flex-col">
          <div className="al2-menu-rola min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-6 xl:px-5 2xl:px-6">
            <Link href={enderecos.linha(lang)} className="flex items-center gap-3 px-2" aria-label={t.marca.inicio}>
              <Lampiao tamanho={34} />
              <span className="leading-none">
                <span className="al-cond block text-[2rem] font-black uppercase tracking-tight">{t.marca.nome}</span>
                <span className="block font-[family-name:var(--al-fonte-marca)] text-[0.95rem] italic text-[var(--al-texto-2)]">{t.marca.instituto}</span>
              </span>
            </Link>
            <nav className="al2-menu-nav mt-6" aria-label={t.menu.principal}>
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
                          {/* Só o número com o que ele quer dizer: o nome do item já está no texto ao lado ("Avisos 5 com novidade", não "Avisos Avisos, 5 novos"). */}
                          <span className="sr-only">{preencher(t.menu.emblema, { n })}</span>
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
                {/* De 1024 a 1279 não há coluna da direita: a busca vira um item do menu (uma só busca na tela, sempre). */}
                <li className="xl:hidden">
                  <Link href={localePath(lang, "/alumia/buscar")} className="al2-menu-item" aria-current={caminho.endsWith("/alumia/buscar") ? "page" : undefined}>
                    <Icone nome="lupa" className="h-[22px] w-[22px]" />
                    <span>{t.menu.buscar}</span>
                  </Link>
                </li>
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
              <button type="button" onClick={() => aoEscrever()} className="al2-menu-escrever al-botao al-botao-primario al-botao-g al2-aperta mt-6 w-full">
                <Icone nome="escrever" className="h-5 w-5" />
                {t.menu.escrever}
              </button>
            )}
            <div aria-hidden className="h-4" />
          </div>
            <div className="al2-menu-pe shrink-0 space-y-2.5 border-t border-[var(--al-linha)] px-4 pb-5 pt-3 xl:px-5 2xl:px-6">
              <Conta lang={lang} s={s} situacao={situacao} />
              {/* Sair rápido sempre à vista; ao lado, a acessibilidade e as perguntas frequentes, que na Alumia moram aqui (os botões
                  redondos do site não flutuam por cima do menu nem dos posts). */}
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={sairRapido} className="al-botao al-botao-contorno al-botao-m al2-aperta min-w-0 flex-1 !px-2 whitespace-nowrap" title={t.conta.sairRapidoAjuda}>
                  {t.conta.sairRapido}
                </button>
                <BotoesDoSite t={t} />
              </div>
            </div>
          </div>
        </div>

        {/* ───── Coluna do meio ───── */}
        {/* Sem <main> aqui: a página já tem o main#conteudo do site (dois main aninhados confundem o leitor de tela, e o rótulo
            "Início" fazia toda tela se anunciar como Início). Cada tela tem o próprio h1. */}
        <div id="rede-linha" tabIndex={-1} className="min-w-0 border-[var(--al-linha)] outline-none xl:border-r">
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
            {/* No celular, a acessibilidade fica aqui no alto (o botão redondo não cobre o "Eu vou" nem o mosaico). Este botão é também
                a vaga do botão do site: quando ele aparece (lendo em voz alta), vem para cima deste, sem ocupar outro lugar. */}
            <span ref={vaga} className="al2-vaga-flutua relative block shrink-0">
              <button type="button" className="al2-acao" data-alterna-acessibilidade="" onClick={alternarAcessibilidade} aria-label={t.conta.acessibilidade} title={t.conta.acessibilidade}>
                <Icone nome="acessibilidade" className="h-6 w-6" />
              </button>
            </span>
            <button type="button" onClick={sairRapido} className="al2-acao" aria-label={t.conta.sairRapido} title={t.conta.sairRapidoAjuda}>
              <Icone nome="sair" className="h-6 w-6" />
            </button>
            <BotaoMais lang={lang} situacao={situacao} destinos={destinosDoMais} naConta={naConta} aoSairRapido={sairRapido} />
          </header>
          <div key={caminho} className={entrando ? "al2-tela-entra" : undefined}>
            {children}
          </div>
          {/* Celular: a conta, os cuidados e os idiomas moram no painel "Mais" do alto (nada solto no fim de cada tela). */}
        </div>

        {/* ───── Coluna da direita (computador) ───── */}
        <aside className="hidden px-5 xl:block 2xl:px-7" aria-label={t.direita.rotulo}>
          <div className="al2-direita sticky top-[0px] max-h-screen space-y-6 overflow-y-auto overscroll-contain py-6">
            <form action={localePath(lang, "/alumia/buscar")} method="get" role="search" className="al2-busca">
              <label className="sr-only" htmlFor="al2-busca">{t.direita.buscar}</label>
              <span className="relative block">
                <Icone nome="lupa" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--al-texto-3)]" />
                <input id="al2-busca" name="q" type="search" placeholder={t.direita.buscar} autoComplete="off" enterKeyHint="search" maxLength={100} className="al2-campo min-h-12 !rounded-xl !py-2 !pl-10 text-sm" />
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
        <ul className="relative mx-auto grid max-w-[600px] grid-cols-5 items-center">
          {/* O traço da tela atual desliza (a mesma mola do traço das abas) do item de antes até o de agora. */}
          {indicador !== null && <li aria-hidden className="al2-barra-indicador" style={{ ["--i" as string]: indicador }} />}
          {BARRA.map((chave, i) => {
            const d = DESTINOS.find((x) => x.chave === chave) as Destino;
            const href = hrefDe(d, lang, s, situacao);
            const atual = atualDe(d, href);
            const n = emblemas[chave] ?? null;
            const item = (
              <li key={chave}>
                {href ? (
                  <Link
                    href={href}
                    className="al2-barra-item"
                    aria-current={atual ? "page" : undefined}
                    onClick={(e) => {
                      // Tocar de novo no item da tela aberta sobe ao alto (como nos aplicativos), em vez de recarregar.
                      if (!atual || window.scrollY < 4) return;
                      e.preventDefault();
                      window.scrollTo({ top: 0, behavior: comMovimento() ? "smooth" : "auto" });
                    }}
                  >
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
