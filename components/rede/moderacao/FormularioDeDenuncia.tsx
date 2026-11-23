// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { useEffect, useId, useState } from "react";
import { redeMod } from "@/lib/rede/cliente-moderacao";
import { deB64, provaInteira, trechoNoConteudo, type ProvaDeFranquia } from "@/lib/rede/franquia/protocolo";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaModeracao } from "@/lib/rede/textos-moderacao";
import { CATEGORIAS_DE_DENUNCIA, enderecosModeracao, prioridadeDaCategoria, type AlvoDeDenuncia, type CategoriaDeDenuncia, type ResultadoDeDenuncia } from "@/lib/rede/tipos-moderacao";
import { postCifrado } from "../publicar/restrito/grupo";
import { ABERTOS_NA_PREVIA } from "../publicar/restrito/previa";
import { estilo, mensagemDeErro } from "./base";
import { LIMITE_DO_TRECHO, trechoContido } from "./trecho";

/** O post denunciado, quando é post: com grupo e corpo cifrado, a tela oferece mandar o trecho aberto neste aparelho. */
export type PostDaDenuncia = { id: string; grupo?: string | null; corpo_grupo?: string | null; autor: { id: string | null } };

/** O contrato com o módulo dos posts restritos: abrir o post com a prova da franquia (o módulo dos grupos o oferece na R2). */
type AbrirComProva = (post: PostDaDenuncia) => Promise<{ texto: string; prova: ProvaDeFranquia | null } | null>;

/**
 * O formulário de denúncia, para post, perfil ou comunidade: categoria (as de prioridade 1 vêm na frente), texto opcional e o protocolo
 * na volta. Diz, antes de enviar, que quem denuncia nunca é revelado. Confirmação dentro da página, nunca alert do navegador.
 *
 * Post cifrado (núcleo e comunidade fechada): a moderação não tem a chave do grupo. O formulário abre o post neste aparelho e,
 * se abriu, oferece mandar um trecho em texto aberto, com o custo dito na tela ("a moderação vai ler este trecho; o resto
 * continua cifrado"). O trecho começa desmarcado: sem ele, a denúncia vai sem o conteúdo. Só sai o que está no post (cortar
 * pode, reescrever não). Na prévia, nada vai ao banco: a volta é um protocolo de exemplo.
 *
 * Com prova (onda R2): quando o módulo dos posts restritos entrega a prova do post (`abrirComProva`, contrato do módulo dos grupos),
 * o trecho vai pela denúncia com prova (lib/rede/franquia/cliente.ts): o servidor confere que ele está no post que passou pela
 * caixa do grupo, e a fila mostra "texto conferido". Sem a prova, o caminho de antes (a fila diz que não deu para conferir).
 */
