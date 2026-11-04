// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

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
import { Abas, Aviso, botao, botaoClaro, campo, dataHora, rotulo, textoDoErro, useLista } from "./comum";
import { EditorDeEntrada, NOME_DO_DOSSIE, pedirArquivo } from "./ValeOEscritoEditor";

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
    <div>
      <p className="max-w-3xl text-ink-soft">
        A curadoria do observatório: só entra o que já está em fonte pública, com fonte, data, trecho e a situação jurídica escrita. Quem aprova fica anônimo para o público (a ficha mostra “curadoria do Vale o Escrito”); o nome fica só no histórico
        interno. O observatório continua desligado no site até a curadoria revisar as entradas e a assessoria jurídica conferir.
      </p>
      <div className="mt-5">
        <Abas
          opcoes={[
            { id: "fila", nome: "Fila" },
            { id: "nova", nome: "Entrada manual" },
            { id: "publicadas", nome: "Publicadas" },
            { id: "correcoes", nome: "Correções e respostas" },
          ]}
          atual={aba}
          escolher={setAba}
        />
      </div>
      {aba === "fila" && <FilaDaCuradoria />}
      {aba === "nova" && <EditorDeEntrada key="nova" inicial={docEmBranco(hojeISO())} irmaos={[]} fechar={() => setAba("fila")} depois={() => undefined} />}
      {aba === "publicadas" && <Publicadas />}
      {aba === "correcoes" && <Correcoes />}
    </div>
  );
}

// ───────────────────────────── Fila ─────────────────────────────

