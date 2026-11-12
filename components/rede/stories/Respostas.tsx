// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A volta das respostas e reações (B1): a autora vê, no próprio story, quantas respostas chegaram e o total das reações (só a
// partir de 3, nunca quem); abre a caixa com as respostas daquele story, publica uma resposta à pergunta num story novo (sem o
// nome de quem respondeu) ou responde na conversa. Quem respondeu escolheu falar com ela (como numa mensagem direta), por isso a
// caixa mostra de quem veio; quem ela bloqueou aparece como "Conta indisponível". Nada disso conta quem VIU (PLANO-ALUMIA §6.4).
import { useEffect, useId, useState } from "react";
import Link from "@/components/Link";
import { haQuanto } from "@/lib/rede/stories/tempo";
import { enderecosDosStories } from "@/lib/rede/stories/enderecos";
import type { ClienteDeStories } from "@/lib/rede/cliente-stories";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import type { ItemDaCaixa, ReacoesDoStory, RespostaDoStory } from "@/lib/rede/tipos-stories";
import { enderecos } from "@/lib/rede/tipos";
import { PALETA_DO_STORY } from "@/lib/rede/stories/visual";
import { Avatar16 } from "../ui/Avatar16";
import { noPlural, preencherStory, useAgora } from "./usar";

type T = TextosDosStories;

/** O "há quanto" curto (agora, 5 min, 3 h). */
function quandoCurto(t: T, iso: string, agora: number): string {
  const q = haQuanto(iso, agora);
  if (!q) return "";
  return q.unidade === "agora" ? t.visor.agora : q.unidade === "min" ? preencherStory(t.visor.min, { n: q.n }) : preencherStory(t.visor.h, { n: q.unidade === "d" ? 23 : q.n });
}

/** O rodapé do MEU story: respostas (mensagens) e reações agregadas, com o atalho para a caixa. */
export function ResumoDaAutora({ t, lang, respostas, reacoes, aoAbrir }: { t: T; lang: string; respostas: number | null | undefined; reacoes: ReacoesDoStory | null | undefined; aoAbrir: () => void }) {
  const b = t.b1.visor;
  const n = respostas ?? 0;
  const reac = reacoes?.total
    ? `${noPlural(lang, reacoes.total, b.reacoesN)}${reacoes.por.punho || reacoes.por.chama || reacoes.por.coracao ? ` · ${preencherStory(b.reacoesPor, { punho: reacoes.por.punho ?? "–", chama: reacoes.por.chama ?? "–", coracao: reacoes.por.coracao ?? "–" })}` : ""}`
    : reacoes?.poucas
      ? b.reacoesPoucas
      : "";
  return (
    <div className="al-st-resumo">
      <button type="button" className="al-st-resumo-botao" onClick={aoAbrir} aria-haspopup="dialog">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 5h16v11H9l-5 4z" />
        </svg>
        <span>{n > 0 ? noPlural(lang, n, b.respostasN) : b.semRespostas}</span>
        {n > 0 ? <span className="al-st-resumo-ver">{b.verRespostas}</span> : null}
      </button>
      {reac ? (
        <p className="al-st-resumo-reacoes" title={b.soVoce}>
          {reac}
        </p>
      ) : null}
      <p className="sr-only">{b.soVoce}</p>
    </div>
  );
}

/**
 * A caixa de respostas de um story meu (dentro do visor, como as outras caixas). "Publicar num story" leva ao "criar" com a
 * resposta (o banco busca o texto de novo e confere que a pergunta é minha); "Responder na conversa" abre a conversa com a pessoa.
 */
