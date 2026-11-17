// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useState } from "react";
import Link from "@/components/Link";
import { aoVivo } from "@/lib/rede/mapa/cliente";
import { DURACOES, LIMITES_DO_AO_VIVO as L, type SessoesDaCaixa as Sessoes } from "@/lib/rede/mapa/tipos";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import { fraseDoErro } from "../mapa/comum";
import { CabecaDaSessao } from "./SessaoAoVivo";
import { useTextosDoAoVivo } from "./usar";
import "./aovivo.css";

/** A data e hora local de agora + 1 dia, no formato do campo datetime-local ("2026-11-20T19:00"). */
function amanhaAsSete(): string {
  const d = new Date(Date.now() + 86400e3);
  d.setHours(19, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * O "ao vivo" de uma caixa de perguntas (frente 13B, L1-17), dentro da caixa (components/rede/b1/CaixaDePerguntas.tsx): as sessões
 * marcadas dela e, para quem cuida, o formulário de marcar. Na caixa de uma comunidade, a moderação convida quem responde (pelo @);
 * a sessão só aparece depois do aceite.
 */
export function SessoesDaCaixa({ alvo, lang }: { alvo: { handle?: string; slug?: string }; lang: string }) {
  const t = useTextosDoAoVivo(lang);
  const [dados, setDados] = useState<{ chave: string; s: Sessoes | null } | null>(null);
  const [vez, setVez] = useState(0);
  const [aviso, setAviso] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [form, setForm] = useState({ titulo: "", inicio: "", minutos: 60, convidada: "" });
  const id = useId();
  const chave = `${alvo.handle ?? ""}:${alvo.slug ?? ""}:${vez}`;

  useEffect(() => {
    let vivo = true;
    aoVivo.daCaixa(alvo).then(
      (s) => vivo && setDados({ chave, s }),
      () => vivo && setDados({ chave, s: null }),
    );
    return () => {
      vivo = false;
    };
    // alvo vem novo a cada desenho: a chave já diz quando mudou.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  if (!t || !dados?.s) return null;
  const { cuida, sessoes } = dados.s;
  if (!cuida && sessoes.length === 0) return null;
  const porVir = sessoes.filter((s) => s.momento !== "encerrada" && (s.situacao === "marcada" || s.situacao === "convite")).length;

  async function marcar() {
    if (!t) return;
    setOcupado(true);
    try {
      const inicio = new Date(form.inicio || amanhaAsSete()).toISOString();
      const r = await aoVivo.marcar({ slug: alvo.slug ?? null }, { titulo: form.titulo, inicio, minutos: form.minutos, convidada: alvo.slug ? form.convidada : undefined });
      setAviso({ texto: r.situacao === "convite" ? t.caixa.convidada : t.caixa.marcada });
      setForm({ titulo: "", inicio: "", minutos: 60, convidada: "" });
      setVez((v) => v + 1);
    } catch (e) {
      setAviso({ texto: fraseDoErro(t.erros, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="av-caixa" aria-labelledby={`${id}-titulo`}>
      <h3 id={`${id}-titulo`} className="av-subtitulo al-cond">{t.caixa.titulo}</h3>
      <p className="av-aviso" role="status" aria-live="polite" data-erro={aviso?.erro ? "" : undefined}>{aviso?.texto ?? ""}</p>
      {sessoes.length === 0 ? (
        <p className="av-miudo">{t.caixa.nenhuma}</p>
      ) : (
        <ul className="av-lista">
          {sessoes.map((s) => (
            <li key={s.id} className="av-cartao" data-momento={s.momento}>
              <CabecaDaSessao t={t} lang={lang} s={s} nivel={3} />
              <Link href={`/${lang}/alumia/mapa/ao-vivo?s=${encodeURIComponent(s.id)}`} className="av-link">{t.agenda.abrir}</Link>
            </li>
          ))}
        </ul>
      )}
      {cuida && (
        <details className="av-marcar-sessao">
          <summary className="av-link">{t.caixa.marcar}</summary>
          {porVir >= L.porCaixa ? (
            <p className="av-miudo">{preencher(t.caixa.limite, { n: L.porCaixa })}</p>
          ) : (
            <form
              className="av-form"
              onSubmit={(e) => {
                e.preventDefault();
                void marcar();
              }}
            >
              <label className="av-campo">
                <span>{t.caixa.tituloRotulo}</span>
                <input required minLength={L.tituloMin} maxLength={L.titulo} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              </label>
              <div className="av-campos">
                <label className="av-campo">
                  <span>{t.caixa.inicioRotulo}</span>
                  <input type="datetime-local" required value={form.inicio || amanhaAsSete()} onChange={(e) => setForm({ ...form, inicio: e.target.value })} />
                </label>
                <label className="av-campo">
                  <span>{t.caixa.duracaoRotulo}</span>
                  <select value={form.minutos} onChange={(e) => setForm({ ...form, minutos: Number(e.target.value) })}>
                    {DURACOES.map((m) => (
                      <option key={m} value={m}>{preencher(t.caixa.minutos, { n: m })}</option>
                    ))}
                  </select>
                </label>
              </div>
              {alvo.slug && (
                <label className="av-campo">
                  <span>{t.caixa.convidadaRotulo}</span>
                  <input required maxLength={21} value={form.convidada} onChange={(e) => setForm({ ...form, convidada: e.target.value })} />
                  <span className="av-miudo">{t.caixa.convidadaAjuda}</span>
                </label>
              )}
              <p className="av-miudo">{preencher(t.caixa.limite, { n: L.porCaixa })}</p>
              <div className="av-acoes">
                <Botao type="submit" disabled={ocupado || form.titulo.trim().length < L.tituloMin}>{t.caixa.salvar}</Botao>
              </div>
            </form>
          )}
        </details>
      )}
    </section>
  );
}
