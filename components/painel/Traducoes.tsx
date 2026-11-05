// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { createPortal } from "react-dom";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { rpc } from "@/lib/backend";
import { partir, tipoDe } from "@/lib/blocos";
import { useI18n } from "../I18n";
import type { Membro } from "./Equipe";
import { ArrowRight, BookmarkPlus, ChevronDown, Languages, PenLine, Plus, Send, Trash2, Undo2, UserPlus, X } from "lucide-react";
import { campo, data, dia, textoDoErro, useAcao, useLista } from "./comum";
import { Abas, Botao, Busca, Campo, Cartao, confirmarFrase, Esqueleto, Faixa, ItemDeLista, Lista, Selecao, Selo, Vazio } from "./ui";

interface Aula {
  slug: string;
  title: string;
  faltam: string[];
  minutos?: number;
  posicao?: number;
}
interface Trilha {
  slug: string;
  title: string;
  area: string;
  lessons: Aula[];
}
interface Andamento {
  alvo: string;
  idioma: string;
  status: "em_andamento" | "enviada" | "aprovada" | string;
  nome: string;
  criado_em: string;
  minha: boolean;
  prazo: string | null;
  /** Quem reservou (só ele convida); "minha" também vale para quem traduz junto. */
  dona?: boolean;
  coautores?: { id: string; nome: string }[];
}
interface Termo {
  termo: string;
  traducao: string;
  nota: string;
  autor: string;
}

const idiomas: Record<string, string> = { en: "inglês", es: "espanhol", zh: "chinês", ru: "russo", fr: "francês" };
const nomeDaSituacao: Record<string, string> = { em_andamento: "em andamento", enviada: "enviada, em revisão", aprovada: "aprovada: entra na próxima publicação" };
const semIdioma = (alvo: string) => alvo.replace(/^\/(pt|en|es|zh|ru|fr)(?=\/)/, "");

/**
 * Traduções: o que falta traduzir em cada idioma (com o progresso, busca, filtros e ordem), a reserva "vou traduzir
 * esta", o que já está a caminho (em andamento, enviada, aprovada), o glossário de cada trilha e o editor lado a lado
 * (original à esquerda, tradução à direita, parágrafo a parágrafo). A tradução continua passando pela fila de revisão.
 */
