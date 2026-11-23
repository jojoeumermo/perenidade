// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "@/components/Link";
import { redeMod } from "@/lib/rede/cliente-moderacao";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaModeracao } from "@/lib/rede/textos-moderacao";
import type { ChecagemDisponivel, DenunciaAberta, ItemDaFila, PostRetido } from "@/lib/rede/tipos-moderacao";
import { enderecos } from "@/lib/rede/tipos";
import { dataCurta, dataEHora, estilo, mensagemDeErro, nivelEmFrase, nomeDaRegra } from "./base";
import { TrechosComProva } from "../franquia/TrechosComProva";
import { FormularioDeAcao } from "./FormularioDeAcao";

/** O carimbo do prazo de resposta (onda 8): até quando, ou "vencido" em vermelho. Sem prazo (banco antigo), nada. */
export function CarimboDoPrazo({ sm, lang, ate, vencido }: { sm: TextosDaModeracao; lang: string; ate?: string | null; vencido?: boolean }) {
  if (!ate) return null;
  return (
    <span className="m9-carimbo" data-tom={vencido ? "alerta" : undefined}>
      {preencher(vencido ? sm.o9.prazo.venceu : sm.o9.prazo.ate, { quando: dataEHora(ate, lang) })}
    </span>
  );
}

/** O motivo do post retido em palavras (filtro da comunidade, recém-chegados, lista, precaução); o que não conhece, cru. */
export const motivoEscrito = (sm: TextosDaModeracao, motivo: string) => (sm.o9.motivos as Record<string, string>)[motivo] ?? motivo;

