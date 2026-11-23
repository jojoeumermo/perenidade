// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { PREVIA_DO_CHAT } from "@/lib/rede/cliente-chat";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDoChat } from "@/lib/rede/textos-chat";
import { botaoForte, botaoLeve, botaoPerigo, erroDoChat } from "./comum";
import { LeitorDeQr, QrDoCodigo, temCamera } from "./Qr";

const navegador = () => import("@/lib/rede/chat/r2/navegador");

/**
 * Vários aparelhos e cópia de segurança do chat (onda R2, item 1.5). Dois jeitos de usar:
 *   - `modo = "ligado"` (nos Ajustes, com o chat ativo aqui): ligar OUTRO aparelho lendo o QR dele, e criar a cópia de segurança;
 *   - `modo = "novo"` (o chat está ativo em outro aparelho e não aqui): mostrar o QR para o aparelho velho ler, ou restaurar a cópia.
 * Os riscos vão ditos antes de cada ação. Nada daqui manda ao servidor algo que ele leia: o QR nunca sai dos aparelhos, o canal é uma
 * caixa anônima, e a cópia é cifrada aqui.
 */
export function Aparelhos({ t, s, conta, codinome, modo, aoLigar }: { t: TextosDoChat; s: Pick<TextosDaRede, "erros">; conta: string; codinome: string | null; modo: "ligado" | "novo"; aoLigar?: () => void }) {
  const a = t.aparelhos;
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [colado, setColado] = useState("");
  const [entendiLigar, setEntendiLigar] = useState(false);
  const [modoDaCopia, setModoDaCopia] = useState<"palavras" | "frase">("palavras");
  const [frase, setFrase] = useState("");
  const [palavras, setPalavras] = useState<string[] | null>(null);
  const [entendiCopia, setEntendiCopia] = useState(false);
  const [segredo, setSegredo] = useState("");
  const [guardada, setGuardada] = useState<"palavras" | "frase" | null | "?">("?");
  const parar = useRef(false);

  useEffect(() => {
    let vivo = true;
    if (PREVIA_DO_CHAT) return;
    void navegador()
      .then((n) => n.copiaGuardada())
      .then((g) => vivo && setGuardada(g), () => vivo && setGuardada(null));
    return () => {
      vivo = false;
      parar.current = true;
    };
  }, []);

  async function agir(fazer: () => Promise<void>) {
    if (ocupado) return;
    setOcupado(true);
    setAviso("");
    try {
      await fazer();
    } catch (e) {
      setAviso(erroDoChat(t, s, e));
    } finally {
      setOcupado(false);
    }
  }

  // Aparelho novo: mostra o QR e espera.
  const mostrarQr = () =>
    agir(async () => {
      if (!codinome) throw Object.assign(new Error("sem_codinome"), { code: "sem_codinome" });
      parar.current = false;
      const n = await navegador();
      const r = await n.esperarLigacao(conta, codinome);
      setQr(r.qr);
      setAviso(a.esperando);
      void r.esperar(() => parar.current).then((fim) => {
        setQr(null);
        setAviso(fim === "ligado" ? a.ligado : fim === "expirou" ? a.expirou : "");
        if (fim === "ligado") aoLigar?.();
      });
    });

  // Aparelho velho: lê o QR do novo e manda as chaves da conta.
  const enviar = (texto: string) =>
    agir(async () => {
      const r = await (await navegador()).ligarPeloQr(conta, texto);
      setAviso(r === "enviado" ? a.enviado : r === "outra_conta" ? a.outraConta : a.invalido);
      setColado("");
      setLendo(false);
    });

  const criarCopia = () =>
    agir(async () => {
      if (modoDaCopia === "frase" && [...frase.trim()].length < 12) throw Object.assign(new Error("frase_curta"), { code: "frase_curta" });
      const r = await (await navegador()).criarCopia(conta, modoDaCopia, modoDaCopia === "frase" ? frase : undefined);
      setFrase("");
      setPalavras(r.palavras ?? null);
      setGuardada(modoDaCopia);
      setAviso(a.copiaCriada);
    });

  const restaurar = () =>
    agir(async () => {
      if (!codinome) throw Object.assign(new Error("sem_codinome"), { code: "sem_codinome" });
      const r = await (await navegador()).restaurarCopia(conta, codinome, segredo);
      setSegredo("");
      setAviso(r === "restaurada" ? a.restaurada : r === "sem_copia" ? a.semCopia : a.errada);
      if (r === "restaurada") aoLigar?.();
    });

  return (
    <div className="space-y-5 text-sm">
      <div>
        <p className="font-semibold">{a.titulo}</p>
        <p className="mt-1 text-ink-soft">{a.explica}</p>
      </div>

      {modo === "novo" ? (
        <section className="space-y-3 rounded-md border border-rule p-3" aria-labelledby="ligar-este">
          <p id="ligar-este" className="font-semibold">{a.ligarEsteTitulo}</p>
          <p className="text-ink-soft">{a.ligarEsteExplica}</p>
          {qr ? (
            <div className="space-y-2">
              <QrDoCodigo codigo={qr} rotulo={a.qrRotulo} />
              <details>
                <summary className="cursor-pointer">{a.semCamera}</summary>
                <p className="mt-1 break-all font-mono text-xs">{qr}</p>
              </details>
              <button type="button" className={botaoLeve} onClick={() => (parar.current = true)}>{a.cancelar}</button>
            </div>
          ) : (
            <button type="button" disabled={ocupado || PREVIA_DO_CHAT} className={botaoForte} onClick={() => void mostrarQr()}>{a.mostrarQr}</button>
          )}
        </section>
      ) : (
        <section className="space-y-3 rounded-md border border-rule p-3" aria-labelledby="ligar-outro">
          <p id="ligar-outro" className="font-semibold">{a.ligarOutroTitulo}</p>
          <p className="text-ink-soft">{a.ligarOutroExplica}</p>
          <p className="rounded-md bg-parchment-deep p-2">{a.ligarRisco}</p>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={entendiLigar} onChange={(e) => setEntendiLigar(e.target.checked)} />
            {a.ligarEntendi}
          </label>
          {lendo ? (
            <LeitorDeQr t={t} aoLer={(texto) => void enviar(texto)} fechar={() => setLendo(false)} />
          ) : (
            <div className="flex flex-wrap gap-2">
              {temCamera() && <button type="button" disabled={!entendiLigar || ocupado || PREVIA_DO_CHAT} className={botaoForte} onClick={() => setLendo(true)}>{a.lerQr}</button>}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); void enviar(colado); }} className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span>{a.colar}</span>
              <input value={colado} onChange={(e) => setColado(e.target.value)} autoComplete="off" className="min-h-11 w-full rounded-md border border-rule bg-parchment px-2 font-mono text-xs" />
            </label>
            <button type="submit" disabled={!entendiLigar || !colado.trim() || ocupado || PREVIA_DO_CHAT} className={botaoLeve}>{a.enviar}</button>
          </form>
        </section>
      )}

      {modo === "ligado" ? (
        <section className="space-y-3 rounded-md border border-rule p-3" aria-labelledby="copia">
          <p id="copia" className="font-semibold">{a.copiaTitulo}</p>
          <p className="text-ink-soft">{a.copiaExplica}</p>
          <p className="rounded-md bg-parchment-deep p-2">{a.copiaRiscos}</p>
          {guardada !== "?" && <p>{guardada ? preencher(a.copiaExiste, { modo: guardada === "palavras" ? a.palavras : a.frase }) : a.copiaNaoExiste}</p>}
          <fieldset className="space-y-1">
            <legend className="font-semibold">{a.copiaComo}</legend>
            <label className="flex min-h-11 items-center gap-2">
              <input type="radio" name="copia-modo" checked={modoDaCopia === "palavras"} onChange={() => setModoDaCopia("palavras")} />
              {a.palavrasExplica}
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input type="radio" name="copia-modo" checked={modoDaCopia === "frase"} onChange={() => setModoDaCopia("frase")} />
              {a.fraseExplica}
            </label>
          </fieldset>
          {modoDaCopia === "frase" && (
            <label className="flex flex-col gap-1">
              <span>{a.frase}</span>
              <input type="password" autoComplete="new-password" value={frase} onChange={(e) => setFrase(e.target.value)} className="min-h-11 rounded-md border border-rule bg-parchment px-2" />
            </label>
          )}
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={entendiCopia} onChange={(e) => setEntendiCopia(e.target.checked)} />
            {a.copiaEntendi}
          </label>
          <button type="button" disabled={!entendiCopia || ocupado || PREVIA_DO_CHAT} className={botaoForte} onClick={() => void criarCopia()}>{guardada && guardada !== "?" ? a.trocarCopia : a.criarCopia}</button>
          {palavras && (
            <div className="space-y-2 rounded-md border-[1.5px] border-oxblood p-3">
              <p className="font-semibold">{a.anote}</p>
              <ol className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono sm:grid-cols-3">
                {palavras.map((p, i) => (
                  <li key={i}>{i + 1}. {p}</li>
                ))}
              </ol>
              <button type="button" className={botaoPerigo} onClick={() => setPalavras(null)}>{a.anotei}</button>
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-3 rounded-md border border-rule p-3" aria-labelledby="restaurar">
          <p id="restaurar" className="font-semibold">{a.restaurarTitulo}</p>
          <p className="text-ink-soft">{a.restaurarExplica}</p>
          {guardada === null && <p>{a.copiaNaoExiste}</p>}
          <form onSubmit={(e) => { e.preventDefault(); void restaurar(); }} className="space-y-2">
            <label className="flex flex-col gap-1">
              <span>{guardada === "frase" ? a.frase : a.palavrasRotulo}</span>
              <textarea value={segredo} onChange={(e) => setSegredo(e.target.value)} rows={3} autoComplete="off" spellCheck={false} className="rounded-md border border-rule bg-parchment p-2 font-mono" />
            </label>
            <button type="submit" disabled={!segredo.trim() || ocupado || !guardada || guardada === "?" || PREVIA_DO_CHAT} className={botaoForte}>{a.restaurar}</button>
          </form>
        </section>
      )}
      {aviso && <p role="status" className="rounded-md bg-parchment-deep p-2">{aviso}</p>}
    </div>
  );
}