export function Traducoes({ irEscrever }: { irEscrever: () => void }) {
  const { t } = useI18n();
  const [aba, setAba] = useState<"traduzir" | "caminho" | "glossario">("traduzir");
  const andamento = useLista<Andamento[]>("traducoes_andamento");
  const acao = useAcao(andamento.recarregar);
  const membros = useLista<Membro[]>("equipe_membros", {}, { quieta: true });
  const tradutores = (membros.dados ?? []).filter((m) => !m.eu && m.papeis.some((p) => p.papel === "traducao" || p.papel === "curadoria"));
  const [convidar, setConvidar] = useState<{ chave: string; pessoa: string }>({ chave: "", pessoa: "" });
  const [trilhas, setTrilhas] = useState<Trilha[] | null>(null);
  const [erro, setErro] = useState("");
  const [idioma, setIdioma] = useState("en");
  const [area, setArea] = useState("");
  const [trilha, setTrilha] = useState("");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<"posicao" | "curtas" | "longas">("posicao");
  // A lista vem de 30 em 30 (eram mais de mil aulas numa página só); mudar um filtro volta para as 30 primeiras.
  const [mostrar, setMostrar] = useState({ filtros: "", quantas: 30 });
  const filtros = `${idioma}|${area}|${trilha}|${busca}|${ordem}`;
  const quantas = mostrar.filtros === filtros ? mostrar.quantas : 30;
  const [editando, setEditando] = useState<{ trilha: Trilha; aula: Aula; idioma: string } | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch("/pt/traducoes.json")
      .then((resposta) => (resposta.ok ? (resposta.json() as Promise<Trilha[]>) : Promise.reject(new Error())))
      .then((lista) => { if (!cancelado) setTrilhas(lista); })
      .catch(() => { if (!cancelado) setErro("A lista de aulas não carregou. Ela é montada junto com o site: tente de novo depois da próxima publicação."); });
    return () => { cancelado = true; };
  }, []);

  const nomeDaArea = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug;
  const ocupadas = new Map((andamento.dados ?? []).filter((a) => a.idioma === idioma).map((a) => [semIdioma(a.alvo), a]));
  const areas = [...new Set((trilhas ?? []).map((x) => x.area))].sort((a, b) => nomeDaArea(a).localeCompare(nomeDaArea(b)));
  const trilhasDaArea = (trilhas ?? []).filter((x) => !area || x.area === area);
  const termo = busca.trim().toLowerCase();
  const lista = trilhasDaArea
    .filter((x) => !trilha || x.slug === trilha)
    .flatMap((x) => x.lessons.filter((l) => l.faltam.includes(idioma) && (!termo || `${l.title} ${x.title}`.toLowerCase().includes(termo))).map((l) => ({ trilha: x, aula: l })))
    .sort((a, b) => (ordem === "curtas" ? (a.aula.minutos ?? 0) - (b.aula.minutos ?? 0) : ordem === "longas" ? (b.aula.minutos ?? 0) - (a.aula.minutos ?? 0) : (a.aula.posicao ?? 0) - (b.aula.posicao ?? 0)));
  const progresso = Object.keys(idiomas).map((id) => {
    const total = (trilhas ?? []).reduce((n, x) => n + x.lessons.length, 0);
    const faltam = (trilhas ?? []).reduce((n, x) => n + x.lessons.filter((l) => l.faltam.includes(id)).length, 0);
    return { id, total, prontas: total - faltam };
  });

  async function reservar(alvo: string, id = idioma) {
    return acao.agir("traducao_reservar", { p_alvo: alvo, p_idioma: id, p_dias: 14 }, "Reservada no seu nome por duas semanas ✓");
  }

  return (
    <div className="pn-tela">
      <Abas
        rotulo="Traduções"
        valor={aba}
        aoMudar={setAba}
        opcoes={[
          { id: "traduzir" as const, nome: "Para traduzir" },
          { id: "caminho" as const, nome: "Já a caminho", conta: andamento.dados?.filter((a) => a.minha).length },
          { id: "glossario" as const, nome: "Glossário das trilhas" },
        ]}
      />
      {andamento.erro && (
        <Faixa
          tom="erro"
          acao={
            <Botao pequeno onClick={andamento.recarregar}>
              Tentar de novo
            </Botao>
          }
        >
          {andamento.erro}
        </Faixa>
      )}
      {!andamento.erro && (acao.aviso || erro) && <Faixa tom={erro && !acao.aviso ? "erro" : "info"}>{acao.aviso || erro}</Faixa>}

      {aba === "traduzir" && (
        <div className="pn-tela">
          {trilhas && (
            <Cartao titulo="Quanto já está traduzido">
              <ul className="mt-2 space-y-2">
                {progresso.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 text-sm">
                    <span className="w-20">{idiomas[p.id]}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-rule" role="progressbar" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.prontas} aria-label={`Aulas traduzidas para o ${idiomas[p.id]}`}>
                      <span className="block h-2 rounded-full bg-ok" style={{ width: `${p.total ? (100 * p.prontas) / p.total : 0}%` }} />
                    </span>
                    <span className="tabular w-28 text-right font-mono text-xs">
                      {p.prontas} de {p.total}
                    </span>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Selecao rotulo="Idioma" value={idioma} onChange={(e) => setIdioma(e.target.value)}>
              {Object.entries(idiomas).map(([id, nome]) => (
                <option key={id} value={id}>
                  {nome}
                </option>
              ))}
            </Selecao>
            <Selecao
              rotulo="Disciplina"
              value={area}
              onChange={(e) => {
                setArea(e.target.value);
                setTrilha("");
              }}
            >
              <option value="">Todas</option>
              {areas.map((slug) => (
                <option key={slug} value={slug}>
                  {nomeDaArea(slug)}
                </option>
              ))}
            </Selecao>
            <Selecao rotulo="Trilha" value={trilha} onChange={(e) => setTrilha(e.target.value)}>
              <option value="">Todas</option>
              {trilhasDaArea.map((x) => (
                <option key={x.slug} value={x.slug}>
                  {x.title}
                </option>
              ))}
            </Selecao>
            <Busca rotulo="Buscar" rotuloVisivel valor={busca} aoMudar={setBusca} />
            <Selecao rotulo="Ordem" value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)}>
              <option value="posicao">Primeiras da trilha (as mais lidas)</option>
              <option value="curtas">Mais curtas primeiro</option>
              <option value="longas">Mais longas primeiro</option>
            </Selecao>
          </div>
          <p className="pn-ajuda text-xs">O site não rastreia visitas: “as mais lidas” usa a posição na trilha, porque quem começa uma trilha lê as primeiras aulas.</p>
          {!trilhas && !erro && <Esqueleto forma="linhas" linhas={5} />}
          {trilhas && (
            <p className="text-sm">
              {lista.length} {lista.length === 1 ? "aula" : "aulas"} sem tradução para o {idiomas[idioma]} com esses filtros.
            </p>
          )}
          {lista.length > 0 && (
            <Lista rotulo="Para traduzir">
              {lista.slice(0, quantas).map(({ trilha: x, aula }) => {
                const alvo = `/trilhas/${x.slug}/${aula.slug}`;
                const ocupada = ocupadas.get(alvo);
                return (
                  <ItemDeLista
                    key={alvo}
                    simbolo={Languages}
                    titulo={
                      <a href={`/pt${alvo}`} target="_blank" rel="noopener noreferrer" className="hover:text-oxblood">
                        {aula.title}
                      </a>
                    }
                    meta={
                      <>
                        {nomeDaArea(x.area)} · {x.title} · {aula.minutos ?? "?"} min de leitura
                        {ocupada ? ` · ${ocupada.minha ? "sua" : ocupada.nome || "de outra pessoa"}: ${nomeDaSituacao[ocupada.status] ?? ocupada.status}${ocupada.prazo ? ` até ${dia(ocupada.prazo)}` : ""}` : ""}
                      </>
                    }
                    selo={ocupada && !ocupada.minha ? <Selo tom="erro">ocupada</Selo> : undefined}
                    acoes={
                      ocupada && !ocupada.minha ? undefined : (
                        <>
                          {!ocupada && (
                            <Botao pequeno variante="discreto" simbolo={BookmarkPlus} disabled={acao.ocupado} onClick={() => void reservar(alvo)}>
                              Vou traduzir esta
                            </Botao>
                          )}
                          <Botao
                            pequeno
                            simbolo={PenLine}
                            disabled={acao.ocupado}
                            onClick={async () => {
                              if (ocupada || (await reservar(alvo))) setEditando({ trilha: x, aula, idioma });
                            }}
                          >
                            Traduzir
                          </Botao>
                        </>
                      )
                    }
                  />
                );
              })}
            </Lista>
          )}
          {lista.length > quantas && (
            <p className="flex flex-wrap items-center gap-3 text-sm">
              <Botao pequeno simbolo={ChevronDown} onClick={() => setMostrar({ filtros, quantas: quantas + 30 })}>
                Mostrar mais 30
              </Botao>
              <span className="text-ink-soft">{`${quantas} de ${lista.length} aulas na tela. Os filtros ajudam a achar uma aula.`}</span>
            </p>
          )}
          <p className="pn-ajuda text-sm">
            Prefere o formulário? A tradução também pode ser enviada em{" "}
            <button type="button" className="pn-elo" onClick={irEscrever}>
              Escrever → Tradução
            </button>
            , com o endereço da aula.
          </p>
        </div>
      )}

      {aba === "caminho" && (
        <section className="pn-tela">
          <p className="pn-sobre">Reservas e traduções enviadas que ainda não foram ao ar. Reserva parada passa do prazo e volta para a lista sozinha.</p>
          {andamento.dados === null && !andamento.erro && <Esqueleto forma="linhas" linhas={4} />}
          {andamento.dados?.length === 0 && <Vazio simbolo={Languages} titulo="Nada a caminho." />}
          {(andamento.dados?.length ?? 0) > 0 && (
            <ul aria-label="Já a caminho" className="pn-lista">
              {andamento.dados?.map((item) => {
                const alvo = semIdioma(item.alvo);
                const x = (trilhas ?? []).find((tr) => alvo.startsWith(`/trilhas/${tr.slug}/`));
                const aula = x?.lessons.find((l) => alvo === `/trilhas/${x.slug}/${l.slug}`);
                return (
                  <li key={`${item.alvo}-${item.idioma}-${item.criado_em}`} className="pn-item flex-wrap" style={{ alignItems: "flex-start", paddingBlock: "0.6rem" }}>
                    <span className="min-w-0 flex-1" style={{ display: "grid", gap: "0.2rem" }}>
                      <span className="flex flex-wrap items-center gap-2">
                        <Selo tom={item.status === "aprovada" ? "ok" : item.status === "enviada" ? "aviso" : "info"}>{nomeDaSituacao[item.status] ?? item.status}</Selo>
                        <span className="pn-rotulo-mono">
                          {idiomas[item.idioma] ?? item.idioma} · {data(item.criado_em)}
                          {item.prazo ? ` · prazo ${dia(item.prazo)}` : ""}
                        </span>
                      </span>
                      <span>
                        <a href={`/pt${alvo}`} target="_blank" rel="noopener noreferrer" className="pn-elo">
                          {aula?.title ?? alvo}
                        </a>{" "}
                        · {item.dona || (item.minha && item.dona === undefined) ? "sua" : item.nome || "de outra pessoa"}
                        {item.coautores?.length ? ` · junto com ${item.coautores.map((c) => c.nome).join(", ")}` : ""}
                      </span>
                      {item.dona &&
                        item.status === "em_andamento" &&
                        (convidar.chave === `${alvo}-${item.idioma}` ? (
                          <span className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                            <select value={convidar.pessoa} onChange={(e) => setConvidar({ ...convidar, pessoa: e.target.value })} aria-label="Quem vai traduzir junto…" className="pn-campo w-auto">
                              <option value="">Quem vai traduzir junto…</option>
                              {tradutores.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.nome}
                                </option>
                              ))}
                            </select>
                            <Botao
                              pequeno
                              simbolo={UserPlus}
                              disabled={!convidar.pessoa || acao.ocupado}
                              onClick={async () => {
                                await acao.agir("traducao_convidar", { p_alvo: alvo, p_idioma: item.idioma, p_usuario: convidar.pessoa }, "Convidado: a pessoa foi avisada e já pode abrir a tradução.");
                                setConvidar({ chave: "", pessoa: "" });
                              }}
                            >
                              Convidar
                            </Botao>
                            <Botao pequeno variante="discreto" onClick={() => setConvidar({ chave: "", pessoa: "" })}>
                              Cancelar
                            </Botao>
                          </span>
                        ) : (
                          <span>
                            <Botao pequeno variante="discreto" simbolo={UserPlus} onClick={() => setConvidar({ chave: `${alvo}-${item.idioma}`, pessoa: "" })}>
                              Chamar outro tradutor para ajudar
                            </Botao>
                          </span>
                        ))}
                    </span>
                    {item.minha && item.status === "em_andamento" && (
                      <span className="pn-item-acoes">
                        {x && aula && (
                          <Botao pequeno simbolo={PenLine} onClick={() => setEditando({ trilha: x, aula, idioma: item.idioma })}>
                            Continuar
                          </Botao>
                        )}
                        <Botao
                          pequeno
                          variante="discreto"
                          simbolo={Undo2}
                          onClick={async () => {
                            if (await confirmarFrase("Liberar a reserva? A aula volta para a lista de quem quer traduzir.")) void acao.agir("traducao_liberar", { p_alvo: alvo, p_idioma: item.idioma }, "Reserva liberada.");
                          }}
                        >
                          Liberar
                        </Botao>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {aba === "glossario" && <Glossario trilhas={trilhas ?? []} />}

      {editando && (
        <EditorDeTraducao
          {...editando}
          fechar={() => {
            setEditando(null);
            andamento.recarregar();
          }}
        />
      )}
    </div>
  );
}

function Glossario({ trilhas, fixa, idiomaFixo, compacto = false }: { trilhas: Trilha[]; fixa?: string; idiomaFixo?: string; compacto?: boolean }) {
  const [trilha, setTrilha] = useState(fixa ?? "");
  const [idioma, setIdioma] = useState(idiomaFixo ?? "en");
  const termos = useLista<Termo[]>("traducao_glossario", { p_trilha: trilha || "-", p_idioma: idioma });
  const acao = useAcao(termos.recarregar);
  const [novo, setNovo] = useState({ termo: "", traducao: "", nota: "" });
  return (
    <section className={compacto ? "" : "pn-cartao"}>
      {!compacto && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Selecao rotulo="Trilha" value={trilha} onChange={(e) => setTrilha(e.target.value)}>
            <option value="">Escolha a trilha</option>
            {trilhas.map((x) => (
              <option key={x.slug} value={x.slug}>
                {x.title}
              </option>
            ))}
          </Selecao>
          <Selecao rotulo="Idioma" value={idioma} onChange={(e) => setIdioma(e.target.value)}>
            {Object.entries(idiomas).map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </Selecao>
        </div>
      )}
      {!compacto && <p className="pn-ajuda mt-2 text-sm">Os termos de cada trilha e como ficam no idioma: todas as aulas da trilha passam a dizer a mesma coisa.</p>}
      {trilha && (
        <>
          <ul aria-label="Glossário da trilha" className="pn-lista mt-2 text-sm">
            {termos.dados?.map((x) => (
              <li key={x.termo} className="pn-item flex-wrap">
                <span className="min-w-0 flex-1">
                  <strong>{x.termo}</strong> <ArrowRight aria-hidden width={12} height={12} className="inline" /> <span>{x.traducao}</span>
                  {x.nota && <span className="text-xs text-ink-soft"> ({x.nota})</span>}
                </span>
                <Botao pequeno variante="discreto" perigo icone simbolo={Trash2} aria-label={`apagar ${x.termo}`} dica="apagar" onClick={() => void acao.agir("traducao_glossario_apagar", { p_trilha: trilha, p_idioma: idioma, p_termo: x.termo }, "Termo apagado.")} />
              </li>
            ))}
            {termos.dados?.length === 0 && <li className="pn-item text-ink-soft">Nenhum termo ainda.</li>}
          </ul>
          <div className={`mt-2 grid items-end gap-2 ${compacto ? "" : "sm:grid-cols-[1fr_1fr_1fr_auto]"}`}>
            <input value={novo.termo} onChange={(e) => setNovo({ ...novo, termo: e.target.value })} placeholder="Termo em português" aria-label="Termo em português" maxLength={120} className={campo} />
            <input value={novo.traducao} onChange={(e) => setNovo({ ...novo, traducao: e.target.value })} placeholder={`Em ${idiomas[idioma]}`} aria-label="Tradução" maxLength={160} className={campo} />
            {!compacto && <input value={novo.nota} onChange={(e) => setNovo({ ...novo, nota: e.target.value })} placeholder="Nota (opcional)" aria-label="Nota" maxLength={300} className={campo} />}
            <Botao
              simbolo={Plus}
              disabled={!novo.termo.trim() || !novo.traducao.trim() || acao.ocupado}
              onClick={async () => {
                if (await acao.agir("traducao_glossario_salvar", { p_trilha: trilha, p_idioma: idioma, p_termo: novo.termo.trim(), p_traducao: novo.traducao.trim(), p_nota: novo.nota.trim() }, "Termo guardado ✓")) setNovo({ termo: "", traducao: "", nota: "" });
              }}
            >
              Guardar
            </Botao>
          </div>
          {(termos.erro || acao.aviso) && (
            <div className="mt-2">
              <Faixa tom={termos.erro ? "erro" : "info"}>{termos.erro || acao.aviso}</Faixa>
            </div>
          )}
        </>
      )}
    </section>
  );
}
interface Rascunho {
  titulo: string;
  resumo: string;
  blocos: string[];
}

/** Marca, no original, os termos do glossário da trilha (para quem traduz ver na hora como o termo fica). */
function comTermos(texto: string, termos: Termo[]): ReactNode[] {
  if (termos.length === 0) return [texto];
  const ordenados = [...termos].sort((a, b) => b.termo.length - a.termo.length);
  const padrao = new RegExp(`(${ordenados.map((x) => x.termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return texto.split(padrao).map((parte, i) => {
    const achado = ordenados.find((x) => x.termo.toLowerCase() === parte.toLowerCase());
    return achado ? <mark key={i} title={`${achado.termo} → ${achado.traducao}`} style={{ background: "color-mix(in srgb, var(--pn-ouro) 30%, transparent)", color: "inherit" }}>{parte}</mark> : parte;
  });
}

/** O editor lado a lado: o original da aula em blocos à esquerda e a tradução de cada bloco à direita. */
function EditorDeTraducao({ trilha, aula, idioma, fechar }: { trilha: Trilha; aula: Aula; idioma: string; fechar: () => void }) {
  const alvo = `/trilhas/${trilha.slug}/${aula.slug}`;
  const chave = `lucia:traducao:${alvo}:${idioma}`;
  const [original, setOriginal] = useState<{ title: string; summary: string; body: string } | null>(null);
  const [falha, setFalha] = useState("");
  const blocos = useMemo(() => (original ? partir(original.body) : []), [original]);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const termos = useLista<Termo[]>("traducao_glossario", { p_trilha: trilha.slug, p_idioma: idioma });
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/pt/original/${trilha.slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { lessons: { slug: string; title: string; summary: string; body: string }[] }) => {
        const l = d.lessons.find((x) => x.slug === aula.slug);
        if (!vivo) return;
        if (!l) return setFalha("A aula não foi encontrada no original. Ela pode ter mudado de endereço.");
        setOriginal({ title: l.title, summary: l.summary, body: l.body });
        const partes = partir(l.body);
        let guardado: Rascunho | null = null;
        try {
          guardado = JSON.parse(window.localStorage.getItem(chave) ?? "null");
        } catch {
          guardado = null;
        }
        // Código, fórmula e pauta não se traduzem: já entram copiados (dá para ajustar comentários).
        const inicial = partes.map((b) => (["codigo", "formula", "conta", "bruto", "imagem", "video", "tabela"].includes(tipoDe(b)) ? b : ""));
        setRascunho(guardado && guardado.blocos?.length === partes.length ? guardado : { titulo: "", resumo: "", blocos: inicial });
      })
      .catch(() => vivo && setFalha("O original não carregou. Ele é montado junto com o site: tente de novo depois da próxima publicação."));
    return () => { vivo = false; };
  }, [trilha.slug, aula.slug, chave]);

  useEffect(() => {
    if (!rascunho) return;
    const id = window.setTimeout(() => { try { window.localStorage.setItem(chave, JSON.stringify(rascunho)); } catch { /* sem armazenamento */ } }, 600);
    return () => window.clearTimeout(id);
  }, [rascunho, chave]);

  const prontos = rascunho ? rascunho.blocos.filter((b) => b.trim()).length : 0;
  const corpo = rascunho ? rascunho.blocos.map((b) => b.trim()).filter(Boolean).join("\n\n") : "";

  async function enviar() {
    if (!rascunho) return;
    if (prontos < blocos.length && !(await confirmarFrase(`Faltam ${blocos.length - prontos} blocos sem tradução. Enviar assim mesmo para a revisão?`))) return;
    setEnviando(true);
    setAviso("");
    try {
      await rpc("contribuir", { p: { tipo: "traducao", titulo: rascunho.titulo, corpo, disciplina: null, dados: { idioma, resumo: rascunho.resumo }, fontes: [], alvo } });
      try { window.localStorage.removeItem(chave); } catch { /* sem armazenamento */ }
      setAviso("Enviada ✓ A tradução entrou na fila de revisão; a reserva saiu da lista.");
      window.setTimeout(fechar, 1500);
    } catch (erro) {
      setAviso(textoDoErro(erro));
    } finally {
      setEnviando(false);
    }
  }

  return createPortal(
    <div className="pn-portal fixed inset-0 z-40 overflow-y-auto bg-parchment" role="dialog" aria-modal="true" aria-label={`Traduzir ${aula.title}`}>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-rule bg-parchment px-4 py-2">
        <strong className="font-serif text-lg">Traduzir para o {idiomas[idioma]}: {aula.title}</strong>
        <span className="tabular font-mono text-xs text-ink-soft">{prontos} de {blocos.length} blocos · rascunho guardado neste aparelho</span>
        <span className="ml-auto flex gap-3">
          <Botao variante="principal" simbolo={Send} carregando={enviando} disabled={enviando || !rascunho || rascunho.titulo.trim().length < 3 || corpo.length < 100} onClick={() => void enviar()}>Enviar para a revisão</Botao>
          <Botao simbolo={X} onClick={fechar}>Fechar</Botao>
        </span>
      </div>
      <div className="mx-auto grid max-w-7xl gap-6 p-4 lg:grid-cols-[1fr_16rem]">
        <div>
          {(aviso || falha) && <Faixa tom={falha ? "erro" : "info"}>{aviso || falha}</Faixa>}
          {!original && !falha && <Esqueleto forma="linhas" linhas={6} rotulo="Carregando o original…" />}
          {original && rascunho && (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div><p className="pn-rotulo-mono">Título original</p><p className="font-serif text-xl font-semibold">{comTermos(original.title, termos.dados ?? [])}</p></div>
                <Campo rotulo="Título traduzido" value={rascunho.titulo} onChange={(e) => setRascunho({ ...rascunho, titulo: e.target.value })} maxLength={140} />
                <div><p className="pn-rotulo-mono">Resumo original</p><p>{comTermos(original.summary, termos.dados ?? [])}</p></div>
                <Campo rotulo="Resumo traduzido (uma linha)" value={rascunho.resumo} onChange={(e) => setRascunho({ ...rascunho, resumo: e.target.value })} maxLength={220} />
              </div>
              {blocos.map((b, i) => {
                const tipo = tipoDe(b);
                const naoTraduz = ["codigo", "formula", "conta", "bruto", "imagem", "video", "tabela"].includes(tipo);
                return (
                  <div key={i} className="grid gap-3 border-t border-rule pt-3 md:grid-cols-2">
                    <div className="whitespace-pre-wrap font-serif text-base leading-relaxed">
                      <span className="pn-rotulo-mono mb-1 block">{i + 1} · {tipo}</span>
                      <span data-original>{comTermos(b, termos.dados ?? [])}</span>
                    </div>
                    <div>
                      <textarea
                        value={rascunho.blocos[i] ?? ""}
                        onChange={(e) => setRascunho({ ...rascunho, blocos: rascunho.blocos.map((x, j) => (j === i ? e.target.value : x)) })}
                        rows={Math.max(3, b.split("\n").length + 1)}
                        aria-label={`Tradução do bloco ${i + 1}`}
                        spellCheck
                        lang={idioma}
                        className={`${campo} ${naoTraduz ? "font-mono text-sm" : "font-serif"}`}
                      />
                      {naoTraduz && <p className="text-xs text-ink-soft">Bloco técnico: já vem copiado. Traduza só os textos visíveis (legenda, comentários).</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <aside className="pn-cartao lg:sticky lg:top-16 lg:self-start">
          <p className="pn-rotulo-mono">Glossário da trilha</p>
          <p className="text-xs text-ink-soft">Os termos marcados em amarelo no original já têm tradução combinada.</p>
          <Glossario trilhas={[trilha]} fixa={trilha.slug} idiomaFixo={idioma} compacto />
          <p className="mt-4 text-xs text-ink-soft">A tradução passa pela fila de revisão, como sempre. Ninguém traduz por máquina aqui: o rascunho automático (LibreTranslate) ficou de fora por depender de um servidor próprio.</p>
        </aside>
      </div>
    </div>,
    document.body,
  );
}