function FilaDaCuradoria() {
  const [estado, setEstado] = useState("pendente");
  const lista = useLista<ItemDaFila[]>("vale_fila_listar", { p_estado: estado });
  const abertos = useLista<ItemDaFila[]>("vale_fila_listar", { p_estado: "pendente" });
  const [aberto, setAberto] = useState<ItemDaFila | null>(null);
  const hoje = useMemo(() => hojeISO(), []);
  const fechar = () => setAberto(null);
  const refazer = () => {
    lista.recarregar();
    abertos.recarregar();
  };

  if (aberto) {
    const editavel = ["pendente", "em_revisao", "devolvida"].includes(aberto.estado);
    return (
      <div>
        {!editavel && <p className="mb-3 border border-rule bg-parchment-deep p-3 text-sm">Esta sugestão já foi decidida ({aberto.estado}). {aberto.nota ? `Nota: ${aberto.nota}` : ""} Para mudar uma entrada publicada, use a aba Publicadas.</p>}
        {editavel ? (
          <EditorDeEntrada key={aberto.id} item={aberto} inicial={rascunhoDoItem(aberto, hoje)} irmaos={(abertos.dados ?? []).filter((x) => x.id !== aberto.id)} fechar={fechar} depois={refazer} />
        ) : (
          <button type="button" className={botaoClaro} onClick={fechar}>Voltar</button>
        )}
      </div>
    );
  }
  return (
    <div>
      <div role="group" aria-label="Estado" className="flex flex-wrap gap-2">
        {ESTADOS_DA_FILA.map((e) => (
          <button key={e.id} type="button" onClick={() => setEstado(e.id)} aria-pressed={estado === e.id} className={`${estado === e.id ? botao : botaoClaro} !px-3 !py-1 text-sm`}>
            {e.nome}
            {e.id === "pendente" && Boolean(abertos.dados?.length) && ` (${abertos.dados?.length})`}
          </button>
        ))}
      </div>
      <Aviso texto={lista.erro} />
      {lista.dados && lista.dados.length === 0 && <p className="mt-4 text-ink-soft">Nada aqui. O robô acrescenta achados sozinho; o público envia fontes pelo site quando o observatório estiver aberto.</p>}
      <ul className="mt-4 space-y-2">
        {(lista.dados ?? []).map((x) => (
          <li key={x.id}>
            <button type="button" onClick={() => setAberto(x)} className="w-full cursor-pointer border border-rule bg-folha px-3 py-2 text-left hover:border-ink">
              <span className={rotulo}>{ORIGEM[x.origem]} · {dataHora(x.criado_em)}</span>
              <span className="mt-0.5 block font-semibold">{x.rascunho?.titulo || x.sugestao_titulo || x.sugestao_url || x.envio_url || "Entrada sem título"}</span>
              {(x.sugestao_url || x.envio_url) && <span className="block break-all text-sm text-ink-soft">{x.sugestao_url ?? x.envio_url}</span>}
              {x.envio_descricao && <span className="block text-sm">{x.envio_descricao}</span>}
              {x.nota && <span className="block text-sm text-ink-soft">Nota: {x.nota}</span>}
            </button>
          </li>
        ))}
      </ul>
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
    <div>
      <label className="block max-w-md">
        Procurar entrada
        <input className={campo} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Título ou código" />
      </label>
      <Aviso texto={erro} />
      {linhas && linhas.length === 0 && <p className="mt-4 text-ink-soft">Nenhuma entrada publicada ainda.</p>}
      <ul className="mt-4 space-y-2">
        {achadas.map((l) => (
          <li key={l.id}>
            <button type="button" onClick={() => setAberta(l.id)} className="w-full cursor-pointer border border-rule bg-folha px-3 py-2 text-left hover:border-ink">
              <span className={rotulo}>{NOME_DO_DOSSIE[l.dossie] ?? l.dossie} · {ROTULO_SITUACAO[l.situacao]} · atualizada em {l.doc.atualizadoEm}</span>
              <span className="mt-0.5 block font-semibold">{l.doc.titulo}</span>
              {l.doc.fontes.some((f) => f.arquivoFalhou) && <span className="block text-sm text-oxblood">Arquivo de fonte em refação</span>}
            </button>
          </li>
        ))}
      </ul>
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
      if (!window.confirm(`Mudar a situação de “${doc.titulo}” de ${ROTULO_SITUACAO[doc.situacao]} para ${ROTULO_SITUACAO[nova]}? A ficha mostra a mudança, com a fonte, na hora.`)) return;
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
      if (!window.confirm(`Tirar “${doc.titulo}” do ar? Ela não é apagada: fica no banco e no histórico.`)) return;
      await rpc("vale_entrada_retirar", { p_id: linha.id, p_motivo: motivo.trim() });
      depois();
      voltar();
    });

  return (
    <div className="border-2 border-ink bg-folha p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold">{doc.titulo}</h3>
        <button type="button" className={botaoClaro} onClick={voltar}>Voltar</button>
      </div>
      <p className="mt-1 text-sm text-ink-soft">{linha.id} · {NOME_DO_DOSSIE[linha.dossie] ?? linha.dossie} · {ROTULO_SITUACAO[doc.situacao]} · publicada em {doc.publicadoEm}, atualizada em {doc.atualizadoEm}</p>
      <p className="mt-3 max-w-3xl">{doc.resumo}</p>

      <h4 className="mt-5 font-semibold">Histórico visível na ficha</h4>
      {(doc.historico ?? []).length === 0 ? <p className="text-sm text-ink-soft">Nenhuma mudança de situação desde a publicação.</p> : (
        <ul className="mt-1 list-disc pl-5 text-sm">
          {(doc.historico ?? []).map((h, i) => <li key={i}>{h.em}: de {ROTULO_SITUACAO[h.de]} para {ROTULO_SITUACAO[h.para]} (fonte {doc.fontes.findIndex((f) => f.id === h.fonteId) + 1}){h.nota ? `. ${h.nota}` : ""}</li>)}
        </ul>
      )}
      {(doc.respostas ?? []).length > 0 && (
        <>
          <h4 className="mt-4 font-semibold">Respostas publicadas ao lado da ficha</h4>
          <ul className="mt-1 list-disc pl-5 text-sm">{(doc.respostas ?? []).map((r, i) => <li key={i}>{r.em} ({r.tipo === "direito_de_resposta" ? "direito de resposta" : "retificação"}): {r.texto}</li>)}</ul>
        </>
      )}

      <h4 className="mt-5 font-semibold">Fontes</h4>
      <ol className="mt-1 list-decimal pl-5 text-sm">
        {doc.fontes.map((f) => (
          <li key={f.id} className="mt-1">
            {f.veiculo}: <a className="break-all underline" href={f.url} target="_blank" rel="noreferrer noopener">{f.titulo}</a>{" "}
            {f.arquivoUrl ? <a className="underline" href={f.arquivoUrl} target="_blank" rel="noreferrer noopener">(arquivo)</a> : <span className="text-oxblood">arquivo em refação </span>}
            {!f.arquivoUrl && <button type="button" className="cursor-pointer underline hover:text-oxblood" disabled={ocupado} onClick={() => void refazerArquivo(f)}>refazer agora</button>}
          </li>
        ))}
      </ol>

      <h4 className="mt-6 font-semibold">Atualizar situação (absolvição, arquivamento, nova decisão)</h4>
      <p className="max-w-3xl text-sm text-ink-soft">Exige a fonte da mudança (a decisão, a nota do tribunal, a reportagem). A ficha passa a mostrar a nova situação, a data e a fonte, e o histórico guarda a anterior.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block"><span className={rotulo}>Nova situação</span>
          <select className={campo} value={nova} onChange={(e) => setNova(e.target.value as Situacao)}>{SITUACOES.map((s) => <option key={s} value={s}>{ROTULO_SITUACAO[s]}</option>)}</select>
        </label>
        <label className="block"><span className={rotulo}>Tipo da fonte nova</span>
          <select className={campo} value={fonte.tipo} onChange={(e) => setFonte({ ...fonte, tipo: e.target.value as Fonte["tipo"] })}>{TIPOS_DE_FONTE.map((t) => <option key={t} value={t}>{TIPOS_DE_FONTE_NOME[t]}</option>)}</select>
        </label>
        <label className="block"><span className={rotulo}>Veículo ou órgão</span><input className={campo} value={fonte.veiculo} maxLength={120} onChange={(e) => setFonte({ ...fonte, veiculo: e.target.value })} /></label>
        <label className="block"><span className={rotulo}>Título</span><input className={campo} value={fonte.titulo} maxLength={300} onChange={(e) => setFonte({ ...fonte, titulo: e.target.value })} /></label>
        <label className="block sm:col-span-2"><span className={rotulo}>Link</span><input className={campo} value={fonte.url} maxLength={2000} onChange={(e) => setFonte({ ...fonte, url: e.target.value })} /></label>
        <label className="block sm:col-span-2"><span className={rotulo}>Trecho ({400 - fonte.trecho.length} letras sobrando)</span><textarea className={`${campo} min-h-20`} value={fonte.trecho} maxLength={400} onChange={(e) => setFonte({ ...fonte, trecho: e.target.value })} /></label>
        <label className="block"><span className={rotulo}>Data da fonte</span><input className={campo} value={fonte.data} maxLength={10} onChange={(e) => setFonte({ ...fonte, data: e.target.value })} /></label>
        <label className="block sm:col-span-2"><span className={rotulo}>O que mudou, com “segundo [fonte]” (aparece na ficha)</span><input className={campo} value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} /></label>
      </div>
      <button type="button" className={`mt-3 ${botao}`} disabled={ocupado || nova === doc.situacao} onClick={() => void atualizar()}>Atualizar situação</button>

      <h4 className="mt-6 font-semibold">Tirar do ar</h4>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <input className={`${campo} max-w-lg`} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (correção procedente, ordem judicial…)" aria-label="Motivo" />
        <button type="button" className={botaoClaro} disabled={ocupado} onClick={() => void retirar()}>Retirar entrada</button>
      </div>

      {erros.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm text-oxblood">{erros.map((e) => <li key={e}>{e}</li>)}</ul>}
      <Aviso texto={aviso} />

      <h4 className="mt-6 font-semibold">Histórico interno (só a curadoria vê)</h4>
      <Aviso texto={historico.erro} />
      <ul className="mt-1 space-y-1 text-sm">
        {(historico.dados ?? []).map((h) => <li key={h.id}>{dataHora(h.em)} · {h.acao} · {h.quem ?? "sistema"}{h.nota ? `: ${h.nota}` : ""}</li>)}
      </ul>
    </div>
  );
}

