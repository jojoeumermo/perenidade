// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { BackendError, hasBackend, rpc } from "@/lib/backend";
import { CODIGO_DE_FICHA, montarCorrecao, QUALIDADES_DE_QUEM_PEDE, TEMPO_MINIMO_DA_TELA_MS, tipoDeErro, type QualidadeDeQuemPede } from "@/lib/vale-o-escrito/formularios";
import { validarCorrecao } from "@/lib/vale-o-escrito/regras";
import { TIPOS_DE_CORRECAO, type TipoDeCorrecao } from "@/lib/vale-o-escrito/tipos";
import type { TextosDoObservatorio } from "@/lib/vale-o-escrito/textos";

type Textos = { correcao: TextosDoObservatorio["correcao"]; erros: TextosDoObservatorio["erros"] };

/**
 * Correção, direito de resposta ou remoção de um dado de uma ficha. Sem conta. No direito de resposta pede nome, qualidade
 * e contato (Lei 13.188/2015, art. 3º, caput e §2º: o pedido é do ofendido ou de quem a lei autoriza). Mesma proteção do envio
 * de fonte: campo-isca, tempo mínimo e limite por origem no banco, sem verificação de terceiros e sem guardar o endereço de rede.
 */
export function FormularioCorrecao({ s, fichaInicial = "", tipoInicial }: { s: Textos; fichaInicial?: string; tipoInicial?: TipoDeCorrecao }) {
  const c = s.correcao;
  const [ficha, setFicha] = useState(fichaInicial);
  const [tipo, setTipo] = useState<TipoDeCorrecao>(tipoInicial ?? "correcao");
  const [texto, setTexto] = useState("");
  const [comprovante, setComprovante] = useState("");
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [qualidade, setQualidade] = useState<QualidadeDeQuemPede>("ofendido");
  const [isca, setIsca] = useState("");
  const [estado, setEstado] = useState<"" | "ocupado" | "pronto" | "erro" | "muitos" | "invalido" | "ficha">("");
  const [liberado, setLiberado] = useState(false);
  const abertoEm = useRef(0);
  useEffect(() => {
    abertoEm.current = Date.now();
    const t = setTimeout(() => setLiberado(true), TEMPO_MINIMO_DA_TELA_MS);
    return () => clearTimeout(t);
  }, []);
  const resposta = tipo === "direito_de_resposta";
  const campo = "mt-1 block w-full border-2 border-ink bg-parchment-deep px-3 py-2";

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!liberado) return;
    if (!CODIGO_DE_FICHA.test(ficha.trim().toLowerCase())) {
      setEstado("ficha");
      return;
    }
    const pedido = montarCorrecao({ entradaId: ficha, tipo, texto, comprovanteUrl: comprovante, nome, contato, qualidade, isca }, Date.now() - abertoEm.current);
    if (!validarCorrecao(pedido).ok) {
      setEstado("invalido");
      return;
    }
    setEstado("ocupado");
    try {
      await rpc("vale_corrigir", { p: pedido });
      setEstado("pronto");
      setTexto("");
      setComprovante("");
    } catch (falha) {
      setEstado(tipoDeErro(falha instanceof BackendError ? falha.code : undefined));
    }
  }

  if (!hasBackend) return <p className="mt-8 font-sans">{c.semServico}</p>;
  if (estado === "pronto")
    return (
      <p role="status" className="mt-8 max-w-2xl border-2 border-ok bg-parchment-deep p-6 font-sans text-lg">
        {c.enviado}
      </p>
    );
  return (
    <form onSubmit={(ev) => void enviar(ev)} className="mt-8 max-w-2xl space-y-4 font-sans">
      <label className="block">
        <span className="font-semibold">{c.ficha}</span> <span className="text-ink-soft">{c.fichaAjuda}</span>
        <input required maxLength={80} value={ficha} onChange={(x) => setFicha(x.target.value)} className={`${campo} font-mono`} autoComplete="off" autoCapitalize="none" spellCheck={false} />
      </label>
      <fieldset>
        <legend className="font-semibold">{c.tipo}</legend>
        <div className="mt-1 flex flex-wrap gap-x-6 gap-y-2">
          {TIPOS_DE_CORRECAO.map((t) => (
            <label key={t} className="flex items-center gap-2">
              <input type="radio" name="tipo-de-pedido" value={t} checked={tipo === t} onChange={() => setTipo(t)} />
              {c.tipos[t]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="font-semibold">{c.texto}</span>
        <textarea required minLength={20} maxLength={3800} rows={7} value={texto} onChange={(x) => setTexto(x.target.value)} className={campo} />
      </label>
      <label className="block">
        <span className="font-semibold">{c.comprovante}</span>
        <input type="url" inputMode="url" maxLength={2000} value={comprovante} onChange={(x) => setComprovante(x.target.value)} className={campo} autoComplete="off" />
      </label>
      {resposta && (
        <fieldset className="space-y-2 border-l-4 border-ink pl-4">
          <legend className="font-semibold">{c.qualidade}</legend>
          {QUALIDADES_DE_QUEM_PEDE.map((q) => (
            <label key={q} className="flex items-start gap-2">
              <input type="radio" name="qualidade-de-quem-pede" value={q} checked={qualidade === q} onChange={() => setQualidade(q)} className="mt-1" />
              <span>{c.qualidades[q]}</span>
            </label>
          ))}
          <p className="text-sm text-ink-soft">{c.identificacao}</p>
        </fieldset>
      )}
      <label className="block">
        <span className="font-semibold">{c.nome}</span>
        <input required={resposta} minLength={resposta ? 3 : undefined} maxLength={160} value={nome} onChange={(x) => setNome(x.target.value)} className={campo} autoComplete="name" />
      </label>
      <label className="block">
        <span className="font-semibold">{c.contato}</span>
        <input required={resposta} maxLength={200} value={contato} onChange={(x) => setContato(x.target.value)} className={campo} autoComplete="off" />
      </label>
      {/* Campo-isca: invisível para gente, robô preenche. Sem "name" e fora da ordem de tabulação. */}
      <label className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
        Site
        <input tabIndex={-1} autoComplete="off" value={isca} onChange={(x) => setIsca(x.target.value)} />
      </label>
      <button type="submit" disabled={!liberado || estado === "ocupado"} className="cursor-pointer bg-ink px-5 py-2.5 font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-60">
        {c.enviar}
      </button>
      {!liberado && <p className="text-sm text-ink-soft">{c.aguarde}</p>}
      <p role="alert" className="text-oxblood">
        {estado === "erro" ? c.erro : estado === "muitos" ? s.erros.muitos : estado === "invalido" ? s.erros.invalido : estado === "ficha" ? c.fichaInvalida : ""}
      </p>
      <p className="text-sm">{c.prazo}</p>
      <p className="text-xs text-ink-soft">{c.protecao}</p>
      <p className="text-xs text-ink-soft">{c.privacidade}</p>
    </form>
  );
}
