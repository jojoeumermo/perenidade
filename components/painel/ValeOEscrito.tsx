// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Archive, ArrowLeft, Check, ExternalLink, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type Me, rpc } from "@/lib/backend";
import {
  acrescentarResposta,
  atualizarSituacao,
  docEmBranco,
  type DocumentoDeEntrada,
  hojeISO,
  type ItemDaFila,
  type ItemDeCorrecao,
  LEI_13188,
  prazoDaCorrecao,
  rascunhoDoItem,
} from "@/lib/vale-o-escrito/curadoria";
import { type Fonte, ROTULO_SITUACAO, SITUACOES, type Situacao, TIPOS_DE_FONTE } from "@/lib/vale-o-escrito/tipos";
import { Aviso, dataHora, textoDoErro, useLista } from "./comum";
import { MoldeFila } from "./moldes";
import { EditorDeEntrada, NOME_DO_DOSSIE, pedirArquivo, TOM_DA_SITUACAO } from "./ValeOEscritoEditor";
import { Abas, Area, Botao, Busca, Campo, Cartao, confirmarFrase, Esqueleto, Faixa, ItemDeLista, Lista, Selecao, Selo, Vazio } from "./ui";

// O painel existe só em português. Função "Vale o Escrito: curadoria" (docs/vale-o-escrito/ESPEC.md): fila de sugestões
// do robô e envios do público, entrada manual, entradas publicadas (atualizar situação, refazer arquivo, retirar) e
// correções e direito de resposta com prazo. O papel é "curadoria" (ou coordenação): o banco confere de novo em cada função.

type Aba = "fila" | "nova" | "publicadas" | "correcoes";

const ESTADOS_DA_FILA: { id: string; nome: string }[] = [
  { id: "pendente", nome: "Novas" },
  { id: "em_revisao", nome: "Em revisão" },
  { id: "devolvida", nome: "Devolvidas" },
  { id: "recusada", nome: "Recusadas" },
  { id: "aprovada", nome: "Aprovadas" },
];
const ORIGEM: Record<string, string> = { robo: "Robô", equipe: "Equipe", publico: "Público" };
const TIPO_DA_CORRECAO: Record<string, string> = { correcao: "Correção", direito_de_resposta: "Direito de resposta", remocao_de_dado: "Remoção de dado" };
const TIPOS_DE_FONTE_NOME: Record<string, string> = { processo: "Processo", investigacao_oficial: "Investigação oficial", dado_oficial: "Dado oficial", relatorio_organizacao: "Relatório de organização", reportagem: "Reportagem", checagem: "Checagem" };

export function ValeOEscritoCuradoria({ me }: { me: Me }) {
  void me;
  const [aba, setAba] = useState<Aba>("fila");
  return (
    <div className="pn-tela">
      <p className="pn-sobre">
        A curadoria do observatório: só entra o que já está em fonte pública, com fonte, data, trecho e a situação jurídica escrita. Quem aprova fica anônimo para o público (a ficha mostra “curadoria do Vale o Escrito”); o nome fica só no histórico
        interno. O observatório continua desligado no site até a curadoria revisar as entradas e a assessoria jurídica conferir.
      </p>
      <Abas<Aba>
        rotulo="Vale o Escrito"
        opcoes={[
          { id: "fila", nome: "Fila" },
          { id: "nova", nome: "Entrada manual" },
          { id: "publicadas", nome: "Publicadas" },
          { id: "correcoes", nome: "Correções e respostas" },
        ]}
        valor={aba}
        aoMudar={setAba}
        painel={(atual) => (
          <>
            {atual === "fila" && <FilaDaCuradoria />}
            {atual === "nova" && <EditorDeEntrada key="nova" inicial={docEmBranco(hojeISO())} irmaos={[]} fechar={() => setAba("fila")} depois={() => undefined} />}
            {atual === "publicadas" && <Publicadas />}
            {atual === "correcoes" && <Correcoes />}
          </>
        )}
      />
    </div>
  );
}

// ───────────────────────────── Fila ─────────────────────────────

