// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { evaluatePost } from "@/lib/backend";
import { rede } from "@/lib/rede/cliente";
import { redeMod } from "@/lib/rede/cliente-moderacao";
import { redePub } from "@/lib/rede/cliente-publicar";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import { carregarTextosDaConversa, type TextosDaConversa } from "@/lib/rede/textos-conversa";
import { carregarTextosMod, type TextosDaModeracao } from "@/lib/rede/textos-moderacao";
import type { Comunidade, Post, Publico, Situacao, TipoDePost } from "@/lib/rede/tipos";
import type { PedidoPublicar } from "@/lib/rede/tipos-publicar";
import { CampoComMencoes } from "./conversa/CampoComMencoes";
import { codigoDoErro, textoDoErro } from "./erros";
import { ExtrasDoEscrever, useEscreverPub } from "./publicar/ExtrasDoEscrever";
import { idiomaDoEndereco, textoDoErroPublicar } from "./publicar/textos";

type ComunidadeResumida = Pick<Comunidade, "slug" | "nome" | "categoria" | "publico_padrao">;

const LIMITE_POST = 500;
const LIMITE_CORPO = 10_000;

/**
 * Escrever na Rede. No celular ocupa a tela toda (a barra de baixo some por baixo); no computador é uma janela no meio. Confirmação
 * e erro aparecem aqui dentro (nunca alert/confirm do navegador). Resposta herda comunidade e público do post respondido: o
 * seletor de público some. Enquete, imagens, áudio, rascunho e agendamento são do pacote publicar, que acrescenta campos aqui.
 */
