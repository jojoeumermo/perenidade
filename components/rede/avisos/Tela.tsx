// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "@/components/Link";
import { localePath } from "@/i18n/config";
import { avisos } from "@/lib/rede/cliente-avisos";
import { preencher } from "@/lib/rede/preencher";
import { enderecos } from "@/lib/rede/tipos";
import { carregarTextosDeAvisos, type TextosDeAvisos } from "@/lib/rede/textos-avisos";
import { fraseDoAviso, TIPOS_DE_AVISO, type FrasesDoTipo, type ItemDeAviso, type PreferenciasDeAviso, type ResumoDeAviso, type TipoDeAviso } from "@/lib/rede/tipos-avisos";
import { textoDoErro } from "../erros";
import { EsqueletoDaLinha } from "../Esqueletos";
import type { PropsDaTelaDoPacote } from "../registro";
import { tempoCurto } from "@/lib/rede/tipos-conversa";
import { FaixaDaPrevia, previa, useTextosAlumia3 } from "../conversa/base3";
import { Avatar16 } from "../ui/Avatar16";
import { useRegua } from "../conversa/movimento";
import { avisosDaPrevia } from "../descoberta/previa";
import { desligarPush, estadoDoPush, ligarPush, type EstadoDoPush } from "./push";
// O visual novo (só com "rede-v2" + "alumia-2": a folha só vale dentro de [data-al="2"]).
import "../conversa/alumia3.css";

type Aba = "avisos" | "preferencias";

/** Para onde o aviso leva: um aviso só vai à resposta; um grupo vai ao post (a conversa inteira). */
function destino(lang: string, item: ItemDeAviso): string | null {
  const id = item.total === 1 ? (item.alvo ?? item.post) : item.post;
  return id ? enderecos.post(lang, id) : null;
}

