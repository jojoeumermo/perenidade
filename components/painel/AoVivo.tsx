// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { CalendarClock, ChevronRight, Copy, ExternalLink, Plus, Radio, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { textosDoAoVivo } from "@/i18n/escola/aovivo";
import { type Aula as AulaDoSite } from "@/lib/aovivo";
import { GALENE_URL, tipoNoSite } from "@/lib/aula-sala";
import { areaSlugs } from "@/lib/areas";
import { can, rpc, type Me } from "@/lib/backend";
import { linkDoYoutube, mensagemDoCanal, pedirAoCanal } from "@/lib/canal-youtube";
import { lerCadernoAula, podeMarcarNaEscola } from "@/lib/escola/aovivo";
import { CADERNOS_DA_ESCOLA, caminhoDaSalaAoVivo } from "@/lib/escola/contratos";
import { preencher } from "@/lib/escola/textos";
import { JITSI_DOMINIO, novaSalaJitsi } from "@/lib/jitsi";
import { useI18n } from "../I18n";
import { useTrackOptions } from "../useTrackOptions";
import { BuscaDePessoa, type PessoaAchada } from "./BuscaDePessoa";
import { Aviso, botao, botaoClaro, dataHora, localDoPainel, papeis, useAcao, useLista } from "./comum";
import type { Membro } from "./Equipe";
import { Area, Botao, CabecalhoDeSecao, Campo, Cartao, confirmarFrase, Esqueleto, Faixa, Lista, Selecao, Selo, Vazio } from "./ui";

/** "2026-10-20T19:00" no fuso do aparelho, para o campo de data e hora. */
const paraCampo = (iso: string) => {
  const d = new Date(iso);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`;
};
const daquiAUmaHora = () => {
  const d = new Date(Date.now() + 3600_000);
  d.setMinutes(0, 0, 0);
  return paraCampo(d.toISOString());
};
const hora = (iso: string) => new Date(iso).toLocaleTimeString(localDoPainel(), { hour: "2-digit", minute: "2-digit" });
const diaDe = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** "em 2 d 4 h", "em 35 min", "agora": quanto falta para a aula começar. */
function falta(iso: string, agora: number) {
  const minutos = Math.round((new Date(iso).getTime() - agora) / 60000);
  if (minutos <= 0) return "agora";
  if (minutos < 60) return `em ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `em ${horas} h ${minutos % 60 ? `${minutos % 60} min` : ""}`.trim();
  return `em ${Math.floor(horas / 24)} d ${horas % 24 ? `${horas % 24} h` : ""}`.trim();
}

/**
 * A aula como o banco devolve desde a Escola de Formação (supabase/migracoes/20261108-escola-aovivo.sql): "publico"
 * 'escola' é aula só de militantes (fora da agenda pública, YouTube não listado, bate-papo pelo codinome) e
 * "caderno_aula" a liga a uma aula de caderno. Banco antigo não manda os dois: é aula do site.
 */
type Aula = AulaDoSite & { publico?: "site" | "escola"; caderno_aula?: string | null };
const daEscola = (aula: Aula | null) => aula?.publico === "escola";

