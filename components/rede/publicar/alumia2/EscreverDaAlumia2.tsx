// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { evaluatePost } from "@/lib/backend";
import { rede } from "@/lib/rede/cliente";
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
import type { CitarQuem, PedidoPublicar, RespondeQuem } from "@/lib/rede/tipos-publicar";
import { CampoComMencoes } from "../../conversa/CampoComMencoes";
import { ENCAIXES, verificarAntesDePublicar } from "../../encaixes";
import { codigoDoErro, textoDoErro } from "../../erros";
import { Mosaico } from "../../mosaico/Mosaico";
import { corDaComunidade } from "../../ui/Pilula";
import { escreverRascunho, useEscreverPub } from "../ExtrasDoEscrever";
import { textoDoErroPublicar } from "../textos";
import { AnexosDoEscrever } from "./AnexosDoEscrever";
import { faltaNoBanco } from "./CartaoDaAlumia2";
import type { TipoAoEscrever } from "./CascaDaAlumia2";
import { useAlumia2 } from "./contexto";
import { Icone, type NomeDoIcone } from "./icones";
import { Pilulas } from "./Pilulas";
import type { TextosAlumia2 } from "./textos";
import { comMovimento } from "./TopoDaLinha2";

/** O que dá para focar com Tab dentro do diálogo (para prender o foco nele). */
const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]';

/** O ícone de "Quem vê" pelo público: o globo do Fediverso só quando o post sai para a internet (federa); os outros não saem. */
export function iconeDoPublico(p: Publico): NomeDoIcone {
  return p === "internet" ? "fediverso" : p === "comunidade" ? "comunidades" : p === "seguidores" ? "perfil" : p === "equipe" ? "cadeado" : "nucleos";
}

