// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/Link";
import { rede } from "@/lib/rede/cliente";
import { linhaAberta, type AbaDaRegra, type PostDaLinha } from "@/lib/rede/cliente-linha";
import { NUMEROS_DA_REGRA, type FiltroDaLinha, type ModoDaLinha } from "@/lib/rede/linha-aberta";
import { filtroDosInteresses } from "@/lib/rede/interesses";
import { redePub } from "@/lib/rede/cliente-publicar";
import { misturarRepostes } from "@/lib/rede/publicar/alumia2";
import { preencher } from "@/lib/rede/preencher";
import { comReserva } from "@/lib/rede/reserva";
import type { TextosDaLinha } from "@/lib/rede/textos-linha";
import type { TextosDaRede } from "@/lib/rede/textos";
import { lerSilenciosLocais, silenciadoNoAparelho, type SilencioLocal } from "@/lib/rede/silenciar-local";
import type { Aba, Post } from "@/lib/rede/tipos";
import { chaveDoItem, deForaVale, estadoInicialDeFora, limiteDaPagina, maisDeFora, misturarDeFora, misturarDeForaNaRoda, type EstadoDeFora } from "@/lib/rede/fediverso/tela/linha";
import type { CartaoDeFora } from "@/lib/rede/fediverso/tela/tipos";
import { CartaoDePost } from "./CartaoDePost";
import { textoDoErro } from "./erros";
import { EsqueletoDaLinha, EsqueletoDoPost } from "./Esqueletos";
import { useAlumia2 } from "./publicar/alumia2/contexto";
import { Icone } from "./publicar/alumia2/icones";

/** De quanto em quanto tempo se pergunta "N novos" (só com a página à vista; nada de tempo real por enquanto). */
const ESPERA_DOS_NOVOS_MS = 60_000;
/** Quanto tempo a linha guardada na memória vale para abrir na hora (depois disso, esqueleto e pedido novo). */
const VALIDADE_DA_MEMORIA_MS = 5 * 60_000;

/**
 * A memória das linhas abertas nesta aba do navegador (cada rota da Alumia monta a Rede de novo): voltar ao Início, ou trocar de
 * aba e voltar, abre na hora com o que já estava na tela, sem esqueleto e sem pular. Só na memória (some ao recarregar e no Sair
 * rápido); `geracao` é o número que a Rede sobe depois de publicar, para a linha vir fresca nessa hora.
 */
interface Lembrada {
  itens: Post[];
  proximo: string | null;
  desde: string;
  repostesAte: string | null;
  geracao: number;
  quando: number;
  corte: number | null;
  /** Gente de fora na aba Seguindo (Fediverso): os cartões que já vieram, o cursor de fora e se ainda há o que pedir. */
  fora: CartaoDeFora[];
  estadoDeFora: EstadoDeFora;
  foraTemMais: boolean;
}

/**
 * A linha com regra aberta (supabase/migracoes/20261113-alumia-o7-linha.sql): a ordem (Em roda ou de chegada), de onde parte e o
 * filtro de uma linha montada. Sem isto, a linha é a de sempre (rede_linha, ordem de chegada).
 */
export interface RegraDaLinha {
  modo: ModoDaLinha;
  base: AbaDaRegra;
  filtro: FiltroDaLinha | null;
  /** Distingue esta linha na memória da aba do navegador (a ordem e a linha montada). */
  chave: string;
  t: TextosDaLinha;
}
const memoria = new Map<string, Lembrada>();

/**
 * Alumia nova (F1): os reposts de quem a pessoa segue que caem na janela de tempo de uma página da aba Seguindo (de `ate` até o
 * post mais antigo da página; na última página, sem fim). Sem a função no banco (ou com erro), a página vem só com os posts, como hoje.
 */
async function comRepostes(itens: Post[], proximo: string | null, ate: string | null, jaVistos?: ReadonlySet<string>): Promise<{ itens: Post[]; desde: string | null }> {
  const desde = proximo && itens.length ? itens[itens.length - 1].criado_em : null;
  const repostes = await redePub.repostes(ate, desde, 20).catch(() => []);
  return { itens: Array.isArray(repostes) && repostes.length ? misturarRepostes(itens, repostes, jaVistos) : itens, desde };
}