/** "Só para a Escola" aparece para quem a Escola reconhece como militante (ou coordenação); o banco confere de novo. */
function usePodeEscola() {
  const [pode, setPode] = useState(false);
  useEffect(() => {
    let vivo = true;
    void podeMarcarNaEscola().then((sim) => vivo && setPode(sim), () => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  return pode;
}

/** O limite honesto da aula da Escola, escrito na tela de quem marca e transmite (PLANO-ESCOLA.md, F3). */
function LimiteDaEscola({ t, comChat = false }: { t: ReturnType<typeof textosDoAoVivo>["painel"]; comChat?: boolean }) {
  return (
    <div role="note" className="rounded-[var(--pn-raio-cartao)] border-l-4 border-[#c21f16] bg-[var(--pn-superficie)] p-3 text-sm">
      <p className="font-semibold">{t.limiteTitulo}</p>
      <p className="mt-1">{t.limite}</p>
      <p className="mt-1">{t.camera}</p>
      {comChat && <p className="mt-1">{t.chatDoYoutube}</p>}
    </div>
  );
}

interface Form {
  titulo: string;
  descricao: string;
  disciplina: string;
  trilha: string;
  inicio: string;
  duracao: number;
  sala_externa: string;
  gravacao: string;
}

/**
 * Marcar aulas ao vivo, chamar colegas e abrir a sala, no jeito de uma sala de transmissão: o que está no ar em
 * destaque, a contagem para a próxima, a agenda por dia e o que já passou (com a gravação). A agenda pública mostra o
 * que for marcado aqui.
 */
export function AulasAoVivo({ me }: { me: Me }) {
  const { lang, t } = useI18n();
  const lista = useLista<Aula[]>("aulas_ao_vivo_minhas");
  const acao = useAcao(lista.recarregar);
  const [editando, setEditando] = useState<Aula | "nova" | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [passadasAbertas, setPassadasAbertas] = useState(false);
  const [transmitir, setTransmitir] = useState<string | null>(null);
  const nomeDaArea = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "");
  const te = textosDoAoVivo(lang).painel;
  // Aula da Escola tem a sala dentro da Escola (só militante entra); a do site, a sala de sempre.
  const aulaPorId = new Map((lista.dados ?? []).map((a) => [a.id, a as Aula]));
  const abrirSala = (id: string) => (daEscola(aulaPorId.get(id) ?? null) ? `/${lang}${caminhoDaSalaAoVivo(id)}` : `/${lang}/ao-vivo/sala?aula=${id}`);
  const seloEscola = (aula: Aula) => (daEscola(aula) ? <Selo tom="aviso">{te.selo}</Selo> : null);

  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(Date.now()), 30000);
    return () => window.clearInterval(relogio);
  }, []);

  const aulas = lista.dados ?? [];
  const noAr = aulas.filter((a) => a.status === "ao_vivo");
  const marcadas = aulas.filter((a) => a.status === "agendada").sort((a, b) => a.inicio.localeCompare(b.inicio));
  const proxima = marcadas[0];
  const passadas = aulas.filter((a) => a.status === "encerrada" || a.status === "cancelada").sort((a, b) => b.inicio.localeCompare(a.inicio));
  const porDia = marcadas.reduce<{ dia: string; aulas: Aula[] }[]>((grupos, aula) => {
    const chave = diaDe(aula.inicio);
    const grupo = grupos.find((g) => g.dia === chave);
    if (grupo) grupo.aulas.push(aula);
    else grupos.push({ dia: chave, aulas: [aula] });
    return grupos;
  }, []);
  const hoje = diaDe(new Date(agora).toISOString());
  const amanha = diaDe(new Date(agora + 86400000).toISOString());
  const nomeDoDia = (aula: Aula) => {
    const chave = diaDe(aula.inicio);
    if (chave === hoje) return "Hoje";
    if (chave === amanha) return "Amanhã";
    return new Date(aula.inicio).toLocaleDateString(localDoPainel(), { weekday: "long", day: "numeric", month: "long" });
  };
  const copiar = (aula: Aula) => void navigator.clipboard.writeText(`${window.location.origin}${abrirSala(aula.id)}`).then(() => acao.setAviso("Endereço da sala copiado."), () => acao.setAviso(`${window.location.origin}${abrirSala(aula.id)}`));
  const comecar = (aula: Aula) => void acao.agir("aula_ao_vivo_estado", { p_id: aula.id, p_status: "ao_vivo" }, "Aula começada: quem marcou presença foi avisado.");
  const encerrar = async (aula: Aula) => {
    if ((await confirmarFrase("Encerrar a aula?"))) void acao.agir("aula_ao_vivo_estado", { p_id: aula.id, p_status: "encerrada" }, "Aula encerrada. Se gravou, ponha o endereço da gravação.");
  };
  const cancelar = async (aula: Aula) => {
    if ((await confirmarFrase("Cancelar a aula? Quem marcou presença será avisado."))) void acao.agir("aula_ao_vivo_estado", { p_id: aula.id, p_status: "cancelada" }, "Aula cancelada.");
  };
  const apagar = async (aula: Aula) => {
    if ((await confirmarFrase("Apagar a aula e o bate-papo dela?"))) void acao.agir("aula_ao_vivo_apagar", { p_id: aula.id }, "Aula apagada.");
  };
  const quem = (aula: Aula) => `${aula.educador.nome}${aula.co_educadores.length ? ` com ${aula.co_educadores.map((c) => c.nome).join(", ")}` : ""}`;

  // O que está no ar fica numa faixa escura de estúdio (os tokens do menu em tinta, que valem nos dois temas).
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="pn-sobre mt-0!">
          O que você marcar aqui entra na hora na <a href={`/${lang}/ao-vivo`} target="_blank" rel="noopener noreferrer" className="pn-elo">agenda pública</a>. Na data, abra a sala e aperte “Começar a aula”: quem marcou presença recebe um recado.
        </p>
        <Botao variante="principal" simbolo={Plus} onClick={() => setEditando("nova")}>
          Marcar uma aula
        </Botao>
      </div>

      {lista.erro && <Faixa tom="erro" acao={<Botao pequeno onClick={lista.recarregar}>Tentar de novo</Botao>}>{lista.erro}</Faixa>}
      <Aviso texto={acao.aviso} />
      {lista.dados === null && !lista.erro && <Esqueleto forma="cartoes" />}

      {noAr.map((aula) => (
        <section key={aula.id} aria-label="No ar agora" className="pn-cartao relative overflow-hidden border-[var(--pn-menu-destaque)]! bg-[var(--pn-menu-fundo)]! p-6! text-[var(--pn-menu-texto)]">
          <span aria-hidden className="absolute inset-x-0 top-0 block h-[3px]" style={{ background: "var(--pn-lutas)" }} />
          <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.25em] text-[var(--pn-menu-destaque)]">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--pn-menu-destaque)] opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--pn-menu-destaque)]" />
            </span>
            Ao vivo agora
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight [text-wrap:balance]">{aula.titulo}</h2>
          {daEscola(aula) && <p className="mt-1 text-sm font-semibold text-[var(--pn-menu-destaque)]">{te.selo} · {te.naAgenda}</p>}
          <p className="mt-1 text-sm text-[var(--pn-menu-texto-suave)]">
            {nomeDaArea(aula.disciplina)} · {quem(aula)} · desde {hora(aula.iniciada_em ?? aula.inicio)}
          </p>
          <dl className="mt-4 flex flex-wrap gap-6 text-sm">
            <div>
              <dt className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[var(--pn-menu-rotulo)]">Marcaram presença</dt>
              <dd className="font-serif text-2xl font-semibold">{aula.inscritos}</dd>
            </div>
            {typeof aula.mensagens === "number" && (
              <div>
                <dt className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[var(--pn-menu-rotulo)]">Mensagens no bate-papo</dt>
                <dd className="font-serif text-2xl font-semibold">{aula.mensagens}</dd>
              </div>
            )}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={abrirSala(aula.id)} target="_blank" rel="noopener noreferrer" className={botao}>Entrar na sala <ExternalLink aria-hidden /></a>
            <Botao simbolo={Copy} onClick={() => copiar(aula)}>Copiar o endereço</Botao>
            <Botao variante="discreto" simbolo={Square} className="text-[var(--pn-menu-texto)]! hover:bg-[var(--pn-menu-superficie)]!" disabled={acao.ocupado} onClick={() => encerrar(aula)}>Encerrar a aula</Botao>
          </div>
          <TransmitirNoYoutube aula={aula} escuro />
        </section>
      ))}

      {proxima && noAr.length === 0 && (
        <Cartao variante="destaque" aria-label="Próxima aula" className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
          <div className="rounded-[var(--pn-raio-cartao)] bg-[var(--pn-menu-fundo)] px-5 py-4 text-center text-[var(--pn-menu-texto)]">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-[var(--pn-menu-rotulo)]">Próxima aula</p>
            <p className="mt-1 font-serif text-2xl font-semibold">{falta(proxima.inicio, agora)}</p>
          </div>
          <div className="min-w-0">
            <p className="pn-rotulo-mono">{nomeDoDia(proxima)} · {hora(proxima.inicio)} · {proxima.duracao} min · {nomeDaArea(proxima.disciplina)}</p>
            <h2 className="font-serif text-2xl font-semibold leading-snug">{proxima.titulo} {seloEscola(proxima)}</h2>
            <p className="text-sm text-ink-soft">{quem(proxima)} · {proxima.inscritos} {proxima.inscritos === 1 ? "pessoa marcou presença" : "pessoas marcaram presença"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={abrirSala(proxima.id)} target="_blank" rel="noopener noreferrer" className={`${botaoClaro} pn-botao-pequeno`}>Abrir a sala <ExternalLink aria-hidden /></a>
              <Botao variante="principal" pequeno simbolo={Radio} disabled={acao.ocupado} onClick={() => comecar(proxima)}>Começar agora</Botao>
            </div>
            <TransmitirNoYoutube aula={proxima} />
          </div>
        </Cartao>
      )}

      {lista.dados && aulas.length === 0 && (
        <Vazio
          simbolo={Radio}
          titulo="Nenhuma aula marcada"
          texto="Uma aula ao vivo junta a turma na mesma hora: vídeo, tela compartilhada, bate-papo e perguntas. Dá para chamar colegas para dar junto."
          acao={<Botao variante="principal" simbolo={Plus} onClick={() => setEditando("nova")}>Marcar a primeira</Botao>}
        />
      )}

      {porDia.length > 0 && (
        <section aria-labelledby="agenda-titulo" className="space-y-3">
          <CabecalhoDeSecao nivel={2} id="agenda-titulo" titulo="Agenda" simbolo={CalendarClock} />
          <div className="space-y-5">
            {porDia.map((grupo) => (
              <div key={grupo.dia} className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <p className="font-serif text-lg font-semibold first-letter:uppercase sm:pt-3">{nomeDoDia(grupo.aulas[0])}</p>
                <Lista rotulo={nomeDoDia(grupo.aulas[0])}>
                  {grupo.aulas.map((aula) => (
                    <li key={aula.id} className="flex gap-3 border-b border-[var(--pn-borda)] p-3 last:border-b-0">
                      <div className="w-16 shrink-0 border-r border-[var(--pn-borda)] pr-3 text-right">
                        <p className="font-mono text-sm font-semibold">{hora(aula.inicio)}</p>
                        <p className="text-xs text-ink-soft">{aula.duracao} min</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-ink-soft">{nomeDaArea(aula.disciplina)}{aula.sala_externa ? ` · sala ${{ propria: "do instituto", peertube: "PeerTube", meet: "no Google Meet", youtube: "no YouTube", jitsi: "no Jitsi", outro: aula.sala_externa.includes(JITSI_DOMINIO) ? "no Jitsi" : "em outro site", nenhum: "" }[tipoNoSite(aula.sala_externa)]}` : ""}</p>
                        <p className="font-semibold leading-snug">{aula.titulo} {seloEscola(aula)}</p>
                        <p className="text-xs text-ink-soft">{quem(aula)} · {aula.inscritos} {aula.inscritos === 1 ? "presença" : "presenças"}</p>
                        <p className="mt-2 flex flex-wrap gap-1">
                          <a href={abrirSala(aula.id)} target="_blank" rel="noopener noreferrer" className="pn-botao pn-botao-discreto pn-botao-pequeno">Abrir a sala <ExternalLink aria-hidden /></a>
                          <Botao variante="discreto" pequeno onClick={() => setEditando(aula)}>Alterar</Botao>
                          <Botao variante="discreto" pequeno disabled={acao.ocupado} onClick={() => comecar(aula)}>Começar agora</Botao>
                          <Botao variante="discreto" pequeno onClick={() => copiar(aula)}>Copiar o endereço</Botao>
                          {aula.id !== proxima?.id && (
                            <Botao variante="discreto" pequeno aria-expanded={transmitir === aula.id} onClick={() => setTransmitir(transmitir === aula.id ? null : aula.id)}>Transmitir pelo YouTube</Botao>
                          )}
                          <Botao variante="discreto" pequeno disabled={acao.ocupado} onClick={() => cancelar(aula)}>Cancelar</Botao>
                          {can(me, "coordenacao") && <Botao variante="discreto" pequeno perigo disabled={acao.ocupado} onClick={() => apagar(aula)}>Apagar</Botao>}
                        </p>
                        {transmitir === aula.id && <TransmitirNoYoutube aula={aula} aberto />}
                      </div>
                    </li>
                  ))}
                </Lista>
              </div>
            ))}
          </div>
        </section>
      )}

      {passadas.length > 0 && (
        <section aria-labelledby="passadas-titulo" className="border-t border-[var(--pn-borda)] pt-5">
          <button type="button" id="passadas-titulo" className="flex cursor-pointer items-center gap-2 rounded-[var(--pn-raio)] font-semibold focus-visible:outline-2 focus-visible:outline-[var(--pn-foco)]" aria-expanded={passadasAbertas} onClick={() => setPassadasAbertas(!passadasAbertas)}>
            <ChevronRight aria-hidden className={`h-4 w-4 motion-safe:transition-transform ${passadasAbertas ? "rotate-90" : ""}`} />
            Já aconteceram ({passadas.length})
            {passadas.some((a) => a.status === "encerrada" && !a.gravacao) && <Selo tom="aviso">{passadas.filter((a) => a.status === "encerrada" && !a.gravacao).length} sem gravação</Selo>}
          </button>
          {passadasAbertas && (
            <Lista rotulo={`Já aconteceram (${passadas.length})`} className="mt-3!">
              {passadas.map((aula) => (
                <li key={aula.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--pn-borda)] px-3.5 py-3 text-sm last:border-b-0">
                  <span className="w-28 shrink-0 font-mono text-xs text-ink-soft">{dataHora(aula.inicio)}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`font-semibold ${aula.status === "cancelada" ? "line-through opacity-60" : ""}`}>{aula.titulo}</span> {seloEscola(aula)}{" "}
                    {aula.status === "cancelada" ? <Selo>cancelada</Selo> : <span className="text-ink-soft">· {`${aula.inscritos} ${aula.inscritos === 1 ? "presença" : "presenças"}`}</span>}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {aula.status === "encerrada" && (aula.gravacao ? <a href={aula.gravacao} target="_blank" rel="noopener noreferrer" className="pn-botao pn-botao-discreto pn-botao-pequeno">Gravação <ExternalLink aria-hidden /></a> : <Botao variante="discreto" pequeno onClick={() => setEditando(aula)}>Pôr a gravação</Botao>)}
                    {(aula.status === "cancelada" || can(me, "coordenacao")) && <Botao variante="discreto" pequeno perigo disabled={acao.ocupado} onClick={() => apagar(aula)}>Apagar</Botao>}
                  </span>
                </li>
              ))}
            </Lista>
          )}
        </section>
      )}

      {editando && <Marcar me={me} aula={editando === "nova" ? null : editando} fechar={() => setEditando(null)} depois={lista.recarregar} />}
    </div>
  );
}

