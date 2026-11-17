// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { b1 } from "@/lib/rede/cliente-b1";
import { preencher } from "@/lib/rede/preencher";
import { faltaFuncaoNoBanco } from "@/lib/rede/reserva";
import type { TextosDoAcabamento } from "@/lib/rede/textos-acabamento";
import type { TextosDaB1 } from "@/lib/rede/textos-b1";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Post } from "@/lib/rede/tipos";
import type { PastaDeSalvos, PastasDaPessoa } from "@/lib/rede/tipos-b1";
import { erroDaB1 } from "../b1/base";
import { previa } from "../conversa/base3";
import { salvosDaPrevia } from "../descoberta/previa";
import { Icone } from "../publicar/alumia2/icones";
import { Botao } from "../ui/Botao";

/** As pastas de exemplo da prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim). Vivem só na memória da página; nada vai ao banco. */
let dePrevia: { pastas: PastaDeSalvos[]; dentro: Record<string, string[]> } | null = null;
function previaDasPastas() {
  if (!dePrevia) {
    const ids = salvosDaPrevia().map((p) => p.id);
    dePrevia = {
      pastas: [
        { id: "previa-tarifa", nome: "Tarifa zero", nucleo: null, posts: 0, tem: null },
        { id: "previa-assembleia", nome: "Para a assembleia", nucleo: { id: "previa-nucleo", nome: "Núcleo Passe Livre Itaquera" }, posts: 0, tem: null },
        { id: "previa-calma", nome: "Ler com calma", nucleo: null, posts: 0, tem: null },
      ],
      dentro: { "previa-tarifa": ids.slice(0, 2), "previa-assembleia": ids.slice(1, 2), "previa-calma": [] },
    };
  }
  return dePrevia;
}
const NUCLEOS_DA_PREVIA = [{ id: "previa-nucleo", nome: "Núcleo Passe Livre Itaquera" }];

/** O que as telas pedem às pastas: o banco de verdade, ou a memória da prévia com as mesmas respostas. */
export const fonteDasPastas = {
  async pastas(post: string | null = null): Promise<PastasDaPessoa> {
    if (!previa()) return b1.pastas(post);
    const m = previaDasPastas();
    return { itens: m.pastas.map((p) => ({ ...p, posts: m.dentro[p.id]?.length ?? 0, tem: post ? (m.dentro[p.id] ?? []).includes(post) : null })), nucleos: NUCLEOS_DA_PREVIA };
  },
  async criar(nome: string, nucleo: string | null): Promise<{ id: string; nome: string }> {
    if (!previa()) return b1.criarPasta(nome, nucleo);
    const m = previaDasPastas();
    const id = `previa-${Date.now()}`;
    m.pastas.push({ id, nome, nucleo: nucleo ? (NUCLEOS_DA_PREVIA.find((n) => n.id === nucleo) ?? null) : null, posts: 0, tem: null });
    m.dentro[id] = [];
    return { id, nome };
  },
  async mudar(id: string, nome: string | null): Promise<void> {
    if (!previa()) return void (await b1.mudarPasta(id, nome));
    const m = previaDasPastas();
    if (nome === null) m.pastas = m.pastas.filter((p) => p.id !== id);
    else m.pastas = m.pastas.map((p) => (p.id === id ? { ...p, nome } : p));
  },
  async por(pasta: string, post: string, sim: boolean): Promise<void> {
    if (!previa()) return void (await b1.porNaPasta(pasta, post, sim));
    const m = previaDasPastas();
    const atual = (m.dentro[pasta] ?? []).filter((x) => x !== post);
    m.dentro[pasta] = sim ? [...atual, post] : atual;
  },
  async posts(pasta: string, cursor: string | null = null): Promise<{ itens: Post[]; proximo: string | null }> {
    if (!previa()) return b1.postsDaPasta(pasta, cursor);
    const ids = previaDasPastas().dentro[pasta] ?? [];
    return { itens: salvosDaPrevia().filter((p) => ids.includes(p.id)), proximo: null };
  },
};

export type EstadoDasPastas = { fase: "carregando" } | { fase: "sem" } | { fase: "erro"; texto: string } | { fase: "ok"; dados: PastasDaPessoa };

/**
 * As pastas da pessoa, vivas: carrega ao montar e de novo a cada `recarregar()`. Num banco que ainda não tem as pastas (a função
 * não existe), a fase é "sem" e a tela de Salvos fica como era, sem a fileira.
 */
