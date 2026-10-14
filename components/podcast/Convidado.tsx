// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dict } from "@/i18n/types";
import { BackendError, hasBackend, rpc } from "@/lib/backend";
import { termo, TERMO_TITULO } from "@/lib/podcast-termo";
import { useHydrated } from "@/lib/storage";
import { TesteDeMicrofone } from "./Microfone";

interface Ficha {
  nome: string;
  aceito: boolean;
  aceite_em: string | null;
  autoriza_voz: boolean;
  autoriza_imagem: boolean;
  episodios: string[];
}

/**
 * A página do convidado, aberta pelo link que a produção manda: o termo de cessão para ler e aceitar (sem conta),
 * o teste de microfone e como gravar a própria faixa, se a gravação for a distância.
 */
export function PaginaDoConvidado({ s }: { s: Dict["podcast"] }) {
  const hydrated = useHydrated();
  // A chave vem no endereço (?t=…). Lida uma vez, depois de a página abrir no navegador.
  const token = useMemo(() => (hydrated ? (new URLSearchParams(window.location.search).get("t") ?? "") : null), [hydrated]);
  const [ficha, setFicha] = useState<Ficha | null | "erro">(null);
  const [nome, setNome] = useState("");
  const [voz, setVoz] = useState(false);
  const [imagem, setImagem] = useState(false);
  const [aviso, setAviso] = useState("");
  const [volta, setVolta] = useState(0);

  useEffect(() => {
    // O endereço com a chave não fica no histórico do navegador nem vai junto se a pessoa compartilhar a tela.
    if (token) window.history.replaceState(null, "", window.location.pathname);
  }, [token]);

  useEffect(() => {
    if (!token || !hasBackend) return;
    let cancelado = false;
    rpc<Ficha>("podcast_convidado_ver", { p_token: token })
      .then((valor) => {
        if (!cancelado) setFicha(valor);
      })
      .catch(() => {
        if (!cancelado) setFicha("erro");
      });
    return () => {
      cancelado = true;
    };
  }, [token, volta]);

  async function aceitar() {
    setAviso("");
    try {
      await rpc("podcast_convidado_aceitar", { p_token: token, p_nome: nome, p_voz: voz, p_imagem: imagem });
      setVolta((v) => v + 1);
    } catch (erro) {
      setAviso(erro instanceof BackendError && erro.code === "muitos_pedidos" ? s.tooMany : s.failed);
    }
  }

  return (
    <div className="mt-8 space-y-10">
      {token !== null && (ficha === "erro" || (!token && ficha === null)) && <p className="border-l-4 border-oxblood pl-4 text-lg">{s.guestInvalid}</p>}
      {ficha && ficha !== "erro" && (
        <section aria-labelledby="termo" className="border-4 border-ink p-5 sm:p-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">{s.guestHello} {ficha.nome}</p>
          {ficha.episodios.length > 0 && <p className="mt-1 font-sans text-sm text-ink-soft" lang="pt-BR">{ficha.episodios.join(" · ")}</p>}
          <h2 id="termo" className="mt-3 font-serif text-2xl font-semibold" lang="pt-BR">{TERMO_TITULO}</h2>
          <div className="mt-3 space-y-3 text-lg leading-relaxed" lang="pt-BR">
            {termo(ficha.aceito ? ficha.nome : nome || ficha.nome).map((paragrafo) => (
              <p key={paragrafo}>{paragrafo}</p>
            ))}
          </div>
          {ficha.aceito ? (
            <p className="mt-5 border-l-4 border-ok pl-4 font-sans">
              {s.guestAccepted} {ficha.aceite_em && new Date(ficha.aceite_em).toLocaleString()}. {ficha.autoriza_imagem ? s.guestWithImage : s.guestVoiceOnly}
            </p>
          ) : (
            <form className="mt-5 space-y-3 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); void aceitar(); }}>
              <label className="block">
                {s.guestName}
                <input value={nome} onChange={(e) => setNome(e.target.value)} required minLength={5} maxLength={120} autoComplete="name" className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2" />
              </label>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={voz} onChange={(e) => setVoz(e.target.checked)} className="mt-1 h-4 w-4" required />
                <span>{s.guestVoice}</span>
              </label>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={imagem} onChange={(e) => setImagem(e.target.checked)} className="mt-1 h-4 w-4" />
                <span>{s.guestImage}</span>
              </label>
              <button type="submit" disabled={!voz || nome.trim().length < 5} className="cursor-pointer bg-ink px-5 py-2.5 font-semibold text-parchment hover:bg-oxblood disabled:opacity-50">{s.guestAccept}</button>
              <p role="status" className="min-h-5 text-oxblood">{aviso}</p>
            </form>
          )}
        </section>
      )}
      <TesteDeMicrofone s={s} />
      <section aria-labelledby="gravar" className="font-sans">
        <h2 id="gravar" className="jornal-secao">
          <span className="jornal-editoria">{s.guestRecordTitle}</span>
        </h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-base">
          {s.guestRecordSteps.map((passo) => (
            <li key={passo}>{passo}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