const tituloDoItem = (x: ItemDaFila) => x.rascunho?.titulo || x.sugestao_titulo || x.sugestao_url || x.envio_url || "Entrada sem título";

/**
 * A fila de sugestões no molde Fila: a lista à esquerda (por estado) e o editor da sugestão aberta à direita. "Fechar sem
 * guardar" desfaz o que foi mexido no editor (ele volta ao rascunho guardado); decidir tira a sugestão da lista e a fila anda.
 */
function FilaDaCuradoria() {
  const [estado, setEstado] = useState("pendente");
  const lista = useLista<ItemDaFila[]>("vale_fila_listar", { p_estado: estado });
  const abertos = useLista<ItemDaFila[]>("vale_fila_listar", { p_estado: "pendente" });
  const [recomeco, setRecomeco] = useState(0);
  const hoje = useMemo(() => hojeISO(), []);
  const refazer = () => {
    lista.recarregar();
    abertos.recarregar();
  };

  return (
    <div className="pn-tela">
      <Abas
        rotulo="Estado"
        opcoes={ESTADOS_DA_FILA.map((e) => ({ id: e.id, nome: e.nome, conta: e.id === "pendente" ? abertos.dados?.length : undefined }))}
        valor={estado}
        aoMudar={setEstado}
      />
      {lista.erro && (
        <Faixa tom="erro" acao={<Botao pequeno onClick={lista.recarregar}>Tentar de novo</Botao>}>
          {lista.erro}
        </Faixa>
      )}
      <MoldeFila<ItemDaFila>
        id="vale-fila"
        rotulo="Fila"
        itens={lista.dados ?? []}
        carregando={!lista.dados && !lista.erro}
        chave={(x) => x.id}
        vazio={<Vazio titulo="Nada aqui. O robô acrescenta achados sozinho; o público envia fontes pelo site quando o observatório estiver aberto." />}
        linha={(x) => (
          <>
            <span className="pn-rotulo-mono">
              {ORIGEM[x.origem]} · {dataHora(x.criado_em)}
            </span>
            <strong>{tituloDoItem(x)}</strong>
            {(x.sugestao_url || x.envio_url) && <span className="pn-ajuda break-all">{x.sugestao_url ?? x.envio_url}</span>}
            {x.nota && <span className="pn-ajuda">Nota: {x.nota}</span>}
          </>
        )}
        detalhe={(aberto) => {
          const editavel = ["pendente", "em_revisao", "devolvida"].includes(aberto.estado);
          if (!editavel) {
            return (
              <div className="pn-secao">
                <h3 className="pn-cartao-titulo">{tituloDoItem(aberto)}</h3>
                {aberto.envio_descricao && <p>{aberto.envio_descricao}</p>}
                <Faixa tom="info">
                  Esta sugestão já foi decidida ({aberto.estado}). {aberto.nota ? `Nota: ${aberto.nota}` : ""} Para mudar uma entrada publicada, use a aba Publicadas.
                </Faixa>
              </div>
            );
          }
          return (
            <EditorDeEntrada
              key={`${aberto.id}-${recomeco}`}
              item={aberto}
              inicial={rascunhoDoItem(aberto, hoje)}
              irmaos={(abertos.dados ?? []).filter((x) => x.id !== aberto.id)}
              // Decidida, a sugestão sai da lista e a fila anda sozinha; "Fechar sem guardar" só desfaz o que foi mexido.
              fechar={() => setRecomeco((n) => n + 1)}
              depois={refazer}
            />
          );
        }}
      />
    </div>
  );
}

// ───────────────────────────── Publicadas ─────────────────────────────

interface LinhaPublicada {
  id: string;
  dossie: string;
  situacao: Situacao;
  atualizado_em: string;
  doc: DocumentoDeEntrada;
}

/** As entradas no ar: leitura pública pela função public.vale_publicadas (a tabela mora em interno, sem acesso direto). */
async function lerPublicadas(): Promise<LinhaPublicada[]> {
  const dados = await rpc<LinhaPublicada[] | null>("vale_publicadas", {});
  return (dados ?? []).slice(0, 300);
}

