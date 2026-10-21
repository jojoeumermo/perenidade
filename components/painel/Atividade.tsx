// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { rpc } from "@/lib/backend";
import { avisosDisponiveis, permissaoDeAviso } from "@/lib/notificacoes";
import { getItem, setItem } from "@/lib/storage";
import { useI18n } from "../I18n";
import { Aviso, botao, botaoClaro, localDoPainel, rotulo, textoDoErro } from "./comum";

export interface ItemDeAtividade {
  id: string;
  tipo: string;
  titulo: string;
  resumo: string;
  link: string;
  autor: string | null;
  publico: boolean;
  criado_em: string;
  minha: boolean;
}
interface Linha {
  itens: ItemDeAtividade[];
  visto_em: string;
  modo: "painel" | "cada" | "resumo";
  tipos: string[];
  contagem: Record<string, number>;
}

/** Os tipos de postagem, com o nome curto e a cor da etiqueta (cores da identidade, legíveis nos dois temas). */
export const TIPOS: { id: string; nome: string; cor: string }[] = [
  { id: "envio", nome: "Envios", cor: "#c21f16" },
  { id: "no_ar", nome: "No ar", cor: "#2f5d34" },
  { id: "comunidade", nome: "Comunidade", cor: "#8a5f1c" },
  { id: "anotacao", nome: "Anotações", cor: "#5a4e3c" },
  { id: "mural", nome: "Mural dos Trabalhadores", cor: "#6e1f1a" },
  { id: "gaveta", nome: "Gaveta Aberta", cor: "#3b5b7a" },
  { id: "reforco", nome: "Reforço", cor: "#7a4b8a" },
  { id: "video", nome: "Aulas em vídeo", cor: "#b5462f" },
  { id: "aovivo", nome: "Aulas ao vivo", cor: "#d4372b" },
  { id: "podcast", nome: "Podcast", cor: "#4a6b3a" },
  { id: "arte", nome: "Estúdio", cor: "#9a6a1c" },
  { id: "equipe", nome: "Mural da equipe", cor: "#2c4a5e" },
];
const nomeDoTipo = (id: string) => TIPOS.find((t) => t.id === id)?.nome ?? id;
const corDoTipo = (id: string) => TIPOS.find((t) => t.id === id)?.cor ?? "#5a4e3c";
const CHAVE_DO_AVISO = "lucia:atividade-aviso";

const hora = (iso: string) => new Date(iso).toLocaleTimeString(localDoPainel(), { hour: "2-digit", minute: "2-digit" });
function rotuloDoDia(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === hoje.toDateString()) return "Hoje";
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  return d.toLocaleDateString(localDoPainel(), { weekday: "long", day: "2-digit", month: "long" });
}

/**
 * Com o painel aberto (mesmo noutra aba), pergunta de minuto em minuto se há postagem nova e, se a pessoa quis, mostra o
 * aviso do navegador com o título dela. Devolve quantas postagens ela ainda não viu (para o número do menu).
 */
export function useAtividadeAoVivo(ativo: boolean, naTela: boolean) {
  const [naoVistas, setNaoVistas] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    let anterior: string | null = null;
    const perguntar = () =>
      void rpc<{ nao_vistas: number; ultima: ItemDeAtividade | null }>("atividade_resumo")
        .then((r) => {
          if (!vivo) return;
          setNaoVistas(r.nao_vistas);
          const nova = r.ultima;
          if (nova && anterior && nova.id !== anterior && getItem(CHAVE_DO_AVISO) === "1" && avisosDisponiveis() && Notification.permission === "granted" && (document.visibilityState !== "visible" || !naTela)) {
            try {
              new Notification("Novo no site", { body: nova.titulo, tag: `atividade-${nova.id}`, icon: "/icone-192.png" });
            } catch {
              /* sem aviso neste navegador */
            }
          }
          if (nova) anterior = nova.id;
        })
        .catch(() => undefined);
    perguntar();
    const relogio = window.setInterval(perguntar, 60_000);
    return () => {
      vivo = false;
      window.clearInterval(relogio);
    };
  }, [ativo, naTela]);
  return naTela ? 0 : naoVistas;
}