/**
 * A transmissão pelo canal do instituto no YouTube, para turmas grandes: quem conduz pede a chave desta aula e
 * transmite pelo OBS (computador) ou pelo Larix Broadcaster (celular). Ninguém recebe a senha nem o acesso ao canal: a
 * chave só serve para esta aula. A transmissão começa sozinha quando o programa manda imagem e termina quando ele para.
 */
function TransmitirNoYoutube({ aula, escuro = false, aberto = false }: { aula: Aula; escuro?: boolean; aberto?: boolean }) {
  const { lang } = useI18n();
  const [dados, setDados] = useState<{ rtmp: string; chave: string; youtube: string } | null>(null);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [verChave, setVerChave] = useState(false);
  useEffect(() => {
    if (!aula.youtube) return;
    let vivo = true;
    rpc<{ rtmp: string; chave: string; youtube: string } | null>("youtube_transmissao_ver", { p_aula: aula.id })
      .then((r) => vivo && r && setDados(r))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [aula.id, aula.youtube]);

  async function gerar() {
    setOcupado(true);
    setAviso("");
    const r = await pedirAoCanal({ acao: "transmissao", aula: aula.id });
    setOcupado(false);
    if (r.erro || !r.rtmp || !r.chave || !r.youtube) return setAviso(mensagemDoCanal(r.erro ?? "servico"));
    setDados({ rtmp: r.rtmp, chave: r.chave, youtube: r.youtube });
    setAviso("Transmissão criada no canal do instituto. Ponha o servidor e a chave no programa de transmissão.");
  }
  async function encerrarNoYoutube() {
    if (!(await confirmarFrase("Encerrar a transmissão no YouTube? Ela normalmente termina sozinha quando o programa para de transmitir."))) return;
    setOcupado(true);
    const r = await pedirAoCanal({ acao: "encerrar", aula: aula.id });
    setOcupado(false);
    setAviso(r.erro ? mensagemDoCanal(r.erro) : "Transmissão encerrada no YouTube. A gravação fica no canal e entra na aula quando você a encerrar aqui.");
  }
  const copiar = (texto: string, oQue: string) => void navigator.clipboard?.writeText(texto).then(() => setAviso(`${oQue} copiado.`), () => setAviso(texto));

  // Na faixa escura do "ao vivo", o quadro usa os tokens do menu em tinta; fora dela, os da área de trabalho.
  const caixa = escuro ? "mt-5 rounded-[var(--pn-raio-cartao)] border border-[var(--pn-menu-borda)] bg-[var(--pn-menu-superficie)] p-4 text-sm text-[var(--pn-menu-texto)]" : "mt-4 rounded-[var(--pn-raio-cartao)] border border-[var(--pn-borda)] bg-[var(--pn-fundo)] p-4 text-sm";
  const fraco = escuro ? "text-[var(--pn-menu-texto-suave)]" : "text-ink-soft";
  const campoFixo = `min-w-0 flex-1 truncate rounded-[var(--pn-raio)] border px-2 py-1 font-mono text-xs ${escuro ? "border-[var(--pn-menu-borda)] bg-[var(--pn-menu-fundo)]" : "border-[var(--pn-borda)] bg-[var(--pn-superficie)]"}`;
  const eloAqui = escuro ? "cursor-pointer rounded-[var(--pn-raio)] text-[var(--pn-menu-texto)] underline underline-offset-2 hover:text-[var(--pn-menu-destaque)] focus-visible:outline-2 focus-visible:outline-[var(--pn-menu-destaque)] disabled:opacity-50" : "pn-elo";
  return (
    <details className={caixa} open={aberto || Boolean(dados)}>
      <summary className="cursor-pointer rounded-[var(--pn-raio)] font-semibold">Transmitir pelo YouTube do instituto</summary>
      <p className={`mt-2 ${fraco}`}>
        Para turmas grandes: a aula passa no canal do instituto (não listada) e aqui no site, com o bate-papo do site. Use o OBS no computador ou o
        Larix Broadcaster no celular. A chave vale só para esta aula; ninguém recebe a senha do canal.
      </p>
      {daEscola(aula) && (
        <div className={`mt-3 ${escuro ? "text-ink" : ""}`}>
          <LimiteDaEscola t={textosDoAoVivo(lang).painel} comChat />
        </div>
      )}
      {!dados ? (
        <Botao variante="principal" className="mt-3" carregando={ocupado} onClick={() => void gerar()}>
          {ocupado ? "Criando a transmissão…" : "Criar a transmissão e a chave desta aula"}
        </Botao>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-semibold">Servidor</span>
            <code className={campoFixo}>{dados.rtmp}</code>
            <button type="button" className={eloAqui} onClick={() => copiar(dados.rtmp, "Servidor")}>Copiar</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-semibold">Chave</span>
            <code className={campoFixo}>{verChave ? dados.chave : "•".repeat(Math.min(24, dados.chave.length))}</code>
            <button type="button" className={eloAqui} aria-pressed={verChave} onClick={() => setVerChave(!verChave)}>{verChave ? "Esconder" : "Mostrar"}</button>
            <button type="button" className={eloAqui} onClick={() => copiar(dados.chave, "Chave")}>Copiar</button>
          </div>
          <p className={`text-xs ${fraco}`}>
            No OBS: Configurações › Transmissão › Serviço “Personalizado”, cole o servidor e a chave. No Larix: Configurações › Conexões › nova, cole
            “servidor/chave” no endereço. Não mande a chave para ninguém: quem tem a chave transmite no canal do instituto.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <a href={linkDoYoutube(dados.youtube)} target="_blank" rel="noopener noreferrer" className={`${eloAqui} inline-flex items-center gap-1`}>Ver a transmissão no YouTube <ExternalLink aria-hidden className="h-3.5 w-3.5" /></a>
            <button type="button" className={eloAqui} disabled={ocupado} onClick={() => void encerrarNoYoutube()}>Encerrar no YouTube</button>
          </p>
        </div>
      )}
      {aviso && <p role="status" className={`mt-2 ${escuro ? "text-[var(--pn-menu-ouro)]" : "text-oxblood"}`}>{aviso}</p>}
    </details>
  );
}

/** Marcar ou alterar uma aula, numa gaveta lateral, com a prévia de como ela aparece na agenda pública. */
function Marcar({ me, aula, fechar, depois }: { me: Me; aula: Aula | null; fechar: () => void; depois: () => void }) {
  const { lang, t } = useI18n();
  const tracks = useTrackOptions(lang);
  const membros = useLista<Membro[]>("equipe_membros", {}, { quieta: true });
  const acao = useAcao(depois);
  const minhasDisciplinas = [...new Set(me.papeis.filter((p) => p.papel === "educacao" || p.papel === "educacao_secundaria").map((p) => p.disciplina).filter(Boolean))] as string[];
  const disciplinas = can(me, "coordenacao") || minhasDisciplinas.length === 0 ? [...areaSlugs] : minhasDisciplinas;
  const [form, setForm] = useState<Form>(() =>
    aula
      ? { titulo: aula.titulo, descricao: aula.descricao, disciplina: aula.disciplina, trilha: aula.trilha ?? "", inicio: paraCampo(aula.inicio), duracao: aula.duracao, sala_externa: aula.sala_externa, gravacao: aula.gravacao }
      : { titulo: "", descricao: "", disciplina: disciplinas[0] ?? "", trilha: "", inicio: daquiAUmaHora(), duracao: 60, sala_externa: "", gravacao: "" },
  );
  const [colegas, setColegas] = useState<PessoaAchada[]>(() => (aula ? aula.co_educadores.map((c) => ({ id: c.id, nome: c.nome, email: "" })) : []));
  // Aula "só para a Escola": o público nasce com a aula e não muda depois (o banco ignora a troca).
  const te = textosDoAoVivo(lang).painel;
  const podeEscola = usePodeEscola();
  const [escola, setEscola] = useState(() => daEscola(aula));
  const ligadaAntes = lerCadernoAula(aula?.caderno_aula);
  const [caderno, setCaderno] = useState(ligadaAntes?.caderno.slug ?? "");
  const [pedaco, setPedaco] = useState(ligadaAntes?.pedaco ?? "");
  const cadernoEscolhido = CADERNOS_DA_ESCOLA.find((c) => c.slug === caderno) ?? null;
  const trilhaDoCaderno = cadernoEscolhido?.fonte.tipo === "trilha" ? tracks.find((x) => x.slug === (cadernoEscolhido.fonte as { trilha: string }).trilha) : undefined;
  const aulasDoCaderno = trilhaDoCaderno?.lessons ?? [];
  const nomeDaArea = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "");
  const ensina = (m: Membro) => m.papeis.some((p) => ["educacao", "educacao_secundaria", "mentoria", "coordenacao", "vice"].includes(p.papel));
  const funcoes = (m: Membro) => [...new Set(m.papeis.map((p) => `${papeis[p.papel]}${p.disciplina ? ` de ${nomeDaArea(p.disciplina)}` : ""}`))].join(", ");
  const candidatos = (membros.dados ?? []).filter((m) => !m.eu && ensina(m) && !colegas.some((c) => c.id === m.id)).map((m) => ({ id: m.id, nome: m.nome, email: funcoes(m) }));
  const mudar = <K extends keyof Form>(chave: K, valor: Form[K]) => setForm((f) => ({ ...f, [chave]: valor }));
  const trilhas = tracks.filter((x) => x.area === form.disciplina);
  const passou = aula && (aula.status === "encerrada" || aula.status === "cancelada");
  const inicio = new Date(form.inicio);
  const salaPropria = tipoNoSite(form.sala_externa) === "propria";

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [fechar]);

  async function guardar() {
    if (Number.isNaN(inicio.getTime())) return acao.setAviso("Confira a data e a hora.");
    const ok = await acao.agir(
      "aula_ao_vivo_salvar",
      {
        p_id: aula?.id ?? null,
        p: {
          ...form,
          inicio: inicio.toISOString(),
          trilha: form.trilha || null,
          co_educadores: colegas.map((c) => c.id),
          publico: escola ? "escola" : "site",
          ...(escola ? { caderno_aula: caderno && pedaco.trim() ? `${caderno}/${pedaco.trim()}` : null, sala_externa: "" } : {}),
        },
      },
      aula ? "Aula alterada." : escola ? te.naAgenda : "Aula marcada: já aparece na agenda pública. Os colegas chamados receberam o recado.",
    );
    if (ok) fechar();
  }

  // No body: a área de conteúdo do painel tem transform (da animação de entrada), que prenderia o "fixed" dentro dela.
  // "pn-portal" leva para cá a fonte e as cores do painel, que fora dele não valeriam.
  const opcaoDeSala = (escolhida: boolean) => `cursor-pointer rounded-[var(--pn-raio-cartao)] border p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pn-foco)] ${escolhida ? "border-[var(--pn-destaque-vivo)] bg-[var(--pn-destaque-suave)] shadow-[inset_0_0_0_1px_var(--pn-destaque-vivo)]" : "border-[var(--pn-borda)] bg-[var(--pn-superficie)] hover:border-[var(--pn-borda-forte)]"}`;
  return createPortal(
    <div className="pn-portal fixed inset-0 z-[90] flex justify-end bg-[var(--pn-veu)]" onPointerDown={(e) => e.target === e.currentTarget && fechar()}>
      <aside role="dialog" aria-modal="true" aria-label={aula ? "Alterar a aula" : "Marcar uma aula"} className="flex h-full w-full max-w-2xl flex-col border-l border-[var(--pn-borda)] bg-[var(--pn-fundo)] text-ink shadow-[var(--pn-sombra-flutuante)]">
        <span aria-hidden className="block h-[3px] shrink-0" style={{ background: "var(--pn-lutas)" }} />
        <div className="flex items-center justify-between gap-3 border-b border-[var(--pn-borda)] bg-[var(--pn-superficie)] px-5 py-3">
          <h2 className="font-serif text-xl font-semibold">{passou ? "Depois da aula" : aula ? "Alterar a aula" : "Marcar uma aula"}</h2>
          <Botao icone variante="discreto" simbolo={X} onClick={fechar} aria-label="Fechar" />
        </div>
        <form className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5" onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
          {podeEscola && !aula && (
            <label className="pn-cartao flex cursor-pointer items-start gap-3">
              <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#c21f16]" checked={escola} onChange={(e) => setEscola(e.target.checked)} />
              <span>
                <span className="block font-semibold">{te.caixa}</span>
                <span className="block text-sm text-ink-soft">{te.caixaAjuda}</span>
              </span>
            </label>
          )}

          {escola && (
            <fieldset className="pn-cartao space-y-3">
              <legend className="px-1 font-semibold">{te.selo}</legend>
              <p className="text-sm">{te.naAgenda}</p>
              <LimiteDaEscola t={te} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Selecao rotulo={te.caderno} value={caderno} onChange={(e) => { setCaderno(e.target.value); setPedaco(""); }}>
                  <option value="">{te.soCaderno}</option>
                  {CADERNOS_DA_ESCOLA.map((c) => (
                    <option key={c.slug} value={c.slug}>{`${String(c.numero).padStart(2, "0")} · ${tracks.find((x) => c.fonte.tipo === "trilha" && x.slug === c.fonte.trilha)?.title ?? c.slug}`}</option>
                  ))}
                </Selecao>
                {cadernoEscolhido && aulasDoCaderno.length > 0 ? (
                  <Selecao rotulo={te.aula} value={pedaco} onChange={(e) => setPedaco(e.target.value)}>
                    <option value="">{te.soCaderno}</option>
                    {aulasDoCaderno.map((l) => (
                      <option key={l.slug} value={l.slug}>{l.title}</option>
                    ))}
                  </Selecao>
                ) : cadernoEscolhido ? (
                  <Campo rotulo={te.aulaLivre} ajuda={preencher(te.aulaLivreAjuda, { caderno: cadernoEscolhido.slug })} value={pedaco} onChange={(e) => setPedaco(e.target.value.toLowerCase())} pattern="[a-z0-9-]{2,120}" maxLength={120} className="font-mono text-sm" />
                ) : null}
              </div>
              {caderno && pedaco && <p className="text-xs text-ink-soft">{preencher(te.ligada, { codigo: `${caderno}/${pedaco}` })} · {te.gravacaoNaAula}</p>}
            </fieldset>
          )}

          {!escola && <Cartao as="div" variante="plano" aria-label="Como aparece na agenda pública">
            <p className="pn-rotulo-mono">Como aparece na agenda pública</p>
            <div className="mt-2 flex gap-3">
              <div className="w-14 shrink-0 rounded-[var(--pn-raio)] bg-[var(--pn-menu-fundo)] py-2 text-center text-[var(--pn-menu-texto)]">
                <p className="text-[0.6rem] uppercase text-[var(--pn-menu-destaque)]">{Number.isNaN(inicio.getTime()) ? "—" : inicio.toLocaleDateString(localDoPainel(), { month: "short" })}</p>
                <p className="font-serif text-xl font-semibold leading-none">{Number.isNaN(inicio.getTime()) ? "" : inicio.getDate()}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-ink-soft">{nomeDaArea(form.disciplina)} · {Number.isNaN(inicio.getTime()) ? "" : hora(inicio.toISOString())} · {form.duracao} min</p>
                <p className="font-serif text-lg font-semibold leading-snug">{form.titulo || "Título da aula"}</p>
                {form.descricao && <p className="line-clamp-2 text-sm text-ink-soft">{form.descricao}</p>}
              </div>
            </div>
          </Cartao>}

          {!passou && (
            <>
              <Campo rotulo="Título" value={form.titulo} onChange={(e) => mudar("titulo", e.target.value)} maxLength={140} required />
              <Area rotulo="Sobre a aula" ajuda="O que vai ser visto, para quem é, o que levar." value={form.descricao} onChange={(e) => mudar("descricao", e.target.value)} rows={3} maxLength={2000} />
              <div className="grid gap-3 sm:grid-cols-2">
                {!escola && (
                  <>
                    <Selecao rotulo="Disciplina" value={form.disciplina} onChange={(e) => { mudar("disciplina", e.target.value); mudar("trilha", ""); }}>
                      {disciplinas.map((area) => (
                        <option key={area} value={area}>{nomeDaArea(area)}</option>
                      ))}
                    </Selecao>
                    <Selecao rotulo="Trilha (opcional)" value={form.trilha} onChange={(e) => mudar("trilha", e.target.value)}>
                      <option value="">Nenhuma</option>
                      {trilhas.map((x) => (
                        <option key={x.slug} value={x.slug}>{x.title}</option>
                      ))}
                    </Selecao>
                  </>
                )}
                <Campo rotulo="Data e hora" type="datetime-local" value={form.inicio} onChange={(e) => mudar("inicio", e.target.value)} required />
                <div>
                  <p className="pn-rotulo">Duração</p>
                  <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Duração">
                    {[30, 45, 60, 90, 120].map((min) => (
                      <Botao key={min} pequeno variante={form.duracao === min ? "principal" : "padrao"} aria-pressed={form.duracao === min} onClick={() => mudar("duracao", min)}>
                        {min < 60 ? `${min} min` : `${min / 60} h${min % 60 ? " 30" : ""}`}
                      </Botao>
                    ))}
                  </div>
                </div>
              </div>

              <fieldset className="pn-cartao">
                <legend className="px-1 font-semibold">Dar a aula junto com (opcional)</legend>
                <p className="text-sm text-ink-soft">Quem for chamado recebe o recado na hora e também conduz a sala. Até oito.</p>
                {colegas.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {colegas.map((pessoa) => (
                      <li key={pessoa.id} className="flex items-center gap-1 rounded-[var(--pn-raio-selo)] border border-[var(--pn-borda-forte)] bg-[var(--pn-ativo)] py-0.5 pl-3 pr-1 text-sm">
                        <strong>{pessoa.nome}</strong>
                        <Botao icone pequeno variante="discreto" simbolo={X} aria-label={`Tirar ${pessoa.nome}`} onClick={() => setColegas(colegas.filter((c) => c.id !== pessoa.id))} />
                      </li>
                    ))}
                  </ul>
                )}
                {colegas.length < 8 && (
                  <div className="mt-2 max-w-md">
                    <BuscaDePessoa rotulo="Chamar colega" entre={candidatos} escolhida={null} escolher={(pessoa) => pessoa && setColegas([...colegas, pessoa])} />
                  </div>
                )}
              </fieldset>

              {!escola && <div>
                <p className="pn-rotulo">Sala de vídeo</p>
                <div className={`mt-2 grid gap-2 ${GALENE_URL ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                  <button type="button" aria-pressed={!form.sala_externa} onClick={() => mudar("sala_externa", "")} className={opcaoDeSala(!form.sala_externa)}>
                    <span className="block text-sm font-semibold">Sala do site</span>
                    <span className="block text-xs text-ink-soft">O vídeo vai direto do seu navegador para cada pessoa. Boa para turma pequena.</span>
                  </button>
                  {GALENE_URL && (
                    <button type="button" aria-pressed={salaPropria} onClick={() => mudar("sala_externa", `${GALENE_URL}/`)} className={opcaoDeSala(salaPropria)}>
                      <span className="block text-sm font-semibold">Sala do instituto (aula com gravação)</span>
                      <span className="block text-xs text-ink-soft">Turma de até uns 50, chat, tela compartilhada e gravação. Você entra como professor pela página da aula.</span>
                    </button>
                  )}
                  <button type="button" aria-pressed={Boolean(form.sala_externa) && !salaPropria} onClick={() => (!form.sala_externa || salaPropria) && mudar("sala_externa", novaSalaJitsi())} className={opcaoDeSala(Boolean(form.sala_externa) && !salaPropria)}>
                    <span className="block text-sm font-semibold">Sala no Jitsi</span>
                    <span className="block text-xs text-ink-soft">Recomendada para turma grande. Abre dentro da página da aula, com nome sorteado.</span>
                  </button>
                </div>
                {form.sala_externa && !salaPropria && (
                  <div className="mt-2">
                    <Campo
                      rotulo="Endereço da sala"
                      ajuda={`A sala em ${JITSI_DOMINIO} abre dentro da página. Reunião interna: cole o link do Google Meet (abre fora do site). Transmissão no PeerTube do instituto: cole o link do vídeo (abre dentro da página, só depois do clique de quem assiste).`}
                      value={form.sala_externa}
                      onChange={(e) => mudar("sala_externa", e.target.value)}
                      placeholder="https://"
                      maxLength={500}
                      className="font-mono text-sm"
                    />
                  </div>
                )}
              </div>}
            </>
          )}

          {aula && aula.status !== "agendada" && (
            <Campo
              rotulo="Gravação"
              ajuda="O endereço do vídeo, depois da aula (opcional). Link do PeerTube do instituto ou do YouTube toca dentro da página, só depois do clique. Aparece na agenda para quem não pôde vir."
              value={form.gravacao}
              onChange={(e) => mudar("gravacao", e.target.value)}
              placeholder="https://… ou /pt/videoaulas…"
              maxLength={500}
              className="font-mono text-sm"
            />
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--pn-borda)] pt-4">
            <Botao type="submit" variante="principal" carregando={acao.ocupado} disabled={acao.ocupado || form.titulo.trim().length < 3}>{aula ? "Guardar" : "Marcar a aula"}</Botao>
            <Botao variante="discreto" onClick={fechar}>Cancelar</Botao>
          </div>
          <Aviso texto={acao.aviso || membros.erro} />
        </form>
      </aside>
    </div>,
    document.body,
  );
}