function Interruptor({ id, rotulo, ligado, desabilitado, aoMudar, nota }: { id: string; rotulo: string; ligado: boolean; desabilitado?: boolean; aoMudar: (v: boolean) => void; nota?: string }) {
  return (
    <div className="flex min-h-11 items-start gap-3 py-2">
      <input id={id} type="checkbox" checked={ligado} disabled={desabilitado} onChange={(e) => aoMudar(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[#c21f16]" aria-describedby={nota ? `${id}-nota` : undefined} />
      <label htmlFor={id} className="cursor-pointer">
        {rotulo}
        {nota && (
          <span id={`${id}-nota`} className="block text-sm text-ink-soft">
            {nota}
          </span>
        )}
      </label>
    </div>
  );
}

/** As preferências da prévia: tudo ligado no site, nada no celular nem por e-mail. */
function prefsDaPrevia(): PreferenciasDeAviso {
  const tudo = (v: boolean) => Object.fromEntries(TIPOS_DE_AVISO.map((x) => [x, v])) as Record<TipoDeAviso, boolean>;
  return { site: tudo(true), push: tudo(false), resumo: false, push_aparelhos: 0, membro: true };
}

function Preferencias({ t, lang, s, situacao }: { t: TextosDeAvisos; lang: string; s: PropsDaTelaDoPacote["s"]; situacao: PropsDaTelaDoPacote["situacao"] }) {
  const [prefs, setPrefs] = useState<PreferenciasDeAviso | null>(null);
  const [push, setPush] = useState<EstadoDoPush>("carregando");
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [resumoVisto, setResumoVisto] = useState<ResumoDeAviso | null>(null);
  const p = t.prefs;

  useEffect(() => {
    let vivo = true;
    // Na prévia não há conta: as escolhas ficam só nesta tela (nada sai do aparelho).
    (previa() ? Promise.resolve(prefsDaPrevia()) : avisos.prefs())
      .then((r) => vivo && setPrefs(r))
      .catch((e) => vivo && setErro(textoDoErro(s, e)));
    estadoDoPush()
      .then((e) => vivo && setPush(e))
      .catch(() => vivo && setPush("sem_suporte"));
    return () => {
      vivo = false;
    };
  }, [s]);

  const guardar = useCallback(
    async (tipo: TipoDeAviso | "resumo", canal: "site" | "push" | "email", ligado: boolean) => {
      setErro("");
      setAviso("");
      if (previa()) {
        setPrefs((atual) => (atual ? (tipo === "resumo" ? { ...atual, resumo: ligado } : { ...atual, [canal]: { ...atual[canal as "site" | "push"], [tipo]: ligado } }) : atual));
        setAviso(p.salvo);
        return;
      }
      try {
        setPrefs(await avisos.salvarPref(tipo, canal, ligado));
        setAviso(p.salvo);
      } catch (e) {
        setErro(textoDoErro(s, e) || p.falha);
      }
    },
    [p.falha, p.salvo, s],
  );

  async function trocarPush(ligar: boolean) {
    setErro("");
    setAviso("");
    if (previa()) return;
    setOcupado(true);
    try {
      const novo = ligar ? await ligarPush(lang) : await desligarPush();
      setPush(novo);
      setPrefs(await avisos.prefs());
      setAviso(p.salvo);
    } catch (e) {
      setErro(textoDoErro(s, e) || p.falha);
    } finally {
      setOcupado(false);
    }
  }

  async function verResumo() {
    setErro("");
    if (previa()) return setResumoVisto({ n: 0 });
    try {
      setResumoVisto(await avisos.resumoVer());
    } catch (e) {
      setErro(textoDoErro(s, e) || p.falha);
    }
  }

  if (!prefs) return erro ? <p role="alert" className="px-[18px] py-6 font-sans text-oxblood">{erro}</p> : <EsqueletoDaLinha rotulo={t.lista.carregando} quantos={2} />;
  const membro = prefs.membro && situacao.membro;
  const notaDoPush: Partial<Record<EstadoDoPush, string>> = { sem_suporte: p.push.semSuporte, bloqueado: p.push.bloqueado, ios: p.push.ios, nao_configurado: p.push.naoConfigurado };

  return (
    <div className="px-[18px] py-5 font-sans">
      <h2 className="font-serif text-2xl font-semibold">{p.titulo}</h2>
      <p role="status" aria-live="polite" className="min-h-6 text-sm text-ink-soft">
        {aviso}
      </p>
      {erro && (
        <p role="alert" className="text-oxblood">
          {erro}
        </p>
      )}

      <section aria-labelledby="av-site" className="mt-4 border-t border-rule pt-4">
        <h3 id="av-site" className="font-serif text-xl font-semibold">{p.site.titulo}</h3>
        <p className="mt-1 text-ink-soft">{p.site.descricao}</p>
        <div className="mt-2">
          {TIPOS_DE_AVISO.map((tipo) => (
            <Interruptor key={tipo} id={`av-site-${tipo}`} rotulo={p.site.tipos[tipo]} ligado={prefs.site[tipo]} desabilitado={tipo === "moderacao"} aoMudar={(v) => void guardar(tipo, "site", v)} />
          ))}
        </div>
      </section>

      <section aria-labelledby="av-resumo" className="mt-4 border-t border-rule pt-4">
        <h3 id="av-resumo" className="font-serif text-xl font-semibold">{p.resumo.titulo}</h3>
        <p className="mt-1 text-ink-soft">{p.resumo.descricao}</p>
        {!membro && <p className="mt-2 text-ink-soft">{p.resumo.precisaEntrar}</p>}
        <Interruptor id="av-resumo-liga" rotulo={p.resumo.ligar} ligado={prefs.resumo} desabilitado={!membro && !prefs.resumo} aoMudar={(v) => void guardar("resumo", "email", v)} />
        <button type="button" onClick={() => void verResumo()} className="min-h-11 cursor-pointer rounded-full border-2 border-ink px-4 font-bold hover:bg-parchment-deep">
          {p.resumo.ver}
        </button>
        {resumoVisto && (
          <div className="al3-entra mt-3 rounded border border-rule bg-parchment-deep p-3" role="region" aria-label={p.resumo.ver}>
            {resumoVisto.n === 0 ? <p>{p.resumo.nada}</p> : <pre className="whitespace-pre-wrap font-sans text-sm">{resumoVisto.texto}</pre>}
            <button type="button" onClick={() => setResumoVisto(null)} className="mt-2 min-h-11 cursor-pointer font-bold underline">
              {p.resumo.fechar}
            </button>
          </div>
        )}
      </section>

      <section aria-labelledby="av-push" className="mt-4 border-t border-rule pt-4">
        <h3 id="av-push" className="font-serif text-xl font-semibold">{p.push.titulo}</h3>
        <p className="mt-1 text-ink-soft">{p.push.descricao}</p>
        {!membro && <p className="mt-2 text-ink-soft">{p.push.precisaEntrar}</p>}
        {notaDoPush[push] && <p className="mt-2 text-ink-soft">{notaDoPush[push]}</p>}
        {membro && (push === "desligado" || push === "ligado") && (
          <div className="mt-2">
            {push === "ligado" ? (
              <>
                <p className="mb-2 font-bold">{p.push.ativo}</p>
                <button type="button" disabled={ocupado} onClick={() => void trocarPush(false)} className="min-h-11 cursor-pointer rounded-full border-2 border-ink px-4 font-bold hover:bg-parchment-deep disabled:opacity-60">
                  {p.push.desligar}
                </button>
              </>
            ) : (
              <button type="button" disabled={ocupado} onClick={() => void trocarPush(true)} className="min-h-11 cursor-pointer rounded-full bg-[#c21f16] px-5 font-bold text-white hover:bg-[#1f1a14] disabled:opacity-60">
                {p.push.ligar}
              </button>
            )}
          </div>
        )}
        {prefs.push_aparelhos > 0 && <p className="mt-2 text-sm text-ink-soft">{preencher(p.push.outros, { n: prefs.push_aparelhos })}</p>}
        {prefs.push_aparelhos > 0 && (
          <fieldset className="mt-3">
            <legend className="font-bold">{p.push.tipos}</legend>
            {TIPOS_DE_AVISO.map((tipo) => (
              <Interruptor key={tipo} id={`av-push-${tipo}`} rotulo={p.site.tipos[tipo]} ligado={prefs.push[tipo]} aoMudar={(v) => void guardar(tipo, "push", v)} />
            ))}
          </fieldset>
        )}
      </section>
    </div>
  );
}

function ListaDeAvisos({ t, lang, s }: { t: TextosDeAvisos; lang: string; s: PropsDaTelaDoPacote["s"] }) {
  const [itens, setItens] = useState<ItemDeAviso[]>([]);
  const [proximo, setProximo] = useState<string | null>(null);
  const [naoLidos, setNaoLidos] = useState(0);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">("carregando");
  const [erro, setErro] = useState("");
  const [maisCarregando, setMaisCarregando] = useState(false);
  const l = t.lista;
  const frases = t.frases as unknown as Record<string, FrasesDoTipo>;
  // A data inteira fica no title; na linha, o tempo curto do resto da Alumia ("20 min", "3 h").
  const quando = useMemo(() => new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short" }), [lang]);

  useEffect(() => {
    let vivo = true;
    (previa() ? Promise.resolve(avisosDaPrevia()) : avisos.listar())
      .then((r) => {
        if (!vivo) return;
        setItens(r.itens);
        setProximo(r.proximo);
        setNaoLidos(r.nao_lidos);
        setEstado("pronto");
      })
      .catch((e) => {
        if (!vivo) return;
        setErro(textoDoErro(s, e));
        setEstado("erro");
      });
    return () => {
      vivo = false;
    };
  }, [s]);

  async function mais() {
    if (!proximo) return;
    setMaisCarregando(true);
    try {
      const r = await avisos.listar(proximo);
      setItens((atuais) => [...atuais, ...r.itens]);
      setProximo(r.proximo);
      setNaoLidos(r.nao_lidos);
    } catch (e) {
      setErro(textoDoErro(s, e));
    } finally {
      setMaisCarregando(false);
    }
  }

  async function ler(item: ItemDeAviso | null) {
    if (item?.lido) return;
    setItens((atuais) => atuais.map((x) => (item === null || x.id === item.id ? { ...x, lido: true } : x)));
    if (previa()) return setNaoLidos((n) => (item === null ? 0 : Math.max(0, n - 1)));
    try {
      const r = await avisos.ler(item?.id ?? null);
      setNaoLidos(r.nao_lidos);
    } catch (e) {
      setErro(textoDoErro(s, e));
    }
  }

  if (estado === "carregando") return <EsqueletoDaLinha rotulo={l.carregando} quantos={4} />;
  if (estado === "erro") return <p role="alert" className="px-[18px] py-6 font-sans text-oxblood">{erro || l.falha}</p>;

  return (
    <div className="font-sans">
      <div className="flex items-center justify-between gap-3 px-[18px] py-3">
        <p role="status" aria-live="polite" className="text-sm text-ink-soft">
          {naoLidos > 0 ? preencher(l.naoLidos, { n: naoLidos }) : l.tudoLido}
        </p>
        {naoLidos > 0 && (
          <button type="button" onClick={() => void ler(null)} className="min-h-11 cursor-pointer font-bold underline">
            {l.marcarTodos}
          </button>
        )}
      </div>
      {erro && (
        <p role="alert" className="px-[18px] pb-2 text-oxblood">
          {erro}
        </p>
      )}
      {itens.length === 0 ? (
        <p className="px-[18px] py-8 text-ink-soft">{l.vazio}</p>
      ) : (
        <ol aria-label={l.rotulo} className="al3-avisos">
          {itens.map((item, i) => {
            const href = destino(lang, item);
            const frase = fraseDoAviso(item, frases, l.reserva);
            // O rosto em mosaico de quem fez (só o primeiro codinome do grupo, que a frase já diz; nunca a lista) com o ícone do tipo
            // no canto; sem ninguém (apoio, moderação, ato), só o ícone.
            const quem = item.tipo === "apoio" ? null : (item.atores[0] ?? null);
            const conteudo = (
              <span className="al3-aviso-linha">
                <span className="al3-aviso-rosto" aria-hidden data-tipo={item.tipo ?? "conta"}>
                  {quem ? <Avatar16 handle={quem} tamanho={40} /> : <span className="al3-aviso-rosto-vazio" />}
                  <span className="al3-aviso-tipo">
                    <IconeDoAviso tipo={item.tipo} />
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="flex items-start gap-2">
                    {!item.lido && <span className="al3-aviso-novo">{l.novo}</span>}
                    <span className={item.lido ? "" : "font-bold"}>{frase}</span>
                  </span>
                  {item.titulo && <span className="mt-0.5 block text-sm text-ink-soft">{preencher(l.emTitulo, { titulo: item.titulo })}</span>}
                  <time dateTime={item.criado_em} title={quando.format(new Date(item.criado_em))} className="mt-0.5 block text-xs text-ink-soft">
                    {tempoCurto(item.criado_em, lang)}
                  </time>
                </span>
              </span>
            );
            return (
              <li key={item.id} className="al3-aviso-item border-b border-rule" data-lido={item.lido ? "sim" : "nao"} data-tipo={item.tipo ?? "conta"} style={{ "--i": i } as CSSProperties}>
                {href ? (
                  <Link href={href} onClick={() => void ler(item)} className="block min-h-11 px-[18px] py-3 hover:bg-parchment-deep">
                    {conteudo}
                  </Link>
                ) : (
                  <button type="button" onClick={() => void ler(item)} className="block min-h-11 w-full cursor-pointer px-[18px] py-3 text-left hover:bg-parchment-deep">
                    {conteudo}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {proximo && (
        <div className="px-[18px] py-4">
          <button type="button" disabled={maisCarregando} onClick={() => void mais()} className="min-h-11 cursor-pointer rounded-full border-2 border-ink px-5 font-bold hover:bg-parchment-deep disabled:opacity-60">
            {l.mais}
          </button>
        </div>
      )}
    </div>
  );
}

/** A tela Avisos da Rede: os avisos agrupados e as preferências (site, resumo semanal por e-mail, aviso no celular). */
export default function TelaDeAvisos({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const [t, setT] = useState<TextosDeAvisos | null>(null);
  const [aba, setAba] = useState<Aba>("avisos");
  const t3 = useTextosAlumia3(lang);
  const abas = useRef<HTMLDivElement>(null);
  useRegua(abas, `${aba}:${t ? "t" : ""}`);

  useEffect(() => {
    let vivo = true;
    carregarTextosDeAvisos(lang).then((r) => vivo && setT(r));
    return () => {
      vivo = false;
    };
  }, [lang]);

  if (!situacao.logado) {
    return (
      <section className="px-[18px] py-8 font-sans">
        <p className="text-ink-soft">{s.entrada.entreNaConta}</p>
        <Link href={localePath(lang, "/entrar")} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#c21f16] px-5 font-bold text-white hover:bg-[#1f1a14]">
          {s.entrada.entrar}
        </Link>
      </section>
    );
  }
  if (!t) return <EsqueletoDaLinha rotulo="…" quantos={3} />;

  return (
    <div className="al3-tela">
      {t3 && <FaixaDaPrevia t={t3} />}
      <header className="px-[18px] pb-1 pt-4">
        <h1 className="al3-cond al3-titulo-tela">{t.titulo}</h1>
      </header>
      <div role="tablist" aria-label={t.abas.rotulo} ref={abas} className="al3-abas-regua sticky top-[var(--altura-topo,0px)] z-10 flex border-b border-rule bg-parchment">
        <span className="al3-abas-linha" aria-hidden />
        {(["avisos", "preferencias"] as Aba[]).map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            id={`av-aba-${a}`}
            aria-selected={aba === a}
            aria-controls={`av-painel-${a}`}
            onClick={() => setAba(a)}
            className={`min-h-11 flex-1 cursor-pointer px-1 font-sans text-sm font-bold sm:text-base ${aba === a ? "" : "text-ink-soft hover:bg-parchment-deep"}`}
          >
            {t.abas[a]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`av-painel-${aba}`} aria-labelledby={`av-aba-${aba}`} className="al3-entra" key={aba}>
        {aba === "avisos" ? <ListaDeAvisos t={t} lang={lang} s={s} /> : <Preferencias t={t} lang={lang} s={s} situacao={situacao} />}
      </div>
    </div>
  );
}

/** Um ícone de traço por tipo de aviso (resposta, menção, citação, apoio, seguidor, ato, núcleo, moderação). */
const CAMINHO_DO_AVISO: Record<TipoDeAviso | "conta", string> = {
  resposta: "M4 5h16v10H9l-5 4z",
  mencao: "M16 12a4 4 0 1 1-1.2-2.9M16 8v5a2 2 0 0 0 4 0v-1a8 8 0 1 0-3.1 6.3",
  citacao: "M5 17c0-4 1.5-7 5-9l1 1.4C9 11 8.4 12.4 8.3 13.5H11V18H5zM13 17c0-4 1.5-7 5-9l1 1.4c-2 1.6-2.6 3-2.7 4.1H19V18h-6z",
  apoio: "M12 3c.6 3 3.2 4.6 4.6 7.2 1.6 3 .6 7.3-3.2 8.6.9-1.5.6-3.5-1.4-5-.2 1.9-1.3 2.9-2.4 3.7-1 .8-1.4 2-.9 3.3C5.2 19 4.4 14.6 6.3 11.6c.5 1 1.3 1.6 2.2 1.8C8 9.9 9.9 6 12 3z",
  seguidor: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5M19 8v6M16 11h6",
  chamado: "M5 21V4M5 4h11l-2 4 2 4H5",
  nucleo: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
  moderacao: "M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z",
  conta: "M12 8v5M12 16.5v.5M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
};
function IconeDoAviso({ tipo }: { tipo: TipoDeAviso | null }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={CAMINHO_DO_AVISO[tipo ?? "conta"]} />
    </svg>
  );
}
