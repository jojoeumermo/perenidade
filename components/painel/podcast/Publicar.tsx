// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { rpc } from "@/lib/backend";
import { PENDENCIAS_DO_EPISODIO } from "@/lib/podcast";
import { analisarAudio, EnvioError, enviarComProgresso, extensaoDe, liberarEspaco, LIMITE_BYTES, mensagensDeEnvio, nomeSorteado, tipoDe } from "@/lib/podcast-audio";
import { Aviso, botao, botaoClaro, campo, elo, rotulo, textoDoErro, useLista } from "../comum";
import { type EpisodioCompleto, NOME_DA_ETAPA, type PainelDoPodcast } from "./tipos";

/** Cada passo do caminho até o site: o que é, como se faz e em que aba do episódio fica. */
const PASSOS: { id: string; nome: string; faz: string; aba: string; itens: string[] }[] = [
  { id: "episodio", nome: "Criar o episódio e escrever a pauta", faz: "Título, resumo (aparece nas listas e no feed), tema, disciplina e, se houver, a série e o número.", aba: "pauta", itens: ["resumo"] },
  { id: "roteiro", nome: "Roteiro e gravação", faz: "Use o gabarito do programa e grave. A gravação não é obrigatória no site: só o áudio final conta.", aba: "roteiro", itens: [] },
  { id: "audio", nome: "Enviar o áudio final", faz: "Aba Arquivos → tipo “Final (vai ao ar)” → escolher o MP3 (até 50 MB, 96 a 128 kbps). O painel mede o volume e marca o arquivo como o áudio do episódio. Ou cole um link de fora (Internet Archive) na aba Publicação.", aba: "arquivos", itens: ["audio", "duracao", "volume", "ruido"] },
  { id: "capa", nome: "Capa, notas e transcrição", faz: "Aba Publicação: a capa (gere uma no estúdio ou envie), as notas com fontes e capítulos, a transcrição (botão Transcrever, ou importe o .vtt).", aba: "publicacao", itens: ["capa", "notas", "transcricao", "fontes", "trilhas", "convidados"] },
  { id: "aprovacao", nome: "Enviar para a supervisão aprovar", faz: "Botão “Enviar para aprovação”, no alto do episódio. A supervisão (ou a coordenação) aprova ou devolve com pedido de ajuste. Quem enviou não aprova o próprio episódio.", aba: "revisao", itens: ["aprovacao"] },
  { id: "publicar", nome: "Publicar", faz: "Aprovado e com a lista completa, o botão “Publicar” aparece no alto do episódio. Em até cinco minutos ele está no site (institutolucia.org/podcasts) e no feed RSS, que as plataformas leem sozinhas.", aba: "publicacao", itens: [] },
];

/**
 * O caminho de um episódio até o site, passo a passo, com o que já está feito marcado e um botão para cada passo.
 * É a resposta à dúvida mais comum de quem chega ao podcast: "como eu faço para publicar?".
 */