export function usePastas(ativo: boolean, s: Pick<TextosDaRede, "erros">, tb: TextosDaB1 | null) {
  const [estado, setEstado] = useState<EstadoDasPastas>({ fase: "carregando" });
  const [vez, setVez] = useState(0);
  useEffect(() => {
    if (!ativo || !tb) return;
    let vivo = true;
    fonteDasPastas
      .pastas()
      .then((dados) => vivo && setEstado({ fase: "ok", dados: { itens: dados.itens ?? [], nucleos: dados.nucleos ?? [] } }))
      .catch((e) => vivo && setEstado(faltaFuncaoNoBanco(e) ? { fase: "sem" } : { fase: "erro", texto: erroDaB1(s, tb, e) }));
    return () => {
      vivo = false;
    };
  }, [ativo, s, tb, vez]);
  const recarregar = useCallback(() => setVez((n) => n + 1), []);
  return { estado, recarregar };
}

/** "{n} posts" / "1 post", no idioma da página. */
export function quantosPosts(tb: TextosDaB1, n: number): string {
  return n === 1 ? tb.pastas.umPost : preencher(tb.pastas.posts, { n });
}

/** O formulário curto de criar pasta: o nome e, para quem é de algum núcleo, onde ela fica (só para mim, ou do núcleo). */
export function NovaPasta({ tb, t, nucleos, aoCriar, aoCancelar, aoErro }: {
  tb: TextosDaB1;
  t: TextosDoAcabamento;
  nucleos: { id: string; nome: string }[];
  aoCriar: (pasta: { id: string; nome: string }) => void;
  aoCancelar: () => void;
  aoErro: (e: unknown) => void;
}) {
  const [nome, setNome] = useState("");
  const [nucleo, setNucleo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => campo.current?.focus(), []);
  return (
    <form
      className="ac-form"
      onSubmit={(e) => {
        e.preventDefault();
        const limpo = nome.trim();
        if (!limpo || ocupado) return;
        setOcupado(true);
        fonteDasPastas
          .criar(limpo, nucleo || null)
          .then(aoCriar, aoErro)
          .finally(() => setOcupado(false));
      }}
    >
      <label className="sr-only" htmlFor={`${id}-nome`}>{tb.pastas.nomeRotulo}</label>
      <input ref={campo} id={`${id}-nome`} className="ac-campo" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} placeholder={tb.pastas.nomeRotulo} autoComplete="off" enterKeyHint="done" />
      {nucleos.length > 0 && (
        <>
          <label className="sr-only" htmlFor={`${id}-onde`}>{tb.pastas.nucleoRotulo}</label>
          <select id={`${id}-onde`} className="ac-campo" value={nucleo} onChange={(e) => setNucleo(e.target.value)}>
            <option value="">{tb.pastas.privada}</option>
            {nucleos.map((n) => (
              <option key={n.id} value={n.id}>{`${tb.pastas.doNucleo}: ${n.nome}`}</option>
            ))}
          </select>
        </>
      )}
      <Botao type="submit" variante="primario" tamanho="p" disabled={!nome.trim() || ocupado}>{tb.pastas.criar}</Botao>
      <Botao variante="fantasma" tamanho="p" onClick={aoCancelar}>{t.pastas.cancelar}</Botao>
    </form>
  );
}

/**
 * "Guardar em uma pasta": a folha com as pastas da pessoa, cada uma marcada se o post já está nela. Tocar põe ou tira na hora
 * (se o banco recusar, a marca volta). Dá para criar uma pasta ali mesmo. É um <dialog> modal: prende o foco, fecha com Esc e
 * com toque fora, e devolve o foco ao botão que abriu.
 */
