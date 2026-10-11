// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { can, rpc, type Me } from "@/lib/backend";
import tipos from "@/lib/tipos.json";
import { cleanSources, MarkdownEditor, SourcesField, type SourceDraft } from "../Editor";
import { useI18n } from "../I18n";
import { Markdown } from "../Markdown";
import { Aviso, botao, botaoClaro, campo, data, elo, rotulo, situacoes, textoDoErro, useAcao, useLista } from "./comum";
import { editorPt, fontesPt } from "./Escrever";

interface Resumo {
  id: string;
  tipo: string;
  disciplina: string | null;
  titulo: string;
  nome_autor: string;
  como: string;
  status: string;
  nota: string;
  criado_em: string;
  pareceres: number;
}

interface Completa extends Resumo {
  corpo: string;
  dados: Record<string, string>;
  fontes: { titulo: string; autor?: string; url?: string }[];
  alvo: string | null;
  lista_pareceres: { favoravel: boolean; texto: string; criado_em: string; nome: string }[];
}

const nomeDoTipo = (tipo: string) => (tipos as Record<string, { rotulo: string }>)[tipo]?.rotulo ?? (tipo === "correcao" ? "Correção" : tipo);
const origem: Record<string, string> = { publico: "contribuição pública", educacao: "educador(a) da disciplina", jornalismo: "jornalismo", curadoria: "curadoria", revisao: "revisão", traducao: "tradução" };

