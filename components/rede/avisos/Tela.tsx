// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

function Preferencias({ t, lang, s, situacao }: { t: TextosDeAvisos; lang: string; s: PropsDaTelaDoPacote["s"]; situacao: PropsDaTelaDoPacote["situacao"] }) {
  const [prefs, setPrefs] = useState<PreferenciasDeAviso | null>(null);
  const [push, setPush] = useState<EstadoDoPush>("carregando");
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [previa, setPrevia] = useState<ResumoDeAviso | null>(null);
  const p = t.prefs;

  useEffect(() => {
    let vivo = true;
    avisos
      .prefs()
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
    try {
      setPrevia(await avisos.resumoVer());
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
        {previa && (
          <div className="mt-3 rounded border border-rule bg-parchment-deep p-3" role="region" aria-label={p.resumo.ver}>
            {previa.n === 0 ? <p>{p.resumo.nada}</p> : <pre className="whitespace-pre-wrap font-sans text-sm">{previa.texto}</pre>}
            <button type="button" onClick={() => setPrevia(null)} className="mt-2 min-h-11 cursor-pointer font-bold underline">
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
  const quando = useMemo(() => new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short" }), [lang]);

  useEffect(() => {
    let vivo = true;
    avisos
      .listar()
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
        <ol aria-label={l.rotulo}>
          {itens.map((item) => {
            const href = destino(lang, item);
            const frase = fraseDoAviso(item, frases, l.reserva);
            const conteudo = (
              <>
                <span className="flex items-start gap-2">
                  {!item.lido && (
                    <span className="mt-1 shrink-0 rounded bg-[#c21f16] px-1.5 text-xs font-bold text-white">{l.novo}</span>
                  )}
                  <span className={item.lido ? "" : "font-bold"}>{frase}</span>
                </span>
                {item.titulo && <span className="mt-0.5 block text-sm text-ink-soft">{preencher(l.emTitulo, { titulo: item.titulo })}</span>}
                <time dateTime={item.criado_em} className="mt-0.5 block text-xs text-ink-soft">
                  {quando.format(new Date(item.criado_em))}
                </time>
              </>
            );
            return (
              <li key={item.id} className="border-b border-rule">
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
      <h1 className="sr-only">{t.titulo}</h1>
      <div role="tablist" aria-label={t.abas.rotulo} className="sticky top-[var(--altura-topo,0px)] z-10 flex border-b border-rule bg-parchment">
        {(["avisos", "preferencias"] as Aba[]).map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            id={`av-aba-${a}`}
            aria-selected={aba === a}
            aria-controls={`av-painel-${a}`}
            onClick={() => setAba(a)}
            className={`min-h-11 flex-1 cursor-pointer px-1 font-sans text-sm font-bold sm:text-base ${aba === a ? "border-b-[3px] border-[#c21f16]" : "text-ink-soft hover:bg-parchment-deep"}`}
          >
            {t.abas[a]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`av-painel-${aba}`} aria-labelledby={`av-aba-${aba}`}>
        {aba === "avisos" ? <ListaDeAvisos t={t} lang={lang} s={s} /> : <Preferencias t={t} lang={lang} s={s} situacao={situacao} />}
      </div>
    </div>
  );
}
