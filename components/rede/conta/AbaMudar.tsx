// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 74. Mudar de servidor no Fediverso: a pessoa aponta a conta nova (que já declara esta em alsoKnownAs) e o servidor do site confere e
// manda o Move às instâncias das seguidoras (app/api/rede/fediverso/mudar). A cópia completa dos dados (LGPD) já existia em O que
// guardamos (/alumia/meus-dados).
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { getClient } from "@/lib/backend";
import { conta, PREVIA_DA_CONTA, type Mudanca } from "@/lib/rede/conta/cliente";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import { fraseDoErro, useCarga, type TextosDaConta } from "./textos";

/** Pede ao servidor do site para conferir a conta nova e mandar o Move (na prévia, nada sai: responde que falta o apelido). */
async function conferirNoServidor(): Promise<{ ok: boolean; motivo?: string }> {
  if (PREVIA_DA_CONTA) return { ok: false, motivo: "sem_apelido" };
  const s = await getClient();
  const { data } = await s.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, motivo: "entre_primeiro" };
  const r = await fetch("/api/rede/fediverso/mudar", { method: "POST", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  return ((await r.json().catch(() => null)) as { ok: boolean; motivo?: string } | null) ?? { ok: false };
}

export function AbaMudar({ t, lang }: { t: TextosDaConta; lang: string }) {
  const id = useId();
  const { dado, erro, trocar, recarregar } = useCarga<Mudanca>("mudanca", () => conta.mudanca());
  const [alvo, setAlvo] = useState("");
  const [msg, setMsg] = useState<{ texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  async function mudar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    try {
      trocar(await conta.pedirMudanca(alvo));
      const r = await conferirNoServidor();
      if (r.ok) recarregar();
      else setMsg({ texto: r.motivo === "sem_apelido" ? t.mudar.erroAlias : fraseDoErro(t, new Error(r.motivo ?? "outro")), erro: true });
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
    } finally {
      setOcupado(false);
    }
  }
  async function desistir() {
    try {
      trocar(await conta.pedirMudanca(""));
      setMsg(null);
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
    }
  }
  return (
    <section className="ct-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="ct-subtitulo al-cond">{t.mudar.titulo}</h2>
      <p className="ct-miudo">{t.mudar.sobre}</p>
      {erro ? <p className="ct-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {dado && !dado.federada && <p className="ct-miudo">{t.mudar.semFederacao}</p>}
      {dado?.federada && (
        <>
          <p className="ct-ok">{preencher(t.mudar.atual, { handle: dado.handle ?? "" })}</p>
          <p className="ct-miudo">{preencher(t.mudar.seguidoras, { n: dado.seguidoras ?? t.mudar.poucas })}</p>
          {dado.situacao === "enviada" ? (
            <p className="ct-ok" role="status">{preencher(t.mudar.enviada, { alvo: dado.alvo ?? "" })}</p>
          ) : (
            <form className="ct-form" onSubmit={(e) => void mudar(e)}>
              {dado.situacao === "conferir" && <p className="ct-miudo" role="status">{preencher(t.mudar.conferir, { alvo: dado.alvo ?? "" })}</p>}
              <label htmlFor={`${id}-a`}>{t.mudar.alvo}<input id={`${id}-a`} type="url" inputMode="url" maxLength={500} placeholder="https://" value={alvo} onChange={(e) => setAlvo(e.target.value)} /></label>
              <div className="ct-acoes">
                <Botao type="submit" disabled={ocupado || !/^https:\/\//.test(alvo)}>{t.mudar.apontar}</Botao>
                {dado.situacao === "conferir" && <Botao variante="contorno" onClick={() => void desistir()}>{t.mudar.desistir}</Botao>}
              </div>
            </form>
          )}
        </>
      )}
      {msg && <p className={msg.erro ? "ct-erro" : "ct-ok"} role={msg.erro ? "alert" : "status"}>{msg.texto}</p>}
      <p className="ct-miudo">{t.mudar.copia} <Link className="ct-link" href={`/${lang}/alumia/meus-dados`}>{t.mudar.copiaLink}</Link></p>
    </section>
  );
}
