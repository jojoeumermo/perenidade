// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { BackendError, hasBackend, rpc } from "@/lib/backend";
import { montarEnvio, TEMPO_MINIMO_DA_TELA_MS, tipoDeErro } from "@/lib/vale-o-escrito/formularios";
import { validarEnvio } from "@/lib/vale-o-escrito/regras";
import type { TextosDoObservatorio } from "@/lib/vale-o-escrito/textos";

type Textos = { enviar: TextosDoObservatorio["enviar"]; erros: TextosDoObservatorio["erros"]; avisos: TextosDoObservatorio["avisos"] };

/**
 * "Enviar uma fonte": link, o que a fonte mostra e, se a pessoa quiser, trecho, dossiê e contato. Sem conta e sem verificação
 * de terceiros: campo-isca, tempo mínimo (o botão só libera depois de alguns segundos) e limite por origem no banco, que
 * guarda só um código embaralhado com sal do dia. Nada é publicado antes da curadoria (lib/vale-o-escrito/formularios.ts).
 */
export function FormularioEnviar({ s, dossies }: { s: Textos; dossies: { slug: string; titulo: string }[] }) {
  const e = s.enviar;
  const [url, setUrl] = useState("");
  const [descricao, setDescricao] = useState("");
  const [trecho, setTrecho] = useState("");
  const [dossie, setDossie] = useState("");
  const [contato, setContato] = useState("");
  const [leu, setLeu] = useState(false);
  const [isca, setIsca] = useState("");
  const [estado, setEstado] = useState<"" | "ocupado" | "pronto" | "erro" | "muitos" | "invalido">("");
  const [liberado, setLiberado] = useState(false);
  const abertoEm = useRef(0);
  useEffect(() => {
    abertoEm.current = Date.now();
    const t = setTimeout(() => setLiberado(true), TEMPO_MINIMO_DA_TELA_MS);
    return () => clearTimeout(t);
  }, []);
  const campo = "mt-1 block w-full border-2 border-ink bg-parchment-deep px-3 py-2";

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!liberado) return;
    const pedido = montarEnvio({ url, descricao, trecho, dossie, contato, leuOAviso: leu, isca }, Date.now() - abertoEm.current);
    if (!validarEnvio(pedido).ok) {
      setEstado("invalido");
      return;
    }
    setEstado("ocupado");
    try {
      await rpc("vale_enviar", { p: pedido });
      setEstado("pronto");
      setUrl("");
      setDescricao("");
      setTrecho("");
      setContato("");
      setLeu(false);
    } catch (falha) {
      setEstado(tipoDeErro(falha instanceof BackendError ? falha.code : undefined));
    }
  }

  if (!hasBackend) return <p className="mt-8 font-sans">{e.semServico}</p>;
  if (estado === "pronto")
    return (
      <p role="status" className="mt-8 max-w-2xl border-2 border-ok bg-parchment-deep p-6 font-sans text-lg">
        {e.enviado}
      </p>
    );
  return (
    <form onSubmit={(ev) => void enviar(ev)} className="mt-8 max-w-2xl space-y-4 font-sans">
      <ul className="space-y-1 border-l-4 border-ink pl-4 text-sm">
        <li>{s.avisos.semVitimas}</li>
        <li>{s.avisos.segundoFonte}</li>
      </ul>
      <label className="block">
        <span className="font-semibold">{e.url}</span>
        <input required type="url" inputMode="url" maxLength={2000} value={url} onChange={(x) => setUrl(x.target.value)} className={campo} autoComplete="off" />
      </label>
      <label className="block">
        <span className="font-semibold">{e.descricao}</span>
        <textarea required minLength={10} maxLength={2000} rows={5} value={descricao} onChange={(x) => setDescricao(x.target.value)} className={campo} />
      </label>
      <label className="block">
        <span className="font-semibold">{e.trecho}</span>
        <textarea maxLength={400} rows={3} value={trecho} onChange={(x) => setTrecho(x.target.value)} className={campo} />
      </label>
      <label className="block">
        <span className="font-semibold">{e.dossie}</span>
        <select value={dossie} onChange={(x) => setDossie(x.target.value)} className={campo}>
          <option value="" />
          {dossies.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.titulo}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="font-semibold">{e.contato}</span>
        <input maxLength={200} value={contato} onChange={(x) => setContato(x.target.value)} className={campo} autoComplete="off" />
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" required checked={leu} onChange={(x) => setLeu(x.target.checked)} className="mt-1" />
        <span>{e.aviso}</span>
      </label>
      {/* Campo-isca: invisível para gente, robô preenche. Sem "name" e fora da ordem de tabulação. */}
      <label className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
        Site
        <input tabIndex={-1} autoComplete="off" value={isca} onChange={(x) => setIsca(x.target.value)} />
      </label>
      <button type="submit" disabled={!liberado || estado === "ocupado"} className="cursor-pointer bg-ink px-5 py-2.5 font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-60">
        {e.enviar}
      </button>
      {!liberado && <p className="text-sm text-ink-soft">{e.aguarde}</p>}
      <p role="alert" className="text-oxblood">
        {estado === "erro" ? e.erro : estado === "muitos" ? s.erros.muitos : estado === "invalido" ? s.erros.invalido : ""}
      </p>
      <p className="text-xs text-ink-soft">{e.protecao}</p>
      <p className="text-xs text-ink-soft">{e.privacidade}</p>
    </form>
  );
}