// ───────────────────────────── Correções e direito de resposta ─────────────────────────────

function Correcoes() {
  const [estado, setEstado] = useState<ItemDeCorrecao["estado"]>("nova");
  const lista = useLista<ItemDeCorrecao[]>("vale_correcoes_listar", { p_estado: estado });
  const hoje = useMemo(() => hojeISO(), []);
  return (
    <div>
      <p className="max-w-3xl text-sm text-ink-soft">
        Meta de resposta: {LEI_13188.respostaDias} dias do pedido. É o prazo do art. 5º da Lei 13.188/2015 (direito de resposta): o veículo tem 7 dias, contados do recebimento do pedido, para divulgar a resposta ou a retificação, gratuita e proporcional
        ao agravo (art. 2º); passado o prazo, cabe ação, e o juiz decide em {LEI_13188.decisaoDoJuizHoras} horas da citação (art. 7º). O pedido tem prazo decadencial de {LEI_13188.decadenciaDias} dias da divulgação (art. 3º). O Instituto não sabe se a lei o
        alcança como “veículo de comunicação social” e cumpre por boa-fé: responda dentro da meta, mesmo que o pedido pareça fora do prazo da lei.
      </p>
      <div role="group" aria-label="Estado" className="mt-3 flex flex-wrap gap-2">
        {([["nova", "Novas"], ["em_analise", "Em análise"], ["aceita", "Aceitas"], ["recusada", "Recusadas"]] as const).map(([id, nome]) => (
          <button key={id} type="button" aria-pressed={estado === id} onClick={() => setEstado(id)} className={`${estado === id ? botao : botaoClaro} !px-3 !py-1 text-sm`}>{nome}</button>
        ))}
      </div>
      <Aviso texto={lista.erro} />
      {lista.dados && lista.dados.length === 0 && <p className="mt-4 text-ink-soft">Nada aqui.</p>}
      <ul className="mt-4 space-y-3">
        {(lista.dados ?? []).map((c) => <Pedido key={c.id} c={c} hoje={hoje} depois={lista.recarregar} />)}
      </ul>
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
      if (!window.confirm("Recusar este pedido?")) return;
      await rpc("vale_correcao_decidir", { p_id: c.id, p_estado: "recusada", p_resposta: "", p_nota: nota.trim() });
    });
  const aceitar = () =>
    rodar(async () => {
      const publica = c.tipo !== "remocao_de_dado";
      if (publica && resposta.trim().length < 10) return setAviso("Escreva a resposta ou a retificação que vai ao lado da ficha (10 letras ou mais).");
      if (!window.confirm(publica ? "Aceitar e publicar esta resposta ao lado da ficha?" : "Aceitar o pedido? Depois, retire ou corrija a entrada em Publicadas.")) return;
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
    <li className="border border-ink bg-folha p-3">
      <p className={rotulo}>
        {TIPO_DA_CORRECAO[c.tipo]} · entrada {c.entrada} · recebido em {dataHora(c.criado_em)}
      </p>
      {aberto && (
        <p className={`mt-1 font-semibold ${prazo.estado === "vencido" ? "text-oxblood" : ""}`}>
          {prazo.estado === "vencido" ? `Atrasado ${-prazo.dias} dia(s)` : prazo.estado === "vence_hoje" ? "Vence hoje" : `${prazo.dias} dia(s) para responder`} (meta {c.responder_ate.split("-").reverse().join("/")})
        </p>
      )}
      <p className="mt-2 whitespace-pre-wrap">{c.texto}</p>
      <p className="mt-2 text-sm text-ink-soft">
        {c.nome ? `${c.nome} · ` : "Sem nome · "}
        {c.contato ?? "sem contato"}
        {c.comprovante_url && (<> · <a className="break-all underline" href={c.comprovante_url} target="_blank" rel="noreferrer noopener">comprovante</a></>)}
      </p>
      {c.resposta_publica && !aberto && <p className="mt-2 text-sm">Resposta publicada: {c.resposta_publica}</p>}
      {c.nota && !aberto && <p className="text-sm text-ink-soft">Nota: {c.nota}</p>}
      {aberto && (
        <div className="mt-3 space-y-3">
          {c.tipo !== "remocao_de_dado" && (
            <label className="block"><span className={rotulo}>Resposta ou retificação que vai ao lado da ficha (gratuita e proporcional ao agravo)</span>
              <textarea className={`${campo} min-h-24`} value={resposta} maxLength={4000} onChange={(e) => setResposta(e.target.value)} />
            </label>
          )}
          <label className="block"><span className={rotulo}>Nota interna (obrigatória para recusar)</span><input className={campo} value={nota} maxLength={2000} onChange={(e) => setNota(e.target.value)} /></label>
          <div className="flex flex-wrap gap-3">
            {c.estado === "nova" && <button type="button" className={botaoClaro} disabled={ocupado} onClick={() => void analisar()}>Em análise</button>}
            <button type="button" className={botao} disabled={ocupado} onClick={() => void aceitar()}>Aceitar</button>
            <button type="button" className={botaoClaro} disabled={ocupado} onClick={() => void recusar()}>Recusar</button>
          </div>
        </div>
      )}
      <Aviso texto={aviso} />
    </li>
  );
}
