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
import { COMUNIDADES_DE_EXEMPLO } from "@/lib/rede/publicar/exemplos-alumia2";
import type { TextosDaRede } from "@/lib/rede/textos";
import { carregarTextosDaConversa, type TextosDaConversa } from "@/lib/rede/textos-conversa";
import type { Comunidade, Post, Publico, Situacao, TipoDePost } from "@/lib/rede/tipos";
import type { PedidoPublicar, RespondeQuem } from "@/lib/rede/tipos-publicar";
import { CampoComMencoes } from "../../conversa/CampoComMencoes";
import { ENCAIXES, verificarAntesDePublicar } from "../../encaixes";
import { codigoDoErro, textoDoErro } from "../../erros";
import { Mosaico } from "../../mosaico/Mosaico";
import { corDaComunidade } from "../../ui/Pilula";
import { ExtrasDoEscrever, useEscreverPub } from "../ExtrasDoEscrever";
import { textoDoErroPublicar } from "../textos";
import { faltaNoBanco } from "./CartaoDaAlumia2";
import type { TipoAoEscrever } from "./CascaDaAlumia2";
import { useAlumia2 } from "./contexto";
import { Icone } from "./icones";

type ComunidadeResumida = Pick<Comunidade, "slug" | "nome" | "categoria" | "publico_padrao">;
interface Lugar {
  slug: string;
  nome: string;
  categoria: string;
  cor: CorDaComunidadeNum;
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
  const [onde, setOnde] = useState<string | null>(comunidade?.slug ?? null);
  const [publico, setPublico] = useState<Publico>(comunidade ? (comunidade.publico_padrao === "internet" ? "internet" : comunidade.publico_padrao === "comunidade" ? "comunidade" : "membros") : "membros");
  const [aberta, setAberta] = useState<"onde" | "quem" | "responde" | null>(null);
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
  const [rascunhoOnde, setRascunhoOnde] = useState<"conta" | "aparelho" | null>(null);
  const [rascunhos, setRascunhos] = useState<RascunhoDoServidor[]>([]);
  const [tc, setTc] = useState<TextosDaConversa | null>(null);
  const dialogo = useRef<HTMLDivElement>(null);
  const semServidor = useRef(false);

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

  // Os rascunhos guardados na conta (só para quem abre o Escrever vazio, e nunca para resposta).
  useEffect(() => {
    if (resposta || previa || textoInicial) return;
    let vivo = true;
    redePub.rascunhos().then(
      (lista) => vivo && setRascunhos(rascunhosValidos(Array.isArray(lista) ? lista : [], Date.now())),
      (e) => {
        if (faltaNoBanco(e)) semServidor.current = true;
      },
    );
    return () => {
      vivo = false;
    };
  }, [resposta, previa, textoInicial]);

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