/**
 * Uma linha de posts: carrega 20 por vez por cursor (e a próxima página sozinha quando a pessoa chega perto do fim, com o botão
 * para quem usa teclado), mostra o esqueleto só na primeira vez, a pílula "N posts novos" logo abaixo das abas e o estado vazio
 * que orienta. Na Alumia nova, a linha TEM FIM: depois do último post vem o carimbo "VOCÊ VIU TUDO" e o convite para a
 * comunidade ou o ato (o contrário do feed infinito). Serve a todas as abas (seguindo, comunidades, tudo, geral) e às páginas de
 * comunidade e de perfil (aba "c:<slug>" e "u:<handle>"). Cada aba tem a própria instância (a chave é a aba).
 */
export function Linha({
  aba,
  lang,
  s,
  logado,
  aoResponder,
  vazio,
  aoEscreverCom,
  geracao = 0,
  regra = null,
}: {
  aba: Aba;
  lang: string;
  s: TextosDaRede;
  logado: boolean;
  aoResponder?: (post: Post) => void;
  vazio?: string;
  /** Linha vazia: a pessoa escolhe uma pergunta de abertura (docs/rede/SEMEAR.md) e ela abre na caixa de escrever, para editar. */
  aoEscreverCom?: (texto: string) => void;
  /** Sobe depois de publicar: a linha lembrada na memória deixa de valer. */
  geracao?: number;
  /** A regra aberta (Em roda) ou uma linha montada; nulo = a linha de sempre. */
  regra?: RegraDaLinha | null;
}) {
  const al2 = useAlumia2();
  const previa = Boolean(al2?.previa) && !aba.includes(":");
  // Os interesses deste aparelho (onda 11) mudam a ordem Em roda: a linha lembrada só vale para os mesmos interesses.
  const [sinalDosInteresses] = useState(() => (regra?.modo === "roda" ? JSON.stringify(filtroDosInteresses() ?? "") : ""));
  const chave = `${aba}${previa ? ":previa" : ""}${regra ? `:${regra.chave}` : ""}${sinalDosInteresses ? `:${sinalDosInteresses}` : ""}`;
  const montada = Boolean(regra?.filtro) || regra?.base === "temas";
  const [lembrada] = useState<Lembrada | null>(() => {
    const m = memoria.get(chave);
    return m && m.geracao === geracao && Date.now() - m.quando < VALIDADE_DA_MEMORIA_MS ? m : null;
  });
  const [itens, setItens] = useState<Post[]>(() => lembrada?.itens ?? []);
  const [proximo, setProximo] = useState<string | null>(() => lembrada?.proximo ?? null);
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">(lembrada ? "ok" : "carregando");
  const [mensagem, setMensagem] = useState("");
  const [maisCarregando, setMaisCarregando] = useState(false);
  const [erroDoMais, setErroDoMais] = useState("");
  const [novos, setNovos] = useState(0);
  // Onde a regra acabou e a linha continua em ordem de chegada (o que é mais velho que a janela da regra).
  const [corte, setCorte] = useState<number | null>(() => lembrada?.corte ?? null);
  const [atualizando, setAtualizando] = useState(false);
  // Depois de "N posts novos", o foco vai para o primeiro post que chegou (quem usa teclado ou leitor de tela não fica perdido).
  const focarNovo = useRef(false);
  const desde = useRef(lembrada?.desde ?? new Date().toISOString());
  const [versao, setVersao] = useState(0);
  // Os cartões que já estavam na tela (linha lembrada) não entram com animação de novo. Os demais animam só ao serem inseridos
  // (a chave é o id: um cartão que já está na lista não é montado de novo, então não anima outra vez).
  const [jaMostrados] = useState<Set<string>>(() => new Set(lembrada?.itens.map((p) => p.id) ?? []));
  const lista = useRef<HTMLDivElement>(null);
  const sentinela = useRef<HTMLDivElement>(null);
  // Na aba Seguindo da Alumia nova, os reposts de quem a pessoa segue entram na ordem de chegada (só com a flag "alumia-2").
  const comReposts = Boolean(al2) && !previa && logado && aba === "seguindo" && !regra;
  // Gente de fora (Fediverso) no meio da aba Seguindo, por data, sem aba à parte: só na casca nova, com "fediverso-total" ligado
  // (e sessão) ou na prévia, na ordem de chegada e na regra aberta (Em roda: quem a pessoa segue lá fora entra na roda, pelo bloco
  // de horas, misturarDeForaNaRoda; a linha montada, com filtro, não leva gente de fora). São duas listas
  // com cursor próprio: lib/rede/fediverso/tela/linha.ts solta um cartão de fora só quando ele é mais novo que o post mais antigo
  // da página daqui (a ordem não pula quando chega a página seguinte). A pílula "N posts novos" conta só os daqui.
  const comFora = Boolean(al2) && aba === "seguindo" && (!regra || (regra.modo === "roda" && !regra.filtro && regra.base !== "temas")) && (previa || logado) && deForaVale(previa);
  const [fora, setFora] = useState<CartaoDeFora[]>(() => lembrada?.fora ?? []);
  const estadoDeFora = useRef<EstadoDeFora>(lembrada?.estadoDeFora ?? estadoInicialDeFora());
  const [foraTemMais, setForaTemMais] = useState(() => lembrada?.foraTemMais ?? false);
  const temMais = Boolean(proximo) || foraTemMais;
  const modoDaRegra = regra?.modo ?? null;
  const baseDaRegra = regra?.base ?? null;
  const filtroDaRegra = regra?.filtro ?? null;
  /** Uma tela da linha: pela regra aberta (com a de sempre de reserva, se o banco ainda não tem a função) ou a de sempre. */
  const pedirTela = useCallback(
    (cursor: string | null): Promise<{ itens: Post[]; proximo: string | null; naRegra?: boolean }> => {
      if (!modoDaRegra || !baseDaRegra) return rede.linha(aba, cursor, 20);
      const nova = () => linhaAberta.linha(baseDaRegra, modoDaRegra, filtroDaRegra, cursor).then((r) => ({ itens: r.itens as Post[], proximo: r.proximo, naRegra: r.na_regra }));
      // Linha montada não tem reserva: sem a função no banco, o erro aparece (mostrar a aba inteira seria mentir sobre o filtro).
      return filtroDaRegra || baseDaRegra === "temas" ? nova() : comReserva(nova, () => rede.linha(aba, cursor, 20));
    },
    [aba, modoDaRegra, baseDaRegra, filtroDaRegra],
  );
  // Até onde já vieram reposts (o post mais antigo da última página carregada).
  const repostesAte = useRef<string | null>(lembrada?.repostesAte ?? null);
  // "Silenciar só neste aparelho": a lista fica no navegador e só esconde o que a tela mostra (o servidor não sabe dela).
  const [silencios] = useState<SilencioLocal[]>(() => {
    try {
      return lerSilenciosLocais(window.localStorage);
    } catch {
      return [];
    }
  });

  // Guarda na memória o que está na tela, para a próxima vez abrir na hora.
  useEffect(() => {
    if (estado !== "ok") return;
    memoria.set(chave, { itens, proximo, desde: desde.current, repostesAte: repostesAte.current, geracao, quando: Date.now(), corte, fora, estadoDeFora: estadoDeFora.current, foraTemMais });
  }, [chave, itens, proximo, estado, geracao, corte, fora, foraTemMais]);

  // Carrega a primeira página (e de novo quando a versão muda: "tentar de novo" e "N novos, mostrar"). Com a linha lembrada, a
  // primeira carga não acontece: a pílula "N novos" avisa o que chegou depois.
  useEffect(() => {
    if (versao === 0 && lembrada) return;
    let vivo = true;
    // O instante é o de antes do pedido: o que chegar durante a espera ainda conta como novo.
    const antes = new Date().toISOString();
    // Prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim): os posts das pranchas, nunca misturados com os de verdade; "3 posts novos".
    // Os exemplos só são baixados na prévia (import sob demanda): fora dela, não pesam no pacote da Rede de hoje.
    const pedido: Promise<{ itens: Post[]; proximo: string | null; desde?: string | null }> = previa
      ? import("@/lib/rede/publicar/exemplos-alumia2").then((m) => ({
          // Depois de tocar em "3 posts novos", os três chegam no alto (e entram animados, como os novos de verdade).
          itens: arrumarPrevia(versao > 0 ? [...m.postsNovosDeExemplo(), ...m.postsDeExemplo()] : m.postsDeExemplo(), modoDaRegra, filtroDaRegra),
          proximo: null,
        }))
      : pedirTela(null).then(async (r) => {
          if (!comReposts) return r;
          const m = await comRepostes(r.itens, r.proximo, null);
          return { itens: m.itens, proximo: r.proximo, desde: m.desde };
        });
    // A primeira página de fora acompanha a daqui (maisDeFora nunca lança; em erro, a linha daqui segue sozinha).
    pedido
      .then(async (r) => ({ ...r, deFora: comFora ? await maisDeFora(estadoInicialDeFora(), { ate: limiteDaPagina(r.itens, r.proximo), logado }) : null }))
      .then((r) => {
        if (!vivo) return;
        desde.current = antes;
        repostesAte.current = "desde" in r ? (r.desde ?? null) : null;
        estadoDeFora.current = r.deFora?.estado ?? estadoInicialDeFora();
        setFora(r.deFora?.itens ?? []);
        setForaTemMais(r.deFora?.temMais ?? false);
        setItens(r.itens);
        setProximo(r.proximo);
        setCorte(null);
        setNovos(previa && versao === 0 && !montada ? 3 : 0);
        setEstado("ok");
        setAtualizando(false);
        if (focarNovo.current) {
          focarNovo.current = false;
          requestAnimationFrame(() => {
            const primeiro = lista.current?.querySelector<HTMLElement>("ol > li article");
            if (!primeiro) return;
            primeiro.tabIndex = -1;
            primeiro.focus({ preventScroll: true });
          });
        }
      })
      .catch((e) => {
        if (!vivo) return;
        setAtualizando(false);
        setMensagem(textoDoErro(s, e));
        setEstado("erro");
      });
    return () => {
      vivo = false;
    };
  }, [aba, s, versao, previa, comReposts, comFora, logado, lembrada, pedirTela, modoDaRegra, filtroDaRegra, montada]);

  /** Do zero, com esqueleto (depois de um erro). */
  const carregar = () => {
    setEstado("carregando");
    setVersao((v) => v + 1);
  };

  /** "N posts novos": sobe até o alto da linha com rolagem suave e troca a lista sem esqueleto (os cartões novos entram animados). */
  const mostrarNovos = () => {
    setNovos(0);
    setAtualizando(true);
    focarNovo.current = true;
    const alvo = lista.current;
    if (alvo) {
      const topo = alvo.getBoundingClientRect().top + window.scrollY - 120;
      if (window.scrollY > topo) window.scrollTo({ top: Math.max(0, topo), behavior: "smooth" });
    }
    setVersao((v) => v + 1);
  };

  // A pílula "N novos": pergunta só enquanto a página está à vista e a linha já carregou (e logo ao abrir uma linha lembrada).
  useEffect(() => {
    // Linha montada não tem contador de novos (o contador é da aba, não do filtro).
    if (estado !== "ok" || previa || montada) return;
    const perguntar = () => {
      if (document.visibilityState !== "visible") return;
      rede.novos(aba, desde.current).then((n) => setNovos(typeof n === "number" ? n : 0)).catch(() => undefined);
    };
    if (lembrada && versao === 0) perguntar();
    const id = window.setInterval(perguntar, ESPERA_DOS_NOVOS_MS);
    return () => window.clearInterval(id);
  }, [aba, estado, previa, lembrada, versao, montada]);

  const maisPosts = useCallback(async () => {
    // A linha continua enquanto um dos dois lados (daqui ou de fora) tiver página.
    if ((!proximo && !foraTemMais) || maisCarregando) return;
    setMaisCarregando(true);
    setErroDoMais("");
    try {
      // A linha daqui já acabou e só falta o que veio de fora: o lado de fora vai até o fim (limite nulo).
      let ate: string | null = null;
      if (proximo) {
        const r = await pedirTela(proximo);
        let pagina = r.itens;
        // A regra acabou nesta tela: daqui para trás é ordem de chegada (a faixa avisa onde).
        if (modoDaRegra === "roda" && r.naRegra === false) setCorte((c) => c ?? itens.length);
        if (comReposts) {
          const m = await comRepostes(r.itens, r.proximo, repostesAte.current, new Set(itens.map((p) => p.id)));
          pagina = m.itens;
          repostesAte.current = m.desde;
        }
        setItens((atual) => {
          const vistos = new Set(atual.map((p) => p.id));
          return [...atual, ...pagina.filter((p) => !vistos.has(p.id))];
        });
        setProximo(r.proximo);
        ate = limiteDaPagina(r.itens, r.proximo);
      }
      if (comFora) {
        const f = await maisDeFora(estadoDeFora.current, { ate, logado });
        estadoDeFora.current = f.estado;
        setFora((atual) => [...atual, ...f.itens]);
        setForaTemMais(f.temMais);
      }
    } catch (e) {
      setErroDoMais(textoDoErro(s, e));
    } finally {
      setMaisCarregando(false);
    }
  }, [proximo, foraTemMais, maisCarregando, comReposts, comFora, logado, itens, s, pedirTela, modoDaRegra]);

  // A próxima página vem sozinha quando a pessoa chega a ~1 tela do fim (o botão continua lá para teclado e leitor de tela).
  useEffect(() => {
    const alvo = sentinela.current;
    if (!alvo || !temMais || erroDoMais || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && void maisPosts(), { rootMargin: "0px 0px 900px 0px" });
    obs.observe(alvo);
    return () => obs.disconnect();
  }, [temMais, maisPosts, erroDoMais]);


  if (estado === "carregando") return <EsqueletoDaLinha rotulo={s.estados.carregando} />;
  if (estado === "erro") {
    if (al2) {
      return (
        <div className="al2-estado al2-estado-erro" role="alert">
          <span className="al2-estado-icone" aria-hidden>
            <Icone nome="alerta" className="h-7 w-7" />
          </span>
          <h2 className="al2-estado-titulo">{al2.t.linha.erroTitulo}</h2>
          <p className="al2-estado-texto">{mensagem || s.estados.erro}</p>
          <button type="button" onClick={carregar} className="al-botao al-botao-claro al-botao-m al2-aperta mt-4">
            <Icone nome="desfazer" className="h-4 w-4" />
            {s.estados.tentar}
          </button>
        </div>
      );
    }
    return (
      <div className="px-[18px] py-6 font-sans" role="alert">
        <p className="text-oxblood">{mensagem || s.estados.erro}</p>
        <button type="button" onClick={carregar} className="mt-3 min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-4 font-bold hover:bg-parchment-deep">
          {s.estados.tentar}
        </button>
      </div>
    );
  }

  // Os cartões de fora entram na hora de desenhar, por data (a nota que veio como original e como impulso aparece uma vez só).
  // O cartão de fora tem as chaves de Post que a linha lê (id, criado_em, autor); o CartaoDePost o manda para o cartão de fora.
  const juntos = fora.length ? ((regra ? misturarDeForaNaRoda(itens, fora, corte) : misturarDeFora(itens, fora)) as unknown as Post[]) : itens;
  const visiveis = silencios.length ? juntos.filter((p) => !silenciadoNoAparelho(p, silencios)) : juntos;
  return (
    <div ref={lista} className="al2-linha">
      {al2 && (
        // Logo abaixo das abas (fixas no alto): a pílula entra com mola e fica à vista enquanto a pessoa rola a linha.
        <div className={`al2-novos-lugar ${novos > 0 ? "al2-novos-lugar-aberto" : ""}`} aria-live="polite">
          {novos > 0 && (
            <button type="button" onClick={mostrarNovos} className="al2-novos" aria-label={preencher(al2.t.linha.mostrarNovos, { n: novos })}>
              <Icone nome="setaCima" className="h-4 w-4" grosso />
              <span className="al2-novos-n">{novos > 99 ? "99+" : novos}</span>
              {novos === 1 ? al2.t.linha.novosUm : al2.t.linha.novosOutros}
            </button>
          )}
        </div>
      )}
      {al2 && atualizando && <div className="al2-progresso" role="progressbar" aria-label={s.estados.carregando} />}
      {novos > 0 && !al2 && (
        <button
          type="button"
          onClick={carregar}
          className="sticky top-[var(--altura-topo,0px)] z-10 block min-h-11 w-full cursor-pointer border-b border-rule bg-[#1f1a14] px-4 py-2 text-center font-sans text-sm font-bold text-[#f4ecd8] hover:bg-[#c21f16]"
        >
          {novos === 1 ? s.novos.um : preencher(s.novos.outros, { n: novos })}
        </button>
      )}
      {visiveis.length === 0 ? (
        aoEscreverCom && !vazio ? (
          // Nunca um post inventado (SEMEAR.md): só um convite. Nada é publicado sem a pessoa editar e apertar Publicar.
          <section className="al2-semear mx-3 my-4 rounded-[20px] border-[1.5px] border-dashed border-ink px-[18px] py-5 font-sans" aria-labelledby="rede-semear">
            <h2 id="rede-semear" className="font-serif text-xl font-extrabold">{s.semear.titulo}</h2>
            <p className="mt-1 text-ink-soft">{s.semear.texto}</p>
            <ul className="mt-3 grid gap-2">
              {s.semear.perguntas.map((pergunta) => (
                <li key={pergunta}>
                  <button type="button" onClick={() => aoEscreverCom(pergunta)} className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl border-[1.5px] border-rule bg-folha px-3 py-2 text-left hover:border-ink">
                    <span aria-hidden className="text-[#c21f16]">→</span>
                    {pergunta}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => aoEscreverCom("")} className="alumia-botao mt-3 min-h-11 cursor-pointer rounded-full bg-[#c21f16] px-5 font-bold text-white">
              {s.semear.doZero}
            </button>
          </section>
        ) : al2 ? (
          <div className="al2-estado">
            <MosaicoVazio />
            <p className="al2-estado-texto mt-4">{vazio ?? s.estados.vazioLinha}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href={`/${lang}/alumia/comunidades`} className="al-botao al-botao-claro al-botao-m al2-aperta">{al2.t.linha.fimComunidades}</Link>
              <Link href={`/${lang}/alumia/explorar`} className="al-botao al-botao-contorno al-botao-m al2-aperta">{al2.t.menu.explorar}</Link>
            </div>
          </div>
        ) : (
          <p className="px-[18px] py-8 font-sans text-ink-soft">{vazio ?? s.estados.vazioLinha}</p>
        )
      ) : (
        <ol aria-label={s.abas.rotulo} className="alumia-lista">
          {visiveis.map((p, k) => {
            const novo = Boolean(al2) && !jaMostrados.has(p.id);
            // Escada dentro de cada página de 20 (no máximo 10 passos de atraso).
            const i = Math.min(k % 20, 10);
            const porque = regra ? (p as PostDaLinha).o7_porque : null;
            const rotulo = porque === "aviso" ? regra?.t.porque.aviso : porque === "ato" ? regra?.t.porque.ato : porque === "ajudou" ? regra?.t.porque.ajudou : null;
            const motivo = porque === "aviso" ? regra?.t.porque.avisoRegra : porque === "ato" ? preencher(regra?.t.porque.atoRegra ?? "", { horas: NUMEROS_DA_REGRA.perto_horas }) : porque === "ajudou" ? preencher(regra?.t.porque.ajudouRegra ?? "", { ajudou_piso: NUMEROS_DA_REGRA.ajudou_piso }) : "";
            return (
              <li key={chaveDoItem(p)} className={novo ? "al2-entra" : undefined} style={novo ? ({ "--i": Math.min(i, 10) } as React.CSSProperties) : undefined}>
                {regra && corte !== null && p.id === itens[corte]?.id && (
                  <div className="ro-corte" role="note">
                    <strong className="al-cond">{regra.t.fim.regraAcabou}</strong>
                    <span>{preencher(regra.t.fim.regraAcabouTexto, { dias: NUMEROS_DA_REGRA.janela_dias })}</span>
                  </div>
                )}
                {rotulo && (
                  <p className={`ro-porque ro-porque-${porque}`} title={motivo}>
                    <span className="ro-porque-marca al-cond">{rotulo}</span>
                    <span className="ro-porque-regra">{motivo}</span>
                  </p>
                )}
                <CartaoDePost post={p} lang={lang} s={s} logado={logado} aoResponder={aoResponder} />
              </li>
            );
          })}
        </ol>
      )}
      {temMais ? (
        <div ref={sentinela} className="px-[18px] py-4 text-center">
          {maisCarregando && al2 ? (
            <div aria-hidden>
              <EsqueletoDoPost i={1} />
            </div>
          ) : null}
          {erroDoMais && <p role="alert" className="pb-2 text-sm text-oxblood">{erroDoMais}</p>}
          <button
            type="button"
            onClick={() => void maisPosts()}
            disabled={maisCarregando}
            className={al2 ? "al-botao al-botao-contorno al-botao-m al2-aperta" : "min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-5 font-sans font-bold hover:bg-parchment-deep disabled:opacity-60"}
          >
            {maisCarregando ? s.estados.carregando : erroDoMais ? s.estados.tentar : s.estados.maisPosts}
          </button>
        </div>
      ) : juntos.length > 0 && al2 ? (
        <FimDaLinha lang={lang} t={al2.t} />
      ) : (
        juntos.length > 0 && <p className="px-[18px] py-6 text-center font-sans text-sm text-ink-soft">{s.estados.fim}</p>
      )}
    </div>
  );
}

/**
 * "Linha com fim" (ALUMIA-FUNCOES-E-IDEIAS, ideia nova da F1): o carimbo VOCÊ VIU TUDO cai quando o fim aparece na tela, com o
 * convite para ir à comunidade ou ao ato e um "voltar ao alto". Não é decisão de ninguém, por isso não usa o componente reservado
 * dos carimbos de ato: é um carimbo de papel, dourado.
 */
function FimDaLinha({ lang, t }: { lang: string; t: NonNullable<ReturnType<typeof useAlumia2>>["t"] }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [visto, setVisto] = useState(false);
  useEffect(() => {
    const alvo = caixa.current;
    if (!alvo || typeof IntersectionObserver === "undefined") {
      setVisto(true);
      return;
    }
    const obs = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) {
        setVisto(true);
        obs.disconnect();
      }
    }, { threshold: 0.4 });
    obs.observe(alvo);
    return () => obs.disconnect();
  }, []);
  return (
    <section ref={caixa} className="al2-fim" aria-labelledby="al2-fim-titulo">
      <h2 id="al2-fim-titulo" className={`al2-fim-carimbo al-cond ${visto ? "al2-fim-carimbo-caiu" : ""}`}>
        {t.linha.fimTitulo}
      </h2>
      <p className="al2-estado-texto mt-3">{t.linha.fimTexto}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link href={`/${lang}/alumia/comunidades`} className="al-botao al-botao-claro al-botao-m al2-aperta">
          <Icone nome="comunidades" className="h-4 w-4" />
          {t.linha.fimComunidades}
        </Link>
        <Link href={`/${lang}/alumia/atos`} className="al-botao al-botao-contorno al-botao-m al2-aperta">
          <Icone nome="atos" className="h-4 w-4" />
          {t.linha.fimAtos}
        </Link>
      </div>
      <button
        type="button"
        className="al2-acao mx-auto mt-3"
        onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
      >
        <Icone nome="setaCima" className="h-4 w-4" />
        {t.linha.fimTopo}
      </button>
    </section>
  );
}

