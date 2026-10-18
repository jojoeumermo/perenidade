// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { can, rpc, type Me } from "@/lib/backend";
import { horaDoRascunho, useRascunho } from "@/lib/rascunho";
import tipos from "@/lib/tipos.json";
import { cleanSources, MarkdownEditor, SourcesField, type SourceDraft } from "../Editor";
import { useI18n } from "../I18n";
import { Markdown } from "../Markdown";
import { Aviso, botao, botaoClaro, campo, data, dataHora, elo, PAINEL_MUDOU, papeis, rotulo, situacoes, textoDoErro, useAcao, useLista } from "./comum";
import { BuscaDePessoa } from "./BuscaDePessoa";
import type { Membro } from "./Equipe";
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
  /** "aguardando": veio de fora e a mediação ainda não leu. */
  triagem?: string;
}

interface Completa extends Resumo {
  corpo: string;
  dados: Record<string, string>;
  fontes: { titulo: string; autor?: string; url?: string }[];
  alvo: string | null;
  lista_pareceres: { favoravel: boolean; texto: string; criado_em: string; nome: string }[];
  /** Fui eu que enviei. */
  minha: boolean;
  /** Quem enviou me chamou para trabalhar junto. */
  colaboro: boolean;
  colaboradores: { id: string; nome: string }[];
  /** Muda a cada alteração guardada: quem edita devolve a que abriu, para ninguém sobrescrever ninguém. */
  versao: string;
  editado_em: string | null;
  editado_por: string;
}

const nomeDoTipo = (tipo: string) => (tipos as Record<string, { rotulo: string }>)[tipo]?.rotulo ?? (tipo === "correcao" ? "Correção" : tipo);
/** Veio de fora e a mediação ainda não leu. */
const naTriagem = (item: Resumo) => item.status === "pendente" && item.triagem === "aguardando";
const origem: Record<string, string> = { publico: "contribuição pública", educacao: "educador(a) da disciplina", jornalismo: "jornalismo", curadoria: "curadoria", revisao: "revisão", traducao: "tradução" };

/**
 * A mesma lista em quatro usos: a fila de revisão (quem tem função lê e dá parecer; curadoria e coordenação decidem),
 * os envios da própria pessoa, as contribuições de colegas que a chamaram para trabalhar junto, e a triagem
 * (a mediação lê primeiro o que vem de fora e decide se segue para a fila de revisão).
 */