  // Esc fecha (menos durante o envio: aí o Desfazer é que manda).
  useEffect(() => {
    const sair = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !envio) aoFechar();
    };
    window.addEventListener("keydown", sair);
    return () => window.removeEventListener("keydown", sair);
  }, [aoFechar, envio]);

  const lugar = lugares.find((l) => l.slug === onde) ?? (comunidade && onde === comunidade.slug ? { slug: comunidade.slug, nome: comunidade.nome, categoria: comunidade.categoria, cor: corDaComunidade(comunidade.slug) } : null);

  // Rascunho na conta: guarda 2,5 s depois da última tecla; sem a função no banco, avisa que fica só no aparelho.
  const rascunhoAtual = useMemo<RascunhoDoServidor>(
    () => ({ id: rascunhoId, tipo, texto, titulo, corpo, comunidade: onde, publico, responde_quem: pub.respondeQuem }),
    [rascunhoId, tipo, texto, titulo, corpo, onde, publico, pub.respondeQuem],
  );
  useEffect(() => {
    if (resposta || previa || envio) return;
    const id = window.setTimeout(() => {
      if (semServidor.current) {
        if (rascunhoTemTexto(rascunhoAtual)) setRascunhoOnde("aparelho");
        return;
      }
      if (!rascunhoTemTexto(rascunhoAtual)) {
        if (rascunhoAtual.id) void redePub.apagarRascunho(rascunhoAtual.id).then(() => setRascunhoId(null), () => undefined);
        return;
      }
      redePub.salvarRascunho(rascunhoAtual).then(
        (r) => {
          setRascunhoId(r.id);
          setRascunhoOnde("conta");
        },
        (e) => {
          if (faltaNoBanco(e)) semServidor.current = true;
          setRascunhoOnde("aparelho");
        },
      );
    }, ESPERA_DO_RASCUNHO_MS);
    return () => window.clearTimeout(id);
    // rascunhoAtual.id muda só quando o servidor responde: não precisa guardar de novo por isso
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, titulo, corpo, tipo, onde, publico, pub.respondeQuem, resposta, previa, envio]);

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
  const pronto =
    tipo === "ato"
      ? nomeDoAto.trim().length >= 2
      : (longo ? titulo.trim().length >= 5 && corpo.trim().length >= 10 : texto.trim().length >= 1) && pub.podeEnviar && (!pub.agendar || pub.agendaOk);

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
      const pedido = await montarPedido();
      if (!resposta && pub.agendar && tipo !== "ato") {
        const quando = new Date(pub.agendar);
        await redePub.agendar(pedido, quando.toISOString());
        pub.limpar();
        setEnvio(null);
        setAviso(preencher(pub.t?.agendar.agendado ?? "", { quando: quando.toLocaleString(lang, { dateStyle: "short", timeStyle: "short" }) }));
        return;
      }
      const post = await rede.publicar(pedido);
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
      setErro((pub.t && textoDoErroPublicar(pub.t, codigoDoErro(e))) || textoDoErro(s, e));
    } finally {
      setOcupado(false);
    }
  }, [previa, al2, montarPedido, resposta, pub, tipo, lang, rascunhoId, aoPublicar, s, aoFechar]);

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
    setAgora(n);
    setEnvio({ desde: n });
  }

  function desfazer() {
    setEnvio(null);
    setAviso(al2?.t.escrever.desfeito ?? "");
  }

  function continuarRascunho(r: RascunhoDoServidor) {
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

  function apagarRascunho(r: RascunhoDoServidor) {
    if (!r.id) return;
    setRascunhos((l) => l.filter((x) => x.id !== r.id));
    void redePub.apagarRascunho(r.id).catch(() => undefined);
  }

  if (!al2) return null;
  const { t } = al2;
  const faltam = envio ? segundosQueFaltam(envio.desde, agora || envio.desde) : SEGUNDOS_PARA_DESFAZER;
  const principal = tipo === "ato" ? t.escrever.chamarAto : resposta ? t.escrever.resposta : t.escrever.publicar;
  const placeholder = tipo === "enquete" ? t.escrever.pergunta : longo ? t.escrever.corpo : t.escrever.texto;
  const responde: RespondeQuem[] = ["todos", "seguindo", "mencionados", "ninguem"];
  const rotuloResponde = (q: RespondeQuem) => ({ todos: t.escrever.respondeTodos, seguindo: t.escrever.respondeSeguindo, mencionados: t.escrever.respondeMencionados, ninguem: t.escrever.respondeNinguem })[q];

  return (
    <>
      <div className={`al2 fixed inset-0 z-50 flex flex-col bg-[var(--al-fundo)] md:items-center md:justify-center md:bg-black/70 md:p-6 ${envio ? "hidden" : ""}`} role="dialog" aria-modal="true" aria-labelledby="al2-escrever-titulo">
        <div ref={dialogo} className="flex h-full w-full flex-col bg-[var(--al-fundo)] md:h-auto md:max-h-[92vh] md:max-w-xl md:rounded-2xl md:border md:border-[var(--al-superficie-2)]">
          <div className="al-faixa" aria-hidden />
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <button type="button" onClick={aoFechar} className="al2-acao !text-[1.05rem] !text-[var(--al-texto-2)]">
              {t.escrever.cancelar}
            </button>
            <h2 id="al2-escrever-titulo" className="sr-only">
              {resposta ? t.escrever.resposta : t.escrever.titulo}
            </h2>
            <button type="button" onClick={() => void publicar()} disabled={!pronto || ocupado} className="al-botao al-botao-primario al-botao-g">
              {ocupado ? t.escrever.publicando : principal}
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-6">
            {resposta && respostaA && (
              <p className="rounded-xl border-l-4 border-[var(--al-vermelho)] bg-[var(--al-superficie)] px-3 py-2 text-sm text-[var(--al-texto-2)]">
                <strong>{respostaA.autor.codinome}</strong>: {respostaA.texto.slice(0, 160)}
              </p>
            )}

            {!resposta && (
              <div role="radiogroup" aria-label={t.escrever.tipos} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                {tipos.map((x) => (
                  <button key={x} type="button" role="radio" aria-checked={tipo === x} onClick={() => setTipo(x)} className="al2-tipo">
                    {x === "ato" && <Icone nome="atos" className="h-5 w-5" />}
                    {t.escrever[x]}
                  </button>
                ))}
              </div>
            )}

            {!resposta && rascunhos.length > 0 && !rascunhoTemTexto({ texto, titulo, corpo }) && (
              <details className="rounded-xl border border-[var(--al-superficie-2)] p-3 text-sm">
                <summary className="cursor-pointer font-bold">{preencher(t.escrever.rascunhos, { n: rascunhos.length })}</summary>
                <p className="mt-1 text-xs text-[var(--al-texto-3)]">{t.escrever.rascunhosAjuda}</p>
                <ul className="mt-2 space-y-1">
                  {rascunhos.map((r) => (
                    <li key={r.id ?? r.atualizado_em} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate">{(r.titulo || r.texto || r.corpo).trim() || t.escrever.semTexto}</span>
                      <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => continuarRascunho(r)}>{t.escrever.continuar}</button>
                      <button type="button" className="al2-acao" onClick={() => apagarRascunho(r)}>{t.escrever.apagar}</button>
                    </li>
                  ))}
                </ul>
              </details>
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
                    <div className="flex gap-2" role="radiogroup" aria-label={t.escrever.longoComo}>
                      {(["discussao", "duvida"] as const).map((x) => (
                        <button key={x} type="button" role="radio" aria-checked={longoComo === x} onClick={() => setLongoComo(x)} className="al2-tipo !min-h-10 !px-3 text-sm">
                          {t.escrever[x]}
                        </button>
                      ))}
                    </div>
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
                      className="al2-campo min-h-40 resize-y text-[1.15rem] leading-relaxed"
                      linhas={6}
                      autoFocus
                    />
                  ) : (
                    <textarea
                      className="al2-campo min-h-40 resize-y text-[1.15rem] leading-relaxed"
                      placeholder={placeholder}
                      maxLength={maximo}
                      value={longo ? corpo : texto}
                      onChange={(e) => (longo ? setCorpo(e.target.value) : setTexto(e.target.value))}
                    />
                  )}
                  <span className="mt-1 block text-right text-xs text-[var(--al-texto-3)]">{preencher(t.escrever.contador, { n: tamanho, max: maximo })}</span>
                </label>
                <div className="al2-extras text-[var(--al-texto)]">
                  <ExtrasDoEscrever pub={pub} resposta={resposta} lang={lang} semQuemResponde />
                </div>
              </>
            )}

            {!resposta && (
              <div className="border-b border-[var(--al-linha)]">
                <Escolha
                  icone={<span aria-hidden className="h-4 w-4 rounded-[4px]" style={{ background: lugar ? `var(--al-com-${lugar.cor})` : "var(--al-texto-3)" }} />}
                  rotulo={t.escrever.ondePublicar}
                  valor={lugar?.nome ?? t.escrever.noPerfil}
                  aberta={aberta === "onde"}
                  aoAbrir={() => setAberta(aberta === "onde" ? null : "onde")}
                  opcoes={[{ valor: "", texto: t.escrever.noPerfil }, ...lugares.map((l) => ({ valor: l.slug, texto: l.nome }))]}
                  escolhido={onde ?? ""}
                  aoEscolher={(v) => {
                    setOnde(v || null);
                    if (!v && publico === "comunidade") setPublico("membros");
                    setAberta(null);
                  }}
                />
                <Escolha
                  icone={<Icone nome="fediverso" className="h-5 w-5 text-[var(--al-dourado)]" />}
                  rotulo={t.escrever.quemVe}
                  valor={rotuloDoPublico(publico)}
                  aberta={aberta === "quem"}
                  aoAbrir={() => setAberta(aberta === "quem" ? null : "quem")}
                  opcoes={publicos.map((p) => ({ valor: p, texto: rotuloDoPublico(p) }))}
                  escolhido={publico}
                  aoEscolher={(v) => {
                    setPublico(v as Publico);
                    setAberta(null);
                  }}
                />
                <Escolha
                  icone={<Icone nome="responder" className="h-5 w-5" />}
                  rotulo={t.escrever.quemResponde}
                  valor={rotuloResponde(pub.respondeQuem)}
                  aberta={aberta === "responde"}
                  aoAbrir={() => setAberta(aberta === "responde" ? null : "responde")}
                  opcoes={responde.map((q) => ({ valor: q, texto: rotuloResponde(q) }))}
                  escolhido={pub.respondeQuem}
                  aoEscolher={(v) => {
                    pub.setRespondeQuem(v as RespondeQuem);
                    setAberta(null);
                  }}
                />
              </div>
            )}

            <p className="text-xs text-[var(--al-texto-3)]">{preencher(t.escrever.codinome, { codinome: situacao.codinome ?? "" })}</p>
            {rascunhoOnde && <p className="text-xs text-[var(--al-texto-3)]" role="status">{rascunhoOnde === "conta" ? t.escrever.rascunhoNaConta : t.escrever.rascunhoSoAqui}</p>}
          </div>

          <div aria-live="polite" className="px-4 pb-4">
            {erro && <p role="alert" className="text-[var(--oxblood)]">{erro}</p>}
            {aviso && (
              <p role="status" className="rounded-xl border border-dashed border-[var(--al-texto-3)] px-3 py-2 text-sm">
                {aviso}
              </p>
            )}
          </div>
        </div>
      </div>

      {envio && (
        <div className="al2 al2-aviso-flutuante" role="status" aria-live="polite">
          <span>{preencher(t.escrever.enviandoEm, { s: faltam })}</span>
          <button type="button" onClick={desfazer} className="al-botao al-botao-primario al-botao-p">
            {t.escrever.desfazer}
          </button>
        </div>
      )}
    </>
  );
}