/** A linha do tempo do que a galera posta no site e no painel, para a coordenação acompanhar. */
export function AtividadeDoSite() {
  const router = useRouter();
  const { lang } = useI18n();
  const [linha, setLinha] = useState<Linha | null>(null);
  const [vistoAntes, setVistoAntes] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<string | null>(null);
  const [mais, setMais] = useState<ItemDeAtividade[]>([]);
  const [acabou, setAcabou] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [avisoNoNavegador, setAvisoNoNavegador] = useState(() => getItem(CHAVE_DO_AVISO) === "1" && permissaoDeAviso() === "granted");

  const carregar = useCallback(
    (marcarVisto: boolean) =>
      rpc<Linha>("atividade_listar", { p_tipo: filtro })
        .then(async (l) => {
          setLinha(l);
          setErro("");
          setVistoAntes((v) => v ?? l.visto_em);
          if (marcarVisto) await rpc("atividade_visto").catch(() => undefined);
        })
        .catch((e) => setErro(textoDoErro(e))),
    [filtro],
  );
  // Ao abrir: carrega e marca como visto (o destaque das novas fica até sair da seção). Depois, de 20 em 20 segundos.
  useEffect(() => {
    const primeira = window.setTimeout(() => void carregar(true), 0);
    const relogio = window.setInterval(() => {
      if (document.visibilityState === "visible") void carregar(true);
    }, 20_000);
    return () => {
      window.clearTimeout(primeira);
      window.clearInterval(relogio);
    };
  }, [carregar]);

  const itens = useMemo(() => [...(linha?.itens ?? []), ...mais], [linha, mais]);
  const porDia = useMemo(() => {
    const grupos: { dia: string; itens: ItemDeAtividade[] }[] = [];
    for (const item of itens) {
      const dia = rotuloDoDia(item.criado_em);
      const ultimo = grupos[grupos.length - 1];
      if (ultimo?.dia === dia) ultimo.itens.push(item);
      else grupos.push({ dia, itens: [item] });
    }
    return grupos;
  }, [itens]);
  const novas = vistoAntes ? itens.filter((i) => !i.minha && i.criado_em > vistoAntes).length : 0;
  const maiorContagem = Math.max(1, ...Object.values(linha?.contagem ?? {}));

  async function carregarMais() {
    const ultima = itens[itens.length - 1];
    if (!ultima) return;
    try {
      const l = await rpc<Linha>("atividade_listar", { p_antes: ultima.criado_em, p_tipo: filtro });
      setMais((m) => [...m, ...l.itens]);
      if (l.itens.length < 60) setAcabou(true);
    } catch (e) {
      setErro(textoDoErro(e));
    }
  }

  function abrir(item: ItemDeAtividade) {
    if (item.link.startsWith("/painel")) router.push(`/${lang}${item.link}`, { scroll: false });
    else if (item.link.startsWith("/")) window.open(`/${lang}${item.link}`, "_blank", "noopener");
  }

  async function assinar(modo: Linha["modo"], tipos: string[]) {
    try {
      await rpc("atividade_assinar", { p_modo: modo, p_tipos: tipos });
      setLinha((l) => (l ? { ...l, modo, tipos } : l));
      setAviso(modo === "painel" ? "Avisos só aqui no painel." : modo === "cada" ? "Pronto: um e-mail a cada postagem." : "Pronto: um resumo por e-mail às 20h.");
    } catch (e) {
      setAviso(textoDoErro(e));
    }
  }

  async function ligarAvisoNoNavegador(ligar: boolean) {
    if (!ligar) {
      setItem(CHAVE_DO_AVISO, null);
      setAvisoNoNavegador(false);
      return;
    }
    if (!avisosDisponiveis()) return setAviso("Este navegador não mostra avisos.");
    const permissao = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permissao !== "granted") return setAviso("O navegador não deu permissão para avisos. Libere nas configurações do site.");
    setItem(CHAVE_DO_AVISO, "1");
    setAvisoNoNavegador(true);
    setAviso("Pronto: com o painel aberto (mesmo noutra aba), cada postagem nova aparece como aviso do navegador.");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <section className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-3">
          <p className="flex items-center gap-2 text-sm">
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c21f16] opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#c21f16]" />
            </span>
            <span className="font-mono text-xs uppercase tracking-widest text-ink-soft">Ao vivo</span>
            {novas > 0 ? <strong>{novas} nova(s) desde a sua última visita</strong> : <span className="text-ink-soft">Nada novo desde a sua última visita.</span>}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo">
          <button type="button" onClick={() => { setFiltro(null); setMais([]); setAcabou(false); }} aria-pressed={filtro === null} className={`cursor-pointer border px-2.5 py-1 text-sm ${filtro === null ? "border-ink bg-ink text-parchment" : "border-rule hover:border-ink"}`}>Tudo</button>
          {TIPOS.map((t) => (
            <button key={t.id} type="button" onClick={() => { setFiltro(t.id); setMais([]); setAcabou(false); }} aria-pressed={filtro === t.id} className={`flex cursor-pointer items-center gap-1.5 border px-2.5 py-1 text-sm ${filtro === t.id ? "border-ink bg-ink text-parchment" : "border-rule hover:border-ink"}`}>
              <span className="h-2 w-2 rounded-full" style={{ background: t.cor }} aria-hidden="true" />
              {t.nome}
              {Boolean(linha?.contagem[t.id]) && <span className="font-mono text-[0.68rem] opacity-70">{linha!.contagem[t.id]}</span>}
            </button>
          ))}
        </div>
        <Aviso texto={erro} />
        {linha && itens.length === 0 && <p className="mt-6 text-ink-soft">Nada por aqui ainda. Assim que alguém postar, aparece nesta lista.</p>}
        {porDia.map((g) => (
          <div key={g.dia} className="mt-6">
            <h3 className="sticky top-0 z-10 bg-parchment py-1 font-mono text-xs uppercase tracking-widest text-gold">{g.dia}</h3>
            <ol className="mt-1 border-l-2 border-rule">
              {g.itens.map((item) => {
                const nova = Boolean(vistoAntes && !item.minha && item.criado_em > vistoAntes);
                return (
                  <li key={item.id} className={`relative ml-4 border-b border-rule py-3 pr-2 ${nova ? "bg-parchment-deep" : ""}`}>
                    <span className="absolute top-4 -left-[1.4rem] h-3 w-3 rounded-full border-2 border-parchment" style={{ background: corDoTipo(item.tipo) }} aria-hidden="true" />
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-mono text-xs text-ink-soft">{hora(item.criado_em)}</span>
                      <span className="font-mono text-[0.65rem] uppercase tracking-widest" style={{ color: corDoTipo(item.tipo) }}>{nomeDoTipo(item.tipo)}</span>
                      {nova && <span className="bg-[#c21f16] px-1.5 font-mono text-[0.62rem] uppercase text-white">nova</span>}
                      {!item.publico && <span className="font-mono text-[0.62rem] uppercase text-ink-soft">equipe</span>}
                    </div>
                    <button type="button" onClick={() => abrir(item)} disabled={!item.link} className="mt-0.5 block cursor-pointer text-left font-semibold hover:text-oxblood disabled:cursor-default">
                      {item.titulo}
                    </button>
                    {item.resumo && <p className="line-clamp-2 text-sm text-ink-soft">{item.resumo}</p>}
                    <p className="mt-1 text-xs text-ink-soft">{item.autor ? `por ${item.autor}` : "do público"}{item.link && <> · <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => abrir(item)}>{item.link.startsWith("/painel") ? "abrir no painel" : "ver no site"} →</button></>}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
        {itens.length >= 60 && !acabou && <button type="button" className={`${botaoClaro} mt-6`} onClick={() => void carregarMais()}>Carregar as mais antigas</button>}
      </section>

      <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start">
        <section className="painel-cartao p-4">
          <h3 className="font-serif text-xl font-semibold">Como me avisar</h3>
          <div className="mt-3 space-y-2 text-sm">
            {([["painel", "Só aqui no painel", "o número no menu mostra o que você não viu"], ["cada", "Um e-mail a cada postagem", "no e-mail da sua conta, na hora"], ["resumo", "Um resumo por e-mail às 20h", "uma vez por dia, só se houve postagem"]] as const).map(([modo, nome, dica]) => (
              <label key={modo} className="flex cursor-pointer items-start gap-2">
                <input type="radio" name="modo-de-aviso" checked={(linha?.modo ?? "painel") === modo} onChange={() => void assinar(modo, linha?.tipos ?? [])} className="mt-1 accent-[#6e1f1a]" />
                <span><span className="block font-semibold">{nome}</span><span className="text-xs text-ink-soft">{dica}</span></span>
              </label>
            ))}
          </div>
          {linha && linha.modo !== "painel" && (
            <fieldset className="mt-4 border-t border-rule pt-3 text-sm">
              <legend className={rotulo}>Por e-mail, só</legend>
              <p className="text-xs text-ink-soft">Nada marcado: tudo.</p>
              <div className="mt-2 grid gap-1">
                {TIPOS.map((t) => (
                  <label key={t.id} className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={linha.tipos.includes(t.id)} onChange={(e) => void assinar(linha.modo, e.target.checked ? [...linha.tipos, t.id] : linha.tipos.filter((x) => x !== t.id))} className="accent-[#6e1f1a]" />
                    {t.nome}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <label className="mt-4 flex cursor-pointer items-start gap-2 border-t border-rule pt-3 text-sm">
            <input type="checkbox" checked={avisoNoNavegador} onChange={(e) => void ligarAvisoNoNavegador(e.target.checked)} className="mt-1 accent-[#6e1f1a]" />
            <span><span className="block font-semibold">Aviso no navegador</span><span className="text-xs text-ink-soft">com o painel aberto, mesmo noutra aba</span></span>
          </label>
          <Aviso texto={aviso} />
        </section>
        {linha && (
          <section>
            <h3 className={rotulo}>Últimos 7 dias</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {TIPOS.filter((t) => linha.contagem[t.id]).sort((a, b) => (linha.contagem[b.id] ?? 0) - (linha.contagem[a.id] ?? 0)).map((t) => (
                <li key={t.id}>
                  <span className="flex justify-between"><span>{t.nome}</span><span className="font-mono text-xs">{linha.contagem[t.id]}</span></span>
                  <span className="mt-0.5 block h-1 bg-rule"><span className="block h-full" style={{ width: `${Math.round(((linha.contagem[t.id] ?? 0) / maiorContagem) * 100)}%`, background: t.cor }} /></span>
                </li>
              ))}
              {Object.keys(linha.contagem).length === 0 && <li className="text-ink-soft">Nenhuma postagem na semana.</li>}
            </ul>
          </section>
        )}
        <button type="button" className={`${botao} w-full`} onClick={() => void carregar(true).then(() => setVistoAntes(new Date().toISOString()))}>Marcar tudo como visto</button>
      </aside>
    </div>
  );
}