export function EscolherPasta({ post, tb, t, s, aoFechar, aoMudar, aoErro }: {
  post: Post | null;
  tb: TextosDaB1;
  t: TextosDoAcabamento;
  s: Pick<TextosDaRede, "erros" | "estados">;
  aoFechar: () => void;
  /** Alguma pasta mudou (para a tela recontar e, se for o caso, tirar o post da pasta aberta). */
  aoMudar: (pasta: PastaDeSalvos, dentro: boolean) => void;
  aoErro: (e: unknown) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const [dados, setDados] = useState<{ post: string; pastas: PastasDaPessoa } | null>(null);
  const [erro, setErro] = useState<{ post: string; texto: string } | null>(null);
  const [criando, setCriando] = useState(false);
  const [vez, setVez] = useState(0);
  const id = post?.id ?? null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (id && !d.open) d.showModal();
    if (!id && d.open) d.close();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let vivo = true;
    fonteDasPastas
      .pastas(id)
      .then((pastas) => vivo && setDados({ post: id, pastas: { itens: pastas.itens ?? [], nucleos: pastas.nucleos ?? [] } }))
      .catch((e) => vivo && setErro({ post: id, texto: erroDaB1(s, tb, e) }));
    return () => {
      vivo = false;
    };
  }, [id, vez, s, tb]);

  const daVez = dados && dados.post === id ? dados.pastas : null;
  const erroDaVez = erro && erro.post === id ? erro.texto : null;

  function alternar(pasta: PastaDeSalvos) {
    if (!id) return;
    const quer = !pasta.tem;
    const marcar = (tem: boolean) => setDados((atual) => (atual && atual.post === id ? { post: id, pastas: { ...atual.pastas, itens: atual.pastas.itens.map((p) => (p.id === pasta.id ? { ...p, tem, posts: Math.max(0, p.posts + (tem ? 1 : -1)) } : p)) } } : atual));
    marcar(quer);
    fonteDasPastas.por(pasta.id, id, quer).then(
      () => aoMudar(pasta, quer),
      (e) => {
        marcar(!quer);
        aoErro(e);
      },
    );
  }

  return (
    <dialog
      ref={ref}
      className="ac-folha"
      aria-labelledby={idTitulo}
      onClose={() => {
        setCriando(false);
        aoFechar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <div className="ac-folha-miolo">
        <header className="ac-folha-cabeca">
          <h2 id={idTitulo} className="al-cond ac-folha-titulo">{tb.pastas.escolher}</h2>
          <button type="button" className="ac-icone" onClick={() => ref.current?.close()} aria-label={t.pastas.fechar} title={t.pastas.fechar}>
            <Icone nome="fechar" className="h-5 w-5" />
          </button>
        </header>
        <div className="ac-folha-corpo">
          {erroDaVez ? (
            <div role="alert" className="px-2 py-4">
              <p className="text-sm">{erroDaVez}</p>
              <Botao variante="contorno" tamanho="p" className="mt-3" onClick={() => { setErro(null); setVez((n) => n + 1); }}>{t.pastas.tentar}</Botao>
            </div>
          ) : !daVez ? (
            <p role="status" className="px-2 py-6 text-sm text-[var(--al-texto-3)]">{s.estados.carregando}</p>
          ) : daVez.itens.length === 0 && !criando ? (
            <p className="px-2 py-5 text-sm leading-relaxed text-[var(--al-texto-2)]">{t.pastas.semNenhuma}</p>
          ) : (
            <ul role="group" aria-label={tb.pastas.moverRotulo} className="m-0 list-none p-0">
              {daVez.itens.map((pasta) => (
                <li key={pasta.id}>
                  <button type="button" role="checkbox" aria-checked={Boolean(pasta.tem)} className="ac-opcao" onClick={() => alternar(pasta)}>
                    <span className="ac-opcao-caixa" aria-hidden>
                      <Icone nome="visto" className="h-4 w-4" grosso />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{pasta.nome}</span>
                      <span className="ac-opcao-sub">{pasta.nucleo ? `${tb.pastas.doNucleo}: ${pasta.nucleo.nome}` : tb.pastas.privada}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="ac-folha-pe">
          {criando && daVez ? (
            <NovaPasta
              tb={tb}
              t={t}
              nucleos={daVez.nucleos}
              aoCancelar={() => setCriando(false)}
              aoErro={aoErro}
              aoCriar={(nova) => {
                setCriando(false);
                // A pasta nova já nasce com este post dentro: foi para isso que a pessoa a criou aqui.
                const pasta: PastaDeSalvos = { id: nova.id, nome: nova.nome, nucleo: null, posts: 0, tem: false };
                setDados((atual) => (atual && atual.post === id ? { post: atual.post, pastas: { ...atual.pastas, itens: [...atual.pastas.itens, pasta] } } : atual));
                alternar(pasta);
              }}
            />
          ) : (
            <>
              <Botao variante="contorno" tamanho="p" icone={<Icone nome="pastaMais" className="h-5 w-5" />} disabled={!daVez} onClick={() => setCriando(true)}>{tb.pastas.nova}</Botao>
              <p className="mt-3 text-xs leading-relaxed text-[var(--al-texto-3)]">{tb.pastas.regra}</p>
            </>
          )}
        </footer>
      </div>
    </dialog>
  );
}
