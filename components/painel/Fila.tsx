// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ArrowDown, Check, ClipboardCheck, PenLine, Send, ShieldCheck, Undo2, UserPlus, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { can, rpc, type Me } from "@/lib/backend";
import { horaDoRascunho, useRascunho } from "@/lib/rascunho";
import tipos from "@/lib/tipos.json";
import { cleanSources, MarkdownEditor, SourcesField, type SourceDraft } from "../Editor";
import { useI18n } from "../I18n";
import { Markdown } from "../Markdown";
import { agirOtimista, data, dataHora, papeis, situacoes, textoDoErro, useAcao, useLista } from "./comum";
import { BuscaDePessoa } from "./BuscaDePessoa";
import type { Membro } from "./Equipe";
import { editorPt, fontesPt } from "./Escrever";
import { MoldeFila } from "./moldes";
import { SugestoesDaRevisao } from "./Sugestoes";
import { Esteira, LadoALado } from "./Esteira";
import { Abas, Area, Botao, CabecalhoDeSecao, Campo, Cartao, type ComandoDaSecao, Faixa, ItemDeLista, Lista, perguntarTexto, Selo, type TomDoSelo, useComandosDaSecao, Vazio } from "./ui";

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

/** A lista que a tela mostra (a mesma chave do useLista), para a decisão otimista tirar o item dela na hora. */
type ListaDaTela = { funcao: string; argumentos: Record<string, unknown> };

const nomeDoTipo = (tipo: string) => (tipos as Record<string, { rotulo: string }>)[tipo]?.rotulo ?? (tipo === "correcao" ? "Correção" : tipo);
/** Veio de fora e a mediação ainda não leu. */
const naTriagem = (item: Resumo) => item.status === "pendente" && item.triagem === "aguardando";
/** As situações da fila, na ordem do trabalho, e o que dizer quando uma está vazia. */
const SITUACOES_DA_FILA = [
  { id: "pendente", nome: "Esperando revisão", vazia: "Nada esperando revisão. Quando chegar uma contribuição, ela aparece aqui e você recebe um recado na Mesa." },
  { id: "aprovada", nome: "Aprovadas", vazia: "Nenhuma aprovada esperando a próxima publicação do site." },
  { id: "publicada", nome: "No ar", vazia: "Nada publicado por esta fila ainda." },
  { id: "recusada", nome: "Não aprovadas", vazia: "Nenhuma contribuição recusada." },
  { id: "resolvida", nome: "Resolvidas", vazia: "Nenhuma correção resolvida ainda." },
];
const origem: Record<string, string> = { publico: "contribuição pública", educacao: "educador(a) da disciplina", jornalismo: "jornalismo", curadoria: "curadoria", revisao: "revisão", traducao: "tradução" };
/** A cor do selo de cada situação (a palavra é sempre a de "situacoes"). */
const TOM_DA_SITUACAO: Record<string, TomDoSelo> = { pendente: "bordo", aprovada: "info", publicada: "ok", resolvida: "ok", recusada: "erro" };

/** O vazio fala em duas partes: a primeira frase vira o título e o resto, o texto. */
function partir(frase: string): { titulo: string; texto?: string } {
  const ponto = frase.indexOf(". ");
  return ponto < 0 ? { titulo: frase } : { titulo: frase.slice(0, ponto + 1), texto: frase.slice(ponto + 2) };
}

/** O recado de uma ação (o que antes ia no "Aviso"): em faixa, só quando há o que dizer. */
function Recado({ texto }: { texto: string }) {
  return texto ? <Faixa tom="info">{texto}</Faixa> : null;
}

/**
 * A mesma lista em quatro usos: a fila de revisão (quem tem função lê e dá parecer; curadoria e coordenação decidem),
 * os envios da própria pessoa, as contribuições de colegas que a chamaram para trabalhar junto, e a triagem
 * (a mediação lê primeiro o que vem de fora e decide se segue para a fila de revisão). Molde Fila: a lista de um lado e
 * o envio aberto do outro (a divisória se arrasta; j/k percorrem; Ctrl K traz aprovar, devolver, recusar, chamar alguém
 * e próximo).
 */
