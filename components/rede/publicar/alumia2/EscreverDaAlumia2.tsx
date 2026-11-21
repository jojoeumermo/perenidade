// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ligado } from "@/lib/recursos";
import { novaChaveDeEnvio } from "@/lib/backend-envio";
import { anunciarPostACaminho, retirarPostACaminho } from "@/lib/rede/otimista";
import { chamar, rede } from "@/lib/rede/cliente";
import { alumia } from "@/lib/rede/cliente-alumia";
import { comunidades as clienteComunidades } from "@/lib/rede/cliente-comunidades";
import { redePub } from "@/lib/rede/cliente-publicar";
import { preencher } from "@/lib/rede/preencher";
import {
  rascunhoTemTexto,
  rascunhosValidos,
  segundosQueFaltam,
  SEGUNDOS_PARA_DESFAZER,
  tipoDoBanco,
  tipoDoRascunho,
  type CorDaComunidadeNum,
  type RascunhoDoServidor,
  type TipoDoCompositor,
} from "@/lib/rede/publicar/alumia2";
import { chaveDoAparelho, chaveDoCodigo, cifrarRascunho, codigoDaChave, decifrarRascunho, guardarNaConta, marcarGuardarNaConta, trocarChaveDoAparelho } from "@/lib/rede/publicar/b1";
import { COMUNIDADES_DE_EXEMPLO } from "@/lib/rede/publicar/exemplos-alumia2";
import type { TextosDaRede } from "@/lib/rede/textos";
import { carregarTextosDaConversa, type TextosDaConversa } from "@/lib/rede/textos-conversa";
import type { Comunidade, Post, Publico, Situacao, TipoDePost } from "@/lib/rede/tipos";
import type { CitarQuem, PedidoPublicar, PessoaDaMinhaRoda, PublicoDoEscrever, RespondeQuem } from "@/lib/rede/tipos-publicar";
import { checarTexto } from "@/lib/rede/publicar/checagem";
import { avisoDeOfensaLigado, normalizarParaAviso, PRAZOS_PARA_SUMIR, termosNoTexto, type SomeEm } from "@/lib/rede/publicar/vida";
import { mencionadosDoTexto, opcoesDeVisibilidade, publicoParaConferir, vaiPelaVida, visibilidadeQueVale, VERSAO_DO_SO_EU, type ContextoDaVisibilidade, type FediversoDoEscrever, type OpcaoDeVisibilidade } from "@/lib/rede/publicar/visibilidade";
import { CampoComMencoes } from "../../conversa/CampoComMencoes";
import { ENCAIXES, verificarAntesDePublicar } from "../../encaixes";
import { LinksConferidos } from "../../protecao/LinksConferidos";
import { codigoDoErro, textoDoErro } from "../../erros";
import { Mosaico } from "../../mosaico/Mosaico";
import { corDaComunidade } from "../../ui/Pilula";
import { escreverRascunho, useEscreverPub } from "../ExtrasDoEscrever";
import { textoDoErroPublicar } from "../textos";
import { AnexosDoEscrever } from "./AnexosDoEscrever";
import { compositorDaMidia } from "../../midia/encaixe";
import { faltaNoBanco } from "./CartaoDaAlumia2";
import type { TipoAoEscrever } from "./CascaDaAlumia2";
import { useAlumia2 } from "./contexto";
import { Icone, type NomeDoIcone } from "./icones";
import { Pilulas } from "./Pilulas";
import "./escrever.css";
import type { TextosAlumia2 } from "./textos";
import { comMovimento } from "./TopoDaLinha2";
import { RodaNoEscrever } from "../vida/RodaNoEscrever";
import { EditorDeTexto } from "../../texto/EditorDeTexto";
import { textoDoErroDaVida, useTextosDaVida } from "../vida/textos";
import { blocosDoFio, fioPronto, instanteNoFuso, LIMITE_DO_BLOCO, quandoNoFuso } from "@/lib/rede/publicar/compositor";
import { redeCompositor, type PedidoDoCompositor } from "@/lib/rede/publicar/cliente-compositor";
import { textoDaFigurinha } from "@/lib/rede/publicar/figurinhas";
import { CabecaDoFio, FioDoEscrever } from "../compositor/FioDoEscrever";
import { textoDoErroDoCompositor, useTextosDoCompositor } from "../compositor/textos";
import { grupoDoPost, pedidoCifrado, postCifrado } from "../restrito/grupo";
import { SeloDaCifra } from "../restrito/NaTela";
import { textoDaCifra, useTextosDoRestrito } from "../restrito/textos";
import { confirmar } from "@/components/perguntar";
import { camposDoP4, ESCOLHAS_VAZIAS, fonteDoCampo, usaP4, type EscolhasDoP4 } from "@/lib/rede/publicar/p4-compositor";
import { redeP4, type PedidoDoP4 } from "@/lib/rede/publicar/cliente-p4";
import { CamposDoP4 } from "../p4/CamposDoP4";
import { textoDoErroDoP4, useTextosDoP4 } from "../p4/textos";

/** O que dá para focar com Tab dentro do diálogo (para prender o foco nele). */
const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]';

/** As opções de "Quem vê" para o que está sendo escrito (lib/rede/publicar/visibilidade.ts), como gancho: o que entra fica parado. */
function useOpcoesDeVisibilidade(ctx: ContextoDaVisibilidade): OpcaoDeVisibilidade[] {
  return opcoesDeVisibilidade(ctx);
}

/** O ícone de "Quem vê" pelo público: o globo do Fediverso só quando o post sai da Alumia (federa); os outros não saem. */
export function iconeDoPublico(p: PublicoDoEscrever): NomeDoIcone {
  return p === "internet" ? "fediverso" : p === "eu" ? "cadeado" : p === "roda" ? "roda" : p === "comunidade" ? "comunidades" : p === "seguidores" ? "perfil" : p === "equipe" ? "escudo" : p === "membros" ? "inicio" : "nucleos";
}

type ComunidadeResumida = Pick<Comunidade, "slug" | "nome" | "categoria" | "publico_padrao"> & { tipo?: Comunidade["tipo"] };
interface Lugar {
  slug: string;
  nome: string;
  categoria: string;
  cor: CorDaComunidadeNum;
  /** "fechada": o post com público "comunidade" vai cifrado (P21). */
  tipo?: Comunidade["tipo"];
}

/** Um rascunho da conta já aberto aqui: "ok" (decifrado), "outro" (cifrado noutro aparelho) ou "antigo" (de antes da cifra). */
type RascunhoNaLista = RascunhoDoServidor & { estado: "ok" | "outro" | "antigo" };
const VAZIO: Omit<RascunhoDoServidor, "id"> = { tipo: "post", texto: "", titulo: "", corpo: "", comunidade: null, publico: "membros", responde_quem: "todos" };

/** Cifra no aparelho e guarda na conta: o servidor recebe só { v, iv, cifra } (rede_rascunho_limpo recusa texto claro). */
async function salvarCifrado(r: RascunhoDoServidor) {
  const { id, ...conteudo } = r;
  const cifrado = await cifrarRascunho(conteudo, chaveDoAparelho());
  return redePub.salvarRascunho({ id, ...cifrado });
}

/**
 * O pedido usa o que só a B1 cumpre (enquete com resultado só no fim ou ordem embaralhada)? Um banco sem a B1 ignoraria a escolha
 * em silêncio e mostraria a parcial que a pessoa pediu para esconder: nesse caso o pedido não cai na função de antes.
 */
/** A roda de exemplo da prévia (nada vai ao banco). */
const RODA_DE_EXEMPLO: PessoaDaMinhaRoda[] = [
  { handle: "rosavermelha", nome: "Rosa Vermelha", cor: 1 },
  { handle: "liaquilombo", nome: "Lia Quilombo", cor: 3 },
];

const soComB1 = (pedido: PedidoPublicar) => Boolean(pedido.enquete?.so_no_fim || pedido.enquete?.embaralhar);

/**
 * Publica com os campos da B1 (quem pode citar, enquete avançada); um banco sem a B1 recebe o pedido de antes. Nesse banco a
 * citação segue aberta a todos, e por isso a linha "quem pode citar" nem aparece (citaNoBanco): a tela não promete o que o banco
 * não cumpre.
 */
async function publicarComB1(pedido: PedidoPublicar): Promise<Post> {
  try {
    return await redePub.publicarMais(pedido);
  } catch (e) {
    if (!faltaNoBanco(e) || soComB1(pedido)) throw e;
    const { citar_quem: _c, ...resto } = pedido;
    void _c;
    return rede.publicar(resto);
  }
}

const LIMITE_POST = 500;
const LIMITE_CORPO = 10_000;
const ESPERA_DO_RASCUNHO_MS = 2500;

/**
 * Escrever na cara nova (prancha celular-escrever-ato): Cancelar e o botão principal no alto; os tipos Post / Ato / Enquete /
 * Texto longo em pílulas (o Ato vem do encaixe da F2; na prévia, um dublê do formulário com o mosaico apagado); as linhas Onde
 * publicar, Quem vê ("Público, também no Fediverso") e Quem responde. Mais: desfazer envio por 10 s (o pedido só sai depois),
 * rascunho guardado na conta (até 20, 30 dias; sem a função no banco, fica só no aparelho, como hoje), lembrete de descrição
 * nas imagens e as verificações das frentes antes de publicar. Imagens, áudio, opções da enquete e agendamento são os mesmos
 * do pacote publicar (ExtrasDoEscrever). Publica sempre com o codinome.
 */