export function Publicar({ painel, abrir, recarregarPainel }: { painel: PainelDoPodcast; abrir: (id: string, passo?: string) => void; recarregarPainel: () => void }) {
  const [escolhido, setEscolhido] = useState<string>(painel.episodios.find((e) => e.status !== "publicado")?.id ?? "");
  const [titulo, setTitulo] = useState("");
  const [aviso, setAviso] = useState("");
  const { eu } = painel;
  const podeProduzir = eu.producao || eu.supervisao || eu.coordenacao;

  async function criar() {
    try {
      const r = await rpc<{ id: string }>("podcast_salvar", { p_id: null, p: { titulo } });
      setTitulo("");
      setEscolhido(r.id);
      recarregarPainel();
      setAviso("Episódio criado. Agora siga os passos abaixo.");
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <p className="text-ink-soft">
        Do título ao site, em seis passos. Escolha um episódio (ou crie um) e veja o que já está feito e o que falta. Cada passo tem um botão que abre a aba certa do episódio.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          Episódio
          <select value={escolhido} onChange={(ev) => setEscolhido(ev.target.value)} className={campo}>
            <option value="">Escolha…</option>
            {painel.episodios.map((x) => (
              <option key={x.id} value={x.id}>{x.titulo} · {NOME_DA_ETAPA[x.status]}</option>
            ))}
          </select>
        </label>
        {podeProduzir && (
          <form className="flex items-end gap-2" onSubmit={(ev) => { ev.preventDefault(); void criar(); }}>
            <label className="block flex-1">
              Ou crie um novo
              <input value={titulo} onChange={(ev) => setTitulo(ev.target.value)} placeholder="Título provisório" minLength={3} maxLength={140} className={campo} />
            </label>
            <button type="submit" className={botaoClaro} disabled={titulo.trim().length < 3}>Criar</button>
          </form>
        )}
      </div>
      <Aviso texto={aviso} />
      {escolhido ? <Passos key={escolhido} id={escolhido} painel={painel} abrir={abrir} recarregarPainel={recarregarPainel} /> : painel.episodios.length === 0 && <p className="text-ink-soft">Nenhum episódio ainda. Crie o primeiro acima.</p>}
    </div>
  );
}

/** Os seis passos de um episódio escolhido, com o que já está feito e os botões de cada etapa. */
function Passos({ id, painel, abrir, recarregarPainel }: { id: string; painel: PainelDoPodcast; abrir: (id: string, passo?: string) => void; recarregarPainel: () => void }) {
  const [aviso, setAviso] = useState("");
  const [andamento, setAndamento] = useState<{ fase: string; fracao: number } | null>(null);
  const ver = useLista<EpisodioCompleto>("podcast_ver", { p_id: id });
  const e = ver.dados;
  const { eu } = painel;
  const podeProduzir = eu.producao || eu.supervisao || eu.coordenacao;

  async function agir(funcao: string, argumentos: Record<string, unknown>, sucesso: string) {
    setAviso("");
    try {
      const r = await rpc<{ liberar?: { deposito: string; caminho: string }[] }>(funcao, argumentos);
      if (r?.liberar?.length) await liberarEspaco(r.liberar).catch(() => 0);
      setAviso(sucesso);
      ver.recarregar();
      recarregarPainel();
    } catch (erro) {
      const codigo = erro instanceof Error ? erro.message : "";
      setAviso(codigo === "lista_incompleta" ? "Ainda falta coisa na lista de conferência: veja os passos marcados em vermelho." : codigo === "aprovar_o_proprio" ? "Quem enviou não aprova o próprio episódio: peça a outra pessoa da supervisão." : textoDoErro(erro));
    }
  }

  /** O atalho do passo mais confuso: enviar o MP3 final daqui mesmo, sem procurar a aba. */
  async function enviarFinal(arquivo: File | undefined) {
    if (!arquivo || !e) return;
    setAviso("");
    const formato = tipoDe(arquivo);
    if (!["audio/mpeg", "audio/mp4", "audio/ogg", "audio/opus"].includes(formato)) return setAviso("O áudio final precisa ser MP3 (ou M4A, OGG). Exporte do Audacity em MP3 de 96 a 128 kbps.");
    if (arquivo.size > LIMITE_BYTES) return setAviso(mensagensDeEnvio.tamanho);
    const caminho = `ep/${e.id}/${nomeSorteado("final", extensaoDe(arquivo))}`;
    try {
      setAndamento({ fase: "Enviando", fracao: 0 });
      await enviarComProgresso("podcast", caminho, arquivo, (f) => setAndamento({ fase: "Enviando", fracao: f }), formato);
      const { id } = await rpc<{ id: string }>("podcast_arquivo_registrar", { p_episodio: e.id, p: { tipo: "final", deposito: "podcast", caminho, nome: arquivo.name.slice(0, 200), bytes: arquivo.size, mime: formato, nota: "" } });
      setAndamento({ fase: "Medindo o volume", fracao: 0 });
      const a = await analisarAudio(arquivo, (f) => setAndamento({ fase: "Medindo o volume", fracao: f }));
      await rpc("podcast_audio_definir", { p_episodio: e.id, p_arquivo: id, p_duracao: Math.max(1, a.duracao), p_picos: a.picos });
      setAviso(`Áudio final enviado e definido como o áudio do episódio (${Math.round(a.duracao / 60)} min${a.lufs !== null ? `, ${a.lufs} LUFS` : ""}). Confira o volume na aba Arquivos.`);
      ver.recarregar();
      recarregarPainel();
    } catch (erro) {
      setAviso(erro instanceof EnvioError ? (mensagensDeEnvio[erro.message] ?? mensagensDeEnvio.envio) : textoDoErro(erro));
    } finally {
      setAndamento(null);
    }
  }

  const pendentes = new Set(e?.pendencias ?? []);
  const feito = (passo: (typeof PASSOS)[number]) => {
    if (!e) return false;
    if (passo.id === "episodio") return e.resumo.trim().length >= 20;
    if (passo.id === "roteiro") return e.roteiro.trim().length > 0 || ["gravacao", "edicao", "revisao", "aprovado", "publicado"].includes(e.status);
    if (passo.id === "aprovacao") return e.status === "aprovado" || e.status === "publicado";
    if (passo.id === "publicar") return e.status === "publicado";
    return passo.itens.every((item) => !pendentes.has(item));
  };
  const etapaDoPasso = (passo: (typeof PASSOS)[number]) => (e && passo.id === "aprovacao" && e.status === "revisao" ? "Enviado: esperando a supervisão" : "");

  if (!e) return <Aviso texto={ver.erro || "Carregando…"} />;
  return (
    <div className="space-y-6">
      <Aviso texto={aviso} />
      {e && (
        <>
          <p className={rotulo}>
            {e.titulo} · etapa: {NOME_DA_ETAPA[e.status]} · {e.pendencias.length === 0 ? "lista de conferência completa" : `faltam ${e.pendencias.length} item(ns) da lista`}
          </p>
          <ol className="divide-y divide-rule border-y border-rule">
            {PASSOS.map((passo, i) => {
              const ok = feito(passo);
              const faltando = passo.itens.filter((item) => pendentes.has(item));
              return (
                <li key={passo.id} className="flex gap-4 py-4">
                  <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center font-sans text-base font-black ${ok ? "bg-ok text-parchment" : "border-2 border-ink"}`}>{ok ? "✓" : i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-xl font-semibold">
                      {passo.nome}
                      {etapaDoPasso(passo) && <span className="ml-2 bg-oxblood px-1.5 py-0.5 font-sans text-xs font-normal text-parchment">{etapaDoPasso(passo)}</span>}
                    </p>
                    <p className="mt-1 text-ink-soft">{passo.faz}</p>
                    {faltando.length > 0 && (
                      <p className="mt-1 text-oxblood">Falta: {faltando.map((item) => PENDENCIAS_DO_EPISODIO[item] ?? item).join("; ")}.</p>
                    )}
                    <p className="mt-2 flex flex-wrap items-center gap-3">
                      <button type="button" className={botaoClaro} onClick={() => abrir(e.id, passo.aba)}>Abrir a aba {passo.aba === "pauta" ? "Pauta" : passo.aba === "roteiro" ? "Roteiro" : passo.aba === "arquivos" ? "Arquivos" : passo.aba === "publicacao" ? "Publicação" : "Revisão"}</button>
                      {passo.id === "audio" && podeProduzir && e.status !== "publicado" && (
                        <label className={`${botao} inline-block ${andamento ? "pointer-events-none opacity-50" : ""}`}>
                          {andamento ? `${andamento.fase}… ${Math.round(andamento.fracao * 100)}%` : "Enviar o MP3 final agora"}
                          <input type="file" accept="audio/*" className="sr-only" onChange={(ev) => { void enviarFinal(ev.target.files?.[0]); ev.target.value = ""; }} />
                        </label>
                      )}
                      {passo.id === "aprovacao" && podeProduzir && ["ideia", "roteiro", "gravacao", "edicao"].includes(e.status) && (
                        <button type="button" className={botao} onClick={() => void agir("podcast_etapa", { p_id: e.id, p_status: "revisao" }, "Enviado. A supervisão recebeu o recado e aprova ou devolve.")}>Enviar para aprovação</button>
                      )}
                      {passo.id === "aprovacao" && eu.supervisao && e.status === "revisao" && e.enviado_por !== eu.id && (
                        <button type="button" className={botao} onClick={() => void agir("podcast_aprovar", { p_id: e.id, p_aprovar: true, p_nota: "" }, "Aprovado. Agora o passo 6: publicar.")}>Aprovar</button>
                      )}
                      {passo.id === "publicar" && podeProduzir && e.status === "aprovado" && (
                        <button type="button" className={botao} disabled={e.pendencias.length > 0} title={e.pendencias.length ? "Ainda falta coisa na lista" : ""} onClick={() => void agir("podcast_publicar", { p_id: e.id }, "No ar! O episódio aparece no site em até cinco minutos e nas plataformas na próxima leitura do feed.")}>Publicar</button>
                      )}
                      {passo.id === "publicar" && e.status === "publicado" && e.slug && (
                        <a href={`/pt/podcasts/${e.slug}`} target="_blank" rel="noopener noreferrer" className={elo}>Ver no site ↗</a>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
          <details className="text-ink-soft">
            <summary className="cursor-pointer">Quem faz o quê</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Produção</strong> cria o episódio, escreve pauta e roteiro, envia os arquivos e publica depois da aprovação.</li>
              <li><strong>Edição</strong> trata o áudio e envia as versões.</li>
              <li><strong>Supervisão</strong> aprova ou devolve o episódio enviado para revisão (nunca o que ela mesma enviou).</li>
              <li><strong>Design e marketing</strong> fazem a capa e as artes de divulgação (aba Publicação e Estúdio de design).</li>
              <li>A <strong>coordenação</strong> pode tudo isso.</li>
            </ul>
            <p className="mt-2">Depois de publicado, o episódio entra no site e no feed RSS sozinho. Nas plataformas (Spotify, Apple), ele aparece quando elas releem o feed, em geral em algumas horas. Os endereços das plataformas ficam em Ajustes.</p>
          </details>
        </>
      )}
    </div>
  );
}