/** O desenho do vazio: um mosaico pequeno, apagado, com um cartão dourado aceso (é a pessoa, que pode começar). */
function MosaicoVazio() {
  const cel = Array.from({ length: 35 }, (_, i) => i);
  return (
    <svg aria-hidden viewBox="0 0 70 50" className="al2-estado-mosaico">
      {cel.map((i) => {
        const x = (i % 7) * 10;
        const y = Math.floor(i / 7) * 10;
        return <rect key={i} x={x + 1} y={y + 1} width={8} height={8} rx={1.5} className={i === 17 ? "al2-estado-voce" : "al2-estado-apagado"} style={{ animationDelay: `${(i % 7) * 60 + Math.floor(i / 7) * 40}ms` }} />;
      })}
    </svg>
  );
}

/**
 * Prévia (sem banco): os posts das pranchas arrumados como a regra arrumaria o que dá para ver neles: o chamado com data perto
 * no alto e a conversa com resposta que ajudou marcada. Na ordem de chegada, só do mais novo para o mais velho. Com filtro de
 * tipo, só os tipos pedidos.
 */
function arrumarPrevia(posts: Post[], modo: ModoDaLinha | null, filtro: FiltroDaLinha | null): Post[] {
  if (!modo) return posts;
  const tipos = filtro?.tipos;
  const lista: PostDaLinha[] = (tipos?.length ? posts.filter((p) => (tipos as string[]).includes(p.tipo) || (tipos.includes("chamado") && p.chamado)) : posts).map((p) => ({ ...p }));
  lista.sort((a, b) => Date.parse(b.criado_em) - Date.parse(a.criado_em));
  if (modo === "chegada") return lista.map((p) => ({ ...p, o7_porque: "chegada" as const }));
  for (const p of lista) p.o7_porque = p.chamado ? "ato" : p.aceita ? "ajudou" : "roda";
  const peso = (p: PostDaLinha) => (p.o7_porque === "ato" ? 0 : p.o7_porque === "ajudou" ? 1 : 2);
  return lista.map((p, i) => ({ p, i })).sort((a, b) => peso(a.p) - peso(b.p) || a.i - b.i).map((x) => x.p);
}