function Publicadas() {
  const [linhas, setLinhas] = useState<LinhaPublicada[] | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  const carregar = useCallback(() => {
    lerPublicadas()
      .then((l) => {
        setLinhas(l);
        setErro("");
      })
      .catch(() => setErro("Não foi possível ler as entradas publicadas agora."));
  }, []);
  useEffect(carregar, [carregar]);
  const escolhida = linhas?.find((l) => l.id === aberta);
  if (escolhida) return <FichaPublicada linha={escolhida} voltar={() => setAberta(null)} depois={carregar} />;
  const achadas = (linhas ?? []).filter((l) => !busca.trim() || `${l.id} ${l.doc.titulo}`.toLowerCase().includes(busca.trim().toLowerCase()));
  return (
    <div className="pn-tela">
      <div className="max-w-md">
        <Busca rotulo="Procurar entrada" rotuloVisivel valor={busca} aoMudar={setBusca} placeholder="Título ou código" />
      </div>
      {erro && (
        <Faixa tom="erro" acao={<Botao pequeno onClick={carregar}>Tentar de novo</Botao>}>
          {erro}
        </Faixa>
      )}
      {!linhas && !erro && <Esqueleto forma="linhas" linhas={4} />}
      {linhas && linhas.length === 0 && <Vazio titulo="Nenhuma entrada publicada ainda." simbolo={Search} />}
      {achadas.length > 0 && (
        <Lista rotulo="Publicadas">
          {achadas.map((l) => (
            <ItemDeLista
              key={l.id}
              aoClicar={() => setAberta(l.id)}
              titulo={l.doc.titulo}
              meta={
                <>
                  {NOME_DO_DOSSIE[l.dossie] ?? l.dossie} · atualizada em {l.doc.atualizadoEm}
                </>
              }
              selo={
                <span className="flex flex-wrap gap-1">
                  {l.doc.fontes.some((f) => f.arquivoFalhou) && <Selo tom="aviso">Arquivo de fonte em refação</Selo>}
                  <Selo tom={TOM_DA_SITUACAO[l.situacao]}>{ROTULO_SITUACAO[l.situacao]}</Selo>
                </span>
              }
            />
          ))}
        </Lista>
      )}
    </div>
  );
}

interface LinhaDeHistorico {
  id: number;
  acao: string;
  nota: string | null;
  em: string;
  quem: string | null;
}

