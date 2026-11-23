// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useMemo, useState } from "react";
import { deB64, LIMITE_DO_TRECHO, provaInteira, trechoNoConteudo, TRECHOS_POR_DENUNCIA, type ProvaDeFranquia } from "@/lib/rede/franquia/protocolo";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaModeracao } from "@/lib/rede/textos-moderacao";
import { CATEGORIAS_DE_DENUNCIA, prioridadeDaCategoria, type CategoriaDeDenuncia } from "@/lib/rede/tipos-moderacao";
import { estilo, mensagemDeErro } from "../moderacao/base";

/** Uma mensagem que a pessoa pode denunciar: o texto como abriu neste aparelho e a prova que chegou com ela (ou nula). */
export interface MensagemDenunciavel {
  id: string;
  texto: string;
  /** Quando chegou, já escrito para a tela ("ontem, 21:04"). */
  quando?: string;
  prova: ProvaDeFranquia | null;
}

type Resultado = { protocolo: string; ja?: boolean };

/**
 * A denúncia com prova (message franking), para a conversa a dois e os grupos: quem denuncia marca as mensagens, pode cortar cada
 * trecho (cortar pode, reescrever não), escolhe a categoria e manda. Antes de mandar, a tela diz com todas as letras que os trechos
 * marcados saem do cifrado e vão para a moderação, e que a mensagem marcada passa inteira pelo servidor do site para a conferência.
 * A tela da conversa monta esta peça (contrato da onda R2) e diz quem escreveu, pelo que o aparelho sabe; `aoDenunciar` é o envio
 * (lib/rede/franquia/cliente.ts; na prévia, um dublê). Mensagem sem prova aparece, mas não se marca.
 */