/** Fila de revisão: quem tem papel lê e dá parecer; curadoria e coordenação decidem. */
export function Fila({ me, minhas = false }: { me: Me; minhas?: boolean }) {
  const { t } = useI18n();
  const [status, setStatus] = useState("pendente");
  const lista = useLista<Resumo[]>(minhas ? "contribuicoes_minhas" : "fila", minhas ? {} : { p_status: status });
  const [aberta, setAberta] = useState<string | null>(null);

  if (aberta) return <Detalhe id={aberta} me={me} minhas={minhas} voltar={() => { setAberta(null); lista.recarregar(); }} />;

  return (
    <div>
      {!minhas && (
        <div className="flex flex-wrap gap-2">
          {["pendente", "aprovada", "publicada", "recusada", "resolvida"].map((opcao) => (
            <button key={opcao} type="button" onClick={() => setStatus(opcao)} aria-pressed={status === opcao} className={`cursor-pointer border-2 px-3 py-1.5 ${status === opcao ? "border-ink bg-ink text-parchment" : "border-rule hover:border-gold"}`}>
              {opcao}
            </button>
          ))}
        </div>
      )}
      <Aviso texto={lista.erro} />
      {lista.dados?.length === 0 && <p className="mt-4 text-ink-soft">{minhas ? "Você ainda não enviou nada." : "Nada nesta situação."}</p>}
      <ul className="mt-4 divide-y divide-rule border-y border-rule">
        {lista.dados?.map((item) => (
          <li key={item.id} className="py-4">
            <p className={rotulo}>
              {nomeDoTipo(item.tipo)}
              {item.disciplina && ` · ${t.areas[item.disciplina as keyof typeof t.areas]?.[0] ?? item.disciplina}`} · {data(item.criado_em)}
            </p>
            <button type="button" onClick={() => setAberta(item.id)} className="mt-1 cursor-pointer text-left font-serif text-2xl font-semibold hover:text-oxblood">
              {item.titulo}
            </button>
            <p className="mt-1 text-ink-soft">
              {item.nome_autor || "sem nome"} · {origem[item.como] ?? item.como} · {situacoes[item.status] ?? item.status}
              {item.pareceres > 0 && ` · ${item.pareceres} parecer(es)`}
            </p>
            {minhas && item.nota && <p className="mt-1">Recado da curadoria: {item.nota}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Detalhe({ id, me, minhas, voltar }: { id: string; me: Me; minhas: boolean; voltar: () => void }) {
  const { lang, t } = useI18n();
  const item = useLista<Completa>("contribuicao_ver", { p_id: id });
  const acao = useAcao(item.recarregar);
  const [nota, setNota] = useState("");
  const [parecer, setParecer] = useState("");
  const [edicao, setEdicao] = useState<{ titulo: string; corpo: string; fontes: SourceDraft[] } | null>(null);
  const c = item.dados;
  if (!c) return <Aviso texto={item.erro || "Carregando…"} />;

  const decide = can(me, "coordenacao", "curadoria");
  const pendente = c.status === "pendente";
  const podeEditar = pendente && (decide || minhas);
  const exigeFonte = (tipos as Record<string, { fonte: boolean }>)[c.tipo]?.fonte ?? false;

  async function decidir(aprovar: boolean) {
    try {
      await rpc("contribuicao_decidir", { p_id: id, p_aprovar: aprovar, p_nota: nota });
      voltar();
    } catch (erro) {
      acao.setAviso(textoDoErro(erro));
    }
  }

  return (
    <div className="space-y-6">
      <button type="button" onClick={voltar} className={elo}>← Voltar à lista</button>
      <div>
        <p className={rotulo}>
          {nomeDoTipo(c.tipo)}
          {c.disciplina && ` · ${t.areas[c.disciplina as keyof typeof t.areas]?.[0] ?? c.disciplina}`} · {situacoes[c.status] ?? c.status}
        </p>
        <h2 className="mt-1 font-serif text-3xl font-semibold">{c.titulo}</h2>
        <p className="mt-1 text-ink-soft">
          {c.nome_autor || "sem nome"} · {origem[c.como] ?? c.como} · {data(c.criado_em)}
        </p>
        {c.alvo && <p className="mt-1 font-mono text-xs">página: {c.alvo}</p>}
      </div>

      {Object.keys(c.dados).length > 0 && (
        <dl className="grid gap-x-6 gap-y-1 border border-rule bg-parchment-deep p-4 sm:grid-cols-[10rem_1fr]">
          {Object.entries(c.dados).map(([chave, valor]) => (
            <div key={chave} className="contents">
              <dt className="font-mono text-xs text-gold">{chave}</dt>
              <dd className="break-words">{String(valor)}</dd>
            </div>
          ))}
        </dl>
      )}

      {edicao ? (
        <div className="space-y-4">
          <label className="block">
            Título
            <input value={edicao.titulo} onChange={(e) => setEdicao({ ...edicao, titulo: e.target.value })} maxLength={160} className={campo} />
          </label>
          <MarkdownEditor id="edicao-corpo" value={edicao.corpo} onChange={(corpo) => setEdicao({ ...edicao, corpo })} labels={editorPt} upload={can(me, "coordenacao", "curadoria", "educacao", "jornalismo", "design")} />
          {exigeFonte && <SourcesField value={edicao.fontes} onChange={(fontes) => setEdicao({ ...edicao, fontes })} labels={fontesPt} />}
          <div className="flex gap-4">
            <button
              type="button"
              className={botao}
              disabled={acao.ocupado}
              onClick={async () => {
                const ok = await acao.agir("contribuicao_editar", { p_id: id, p: { titulo: edicao.titulo, corpo: edicao.corpo, dados: c.dados, fontes: cleanSources(edicao.fontes) } }, "Alterações guardadas.");
                if (ok) setEdicao(null);
              }}
            >
              Guardar alterações
            </button>
            <button type="button" className={elo} onClick={() => setEdicao(null)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <>
          <div className="border border-rule bg-parchment p-5 font-serif" lang="pt-BR">
            <Markdown lang={lang}>{c.corpo || "*Sem texto.*"}</Markdown>
          </div>
          {c.fontes.length > 0 ? (
            <div>
              <p className={rotulo}>Fontes</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {c.fontes.map((fonte) => (
                  <li key={`${fonte.titulo}${fonte.url ?? ""}`}>
                    {fonte.autor && `${fonte.autor}. `}
                    {fonte.url ? <a href={fonte.url} target="_blank" rel="noopener noreferrer nofollow" className={elo}>{fonte.titulo}</a> : fonte.titulo}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            exigeFonte && <p className="text-oxblood">Sem fontes.</p>
          )}
          {podeEditar && (
            <button type="button" className={elo} onClick={() => setEdicao({ titulo: c.titulo, corpo: c.corpo, fontes: c.fontes.length > 0 ? c.fontes.map((f) => ({ titulo: f.titulo, autor: f.autor ?? "", url: f.url ?? "" })) : [{ titulo: "", autor: "", url: "" }] })}>
              Editar antes de decidir
            </button>
          )}
        </>
      )}

      <section>
        <p className={rotulo}>Pareceres</p>
        {c.lista_pareceres.length === 0 && <p className="mt-2 text-ink-soft">Nenhum parecer ainda.</p>}
        <ul className="mt-2 space-y-2">
          {c.lista_pareceres.map((p, i) => (
            <li key={i} className={`border-l-2 pl-3 ${p.favoravel ? "border-ok" : "border-oxblood"}`}>
              <p>{p.texto}</p>
              <p className="text-xs text-ink-soft">
                {p.nome} · {p.favoravel ? "favorável" : "pede ajustes"} · {data(p.criado_em)}
              </p>
            </li>
          ))}
        </ul>
        {!minhas && pendente && (
          <div className="mt-3">
            <textarea value={parecer} onChange={(e) => setParecer(e.target.value)} rows={3} maxLength={2000} placeholder="Conferiu datas, contas e fontes? Diga o que viu." aria-label="Seu parecer" className={campo} />
            <div className="mt-2 flex flex-wrap gap-3">
              {[true, false].map((favoravel) => (
                <button
                  key={String(favoravel)}
                  type="button"
                  className={botaoClaro}
                  disabled={acao.ocupado || parecer.trim().length < 3}
                  onClick={async () => {
                    const ok = await acao.agir("parecer", { p_id: id, p_favoravel: favoravel, p_texto: parecer }, "Parecer registrado.");
                    if (ok) setParecer("");
                  }}
                >
                  {favoravel ? "Parecer favorável" : "Pedir ajustes"}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {decide && pendente && !minhas && (
        <section className="border-2 border-ink p-5">
          <p className={rotulo}>Decisão da curadoria</p>
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} maxLength={2000} placeholder="Recado para quem enviou (opcional)" aria-label="Recado para quem enviou" className={campo} />
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className={botao} onClick={() => decidir(true)}>Aprovar</button>
            <button type="button" className={botaoClaro} onClick={() => decidir(false)}>Não aprovar</button>
          </div>
          <p className="mt-2 text-ink-soft">Aprovar não publica na hora: o texto entra no site na próxima publicação e fica guardado no histórico.</p>
        </section>
      )}
      <Aviso texto={acao.aviso} />
    </div>
  );
}
