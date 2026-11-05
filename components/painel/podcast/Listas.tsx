// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Check, ChevronLeft, ChevronRight, Clock, Download, FileText, HardDrive, Link2, Mic, Pencil, Plus, Star, ThumbsUp, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { rpc } from "@/lib/backend";
import { EnvioError, enviarCapa, enviarComProgresso, extensaoDe, liberarEspaco, mensagensDeEnvio, nomeSorteado, prepararCapa, urlAssinada } from "@/lib/podcast-audio";
import { Aviso, botaoClaro, data, dataHora, dia, localDoPainel, textoDoErro, useAcao, useLista } from "../comum";
import { EstudioDeArte } from "./Arte";
import { bytes, type Config, NOME_DA_ETAPA, type PainelDoPodcast, type Serie } from "./tipos";
import { Area, Botao, CabecalhoDeSecao, Campo, Cartao, type ColumnDef, confirmarFrase, Esqueleto, Faixa, ItemDeLista, Lista, Marca, Selecao, Selo, type TomDoSelo, Tabela, Vazio } from "../ui";

/** O rótulo que abre a escolha de arquivo mostra o foco do campo escondido (quem usa o teclado vê onde está). */
const FOCO_DO_ARQUIVO = "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--pn-foco)]";

/** Botão de arquivo com barra de progresso. Envia para o depósito e devolve o caminho. */
export function EnviarArquivo({ rotuloBotao, aceitar, deposito, pasta, prefixo, aoEnviar, desligado = false }: { rotuloBotao: string; aceitar: string; deposito: "podcast" | "podcast-producao"; pasta: string; prefixo: string; aoEnviar: (caminho: string, arquivo: File) => Promise<void>; desligado?: boolean }) {
  const [andamento, setAndamento] = useState<number | null>(null);
  const [aviso, setAviso] = useState("");
  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setAviso("");
    const caminho = `${pasta}/${nomeSorteado(prefixo, extensaoDe(arquivo))}`;
    try {
      setAndamento(0);
      await enviarComProgresso(deposito, caminho, arquivo, setAndamento);
      await aoEnviar(caminho, arquivo);
    } catch (erro) {
      setAviso(erro instanceof EnvioError ? (mensagensDeEnvio[erro.message] ?? mensagensDeEnvio.envio) : textoDoErro(erro));
    } finally {
      setAndamento(null);
    }
  }
  return (
    <span className="inline-flex flex-col gap-1">
      <label className={`${botaoClaro} pn-botao-pequeno text-center ${FOCO_DO_ARQUIVO} ${desligado || andamento !== null ? "pointer-events-none opacity-50" : ""}`} aria-busy={andamento !== null || undefined}>
        <Upload aria-hidden />
        {andamento !== null ? `Enviando… ${Math.round(andamento * 100)}%` : rotuloBotao}
        <input type="file" accept={aceitar} className="sr-only" disabled={desligado || andamento !== null} onChange={(e) => { void escolher(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {andamento !== null && <Progresso fracao={andamento} />}
      {aviso && <span className="text-oxblood">{aviso}</span>}
    </span>
  );
}

/** A barra fina de envio (a porcentagem também vai escrita no botão). */
function Progresso({ fracao }: { fracao: number }) {
  const n = Math.round(fracao * 100);
  return (
    <span role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={n} className="block h-1.5 w-full overflow-hidden rounded-full bg-[var(--pn-ativo)]">
      <span className="block h-full bg-[var(--pn-destaque)]" style={{ width: `${n}%` }} />
    </span>
  );
}

/** Toca um arquivo do depósito fechado (endereço temporário, sem baixar inteiro). */
export function OuvirFechado({ caminho, video = false }: { caminho: string; video?: boolean }) {
  const [url, setUrl] = useState("");
  const [erro, setErro] = useState(false);
  if (url) return video ? <video controls src={url} className="mt-1 w-full max-w-md rounded-[var(--pn-raio)]" /> : <audio controls src={url} className="mt-1 h-10 w-full max-w-md" />;
  return (
    <Botao variante="discreto" pequeno simbolo={erro ? undefined : Mic} onClick={() => urlAssinada(caminho).then(setUrl).catch(() => setErro(true))}>
      {erro ? "Não deu para abrir" : video ? "Ver" : "Ouvir"}
    </Botao>
  );
}

// ── Agenda ──

interface Postagem {
  id: string;
  episodio: string | null;
  episodio_titulo: string | null;
  rede: string;
  formato: string;
  quando: string;
  legenda: string;
  status: string;
  link: string;
}

const REDES: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", facebook: "Facebook", x: "X", outra: "Outra" };
const FORMATOS: Record<string, string> = { corte: "Corte em vídeo", arte: "Arte", carrossel: "Carrossel", story: "Story", video: "Vídeo", texto: "Texto" };

const ics = (texto: string) => texto.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);
const icsData = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/**
 * Calendário editorial: gravações e publicações previstas dos episódios, episódios no ar e a agenda de postagens nas
 * redes (cortes, artes, chamadas). Exporta para o calendário do celular (arquivo .ics), onde dá para pôr lembrete.
 */
export function Agenda({ painel }: { painel: PainelDoPodcast }) {
  const hoje = new Date();
  const [mes, setMes] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const de = new Date(mes.getFullYear(), mes.getMonth(), 1);
  const ate = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const postagens = useLista<Postagem[]>("podcast_postagens_listar", { p_de: iso(de), p_ate: iso(ate) });
  const acao = useAcao(postagens.recarregar);
  const vazio = { id: "", episodio: "", rede: "instagram", formato: "corte", quando: `${iso(hoje)}T18:00`, legenda: "", status: "planejada", link: "" };
  const [form, setForm] = useState(vazio);

  const eventos = useMemo(() => {
    const lista: { dia: string; texto: string; tipo: "gravacao" | "previsto" | "no_ar" | "post"; id?: string }[] = [];
    for (const e of painel.episodios) {
      if (e.gravacao_em) lista.push({ dia: e.gravacao_em.slice(0, 10), texto: `${e.titulo}`, tipo: "gravacao" });
      if (e.publicar_em && e.status !== "publicado") lista.push({ dia: e.publicar_em.slice(0, 10), texto: e.titulo, tipo: "previsto" });
      if (e.publicado_em) lista.push({ dia: iso(new Date(e.publicado_em)), texto: e.titulo, tipo: "no_ar" });
    }
    for (const p of postagens.dados ?? []) lista.push({ dia: iso(new Date(p.quando)), texto: `${REDES[p.rede] ?? p.rede}: ${p.episodio_titulo ?? FORMATOS[p.formato]}`, tipo: "post", id: p.id });
    return lista;
  }, [painel.episodios, postagens.dados]);

  const primeiro = (de.getDay() + 6) % 7; // semana começa na segunda
  const dias = Array.from({ length: primeiro + ate.getDate() }, (_, i) => (i < primeiro ? null : i - primeiro + 1));
  const cor = { gravacao: "border-gold", previsto: "border-rule", no_ar: "border-oxblood", post: "border-ink" } as const;
  const simbolo = { gravacao: null, previsto: Clock, no_ar: Star, post: null } as const;

  function exportar() {
    const linhas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Instituto Lucia//Podcast//PT"];
    const agora = icsData(new Date());
    for (const p of postagens.dados ?? []) {
      const ini = new Date(p.quando);
      linhas.push("BEGIN:VEVENT", `UID:post-${p.id}@institutolucia.org`, `DTSTAMP:${agora}`, `DTSTART:${icsData(ini)}`, `DTEND:${icsData(new Date(ini.getTime() + 30 * 60000))}`,
        `SUMMARY:${ics(`${REDES[p.rede]}: ${FORMATOS[p.formato]}${p.episodio_titulo ? ` · ${p.episodio_titulo}` : ""}`)}`, `DESCRIPTION:${ics(p.legenda)}`,
        "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:Postagem do podcast", "END:VALARM", "END:VEVENT");
    }
    for (const e of painel.episodios) {
      for (const [quando, o_que] of [[e.gravacao_em, "Gravação"], [e.status !== "publicado" ? e.publicar_em : null, "Publicação prevista"]] as const) {
        if (!quando) continue;
        const d = quando.slice(0, 10).replace(/-/g, "");
        linhas.push("BEGIN:VEVENT", `UID:${o_que.slice(0, 3)}-${e.id}@institutolucia.org`, `DTSTAMP:${agora}`, `DTSTART;VALUE=DATE:${d}`, `SUMMARY:${ics(`${o_que}: ${e.titulo}`)}`, "END:VEVENT");
      }
    }
    linhas.push("END:VCALENDAR");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([linhas.join("\r\n")], { type: "text/calendar" }));
    a.download = `agenda-podcast-${iso(de).slice(0, 7)}.ics`;
    a.click();
  }

  async function salvar() {
    const ok = await acao.agir("podcast_postagem_salvar", { p_id: form.id || null, p: { ...form, episodio: form.episodio || null, quando: new Date(form.quando).toISOString() } }, form.id ? "Postagem atualizada." : "Postagem agendada.");
    if (ok) setForm(vazio);
  }

  return (
    <div className="space-y-5">
      <CabecalhoDeSecao
        nivel={2}
        titulo={
          <span className="flex items-center gap-2">
            <Botao icone pequeno simbolo={ChevronLeft} aria-label="Mês anterior" dica="Mês anterior" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} />
            <span className="capitalize">{mes.toLocaleDateString(localDoPainel(), { month: "long", year: "numeric" })}</span>
            <Botao icone pequeno simbolo={ChevronRight} aria-label="Próximo mês" dica="Próximo mês" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} />
          </span>
        }
        acoes={<Botao simbolo={Download} onClick={exportar}>Exportar para o calendário (.ics)</Botao>}
      />
      <p className="flex flex-wrap gap-4 text-xs text-ink-soft">
        <span className="border-l-2 border-gold pl-1">gravação</span>
        <span className="inline-flex items-center gap-1 border-l-2 border-rule pl-1"><Clock aria-hidden className="h-3 w-3" /> publicação prevista</span>
        <span className="inline-flex items-center gap-1 border-l-2 border-oxblood pl-1"><Star aria-hidden className="h-3 w-3" /> no ar</span>
        <span className="border-l-2 border-ink pl-1">rede: postagem agendada</span>
      </p>
      <div className="overflow-hidden rounded-[var(--pn-raio-cartao)] border border-[var(--pn-borda)] bg-[var(--pn-superficie)]">
        <div className="grid grid-cols-7 text-xs">
          {Array.from({ length: 7 }, (_, i) => new Date(2026, 1, 2 + i).toLocaleDateString(localDoPainel(), { weekday: "short" }).replace(".", "")).map((d, i) => (
            <p key={i} className="pn-rotulo-mono border-b border-r border-[var(--pn-borda)] bg-[var(--pn-ativo)] px-1 py-1.5 text-center last:border-r-0">{d}</p>
          ))}
          {dias.map((n, i) => {
            const chave = n ? iso(new Date(mes.getFullYear(), mes.getMonth(), n)) : "";
            const doDia = eventos.filter((e) => e.dia === chave);
            const eHoje = chave === iso(hoje);
            return (
              <div key={i} className={`min-h-24 border-b border-r border-[var(--pn-borda)] p-1 [&:nth-child(7n)]:border-r-0 ${eHoje ? "bg-[var(--pn-destaque-suave)]" : ""}`}>
                {n && <p className={`font-mono text-[0.65rem] ${eHoje ? "font-semibold text-oxblood" : "text-ink-soft"}`}>{n}</p>}
                <ul className="space-y-1">
                  {doDia.map((e, j) => {
                    const Simbolo = simbolo[e.tipo];
                    return (
                      <li key={j}>
                        <button
                          type="button"
                          className={`flex w-full items-center gap-1 truncate rounded-sm border-l-2 pl-1 text-left leading-tight focus-visible:outline-2 focus-visible:outline-[var(--pn-foco)] ${cor[e.tipo]} ${e.id ? "cursor-pointer hover:text-oxblood" : "cursor-default"}`}
                          title={e.texto}
                          onClick={() => {
                            const p = postagens.dados?.find((x) => x.id === e.id);
                            if (!p) return;
                            const local = new Date(new Date(p.quando).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                            setForm({ id: p.id, episodio: p.episodio ?? "", rede: p.rede, formato: p.formato, quando: local, legenda: p.legenda, status: p.status, link: p.link });
                          }}
                        >
                          {Simbolo && <Simbolo aria-hidden className="h-3 w-3 shrink-0" />}
                          <span className="truncate">{e.texto}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <Cartao as="div" className="max-w-2xl" titulo={form.id ? "Editar postagem" : "Agendar postagem nas redes"} nivelDoTitulo={3}>
        <form className="mt-2 space-y-3" onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Quando" type="datetime-local" value={form.quando} onChange={(e) => setForm({ ...form, quando: e.target.value })} required />
            <Selecao rotulo="Rede" value={form.rede} onChange={(e) => setForm({ ...form, rede: e.target.value })}>
              {Object.entries(REDES).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </Selecao>
            <Selecao rotulo="Formato" value={form.formato} onChange={(e) => setForm({ ...form, formato: e.target.value })}>
              {Object.entries(FORMATOS).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </Selecao>
          </div>
          <Selecao rotulo="Episódio" value={form.episodio} onChange={(e) => setForm({ ...form, episodio: e.target.value })}>
            <option value="">Nenhum (chamada geral)</option>
            {painel.episodios.map((e) => <option key={e.id} value={e.id}>{e.titulo}</option>)}
          </Selecao>
          <div>
            <Area rotulo="Legenda da postagem" value={form.legenda} onChange={(e) => setForm({ ...form, legenda: e.target.value })} maxLength={2200} rows={3} />
            <span className="block text-right font-mono text-xs text-ink-soft">{form.legenda.length}/2200</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Selecao rotulo="Situação" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="planejada">Planejada</option>
              <option value="pronta">Pronta para postar</option>
              <option value="publicada">Publicada</option>
            </Selecao>
            <Campo rotulo="Link da postagem (depois de publicar)" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://" />
          </div>
          <p className="flex flex-wrap gap-2">
            <Botao type="submit" variante="principal" carregando={acao.ocupado}>{form.id ? "Guardar" : "Agendar"}</Botao>
            {form.id && (
              <>
                <Botao onClick={() => setForm(vazio)}>Cancelar</Botao>
                <Botao variante="discreto" perigo simbolo={Trash2} onClick={async () => { if (await acao.agir("podcast_postagem_remover", { p_id: form.id }, "Postagem removida.")) setForm(vazio); }}>Remover</Botao>
              </>
            )}
          </p>
          <Aviso texto={acao.aviso || postagens.erro} />
        </form>
      </Cartao>
    </div>
  );
}

// ── Pautas ──

interface PautaDaEquipe {
  id: string;
  titulo: string;
  descricao: string;
  origem: string;
  status: string;
  votos: number;
  episodio: string | null;
  criado_em: string;
  autor: string;
}

const STATUS_DA_PAUTA: Record<string, string> = { sugerida: "Sugeridas (só a equipe vê)", votacao: "Em votação no site", escolhida: "Escolhidas", gravada: "Gravadas", descartada: "Descartadas" };

/** Banco de pautas: sugestões da comunidade e da equipe, votação no site e escolha (que já cria a ideia de episódio). */
export function Pautas({ podeDecidir, abrir }: { podeDecidir: boolean; abrir: (episodio: string) => void }) {
  const lista = useLista<PautaDaEquipe[]>("podcast_pautas_listar");
  const acao = useAcao(lista.recarregar);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  return (
    <div className="space-y-6">
      <Cartao as="div" className="max-w-2xl" titulo="Anotar uma pauta" nivelDoTitulo={3}>
        <form className="mt-2 space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await acao.agir("podcast_pauta_salvar", { p_id: null, p: { titulo, descricao } }, "Pauta anotada.")) { setTitulo(""); setDescricao(""); } }}>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Tema" aria-label="Tema" minLength={5} maxLength={140} required className="pn-campo" />
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ângulo, convidados possíveis, por que agora" aria-label="Ângulo, convidados possíveis, por que agora" maxLength={1000} rows={2} className="pn-campo" />
          <Botao type="submit" variante="principal" simbolo={Plus} carregando={acao.ocupado}>Anotar</Botao>
        </form>
      </Cartao>
      <Aviso texto={acao.aviso || lista.erro} />
      {lista.dados === null && !lista.erro && <Esqueleto forma="fila" />}
      {Object.entries(STATUS_DA_PAUTA).map(([status, nome]) => {
        const doStatus = (lista.dados ?? []).filter((p) => p.status === status);
        if (doStatus.length === 0) return null;
        return (
          <section key={status} className="space-y-2">
            <h3 className="pn-rotulo-mono">{nome} ({doStatus.length})</h3>
            <Lista rotulo={nome}>
              {doStatus.map((p) => (
                <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--pn-borda)] px-3.5 py-3 last:border-b-0">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong className="font-serif text-lg">{p.titulo}</strong>
                      {status !== "sugerida" && (
                        <Selo tom="bordo">
                          <ThumbsUp aria-hidden className="h-3 w-3" /> {p.votos}
                        </Selo>
                      )}
                    </span>
                    {p.descricao && <span className="block text-ink-soft">{p.descricao}</span>}
                    <span className="block text-xs text-ink-soft">
                      {p.origem === "comunidade" ? "sugerida pela comunidade" : "da equipe"}
                      {p.autor && ` · ${p.autor}`} · {data(p.criado_em)}
                    </span>
                  </span>
                  {podeDecidir && (
                    <span className="flex flex-wrap gap-1">
                      {status === "sugerida" && <Botao variante="discreto" pequeno onClick={() => acao.agir("podcast_pauta_decidir", { p_id: p.id, p_status: "votacao" }, "Pauta posta em votação no site.")}>Pôr em votação</Botao>}
                      {(status === "sugerida" || status === "votacao") && (
                        <Botao variante="discreto" pequeno simbolo={Check} onClick={async () => { const r = (await acao.agir("podcast_pauta_decidir", { p_id: p.id, p_status: "escolhida" }, "Pauta escolhida: a ideia de episódio foi criada.")) as { episodio?: string } | null; if (r?.episodio) abrir(r.episodio); }}>
                          Escolher e criar episódio
                        </Botao>
                      )}
                      {p.episodio && <Botao variante="discreto" pequeno onClick={() => abrir(p.episodio!)}>Abrir episódio</Botao>}
                      {status !== "descartada" && status !== "gravada" && <Botao variante="discreto" pequeno perigo onClick={() => acao.agir("podcast_pauta_decidir", { p_id: p.id, p_status: "descartada" }, "Pauta descartada.")}>Descartar</Botao>}
                      {status === "descartada" && <Botao variante="discreto" pequeno onClick={() => acao.agir("podcast_pauta_decidir", { p_id: p.id, p_status: "sugerida" }, "Pauta de volta.")}>Recuperar</Botao>}
                    </span>
                  )}
                </li>
              ))}
            </Lista>
          </section>
        );
      })}
    </div>
  );
}

// ── Perguntas ──

interface Pergunta {
  id: string;
  texto: string;
  assinatura: string;
  audio: string;
  status: string;
  episodio: string | null;
  episodio_titulo: string | null;
  criado_em: string;
  autor: string;
}

const TOM_DA_PERGUNTA: Record<string, TomDoSelo> = { nova: "bordo", escolhida: "ouro", respondida: "ok", descartada: "neutro" };

/** "Pergunte ao podcast": o que os ouvintes mandaram, por texto ou áudio. Escolhida, a pergunta fica ligada ao episódio. */
export function Perguntas({ painel, podeDecidir }: { painel: PainelDoPodcast; podeDecidir: boolean }) {
  const lista = useLista<Pergunta[]>("podcast_perguntas_listar");
  const acao = useAcao(lista.recarregar);
  const [ligar, setLigar] = useState<Record<string, string>>({});
  const abertos = painel.episodios.filter((e) => e.status !== "publicado");
  return (
    <div className="space-y-4">
      <p className="pn-sobre">Só a equipe do podcast lê. Ao responder no ar, use só a assinatura que a pessoa escolheu.</p>
      <Aviso texto={acao.aviso || lista.erro} />
      {lista.dados === null && !lista.erro && <Esqueleto forma="fila" />}
      {lista.dados?.length === 0 && <Vazio titulo="Nenhuma pergunta ainda." />}
      {(lista.dados?.length ?? 0) > 0 && (
        <Lista rotulo="Perguntas">
          {lista.dados?.map((q) => (
            <li key={q.id} className={`space-y-2 border-b border-[var(--pn-borda)] px-3.5 py-3 last:border-b-0 ${q.status === "descartada" ? "opacity-60" : ""}`}>
              <p className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                <Selo tom={TOM_DA_PERGUNTA[q.status] ?? "neutro"} ponto>{q.status}</Selo>
                <span>
                  {q.assinatura ? `"${q.assinatura}"` : "sem assinatura"} · conta de {q.autor || "—"} · {dataHora(q.criado_em)}
                  {q.episodio_titulo && ` · episódio: ${q.episodio_titulo}`}
                </span>
              </p>
              {q.texto && <p className="whitespace-pre-line text-base" data-original>{q.texto}</p>}
              {q.audio && <OuvirFechado caminho={q.audio} />}
              {podeDecidir && q.status !== "descartada" && (
                <p className="flex flex-wrap items-center gap-2">
                  <select value={ligar[q.id] ?? q.episodio ?? ""} onChange={(e) => setLigar({ ...ligar, [q.id]: e.target.value })} aria-label="Episódio…" className="pn-campo w-auto max-w-xs">
                    <option value="">Episódio…</option>
                    {abertos.map((e) => <option key={e.id} value={e.id}>{e.titulo}</option>)}
                  </select>
                  <Botao variante="discreto" pequeno simbolo={Check} disabled={!(ligar[q.id] ?? q.episodio)} onClick={() => acao.agir("podcast_pergunta_decidir", { p_id: q.id, p_status: "escolhida", p_episodio: ligar[q.id] || q.episodio }, "Pergunta escolhida para o episódio.")}>Escolher</Botao>
                  <Botao variante="discreto" pequeno onClick={() => acao.agir("podcast_pergunta_decidir", { p_id: q.id, p_status: "respondida" }, "Marcada como respondida.")}>Respondida</Botao>
                  <Botao variante="discreto" pequeno perigo onClick={() => acao.agir("podcast_pergunta_decidir", { p_id: q.id, p_status: "descartada" }, "Pergunta descartada (o áudio sai do depósito).")}>Descartar</Botao>
                </p>
              )}
            </li>
          ))}
        </Lista>
      )}
    </div>
  );
}

// ── Convidados ──

interface Convidado {
  id: string;
  nome: string;
  minibio: string;
  contato: string;
  autoriza_voz: boolean;
  autoriza_imagem: boolean;
  termo: string;
  aceite_nome: string;
  aceite_em: string | null;
  link: string | null;
  link_validade: string | null;
  episodios: { id: string; titulo: string; status: string }[];
}

export const linkDoConvidado = (token: string) => `${window.location.origin}/pt/podcasts/convidado?t=${token}`;

/** Fichas dos convidados: contato, minibio, autorização de voz e imagem (pelo link ou pelo termo assinado). */
export function Convidados({ podeEditar }: { podeEditar: boolean }) {
  const lista = useLista<Convidado[]>("podcast_convidados_listar");
  const acao = useAcao(lista.recarregar);
  const vazio = { id: "", nome: "", contato: "", minibio: "" };
  const [form, setForm] = useState(vazio);
  const [copiado, setCopiado] = useState("");

  async function link(c: Convidado) {
    const r = (await acao.agir("podcast_convidado_link", { p_id: c.id }, "Link novo gerado: vale 30 dias.")) as { token?: string } | null;
    if (r?.token) {
      await navigator.clipboard.writeText(linkDoConvidado(r.token)).catch(() => {});
      setCopiado(c.id);
    }
  }

  return (
    <div className="space-y-5">
      {podeEditar && (
        <Cartao as="div" className="max-w-2xl" titulo={form.id ? "Editar ficha" : "Novo convidado"} nivelDoTitulo={3}>
          <form className="mt-2 space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await acao.agir("podcast_convidado_salvar", { p_id: form.id || null, p: { nome: form.nome, contato: form.contato, minibio: form.minibio } }, form.id ? "Ficha atualizada." : "Convidado cadastrado.")) setForm(vazio); }}>
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome" aria-label="Nome" required minLength={2} maxLength={120} className="pn-campo" />
            <input value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} placeholder="Contato (e-mail, telefone): só a produção vê" aria-label="Contato (e-mail, telefone): só a produção vê" maxLength={300} className="pn-campo" />
            <textarea value={form.minibio} onChange={(e) => setForm({ ...form, minibio: e.target.value })} placeholder="Minibio (aparece na página do episódio)" aria-label="Minibio (aparece na página do episódio)" maxLength={600} rows={2} className="pn-campo" />
            <p className="flex gap-2">
              <Botao type="submit" variante="principal" carregando={acao.ocupado}>{form.id ? "Guardar" : "Cadastrar"}</Botao>
              {form.id && <Botao onClick={() => setForm(vazio)}>Cancelar</Botao>}
            </p>
          </form>
        </Cartao>
      )}
      <Aviso texto={acao.aviso || lista.erro} />
      {lista.dados === null && !lista.erro && <Esqueleto forma="fila" />}
      {(lista.dados?.length ?? 0) > 0 && (
        <Lista rotulo="Convidados">
          {lista.dados?.map((c) => (
            <li key={c.id} className="space-y-2 border-b border-[var(--pn-borda)] px-3.5 py-3 last:border-b-0">
              <p className="flex flex-wrap items-center justify-between gap-2">
                <strong className="font-serif text-lg">{c.nome}</strong>
                <Selo tom={c.autoriza_voz ? "ok" : "erro"} ponto>
                  {c.autoriza_voz ? (c.autoriza_imagem ? "voz e imagem autorizadas" : "voz autorizada") : "sem autorização de voz"}
                </Selo>
              </p>
              {c.minibio && <p className="text-ink-soft">{c.minibio}</p>}
              {c.contato && <p className="text-xs">Contato: {c.contato}</p>}
              {c.aceite_em && <p className="text-xs text-ink-soft">Aceite pelo link: {c.aceite_nome} em {dataHora(c.aceite_em)}</p>}
              {c.episodios.length > 0 && <p className="text-xs text-ink-soft">Episódios: {c.episodios.map((e) => `${e.titulo} (${NOME_DA_ETAPA[e.status as keyof typeof NOME_DA_ETAPA] ?? e.status})`).join(" · ")}</p>}
              {podeEditar && (
                <div className="flex flex-wrap items-center gap-2">
                  <Botao variante="discreto" pequeno simbolo={Pencil} onClick={() => setForm({ id: c.id, nome: c.nome, contato: c.contato, minibio: c.minibio })}>Editar</Botao>
                  <Botao variante="discreto" pequeno simbolo={copiado === c.id ? Check : Link2} onClick={() => void link(c)}>{copiado === c.id ? "Link copiado" : c.link ? "Gerar link novo" : "Link do convidado (termo e teste de microfone)"}</Botao>
                  {c.link && (
                    <Botao variante="discreto" pequeno onClick={() => { void navigator.clipboard.writeText(linkDoConvidado(c.link!)); setCopiado(c.id); }}>Copiar o link atual</Botao>
                  )}
                  <EnviarArquivo
                    rotuloBotao={c.termo ? "Trocar o termo assinado" : "Anexar termo assinado (PDF ou foto)"}
                    aceitar="application/pdf,image/*"
                    deposito="podcast-producao"
                    pasta={`termos/${c.id}`}
                    prefixo="termo"
                    aoEnviar={async (caminho) => {
                      await rpc("podcast_convidado_salvar", { p_id: c.id, p: { termo: caminho } });
                      lista.recarregar();
                    }}
                  />
                  {c.termo && <OuvirFechadoDocumento caminho={c.termo} />}
                  {(c.termo || c.aceite_em) && (
                    <>
                      <Marca rotulo="voz" checked={c.autoriza_voz} onChange={(e) => acao.agir("podcast_convidado_salvar", { p_id: c.id, p: { autoriza_voz: e.target.checked } }, "Autorização atualizada.")} />
                      <Marca rotulo="imagem" checked={c.autoriza_imagem} onChange={(e) => acao.agir("podcast_convidado_salvar", { p_id: c.id, p: { autoriza_imagem: e.target.checked } }, "Autorização atualizada.")} />
                    </>
                  )}
                  <Botao variante="discreto" pequeno perigo simbolo={Trash2} onClick={async () => { if ((await confirmarFrase(`Apagar a ficha de ${c.nome}?`))) void acao.agir("podcast_convidado_remover", { p_id: c.id }, "Ficha apagada.").then((r) => liberarEspaco(((r as { liberar?: { deposito: string; caminho: string }[] } | null)?.liberar) ?? [])); }}>Apagar</Botao>
                </div>
              )}
            </li>
          ))}
        </Lista>
      )}
    </div>
  );
}

function OuvirFechadoDocumento({ caminho }: { caminho: string }) {
  return (
    <Botao variante="discreto" pequeno simbolo={FileText} onClick={() => urlAssinada(caminho).then((url) => window.open(url, "_blank", "noopener"))}>
      Ver o termo
    </Botao>
  );
}

// ── Biblioteca de áudios ──

interface Trilha {
  id: string;
  titulo: string;
  autor: string;
  tipo: string;
  licenca: string;
  fonte: string;
  caminho: string;
  duracao: number;
  nota: string;
  usos: number;
}

const LICENCAS = ["Domínio público", "CC0", "CC BY 4.0", "CC BY-SA 4.0", "Licença da YouTube Audio Library", "Licença do Pixabay", "Free Music Archive (CC)", "Produção própria do instituto"];

/** Vinhetas, trilhas e efeitos com a licença registrada. Só o que está aqui entra nos episódios. */
export function Trilhas({ podeEditar }: { podeEditar: boolean }) {
  const lista = useLista<Trilha[]>("podcast_trilhas_listar");
  const acao = useAcao(lista.recarregar);
  const vazio = { id: "", titulo: "", autor: "", tipo: "vinheta", licenca: "", fonte: "", caminho: "", duracao: 0, nota: "" };
  const [form, setForm] = useState(vazio);
  return (
    <div className="space-y-5">
      <p className="pn-sobre">
        Fontes livres: YouTube Audio Library, Free Music Archive, Pixabay Music, ccMixter. Anote a licença exata e o link de onde a faixa veio: é o que protege o episódio de ser derrubado por direito autoral.
      </p>
      {podeEditar && (
        <Cartao as="div" className="max-w-2xl" titulo={form.id ? "Editar faixa" : "Nova faixa"} nivelDoTitulo={3}>
          <form className="mt-2 space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await acao.agir("podcast_trilha_salvar", { p_id: form.id || null, p: form }, form.id ? "Faixa atualizada." : "Faixa na biblioteca.")) setForm(vazio); }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título" aria-label="Título" required maxLength={160} className="pn-campo" />
              <input value={form.autor} onChange={(e) => setForm({ ...form, autor: e.target.value })} placeholder="Autor ou banda" aria-label="Autor ou banda" maxLength={120} className="pn-campo" />
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} aria-label="Tipo" className="pn-campo">
                <option value="vinheta">Vinheta</option>
                <option value="trilha">Trilha de fundo</option>
                <option value="efeito">Efeito sonoro</option>
              </select>
              <input list="licencas" value={form.licenca} onChange={(e) => setForm({ ...form, licenca: e.target.value })} placeholder="Licença (obrigatória)" aria-label="Licença (obrigatória)" required minLength={2} maxLength={120} className="pn-campo" />
              <datalist id="licencas">{LICENCAS.map((l) => <option key={l} value={l} />)}</datalist>
            </div>
            <input value={form.fonte} onChange={(e) => setForm({ ...form, fonte: e.target.value })} placeholder="Link de onde veio (https://…)" aria-label="Link de onde veio (https://…)" className="pn-campo" />
            <input value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} placeholder="Nota (como creditar, restrições)" aria-label="Nota (como creditar, restrições)" maxLength={500} className="pn-campo" />
            <p className="flex flex-wrap items-center gap-2">
              <EnviarArquivo
                rotuloBotao={form.caminho ? "Trocar o arquivo" : "Enviar o arquivo da faixa"}
                aceitar="audio/*"
                deposito="podcast-producao"
                pasta="trilhas"
                prefixo="faixa"
                aoEnviar={async (caminho) => setForm((f) => ({ ...f, caminho }))}
              />
              {form.caminho && <Selo tom="ok" ponto>arquivo enviado</Selo>}
            </p>
            <p className="flex gap-2">
              <Botao type="submit" variante="principal" carregando={acao.ocupado} disabled={form.licenca.trim().length < 2}>{form.id ? "Guardar" : "Pôr na biblioteca"}</Botao>
              {form.id && <Botao onClick={() => setForm(vazio)}>Cancelar</Botao>}
            </p>
          </form>
        </Cartao>
      )}
      <Aviso texto={acao.aviso || lista.erro} />
      {lista.dados === null && !lista.erro && <Esqueleto forma="fila" />}
      {(lista.dados?.length ?? 0) > 0 && (
        <Lista rotulo="Biblioteca de áudios">
          {lista.dados?.map((t) => (
            <li key={t.id} className="space-y-1 border-b border-[var(--pn-borda)] px-3.5 py-3 last:border-b-0">
              <p className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-2">
                  <Selo tom="ouro">{t.tipo}</Selo>
                  <strong>{t.titulo}</strong>
                  {t.autor && <span className="text-ink-soft"> · {t.autor}</span>}
                </span>
                <span className="font-mono text-xs">{t.licenca}</span>
              </p>
              <p className="text-xs text-ink-soft">
                {t.fonte && <a href={t.fonte} target="_blank" rel="noopener noreferrer" className="pn-elo">{t.fonte}</a>} {t.usos > 0 && ` · usada em ${t.usos} episódio(s)`} {t.nota && ` · ${t.nota}`}
              </p>
              <p className="flex flex-wrap items-center gap-2">
                {t.caminho && <OuvirFechado caminho={t.caminho} />}
                {podeEditar && <Botao variante="discreto" pequeno simbolo={Pencil} onClick={() => setForm({ id: t.id, titulo: t.titulo, autor: t.autor, tipo: t.tipo, licenca: t.licenca, fonte: t.fonte, caminho: t.caminho, duracao: t.duracao, nota: t.nota })}>Editar</Botao>}
                {podeEditar && <Botao variante="discreto" pequeno perigo simbolo={Trash2} onClick={() => void acao.agir("podcast_trilha_remover", { p_id: t.id }, "Faixa removida.").then((r) => liberarEspaco(((r as { liberar?: { deposito: string; caminho: string }[] } | null)?.liberar) ?? []))}>Remover</Botao>}
              </p>
            </li>
          ))}
        </Lista>
      )}
    </div>
  );
}

// ── Pedidos de arte ──

interface Pedido {
  id: string;
  texto: string;
  status: string;
  criado_em: string;
  feito_em: string | null;
  episodio: string | null;
  episodio_titulo: string | null;
  capa_mini: string;
  numero: number | null;
  serie: string | null;
  pedido_por: string | null;
  atendido_por: string | null;
}

/** Pedidos de arte ao design. Quem é do design abre o episódio, faz a capa e marca o pedido como feito. */
export function Pedidos({ abrir }: { abrir: (episodio: string) => void }) {
  const lista = useLista<Pedido[]>("podcast_pedidos_listar");
  const acao = useAcao(lista.recarregar);
  return (
    <div className="space-y-4">
      <Aviso texto={acao.aviso || lista.erro} />
      {lista.dados === null && !lista.erro && <Esqueleto forma="fila" />}
      {lista.dados?.length === 0 && <Vazio titulo="Nenhum pedido de arte." />}
      {(lista.dados?.length ?? 0) > 0 && (
        <Lista rotulo="Pedidos de arte">
          {lista.dados?.map((p) => (
            <li key={p.id} className={`space-y-1 border-b border-[var(--pn-borda)] px-3.5 py-3 last:border-b-0 ${p.status === "feito" ? "opacity-60" : ""}`}>
              <p className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                <Selo tom={p.status === "aberto" ? "bordo" : "ok"} ponto>{p.status}</Selo>
                <span>
                  {p.pedido_por} · {dataHora(p.criado_em)}
                  {p.atendido_por && ` · feito por ${p.atendido_por}`}
                </span>
              </p>
              <p className="font-serif text-lg font-semibold">{p.episodio_titulo ?? "Sem episódio"}{p.numero != null && ` · #${p.numero}`}{p.serie && ` · ${p.serie}`}</p>
              <p className="whitespace-pre-line" data-original>{p.texto}</p>
              <p className="flex flex-wrap gap-2">
                {p.episodio && <Botao variante="discreto" pequeno onClick={() => abrir(p.episodio!)}>Abrir o episódio (capa e artes)</Botao>}
                {p.status === "aberto" && <Botao variante="discreto" pequeno simbolo={Check} onClick={() => acao.agir("podcast_pedido_concluir", { p_id: p.id }, "Pedido marcado como feito.")}>Marcar como feito</Botao>}
              </p>
            </li>
          ))}
        </Lista>
      )}
    </div>
  );
}

interface Pessoa {
  id: string;
  nome: string;
  jornalismo: boolean;
  separadas: boolean;
  funcoes: string[];
}

// ── Números ──

interface Numeros {
  episodios: { id: string; titulo: string; publicado_em: string; total: number; mes: number }[];
  dias: { dia: string; total: number }[];
}

type LinhaDosNumeros = Numeros["episodios"][number];
const COLUNAS_DOS_NUMEROS: ColumnDef<LinhaDosNumeros>[] = [
  { accessorKey: "titulo", header: "Episódio" },
  { accessorKey: "mes", header: "30 dias", cell: ({ getValue }) => <span className="block text-right font-mono">{String(getValue())}</span> },
  { accessorKey: "total", header: "Total", cell: ({ getValue }) => <span className="block text-right font-mono">{String(getValue())}</span> },
];

/** Audições no site (sem saber quem ouviu). As das plataformas ficam no painel de cada uma (Spotify for Creators, Apple). */
export function Numeros() {
  const lista = useLista<Numeros>("podcast_estatisticas");
  const maior = Math.max(1, ...(lista.dados?.dias.map((d) => d.total) ?? [1]));
  return (
    <div className="space-y-5">
      <p className="pn-sobre">
        Contamos quantas vezes cada episódio começou a tocar no site, sem guardar quem ouviu nem de onde. Quem ouve pelo Spotify, Apple ou YouTube aparece no painel de cada plataforma.
      </p>
      {lista.erro && <Faixa tom="erro" acao={<Botao pequeno onClick={lista.recarregar}>Tentar de novo</Botao>}>{lista.erro}</Faixa>}
      {lista.dados === null && !lista.erro && <Esqueleto forma="tabela" />}
      <Cartao titulo="Últimos 30 dias" nivelDoTitulo={3}>
        <div className="mt-3 flex h-32 items-end gap-1 border-b border-[var(--pn-borda-forte)]">
          {lista.dados?.dias.map((d) => (
            <div key={d.dia} title={`${dia(d.dia)}: ${d.total}`} className="flex-1 rounded-t-sm bg-[var(--pn-destaque)]" style={{ height: `${(d.total / maior) * 100}%`, minHeight: d.total ? 2 : 0 }} />
          ))}
        </div>
      </Cartao>
      {lista.dados && <Tabela legenda="Episódio" dados={lista.dados.episodios} colunas={COLUNAS_DOS_NUMEROS} densa />}
    </div>
  );
}

// ── Ajustes ──

const CATEGORIAS = ["Education", "Society & Culture", "History", "News", "Government"];
const PLATAFORMAS: [string, string][] = [["spotify", "Spotify"], ["apple", "Apple Podcasts"], ["youtube", "YouTube Music"], ["deezer", "Deezer"], ["amazon", "Amazon Music"], ["archive", "Internet Archive"], ["instagram", "Instagram"], ["tiktok", "TikTok"]];

/**
 * Ajustes do podcast (supervisão e coordenação): o programa no feed, as séries, as tarefas de cada pessoa
 * e o depósito (quantos episódios ficam guardados e liberar espaço).
 */
export function Ajustes({ painel, recarregar }: { painel: PainelDoPodcast; recarregar: () => void }) {
  const { eu } = painel;
  const acao = useAcao(recarregar);
  const [config, setConfig] = useState<Config>(painel.config);
  const [serie, setSerie] = useState({ id: "", titulo: "", descricao: "", ordem: "0", ativa: true, capa: "", capa_mini: "" });
  const equipe = useLista<Pessoa[]>("podcast_equipe");
  const acaoEquipe = useAcao(equipe.recarregar);
  const [liberando, setLiberando] = useState("");
  const a = painel.armazenamento;

  async function liberar() {
    setLiberando("Liberando…");
    try {
      const pendentes = await rpc<{ deposito: string; caminho: string }[]>("podcast_liberar_pendentes");
      const n = await liberarEspaco(pendentes);
      setLiberando(n ? `${n} arquivo(s) saíram do depósito.` : "Nada para liberar agora.");
      recarregar();
    } catch (erro) {
      setLiberando(textoDoErro(erro));
    }
  }

  async function capaDoPrograma(tela: HTMLCanvasElement) {
    const enviada = await enviarCapa("programa", await prepararCapa(tela));
    setConfig((c) => ({ ...c, capa: enviada.capa, capa_mini: enviada.mini }));
    await rpc("podcast_config_salvar", { p: { ...config, capa: enviada.capa, capa_mini: enviada.mini } });
    recarregar();
  }

  return (
    <div className="max-w-4xl space-y-5">
      {eu.supervisao && (
        <Cartao titulo="O programa no feed" sobre={`É o que aparece no Spotify, no Apple Podcasts e nos outros quando você cadastrar o endereço do feed: ${typeof window !== "undefined" ? window.location.origin : ""}/podcast.xml`}>
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Nome" value={config.nome} onChange={(e) => setConfig({ ...config, nome: e.target.value })} maxLength={120} />
              <Campo rotulo="Autor" value={config.autor} onChange={(e) => setConfig({ ...config, autor: e.target.value })} maxLength={120} />
            </div>
            <Area rotulo="Descrição" value={config.descricao} onChange={(e) => setConfig({ ...config, descricao: e.target.value })} maxLength={4000} rows={4} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo rotulo="E-mail do dono do feed (as plataformas confirmam por ele)" type="email" value={config.email} onChange={(e) => setConfig({ ...config, email: e.target.value })} />
              <Selecao rotulo="Categoria" value={config.categoria} onChange={(e) => setConfig({ ...config, categoria: e.target.value })}>
                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </Selecao>
              <Campo rotulo="Subcategoria" value={config.subcategoria} onChange={(e) => setConfig({ ...config, subcategoria: e.target.value })} placeholder="Courses" maxLength={60} />
            </div>
            <Marca rotulo="Conteúdo explícito (palavrão, violência descrita)" checked={config.explicito} onChange={(e) => setConfig({ ...config, explicito: e.target.checked })} />
            <div className="grid gap-3 sm:grid-cols-2">
              {PLATAFORMAS.map(([id, nome]) => (
                <Campo key={id} rotulo={`Link no ${nome}`} value={config.links?.[id] ?? ""} onChange={(e) => setConfig({ ...config, links: { ...config.links, [id]: e.target.value } })} placeholder="https://" />
              ))}
            </div>
            <div className="max-w-xs">
              <Campo rotulo="Episódios com áudio guardado no depósito" type="number" min={1} max={50} value={config.guardados} onChange={(e) => setConfig({ ...config, guardados: Number(e.target.value) || 10 })} />
            </div>
            <Botao variante="principal" carregando={acao.ocupado} onClick={() => acao.agir("podcast_config_salvar", { p: config }, "Ajustes guardados.")}>Guardar ajustes</Botao>
            <Aviso texto={acao.aviso} />
            <details className="rounded-[var(--pn-raio)] border border-[var(--pn-borda)] p-4">
              <summary className="cursor-pointer font-semibold">Capa do programa (3000 × 3000)</summary>
              <div className="mt-4">
                <EstudioDeArte inicial={{ titulo: config.nome, programa: "Instituto Lúcia" }} aoUsarComoCapa={capaDoPrograma} rotuloCapa="Usar como capa do programa" />
              </div>
            </details>
          </div>
        </Cartao>
      )}

      <Cartao titulo="Séries" sobre="Uma série agrupa episódios de um mesmo formato ou tema longo (ex.: “Revoluções”, “Economia sem mistério”). Os temas (história, economia, ENEM…) se marcam em cada episódio.">
        {painel.series.length > 0 && (
          <Lista rotulo="Séries" className="mt-3!">
            {painel.series.map((s: Serie) => (
              <ItemDeLista
                key={s.id}
                titulo={s.titulo}
                meta={s.descricao}
                selo={!s.ativa ? <Selo>(escondida)</Selo> : undefined}
                acoes={
                  <>
                    <Botao variante="discreto" pequeno simbolo={Pencil} onClick={() => setSerie({ id: s.id, titulo: s.titulo, descricao: s.descricao, ordem: String(s.ordem), ativa: s.ativa, capa: s.capa, capa_mini: s.capa_mini })}>Editar</Botao>
                    {eu.supervisao && <Botao variante="discreto" pequeno perigo simbolo={Trash2} onClick={async () => { if ((await confirmarFrase("Apagar a série? Os episódios continuam, sem série."))) void acao.agir("podcast_serie_remover", { p_id: s.id }, "Série apagada."); }}>Apagar</Botao>}
                  </>
                }
              />
            ))}
          </Lista>
        )}
        <form className="mt-4 max-w-2xl space-y-3 rounded-[var(--pn-raio)] border border-[var(--pn-borda)] bg-[var(--pn-fundo)] p-4" onSubmit={async (e) => { e.preventDefault(); if (await acao.agir("podcast_serie_salvar", { p_id: serie.id || null, p: serie }, serie.id ? "Série atualizada." : "Série criada.")) setSerie({ id: "", titulo: "", descricao: "", ordem: "0", ativa: true, capa: "", capa_mini: "" }); }}>
          <h4 className="font-semibold">{serie.id ? "Editar série" : "Nova série"}</h4>
          <input value={serie.titulo} onChange={(e) => setSerie({ ...serie, titulo: e.target.value })} placeholder="Nome da série" aria-label="Nome da série" required minLength={2} maxLength={80} className="pn-campo" />
          <textarea value={serie.descricao} onChange={(e) => setSerie({ ...serie, descricao: e.target.value })} placeholder="Descrição" aria-label="Descrição" maxLength={600} rows={2} className="pn-campo" />
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              Ordem <input type="number" value={serie.ordem} onChange={(e) => setSerie({ ...serie, ordem: e.target.value })} className="pn-campo w-20" />
            </label>
            <Marca rotulo="aparece no site" checked={serie.ativa} onChange={(e) => setSerie({ ...serie, ativa: e.target.checked })} />
            <EnviarCapaSimples aoEnviar={(capa, mini) => setSerie((s) => ({ ...s, capa, capa_mini: mini }))} pasta="series" />
            {serie.capa && <Selo tom="ok" ponto>capa enviada</Selo>}
          </div>
          <Botao type="submit" variante="principal" carregando={acao.ocupado}>{serie.id ? "Guardar" : "Criar série"}</Botao>
        </form>
      </Cartao>

      {eu.coordenacao && (
        <Cartao
          titulo="Quem faz o quê no podcast"
          sobre="Quem tem a função de jornalismo faz produção e edição, se você não separar. Separando, a pessoa faz só o que estiver marcado. A supervisão aprova os episódios e pode ser dada a alguém de fora do jornalismo (da curadoria, por exemplo). Ninguém aprova o que enviou. Para dar a função de jornalismo, use Voluntários e convites."
        >
          <Aviso texto={acaoEquipe.aviso || equipe.erro} />
          {equipe.dados === null && !equipe.erro && <Esqueleto linhas={3} />}
          {(equipe.dados?.length ?? 0) > 0 && (
            <Lista rotulo="Quem faz o quê no podcast">
              {equipe.dados?.map((p) => {
                const efetivas = p.separadas ? p.funcoes : p.jornalismo ? ["producao", "edicao"] : [];
                return (
                  <ItemDeLista
                    key={p.id}
                    titulo={p.nome}
                    meta={p.separadas ? "tarefas separadas" : p.jornalismo ? "padrão do jornalismo" : undefined}
                    acoes={
                      <span className="flex flex-wrap items-center gap-3">
                        {(["producao", "edicao"] as const).map((f) => (
                          <Marca
                            key={f}
                            rotulo={f === "producao" ? "produção" : "edição"}
                            checked={efetivas.includes(f)}
                            onChange={(e) => acaoEquipe.agir("podcast_funcoes_definir", { p_usuario: p.id, p_funcoes: e.target.checked ? [...new Set([...efetivas, f])] : efetivas.filter((x) => x !== f) }, "Tarefas atualizadas.")}
                          />
                        ))}
                        {p.separadas && <Botao variante="discreto" pequeno onClick={() => acaoEquipe.agir("podcast_funcoes_definir", { p_usuario: p.id, p_funcoes: [] }, "Voltou ao padrão.")}>voltar ao padrão</Botao>}
                      </span>
                    }
                  />
                );
              })}
            </Lista>
          )}
        </Cartao>
      )}

      <Cartao titulo="Depósito">
        <p className="mt-2 flex items-start gap-2">
          <HardDrive aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" />
          <span>
            Áudio guardado de <strong>{a.guardados ?? 0}</strong> de <strong>{a.limite ?? config.guardados}</strong> episódios no ar · público {bytes(a.bytes_publicos ?? 0)} · produção {bytes(a.bytes_producao ?? 0)}
            {(a.liberar ?? 0) > 0 && ` · ${a.liberar} arquivo(s) esperando para sair`}
          </span>
        </p>
        {(a.proximos?.length ?? 0) > 0 && (
          <Faixa tom="aviso" className="mt-3" titulo="Saem do depósito quando o próximo episódio for publicado:">
            <ul className="mt-1 list-disc pl-5">
              {a.proximos!.map((p) => (
                <li key={p.id} className={p.externo ? "" : "text-oxblood"}>
                  {p.titulo} {p.externo ? "(tem cópia de fora: continua tocando)" : "(SEM cópia de fora: some do site e do feed; cadastre o link do Internet Archive antes)"}
                </li>
              ))}
            </ul>
          </Faixa>
        )}
        <p className="mt-3">
          <Botao onClick={() => void liberar()}>Liberar espaço agora</Botao>
        </p>
        <p role="status" className="text-oxblood">{liberando}</p>
      </Cartao>
    </div>
  );
}

/** Envia uma imagem como capa (recorta em quadrado, 3000 e 600) sem passar pelos modelos. */
export function EnviarCapaSimples({ aoEnviar, pasta, rotuloBotao = "Enviar uma capa pronta" }: { aoEnviar: (capa: string, mini: string) => void | Promise<void>; pasta: string; rotuloBotao?: string }) {
  const [andamento, setAndamento] = useState<number | null>(null);
  const [aviso, setAviso] = useState("");
  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setAviso("");
    setAndamento(0);
    try {
      const enviada = await enviarCapa(pasta, await prepararCapa(arquivo), setAndamento);
      await aoEnviar(enviada.capa, enviada.mini);
    } catch (erro) {
      setAviso(erro instanceof EnvioError ? (mensagensDeEnvio[erro.message] ?? "Não deu para usar esta imagem.") : textoDoErro(erro));
    } finally {
      setAndamento(null);
    }
  }
  return (
    <span className="inline-flex flex-col gap-1">
      <label className={`${botaoClaro} text-center ${FOCO_DO_ARQUIVO} ${andamento !== null ? "pointer-events-none opacity-50" : ""}`} aria-busy={andamento !== null || undefined}>
        <Upload aria-hidden />
        {andamento !== null ? `Enviando… ${Math.round(andamento * 100)}%` : rotuloBotao}
        <input type="file" accept="image/*" className="sr-only" disabled={andamento !== null} onChange={(e) => { void escolher(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {aviso && <span className="text-oxblood">{aviso}</span>}
    </span>
  );
}