/** Uma linha de escolha (Onde publicar, Quem vê, Quem responde): abre a lista ali mesmo, como na prancha. */
function Escolha({
  icone,
  rotulo,
  valor,
  aberta,
  aoAbrir,
  opcoes,
  escolhido,
  aoEscolher,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
  aberta: boolean;
  aoAbrir: () => void;
  opcoes: { valor: string; texto: string }[];
  escolhido: string;
  aoEscolher: (v: string) => void;
}) {
  return (
    <div>
      <button type="button" className="al2-escolha" aria-expanded={aberta} onClick={aoAbrir}>
        <span className="grid w-6 place-items-center">{icone}</span>
        <span>{rotulo}</span>
        <strong>{valor}</strong>
        <Icone nome="chevron" className={`h-5 w-5 shrink-0 transition-transform ${aberta ? "rotate-90" : ""}`} />
      </button>
      {aberta && (
        <div role="radiogroup" aria-label={rotulo} className="mb-3 flex flex-wrap gap-2 pl-9">
          {opcoes.map((o) => (
            <button key={o.valor} type="button" role="radio" aria-checked={escolhido === o.valor} onClick={() => aoEscolher(o.valor)} className="al2-tipo !min-h-10 !px-3 text-sm">
              {o.texto}
            </button>
          ))}
        </div>
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
        <input className="al2-campo al-cond min-h-14 !text-[1.9rem] !font-black uppercase" value={d.nome} maxLength={40} onChange={mudar("nome")} />
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