export function FormularioDeDenuncia({
  lang, s, sm, alvoTipo, alvo, aoFechar, post, previa = false,
}: {
  lang: string;
  s: TextosDaRede;
  sm: TextosDaModeracao;
  alvoTipo: AlvoDeDenuncia;
  alvo: string;
  aoFechar: () => void;
  post?: PostDaDenuncia;
  previa?: boolean;
}) {
  const [categoria, setCategoria] = useState<CategoriaDeDenuncia | "">("");
  const [texto, setTexto] = useState("");
  const cifrado = alvoTipo === "post" && post !== undefined && postCifrado(post);
  // undefined: abrindo; null: não abre neste aparelho; texto: aberto (só aqui, na memória da tela).
  const [aberto, setAberto] = useState<string | null | undefined>(undefined);
  const [mandarTrecho, setMandarTrecho] = useState(false);
  const [trecho, setTrecho] = useState("");
  // A prova do post (só neste aparelho, na memória da tela), quando o módulo dos grupos a entrega e o compromisso confere.
  const [prova, setProva] = useState<ProvaDeFranquia | null>(null);
  const idDoCusto = useId();
  useEffect(() => {
    if (!cifrado || !post) return;
    let vivo = true;
    const abrir: Promise<{ texto: string; prova: ProvaDeFranquia | null } | null> = previa
      ? Promise.resolve(ABERTOS_NA_PREVIA[post.id] ? { texto: ABERTOS_NA_PREVIA[post.id], prova: null } : null)
      : import("../publicar/restrito/aparelho").then(async (m) => {
          const comProva = (m as { abrirComProva?: AbrirComProva }).abrirComProva;
          if (comProva) return comProva(post);
          const t = await m.abrirNoAparelho(post);
          return t ? { texto: t, prova: null } : null;
        });
    abrir.then(
      (r) => {
        if (!vivo) return;
        setAberto(r?.texto || null);
        setProva(r && provaInteira(r.prova) ? r.prova : null);
        if (r?.texto) setTrecho(r.texto.slice(0, LIMITE_DO_TRECHO));
      },
      () => vivo && setAberto(null),
    );
    return () => {
      vivo = false;
    };
    // O post só muda de verdade quando muda o id ou o corpo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cifrado, post?.id, post?.corpo_grupo, previa]);
  // Com prova, o trecho tem de estar byte a byte na mensagem (o servidor confere assim); sem prova, a regra de antes.
  const conteudoDaProva = prova ? deB64(prova.conteudo) : null;
  const trechoOk = !mandarTrecho || (typeof aberto === "string" && (conteudoDaProva ? trechoNoConteudo(conteudoDaProva, trecho.trim()) : trechoContido(aberto, trecho)));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<ResultadoDeDenuncia | null>(null);
  const titulo = alvoTipo === "perfil" ? sm.denunciar.tituloPerfil : alvoTipo === "comunidade" ? sm.denunciar.tituloComunidade : sm.denunciar.titulo;
  const categorias = sm.categorias as Record<string, { rotulo: string; ajuda: string }>;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!categoria || ocupado || !trechoOk) return;
    setOcupado(true);
    setErro("");
    const vai = cifrado && mandarTrecho && typeof aberto === "string" ? trecho.replace(/\s+/g, " ").trim() : "";
    try {
      if (previa) setResultado({ protocolo: "EXEMPLO-2611", prioridade: 2, retido: false, ja: false });
      else if (cifrado && mandarTrecho && prova) {
        const { denunciarComProva } = await import("@/lib/rede/franquia/cliente");
        const r = await denunciarComProva({ categoria, autor: "", post: alvo, texto: texto.trim(), trechos: [{ texto: trecho.trim(), prova }] });
        setResultado({ protocolo: r.protocolo, prioridade: r.prioridade === 1 ? 1 : r.prioridade === 2 ? 2 : 3, retido: false, ja: r.ja });
      } else setResultado(await redeMod.denunciar(alvoTipo, alvo, categoria, texto.trim(), vai));
    } catch (x) {
      setErro(mensagemDeErro(s, sm, x));
    } finally {
      setOcupado(false);
    }
  }

  if (resultado) {
    return (
      <div className={`${estilo.caixa} mt-2 w-full basis-full`} role="status">
        <p className="font-bold">{preencher(resultado.ja ? sm.denunciar.ja : sm.denunciar.feito, { protocolo: resultado.protocolo })}</p>
        {resultado.retido && <p className="mt-1 text-sm">{sm.denunciar.retido}</p>}
        <p className="mt-1 text-sm text-ink-soft">{sm.denunciar.acompanhe}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href={enderecosModeracao.denuncias(lang)} className={`${estilo.botao} inline-flex items-center`}>{sm.denunciar.acompanhar}</Link>
          <button type="button" className={estilo.botao} onClick={aoFechar}>{sm.fechar}</button>
        </div>
      </div>
    );
  }

  // As de prioridade 1 aparecem primeiro: quem está com pressa acha o que importa de cara.
  const ordem = [...CATEGORIAS_DE_DENUNCIA].sort((a, b) => prioridadeDaCategoria(a) - prioridadeDaCategoria(b));
  return (
    <form onSubmit={enviar} className={`${estilo.caixa} mt-2 w-full basis-full space-y-3`} aria-label={titulo}>
      <fieldset>
        <legend className="font-bold">{titulo}: {sm.denunciar.categoria}</legend>
        <div className="mt-2 space-y-1">
          {ordem.map((c) => (
            <label key={c} className="flex min-h-11 cursor-pointer items-start gap-2 rounded-md px-1 py-1 hover:bg-parchment-deep">
              <input type="radio" name={`categoria-${alvo}`} value={c} checked={categoria === c} onChange={() => setCategoria(c)} className="mt-1.5" />
              <span>
                <span className="font-semibold">{categorias[c].rotulo}</span>
                <span className="block text-xs text-ink-soft">{categorias[c].ajuda}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {cifrado && (
        <fieldset className="space-y-2 rounded-md border border-rule px-3 py-2 text-sm" aria-describedby={mandarTrecho ? idDoCusto : undefined}>
          <legend className="px-1 font-bold">{sm.denunciar.cifrado.titulo}</legend>
          <p role="note" className="text-ink-soft">{sm.denunciar.cifrado.grupoPequeno}</p>
          {aberto === undefined ? (
            <p role="status" className="text-ink-soft">{sm.denunciar.cifrado.abrindo}</p>
          ) : aberto === null ? (
            <p role="note">{sm.denunciar.cifrado.naoAbre}</p>
          ) : (
            <>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
                <input type="checkbox" checked={mandarTrecho} onChange={(e) => setMandarTrecho(e.target.checked)} />
                {sm.denunciar.cifrado.mandar}
              </label>
              {mandarTrecho ? (
                <>
                  <p id={idDoCusto} role="note" className="rounded-md border-[1.5px] border-oxblood px-3 py-2 font-semibold">{sm.denunciar.cifrado.custo}</p>
                  {prova && <p role="note" className="text-ink-soft">{sm.denunciar.prova.postCifrado}</p>}
                  <label className="block">
                    {sm.denunciar.cifrado.rotulo}
                    <textarea
                      value={trecho}
                      onChange={(e) => setTrecho(e.target.value)}
                      maxLength={LIMITE_DO_TRECHO}
                      rows={4}
                      aria-invalid={!trechoOk}
                      className={`${estilo.campo} mt-1`}
                    />
                  </label>
                  {!trechoOk && <p role="alert" className="text-oxblood">{sm.denunciar.cifrado.foraDoPost}</p>}
                </>
              ) : (
                <p className="text-ink-soft">{sm.denunciar.cifrado.semTrecho}</p>
              )}
            </>
          )}
        </fieldset>
      )}
      <label className="block text-sm">
        {sm.denunciar.texto}
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} rows={3} className={`${estilo.campo} mt-1`} />
      </label>
      <p className="text-xs text-ink-soft">{sm.denunciar.sigilo}</p>
      {erro && <p role="alert" className="text-sm text-oxblood">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={!categoria || ocupado || !trechoOk} className={estilo.botaoForte}>{ocupado ? sm.denunciar.enviando : sm.denunciar.enviar}</button>
        <button type="button" className={estilo.botao} onClick={aoFechar}>{sm.cancelar}</button>
      </div>
    </form>
  );
}