export function CaixaDeRespostas({ t, cliente, lang, story, aoFechar }: { t: T; cliente: ClienteDeStories; lang: string; story: string; aoFechar: () => void }) {
  const r = t.b1.respostas;
  const id = useId();
  const agora = useAgora(30_000);
  const [lista, setLista] = useState<{ story: string; itens: RespostaDoStory[] } | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let vivo = true;
    cliente
      .respostas(story)
      .then((itens) => vivo && setLista({ story, itens }))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [cliente, story]);
  const itens = lista?.story === story ? lista.itens : null;
  return (
    <section className="al-st-caixa al-st-caixa-respostas" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={`${id}-a`}>
      <div className="al-st-caixa-cabeca">
        <h2 id={`${id}-t`}>{r.titulo}</h2>
        <button type="button" className="al-botao al-botao-fantasma al-botao-p" onClick={aoFechar}>
          {r.fechar}
        </button>
      </div>
      <p id={`${id}-a`} className="al-st-dica">
        {r.ajuda}
      </p>
      {erro ? (
        <p role="alert">{t.visor.erro}</p>
      ) : !itens ? (
        <p role="status">{r.carregando}</p>
      ) : itens.length === 0 ? (
        <p>{t.b1.visor.semRespostas}</p>
      ) : (
        <ul className="al-st-respostas">
          {itens.map((x) => (
            <li key={x.id} className="al-st-resposta" data-pergunta={x.pergunta ? "sim" : "nao"}>
              <div className="al-st-resposta-quem">
                {x.de ? <Avatar16 handle={x.de.handle} cor={x.de.cor ?? undefined} tamanho={28} /> : <span className="al-st-resposta-sem" aria-hidden />}
                <span>
                  <strong>{x.de?.nome ?? r.semNome}</strong>
                  <small>
                    {x.pergunta ? `${r.daPergunta} · ` : ""}
                    {quandoCurto(t, x.criado_em, agora)}
                  </small>
                </span>
              </div>
              <p className="al-st-resposta-texto">{x.texto}</p>
              <div className="al-st-resposta-acoes">
                {x.pergunta ? (
                  <Link href={enderecosDosStories.criarComResposta(lang, story, x.id)} className="al-botao al-botao-claro al-botao-p">
                    {r.publicar}
                  </Link>
                ) : null}
                {x.de ? (
                  <Link href={`${enderecos.linha(lang)}/conversas?com=${encodeURIComponent(x.de.handle)}`} className="al-botao al-botao-contorno al-botao-p">
                    {r.conversar}
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * A caixa geral (tela dos stories): os meus stories que receberam resposta, com quantas e de quando. Tocar abre o story no visor
 * (onde estão as respostas). Só a autora chega aqui; nada diz quem viu.
 */
export function CaixaDosMeusStories({ t, cliente, lang, aoAbrir }: { t: T; cliente: ClienteDeStories; lang: string; aoAbrir: (story: string) => void }) {
  const r = t.b1.respostas;
  const agora = useAgora(60_000);
  const [itens, setItens] = useState<ItemDaCaixa[] | null>(null);
  useEffect(() => {
    let vivo = true;
    cliente
      .caixa()
      .then((l) => vivo && setItens(l))
      .catch(() => vivo && setItens([]));
    return () => {
      vivo = false;
    };
  }, [cliente]);
  if (!itens || itens.length === 0) return null;
  return (
    <section className="al-st-caixa-geral" aria-labelledby="al-st-caixa-geral">
      <h2 id="al-st-caixa-geral" className="al-cond al-st-titulo-secao">
        {r.caixa}
      </h2>
      <ul>
        {itens.map((x) => (
          <li key={x.id}>
            <button type="button" className="al-st-caixa-item" aria-label={preencherStory(r.abrir, { texto: x.texto || r.semTexto })} onClick={() => aoAbrir(x.id)}>
              <span className="al-st-caixa-miniatura" style={{ background: PALETA_DO_STORY[x.cor]?.fundo }} aria-hidden>
                {(x.texto || "·").slice(0, 14)}
              </span>
              <span className="al-st-caixa-info">
                <strong>{x.texto || r.semTexto}</strong>
                <small>
                  {noPlural(lang, x.n, r.mensagensN)}
                  {x.perguntas > 0 ? ` · ${noPlural(lang, x.perguntas, r.perguntasN)}` : ""} · {quandoCurto(t, x.ultima, agora)}
                </small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