export function Fila({ me, minhas = false, juntas = false, triagem = false }: { me: Me; minhas?: boolean; juntas?: boolean; triagem?: boolean }) {
  const { t } = useI18n();
  const [status, setStatus] = useState("pendente");
  const propria = minhas || juntas;
  const lista = useLista<Resumo[]>(minhas ? "contribuicoes_minhas" : juntas ? "colaboracoes_minhas" : triagem ? "triagem_fila" : "fila", propria || triagem ? {} : { p_status: status });
  const [aberta, setAberta] = useState<string | null>(null);

  if (aberta) return <Detalhe id={aberta} me={me} semParecer={propria || triagem} triagem={triagem} voltar={() => { setAberta(null); lista.recarregar(); }} />;

  return (
    <div>
      {triagem && (
        <p className="max-w-3xl text-ink-soft">
          Aqui chega tudo o que o público envia, antes de ir para a mesa de educadores e revisores. Barre propaganda, vandalismo, texto sem pé nem cabeça e envio repetido; acerte a forma se for
          só isso que falta; e libere o resto. Julgar se o conteúdo está certo não é desta etapa: isso é da fila de revisão.
        </p>
      )}
      {!propria && !triagem && (
        <div className="flex flex-wrap gap-2">
          {["pendente", "aprovada", "publicada", "recusada", "resolvida"].map((opcao) => (
            <button key={opcao} type="button" onClick={() => setStatus(opcao)} aria-pressed={status === opcao} className={`cursor-pointer border-2 px-3 py-1.5 ${status === opcao ? "border-ink bg-ink text-parchment" : "border-rule hover:border-gold"}`}>
              {opcao}
            </button>
          ))}
        </div>
      )}
      <Aviso texto={lista.erro} />
      {lista.dados?.length === 0 && (
        <p className="mt-4 border border-rule bg-parchment-deep px-4 py-6 text-center text-ink-soft">
          {minhas ? "Você ainda não enviou nada." : juntas ? "Ninguém chamou você para trabalhar junto por enquanto. Quando chamar, a contribuição aparece aqui e você recebe um recado na Mesa." : triagem ? "Nada esperando a triagem." : "Nada nesta situação."}
        </p>
      )}
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
              {item.nome_autor || "sem nome"} · {origem[item.como] ?? item.como} · {naTriagem(item) ? "aguardando a triagem" : (situacoes[item.status] ?? item.status)}
              {item.pareceres > 0 && ` · ${item.pareceres} parecer(es)`}
            </p>
            {minhas && item.nota && <p className="mt-1">Recado da curadoria: {item.nota}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Detalhe({ id, me, semParecer, triagem = false, voltar }: { id: string; me: Me; semParecer: boolean; triagem?: boolean; voltar: () => void }) {
  const { lang, t } = useI18n();
  const item = useLista<Completa>("contribuicao_ver", { p_id: id });
  const { recarregar } = item;
  const acao = useAcao(recarregar);
  const [nota, setNota] = useState("");
  const [parecer, setParecer] = useState("");
  const [edicao, setEdicao] = useState<{ titulo: string; corpo: string; fontes: SourceDraft[]; versao: string } | null>(null);

  // Quem trabalha junto vê o que o colega guardou sem precisar recarregar a página.
  useEffect(() => {
    const relogio = window.setInterval(() => {
      if (document.visibilityState === "visible") recarregar();
    }, 20000);
    return () => window.clearInterval(relogio);
  }, [recarregar]);

  const c = item.dados;
  if (!c) return <Aviso texto={item.erro || "Carregando…"} />;

  const decide = can(me, "coordenacao", "curadoria");
  const pendente = c.status === "pendente";
  /** Esta pessoa está fazendo a triagem deste envio. */
  const tria = triagem && pendente && c.triagem === "aguardando";
  const podeEditar = pendente && (decide || c.minha || c.colaboro || tria);
  /** Alguém guardou outra versão enquanto esta pessoa está com o editor aberto. */
  const mudou = edicao !== null && edicao.versao !== c.versao;
  const exigeFonte = (tipos as Record<string, { fonte: boolean }>)[c.tipo]?.fonte ?? false;

  async function triar(liberar: boolean) {
    try {
      await rpc("triagem_decidir", { p_id: id, p_liberar: liberar, p_nota: nota });
      window.dispatchEvent(new Event(PAINEL_MUDOU));
      voltar();
    } catch (erro) {
      acao.setAviso(textoDoErro(erro));
    }
  }

  async function decidir(aprovar: boolean) {
    try {
      await rpc("contribuicao_decidir", { p_id: id, p_aprovar: aprovar, p_nota: nota });
      window.dispatchEvent(new Event(PAINEL_MUDOU));
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
          {c.disciplina && ` · ${t.areas[c.disciplina as keyof typeof t.areas]?.[0] ?? c.disciplina}`} · {naTriagem(c) ? "aguardando a triagem" : (situacoes[c.status] ?? c.status)}
        </p>
        <h2 className="mt-1 font-serif text-3xl font-semibold">{c.titulo}</h2>
        <p className="mt-1 text-ink-soft">
          {c.nome_autor || "sem nome"} · {origem[c.como] ?? c.como} · {data(c.criado_em)}
        </p>
        {c.alvo && <p className="mt-1 font-mono text-xs">página: {c.alvo}</p>}
        {c.editado_em && <p className="mt-1 text-ink-soft">Última alteração: {c.editado_por || "alguém da equipe"}, {dataHora(c.editado_em)}</p>}
        {c.minha && c.nota && <p className="mt-2 border-l-2 border-gold pl-3">Recado da curadoria: {c.nota}</p>}
      </div>

      {Object.keys(c.dados).length > 0 && (
        <dl className="grid gap-x-6 gap-y-1 border border-rule bg-parchment-deep p-4 sm:grid-cols-[10rem_1fr]">
          {Object.entries(c.dados).map(([chave, valor]) => (
            <div key={chave} className="contents">
              <dt className="font-mono text-xs text-gold">{chave}</dt>
              <dd className="break-words whitespace-pre-line">{String(valor)}</dd>
            </div>
          ))}
        </dl>
      )}

      {edicao ? (
        <Edicao
          id={id}
          c={c}
          edicao={edicao}
          setEdicao={setEdicao}
          mudou={mudou}
          exigeFonte={exigeFonte}
          podeImagem={can(me, "coordenacao", "curadoria", "educacao", "jornalismo", "design")}
          ocupado={acao.ocupado}
          guardar={async () => {
            const ok = await acao.agir("contribuicao_editar", { p_id: id, p: { titulo: edicao.titulo, corpo: edicao.corpo, dados: c.dados, fontes: cleanSources(edicao.fontes), versao: edicao.versao } }, "Alterações guardadas.");
            return Boolean(ok);
          }}
        />
      ) : (
        <>
          <div className="border border-rule bg-parchment p-5 font-serif" lang="pt-BR" translate="no">
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
            <button type="button" className={botaoClaro} onClick={() => setEdicao({ titulo: c.titulo, corpo: c.corpo, versao: c.versao, fontes: c.fontes.length > 0 ? c.fontes.map((f) => ({ titulo: f.titulo, autor: f.autor ?? "", url: f.url ?? "" })) : [{ titulo: "", autor: "", url: "" }] })}>
              {c.minha || c.colaboro ? "Editar" : tria ? "Acertar a forma" : "Editar antes de decidir"}
            </button>
          )}
        </>
      )}

      {pendente && me.papeis.length > 0 && (c.minha || c.colaboro || decide) && <Conjunto c={c} me={me} decide={decide} depois={recarregar} sair={voltar} />}

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
        {!semParecer && pendente && (
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

      {tria && (
        <section className="border-2 border-ink p-5">
          <p className={rotulo}>Triagem</p>
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} maxLength={2000} placeholder="Recado para quem enviou (obrigatório ao barrar)" aria-label="Recado para quem enviou" className={campo} />
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className={botao} onClick={() => triar(true)}>Liberar para a fila de revisão</button>
            <button type="button" className={botaoClaro} disabled={nota.trim().length < 5} onClick={() => triar(false)}>Barrar</button>
          </div>
          <p className="mt-2 text-ink-soft">Liberar não aprova nem publica: o envio segue para educadores, revisores e curadoria. Barrar encerra o envio e manda o recado para quem enviou, se a pessoa tiver conta.</p>
        </section>
      )}

      {decide && pendente && !semParecer && (
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

type EdicaoAberta = { titulo: string; corpo: string; fontes: SourceDraft[]; versao: string };

/**
 * O editor de uma contribuição pendente. O que está sendo escrito fica guardado como rascunho (neste navegador e na conta):
 * fechou a página no meio, volta de onde parou. Guardar de verdade continua sendo o botão.
 */
function Edicao({ id, c, edicao, setEdicao, mudou, exigeFonte, podeImagem, ocupado, guardar }: { id: string; c: Completa; edicao: EdicaoAberta; setEdicao: (e: EdicaoAberta | null) => void; mudou: boolean; exigeFonte: boolean; podeImagem: boolean; ocupado: boolean; guardar: () => Promise<boolean> }) {
  const rascunho = useRascunho<{ titulo: string; corpo: string; fontes: SourceDraft[] }>(
    `edicao:${id}`,
    { titulo: edicao.titulo, corpo: edicao.corpo, fontes: edicao.fontes },
    (dados) => setEdicao({ ...edicao, titulo: dados.titulo ?? edicao.titulo, corpo: dados.corpo ?? edicao.corpo, fontes: dados.fontes?.length ? dados.fontes : edicao.fontes }),
    { vazio: (d) => d.titulo === c.titulo && d.corpo === c.corpo },
  );
  return (
    <div className="space-y-4">
      {mudou && (
        <p role="alert" className="border-2 border-oxblood bg-parchment-deep p-4">
          <strong>{c.editado_por || "Outra pessoa"}</strong> guardou alterações enquanto você editava. Copie o que você escreveu, abra a versão nova e aplique de novo: assim ninguém perde trabalho.{" "}
          <button type="button" className={elo} onClick={() => setEdicao(null)}>Abrir a versão nova</button>
        </p>
      )}
      {rascunho.restaurado && rascunho.salvoEm && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border border-rule bg-parchment-deep px-4 py-2 text-ink-soft">
          <span>Recuperamos a edição que você estava fazendo (guardada às {horaDoRascunho(rascunho.salvoEm)}).</span>
          <button type="button" className={elo} onClick={() => { rascunho.limpar(); setEdicao({ ...edicao, titulo: c.titulo, corpo: c.corpo, fontes: c.fontes.length > 0 ? c.fontes.map((f) => ({ titulo: f.titulo, autor: f.autor ?? "", url: f.url ?? "" })) : [{ titulo: "", autor: "", url: "" }] }); }}>
            Descartar e voltar à versão guardada
          </button>
        </p>
      )}
      <label className="block">
        Título
        <input value={edicao.titulo} onChange={(e) => setEdicao({ ...edicao, titulo: e.target.value })} maxLength={160} className={campo} />
      </label>
      <MarkdownEditor id="edicao-corpo" value={edicao.corpo} onChange={(corpo) => setEdicao({ ...edicao, corpo })} labels={editorPt} upload={podeImagem} blocos />
      {exigeFonte && <SourcesField value={edicao.fontes} onChange={(fontes) => setEdicao({ ...edicao, fontes })} labels={fontesPt} />}
      <p className="font-mono text-xs text-ink-soft">{rascunho.salvoEm ? `Rascunho guardado às ${horaDoRascunho(rascunho.salvoEm)}.` : "O rascunho desta edição é guardado sozinho enquanto você escreve."}</p>
      <div className="flex gap-4">
        <button
          type="button"
          className={botao}
          disabled={ocupado || mudou}
          onClick={async () => {
            if (await guardar()) {
              rascunho.limpar();
              setEdicao(null);
            }
          }}
        >
          Guardar alterações
        </button>
        <button type="button" className={elo} onClick={() => { rascunho.limpar(); setEdicao(null); }}>Cancelar</button>
      </div>
    </div>
  );
}

/**
 * Trabalho em conjunto: quem enviou (ou a curadoria) chama um colega específico para mexer nesta contribuição.
 * O acesso vale só para ela, só enquanto está pendente, e é tirado quando quem liberou quiser.
 */
function Conjunto({ c, me, decide, depois, sair }: { c: Completa; me: Me; decide: boolean; depois: () => void; sair: () => void }) {
  const { t } = useI18n();
  const manda = c.minha || decide;
  const membros = useLista<Membro[]>("equipe_membros");
  const acao = useAcao(depois);
  const [escolha, setEscolha] = useState("");
  const dentro = new Set(c.colaboradores.map((pessoa) => pessoa.id));
  const livres = membros.dados?.filter((membro) => !membro.eu && !dentro.has(membro.id)) ?? [];
  const funcoes = (membro: Membro) =>
    [...new Set(membro.papeis.map((papel) => `${papeis[papel.papel]}${papel.disciplina ? ` de ${t.areas[papel.disciplina as keyof typeof t.areas]?.[0] ?? papel.disciplina}` : ""}`))].join(", ");
  const opcoes = livres.map((membro) => ({ id: membro.id, nome: membro.nome, email: funcoes(membro) }));

  return (
    <section className="border border-rule bg-parchment-deep p-5">
      <p className={rotulo}>Trabalho em conjunto</p>
      <p className="mt-1 text-ink-soft">
        {manda
          ? "Precisa de um gráfico, de uma imagem, de uma revisão? Chame um colega: ele recebe o recado na hora e passa a poder abrir e editar só esta contribuição, até você tirar o acesso ou ela ser decidida."
          : "Você foi chamado para trabalhar nesta contribuição. Pode abrir e editar enquanto ela estiver pendente."}
      </p>
      {c.colaboradores.length > 0 && (
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          {c.colaboradores.map((pessoa) => (
            <li key={pessoa.id} className="flex flex-wrap items-baseline justify-between gap-3 py-2">
              <span>
                <strong>{pessoa.nome}</strong>
                {pessoa.id === me.id && " (você)"}
              </span>
              {pessoa.id === me.id ? (
                <button
                  type="button"
                  className={elo}
                  disabled={acao.ocupado}
                  onClick={async () => {
                    try {
                      await rpc("colaboracao_fechar", { p_id: c.id, p_usuario: pessoa.id });
                      sair();
                    } catch (erro) {
                      acao.setAviso(textoDoErro(erro));
                    }
                  }}
                >
                  Sair desta colaboração
                </button>
              ) : (
                manda && (
                  <button type="button" className={elo} disabled={acao.ocupado} onClick={() => acao.agir("colaboracao_fechar", { p_id: c.id, p_usuario: pessoa.id }, "Acesso retirado.")}>
                    Tirar o acesso
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      {manda && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            Chamar
            <BuscaDePessoa rotulo="Chamar alguém da equipe" entre={opcoes} escolhida={opcoes.find((pessoa) => pessoa.id === escolha) ?? null} escolher={(pessoa) => setEscolha(pessoa?.id ?? "")} />
          </div>
          <button
            type="button"
            className={botao}
            disabled={acao.ocupado || !escolha}
            onClick={async () => {
              const ok = await acao.agir("colaboracao_abrir", { p_id: c.id, p_usuario: escolha }, "Acesso liberado. A pessoa já recebeu o recado.");
              if (ok) setEscolha("");
            }}
          >
            Liberar acesso
          </button>
        </div>
      )}
      <Aviso texto={membros.erro || acao.aviso} />
    </section>
  );
}