/** O detalhe de uma denúncia aberta: conteúdo, histórico, ação, descarte e o rótulo de desinformação. */
function Detalhe({ item, lang, s, sm, checagens, comunidades, nomes, aoMudar }: { item: ItemDaFila; lang: string; s: TextosDaRede; sm: TextosDaModeracao; checagens: ChecagemDisponivel[]; comunidades: string[]; nomes?: Record<string, string>; aoMudar: () => void }) {
  const [dado, setDado] = useState<DenunciaAberta | null>(null);
  const [erro, setErro] = useState("");
  const [nota, setNota] = useState("");
  const [escolhida, setEscolhida] = useState("");
  const [contexto, setContexto] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let vivo = true;
    redeMod
      .abrir(item.id)
      .then((d) => vivo && setDado(d))
      .catch((e) => vivo && setErro(mensagemDeErro(s, sm, e)));
    return () => {
      vivo = false;
    };
  }, [item.id, s, sm]);

  async function fechar(situacao: "resolvida" | "descartada") {
    setErro("");
    try {
      await redeMod.situacaoDaDenuncia(item.id, situacao, nota.trim());
      aoMudar();
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    }
  }
  async function rotular() {
    const c = checagens.find((x) => x.slug === escolhida);
    if (!c || !dado?.alvo?.id) return;
    setErro("");
    try {
      await redeMod.rotular(dado.alvo.id, c.slug, c.veredito, c.titulo);
      setAviso(sm.rotulo.feito);
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    }
  }
  async function desrotular() {
    if (!dado?.alvo?.id) return;
    setErro("");
    try {
      await redeMod.desrotular(dado.alvo.id);
      setAviso(sm.rotulo.retirado);
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    }
  }

  if (!dado) return erro ? <p role="alert" className="mt-2 text-sm text-oxblood">{erro}</p> : <p className="mt-2 text-sm text-ink-soft" role="status">{sm.carregando}</p>;
  const a = dado.alvo;
  const post = item.alvo_tipo === "post";
  const perfil = item.alvo_tipo === "perfil";
  return (
    <div className="mt-3 space-y-3 border-t border-rule pt-3">
      {post && a && (
        <div>
          {a.titulo && <p className="font-serif text-lg font-semibold">{a.titulo}</p>}
          <p className="whitespace-pre-line break-words">{a.corpo ?? a.texto}</p>
          <p className="mt-1 text-xs text-ink-soft">
            {a.autor && preencher(sm.fila.autor, { nome: a.autor, nivel: nivelEmFrase(sm, a.autor_nivel) })} · {preencher(sm.fila.procedentes, { n: a.autor_procedentes_90 ?? 0 })}
            {a.retido || a.oculto ? ` · ${preencher(sm.fila.retidoMotivo, { motivo: motivoEscrito(sm, a.motivo ?? "") })}` : ""}
          </p>
          {a.id && <Link href={enderecos.post(lang, a.id)} className="text-sm underline">{sm.fila.alvo.post}</Link>}
        </div>
      )}
      {perfil && a && (
        <div>
          <p className="font-bold">{a.codinome} {a.handle ? `@${a.handle}` : ""}</p>
          {a.bio && <p className="text-sm">{a.bio}</p>}
          <p className="mt-1 text-xs text-ink-soft">{preencher(sm.fila.autor, { nome: a.codinome ?? "", nivel: nivelEmFrase(sm, a.nivel) })} · {preencher(sm.fila.procedentes, { n: a.procedentes_90 ?? 0 })}</p>
        </div>
      )}
      {item.texto && <p className="rounded-md bg-parchment-deep px-3 py-2 text-sm">{item.texto}</p>}
      {/* Post cifrado: a moderação não tem a chave. Só o que quem denunciou escolheu abrir chega aqui, e a tela diz de quem é. */}
      {post && item.cifrado && !(item.prova && item.prova.length > 0) && (item.aberto ? (
        <figure className="rounded-md border-[1.5px] border-oxblood px-3 py-2 text-sm">
          <figcaption className="text-xs font-semibold">{sm.fila.aberto}</figcaption>
          <blockquote className="mt-1 whitespace-pre-line break-words">{item.aberto}</blockquote>
        </figure>
      ) : (
        <p role="note" className="rounded-md bg-parchment-deep px-3 py-2 text-sm">{sm.fila.cifradoSem}</p>
      ))}
      {/* Denúncia com prova (onda R2): os trechos que quem denunciou tirou do cifrado, conferidos pelo servidor, com o nível da prova. */}
      {item.prova && item.prova.length > 0 && <TrechosComProva sm={sm} lang={lang} prova={item.prova} />}

      {dado.historico.length > 0 && (
        <div>
          <p className="text-sm font-bold">{sm.fila.historico}</p>
          <ul className="mt-1 space-y-1 text-sm">
            {dado.historico.map((h) => (
              <li key={h.id}>
                <span className="font-semibold">{(sm.moderar.acoes as Record<string, string>)[h.acao] ?? h.acao}</span> · {nomeDaRegra(sm, h.regra)} · {h.motivo} <span className="text-ink-soft">({dataCurta(h.criado_em, lang)})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {post && a?.id && (
        <FormularioDeAcao s={s} sm={sm} denuncia={item.id} alvoTipo="post" alvo={a.id} acoes={["remover", "reter", "travar", "destravar", "restaurar", "avisar"]} aoFeito={aoMudar} />
      )}
      {perfil && a && (
        <div>
          <label className="block text-sm">
            {sm.lugares.comunidade}
            <select value={contexto} onChange={(e) => setContexto(e.target.value)} className={`${estilo.campo} mt-1`}>
              <option value="">—</option>
              {comunidades.map((c) => <option key={c} value={c}>{nomes?.[c] ?? c}</option>)}
            </select>
          </label>
          <FormularioDeAcao s={s} sm={sm} denuncia={item.id} alvoTipo="perfil" alvo={a.handle ?? item.alvo} acoes={contexto ? ["avisar", "banir", "desbanir"] : ["avisar"]} contexto={contexto || null} aoFeito={aoMudar} />
        </div>
      )}

      {post && a?.id && checagens.length > 0 && (
        <div className={estilo.caixa}>
          <p className="font-bold">{sm.rotulo.ligar}</p>
          <p className="text-xs text-ink-soft">{sm.rotulo.ajuda}</p>
          {a.rotulo && <p className="mt-1 text-sm">{a.rotulo.titulo || a.rotulo.checagem}: {a.rotulo.veredito}</p>}
          <label className="mt-2 block text-sm">
            {sm.rotulo.escolha}
            <select value={escolhida} onChange={(e) => setEscolhida(e.target.value)} className={`${estilo.campo} mt-1`}>
              <option value="">—</option>
              {checagens.map((c) => <option key={c.slug} value={c.slug}>{c.veredito}: {c.titulo}</option>)}
            </select>
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={!escolhida} className={estilo.botao} onClick={() => void rotular()}>{sm.rotulo.ligar}</button>
            {a.rotulo && <button type="button" className={estilo.botao} onClick={() => void desrotular()}>{sm.rotulo.retirar}</button>}
          </div>
          {aviso && <p role="status" className="mt-1 text-sm font-bold">{aviso}</p>}
        </div>
      )}

      <div className={estilo.caixa}>
        <label className="block text-sm">
          {sm.fila.descartarNota}
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={1000} rows={2} className={`${estilo.campo} mt-1`} />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" disabled={nota.trim().length < 3} className={estilo.botao} onClick={() => void fechar("descartada")}>{sm.fila.descartar}</button>
          <button type="button" className={estilo.botao} onClick={() => void fechar("resolvida")}>{sm.fila.encerrar}</button>
        </div>
      </div>
      {erro && <p role="alert" className="text-sm text-oxblood">{erro}</p>}
    </div>
  );
}

/** A fila de denúncias por prioridade (as de prioridade 1 no alto) e a lista dos posts retidos esperando leitura. */
export function FilaDeDenuncias({ lang, s, sm, checagens, comunidades, nomes, retidos }: { lang: string; s: TextosDaRede; sm: TextosDaModeracao; checagens: ChecagemDisponivel[]; comunidades: string[]; nomes?: Record<string, string>; retidos: boolean }) {
  const [quais, setQuais] = useState<"abertas" | "fechadas">("abertas");
  const [itens, setItens] = useState<ItemDaFila[] | null>(null);
  const [lista, setLista] = useState<PostRetido[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [rodada, setRodada] = useState(0);
  const categorias = sm.categorias as Record<string, { rotulo: string }>;

  const recarregar = useCallback(() => {
    setAberto(null);
    setRodada((n) => n + 1);
  }, []);

  useEffect(() => {
    let vivo = true;
    if (retidos) {
      redeMod.retidos().then((x) => vivo && setLista(x)).catch((e) => vivo && setErro(mensagemDeErro(s, sm, e)));
    } else {
      redeMod.fila(quais).then((x) => vivo && setItens(x)).catch((e) => vivo && setErro(mensagemDeErro(s, sm, e)));
    }
    return () => {
      vivo = false;
    };
  }, [quais, retidos, rodada, s, sm]);

  if (erro) return <p role="alert" className="px-[18px] py-4 text-oxblood">{erro}</p>;

  if (retidos) {
    if (!lista) return <p className="px-[18px] py-4" role="status">{sm.carregando}</p>;
    if (lista.length === 0) return <p className="px-[18px] py-6 text-ink-soft">{sm.fila.vazioRetidos}</p>;
    return (
      <ul className="divide-y divide-rule">
        {lista.map((p) => (
          <li key={p.id} className="px-[18px] py-3 font-sans">
            <p className="text-xs text-ink-soft">{p.comunidade ?? ""} · {dataCurta(p.criado_em, lang)} · {preencher(sm.fila.autor, { nome: p.autor, nivel: nivelEmFrase(sm, p.autor_nivel) })}</p>
            {p.titulo && <p className="font-serif font-semibold">{p.titulo}</p>}
            <p className="break-words">{p.trecho}</p>
            <p className="mt-1"><span className="m9-carimbo" data-tom="ouro">{preencher(sm.fila.retidoMotivo, { motivo: motivoEscrito(sm, p.motivo) })}</span></p>
            {aberto === p.id ? (
              <FormularioDeAcao s={s} sm={sm} denuncia={null} alvoTipo="post" alvo={p.id} acoes={["restaurar", "remover", "avisar"]} aoFeito={recarregar} />
            ) : (
              <button type="button" className={`${estilo.botao} mt-2`} onClick={() => setAberto(p.id)}>{sm.fila.abrirRetido}</button>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div>
      <div className="flex gap-2 px-[18px] py-3" role="group">
        {(["abertas", "fechadas"] as const).map((q) => (
          <button key={q} type="button" aria-pressed={quais === q} onClick={() => { setItens(null); setQuais(q); }} className="al-botao al-botao-contorno al-botao-p">
            {sm.fila[q]}
          </button>
        ))}
      </div>
      {!itens ? (
        <p className="px-[18px] py-4" role="status">{sm.carregando}</p>
      ) : itens.length === 0 ? (
        <p className="px-[18px] py-6 text-ink-soft">{sm.fila.vazia}</p>
      ) : (
        <ul className="divide-y divide-rule">
          {itens.map((i) => (
            <li key={i.id} className="px-[18px] py-3 font-sans">
              <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="m9-carimbo" data-tom={i.prioridade === 1 ? "alerta" : undefined}>{(sm.prioridade as Record<string, string>)[String(i.prioridade)]}</span>
                <span className="font-bold">{categorias[i.categoria]?.rotulo ?? i.categoria}</span>
                <span className="text-ink-soft">{(sm.fila.alvo as Record<string, string>)[i.alvo_tipo]} · {preencher(sm.fila.protocolo, { protocolo: i.protocolo })} · {dataCurta(i.criado_em, lang)}</span>
                <span className="rounded border border-rule px-1 text-xs">{(sm.fila.situacao as Record<string, string>)[i.situacao]}</span>
                {quais === "abertas" && <CarimboDoPrazo sm={sm} lang={lang} ate={i.responder_ate} vencido={i.vencida} />}
              </div>
              {i.nucleo ? <p className="text-sm text-ink-soft">{sm.fila.nucleo}</p> : i.trecho && <p className="mt-1 break-words">{i.titulo ? `${i.titulo}: ` : ""}{i.trecho}</p>}
              {i.mesmas > 1 && <p className="text-xs text-ink-soft">{preencher(sm.fila.mesmas, { n: i.mesmas })}</p>}
              {aberto === i.id ? (
                <Detalhe item={i} lang={lang} s={s} sm={sm} checagens={checagens} comunidades={comunidades} nomes={nomes} aoMudar={recarregar} />
              ) : (
                quais === "abertas" && <button type="button" className={`${estilo.botao} mt-2`} onClick={() => setAberto(i.id)}>{sm.fila.abrir}</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