export function Fila({ me, minhas = false, juntas = false, triagem = false }: { me: Me; minhas?: boolean; juntas?: boolean; triagem?: boolean }) {
  const { t } = useI18n();
  const [status, setStatus] = useState("pendente");
  const propria = minhas || juntas;
  const daTela: ListaDaTela = { funcao: minhas ? "contribuicoes_minhas" : juntas ? "colaboracoes_minhas" : triagem ? "triagem_fila" : "fila", argumentos: propria || triagem ? {} : { p_status: status } };
  const lista = useLista<Resumo[]>(daTela.funcao, daTela.argumentos);
  const vazia = minhas ? "Você ainda não enviou nada." : juntas ? "Ninguém chamou você para trabalhar junto por enquanto. Quando chamar, a contribuição aparece aqui e você recebe um recado na Mesa." : triagem ? "Nada esperando a triagem." : (SITUACOES_DA_FILA.find((s) => s.id === status)?.vazia ?? "Nada nesta situação.");
  const nomeDaArea = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug;

  return (
    <div className="pn-tela">
      {triagem && (
        <p className="pn-sobre">
          Aqui chega tudo o que o público envia, antes de ir para a mesa de educadores e revisores. Barre propaganda, vandalismo, texto sem pé nem cabeça e envio repetido; acerte a forma se for
          só isso que falta; e libere o resto. Julgar se o conteúdo está certo não é desta etapa: isso é da fila de revisão.
        </p>
      )}
      {!propria && !triagem && <Abas rotulo="Fila de revisão" opcoes={SITUACOES_DA_FILA.map(({ id, nome }) => ({ id, nome }))} valor={status} aoMudar={setStatus} />}
      {lista.erro ? (
        <Faixa
          tom="erro"
          acao={
            <Botao pequeno onClick={lista.recarregar}>
              Tentar de novo
            </Botao>
          }
        >
          {lista.erro}
        </Faixa>
      ) : (
        <MoldeFila
          id="fila-revisao"
          rotulo={minhas ? "Meus envios" : juntas ? "Trabalho em conjunto" : triagem ? "Triagem" : "Fila de revisão"}
          itens={lista.dados ?? []}
          chave={(item) => item.id}
          carregando={lista.dados === null}
          vazio={<Vazio simbolo={triagem ? ShieldCheck : minhas ? Send : juntas ? Users : ClipboardCheck} {...partir(vazia)} />}
          linha={(item) => (
            <span style={{ display: "grid", gap: "0.2rem", minWidth: 0 }}>
              <span className="pn-rotulo-mono">
                {nomeDoTipo(item.tipo)}
                {item.disciplina && ` · ${nomeDaArea(item.disciplina)}`} · {data(item.criado_em)}
              </span>
              <span className="font-serif text-lg font-semibold leading-snug">{item.titulo}</span>
              <span className="pn-item-meta" style={{ whiteSpace: "normal" }}>
                {item.nome_autor || "sem nome"} · {origem[item.como] ?? item.como}
                {item.pareceres > 0 && ` · ${item.pareceres} parecer(es)`}
              </span>
              <span style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                <Selo tom={naTriagem(item) ? "aviso" : (TOM_DA_SITUACAO[item.status] ?? "neutro")}>{naTriagem(item) ? "aguardando a triagem" : (situacoes[item.status] ?? item.status)}</Selo>
              </span>
              {minhas && item.nota && <span className="pn-item-meta" style={{ whiteSpace: "normal" }}>Recado da curadoria: {item.nota}</span>}
            </span>
          )}
          detalhe={(item, proximo) => <Detalhe key={item.id} id={item.id} me={me} semParecer={propria || triagem} esteira={propria} triagem={triagem} daTela={daTela} proximo={proximo} voltar={lista.recarregar} />}
        />
      )}
    </div>
  );
}

