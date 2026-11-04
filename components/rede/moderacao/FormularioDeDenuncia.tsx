// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { useState } from "react";
import { redeMod } from "@/lib/rede/cliente-moderacao";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaModeracao } from "@/lib/rede/textos-moderacao";
import { CATEGORIAS_DE_DENUNCIA, enderecosModeracao, prioridadeDaCategoria, type AlvoDeDenuncia, type CategoriaDeDenuncia, type ResultadoDeDenuncia } from "@/lib/rede/tipos-moderacao";
import { estilo, mensagemDeErro } from "./base";

/**
 * O formulário de denúncia, para post, perfil ou comunidade: categoria (as de prioridade 1 vêm na frente), texto opcional e o protocolo
 * na volta. Diz, antes de enviar, que quem denuncia nunca é revelado. Confirmação dentro da página, nunca alert do navegador.
 */
export function FormularioDeDenuncia({
  lang, s, sm, alvoTipo, alvo, aoFechar,
}: {
  lang: string;
  s: TextosDaRede;
  sm: TextosDaModeracao;
  alvoTipo: AlvoDeDenuncia;
  alvo: string;
  aoFechar: () => void;
}) {
  const [categoria, setCategoria] = useState<CategoriaDeDenuncia | "">("");
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<ResultadoDeDenuncia | null>(null);
  const titulo = alvoTipo === "perfil" ? sm.denunciar.tituloPerfil : alvoTipo === "comunidade" ? sm.denunciar.tituloComunidade : sm.denunciar.titulo;
  const categorias = sm.categorias as Record<string, { rotulo: string; ajuda: string }>;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!categoria || ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      setResultado(await redeMod.denunciar(alvoTipo, alvo, categoria, texto.trim()));
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
      <label className="block text-sm">
        {sm.denunciar.texto}
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} rows={3} className={`${estilo.campo} mt-1`} />
      </label>
      <p className="text-xs text-ink-soft">{sm.denunciar.sigilo}</p>
      {erro && <p role="alert" className="text-sm text-oxblood">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={!categoria || ocupado} className={estilo.botaoForte}>{ocupado ? sm.denunciar.enviando : sm.denunciar.enviar}</button>
        <button type="button" className={estilo.botao} onClick={aoFechar}>{sm.cancelar}</button>
      </div>
    </form>
  );
}
