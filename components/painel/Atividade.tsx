// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Activity as ActivityIcon, ArrowRight, CheckCheck, ExternalLink, History } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { rpc } from "@/lib/backend";
import { avisosDisponiveis, permissaoDeAviso } from "@/lib/notificacoes";
import { getItem, setItem } from "@/lib/storage";
import { useI18n } from "../I18n";
import { Aviso, localDoPainel, textoDoErro } from "./comum";
import { Botao, Cartao, Esqueleto, Faixa, ItemDeLista, Lista, Marca, Selo, type TomDoSelo, Vazio } from "./ui";

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

/** A cor de cada tom de selo, em token do painel (para a barrinha dos últimos 7 dias). */
const COR_DO_TOM: Record<TomDoSelo, string> = {
  neutro: "var(--pn-texto-suave)",
  bordo: "var(--pn-destaque-vivo)",
  ok: "var(--pn-ok)",
  aviso: "var(--pn-aviso)",
  erro: "var(--pn-erro)",
  ouro: "var(--pn-ouro)",
  info: "var(--pn-info)",
};
const tipo = (id: string, nome: string, tom: TomDoSelo) => ({ id, nome, tom, cor: COR_DO_TOM[tom] });

/**
 * Os tipos de postagem, com o nome curto e o tom do selo (a palavra diz o tipo; a cor só acompanha). "cor" continua no
 * formato de antes, agora em token do painel, legível nos dois temas.
 */