function Detalhe({ id, me, semParecer, esteira, triagem = false, daTela, proximo, voltar }: { id: string; me: Me; semParecer: boolean; esteira: boolean; triagem?: boolean; daTela: ListaDaTela; proximo: () => void; voltar: () => void }) {
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
  const decide = can(me, "coordenacao", "curadoria");
  const pendente = c?.status === "pendente";
  /** Esta pessoa está fazendo a triagem deste envio. */
  const tria = Boolean(c) && triagem && pendente && c?.triagem === "aguardando";
  const decideAqui = decide && pendente && !semParecer;
  const daParecer = !semParecer && pendente;

  /** Decisão simples e otimista: o envio sai da lista na hora (e a fila anda); se o banco recusar, ele volta. */
  async function triar(liberar: boolean, recado = nota) {
    const ok = await agirOtimista<Resumo[]>({ lista: daTela, remendo: (dados) => dados.filter((e) => e.id !== id), funcao: "triagem_decidir", argumentos: { p_id: id, p_liberar: liberar, p_nota: recado } });
    if (ok) voltar();
  }

  async function decidir(aprovar: boolean) {
    const ok = await agirOtimista<Resumo[]>({ lista: daTela, remendo: (dados) => dados.filter((e) => e.id !== id), funcao: "contribuicao_decidir", argumentos: { p_id: id, p_aprovar: aprovar, p_nota: nota } });
    if (ok) voltar();
  }

  async function darParecer(favoravel: boolean, texto = parecer) {
    const ok = await acao.agir("parecer", { p_id: id, p_favoravel: favoravel, p_texto: texto }, "Parecer registrado.");
    if (ok) setParecer("");
  }

  /** "Devolver com comentário" pela paleta: o parecer que pede ajustes; sem texto ainda, pergunta antes. */
  async function devolver() {
    const texto = parecer.trim().length >= 3 ? parecer : await perguntarTexto("Conferiu datas, contas e fontes? Diga o que viu.", "", { multilinha: true, obrigatorio: true });
    if (texto && texto.trim().length >= 3) await darParecer(false, texto);
  }

  /** "Barrar" pela paleta: o recado é obrigatório, então pergunta se ainda não foi escrito. */
  async function barrar() {
    const recado = nota.trim().length >= 5 ? nota : await perguntarTexto("Recado para quem enviou (obrigatório ao barrar)", "", { multilinha: true, obrigatorio: true });
    if (recado && recado.trim().length >= 5) await triar(false, recado);
  }

  const comandos: ComandoDaSecao[] = [
    ...(decideAqui
      ? [
          { id: "aprovar", nome: "Aprovar", simbolo: Check, fazer: () => decidir(true) },
          { id: "recusar", nome: "Recusar", sobre: "Não aprovar", simbolo: X, fazer: () => decidir(false) },
        ]
      : []),
    ...(daParecer ? [{ id: "devolver", nome: "Devolver com comentário", sobre: "Pedir ajustes", simbolo: Undo2, fazer: devolver }] : []),
    ...(tria
      ? [
          { id: "liberar", nome: "Liberar para a fila de revisão", simbolo: Check, fazer: () => triar(true) },
          { id: "barrar", nome: "Barrar", simbolo: X, fazer: barrar },
        ]
      : []),
    { id: "proximo", nome: "Próximo", simbolo: ArrowDown, atalho: "j", fazer: proximo },
  ];
  useComandosDaSecao(comandos, [id, decideAqui, daParecer, tria]);

  if (!c) return item.erro ? <Faixa tom="erro" acao={<Botao pequeno onClick={recarregar}>Tentar de novo</Botao>}>{item.erro}</Faixa> : <p role="status" className="pn-ajuda">Carregando…</p>;

  const podeEditar = pendente && (decide || c.minha || c.colaboro || tria);
  /** Alguém guardou outra versão enquanto esta pessoa está com o editor aberto. */
  const mudou = edicao !== null && edicao.versao !== c.versao;
  const exigeFonte = (tipos as Record<string, { fonte: boolean }>)[c.tipo]?.fonte ?? false;

  return (
    <div className="pn-secao">
      <CabecalhoDeSecao
        rotulo={
          <>
            {nomeDoTipo(c.tipo)}
            {c.disciplina && ` · ${t.areas[c.disciplina as keyof typeof t.areas]?.[0] ?? c.disciplina}`} · {naTriagem(c) ? "aguardando a triagem" : (situacoes[c.status] ?? c.status)}
          </>
        }
        titulo={c.titulo}
        sobre={
          <>
            {c.nome_autor || "sem nome"} · {origem[c.como] ?? c.como} · {data(c.criado_em)}
          </>
        }
      />
      {(c.alvo || c.editado_em) && (
        <div className="pn-ajuda" style={{ display: "grid", gap: "0.2rem" }}>
          {c.alvo && <p className="font-mono text-xs">página: {c.alvo}</p>}
          {c.editado_em && <p>Última alteração: {c.editado_por || "alguém da equipe"}, {dataHora(c.editado_em)}</p>}
        </div>
      )}
      {esteira && <Esteira status={c.status} triagem={c.triagem} pareceres={c.pareceres} publico={c.como === "publico"} />}
      {c.minha && c.nota && <Faixa tom="info">Recado da curadoria: {c.nota}</Faixa>}

      {Object.keys(c.dados).length > 0 && (
        <Cartao as="div" variante="plano">
          <dl className="pn-definicoes" style={{ marginTop: 0 }}>
            {Object.entries(c.dados).map(([chave, valor]) => (
              <div key={chave}>
                <dt className="pn-rotulo-mono">{chave}</dt>
                <dd className="break-words whitespace-pre-line" data-original>
                  {String(valor)}
                </dd>
              </div>
            ))}
          </dl>
        </Cartao>
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
          <Cartao as="div" variante="plano" className="font-serif" lang="pt-BR" translate="no">
            <Markdown lang={lang}>{c.corpo || "*Sem texto.*"}</Markdown>
          </Cartao>
          {c.fontes.length > 0 ? (
            <div>
              <p className="pn-rotulo-mono">Fontes</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {c.fontes.map((fonte) => (
                  <li key={`${fonte.titulo}${fonte.url ?? ""}`}>
                    {fonte.autor && `${fonte.autor}. `}
                    {fonte.url ? (
                      <a href={fonte.url} target="_blank" rel="noopener noreferrer nofollow" className="pn-elo">
                        {fonte.titulo}
                      </a>
                    ) : (
                      fonte.titulo
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            exigeFonte && (
              <p>
                <Selo tom="erro">Sem fontes.</Selo>
              </p>
            )
          )}
          {podeEditar && (
            <div>
              <Botao simbolo={PenLine} onClick={() => setEdicao({ titulo: c.titulo, corpo: c.corpo, versao: c.versao, fontes: c.fontes.length > 0 ? c.fontes.map((f) => ({ titulo: f.titulo, autor: f.autor ?? "", url: f.url ?? "" })) : [{ titulo: "", autor: "", url: "" }] })}>
                {c.minha || c.colaboro ? "Editar" : tria ? "Acertar a forma" : "Editar antes de decidir"}
              </Botao>
            </div>
          )}
          <SugestoesDaRevisao id={id} podeSugerir={pendente && !c.minha && !semParecer && !tria} podeResponder={pendente && (c.minha || c.colaboro || decide)} depois={recarregar} />
        </>
      )}

      {pendente && me.papeis.length > 0 && (c.minha || c.colaboro || decide) && <Conjunto c={c} me={me} decide={decide} depois={recarregar} sair={voltar} />}

      <Cartao titulo="Pareceres" nivelDoTitulo={3} variante="plano">
        {c.lista_pareceres.length === 0 && <p className="pn-ajuda">Nenhum parecer ainda.</p>}
        {c.lista_pareceres.length > 0 && (
          <ul className="pn-lista">
            {c.lista_pareceres.map((p, i) => (
              <li key={i} className="pn-item" style={{ alignItems: "flex-start", paddingBlock: "0.6rem" }}>
                <span className="pn-item-texto" style={{ display: "grid", gap: "0.2rem", minWidth: 0, flex: 1 }}>
                  <span>{p.texto}</span>
                  <span className="pn-item-meta">
                    {p.nome} · {data(p.criado_em)}
                  </span>
                </span>
                <Selo tom={p.favoravel ? "ok" : "aviso"}>{p.favoravel ? "favorável" : "pede ajustes"}</Selo>
              </li>
            ))}
          </ul>
        )}
        {daParecer && (
          <div className="mt-3 grid gap-2">
            <Area rotulo="Seu parecer" value={parecer} onChange={(e) => setParecer(e.target.value)} rows={3} maxLength={2000} placeholder="Conferiu datas, contas e fontes? Diga o que viu." />
            <div className="flex flex-wrap gap-2">
              {[true, false].map((favoravel) => (
                <Botao key={String(favoravel)} simbolo={favoravel ? Check : Undo2} disabled={acao.ocupado || parecer.trim().length < 3} onClick={() => void darParecer(favoravel)}>
                  {favoravel ? "Parecer favorável" : "Pedir ajustes"}
                </Botao>
              ))}
            </div>
          </div>
        )}
      </Cartao>

      {tria && (
        <Cartao titulo="Triagem" nivelDoTitulo={3} variante="destaque">
          <div className="grid gap-3">
            <Area rotulo="Recado para quem enviou" value={nota} onChange={(e) => setNota(e.target.value)} rows={2} maxLength={2000} placeholder="Recado para quem enviou (obrigatório ao barrar)" />
            <div className="flex flex-wrap gap-2">
              <Botao variante="principal" simbolo={Check} onClick={() => void triar(true)}>
                Liberar para a fila de revisão
              </Botao>
              <Botao simbolo={X} disabled={nota.trim().length < 5} onClick={() => void triar(false)}>
                Barrar
              </Botao>
            </div>
            <p className="pn-ajuda">Liberar não aprova nem publica: o envio segue para educadores, revisores e curadoria. Barrar encerra o envio e manda o recado para quem enviou, se a pessoa tiver conta.</p>
          </div>
        </Cartao>
      )}

      {decideAqui && (
        <Cartao titulo="Decisão da curadoria" nivelDoTitulo={3} variante="destaque">
          <div className="grid gap-3">
            <Area rotulo="Recado para quem enviou" value={nota} onChange={(e) => setNota(e.target.value)} rows={2} maxLength={2000} placeholder="Recado para quem enviou (opcional)" />
            <div className="flex flex-wrap gap-2">
              <Botao variante="principal" simbolo={Check} onClick={() => void decidir(true)}>
                Aprovar
              </Botao>
              <Botao simbolo={X} onClick={() => void decidir(false)}>
                Não aprovar
              </Botao>
            </div>
            <p className="pn-ajuda">Aprovar não publica na hora: o texto entra no site na próxima publicação e fica guardado no histórico.</p>
          </div>
        </Cartao>
      )}
      <Recado texto={acao.aviso} />
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
    <div className="pn-secao">
      {mudou && (
        <Faixa
          tom="erro"
          acao={
            <Botao pequeno onClick={() => setEdicao(null)}>
              Abrir a versão nova
            </Botao>
          }
        >
          <strong>{c.editado_por || "Outra pessoa"}</strong> guardou alterações enquanto você editava. Copie o que você escreveu, abra a versão nova e aplique de novo: assim ninguém perde trabalho.
        </Faixa>
      )}
      {rascunho.restaurado && rascunho.salvoEm && (
        <Faixa
          tom="info"
          acao={
            <Botao
              pequeno
              variante="discreto"
              onClick={() => {
                rascunho.limpar();
                setEdicao({ ...edicao, titulo: c.titulo, corpo: c.corpo, fontes: c.fontes.length > 0 ? c.fontes.map((f) => ({ titulo: f.titulo, autor: f.autor ?? "", url: f.url ?? "" })) : [{ titulo: "", autor: "", url: "" }] });
              }}
            >
              Descartar e voltar à versão guardada
            </Botao>
          }
        >
          Recuperamos a edição que você estava fazendo (guardada às {horaDoRascunho(rascunho.salvoEm)}).
        </Faixa>
      )}
      <Campo rotulo="Título" value={edicao.titulo} onChange={(e) => setEdicao({ ...edicao, titulo: e.target.value })} maxLength={160} />
      <MarkdownEditor id="edicao-corpo" value={edicao.corpo} onChange={(corpo) => setEdicao({ ...edicao, corpo })} labels={editorPt} upload={podeImagem} blocos />
      {exigeFonte && <SourcesField value={edicao.fontes} onChange={(fontes) => setEdicao({ ...edicao, fontes })} labels={fontesPt} />}
      <details>
        <summary className="cursor-pointer text-sm font-semibold">Ver as mudanças lado a lado</summary>
        <div className="mt-2">
          <LadoALado antes={c.corpo} depois={edicao.corpo} />
        </div>
      </details>
      <p className="pn-ajuda font-mono text-xs">{rascunho.salvoEm ? `Rascunho guardado às ${horaDoRascunho(rascunho.salvoEm)}.` : "O rascunho desta edição é guardado sozinho enquanto você escreve."}</p>
      <div className="flex flex-wrap gap-2">
        <Botao
          variante="principal"
          disabled={ocupado || mudou}
          carregando={ocupado}
          onClick={async () => {
            if (await guardar()) {
              rascunho.limpar();
              setEdicao(null);
            }
          }}
        >
          Guardar alterações
        </Botao>
        <Botao
          variante="discreto"
          onClick={() => {
            rascunho.limpar();
            setEdicao(null);
          }}
        >
          Cancelar
        </Botao>
      </div>
    </div>
  );
}

/**
 * Trabalho em conjunto: quem enviou (ou a curadoria) chama um colega específico para mexer nesta contribuição.
 * O acesso vale só para ela, só enquanto está pendente, e é tirado quando quem liberou quiser. Pela paleta (Ctrl K),
 * "Chamar alguém para trabalhar junto" escolhe a pessoa sem mouse.
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

  const chamar = (usuario: string) => acao.agir("colaboracao_abrir", { p_id: c.id, p_usuario: usuario }, "Acesso liberado. A pessoa já recebeu o recado.");
  useComandosDaSecao(
    manda
      ? [
          {
            id: "chamar",
            nome: "Chamar alguém para trabalhar junto",
            simbolo: UserPlus,
            pedePessoa: true,
            fazer: async (pessoa) => {
              if (pessoa) await chamar(pessoa.id);
            },
          },
        ]
      : [],
    [c.id, manda],
  );

  return (
    <Cartao titulo="Trabalho em conjunto" nivelDoTitulo={3} variante="plano" sobre={manda ? "Precisa de um gráfico, de uma imagem, de uma revisão? Chame um colega: ele recebe o recado na hora e passa a poder abrir e editar só esta contribuição, até você tirar o acesso ou ela ser decidida." : "Você foi chamado para trabalhar nesta contribuição. Pode abrir e editar enquanto ela estiver pendente."}>
      <div className="mt-3 grid gap-3">
        {c.colaboradores.length > 0 && (
          <Lista rotulo="Trabalho em conjunto">
            {c.colaboradores.map((pessoa) => (
              <ItemDeLista
                key={pessoa.id}
                titulo={
                  <>
                    <strong>{pessoa.nome}</strong>
                    {pessoa.id === me.id && " (você)"}
                  </>
                }
                acoes={
                  pessoa.id === me.id ? (
                    <Botao
                      pequeno
                      variante="discreto"
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
                    </Botao>
                  ) : (
                    manda && (
                      <Botao pequeno variante="discreto" perigo disabled={acao.ocupado} onClick={() => acao.agir("colaboracao_fechar", { p_id: c.id, p_usuario: pessoa.id }, "Acesso retirado.")}>
                        Tirar o acesso
                      </Botao>
                    )
                  )
                }
              />
            ))}
          </Lista>
        )}
        {manda && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <span className="pn-rotulo">Chamar</span>
              <BuscaDePessoa rotulo="Chamar alguém da equipe" entre={opcoes} escolhida={opcoes.find((pessoa) => pessoa.id === escolha) ?? null} escolher={(pessoa) => setEscolha(pessoa?.id ?? "")} />
            </div>
            <Botao
              simbolo={UserPlus}
              disabled={acao.ocupado || !escolha}
              onClick={async () => {
                const ok = await chamar(escolha);
                if (ok) setEscolha("");
              }}
            >
              Liberar acesso
            </Botao>
          </div>
        )}
        <Recado texto={membros.erro || acao.aviso} />
      </div>
    </Cartao>
  );
}