export function EscreverDaAlumia2({
  s,
  lang,
  situacao,
  comunidade,
  respostaA,
  textoInicial = "",
  tipoInicial,
  aoFechar,
  aoPublicar,
  barrinha,
}: {
  s: TextosDaRede;
  lang: string;
  situacao: Situacao;
  comunidade?: ComunidadeResumida | null;
  respostaA?: Post | null;
  textoInicial?: string;
  tipoInicial?: TipoAoEscrever;
  aoFechar: () => void;
  aoPublicar: (post: Post) => void;
  /**
   * A barrinha (A15 do P5, com o compositor do prompt 4): o mesmo Escrever, sem janela, numa caixa de texto que publica dali (com o
   * Desfazer, a chave do envio e as verificações de sempre). `aoExpandir` abre o editor completo com o texto; `acoes` são os
   * botões de imagem, enquete e ato que já abriam o Escrever no tipo certo. Depois de publicar, `aoFechar` limpa a barrinha.
   */
  barrinha?: { aoExpandir: (texto: string) => void; acoes?: React.ReactNode };
}) {
  const al2 = useAlumia2();
  const previa = Boolean(al2?.previa);
  const resposta = Boolean(respostaA);
  const naBarrinha = Boolean(barrinha);
  const encaixeDoAto = ENCAIXES.tiposDoCompositor.find((x) => x.tipo === "ato");
  const temAto = !resposta && (Boolean(encaixeDoAto) || previa);
  const [tipo, setTipo] = useState<TipoDoCompositor>(tipoInicial === "ato" && temAto ? "ato" : tipoInicial === "enquete" ? "enquete" : tipoInicial === "longo" ? "longo" : "post");
  const [longoComo, setLongoComo] = useState<"discussao" | "duvida">("discussao");
  const [texto, setTexto] = useState(textoInicial);
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [anuncioDoTipo, setAnuncioDoTipo] = useState("");
  const [onde, setOnde] = useState<string | null>(comunidade?.slug ?? null);
  const [publico, setPublico] = useState<PublicoDoEscrever>(comunidade ? (comunidade.publico_padrao === "internet" ? "internet" : comunidade.publico_padrao === "comunidade" ? "comunidade" : "membros") : "membros");
  const [aberta, setAberta] = useState<"onde" | "quem" | "responde" | "cita" | "some" | null>(null);
  // Onda 9 (9D): só a minha roda, não listado, o prazo para sumir e o aviso antes de publicar ofensa (só no aparelho).
  const vt = useTextosDaVida(lang);
  const [someEm, setSomeEm] = useState<SomeEm | null>(null);
  const [naoListado, setNaoListado] = useState(false);
  const [roda, setRoda] = useState<PessoaDaMinhaRoda[] | null>(() => (previa ? RODA_DE_EXEMPLO : null));
  // O Fediverso para quem escreve: o modo total (o interruptor; o banco confirma em rede_fed_situacao) e a federação do perfil.
  // Na prévia, tudo ligado, para a tela mostrar todas as opções.
  const [fediverso, setFediverso] = useState<FediversoDoEscrever>(() =>
    previa ? { total: true, ligado: true, pode: true } : { total: ligado("fediverso-total"), ligado: null, pode: null },
  );
  const [ofensaAvisada, setOfensaAvisada] = useState("");
  // Onda 12 (12A): o fio montado de uma vez (os blocos 2 em diante; nulo: um post só) e o "Agendar" de um rascunho.
  const tco = useTextosDoCompositor(lang);
  const [fioBlocos, setFioBlocos] = useState<string[] | null>(null);
  const [pedirAgenda, setPedirAgenda] = useState(0);
  const [notaDaOfensa, setNotaDaOfensa] = useState(false);
  // Prompt 4 (compositor, "alumia-p4-compositor"): versão curta, capa, "Mande a sua" e fonte. Desligado, nada disso aparece nem vai.
  const p4Ligado = ligado("alumia-p4-compositor");
  const tp4 = useTextosDoP4(lang, p4Ligado);
  const [escolhasP4, setEscolhasP4] = useState<EscolhasDoP4>(ESCOLHAS_VAZIAS);
  const [lugares, setLugares] = useState<Lugar[]>(() =>
    previa ? Object.entries(COMUNIDADES_DE_EXEMPLO).map(([slug, c]) => ({ slug, nome: c.nome, categoria: "lutas", cor: c.cor })) : [],
  );
  const [dadosDoAto, setDadosDoAto] = useState<Record<string, unknown>>({});
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  // O aviso de antes de publicar (ofensa, descrição da foto, link perigoso, foto sem borrar) vale para o texto que foi conferido:
  // mudou o texto ou o tipo, ele não aparece mais (nulo: aviso que não depende do texto, como o de agendado).
  const [avisoDe, setAvisoDe] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [envio, setEnvio] = useState<{ desde: number; chave: string } | null>(null);
  // O envio que o relógio já disparou: um envio sai UMA vez, mesmo que a tela redesenhe (o relógio era refeito a cada desenho e,
  // parado em "0 s", mandava o mesmo post de novo até a primeira resposta chegar: os posts repetidos).
  const disparado = useRef<string | null>(null);
  // A chave deste conteúdo (lib/backend-envio.ts): a mesma enquanto o envio não deu certo (o reenvio depois de uma queda de rede
  // não duplica o post); nova depois de publicar ou desfazer.
  const chaveDoEnvio = useRef<string | null>(null);
  const [agora, setAgora] = useState(0);
  const [lembrouAlt, setLembrouAlt] = useState(false);
  const [rascunhoId, setRascunhoId] = useState<string | null>(null);
  const [rascunhoOnde, setRascunhoOnde] = useState<"conta" | "aparelho" | "cheio" | "ato" | null>(null);
  const [rascunhos, setRascunhos] = useState<RascunhoNaLista[]>([]);
  // "Guardar rascunhos na conta": desligado por padrão (opt-in); a escolha fica neste aparelho.
  const [naConta, setNaConta] = useState(() => guardarNaConta());
  const [notaDaConta, setNotaDaConta] = useState("");
  const [tc, setTc] = useState<TextosDaConversa | null>(null);
  const [saindo, setSaindo] = useState(false);
  const dialogo = useRef<HTMLDivElement>(null);
  const semServidor = useRef(false);
  // "Desfazer" tocado quando o pedido já tinha saído (o relógio chegou a zero): o post volta pelo rede_pub_desfazer.
  const desfeitoNoEnvio = useRef(false);

  const tipoBanco: TipoDePost = tipo === "ato" ? "post" : (tipoDoBanco(tipo, longoComo) ?? "post");
  const longo = !resposta && tipo === "longo";
  const pub = useEscreverPub({
    tipo: tipoBanco,
    resposta,
    respostaPropria: Boolean(respostaA?.meu),
    texto,
    titulo,
    corpo,
    aplicarRascunho: (r) => {
      setTipo(r.tipo === "discussao" || r.tipo === "duvida" ? "longo" : r.tipo === "enquete" ? "enquete" : "post");
      if (r.tipo === "duvida") setLongoComo("duvida");
      setTexto(r.texto);
      setTitulo(r.titulo);
      setCorpo(r.corpo);
    },
  });

  // "Quem pode citar" só aparece quando o banco cumpre (a B1 no ar). Na prévia, aparece (é o dublê).
  const [citaNoBanco, setCitaNoBanco] = useState(previa);
  useEffect(() => {
    if (resposta || previa) return;
    let vivo = true;
    void redePub.cumpreQuemCita().then((sim) => vivo && setCitaNoBanco(sim));
    return () => {
      vivo = false;
    };
  }, [resposta, previa]);

  // "Só eu" só aparece quando o banco já o conhece (num banco de antes o post ficaria para os seguidores). Na prévia, aparece.
  const [soEuNoBanco, setSoEuNoBanco] = useState(previa);
  useEffect(() => {
    if (resposta || previa) return;
    let vivo = true;
    chamar<number>("rede_alumia_versao").then(
      (v) => vivo && setSoEuNoBanco(Number(v) >= VERSAO_DO_SO_EU),
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [resposta, previa]);

  // A situação do Fediverso para "Alumia e Fediverso": o modo total que vale no banco e se o perfil da pessoa já sai. Sem resposta
  // (o banco não tem a função, ou falhou), fica o interruptor e a opção aparece; quem decide de verdade é rede_publicar.
  useEffect(() => {
    if (resposta || previa) return;
    let vivo = true;
    alumia.situacao().then(
      (s) => {
        if (!vivo || !s) return;
        const total = (s as { total?: unknown }).total;
        setFediverso({ total: typeof total === "boolean" ? total : ligado("fediverso-total"), ligado: Boolean(s.ligado), pode: s.pode !== false });
      },
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [resposta, previa]);

  // As comunidades onde a pessoa pode publicar (Onde publicar). Na prévia, as das pranchas.
  useEffect(() => {
    if (resposta || previa) return;
    let vivo = true;
    clienteComunidades.lista().then(
      (r) => {
        if (!vivo) return;
        setLugares(r.itens.filter((c) => c.situacao === "membro").map((c) => ({ slug: c.slug, nome: c.nome, categoria: c.categoria, cor: corDaComunidade(c.slug), tipo: c.tipo })));
      },
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [resposta, previa]);

  // Os rascunhos guardados na conta (só com "guardar na conta" ligado, para quem abre o Escrever vazio, e nunca para resposta).
  // Cada um chega cifrado e é aberto aqui, com a chave deste aparelho; o servidor nunca viu o texto.
  useEffect(() => {
    if (resposta || previa || textoInicial || !naConta || naBarrinha) return;
    let vivo = true;
    redePub.rascunhos().then(
      async (lista) => {
        const chave = chaveDoAparelho();
        const abertos = await Promise.all(
          (Array.isArray(lista) ? lista : []).map(async (r): Promise<RascunhoNaLista> => {
            if (typeof r.cifra === "string") {
              const claro = await decifrarRascunho<Omit<RascunhoDoServidor, "id">>(r, chave);
              return claro ? { ...VAZIO, ...claro, id: r.id, atualizado_em: r.atualizado_em, estado: "ok" } : { ...VAZIO, id: r.id, atualizado_em: r.atualizado_em, estado: "outro" };
            }
            return { ...VAZIO, ...r, id: r.id, atualizado_em: r.atualizado_em, estado: "antigo" };
          }),
        );
        if (vivo) setRascunhos(rascunhosValidos(abertos, Date.now()));
      },
      (e) => {
        if (faltaNoBanco(e)) semServidor.current = true;
      },
    );
    return () => {
      vivo = false;
    };
  }, [resposta, previa, textoInicial, naConta, naBarrinha]);

  // A roda (só a dona lê) chega quando a pessoa abre "Quem vê": é dela que sai o número "N na roda".
  useEffect(() => {
    if (resposta || previa || roda !== null || (aberta !== "quem" && publico !== "roda")) return;
    let vivo = true;
    redePub.roda().then(
      (l) => vivo && setRoda(Array.isArray(l) ? l : []),
      () => vivo && setRoda([]),
    );
    return () => {
      vivo = false;
    };
  }, [resposta, previa, roda, aberta, publico]);

  // Autocompletar de @ (pacote conversa), como no Escrever de hoje.
  useEffect(() => {
    let vivo = true;
    carregarTextosDaConversa(lang).then(
      (x) => vivo && setTc(x),
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [lang]);

  // "Pôr imagem" do compositor da linha: abre já na escolha da imagem.
  useEffect(() => {
    if (tipoInicial !== "imagem") return;
    const id = window.setTimeout(() => dialogo.current?.querySelector<HTMLInputElement>('input[type="file"]')?.click(), 300);
    return () => window.clearTimeout(id);
  }, [tipoInicial]);

  // Foco (WCAG 2.4.3): ao abrir, vai para o campo principal (no Ato, o nome do ato); ao fechar, volta para quem abriu. A barrinha
  // fica na página: não puxa o foco ao aparecer.
  useEffect(() => {
    if (naBarrinha) return;
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const id = window.setTimeout(() => {
      const d = dialogo.current;
      if (!d || d.contains(document.activeElement)) return;
      (d.querySelector<HTMLElement>("[data-al2-foco]") ?? d.querySelector<HTMLElement>("textarea, input:not([type=file]):not([type=hidden])") ?? d).focus();
    }, 0);
    return () => {
      window.clearTimeout(id);
      if (antes?.isConnected) antes.focus();
    };
  }, [naBarrinha]);

  // O "Enviando em N s": o foco vai para o Desfazer; desfeito, volta para o botão principal.
  const botaoDesfazer = useRef<HTMLButtonElement>(null);
  const botaoPrincipal = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (envio) botaoDesfazer.current?.focus();
  }, [envio]);
  // O aviso fica no rodapé da COLUNA DO MEIO (no computador, centrado nela, e não no meio da tela por cima do cartão do ato); no
  // celular, logo acima da barra de baixo. Enquanto ele está na tela, a coluna ganha uma folga embaixo (alumia.css) para nada
  // clicável ficar escondido atrás dele.
  const [centroDoAviso, setCentroDoAviso] = useState<number | null>(null);
  useEffect(() => {
    if (!envio) return;
    let quadro = 0;
    const medir = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const coluna = document.getElementById("rede-linha");
        if (!coluna || window.innerWidth < 1024) return setCentroDoAviso(null);
        const r = coluna.getBoundingClientRect();
        setCentroDoAviso(Math.round(r.left + r.width / 2));
      });
    };
    medir();
    window.addEventListener("resize", medir);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("resize", medir);
    };
  }, [envio]);

  const lugar = lugares.find((l) => l.slug === onde) ?? (comunidade && onde === comunidade.slug ? { slug: comunidade.slug, nome: comunidade.nome, categoria: comunidade.categoria, cor: corDaComunidade(comunidade.slug), tipo: comunidade.tipo } : null);

  // Rascunho na conta: guarda 2,5 s depois da última tecla; sem a função no banco, avisa que fica só no aparelho.
  const rascunhoAtual = useMemo<RascunhoDoServidor>(
    () => ({ id: rascunhoId, tipo, texto, titulo, corpo, comunidade: onde, publico, responde_quem: pub.respondeQuem }),
    [rascunhoId, tipo, texto, titulo, corpo, onde, publico, pub.respondeQuem],
  );
  useEffect(() => {
    // A barrinha não guarda rascunho a cada tecla (o "Expandir" leva o texto para o Escrever, que guarda).
    if (resposta || previa || envio || barrinha) return;
    const id = window.setTimeout(() => {
      // Desligado (o padrão), servidor sem a função, ou rascunho de ato: fica só no aparelho (o ato diz onde e quando: nunca sai daqui).
      if (!naConta || semServidor.current || tipo === "ato") {
        if (rascunhoTemTexto(rascunhoAtual)) setRascunhoOnde(tipo === "ato" ? "ato" : "aparelho");
        return;
      }
      if (!rascunhoTemTexto(rascunhoAtual)) {
        if (rascunhoAtual.id) void redePub.apagarRascunho(rascunhoAtual.id).then(() => setRascunhoId(null), () => undefined);
        return;
      }
      void salvarCifrado(rascunhoAtual).then(
        (r) => {
          setRascunhoId(r.id);
          setRascunhoOnde("conta");
        },
        (e) => {
          if (faltaNoBanco(e)) semServidor.current = true;
          // 20 rascunhos na conta: este fica no aparelho, e a tela diz como abrir vaga.
          setRascunhoOnde(codigoDoErro(e) === "limite_rascunhos" ? "cheio" : "aparelho");
        },
      );
    }, ESPERA_DO_RASCUNHO_MS);
    return () => window.clearTimeout(id);
    // rascunhoAtual.id muda só quando o servidor responde: não precisa guardar de novo por isso
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, titulo, corpo, tipo, onde, publico, pub.respondeQuem, resposta, previa, envio, naConta]);

  /** Liga ou desliga "guardar rascunhos na conta". Ao desligar, apaga todos os da conta (LGPD art. 18, VI: eliminação). */
  function mudarNaConta(sim: boolean) {
    marcarGuardarNaConta(sim);
    setNaConta(sim);
    setNotaDaConta("");
    if (!sim) {
      setRascunhos([]);
      setRascunhoId(null);
      setRascunhoOnde(rascunhoTemTexto(rascunhoAtual) ? "aparelho" : null);
      void redePub.apagarTodosRascunhos().then(
        () => setNotaDaConta(al2?.t.b1.naContaDesligou ?? ""),
        () => undefined,
      );
    }
  }

  // O seletor de "Quem vê" (decisão de 17/11, D3/P9): só eu e amigos próximos (a roda) são do perfil e não valem para o ato (que é
  // chamado para a rua); "Alumia e Fediverso" só aparece com o modo total do Fediverso ligado, e fica apagada, com o porquê, para
  // quem não ligou a federação no perfil (lib/rede/publicar/visibilidade.ts).
  // "Só eu" e a roda são do perfil (sem comunidade) e não valem para o ato (que é chamado para a rua).
  const comRoda = !lugar && tipo !== "ato" && Boolean(vt);
  const opcoesQuemVe = useOpcoesDeVisibilidade({
    comunidade: lugar ? { categoria: lugar.categoria, tipo: lugar.tipo } : null,
    ato: tipo === "ato",
    comVida: comRoda,
    soEu: soEuNoBanco,
    equipe: Boolean(situacao.equipe),
    fediverso,
  });
  const publicos: PublicoDoEscrever[] = opcoesQuemVe.map((o) => o.valor);
  // A escolha ainda vale aqui? Trocar de lugar, virar ato ou a federação desligada no perfil podem tirá-la da lista: nesse caso o
  // Publicar não sai, volta para "Todos na Alumia" (que nunca sai) e abre "Quem vê" para a pessoa ver (publicar(), abaixo).
  const publicoQueVale = visibilidadeQueVale(publico, opcoesQuemVe);
  // O público que o banco confere: "só eu" e a roda passam pela conferência de "seguidores" e o banco grava a escolha
  // (rede_pub_vida_publicar).
  const publicoBanco: Publico = publicoParaConferir(publico);
  const rotuloDoPublico = (p: PublicoDoEscrever) => {
    const tv = al2?.t.visibilidade;
    if (!tv) return p;
    return { eu: tv.eu, roda: tv.roda, seguidores: tv.seguidores, membros: tv.membros, internet: lugar ? tv.internetComunidade : tv.internet, comunidade: tv.comunidade, nucleo: al2.t.escrever.publicoNucleo, equipe: tv.equipe }[p];
  };
  // As escolhas da vida do post que pedem a função da onda 9 (nada disso é escolhido numa resposta nem num ato).
  const comVida = !resposta && tipo !== "ato" && (vaiPelaVida(publico) || naoListado || someEm !== null);
  /** "Alumia e Fediverso" escolhido, mas a vida do post (não listado, some sozinho) não deixa sair. */
  const internetPresa = !resposta && publico === "internet" && (naoListado || someEm !== null);
  const assinaturaDoTexto = JSON.stringify([tipo, titulo, texto, corpo, fioBlocos, escolhasP4]);
  const avisoVisivel = aviso && (avisoDe === null || avisoDe === assinaturaDoTexto) ? aviso : "";
  const tipos: TipoDoCompositor[] = ["post", ...(temAto ? (["ato"] as TipoDoCompositor[]) : []), "enquete", "longo", ...(situacao.equipe ? (["aviso"] as TipoDoCompositor[]) : [])];
  const nomeDoAto = typeof dadosDoAto.nome === "string" ? dadosDoAto.nome : "";
  // As imagens anexadas, na ordem, para o "Pôr a imagem N aqui" do texto longo (a prévia usa o endereço local do aparelho).
  const imagensDoTexto = useMemo(() => pub.imagens.map((i) => ({ src: i.url, alt: i.alt, largura: i.largura, altura: i.altura })), [pub.imagens]);
  const tamanho = longo ? corpo.length : texto.length;
  // No fio, o primeiro campo aceita um texto colado maior (o "Dividir o texto em blocos" corta); cada bloco sai com até 500.
  const fioLigado = fioBlocos !== null && !resposta && tipo === "post";
  const maximo = longo ? LIMITE_CORPO : fioLigado ? LIMITE_DO_BLOCO * 10 : LIMITE_POST;
  // Posts restritos (P21): o post curto com público "comunidade" numa comunidade FECHADA vai cifrado deste aparelho (MLS), e a
  // resposta curta a um post cifrado vai cifrada para o mesmo grupo (o banco confere que é o grupo do post de cima). Enquete, texto
  // longo, fio e ato seguem o caminho de sempre, e nesses o selo da cifra não aparece (a tela não promete o que não faz).
  const grupoCifrado =
    tipo !== "post" || fioLigado ? null : respostaA ? (postCifrado(respostaA) ? respostaA.grupo : null) : grupoDoPost({ publico, comunidade: onde, tipoDaComunidade: lugar?.tipo });
  const tr = useTextosDoRestrito(lang, grupoCifrado !== null);
  // O que vai do prompt 4 neste pedido (só o que vale aqui: a capa que caiu fora das imagens, por exemplo, não vai).
  const imagensAnexadas = pub.imagens.length;
  const camposP4 = useMemo(
    () => (p4Ligado && !resposta && tipo !== "ato" ? camposDoP4(escolhasP4, { longo, resposta, tipo: tipoBanco, imagens: imagensAnexadas }) : {}),
    [p4Ligado, resposta, tipo, escolhasP4, longo, tipoBanco, imagensAnexadas],
  );
  // Só a figurinha (onda 12): sem texto, o post é a figurinha, e o texto que vai é o nome dela.
  const soFigurinha = Boolean(pub.figurinha) && !texto.trim() && !longo && tipo !== "enquete" && tipo !== "ato" && !fioLigado;
  // O formulário do ato da F2 entrega o que conferiu ({ pronto, problemas }); o dublê da prévia só tem o nome.
  const problemasDoAto = typeof dadosDoAto.problemas === "object" && dadosDoAto.problemas ? Object.keys(dadosDoAto.problemas as Record<string, unknown>) : null;
  const atoPronto = typeof dadosDoAto.pronto === "boolean" ? dadosDoAto.pronto : nomeDoAto.trim().length >= 2;
  const pronto =
    tipo === "ato"
      ? atoPronto
      : (longo ? titulo.trim().length >= 5 && corpo.trim().length >= 10 : texto.trim().length >= 1 || soFigurinha) && pub.podeEnviar && (Boolean(pub.aposAto) || !pub.agendar || pub.agendaOk) &&
        (!fioLigado || fioPronto([texto, ...(fioBlocos ?? [])]));

  const montarPedido = useCallback(async (): Promise<PedidoPublicar> => {
    const nomeDaFigurinha = pub.figurinha && tco ? tco.figurinhas.nomes[pub.figurinha] : "";
    const textoQueVai = soFigurinha && tco ? textoDaFigurinha(tco.figurinhas.texto, nomeDaFigurinha) : texto.trim();
    if (resposta) return { texto: textoQueVai, resposta_a: respostaA?.id, ...(await pub.preparar()), ...(soFigurinha ? { so_figurinha: true } : {}) } as PedidoPublicar;
    if (tipo === "ato") {
      // O ato é da F2: o encaixe dá os campos (nome, quando, onde, chamado); o banco da F2 recebe em `ato`.
      return { tipo: "chamado", texto: String(dadosDoAto.chamado ?? texto).trim(), publico: publicoBanco, ...(onde ? { comunidade: onde } : {}), ato: dadosDoAto } as unknown as PedidoPublicar;
    }
    const base: PedidoPublicar = { tipo: tipoBanco, ...(longo ? { titulo: titulo.trim(), corpo: corpo.trim() } : { texto: textoQueVai }), publico: publicoBanco, ...(onde ? { comunidade: onde } : {}) };
    return { ...base, ...(await pub.preparar()), ...(soFigurinha ? { so_figurinha: true } : {}) } as PedidoPublicar;
  }, [resposta, texto, respostaA, pub, tipo, dadosDoAto, publicoBanco, onde, tipoBanco, longo, titulo, corpo, soFigurinha, tco]);

  // O envio de verdade, depois dos 10 s.
  const enviarDeVerdade = useCallback(async (chave: string) => {
    setOcupado(true);
    setErro("");
    /** Deu certo: a próxima publicação ganha outra chave. */
    const publicado = () => {
      if (chaveDoEnvio.current === chave) chaveDoEnvio.current = null;
    };
    try {
      if (previa) {
        setAviso(al2?.t.previa.aviso ?? "");
        setAvisoDe(null);
        setEnvio(null);
        return;
      }
      if (tipo === "ato" && encaixeDoAto && typeof dadosDoAto.pronto === "boolean") {
        // O ato é da F2: rede_ato_publicar (que chama o rede_publicar por dentro, com o nome, a palavra, a data, o ponto e a cidade).
        const { atos } = await import("@/lib/rede/cliente-atos");
        await atos.publicar(dadosDoAto as unknown as Parameters<typeof atos.publicar>[0], { publico: publicoBanco, comunidade: onde, chave_envio: chave });
        publicado();
        if (desfeitoNoEnvio.current) {
          setErro(al2?.t.escrever.naoDesfez ?? "");
          return;
        }
        setEnvio(null);
        aoFechar();
        return;
      }
      const montado = await montarPedido();
      let pedido = montado;
      if (grupoCifrado) {
        // Cifra no aparelho; o banco recebe o texto vazio, o grupo e o corpo "p2.…". A chave de alguém mudou: não publica.
        const { cifrarNoAparelho } = await import("../restrito/aparelho");
        const cifra = await cifrarNoAparelho(grupoCifrado, montado.texto ?? "");
        if (!cifra.ok) {
          setEnvio(null);
          setErro(tr ? textoDaCifra(tr, cifra.codigo) : "");
          return;
        }
        pedido = pedidoCifrado(montado, cifra) as PedidoPublicar;
      }
      pedido = { ...pedido, chave_envio: chave };
      if (!resposta && (pub.agendar || pub.aposAto) && tipo !== "ato") {
        // Com repetição ou "quando o ato terminar", pelo rede_pub_agendar_mais; sem a B1 no banco, a data única de antes.
        const opcoes = { ...(pub.repetir ? { repetir: "semanal" as const, vezes: pub.repetir } : {}), ...(pub.aposAto ? { apos_ato: pub.aposAto } : {}) };
        // Onda 12 (L2-33): o dia e a hora valem no fuso escolhido, e o banco converte (rede_pub_o12_agendar). Num banco sem a onda 12, o
        // instante convertido aqui vai pelo caminho de antes, só quando o pedido não leva nada que só a onda 12 guarda.
        const local = pub.aposAto ? null : pub.agendar;
        const agendado = await (usaP4(camposP4)
          ? // Prompt 4: a versão curta, a capa, o convite e a fonte valem quando o post sair (rede_pub_p4_agendar, por cima da onda 12).
            redeP4.agendar({ ...(pedido as PedidoDoCompositor), ...camposP4 } as PedidoDoP4, local, local ? pub.fuso : null, opcoes)
          : redeCompositor.agendar(pedido as PedidoDoCompositor, local, local ? pub.fuso : null, opcoes)).catch((e) => {
          if (!faltaNoBanco(e) || pub.usaCompositor || usaP4(camposP4)) throw e;
          const pedirQuando = local ? (instanteNoFuso(local, pub.fuso)?.toISOString() ?? null) : null;
          if (local && !pedirQuando) throw e;
          return redePub.agendarMais(pedido, pedirQuando, opcoes).catch((e2) => {
            if (faltaNoBanco(e2) && pedirQuando && !pub.repetir && !pub.aposAto && !soComB1(pedido)) return redePub.agendar(pedido, pedirQuando);
            throw e2;
          });
        });
        publicado();
        const quando = new Date(agendado.quando);
        if (desfeitoNoEnvio.current) {
          // Desfeito no meio do caminho: o agendamento é cancelado e o texto continua na caixa.
          await redePub.cancelarAgendado(agendado.id);
          return;
        }
        pub.limpar();
        setEscolhasP4(ESCOLHAS_VAZIAS);
        setEnvio(null);
        setAviso(preencher(pub.t?.agendar.agendado ?? "", { quando: quandoNoFuso(quando.toISOString(), local ? pub.fuso : null, lang) }));
        setAvisoDe(null);
        return;
      }
      const escolhasDaVida = { publico, ...(!vaiPelaVida(publico) && naoListado ? { nao_listado: true } : {}), ...(someEm ? { some_em: someEm } : {}) };
      // Onda 12 (L2-26): o fio montado de uma vez, numa chamada só (tudo ou nada). O Desfazer leva o fio inteiro.
      if (fioLigado) {
        const { texto: primeiro, ...resto } = pedido as PedidoDoCompositor;
        const r = await redeCompositor.fio({ ...resto, ...(!resposta ? escolhasDaVida : {}), blocos: [{ texto: primeiro ?? "" }, ...blocosDoFio(fioBlocos ?? []).map((b) => ({ texto: b }))] });
        publicado();
        if (desfeitoNoEnvio.current && r.ids.length) {
          const volta = await redeCompositor.desfazerFio(r.ids).then(
            (x) => x.desfeito,
            () => false,
          );
          if (volta) {
            setAviso(tco?.fio.desfeito ?? "");
            setAvisoDe(null);
            return;
          }
          desfeitoNoEnvio.current = false;
          setErro(al2?.t.escrever.naoDesfez ?? "");
        }
        pub.limpar();
        if (rascunhoId) void redePub.apagarRascunho(rascunhoId).catch(() => undefined);
        // Onda 12 (12B): o vídeo curto vai no primeiro bloco do fio. Se não entrar, o fio já saiu e a tela diz.
        const semVideoNoFio = r.posts[0] && compositorDaMidia && !resposta ? await compositorDaMidia.depoisDePublicar(r.posts[0], { lang, s, situacao }) : null;
        if (r.posts[0]) aoPublicar(r.posts[0]);
        setEnvio(null);
        if (semVideoNoFio) {
          setTexto("");
          setFioBlocos(null);
          setAviso(semVideoNoFio);
          setAvisoDe(null);
          return;
        }
        if (r.esperando > 0) {
          setTexto("");
          setFioBlocos(null);
          setAviso(preencher(tco?.fio.esperando ?? "", { n: r.esperando }));
          setAvisoDe(null);
          return;
        }
        if (r.posts[0]?.retido) {
          setAviso(s.post.retido);
          setAvisoDe(null);
          return;
        }
        aoFechar();
        return;
      }
      // Arranjo, legenda, figurinha ou mais de 4 imagens: pela função da onda 12, que embrulha a da onda 9 (roda, não listado e prazo
      // continuam valendo). Sem essas escolhas, o caminho de sempre.
      // Roda, não listado ou prazo: pela função da onda 9, sem nunca cair num caminho que publique mais aberto do que o escolhido.
      // Prompt 4 (versão curta, capa, convite, fonte): pela função dele, que embrulha a da onda 12 (tudo dela continua valendo).
      const post = usaP4(camposP4)
        ? await redeP4.publicar({ ...(pedido as PedidoDoCompositor), ...(!resposta ? escolhasDaVida : {}), ...camposP4 })
        : pub.usaCompositor
        ? await redeCompositor.publicar({ ...(pedido as PedidoDoCompositor), ...(!resposta ? escolhasDaVida : {}) })
        : comVida
        ? await redePub.publicarComVida({ ...pedido, publico, ...(!vaiPelaVida(publico) && naoListado ? { nao_listado: true } : {}), ...(someEm ? { some_em: someEm } : {}) })
        : await publicarComB1(pedido);
      publicado();
      if (desfeitoNoEnvio.current && post.id) {
        // Desfeito no meio do caminho: o banco apaga o post (até 30 s, só o autor) e o texto continua na caixa.
        const volta = await redePub.desfazer(post.id).then(
          (r) => r.desfeito,
          () => false,
        );
        if (volta) return;
        // Não deu (a triagem segurou, ou alguém já respondeu): o post fica publicado e a tela diz.
        desfeitoNoEnvio.current = false;
        aoPublicar(post);
        pub.limpar();
        setTexto("");
        setTitulo("");
        setCorpo("");
        if (rascunhoId) void redePub.apagarRascunho(rascunhoId).catch(() => undefined);
        setAviso("");
        setErro(al2?.t.escrever.naoDesfez ?? "");
        return;
      }
      // A avaliação de fora (avaliar-comunidade) não recebe post da Alumia (onda 9): o retido espera a mediação.
      pub.limpar();
      setEscolhasP4(ESCOLHAS_VAZIAS);
      if (rascunhoId) void redePub.apagarRascunho(rascunhoId).catch(() => undefined);
      // Onda 12 (12B): o vídeo curto entra no post que acabou de sair, antes de fechar o Escrever. Se não entrar, o post já saiu
      // e a tela diz (o Escrever fica aberto com a frase).
      const semVideo = post.id && compositorDaMidia && !resposta ? await compositorDaMidia.depoisDePublicar(post, { lang, s, situacao }) : null;
      aoPublicar(post);
      setEnvio(null);
      if (semVideo) {
        setTexto("");
        setAviso(semVideo);
        setAvisoDe(null);
        return;
      }
      if (post.retido) {
        setAviso(s.post.retido);
        setAvisoDe(null);
        return;
      }
      aoFechar();
    } catch (e) {
      // O mesmo envio já tinha chegado ao banco (o pedido de antes saiu, mas a resposta se perdeu): mostra o que já foi publicado,
      // em vez de um erro e de um post repetido.
      if (codigoDoErro(e) === "envio_repetido") {
        publicado();
        const ja = await redePub.acharEnvio(chave).catch(() => null);
        pub.limpar();
        if (rascunhoId) void redePub.apagarRascunho(rascunhoId).catch(() => undefined);
        if (ja?.id) aoPublicar(ja);
        setEnvio(null);
        aoFechar();
        return;
      }
      setEnvio(null);
      // O ato tem erros próprios (a palavra do mosaico, o ponto, o link de apoio, a meta…): a frase certa vem dos textos dos atos.
      if (tipo === "ato" && encaixeDoAto) {
        const [{ carregarTextosDosAtos }, erros] = await Promise.all([import("@/lib/rede/textos-atos"), import("@/lib/rede/atos/erros")]);
        if (erros.codigoDoErro(e) !== "generico") {
          setErro(erros.fraseDoErro((await carregarTextosDosAtos(lang)).erros, e));
          return;
        }
      }
      if (comVida && vt && faltaNoBanco(e)) {
        setErro(vt.ajustes.indisponivel);
        return;
      }
      setErro((tp4 && textoDoErroDoP4(tp4, codigoDoErro(e))) || (tco && textoDoErroDoCompositor(tco, codigoDoErro(e))) || (vt && textoDoErroDaVida(vt, codigoDoErro(e))) || (pub.t && textoDoErroPublicar(pub.t, codigoDoErro(e))) || textoDoErro(s, e));
    } finally {
      desfeitoNoEnvio.current = false;
      setOcupado(false);
    }
  }, [previa, al2, montarPedido, resposta, pub, tipo, lang, rascunhoId, aoPublicar, s, situacao, aoFechar, encaixeDoAto, dadosDoAto, publicoBanco, onde, comVida, publico, naoListado, someEm, vt, fioLigado, fioBlocos, tco, grupoCifrado, tr, camposP4, tp4]);

  // Mudou o que está escrito: é outro envio (outra chave). O reenvio do MESMO texto, depois de um erro, leva a mesma chave.
  useEffect(() => {
    chaveDoEnvio.current = null;
  }, [assinaturaDoTexto]);

  // O relógio do "Enviando em N s": ao chegar a zero, envia UMA vez. O relógio é refeito sempre que a tela redesenha (o
  // enviarDeVerdade muda junto com o que está escrito); a marca `disparado` garante que o mesmo envio não sai de novo.
  useEffect(() => {
    if (!envio) return;
    const tique = () => {
      const n = Date.now();
      setAgora(n);
      if (segundosQueFaltam(envio.desde, n) === 0) {
        window.clearInterval(id);
        if (disparado.current === envio.chave) return;
        disparado.current = envio.chave;
        void enviarDeVerdade(envio.chave);
      }
    };
    const id = window.setInterval(tique, 250);
    return () => window.clearInterval(id);
  }, [envio, enviarDeVerdade]);

  // A17 (interface otimista): enquanto corre o "Enviando em N s", o post aparece no alto da linha (lib/rede/otimista.ts), pela chave do
  // envio; desfeito, recusado ou confirmado, sai dali. Resposta e post para mais tarde não entram na linha.
  const resumoDoEnvio = tipo === "ato" ? nomeDoAto.trim() : longo ? titulo.trim() : texto.trim();
  const imagensDoEnvio = pub.imagens.length;
  const vaiParaALinha = !resposta && !previa && !pub.agendar && !pub.aposAto;
  useEffect(() => {
    if (!envio || !vaiParaALinha) return;
    anunciarPostACaminho({ chave: envio.chave, texto: resumoDoEnvio, imagens: imagensDoEnvio, comunidade: onde });
    return () => retirarPostACaminho(envio.chave);
  }, [envio, vaiParaALinha, resumoDoEnvio, imagensDoEnvio, onde]);

  async function publicar() {
    setErro("");
    setAviso("");
    setAvisoDe(assinaturaDoTexto);
    // A escolha de "Quem vê" deixou de valer aqui: não publica mais aberto nem diferente do que a pessoa vê. Volta para "Todos na
    // Alumia" (que nunca sai) e abre a lista para ela conferir.
    if (!resposta && publicoQueVale !== publico) {
      setPublico(publicoQueVale);
      setAberta("quem");
      return;
    }
    // Lembrete de descrição (alt): uma vez; o segundo toque publica assim mesmo.
    if (!lembrouAlt && pub.imagens.some((i) => !i.alt.trim())) {
      setLembrouAlt(true);
      setAviso(al2?.t.escrever.semAlt ?? "");
      return;
    }
    // O fio sai na hora (onda 12): com o "mais tarde" marcado, a tela diz, em vez de publicar agora o que a pessoa quis para depois.
    if (fioLigado && (pub.agendar || pub.aposAto)) {
      setErro(tco?.fio.semAgenda ?? "");
      return;
    }
    // O post cifrado do grupo sai na hora pelo caminho de sempre (rede_publicar): agendar, prazo, não listado e os arranjos de imagem
    // vão por outras funções, que não levam o corpo cifrado. A tela diz, em vez de publicar sem cifra.
    if (grupoCifrado && (pub.agendar || pub.aposAto || comVida || pub.usaCompositor)) {
      setErro(tr?.semAgendar ?? "");
      return;
    }
    if (grupoCifrado && !tr) return;
    // Prompt 4: a versão curta, a capa, o convite e a fonte são texto aberto: no post cifrado, não vão (a tela diz, em vez de tirar
    // calada o que a autora escolheu). O fio sai bloco a bloco, sem eles. A fonte que não vale para aqui.
    if (grupoCifrado && usaP4(camposP4)) {
      setErro(tp4?.erros.semCifra ?? "");
      return;
    }
    if (fioLigado && usaP4(camposP4)) {
      setErro(tp4?.erros.semFio ?? "");
      return;
    }
    if (p4Ligado && !resposta && tipo !== "ato" && escolhasP4.fonte.trim() && !fonteDoCampo(escolhasP4.fonte)) {
      setErro(tp4?.erros.invalido_fonte ?? "");
      return;
    }
    // Item 136: o post cifrado leva só o texto. Imagem e áudio iriam abertos para o depósito, então a tela diz e não publica.
    if (grupoCifrado && (pub.imagens.length > 0 || pub.audio)) {
      setErro(tr?.semAnexo ?? "");
      return;
    }
    // Post agendado sai pelo agendador, que não leva roda, não listado nem prazo: a tela diz, em vez de publicar mais aberto.
    if (comVida && (pub.agendar || pub.aposAto)) {
      setErro(vt?.escrever.semAgendar ?? "");
      return;
    }
    // Aviso antes de publicar ofensa (L3-22): lista aberta, conferida aqui no aparelho; só avisa, e o segundo toque publica. Um
    // aviso só, que diz o que acontece de verdade: com o xingamento explícito da regra do banco (lib/rede/publicar/checagem.ts), o
    // post sai, mas passa pela leitura da mediação antes de aparecer; a frase diz isso junto, e não numa segunda nota que contradiz.
    const oQueVai = tipo === "ato" ? "" : [titulo, longo ? corpo : texto, ...(fioLigado ? (fioBlocos ?? []) : [])].join(" ");
    const achados = vt && avisoDeOfensaLigado() ? termosNoTexto(oQueVai) : [];
    const vaiParaLeitura = Boolean(vt) && checarTexto(oQueVai).avisa.some((a) => a.tipo === "odio");
    if ((achados.length || vaiParaLeitura) && ofensaAvisada !== normalizarParaAviso(oQueVai)) {
      setOfensaAvisada(normalizarParaAviso(oQueVai));
      setNotaDaOfensa(achados.length > 0);
      setAviso(
        achados.length
          ? `${preencher(vt?.escrever.ofensa ?? "", { termos: achados.slice(0, 3).join("”, “") })}${vaiParaLeitura ? ` ${vt?.escrever.ofensaLeitura ?? ""}` : ""}`
          : (vt?.escrever.ofensaSoLeitura ?? ""),
      );
      return;
    }
    setNotaDaOfensa(false);
    // As verificações das frentes (ex.: a F6 avisa de rosto ou placa na foto); uma que bloqueia para aqui.
    const r = await verificarAntesDePublicar(
      { texto: longo ? corpo : texto, tipo: tipo === "ato" ? "ato" : tipoBanco, publico: publicoBanco, comunidade: onde,
        // As fotos contadas para o modo ato (lib/rede/modoato/antes-de-publicar.ts): sem elas, o aviso de foto não borrada não dispara.
        extras: { ...(tipo === "ato" ? dadosDoAto : {}), imagens: pub.imagens.length, imagensSemBorrar: pub.imagens.filter((i) => i.areas.length === 0).length } },
      { lang, s, situacao },
    );
    if (!r.ok) {
      setAviso(r.aviso);
      if (r.bloqueia) return;
    }
    // Um envio já correndo (duplo clique, Enter repetido): não começa outro.
    if (envio || ocupado) return;
    const n = Date.now();
    desfeitoNoEnvio.current = false;
    chaveDoEnvio.current ??= novaChaveDeEnvio();
    disparado.current = null;
    setAgora(n);
    setEnvio({ desde: n, chave: chaveDoEnvio.current });
  }

  function desfazer() {
    // O ato não tem desfazer no banco (é da F2): se o pedido já saiu, o botão some (ver o aviso flutuante) e nada é fingido aqui.
    if (ocupado && tipo === "ato") return;
    // O pedido já saiu? O envio termina e desfaz no banco (rede_pub_desfazer); antes disso, ele nem sai.
    if (ocupado) desfeitoNoEnvio.current = true;
    // Desfeito antes de sair, nada chegou ao banco e a chave pode ficar; se já saiu, o post volta e o próximo envio é outro.
    if (ocupado) chaveDoEnvio.current = null;
    setEnvio(null);
    setAviso(al2?.t.escrever.desfeito ?? "");
    setAvisoDe(null);
    window.setTimeout(() => botaoPrincipal.current?.focus(), 0);
  }

  /**
   * Fechar sem perder texto: o rascunho é guardado NA HORA (na conta, e no aparelho como hoje), sem esperar os 2,5 s. A resposta
   * não tem rascunho: com texto, pergunta antes de descartar.
   */
  async function fechar() {
    if (envio) return;
    if (!previa && rascunhoTemTexto(rascunhoAtual)) {
      if (resposta) {
        if (!(await confirmar(al2?.t.escrever.descartarResposta ?? ""))) return;
      } else {
        escreverRascunho({ tipo: tipoBanco, texto, titulo, corpo });
        if (naConta && !semServidor.current && tipo !== "ato") void salvarCifrado(rascunhoAtual).catch(() => undefined);
      }
    }
    sair();
  }

  /** Fecha com a animação de saída (a janela desce ou encolhe em ~180 ms); sem movimento, fecha na hora. */
  function sair() {
    if (saindo) return;
    if (!comMovimento()) {
      aoFechar();
      return;
    }
    setSaindo(true);
    window.setTimeout(aoFechar, 180);
  }
  const fecharRef = useRef(fechar);
  useEffect(() => {
    fecharRef.current = fechar;
  });

  // Esc: primeiro fecha a lista aberta (Onde publicar, Quem vê, Quem responde); só depois o Escrever. Durante o envio, quem
  // manda é o Desfazer.
  useEffect(() => {
    const sair = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || envio || naBarrinha) return;
      if (aberta) {
        setAberta(null);
        return;
      }
      fecharRef.current();
    };
    window.addEventListener("keydown", sair);
    return () => window.removeEventListener("keydown", sair);
  }, [envio, aberta, naBarrinha]);

  // Tab preso dentro do diálogo (aria-modal): do último volta ao primeiro e vice-versa; o que estiver fora não recebe foco.
  function prenderTab(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab") return;
    const d = dialogo.current;
    if (!d) return;
    const lista = Array.from(d.querySelectorAll<HTMLElement>(FOCAVEIS)).filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0);
    if (!lista.length) return;
    const primeiro = lista[0];
    const ultimo = lista[lista.length - 1];
    const ativo = document.activeElement;
    if (e.shiftKey && (ativo === primeiro || !d.contains(ativo))) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && (ativo === ultimo || !d.contains(ativo))) {
      e.preventDefault();
      primeiro.focus();
    }
  }
  // Se o foco escapar por outro caminho (clique fora no computador, leitor de tela), volta para dentro.
  useEffect(() => {
    if (envio) return;
    const guarda = (e: FocusEvent) => {
      const d = dialogo.current;
      const alvo = e.target as Node | null;
      if (!d || !alvo || d.contains(alvo)) return;
      d.querySelector<HTMLElement>(FOCAVEIS)?.focus();
    };
    document.addEventListener("focusin", guarda);
    return () => document.removeEventListener("focusin", guarda);
  }, [envio]);

  function continuarRascunho(r: RascunhoNaLista) {
    if (r.estado === "outro") return;
    const tp = tipoDoRascunho(r.tipo);
    setTipo(tp === "ato" && !temAto ? "post" : tp);
    setTexto(r.texto);
    setTitulo(r.titulo);
    setCorpo(r.corpo);
    if (r.comunidade) setOnde(r.comunidade);
    if (r.publico) setPublico(r.publico as Publico);
    if (r.responde_quem) pub.setRespondeQuem(r.responde_quem as RespondeQuem);
    setRascunhoId(r.id);
    setRascunhos([]);
  }

  function apagarRascunho(r: RascunhoNaLista) {
    if (!r.id) return;
    setRascunhos((l) => l.filter((x) => x.id !== r.id));
    void redePub.apagarRascunho(r.id).catch(() => undefined);
  }

  if (!al2) return null;
  const { t } = al2;
  const faltam = envio ? segundosQueFaltam(envio.desde, agora || envio.desde) : SEGUNDOS_PARA_DESFAZER;
  const principal = tipo === "ato" ? t.escrever.chamarAto : resposta ? t.escrever.resposta : t.escrever.publicar;
  // Trocar de tipo leva o texto junto (o post vira o corpo do texto longo e volta), e avisa ao leitor de tela que o botão principal
  // mudou de nome ("Chamar ato"). No Ato, o texto fica guardado e volta se a pessoa trocar de novo (o aviso embaixo diz isso).
  const trocarTipo = (novo: TipoDoCompositor) => {
    if (novo === tipo) return;
    if (novo === "longo" && !corpo.trim() && texto.trim()) setCorpo(texto);
    if (tipo === "longo" && novo !== "longo" && !texto.trim() && corpo.trim() && corpo.length <= LIMITE_POST) setTexto(corpo);
    // O ato é chamado para a rua: "só eu" e a roda não valem para ele.
    if (novo === "ato" && vaiPelaVida(publico)) setPublico("membros");
    setTipo(novo);
    const botao = novo === "ato" ? t.escrever.chamarAto : t.escrever.publicar;
    setAnuncioDoTipo(preencher(t.escrever.tipoAnuncio, { tipo: t.escrever[novo], botao }));
  };
  const placeholder =
    resposta && respostaA
      ? preencher(t.escrever.respostaA, { nome: respostaA.autor.codinome })
      : tipo === "enquete"
        ? t.escrever.pergunta
        : longo
          ? t.escrever.corpo
          : t.escrever.texto;
  // Debaixo do botão desligado do Ato, o que falta (só os campos que já dá para nomear; o resto o formulário mostra).
  const camposDoAto = t.escrever.campos as Record<string, string>;
  const falta = tipo === "ato" && !pronto && problemasDoAto?.length ? preencher(t.escrever.falta, { campos: problemasDoAto.map((c) => camposDoAto[c] ?? c).join(", ") }) : "";
  const responde: RespondeQuem[] = ["todos", "seguindo", "mencionados", "ninguem"];
  const rotuloResponde = (q: RespondeQuem) => ({ todos: t.escrever.respondeTodos, seguindo: t.escrever.respondeSeguindo, mencionados: t.escrever.respondeMencionados, ninguem: t.escrever.respondeNinguem })[q];
  const rotuloCita = (q: CitarQuem) => ({ ninguem: t.b1.citaNinguem, seguindo: t.b1.citaSeguindo, todos: t.b1.citaTodos })[q];
  const ajudaCita = (q: CitarQuem) => ({ ninguem: t.b1.citaAjudaNinguem, seguindo: t.b1.citaAjudaSeguindo, todos: t.b1.citaAjudaTodos })[q];
  // A frase de cada opção diz quem vê e se o post sai da Alumia; a opção apagada diz por quê.
  const tv = t.visibilidade;
  const ajudaDoPublico = (o: OpcaoDeVisibilidade) =>
    o.desligada === "fediverso_impedido"
      ? tv.impedida
      : o.desligada === "fediverso_desligado_no_perfil"
        ? tv.desligadaNoPerfil
        : {
            eu: tv.euAjuda,
            roda: tv.rodaAjuda,
            seguidores: tv.seguidoresAjuda,
            membros: tv.membrosAjuda,
            internet: lugar ? tv.internetComunidadeAjuda : tv.internetAjuda,
            comunidade: lugar?.tipo === "fechada" ? tv.comunidadeFechadaAjuda : tv.comunidadeAjuda,
            nucleo: t.escrever.ajudaNucleo,
            equipe: tv.equipeAjuda,
          }[o.valor];
  // "Só mencionados" no post cifrado: os @ marcados vão em aberto (só os nomes), e a tela diz quais antes de publicar.
  const mencionadosQueVao = grupoCifrado && !resposta && pub.respondeQuem === "mencionados" ? mencionadosDoTexto(texto) : null;
  const rotuloDoPrazo = (x: SomeEm | null) => (vt ? (x === "24h" ? vt.escrever.h24 : x === "7d" ? vt.escrever.d7 : vt.escrever.nunca) : "");
  const avisoFlutuante = envio ? (
        <div className="al2 al2-aviso-flutuante" role="status" aria-live="polite" style={{ ["--al2-espera" as string]: `${SEGUNDOS_PARA_DESFAZER}s`, ...(centroDoAviso !== null ? { left: `${centroDoAviso}px` } : {}) }}>
          <span className="al2-aviso-relogio" aria-hidden>
            {faltam}
          </span>
          {ocupado && tipo === "ato" ? (
            // O chamado já está indo ao banco da F2, que não tem desfazer: diz a verdade em vez de um Desfazer que não desfaz.
            <span>{t.b1.desfazerAto}</span>
          ) : (
            <>
              <span>{preencher(t.escrever.enviandoEm, { s: faltam })}</span>
              <button ref={botaoDesfazer} type="button" onClick={desfazer} className="al2-desfazer al2-aperta">
                <Icone nome="desfazer" className="h-4 w-4" />
                {t.escrever.desfazer}
              </button>
            </>
          )}
          <span className="al2-aviso-barra" aria-hidden />
        </div>
      ) : null;

  // A barrinha (A15 do P5): o campo e o Publicar na própria página, com o "Expandir" para o editor completo. O que confere antes de
  // publicar (ofensa, links, as verificações das frentes, a chave do envio, o Desfazer de 10 s) é o mesmo do Escrever.
  if (barrinha) {
    return (
      <>
        <div className="p4c-barra" data-p4c="barrinha">
          <label className="block">
            <span className="sr-only">{placeholder}</span>
            <textarea
              className="p4c-barra-campo"
              rows={texto.includes("\n") || texto.length > 70 ? 4 : 1}
              placeholder={placeholder}
              maxLength={LIMITE_POST}
              value={texto}
              disabled={Boolean(envio)}
              aria-describedby="p4c-barra-dica"
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void publicar();
                }
              }}
            />
          </label>
          <span id="p4c-barra-dica" className="sr-only">{tp4?.barra.dica ?? ""}</span>
          {erro && (
            <p role="alert" className="p4c-barra-erro">
              {erro}
            </p>
          )}
          {avisoVisivel && (
            <p role="status" className="p4c-barra-nota">
              {avisoVisivel}
            </p>
          )}
          <div className="p4c-barra-acoes">
            {barrinha.acoes}
            <button type="button" className="p4c-botao ml-auto" onClick={() => barrinha.aoExpandir(texto)} title={tp4?.barra.expandirAjuda} disabled={Boolean(envio)}>
              <Icone nome="escrever" className="h-4 w-4" />
              {tp4?.barra.expandir ?? ""}
            </button>
            <button ref={botaoPrincipal} type="button" onClick={() => void publicar()} disabled={!pronto || ocupado || Boolean(envio)} className="al-botao al-botao-primario al-botao-m al2-aperta">
              {ocupado ? t.escrever.publicando : t.escrever.publicar}
            </button>
          </div>
        </div>
        {avisoFlutuante}
      </>
    );
  }

  return (
    <>
      <div
        className={`al2 al2-escrever-fundo fixed inset-0 z-50 flex flex-col md:items-center md:justify-center md:p-6 ${envio ? "hidden" : ""} ${saindo ? "al2-saindo" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="al2-escrever-titulo"
        onKeyDown={prenderTab}
        onMouseDown={(e) => {
          // Clique no fundo escuro (computador) fecha, como o Cancelar (o rascunho fica guardado).
          if (e.target === e.currentTarget) fechar();
        }}
      >
        {/* No computador a janela tem altura fixa e fica alinhada no alto: trocar de tipo (Post, Ato, Enquete) não faz a janela pular
            nem tira o Cancelar e o Publicar de baixo do cursor; o que cresce rola por dentro. */}
        <div ref={dialogo} tabIndex={-1} className={`al2-escrever flex h-full w-full flex-col bg-[var(--al-fundo)] ${resposta ? "md:h-auto md:max-h-[min(88vh,820px)]" : "md:h-[min(88vh,820px)]"} md:max-w-[640px] md:rounded-2xl md:border md:border-[var(--al-superficie-2)]`}>
          <div className="al-faixa" aria-hidden />
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <button type="button" onClick={fechar} className="al2-acao !text-[1.05rem] !text-[var(--al-texto-2)]">
              {t.escrever.cancelar}
            </button>
            <h2 id="al2-escrever-titulo" className="al-cond hidden text-lg font-black uppercase tracking-wide text-[var(--al-texto-2)] md:block">
              {resposta ? t.escrever.resposta : t.escrever.titulo}
            </h2>
            <button ref={botaoPrincipal} type="button" onClick={() => void publicar()} disabled={!pronto || ocupado} data-pronto={pronto && !ocupado ? "sim" : undefined} aria-describedby={falta ? "al2-escrever-falta" : undefined} className="al-botao al-botao-primario al-botao-g al2-publicar">
              {/* O nome novo entra com um pulinho (o botão muda de "Publicar" para "Chamar ato" à vista de quem olha). */}
              <span key={ocupado ? "ocupado" : principal} className="al2-publicar-nome">
                {ocupado ? t.escrever.publicando : principal}
              </span>
            </button>
          </div>
          {falta && (
            <p id="al2-escrever-falta" className="al2-falta -mt-1 px-4 pb-2 text-right text-xs font-semibold text-[var(--al-texto-3)]">
              {falta}
            </p>
          )}
          {/* O erro e o aviso ficam presos logo abaixo do Publicar, fora do que rola: o aviso de ofensa, o de link suspeito e o de
              foto sem borrar pedem o segundo toque, e a pessoa precisa ver a frase junto do botão. */}
          <div className="px-4 pb-2 empty:hidden">
            {erro && (
              <p role="alert" className="al2-nota al2-nota-alerta">
                <Icone nome="alerta" className="h-4 w-4" />
                {erro}
              </p>
            )}
            {avisoVisivel && (
              <p role="status" className="al2-aviso-escrever">
                {avisoVisivel}
              </p>
            )}
            {avisoVisivel && notaDaOfensa && vt && <p className="mt-1 text-xs text-[var(--al-texto-3)]">{vt.escrever.ofensaLista}</p>}
          </div>

          <div className="al2-escrever-corpo min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-6">
            {resposta && respostaA && (
              // O post respondido inteiro, cortado em 3 linhas pelo CSS (nada de frase partida no meio sem reticências).
              <p className="line-clamp-3 rounded-xl border-l-4 border-[var(--al-vermelho)] bg-[var(--al-superficie)] px-3 py-2 text-sm text-[var(--al-texto-2)]">
                <strong>{respostaA.autor.codinome}</strong>: {respostaA.texto}
              </p>
            )}

            {!resposta && (
              <Pilulas
                rotulo={t.escrever.tipos}
                className="al2-tipos flex flex-wrap gap-2"
                opcoes={tipos.map((x) => ({
                  valor: x,
                  conteudo: (
                    <>
                      {x === "ato" && <Icone nome="atos" className="h-5 w-5" />}
                      {t.escrever[x]}
                    </>
                  ),
                }))}
                escolhido={tipo}
                aoMudar={trocarTipo}
              />
            )}

            {!resposta && rascunhos.length > 0 && !rascunhoTemTexto({ texto, titulo, corpo }) && (
              <details className="al2-anexo text-sm">
                <summary className="cursor-pointer font-bold">{preencher(t.escrever.rascunhos, { n: rascunhos.length })}</summary>
                <p className="mt-1 text-xs text-[var(--al-texto-3)]">{t.escrever.rascunhosAjuda}</p>
                <ul className="mt-2 space-y-1">
                  {rascunhos.map((r) => (
                    <li key={r.id ?? r.atualizado_em} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{r.estado === "outro" ? t.b1.rascunhoOutroAparelho : (r.titulo || r.texto || r.corpo).trim() || t.escrever.semTexto}</span>
                        {r.estado === "antigo" && <span className="block text-xs text-[var(--al-texto-3)]">{t.b1.rascunhoAntigo}</span>}
                      </span>
                      {r.estado !== "outro" && <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => continuarRascunho(r)}>{t.escrever.continuar}</button>}
                      {/* Onda 12 (L2-33): agendar direto do rascunho (abre o "mais tarde" com o fuso). */}
                      {r.estado !== "outro" && tco && tipoDoRascunho(r.tipo) !== "ato" && (
                        <button
                          type="button"
                          className="al-botao al-botao-contorno al-botao-p"
                          onClick={() => {
                            continuarRascunho(r);
                            setPedirAgenda((n) => n + 1);
                          }}
                        >
                          {tco.rascunho.agendar}
                        </button>
                      )}
                      <button type="button" className="al2-acao" onClick={() => apagarRascunho(r)}>{t.escrever.apagar}</button>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {/* Fora do bloco que troca com o tipo: a região viva continua a mesma e o anúncio é lido. */}
            <p role="status" className="sr-only">
              {anuncioDoTipo}
            </p>
            <div key={tipo === "ato" ? "ato" : "texto"} className="al2-troca-tipo space-y-4">
              {tipo === "ato" && texto.trim() && (
                <p className="al2-texto-guardado">
                  <Icone nome="escrever" className="h-4 w-4 shrink-0" />
                  {t.escrever.textoGuardado}
                </p>
              )}
              {tipo === "ato" ? (
                encaixeDoAto ? (
                  <encaixeDoAto.Formulario lang={lang} s={s} situacao={situacao} aoMudar={setDadosDoAto} />
                ) : (
                  <FormularioDoAtoDuble aoMudar={setDadosDoAto} />
                )
              ) : (
                <>
                  {longo && (
                    <>
                      <Pilulas
                        rotulo={t.escrever.longoComo}
                        className="flex gap-2"
                        classeItem="al2-tipo !min-h-11 !px-3 text-sm"
                        opcoes={(["discussao", "duvida"] as const).map((x) => ({ valor: x, conteudo: t.escrever[x] }))}
                        escolhido={longoComo}
                        aoMudar={setLongoComo}
                      />
                      <label className="block">
                        <span className="al2-rotulo">{t.escrever.tituloDoLongo}</span>
                        <input className="al2-campo min-h-12 text-lg font-bold" value={titulo} maxLength={140} onChange={(e) => setTitulo(e.target.value)} />
                      </label>
                    </>
                  )}
                  {longo ? (
                    // O texto longo com a barra de formatação e o "Ver como fica" (onda 11, 11A): título, lista, código, fórmula e as
                    // imagens anexadas no meio. O banco limpa de novo ao guardar (interno.rede_texto_limpo).
                    <EditorDeTexto
                      lang={lang}
                      valor={corpo}
                      aoMudar={setCorpo}
                      rotulo={placeholder}
                      max={maximo}
                      linhas={10}
                      imagens={imagensDoTexto}
                    />
                  ) : (
                  <>
                  {fioLigado && tco && <CabecaDoFio t={tco} primeiro={texto} total={(fioBlocos?.length ?? 1) + 1} aoFechar={() => setFioBlocos(null)} />}
                  <label className="block">
                    <span className="sr-only">{placeholder}</span>
                    {tc ? (
                      <CampoComMencoes
                        valor={longo ? corpo : texto}
                        aoMudar={longo ? setCorpo : setTexto}
                        t={tc}
                        rotulo={placeholder}
                        placeholder={placeholder}
                        maxLength={maximo}
                        postId={respostaA?.id ?? null}
                        className="al2-campo al2-campo-texto min-h-40 resize-y text-[1.15rem] leading-relaxed"
                        linhas={6}
                        autoFocus
                      />
                    ) : (
                      <textarea
                        className="al2-campo al2-campo-texto min-h-40 resize-y text-[1.15rem] leading-relaxed"
                        placeholder={placeholder}
                        maxLength={maximo}
                        value={longo ? corpo : texto}
                        onChange={(e) => (longo ? setCorpo(e.target.value) : setTexto(e.target.value))}
                      />
                    )}
                  </label>
                  </>
                  )}
                  {fioLigado && tco && (
                    <FioDoEscrever t={tco} primeiro={texto} aoMudarPrimeiro={setTexto} blocos={fioBlocos ?? [""]} aoMudar={setFioBlocos} aoFechar={() => setFioBlocos(null)} />
                  )}
                  {/* Com link no texto: a linha curta de que os links são conferidos, logo embaixo do campo onde o link está (onda 11,
                      11F; só com a conferência ligada). */}
                  <LinksConferidos lang={lang} texto={longo ? corpo : texto} />
                  <AnexosDoEscrever
                    pub={pub}
                    t={t}
                    lang={lang}
                    resposta={resposta}
                    tamanho={tamanho}
                    maximo={maximo}
                    enquete={tipo === "enquete"}
                    aoEnquete={resposta ? undefined : (ligar) => setTipo(ligar ? "enquete" : "post")}
                    fio={!resposta && tipo === "post" ? { ligado: fioLigado, alternar: () => setFioBlocos((b) => (b === null ? [""] : null)) } : undefined}
                    pedirAgenda={pedirAgenda}
                    ctx={{ lang, s, situacao }}
                    semMidia={grupoCifrado ? (tr?.semAnexo ?? "") : undefined}
                  />
                  {p4Ligado && tp4 && !resposta && (
                    <CamposDoP4 t={tp4} escolhas={escolhasP4} aoMudar={setEscolhasP4} longo={longo} convitePode={tipo === "post" && !fioLigado} imagens={imagensAnexadas} />
                  )}
                </>
              )}
            </div>

            {!resposta && (
              <div className="border-b border-[var(--al-linha)]">
                <Escolha
                  icone={<span aria-hidden className="h-4 w-4 rounded-[4px]" style={{ background: lugar ? `var(--al-com-${lugar.cor})` : "var(--al-texto-3)" }} />}
                  rotulo={t.escrever.ondePublicar}
                  valor={lugar?.nome ?? t.escrever.noPerfil}
                  aberta={aberta === "onde"}
                  aoAbrir={() => setAberta(aberta === "onde" ? null : "onde")}
                  aoFecharLista={() => setAberta(null)}
                  opcoes={[{ valor: "", texto: t.escrever.noPerfil }, ...lugares.map((l) => ({ valor: l.slug, texto: l.nome }))]}
                  escolhido={onde ?? ""}
                  aoEscolher={(v) => {
                    setOnde(v || null);
                    if (!v && publico === "comunidade") setPublico("membros");
                    // A roda é do perfil: escolher uma comunidade volta para "membros".
                    if (v && vaiPelaVida(publico)) setPublico("membros");
                    // "Alumia e Fediverso" (perfil) e o aberto na internet (aula) são escolhas diferentes: trocar de lugar não leva
                    // nenhuma das duas junto.
                    if ((v || null) !== onde && publico === "internet") setPublico("membros");
                  }}
                />
                <Escolha
                  // "Alumia e Fediverso" com não listado ou some sozinho não sai (interno.rede_vida_federa): a linha diz isso, com a casa.
                  icone={<Icone nome={iconeDoPublico(internetPresa ? "membros" : publico)} className={`h-5 w-5 ${publico === "internet" && !internetPresa ? "text-[var(--al-dourado)]" : ""}`} />}
                  rotulo={t.escrever.quemVe}
                  valor={internetPresa && tv ? tv.internetPresa : rotuloDoPublico(publico)}
                  aberta={aberta === "quem"}
                  aoAbrir={() => setAberta(aberta === "quem" ? null : "quem")}
                  aoFecharLista={() => setAberta(null)}
                  vertical
                  opcoes={opcoesQuemVe.map((o) => ({
                    valor: o.valor,
                    texto: rotuloDoPublico(o.valor),
                    ajuda: ajudaDoPublico(o),
                    icone: iconeDoPublico(o.valor),
                    desligada: Boolean(o.desligada),
                    selo: { texto: o.saiDaAlumia ? tv.saiDaAlumia : tv.ficaNaAlumia, sai: o.saiDaAlumia },
                  }))}
                  escolhido={publico}
                  aoEscolher={(v) => setPublico(v as PublicoDoEscrever)}
                />
                {/* A roda e o "não listado" ficam à vista embaixo de Quem vê (a gaveta fecha ao escolher). */}
                {vt && tipo !== "ato" && publico !== "eu" && (
                  <div className="pb-3 sm:pl-9">
                    {publico === "roda" ? (
                      <RodaNoEscrever t={vt} lista={roda} previa={previa} aoMudar={setRoda} />
                    ) : (
                      <label className="al2-opcao-b1 mt-1">
                        <input type="checkbox" role="switch" className="al2-caixinha" checked={naoListado} onChange={(e) => setNaoListado(e.target.checked)} aria-describedby="al2-nao-listado-ajuda" />
                        <span className="min-w-0">
                          <span className="block font-bold">{vt.escrever.naoListado}</span>
                          <span id="al2-nao-listado-ajuda" className="block text-xs text-[var(--al-texto-3)]">
                            {vt.escrever.naoListadoAjuda}
                          </span>
                        </span>
                      </label>
                    )}
                  </div>
                )}
                {/* "Só eu": ninguém mais vê, então ninguém responde nem cita; as duas linhas somem. */}
                {publico !== "eu" && (
                  <Escolha
                    icone={<Icone nome="responder" className="h-5 w-5" />}
                    rotulo={t.escrever.quemResponde}
                    valor={rotuloResponde(pub.respondeQuem)}
                    aberta={aberta === "responde"}
                    aoAbrir={() => setAberta(aberta === "responde" ? null : "responde")}
                    aoFecharLista={() => setAberta(null)}
                    opcoes={responde.map((q) => ({ valor: q, texto: rotuloResponde(q) }))}
                    escolhido={pub.respondeQuem}
                    aoEscolher={(v) => pub.setRespondeQuem(v as RespondeQuem)}
                  />
                )}
                {mencionadosQueVao && (
                  <p className="al2-nota mb-3 sm:ml-9" role="note">
                    <Icone nome="cadeado" className="h-4 w-4 shrink-0 text-[var(--al-dourado)]" />
                    <span>
                      {tv.mencionadosCifrado}{" "}
                      <strong>
                        {mencionadosQueVao.length ? preencher(tv.mencionadosLista, { lista: mencionadosQueVao.map((h) => `@${h}`).join(", ") }) : tv.mencionadosNinguem}
                      </strong>
                    </span>
                  </p>
                )}
                {vt && tipo !== "ato" && (
                  // Some sozinho (L2-32): no prazo, o banco apaga de verdade o post e as imagens.
                  <Escolha
                    icone={<Icone nome="relogio" className={`h-5 w-5 ${someEm ? "text-[var(--al-dourado)]" : ""}`} />}
                    rotulo={vt.escrever.someSozinho}
                    valor={rotuloDoPrazo(someEm)}
                    aberta={aberta === "some"}
                    aoAbrir={() => setAberta(aberta === "some" ? null : "some")}
                    aoFecharLista={() => setAberta(null)}
                    opcoes={[{ valor: "", texto: vt.escrever.nunca }, ...PRAZOS_PARA_SUMIR.map((x) => ({ valor: x, texto: rotuloDoPrazo(x) }))]}
                    escolhido={someEm ?? ""}
                    aoEscolher={(v) => setSomeEm(v === "24h" || v === "7d" ? v : null)}
                  />
                )}
                {tipo !== "ato" && citaNoBanco && (
                  // Quem pode citar (repostar com comentário): padrão "ninguém"; o banco confere em qualquer caminho que cite.
                  // Com o banco ainda sem a B1 a linha não aparece (lá a citação é aberta a todos). No "só eu", ninguém cita.
                  publico !== "eu" && <Escolha
                    icone={<Icone nome="repostar" className="h-5 w-5" />}
                    rotulo={t.b1.quemCita}
                    valor={rotuloCita(pub.citarQuem)}
                    aberta={aberta === "cita"}
                    aoAbrir={() => setAberta(aberta === "cita" ? null : "cita")}
                    aoFecharLista={() => setAberta(null)}
                    vertical
                    opcoes={(["ninguem", "seguindo", "todos"] as CitarQuem[]).map((q) => ({ valor: q, texto: rotuloCita(q), ajuda: ajudaCita(q) }))}
                    escolhido={pub.citarQuem}
                    aoEscolher={(v) => pub.setCitarQuem(v as CitarQuem)}
                  />
                )}
              </div>
            )}
            {!resposta && vt && someEm && (
              <p className="al2-nota">
                <Icone nome="relogio" className="h-4 w-4 text-[var(--al-dourado)]" />
                {vt.escrever.someAjuda}
              </p>
            )}
            {grupoCifrado && tr && <SeloDaCifra t={tr} onde={grupoCifrado.startsWith("nucleo:") ? "nucleo" : "comunidade"} />}
            {/* O post que sai da Alumia diz, antes de publicar, que outros servidores podem guardar uma cópia (LGPD: a pessoa lê que
                o post sai daqui). */}
            {/* Não listado e "some sozinho" nunca saem da Alumia (interno.rede_vida_federa): com eles, a tela diz que o post fica só aqui. */}
            {!resposta && publico === "internet" && (naoListado || someEm !== null) && (
              <p className="al2-nota" role="note">
                <Icone nome="fediverso" className="h-4 w-4 shrink-0" />
                {tv.naoSaiComVida}
              </p>
            )}
            {!resposta && publico === "internet" && !naoListado && someEm === null && (
              <p className="al2-nota al2-nota-sai" role="note">
                <Icone nome="fediverso" className="h-4 w-4 shrink-0 text-[var(--al-dourado)]" />
                <span>
                  <strong className="block">{tv.saiDaAlumia}</strong>
                  {tv.avisoFediverso}
                </span>
              </p>
            )}
            {/* Sem o modo total, nada do perfil sai; na comunidade, sair no Fediverso é escolha dela (um post solto nunca sai sem querer). */}
            {!resposta && tipo !== "ato" && !publicos.includes("internet") && aberta === "quem" && (
              <p className="al2-nota">
                <Icone nome="fediverso" className="h-4 w-4" />
                {lugar ? t.b1.fediverso : tv.fediversoDesligado}
              </p>
            )}

            <p className="text-xs text-[var(--al-texto-3)]">{preencher(t.escrever.codinome, { codinome: situacao.codinome ?? "" })}</p>
            {rascunhoOnde && (
              <p className="al2-nota" role="status">
                <Icone nome="visto" className="h-4 w-4" />
                {rascunhoOnde === "conta" ? t.b1.rascunhoCifrado : rascunhoOnde === "cheio" ? t.escrever.rascunhosCheios : rascunhoOnde === "ato" ? t.b1.rascunhoDeAto : t.escrever.rascunhoSoAqui}
              </p>
            )}
            {!resposta && !previa && <RascunhosNaConta t={t} ligado={naConta} aoMudar={mudarNaConta} nota={notaDaConta} />}
          </div>

        </div>
      </div>

      {avisoFlutuante}
    </>
  );
}

interface OpcaoDaEscolha {
  valor: string;
  texto: string;
  ajuda?: string;
  icone?: NomeDoIcone;
  /** Aparece, mas não dá para escolher (a ajuda diz por quê). */
  desligada?: boolean;
  /** O selo curto à direita (Quem vê: "Fica na Alumia" ou "Sai da Alumia"). */
  selo?: { texto: string; sai: boolean };
}

/**
 * Uma linha de escolha (Onde publicar, Quem vê, Quem responde): abre a lista ali mesmo, como na prancha, numa gaveta que desliza.
 * Aberta, o foco vai para a opção escolhida; as setas trocam, Enter/Espaço/clique confirma e fecha, Esc fecha sem fechar o
 * Escrever. O foco volta à linha. `vertical` mostra as opções uma por linha, com ícone e uma frase de ajuda (Quem vê); `depois`
 * vem embaixo da lista.
 */
function Escolha({
  icone,
  rotulo,
  valor,
  aberta,
  aoAbrir,
  aoFecharLista,
  opcoes,
  escolhido,
  aoEscolher,
  vertical = false,
  depois,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
  aberta: boolean;
  aoAbrir: () => void;
  aoFecharLista: () => void;
  opcoes: OpcaoDaEscolha[];
  escolhido: string;
  aoEscolher: (v: string) => void;
  vertical?: boolean;
  depois?: React.ReactNode;
}) {
  const linha = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberta) return;
    const l = lista.current;
    // preventScroll: quem rola é o scrollIntoView logo abaixo (a gaveta inteira à vista, e não só a opção escolhida).
    l?.querySelector<HTMLElement>('[tabindex="0"]')?.focus({ preventScroll: true });
    // A gaveta abre para baixo da dobra: rola o corpo do Escrever até ela caber (depois da animação começar a abrir).
    const id = window.setTimeout(() => l?.scrollIntoView({ block: "nearest", behavior: comMovimento() ? "smooth" : "auto" }), 60);
    return () => window.clearTimeout(id);
  }, [aberta]);
  const fecharLista = () => {
    aoFecharLista();
    window.setTimeout(() => linha.current?.focus(), 0);
  };
  return (
    <div>
      <button ref={linha} type="button" className="al2-escolha" aria-expanded={aberta} onClick={aoAbrir}>
        <span className="grid w-6 place-items-center">{icone}</span>
        <span>{rotulo}</span>
        <strong>{valor}</strong>
        <Icone nome="chevron" className={`h-5 w-5 shrink-0 transition-transform duration-200 ${aberta ? "rotate-90" : ""}`} />
      </button>
      {aberta && (
        <div ref={lista} className="al2-gaveta pb-3">
          <Pilulas
            rotulo={rotulo}
            className={vertical ? "al2-lista-escolha" : "flex flex-wrap gap-2 pl-1 sm:pl-9"}
            classeItem={vertical ? "al2-opcao-linha" : "al2-tipo !min-h-10 !px-3 text-sm"}
            opcoes={opcoes.map((o) => ({
              valor: o.valor,
              desligada: o.desligada,
              conteudo: vertical ? (
                <>
                  {o.icone && <Icone nome={o.icone} className="h-5 w-5 shrink-0" />}
                  <span className="min-w-0 flex-1 text-left">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-bold">{o.texto}</span>
                      {o.selo && <span className={`al2-selo-sai ${o.selo.sai ? "al2-selo-sai-fora" : ""}`}>{o.selo.texto}</span>}
                    </span>
                    {o.ajuda && <span className="block text-xs font-normal text-[var(--al-texto-3)]">{o.ajuda}</span>}
                  </span>
                  <span aria-hidden className="al2-opcao-marca">
                    <Icone nome="visto" className="h-4 w-4" grosso />
                  </span>
                </>
              ) : (
                o.texto
              ),
            }))}
            escolhido={escolhido}
            aoMudar={aoEscolher}
            aoConfirmar={fecharLista}
            aoEsc={fecharLista}
          />
          {depois}
        </div>
      )}
    </div>
  );
}

/**
 * A chave "Guardar rascunhos na conta" (desligada por padrão) e, ligada, o código para ler os rascunhos noutro aparelho. O código
 * é a própria chave AES do aparelho: fica só com a pessoa (o servidor nunca recebe). LGPD art. 6º, III (necessidade) e art. 46
 * (segurança): o texto de um chamado ou de uma denúncia é dado sensível (art. 11) e não precisa estar legível no servidor.
 */
function RascunhosNaConta({ t, ligado, aoMudar, nota }: { t: TextosAlumia2; ligado: boolean; aoMudar: (sim: boolean) => void; nota: string }) {
  const [colado, setColado] = useState("");
  const [msg, setMsg] = useState("");
  const [codigo, setCodigo] = useState("");
  return (
    <div className="space-y-2">
      <label className="al2-opcao-b1">
        <input type="checkbox" role="switch" className="al2-caixinha" checked={ligado} onChange={(e) => aoMudar(e.target.checked)} aria-describedby="al2-na-conta-ajuda" />
        <span className="min-w-0">
          <span className="block font-bold">{t.b1.naConta}</span>
          <span id="al2-na-conta-ajuda" className="block text-xs text-[var(--al-texto-3)]">{t.b1.naContaAjuda}</span>
        </span>
      </label>
      {nota && (
        <p role="status" className="al2-nota">
          <Icone nome="visto" className="h-4 w-4" />
          {nota}
        </p>
      )}
      {ligado && (
        <details className="al2-anexo text-sm" onToggle={(e) => (e.currentTarget.open && !codigo ? setCodigo(codigoDaChave(chaveDoAparelho())) : undefined)}>
          <summary className="cursor-pointer font-bold">{t.b1.chave}</summary>
          <p className="mt-1 text-xs text-[var(--al-texto-3)]">{t.b1.chaveAjuda}</p>
          {codigo && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-[var(--al-fundo)] px-2 py-1 text-xs">{codigo}</code>
              <button
                type="button"
                className="al-botao al-botao-contorno al-botao-p"
                onClick={() => void navigator.clipboard?.writeText(codigo).then(() => setMsg(t.b1.chaveCopiado), () => undefined)}
              >
                {t.b1.chaveCopiar}
              </button>
            </div>
          )}
          <label className="mt-3 block">
            <span className="al2-rotulo">{t.b1.chaveColar}</span>
            <input className="al2-campo min-h-11 font-mono text-xs" value={colado} autoComplete="off" spellCheck={false} onChange={(e) => setColado(e.target.value)} />
          </label>
          <button
            type="button"
            className="al-botao al-botao-contorno al-botao-p mt-2"
            disabled={!colado.trim()}
            onClick={() => {
              const chave = chaveDoCodigo(colado);
              if (!chave) return setMsg(t.b1.chaveInvalida);
              trocarChaveDoAparelho(chave);
              setCodigo(codigoDaChave(chave));
              setColado("");
              setMsg(t.b1.chaveTrocada);
            }}
          >
            {t.b1.chaveUsar}
          </button>
          <p role="status" className="mt-1 text-xs text-[var(--al-texto-2)]">
            {msg}
          </p>
        </details>
      )}
    </div>
  );
}

/**
 * O DUBLÊ do formulário do ato (só na prévia, sem a F2): nome (vira a palavra do mosaico), quando, onde, chamado e a prévia do
 * mosaico apagado. Nada é publicado daqui.
 */
function FormularioDoAtoDuble({ aoMudar }: { aoMudar: (d: Record<string, unknown>) => void }) {
  const al2 = useAlumia2();
  const [d, setD] = useState({ nome: "FICA ESPERANÇA", quando: "ter 19/11 · 6h", onde: "Ocupação Esperança, Itaquera", chamado: "Vigília na porta da ocupação no dia da reintegração. 140 famílias. Precisamos de gente às 6h e de quem filme com o celular na horizontal." });
  useEffect(() => aoMudar(d), [d, aoMudar]);
  if (!al2) return null;
  const { t } = al2;
  const mudar = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD((x) => ({ ...x, [k]: e.target.value }));
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="al2-rotulo">{t.previa.nomeDoAto}</span>
        <input data-al2-foco className="al2-campo al-cond min-h-14 !text-[1.9rem] !font-black uppercase" value={d.nome} maxLength={40} onChange={mudar("nome")} />
      </label>
      <div className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] gap-3">
        <label className="block">
          <span className="al2-rotulo">{t.previa.quando}</span>
          <input className="al2-campo min-h-12" value={d.quando} onChange={mudar("quando")} />
        </label>
        <label className="block">
          <span className="al2-rotulo">{t.previa.onde}</span>
          <input className="al2-campo min-h-12" value={d.onde} onChange={mudar("onde")} />
        </label>
      </div>
      <label className="block">
        <span className="al2-rotulo">{t.previa.chamado}</span>
        <textarea rows={5} className="al2-campo min-h-40 resize-y !text-[1.05rem] leading-relaxed" value={d.chamado} onChange={mudar("chamado")} />
      </label>
      <div className="rounded-xl border border-dashed border-[var(--al-superficie-2)] p-2">
        <Mosaico palavra={d.nome.split(" ")[0] || " "} semente="previa-novo-ato" proporcao={null} quebrar={31} rotulo={preencher(t.previa.mosaico, { palavra: d.nome })} />
      </div>
      <p className="text-sm text-[var(--al-texto-3)]">{t.previa.mosaicoApagado}</p>
    </div>
  );
}