type ComunidadeResumida = Pick<Comunidade, "slug" | "nome" | "categoria" | "publico_padrao">;
interface Lugar {
  slug: string;
  nome: string;
  categoria: string;
  cor: CorDaComunidadeNum;
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

/** Publica com os campos da B1 (quem pode citar, enquete avançada); um banco sem a B1 recebe o pedido de antes. */
async function publicarComB1(pedido: PedidoPublicar): Promise<Post> {
  try {
    return await redePub.publicarMais(pedido);
  } catch (e) {
    if (!faltaNoBanco(e)) throw e;
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
}) {
  const al2 = useAlumia2();
  const previa = Boolean(al2?.previa);
  const resposta = Boolean(respostaA);
  const encaixeDoAto = ENCAIXES.tiposDoCompositor.find((x) => x.tipo === "ato");
  const temAto = !resposta && (Boolean(encaixeDoAto) || previa);
  const [tipo, setTipo] = useState<TipoDoCompositor>(tipoInicial === "ato" && temAto ? "ato" : tipoInicial === "enquete" ? "enquete" : tipoInicial === "longo" ? "longo" : "post");
  const [longoComo, setLongoComo] = useState<"discussao" | "duvida">("discussao");
  const [texto, setTexto] = useState(textoInicial);
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [anuncioDoTipo, setAnuncioDoTipo] = useState("");
  const [onde, setOnde] = useState<string | null>(comunidade?.slug ?? null);
  const [publico, setPublico] = useState<Publico>(comunidade ? (comunidade.publico_padrao === "internet" ? "internet" : comunidade.publico_padrao === "comunidade" ? "comunidade" : "membros") : "membros");
  const [aberta, setAberta] = useState<"onde" | "quem" | "responde" | "cita" | null>(null);
  const [lugares, setLugares] = useState<Lugar[]>(() =>
    previa ? Object.entries(COMUNIDADES_DE_EXEMPLO).map(([slug, c]) => ({ slug, nome: c.nome, categoria: "lutas", cor: c.cor })) : [],
  );
  const [dadosDoAto, setDadosDoAto] = useState<Record<string, unknown>>({});
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [envio, setEnvio] = useState<{ desde: number } | null>(null);
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

  // As comunidades onde a pessoa pode publicar (Onde publicar). Na prévia, as das pranchas.
  useEffect(() => {
    if (resposta || previa) return;
    let vivo = true;
    clienteComunidades.lista().then(
      (r) => {
        if (!vivo) return;
        setLugares(r.itens.filter((c) => c.situacao === "membro").map((c) => ({ slug: c.slug, nome: c.nome, categoria: c.categoria, cor: corDaComunidade(c.slug) })));
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
    if (resposta || previa || textoInicial || !naConta) return;
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
  }, [resposta, previa, textoInicial, naConta]);

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

  // Foco (WCAG 2.4.3): ao abrir, vai para o campo principal (no Ato, o nome do ato); ao fechar, volta para quem abriu.
  useEffect(() => {
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
  }, []);

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

  const lugar = lugares.find((l) => l.slug === onde) ?? (comunidade && onde === comunidade.slug ? { slug: comunidade.slug, nome: comunidade.nome, categoria: comunidade.categoria, cor: corDaComunidade(comunidade.slug) } : null);

  // Rascunho na conta: guarda 2,5 s depois da última tecla; sem a função no banco, avisa que fica só no aparelho.
  const rascunhoAtual = useMemo<RascunhoDoServidor>(
    () => ({ id: rascunhoId, tipo, texto, titulo, corpo, comunidade: onde, publico, responde_quem: pub.respondeQuem }),
    [rascunhoId, tipo, texto, titulo, corpo, onde, publico, pub.respondeQuem],
  );
  useEffect(() => {
    if (resposta || previa || envio) return;
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

  const publicos: Publico[] = [
    "membros",
    "seguidores",
    ...(lugar ? (["comunidade"] as Publico[]) : []),
    ...(lugar?.categoria === "disciplinas" || previa ? (["internet"] as Publico[]) : []),
    ...(situacao.equipe ? (["equipe"] as Publico[]) : []),
  ];
  const rotuloDoPublico = (p: Publico) =>
    al2
      ? { internet: al2.t.escrever.publicoInternet, membros: al2.t.escrever.publicoMembros, seguidores: al2.t.escrever.publicoSeguidores, comunidade: al2.t.escrever.publicoComunidade, nucleo: al2.t.escrever.publicoNucleo, equipe: al2.t.escrever.publicoEquipe }[p]
      : p;
  const tipos: TipoDoCompositor[] = ["post", ...(temAto ? (["ato"] as TipoDoCompositor[]) : []), "enquete", "longo", ...(situacao.equipe ? (["aviso"] as TipoDoCompositor[]) : [])];
  const nomeDoAto = typeof dadosDoAto.nome === "string" ? dadosDoAto.nome : "";
  const tamanho = longo ? corpo.length : texto.length;
  const maximo = longo ? LIMITE_CORPO : LIMITE_POST;
  // O formulário do ato da F2 entrega o que conferiu ({ pronto, problemas }); o dublê da prévia só tem o nome.
  const problemasDoAto = typeof dadosDoAto.problemas === "object" && dadosDoAto.problemas ? Object.keys(dadosDoAto.problemas as Record<string, unknown>) : null;
  const atoPronto = typeof dadosDoAto.pronto === "boolean" ? dadosDoAto.pronto : nomeDoAto.trim().length >= 2;
  const pronto =
    tipo === "ato"
      ? atoPronto
      : (longo ? titulo.trim().length >= 5 && corpo.trim().length >= 10 : texto.trim().length >= 1) && pub.podeEnviar && (Boolean(pub.aposAto) || !pub.agendar || pub.agendaOk);

  const montarPedido = useCallback(async (): Promise<PedidoPublicar> => {
    if (resposta) return { texto: texto.trim(), resposta_a: respostaA?.id, ...(await pub.preparar()) };
    if (tipo === "ato") {
      // O ato é da F2: o encaixe dá os campos (nome, quando, onde, chamado); o banco da F2 recebe em `ato`.
      return { tipo: "chamado", texto: String(dadosDoAto.chamado ?? texto).trim(), publico, ...(onde ? { comunidade: onde } : {}), ato: dadosDoAto } as unknown as PedidoPublicar;
    }
    const base: PedidoPublicar = { tipo: tipoBanco, ...(longo ? { titulo: titulo.trim(), corpo: corpo.trim() } : { texto: texto.trim() }), publico, ...(onde ? { comunidade: onde } : {}) };
    return { ...base, ...(await pub.preparar()) };
  }, [resposta, texto, respostaA, pub, tipo, dadosDoAto, publico, onde, tipoBanco, longo, titulo, corpo]);

  // O envio de verdade, depois dos 10 s.
  const enviarDeVerdade = useCallback(async () => {
    setOcupado(true);
    setErro("");
    try {
      if (previa) {
        setAviso(al2?.t.previa.aviso ?? "");
        setEnvio(null);
        return;
      }
      if (tipo === "ato" && encaixeDoAto && typeof dadosDoAto.pronto === "boolean") {
        // O ato é da F2: rede_ato_publicar (que chama o rede_publicar por dentro, com o nome, a palavra, a data, o ponto e a cidade).
        const { atos } = await import("@/lib/rede/cliente-atos");
        await atos.publicar(dadosDoAto as unknown as Parameters<typeof atos.publicar>[0], { publico, comunidade: onde });
        if (desfeitoNoEnvio.current) {
          setErro(al2?.t.escrever.naoDesfez ?? "");
          return;
        }
        setEnvio(null);
        aoFechar();
        return;
      }
      const pedido = await montarPedido();
      if (!resposta && (pub.agendar || pub.aposAto) && tipo !== "ato") {
        // Com repetição ou "quando o ato terminar", pelo rede_pub_agendar_mais; sem a B1 no banco, a data única de antes.
        const opcoes = { ...(pub.repetir ? { repetir: "semana" as const, vezes: pub.repetir } : {}), ...(pub.aposAto ? { apos_ato: pub.aposAto } : {}) };
        const pedirQuando = pub.aposAto ? null : new Date(pub.agendar).toISOString();
        const agendado = await redePub.agendarMais(pedido, pedirQuando, opcoes).catch((e) => {
          if (faltaNoBanco(e) && pedirQuando && !pub.repetir && !pub.aposAto) return redePub.agendar(pedido, pedirQuando);
          throw e;
        });
        const quando = new Date(agendado.quando);
        if (desfeitoNoEnvio.current) {
          // Desfeito no meio do caminho: o agendamento é cancelado e o texto continua na caixa.
          await redePub.cancelarAgendado(agendado.id);
          return;
        }
        pub.limpar();
        setEnvio(null);
        setAviso(preencher(pub.t?.agendar.agendado ?? "", { quando: quando.toLocaleString(lang, { dateStyle: "short", timeStyle: "short" }) }));
        return;
      }
      const post = await publicarComB1(pedido);
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
      if (post.avaliar && post.id) void evaluatePost("rede", post.id);
      pub.limpar();
      if (rascunhoId) void redePub.apagarRascunho(rascunhoId).catch(() => undefined);
      aoPublicar(post);
      setEnvio(null);
      if (post.retido) {
        setAviso(s.post.retido);
        return;
      }
      aoFechar();
    } catch (e) {
      setEnvio(null);
      // O ato tem erros próprios (a palavra do mosaico, o ponto, o link de apoio, a meta…): a frase certa vem dos textos dos atos.
      if (tipo === "ato" && encaixeDoAto) {
        const [{ carregarTextosDosAtos }, erros] = await Promise.all([import("@/lib/rede/textos-atos"), import("@/lib/rede/atos/erros")]);
        if (erros.codigoDoErro(e) !== "generico") {
          setErro(erros.fraseDoErro((await carregarTextosDosAtos(lang)).erros, e));
          return;
        }
      }
      setErro((pub.t && textoDoErroPublicar(pub.t, codigoDoErro(e))) || textoDoErro(s, e));
    } finally {
      desfeitoNoEnvio.current = false;
      setOcupado(false);
    }
  }, [previa, al2, montarPedido, resposta, pub, tipo, lang, rascunhoId, aoPublicar, s, aoFechar, encaixeDoAto, dadosDoAto, publico, onde]);

  // O relógio do "Enviando em N s": ao chegar a zero, envia.
  useEffect(() => {
    if (!envio) return;
    const tique = () => {
      const n = Date.now();
      setAgora(n);
      if (segundosQueFaltam(envio.desde, n) === 0) {
        window.clearInterval(id);
        void enviarDeVerdade();
      }
    };
    const id = window.setInterval(tique, 250);
    return () => window.clearInterval(id);
  }, [envio, enviarDeVerdade]);

  async function publicar() {
    setErro("");
    setAviso("");
    // Lembrete de descrição (alt): uma vez; o segundo toque publica assim mesmo.
    if (!lembrouAlt && pub.imagens.some((i) => !i.alt.trim())) {
      setLembrouAlt(true);
      setAviso(al2?.t.escrever.semAlt ?? "");
      return;
    }
    // As verificações das frentes (ex.: a F6 avisa de rosto ou placa na foto); uma que bloqueia para aqui.
    const r = await verificarAntesDePublicar(
      { texto: longo ? corpo : texto, tipo: tipo === "ato" ? "ato" : tipoBanco, publico, comunidade: onde, extras: tipo === "ato" ? dadosDoAto : {} },
      { lang, s, situacao },
    );
    if (!r.ok) {
      setAviso(r.aviso);
      if (r.bloqueia) return;
    }
    const n = Date.now();
    desfeitoNoEnvio.current = false;
    setAgora(n);
    setEnvio({ desde: n });
  }

  function desfazer() {
    // O ato não tem desfazer no banco (é da F2): se o pedido já saiu, o botão some (ver o aviso flutuante) e nada é fingido aqui.
    if (ocupado && tipo === "ato") return;
    // O pedido já saiu? O envio termina e desfaz no banco (rede_pub_desfazer); antes disso, ele nem sai.
    if (ocupado) desfeitoNoEnvio.current = true;
    setEnvio(null);
    setAviso(al2?.t.escrever.desfeito ?? "");
    window.setTimeout(() => botaoPrincipal.current?.focus(), 0);
  }

  /**
   * Fechar sem perder texto: o rascunho é guardado NA HORA (na conta, e no aparelho como hoje), sem esperar os 2,5 s. A resposta
   * não tem rascunho: com texto, pergunta antes de descartar.
   */
  function fechar() {
    if (envio) return;
    if (!previa && rascunhoTemTexto(rascunhoAtual)) {
      if (resposta) {
        if (!window.confirm(al2?.t.escrever.descartarResposta ?? "")) return;
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
      if (e.key !== "Escape" || e.defaultPrevented || envio) return;
      if (aberta) {
        setAberta(null);
        return;
      }
      fecharRef.current();
    };
    window.addEventListener("keydown", sair);
    return () => window.removeEventListener("keydown", sair);
  }, [envio, aberta]);

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
  const ajudaDoPublico = (p: Publico) =>
    ({ internet: t.escrever.ajudaInternet, membros: t.escrever.ajudaMembros, seguidores: t.escrever.ajudaSeguidores, comunidade: t.escrever.ajudaComunidade, nucleo: t.escrever.ajudaNucleo, equipe: t.escrever.ajudaEquipe })[p];

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
                        classeItem="al2-tipo !min-h-10 !px-3 text-sm"
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
                  <AnexosDoEscrever
                    pub={pub}
                    t={t}
                    lang={lang}
                    resposta={resposta}
                    tamanho={tamanho}
                    maximo={maximo}
                    enquete={tipo === "enquete"}
                    aoEnquete={resposta ? undefined : (ligar) => setTipo(ligar ? "enquete" : "post")}
                  />
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
                  }}
                />
                <Escolha
                  icone={<Icone nome={iconeDoPublico(publico)} className={`h-5 w-5 ${publico === "internet" ? "text-[var(--al-dourado)]" : ""}`} />}
                  rotulo={t.escrever.quemVe}
                  valor={rotuloDoPublico(publico)}
                  aberta={aberta === "quem"}
                  aoAbrir={() => setAberta(aberta === "quem" ? null : "quem")}
                  aoFecharLista={() => setAberta(null)}
                  vertical
                  opcoes={publicos.map((p) => ({ valor: p, texto: rotuloDoPublico(p), ajuda: ajudaDoPublico(p), icone: iconeDoPublico(p) }))}
                  escolhido={publico}
                  aoEscolher={(v) => setPublico(v as Publico)}
                  depois={
                    // A roda de confiança (lista pessoal, do perfil) entra aqui quando a lista existir no banco; até lá, avisa.
                    <p className="al2-opcao-roda" aria-disabled="true">
                      <Icone nome="roda" className="h-5 w-5 shrink-0 text-[var(--al-com-1)]" />
                      <span className="min-w-0 flex-1">
                        <strong>{t.escrever.publicoRoda}</strong>
                        <span className="block text-xs text-[var(--al-texto-3)]">{t.escrever.rodaEmBreve}</span>
                      </span>
                    </p>
                  }
                />
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
                {tipo !== "ato" && (
                  // Quem pode citar (repostar com comentário): padrão "ninguém"; o banco confere em qualquer caminho que cite.
                  <Escolha
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
            {!resposta && publico === "internet" && (
              <p className="al2-nota">
                <Icone nome="fediverso" className="h-4 w-4 text-[var(--al-dourado)]" />
                {t.escrever.notaFediverso}
              </p>
            )}
            {/* Sair no Fediverso é escolha da comunidade (a trava é de propósito: um post solto nunca sai da Alumia sem querer). */}
            {!resposta && tipo !== "ato" && !publicos.includes("internet") && aberta === "quem" && (
              <p className="al2-nota">
                <Icone nome="fediverso" className="h-4 w-4" />
                {t.b1.fediverso}
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

          <div aria-live="polite" className="px-4 pb-4 empty:hidden">
            {erro && (
              <p role="alert" className="al2-nota al2-nota-alerta">
                <Icone nome="alerta" className="h-4 w-4" />
                {erro}
              </p>
            )}
            {aviso && (
              <p role="status" className="al2-aviso-escrever">
                {aviso}
              </p>
            )}
          </div>
        </div>
      </div>

      {envio && (
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
              <button ref={botaoDesfazer} type="button" onClick={desfazer} className="al-botao al-botao-primario al-botao-p">
                <Icone nome="desfazer" className="h-4 w-4" />
                {t.escrever.desfazer}
              </button>
            </>
          )}
          <span className="al2-aviso-barra" aria-hidden />
        </div>
      )}
    </>
  );
}

interface OpcaoDaEscolha {
  valor: string;
  texto: string;
  ajuda?: string;
  icone?: NomeDoIcone;
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
              conteudo: vertical ? (
                <>
                  {o.icone && <Icone nome={o.icone} className="h-5 w-5 shrink-0" />}
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block font-bold">{o.texto}</span>
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