export function DenunciaComProva({
  s, sm, autor, mensagens, aoDenunciar, aoFechar,
}: {
  s: TextosDaRede;
  sm: TextosDaModeracao;
  /** Quem escreveu, pelo que este aparelho sabe: o @ e o nome que a tela mostra. */
  autor: { handle: string; nome: string };
  mensagens: MensagemDenunciavel[];
  aoDenunciar: (p: { categoria: CategoriaDeDenuncia; texto: string; trechos: { texto: string; prova: ProvaDeFranquia }[] }) => Promise<Resultado>;
  aoFechar: () => void;
}) {
  const t = sm.denunciar.prova;
  const categorias = sm.categorias as Record<string, { rotulo: string; ajuda: string }>;
  const idDoAviso = useId();
  // As que têm prova inteira (o compromisso confere com o conteúdo que chegou): só elas se marcam.
  const comProva = useMemo(() => new Set(mensagens.filter((m) => provaInteira(m.prova)).map((m) => m.id)), [mensagens]);
  const [marcadas, setMarcadas] = useState<Record<string, string>>({});
  const [categoria, setCategoria] = useState<CategoriaDeDenuncia | "">("");
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState<Resultado | null>(null);

  const ids = Object.keys(marcadas);
  const foraDaMensagem = (id: string) => {
    const m = mensagens.find((x) => x.id === id);
    const conteudo = m?.prova ? deB64(m.prova.conteudo) : null;
    return !conteudo || !trechoNoConteudo(conteudo, marcadas[id] ?? "");
  };
  const algumFora = ids.some(foraDaMensagem);

  function marcar(m: MensagemDenunciavel, sim: boolean) {
    setMarcadas((antes) => {
      const novo = { ...antes };
      if (sim && Object.keys(novo).length < TRECHOS_POR_DENUNCIA) novo[m.id] = m.texto.slice(0, LIMITE_DO_TRECHO);
      else delete novo[m.id];
      return novo;
    });
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!categoria || ocupado || ids.length === 0 || algumFora) return;
    setOcupado(true);
    setErro("");
    try {
      const trechos = mensagens
        .filter((m) => m.id in marcadas && m.prova)
        .map((m) => ({ texto: marcadas[m.id].trim(), prova: m.prova as ProvaDeFranquia }));
      setFeito(await aoDenunciar({ categoria, texto: texto.trim(), trechos }));
    } catch (x) {
      setErro(mensagemDeErro(s, sm, x));
    } finally {
      setOcupado(false);
    }
  }

  if (feito) {
    return (
      <div role="status" className={`${estilo.caixa} space-y-2`}>
        <p className="font-bold">{preencher(t.feito, { protocolo: feito.protocolo })}</p>
        <p className="text-sm">{t.limite}</p>
        <p className="text-sm text-ink-soft">{sm.denunciar.acompanhe}</p>
        <button type="button" className={estilo.botao} onClick={aoFechar}>{sm.fechar}</button>
      </div>
    );
  }

  const ordem = [...CATEGORIAS_DE_DENUNCIA].sort((a, b) => prioridadeDaCategoria(a) - prioridadeDaCategoria(b));
  return (
    <form onSubmit={(e) => void enviar(e)} className={`${estilo.caixa} space-y-3`} aria-label={t.titulo} aria-describedby={idDoAviso}>
      <h2 className="font-serif text-lg font-bold">{t.titulo}</h2>
      <p className="text-sm text-ink-soft">{t.explica}</p>
      <div id={idDoAviso} role="note" className="space-y-1 rounded-md border-[1.5px] border-oxblood px-3 py-2 text-sm">
        <p className="font-semibold">{t.saem}</p>
        <p>{t.passa}</p>
      </div>
      <p className="text-sm">{preencher(t.quem, { nome: `${autor.nome} @${autor.handle}` })}</p>
      <p className="text-xs text-ink-soft">{t.limite}</p>
      <p className="text-xs text-ink-soft">{t.deduzir}</p>

      <fieldset className="space-y-2">
        <legend className="text-sm font-bold">{preencher(t.marcadas, { n: ids.length })}</legend>
        {mensagens.map((m) => {
          const pode = comProva.has(m.id);
          const marcada = m.id in marcadas;
          const fora = marcada && foraDaMensagem(m.id);
          return (
            <div key={m.id} className="rounded-md border border-rule px-3 py-2 text-sm">
              <label className={`flex min-h-11 items-start gap-2 ${pode ? "cursor-pointer" : "opacity-70"}`}>
                <input type="checkbox" className="mt-1.5" disabled={!pode} checked={marcada} onChange={(e) => marcar(m, e.target.checked)} />
                <span className="min-w-0">
                  <span className="block whitespace-pre-line break-words">{m.texto}</span>
                  {m.quando && <span className="block text-xs text-ink-soft">{m.quando}</span>}
                  {!pode && <span className="block text-xs text-ink-soft">{t.semProva}</span>}
                </span>
              </label>
              {marcada && (
                <label className="mt-2 block">
                  {t.rotulo}
                  <textarea
                    value={marcadas[m.id]}
                    onChange={(e) => setMarcadas((antes) => ({ ...antes, [m.id]: e.target.value }))}
                    maxLength={LIMITE_DO_TRECHO}
                    rows={3}
                    aria-invalid={fora}
                    className={`${estilo.campo} mt-1`}
                  />
                  {fora && <span role="alert" className="mt-1 block text-oxblood">{t.foraDaMensagem}</span>}
                </label>
              )}
            </div>
          );
        })}
        {ids.length === 0 && <p className="text-xs text-ink-soft">{t.nenhuma}</p>}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-bold">{sm.denunciar.categoria}</legend>
        <div className="mt-2 space-y-1">
          {ordem.map((c) => (
            <label key={c} className="flex min-h-11 cursor-pointer items-start gap-2 rounded-md px-1 py-1 hover:bg-parchment-deep">
              <input type="radio" name="denuncia-com-prova-categoria" value={c} checked={categoria === c} onChange={() => setCategoria(c)} className="mt-1.5" />
              <span>
                <span className="font-semibold">{categorias[c].rotulo}</span>
                <span className="block text-xs text-ink-soft">{categorias[c].ajuda}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm">
        {sm.denunciar.texto}
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} rows={3} className={`${estilo.campo} mt-1`} />
      </label>
      <p className="text-xs text-ink-soft">{sm.denunciar.sigilo}</p>
      {erro && <p role="alert" className="text-sm text-oxblood">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={!categoria || ocupado || ids.length === 0 || algumFora} className={estilo.botaoForte}>{ocupado ? sm.denunciar.enviando : t.enviar}</button>
        <button type="button" className={estilo.botao} onClick={aoFechar}>{sm.cancelar}</button>
      </div>
    </form>
  );
}