export const TIPOS: { id: string; nome: string; tom: TomDoSelo; cor: string }[] = [
  tipo("envio", "Envios", "bordo"),
  tipo("no_ar", "No ar", "ok"),
  tipo("comunidade", "Alumia", "ouro"),
  tipo("anotacao", "Anotações", "neutro"),
  tipo("mural", "Mural dos Trabalhadores", "bordo"),
  tipo("gaveta", "Gaveta Aberta", "info"),
  tipo("reforco", "Reforço", "info"),
  tipo("video", "Aulas em vídeo", "aviso"),
  tipo("aovivo", "Aulas ao vivo", "erro"),
  tipo("podcast", "Podcast", "ok"),
  tipo("arte", "Estúdio", "ouro"),
  tipo("equipe", "Mural da equipe", "info"),
];
const nomeDoTipo = (id: string) => TIPOS.find((t) => t.id === id)?.nome ?? id;
const tomDoTipo = (id: string): TomDoSelo => TIPOS.find((t) => t.id === id)?.tom ?? "neutro";
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
      <section className="pn-secao min-w-0" aria-label="Atividade">
        <div className="flex flex-wrap items-center gap-3 border-b border-rule pb-3">
          <Selo tom="bordo" ponto>
            Ao vivo
          </Selo>
          {novas > 0 ? <strong className="text-sm">{novas} nova(s) desde a sua última visita</strong> : <span className="pn-ajuda">Nada novo desde a sua última visita.</span>}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo">
          <Botao pequeno variante={filtro === null ? "padrao" : "discreto"} aria-pressed={filtro === null} onClick={() => { setFiltro(null); setMais([]); setAcabou(false); }}>
            Tudo
          </Botao>
          {TIPOS.map((t) => (
            <Botao key={t.id} pequeno variante={filtro === t.id ? "padrao" : "discreto"} aria-pressed={filtro === t.id} onClick={() => { setFiltro(t.id); setMais([]); setAcabou(false); }}>
              {t.nome}
              {Boolean(linha?.contagem[t.id]) && <span className="font-mono text-[0.68rem] opacity-70">{linha!.contagem[t.id]}</span>}
            </Botao>
          ))}
        </div>
        {erro && (
          <Faixa tom="erro" acao={<Botao pequeno onClick={() => void carregar(false)}>Tentar de novo</Botao>}>
            {erro}
          </Faixa>
        )}
        {!linha && !erro && <Esqueleto forma="linhas" linhas={6} />}
        {linha && itens.length === 0 && <Vazio titulo="Nada por aqui ainda. Assim que alguém postar, aparece nesta lista." simbolo={ActivityIcon} />}
        {porDia.map((g) => (
          <div key={g.dia}>
            <h3 className="pn-rotulo-mono sticky top-0 z-10 bg-parchment py-1">{g.dia}</h3>
            <Lista rotulo={g.dia}>
              {g.itens.map((item) => {
                const nova = Boolean(vistoAntes && !item.minha && item.criado_em > vistoAntes);
                return (
                  <ItemDeLista
                    key={item.id}
                    // "nova" é só destaque de fundo (e o selo "nova"): aria-current diria ao leitor de tela que a linha está aberta.
                    className={nova ? "bg-parchment-deep" : undefined}
                    aoClicar={item.link ? () => abrir(item) : undefined}
                    titulo={item.titulo}
                    meta={
                      <>
                        <span className="font-mono">{hora(item.criado_em)}</span> · {item.autor ? `por ${item.autor}` : "do público"}
                        {item.resumo && <> · {item.resumo}</>}
                      </>
                    }
                    selo={
                      <span className="flex flex-wrap items-center gap-1">
                        {nova && <Selo tom="bordo">nova</Selo>}
                        {!item.publico && <Selo>equipe</Selo>}
                        <Selo tom={tomDoTipo(item.tipo)} ponto>
                          {nomeDoTipo(item.tipo)}
                        </Selo>
                      </span>
                    }
                    acoes={
                      item.link ? (
                        <Botao variante="discreto" pequeno simboloFim={item.link.startsWith("/painel") ? ArrowRight : ExternalLink} onClick={() => abrir(item)}>
                          {item.link.startsWith("/painel") ? "abrir no painel" : "ver no site"}
                        </Botao>
                      ) : undefined
                    }
                  />
                );
              })}
            </Lista>
          </div>
        ))}
        {itens.length >= 60 && !acabou && (
          <div>
            <Botao simbolo={History} onClick={() => void carregarMais()}>
              Carregar as mais antigas
            </Botao>
          </div>
        )}
      </section>

      <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start">
        <Cartao nivelDoTitulo={3} titulo="Como me avisar">
          <div className="space-y-2 text-sm">
            {([["painel", "Só aqui no painel", "o número no menu mostra o que você não viu"], ["cada", "Um e-mail a cada postagem", "no e-mail da sua conta, na hora"], ["resumo", "Um resumo por e-mail às 20h", "uma vez por dia, só se houve postagem"]] as const).map(([modo, nome, dica]) => (
              <label key={modo} className="flex cursor-pointer items-start gap-2">
                <input type="radio" name="modo-de-aviso" checked={(linha?.modo ?? "painel") === modo} onChange={() => void assinar(modo, linha?.tipos ?? [])} className="mt-1" style={{ accentColor: "var(--pn-destaque)" }} />
                <span>
                  <span className="block font-semibold">{nome}</span>
                  <span className="pn-ajuda">{dica}</span>
                </span>
              </label>
            ))}
          </div>
          {linha && linha.modo !== "painel" && (
            <fieldset className="mt-4 border-t border-rule pt-3 text-sm">
              <legend className="pn-rotulo-mono">Por e-mail, só</legend>
              <p className="pn-ajuda">Nada marcado: tudo.</p>
              <div className="mt-2 grid gap-1">
                {TIPOS.map((t) => (
                  <Marca key={t.id} rotulo={t.nome} checked={linha.tipos.includes(t.id)} onChange={(e) => void assinar(linha.modo, e.target.checked ? [...linha.tipos, t.id] : linha.tipos.filter((x) => x !== t.id))} />
                ))}
              </div>
            </fieldset>
          )}
          <label className="mt-4 flex cursor-pointer items-start gap-2 border-t border-rule pt-3 text-sm">
            <input type="checkbox" checked={avisoNoNavegador} onChange={(e) => void ligarAvisoNoNavegador(e.target.checked)} className="mt-1" style={{ accentColor: "var(--pn-destaque)" }} />
            <span>
              <span className="block font-semibold">Aviso no navegador</span>
              <span className="pn-ajuda">com o painel aberto, mesmo noutra aba</span>
            </span>
          </label>
          <Aviso texto={aviso} />
        </Cartao>
        {linha && (
          <section aria-labelledby="atividade-semana">
            <h3 id="atividade-semana" className="pn-rotulo-mono">
              Últimos 7 dias
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {TIPOS.filter((t) => linha.contagem[t.id]).sort((a, b) => (linha.contagem[b.id] ?? 0) - (linha.contagem[a.id] ?? 0)).map((t) => (
                <li key={t.id}>
                  <span className="flex justify-between">
                    <span>{t.nome}</span>
                    <span className="font-mono text-xs">{linha.contagem[t.id]}</span>
                  </span>
                  <span className="mt-0.5 block h-1 bg-rule" aria-hidden>
                    <span className="block h-full" style={{ width: `${Math.round(((linha.contagem[t.id] ?? 0) / maiorContagem) * 100)}%`, background: t.cor }} />
                  </span>
                </li>
              ))}
              {Object.keys(linha.contagem).length === 0 && <li className="text-ink-soft">Nenhuma postagem na semana.</li>}
            </ul>
          </section>
        )}
        <Botao variante="principal" simbolo={CheckCheck} className="w-full" onClick={() => void carregar(true).then(() => setVistoAntes(new Date().toISOString()))}>
          Marcar tudo como visto
        </Botao>
      </aside>
    </div>
  );
}