function FichaPublicada({ linha, voltar, depois }: { linha: LinhaPublicada; voltar: () => void; depois: () => void }) {
  const doc = linha.doc;
  const hoje = useMemo(() => hojeISO(), []);
  const historico = useLista<LinhaDeHistorico[]>("vale_historico_listar", { p_entrada: linha.id });
  const [nova, setNova] = useState<Situacao>(doc.situacao);
  const [nota, setNota] = useState("");
  const [fonte, setFonte] = useState<Fonte>({ id: "", veiculo: "", tipo: "processo", titulo: "", url: "", trecho: "", data: hoje, acessadoEm: hoje });
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState("");
  const [erros, setErros] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);

  async function rodar(passo: () => Promise<void>) {
    setOcupado(true);
    setAviso("");
    setErros([]);
    try {
      await passo();
    } catch (e) {
      setAviso(textoDoErro(e));
    } finally {
      setOcupado(false);
    }
  }

  const atualizar = () =>
    rodar(async () => {
      const proximo = Math.max(0, ...doc.fontes.map((f) => Number(f.id.slice(1)) || 0)) + 1;
      const base: Fonte = { ...fonte, id: `f${proximo}`, veiculo: fonte.veiculo.trim(), url: fonte.url.trim() };
      // Confere antes de falar com o Internet Archive (a fonte nova entra com a cópia pronta, ou com a marca de falha).
      const previa = atualizarSituacao(doc, nova, { ...base, arquivoFalhou: true }, nota, hoje);
      if (!previa.ok) {
        setErros(previa.erros);
        setAviso("Falta coisa. Nada foi enviado.");
        return;
      }
      if (!(await confirmarFrase(`Mudar a situação de “${doc.titulo}” de ${ROTULO_SITUACAO[doc.situacao]} para ${ROTULO_SITUACAO[nova]}? A ficha mostra a mudança, com a fonte, na hora.`))) return;
      setAviso("Arquivando a fonte nova no Internet Archive…");
      const r = await pedirArquivo(base.url);
      const comArquivo: Fonte = r.arquivoUrl ? { ...base, arquivoUrl: r.arquivoUrl } : { ...base, arquivoFalhou: true };
      const final = atualizarSituacao(doc, nova, comArquivo, nota, hoje);
      if (!final.ok) {
        setErros(final.erros);
        return;
      }
      await rpc("vale_entrada_atualizar", { p_id: linha.id, p_doc: final.doc, p_nota: nota.trim() });
      setAviso(r.arquivoUrl ? "Situação atualizada, com o arquivo da fonte nova." : "Situação atualizada. O arquivo da fonte nova falhou: refaça abaixo.");
      depois();
      voltar();
    });

  const refazerArquivo = (f: Fonte) =>
    rodar(async () => {
      const r = await pedirArquivo(f.url);
      if (!r.arquivoUrl) {
        setAviso(r.erro ?? "O arquivo não foi feito.");
        return;
      }
      const novo: DocumentoDeEntrada = { ...doc, atualizadoEm: hoje, fontes: doc.fontes.map((x) => (x.id === f.id ? { ...x, arquivoUrl: r.arquivoUrl, arquivoFalhou: undefined } : x)) };
      await rpc("vale_entrada_atualizar", { p_id: linha.id, p_doc: JSON.parse(JSON.stringify(novo)), p_nota: `Arquivo refeito da fonte ${f.id}` });
      setAviso("Arquivo refeito.");
      depois();
    });

  const retirar = () =>
    rodar(async () => {
      if (motivo.trim().length < 3) {
        setAviso("Diga o motivo (3 letras ou mais): correção procedente, ordem judicial…");
        return;
      }
      if (!(await confirmarFrase(`Tirar “${doc.titulo}” do ar? Ela não é apagada: fica no banco e no histórico.`))) return;
      await rpc("vale_entrada_retirar", { p_id: linha.id, p_motivo: motivo.trim() });
      depois();
      voltar();
    });

  return (
    <Cartao
      as="article"
      titulo={doc.titulo}
      nivelDoTitulo={3}
      sobre={
        <>
          {linha.id} · {NOME_DO_DOSSIE[linha.dossie] ?? linha.dossie} · {ROTULO_SITUACAO[doc.situacao]} · publicada em {doc.publicadoEm}, atualizada em {doc.atualizadoEm}
        </>
      }
      acoes={
        <Botao simbolo={ArrowLeft} onClick={voltar}>
          Voltar
        </Botao>
      }
    >
      <div className="pn-secao">
        <p className="max-w-3xl">{doc.resumo}</p>

        <h4 className="font-semibold">Histórico visível na ficha</h4>
        {(doc.historico ?? []).length === 0 ? (
          <p className="pn-ajuda">Nenhuma mudança de situação desde a publicação.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {(doc.historico ?? []).map((h, i) => (
              <li key={i}>
                {h.em}: de {ROTULO_SITUACAO[h.de]} para {ROTULO_SITUACAO[h.para]} (fonte {doc.fontes.findIndex((f) => f.id === h.fonteId) + 1}){h.nota ? `. ${h.nota}` : ""}
              </li>
            ))}
          </ul>
        )}
        {(doc.respostas ?? []).length > 0 && (
          <>
            <h4 className="font-semibold">Respostas publicadas ao lado da ficha</h4>
            <ul className="list-disc pl-5 text-sm">
              {(doc.respostas ?? []).map((r, i) => (
                <li key={i}>
                  {r.em} ({r.tipo === "direito_de_resposta" ? "direito de resposta" : "retificação"}): {r.texto}
                </li>
              ))}
            </ul>
          </>
        )}

        <h4 className="font-semibold">Fontes</h4>
        <ol className="list-decimal pl-5 text-sm">
          {doc.fontes.map((f) => (
            <li key={f.id} className="mt-1">
              {f.veiculo}:{" "}
              <a className="pn-elo break-all" href={f.url} target="_blank" rel="noreferrer noopener">
                {f.titulo}
              </a>{" "}
              {f.arquivoUrl ? (
                <a className="pn-elo" href={f.arquivoUrl} target="_blank" rel="noreferrer noopener">
                  (arquivo)
                </a>
              ) : (
                <Selo tom="aviso">arquivo em refação </Selo>
              )}
              {!f.arquivoUrl && (
                <Botao variante="discreto" pequeno simbolo={RefreshCw} disabled={ocupado} onClick={() => void refazerArquivo(f)}>
                  refazer agora
                </Botao>
              )}
            </li>
          ))}
        </ol>

        <Cartao as="div" variante="plano">
          <div className="pn-secao">
            <h4 className="font-semibold">Atualizar situação (absolvição, arquivamento, nova decisão)</h4>
            <p className="pn-ajuda max-w-3xl">Exige a fonte da mudança (a decisão, a nota do tribunal, a reportagem). A ficha passa a mostrar a nova situação, a data e a fonte, e o histórico guarda a anterior.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Selecao rotulo="Nova situação" value={nova} onChange={(e) => setNova(e.target.value as Situacao)}>
                {SITUACOES.map((s) => (
                  <option key={s} value={s}>
                    {ROTULO_SITUACAO[s]}
                  </option>
                ))}
              </Selecao>
              <Selecao rotulo="Tipo da fonte nova" value={fonte.tipo} onChange={(e) => setFonte({ ...fonte, tipo: e.target.value as Fonte["tipo"] })}>
                {TIPOS_DE_FONTE.map((t) => (
                  <option key={t} value={t}>
                    {TIPOS_DE_FONTE_NOME[t]}
                  </option>
                ))}
              </Selecao>
              <Campo rotulo="Veículo ou órgão" value={fonte.veiculo} maxLength={120} onChange={(e) => setFonte({ ...fonte, veiculo: e.target.value })} />
              <Campo rotulo="Título" value={fonte.titulo} maxLength={300} onChange={(e) => setFonte({ ...fonte, titulo: e.target.value })} />
              <div className="sm:col-span-2">
                <Campo rotulo="Link" value={fonte.url} maxLength={2000} onChange={(e) => setFonte({ ...fonte, url: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Area rotulo={`Trecho (${400 - fonte.trecho.length} letras sobrando)`} className="min-h-20" value={fonte.trecho} maxLength={400} onChange={(e) => setFonte({ ...fonte, trecho: e.target.value })} />
              </div>
              <Campo rotulo="Data da fonte" value={fonte.data} maxLength={10} onChange={(e) => setFonte({ ...fonte, data: e.target.value })} />
              <div className="sm:col-span-2">
                <Campo rotulo="O que mudou, com “segundo [fonte]” (aparece na ficha)" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />
              </div>
            </div>
            <div>
              <Botao variante="principal" carregando={ocupado} disabled={ocupado || nova === doc.situacao} onClick={() => void atualizar()}>
                Atualizar situação
              </Botao>
            </div>
          </div>
        </Cartao>

        <Cartao as="div" variante="plano">
          <div className="pn-secao">
            <h4 className="font-semibold">Tirar do ar</h4>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-60 max-w-lg flex-1">
                <Campo rotulo="Motivo" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (correção procedente, ordem judicial…)" />
              </div>
              <Botao perigo simbolo={Archive} disabled={ocupado} onClick={() => void retirar()}>
                Retirar entrada
              </Botao>
            </div>
          </div>
        </Cartao>

        {erros.length > 0 && (
          <Faixa tom="erro">
            <ul className="list-disc pl-5 text-sm">
              {erros.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Faixa>
        )}
        <Aviso texto={aviso} />

        <h4 className="font-semibold">Histórico interno (só a curadoria vê)</h4>
        <Aviso texto={historico.erro} />
        <ul className="space-y-1 text-sm">
          {(historico.dados ?? []).map((h) => (
            <li key={h.id}>
              {dataHora(h.em)} · {h.acao} · {h.quem ?? "sistema"}
              {h.nota ? `: ${h.nota}` : ""}
            </li>
          ))}
        </ul>
      </div>
    </Cartao>
  );
}

// ───────────────────────────── Correções e direito de resposta ─────────────────────────────

function Correcoes() {
  const [estado, setEstado] = useState<ItemDeCorrecao["estado"]>("nova");
  const lista = useLista<ItemDeCorrecao[]>("vale_correcoes_listar", { p_estado: estado });
  const hoje = useMemo(() => hojeISO(), []);
  return (
    <div className="pn-tela">
      <p className="pn-ajuda max-w-3xl">
        Meta de resposta: {LEI_13188.respostaDias} dias do pedido. É o prazo do art. 5º da Lei 13.188/2015 (direito de resposta): o veículo tem 7 dias, contados do recebimento do pedido, para divulgar a resposta ou a retificação, gratuita e proporcional
        ao agravo (art. 2º); passado o prazo, cabe ação, e o juiz decide em {LEI_13188.decisaoDoJuizHoras} horas da citação (art. 7º). O pedido tem prazo decadencial de {LEI_13188.decadenciaDias} dias da divulgação (art. 3º). O Instituto não sabe se a lei o
        alcança como “veículo de comunicação social” e cumpre por boa-fé: responda dentro da meta, mesmo que o pedido pareça fora do prazo da lei.
      </p>
      <Abas<ItemDeCorrecao["estado"]>
        rotulo="Estado"
        opcoes={(
          [
            ["nova", "Novas"],
            ["em_analise", "Em análise"],
            ["aceita", "Aceitas"],
            ["recusada", "Recusadas"],
          ] as const
        ).map(([id, nome]) => ({ id, nome }))}
        valor={estado}
        aoMudar={setEstado}
      />
      {lista.erro && (
        <Faixa tom="erro" acao={<Botao pequeno onClick={lista.recarregar}>Tentar de novo</Botao>}>
          {lista.erro}
        </Faixa>
      )}
      {!lista.dados && !lista.erro && <Esqueleto forma="cartoes" linhas={2} />}
      {lista.dados && lista.dados.length === 0 && <Vazio titulo="Nada aqui." />}
      {(lista.dados ?? []).map((c) => (
        <Pedido key={c.id} c={c} hoje={hoje} depois={lista.recarregar} />
      ))}
    </div>
  );
}

function Pedido({ c, hoje, depois }: { c: ItemDeCorrecao; hoje: string; depois: () => void }) {
  const prazo = prazoDaCorrecao(c.responder_ate, hoje);
  const aberto = c.estado === "nova" || c.estado === "em_analise";
  const [resposta, setResposta] = useState(c.resposta_publica ?? "");
  const [nota, setNota] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function rodar(passo: () => Promise<void>) {
    setOcupado(true);
    setAviso("");
    try {
      await passo();
      depois();
    } catch (e) {
      setAviso(textoDoErro(e));
    } finally {
      setOcupado(false);
    }
  }
  const analisar = () => rodar(async () => void (await rpc("vale_correcao_decidir", { p_id: c.id, p_estado: "em_analise", p_resposta: "", p_nota: nota })));
  const recusar = () =>
    rodar(async () => {
      if (nota.trim().length < 5) return setAviso("Diga o motivo da recusa na nota (5 letras ou mais): quem pediu tem direito a uma resposta.");
      if (!(await confirmarFrase("Recusar este pedido?"))) return;
      await rpc("vale_correcao_decidir", { p_id: c.id, p_estado: "recusada", p_resposta: "", p_nota: nota.trim() });
    });
  const aceitar = () =>
    rodar(async () => {
      const publica = c.tipo !== "remocao_de_dado";
      if (publica && resposta.trim().length < 10) return setAviso("Escreva a resposta ou a retificação que vai ao lado da ficha (10 letras ou mais).");
      if (!(await confirmarFrase(publica ? "Aceitar e publicar esta resposta ao lado da ficha?" : "Aceitar o pedido? Depois, retire ou corrija a entrada em Publicadas."))) return;
      if (publica) {
        // A resposta vai para a ficha (o documento é o que o público lê); a nota interna fica só no banco.
        const data = await rpc<{ doc: unknown } | null>("vale_publicada", { p_id: c.entrada });
        if (!data) return setAviso("A entrada não está no ar (já foi retirada?). Recuse ou aceite sem resposta pública.");
        const novo = acrescentarResposta(data.doc as DocumentoDeEntrada, c.tipo === "direito_de_resposta" ? "direito_de_resposta" : "correcao", resposta, hoje);
        await rpc("vale_entrada_atualizar", { p_id: c.entrada, p_doc: novo, p_nota: `Resposta publicada (${TIPO_DA_CORRECAO[c.tipo]})` });
      }
      await rpc("vale_correcao_decidir", { p_id: c.id, p_estado: "aceita", p_resposta: publica ? resposta.trim() : "", p_nota: nota.trim() });
    });
  return (
    <Cartao as="article" variante={aberto && prazo.estado === "vencido" ? "alerta" : "padrao"}>
      <div className="pn-secao">
        <p className="pn-rotulo-mono">
          {TIPO_DA_CORRECAO[c.tipo]} · entrada {c.entrada} · recebido em {dataHora(c.criado_em)}
        </p>
        {aberto && (
          <p>
            <Selo tom={prazo.estado === "vencido" ? "erro" : prazo.estado === "vence_hoje" ? "aviso" : "neutro"} ponto>
              {prazo.estado === "vencido" ? `Atrasado ${-prazo.dias} dia(s)` : prazo.estado === "vence_hoje" ? "Vence hoje" : `${prazo.dias} dia(s) para responder`} (meta {c.responder_ate.split("-").reverse().join("/")})
            </Selo>
          </p>
        )}
        <p className="whitespace-pre-wrap">{c.texto}</p>
        <p className="pn-ajuda">
          {c.nome ? `${c.nome} · ` : "Sem nome · "}
          {c.contato ?? "sem contato"}
          {c.comprovante_url && (
            <>
              {" "}
              ·{" "}
              <a className="pn-elo inline-flex items-center gap-1 break-all" href={c.comprovante_url} target="_blank" rel="noreferrer noopener">
                comprovante
                <ExternalLink aria-hidden width={12} height={12} />
              </a>
            </>
          )}
        </p>
        {c.resposta_publica && !aberto && <p className="text-sm">Resposta publicada: {c.resposta_publica}</p>}
        {c.nota && !aberto && <p className="pn-ajuda">Nota: {c.nota}</p>}
        {aberto && (
          <div className="pn-secao">
            {c.tipo !== "remocao_de_dado" && <Area rotulo="Resposta ou retificação que vai ao lado da ficha (gratuita e proporcional ao agravo)" className="min-h-24" value={resposta} maxLength={4000} onChange={(e) => setResposta(e.target.value)} />}
            <Campo rotulo="Nota interna (obrigatória para recusar)" value={nota} maxLength={2000} onChange={(e) => setNota(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              {c.estado === "nova" && (
                <Botao disabled={ocupado} onClick={() => void analisar()}>
                  Em análise
                </Botao>
              )}
              <Botao variante="principal" simbolo={Check} disabled={ocupado} onClick={() => void aceitar()}>
                Aceitar
              </Botao>
              <Botao simbolo={X} disabled={ocupado} onClick={() => void recusar()}>
                Recusar
              </Botao>
            </div>
          </div>
        )}
        <Aviso texto={aviso} />
      </div>
    </Cartao>
  );
}