export function Escrever({
  s,
  situacao,
  comunidade,
  respostaA,
  aoFechar,
  aoPublicar,
  textoInicial = "",
}: {
  s: TextosDaRede;
  situacao: Situacao;
  comunidade?: ComunidadeResumida | null;
  respostaA?: Post | null;
  aoFechar: () => void;
  aoPublicar: (post: Post) => void;
  /** Um começo que a própria pessoa escolheu (as perguntas de abertura da linha vazia, docs/rede/SEMEAR.md); ela edita antes de publicar. */
  textoInicial?: string;
}) {
  const [tipo, setTipo] = useState<TipoDePost>("post");
  const [texto, setTexto] = useState(textoInicial);
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [publico, setPublico] = useState<Publico>(comunidade ? (comunidade.publico_padrao === "internet" ? "internet" : comunidade.publico_padrao === "comunidade" ? "comunidade" : "membros") : "membros");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const resposta = Boolean(respostaA);
  const longo = !resposta && (tipo === "discussao" || tipo === "duvida");
  // Pacote publicar: enquete, imagens, áudio, prévia de link, quem responde, fio, agendamento e rascunho (components/rede/publicar).
  const pub = useEscreverPub({
    tipo, resposta, respostaPropria: Boolean(respostaA?.meu), texto, titulo, corpo,
    aplicarRascunho: (r) => { setTipo(r.tipo); setTexto(r.texto); setTitulo(r.titulo); setCorpo(r.corpo); },
  });
  const lang = idiomaDoEndereco();
  const agendaForaDoPrazo = Boolean(pub.agendar) && !resposta && !pub.agendaOk;

  // Autocompletar de @ (pacote conversa) e aviso de modo lento (pacote moderação): carregados à parte; sem eles, a caixa simples de sempre.
  const [tc, setTc] = useState<TextosDaConversa | null>(null);
  const [sm, setSm] = useState<TextosDaModeracao | null>(null);
  const [lento, setLento] = useState(0);
  const tipoLento: "comunidade" | "conversa" | null = respostaA ? "conversa" : comunidade ? "comunidade" : null;
  const alvoLento = respostaA ? respostaA.raiz : (comunidade?.slug ?? "");
  useEffect(() => {
    let vivo = true;
    carregarTextosDaConversa(lang).then((x) => { if (vivo) setTc(x); }, () => undefined);
    return () => { vivo = false; };
  }, [lang]);
  useEffect(() => {
    if (!tipoLento || !alvoLento) return;
    let vivo = true;
    redeMod.lentoDe(tipoLento, alvoLento).then(
      async (n) => {
        if (!vivo || typeof n !== "number" || n <= 0) return;
        const textos = await carregarTextosMod(lang);
        if (vivo) { setSm(textos); setLento(n); }
      },
      () => undefined,
    );
    return () => { vivo = false; };
  }, [tipoLento, alvoLento, lang]);
  const tempoLento = lento >= 3600 ? `${Math.round(lento / 3600)} h` : lento >= 60 ? `${Math.round(lento / 60)} min` : `${lento} s`;

  useEffect(() => {
    area.current?.focus();
    const sair = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    window.addEventListener("keydown", sair);
    return () => window.removeEventListener("keydown", sair);
  }, [aoFechar]);

  const publicos: Publico[] = ["membros", "seguidores", ...(comunidade ? (["comunidade"] as Publico[]) : []), ...(comunidade?.categoria === "disciplinas" ? (["internet"] as Publico[]) : []), ...(situacao.equipe ? (["equipe"] as Publico[]) : [])];
  const tipos: TipoDePost[] = ["post", "discussao", "duvida", "enquete", ...(situacao.equipe ? (["aviso"] as TipoDePost[]) : [])];
  const tamanho = longo ? corpo.length : texto.length;
  const maximo = longo ? LIMITE_CORPO : LIMITE_POST;
  const pronto = (longo ? titulo.trim().length >= 5 && corpo.trim().length >= 10 : texto.trim().length >= 1) && pub.podeEnviar && !agendaForaDoPrazo;

  async function enviar() {
    setErro("");
    setOcupado(true);
    try {
      const base: PedidoPublicar = resposta
        ? { texto: texto.trim(), resposta_a: respostaA?.id }
        : { tipo, ...(longo ? { titulo: titulo.trim(), corpo: corpo.trim() } : { texto: texto.trim() }), publico, ...(comunidade ? { comunidade: comunidade.slug } : {}) };
      // Sobe imagens e áudio (o servidor tira o metadado de novo) e junta enquete, prévia, fio e "quem pode responder".
      const pedido: PedidoPublicar = { ...base, ...(await pub.preparar()) };
      if (!resposta && pub.agendar) {
        const quando = new Date(pub.agendar);
        await redePub.agendar(pedido, quando.toISOString());
        pub.limpar();
        setAviso(preencher(pub.t?.agendar.agendado ?? "", { quando: quando.toLocaleString(lang, { dateStyle: "short", timeStyle: "short" }) }));
        return;
      }
      const post = await rede.publicar(pedido);
      // Retido para a segunda avaliação (avaliar-comunidade): pede agora; se falhar, o post segue retido para a mediação.
      if (post.avaliar && post.id) void evaluatePost("rede", post.id);
      pub.limpar();
      aoPublicar(post);
      if (post.retido) {
        setAviso(s.post.retido);
        return;
      }
      aoFechar();
    } catch (e) {
      setErro((pub.t && textoDoErroPublicar(pub.t, codigoDoErro(e))) || textoDoErro(s, e));
    } finally {
      setOcupado(false);
    }
  }

  const campo = "block w-full rounded-md border border-rule bg-folha px-2 py-2 font-sans text-ink";
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-parchment md:items-center md:justify-center md:bg-black/50 md:p-6" role="dialog" aria-modal="true" aria-labelledby="rede-escrever-titulo">
      <div className="flex h-full w-full flex-col bg-parchment md:h-auto md:max-h-[90vh] md:max-w-xl md:rounded-2xl md:border-[1.5px] md:border-ink md:shadow-[5px_5px_0_#c21f16]">
        <div className="flex items-center justify-between border-b border-rule px-4 py-3">
          <button type="button" onClick={aoFechar} className="min-h-11 cursor-pointer rounded-full px-3 font-sans font-bold hover:bg-parchment-deep">
            {s.casca.fechar}
          </button>
          <h2 id="rede-escrever-titulo" className="font-serif text-lg font-semibold">
            {resposta ? s.acoes.responder : s.casca.escrever}
          </h2>
          <button type="button" onClick={() => void enviar()} disabled={!pronto || ocupado || Boolean(aviso)} className="min-h-11 cursor-pointer rounded-full bg-[#c21f16] px-5 font-sans font-bold text-white hover:bg-[#1f1a14] disabled:cursor-not-allowed disabled:opacity-50">
            {ocupado ? s.casca.publicando : pub.agendar && !resposta ? (pub.t?.agendar.marcar ?? s.casca.publicar) : s.casca.publicar}
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <p className="font-sans text-sm text-ink-soft">{preencher(s.postando, { codinome: situacao.codinome ?? "" })}</p>
          {resposta && respostaA && <p className="rounded-md border-l-4 border-ink bg-parchment-deep px-2 py-1 font-sans text-sm text-ink-soft">{respostaA.autor.codinome}: {respostaA.texto.slice(0, 160)}</p>}

          {!resposta && (
            <label className="block font-sans text-sm">
              <span className="font-bold">{s.casca.tipo}</span>
              <select className={`${campo} mt-1 min-h-11`} value={tipo} onChange={(e) => setTipo(e.target.value as TipoDePost)}>
                {tipos.map((t) => (
                  <option key={t} value={t}>
                    {(s.tipos as Record<string, string>)[t]}
                  </option>
                ))}
              </select>
            </label>
          )}

          {longo && (
            <label className="block font-sans text-sm">
              <span className="font-bold">{s.casca.tituloDica}</span>
              <input className={`${campo} mt-1 min-h-11`} value={titulo} maxLength={140} onChange={(e) => setTitulo(e.target.value)} />
            </label>
          )}
          <label className="block font-sans text-sm">
            <span className="sr-only">{longo ? s.casca.corpoDica : s.casca.textoDica}</span>
            {tc ? (
              <CampoComMencoes
                valor={longo ? corpo : texto}
                aoMudar={longo ? setCorpo : setTexto}
                t={tc}
                rotulo={longo ? s.casca.corpoDica : s.casca.textoDica}
                placeholder={longo ? s.casca.corpoDica : pub.enquete && pub.t ? pub.t.enquete.pergunta : s.casca.textoDica}
                maxLength={maximo}
                postId={respostaA?.id ?? null}
                className={`${campo} min-h-48 resize-y text-lg`}
                linhas={8}
                autoFocus
              />
            ) : (
              <textarea
                ref={area}
                className={`${campo} min-h-48 resize-y text-lg`}
                placeholder={longo ? s.casca.corpoDica : pub.enquete && pub.t ? pub.t.enquete.pergunta : s.casca.textoDica}
                maxLength={maximo}
                value={longo ? corpo : texto}
                onChange={(e) => (longo ? setCorpo(e.target.value) : setTexto(e.target.value))}
              />
            )}
            <span className="mt-1 block text-right text-xs text-ink-soft">{preencher(s.casca.contador, { n: tamanho, max: maximo })}</span>
          </label>

          {lento > 0 && sm && <p role="note" className="rounded-md border border-dashed border-ink bg-parchment-deep px-2 py-1 font-sans text-sm">{preencher(sm.moderar.lentoAviso, { tempo: tempoLento })}</p>}

          <ExtrasDoEscrever pub={pub} resposta={resposta} lang={lang} />

          {!resposta && (
            <label className="block font-sans text-sm">
              <span className="font-bold">{s.casca.publico}</span>
              <select className={`${campo} mt-1 min-h-11`} value={publico} onChange={(e) => setPublico(e.target.value as Publico)}>
                {publicos.map((p) => (
                  <option key={p} value={p}>
                    {(s.publicos as Record<string, string>)[p]}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-ink-soft">{preencher(s.quemVe, { publico: (s.publicos as Record<string, string>)[publico] })}</span>
            </label>
          )}
          {!resposta && comunidade && <p className="font-sans text-sm text-ink-soft">{s.casca.comunidade.replace(/\s*\(.*\)/, "")}: {comunidade.nome}</p>}
          <p className="font-sans text-xs text-ink-soft">{s.codinome.aviso}</p>
        </div>

        <div aria-live="polite" className="px-4 pb-4">
          {erro && <p role="alert" className="font-sans text-oxblood">{erro}</p>}
          {aviso && (
            <p role="status" className="rounded-md border border-dashed border-ink bg-parchment-deep px-2 py-1 font-sans text-sm">
              {aviso}{" "}
              <button type="button" onClick={aoFechar} className="cursor-pointer font-bold underline">
                {s.casca.fechar}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
