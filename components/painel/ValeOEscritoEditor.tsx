// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useState } from "react";
import { getClient, rpc } from "@/lib/backend";
import { SLUGS_DOS_DOSSIES } from "@/lib/vale-o-escrito/catalogo";
import {
  conferirDoc,
  type DocumentoDeEntrada,
  fonteEmBranco,
  hojeISO,
  idDaEntrada,
  type ItemDaFila,
  limparDoc,
  mesclarDuplicata,
  rascunhoDoItem,
  slugDe,
} from "@/lib/vale-o-escrito/curadoria";
import { UFS } from "@/lib/vale-o-escrito/regras";
import {
  CONFIANCAS,
  type Fonte,
  type Ligacao,
  PAPEIS_DE_PESSOA,
  ROTULO_SITUACAO,
  SITUACOES,
  TIPOS_DE_FONTE,
  TIPOS_DE_LIGACAO,
  TIPOS_DE_ORGANIZACAO,
} from "@/lib/vale-o-escrito/tipos";
import { botao, botaoClaro, campo, rotulo, textoDoErro } from "./comum";

// O painel existe só em português. Nomes das listas do modelo (lib/vale-o-escrito/tipos.ts) para a curadoria ler.

export const NOME_DO_DOSSIE: Record<string, string> = {
  "povos-indigenas": "Povos indígenas",
  "conflitos-no-campo": "Conflitos no campo",
  "violencia-policial": "Violência policial",
  "trabalho-escravo": "Trabalho escravo",
  "crimes-ambientais": "Crimes ambientais",
  "dinheiro-publico": "Dinheiro público",
};
const NOME_DA_CONFIANCA: Record<string, string> = { primaria: "Confirmado por fonte primária", reportado: "Reportado" };
const NOME_DO_TIPO_DE_FONTE: Record<string, string> = {
  processo: "Processo (decisão judicial)",
  investigacao_oficial: "Investigação oficial",
  dado_oficial: "Dado oficial",
  relatorio_organizacao: "Relatório de organização",
  reportagem: "Reportagem",
  checagem: "Checagem",
};
const NOME_DO_PAPEL: Record<string, string> = {
  acusado: "Acusado",
  investigado: "Investigado",
  autoridade: "Autoridade",
  agente_publico: "Agente público",
  parlamentar: "Parlamentar",
  dirigente: "Dirigente",
  empresario: "Empresário",
  proprietario_rural: "Proprietário rural",
  agente_de_seguranca: "Agente de segurança",
  outro_publico_no_caso: "Outro, público no caso",
};
const NOME_DA_ORG: Record<string, string> = { empresa: "Empresa", orgao_publico: "Órgão público", partido: "Partido", associacao: "Associação", grupo_armado: "Grupo armado", outra: "Outra" };
const NOME_DA_LIGACAO: Record<string, string> = {
  integra: "integra",
  dirige: "dirige",
  financia: "financia",
  contrata: "contrata",
  doa_para: "doa para",
  investiga: "investiga",
  denuncia: "denuncia",
  citado_em: "é citado em",
  ocorreu_em: "ocorreu em",
  relacionada: "é relacionada a",
};

/** Pede o arquivo da fonte no Internet Archive (Save Page Now) pela rota do servidor; só a curadoria consegue. */
export async function pedirArquivo(url: string): Promise<{ arquivoUrl?: string; erro?: string }> {
  try {
    const { data } = await (await getClient()).auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { erro: "Entre na sua conta de novo." };
    const resposta = await fetch("/api/vale-o-escrito/arquivar", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
    const corpo = (await resposta.json().catch(() => ({}))) as { arquivoUrl?: string; erro?: string };
    return resposta.ok && corpo.arquivoUrl ? { arquivoUrl: corpo.arquivoUrl } : { erro: corpo.erro ?? "O arquivo não foi feito." };
  } catch {
    return { erro: "Sem conexão com o servidor do site." };
  }
}

function Rotulado({ texto, children, largura = "" }: { texto: string; children: React.ReactNode; largura?: string }) {
  return (
    <label className={`block ${largura}`}>
      <span className={rotulo}>{texto}</span>
      {children}
    </label>
  );
}

/**
 * O editor da curadoria: o rascunho de uma entrada com fonte, trecho, data, situação jurídica, lugar, pessoas (com a
 * marca "pública no caso"), organizações e ligações da teia. Aprovar pede o arquivo de cada fonte no Internet Archive,
 * confere tudo com as regras do site (lib/vale-o-escrito/regras.ts) e só então grava.
 */
export function EditorDeEntrada({ item, inicial, irmaos, fechar, depois }: { item?: ItemDaFila; inicial: DocumentoDeEntrada; irmaos: ItemDaFila[]; fechar: () => void; depois: () => void }) {
  const hoje = useMemo(() => hojeISO(), []);
  const [doc, setDoc] = useState<DocumentoDeEntrada>(inicial);
  const [filaId, setFilaId] = useState<string | undefined>(item?.id);
  const [nota, setNota] = useState("");
  const [aviso, setAviso] = useState("");
  const [erros, setErros] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [duplicata, setDuplicata] = useState("");
  const alterar = (parte: Partial<DocumentoDeEntrada>) => setDoc((d) => ({ ...d, ...parte }));
  const pessoasPublicas = doc.pessoasPublicas ?? [];
  const orgs = doc.organizacoesPublicas ?? [];
  const ligacoes = useMemo(() => doc.ligacoes ?? [], [doc.ligacoes]);

  // ── fontes
  const fonteMuda = (i: number, parte: Partial<Fonte>) => alterar({ fontes: doc.fontes.map((f, j) => (j === i ? { ...f, ...parte } : f)) });
  const fonteNova = () => alterar({ fontes: [...doc.fontes, fonteEmBranco(`f${Math.max(0, ...doc.fontes.map((f) => Number(f.id.slice(1)) || 0)) + 1}`, hoje)] });
  const fonteSai = (i: number) => {
    const id = doc.fontes[i].id;
    alterar({
      fontes: doc.fontes.filter((_, j) => j !== i),
      pessoasPublicas: pessoasPublicas.map((p) => ({ ...p, fonteIds: p.fonteIds.filter((x) => x !== id) })),
      organizacoesPublicas: orgs.map((o) => ({ ...o, fonteIds: o.fonteIds.filter((x) => x !== id) })),
      ligacoes: ligacoes.map((l) => ({ ...l, fonteIds: l.fonteIds.filter((x) => x !== id) })),
    });
  };
  const alterna = (lista: string[], id: string) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  // ── pessoas (o par pessoasPublicas[i] / pessoas[i] anda junto)
  const pessoaNova = () => {
    const id = `pessoa-${pessoasPublicas.length + 1}`;
    alterar({
      pessoasPublicas: [...pessoasPublicas, { id, nome: "", publicaNoCaso: false as unknown as true, papel: "investigado", fonteIds: [] }],
      pessoas: [...doc.pessoas, { pessoaId: id, situacao: "investigado", papelNoCaso: "" }],
    });
  };
  const pessoaMuda = (i: number, parte: Partial<(typeof pessoasPublicas)[number]>) => alterar({ pessoasPublicas: pessoasPublicas.map((p, j) => (j === i ? { ...p, ...parte } : p)) });
  const pessoaNome = (i: number, nome: string) => {
    const antigo = pessoasPublicas[i].id;
    const usada = ligacoes.some((l) => [l.de, l.para].some((n) => n.tipo === "pessoa" && n.id === antigo));
    const novo = usada ? antigo : slugDe(nome) || antigo;
    if (novo !== antigo && pessoasPublicas.some((p, j) => j !== i && p.id === novo)) return pessoaMuda(i, { nome });
    alterar({
      pessoasPublicas: pessoasPublicas.map((p, j) => (j === i ? { ...p, nome, id: novo } : p)),
      pessoas: doc.pessoas.map((x) => (x.pessoaId === antigo ? { ...x, pessoaId: novo } : x)),
    });
  };
  const pessoaSai = (i: number) => {
    const id = pessoasPublicas[i].id;
    alterar({
      pessoasPublicas: pessoasPublicas.filter((_, j) => j !== i),
      pessoas: doc.pessoas.filter((x) => x.pessoaId !== id),
      ligacoes: ligacoes.filter((l) => ![l.de, l.para].some((n) => n.tipo === "pessoa" && n.id === id)),
    });
  };

  // ── organizações
  const orgNova = () => alterar({ organizacoesPublicas: [...orgs, { id: `org-${orgs.length + 1}`, nome: "", tipo: "empresa", fonteIds: [] }] });
  const orgMuda = (i: number, parte: Partial<(typeof orgs)[number]>) => alterar({ organizacoesPublicas: orgs.map((o, j) => (j === i ? { ...o, ...parte } : o)) });
  const orgNome = (i: number, nome: string) => {
    const antigo = orgs[i].id;
    const usada = ligacoes.some((l) => [l.de, l.para].some((n) => n.tipo === "organizacao" && n.id === antigo));
    const novo = usada ? antigo : slugDe(nome) || antigo;
    if (novo !== antigo && orgs.some((o, j) => j !== i && o.id === novo)) return orgMuda(i, { nome });
    alterar({ organizacoesPublicas: orgs.map((o, j) => (j === i ? { ...o, nome, id: novo } : o)), organizacoes: doc.organizacoes.map((x) => (x === antigo ? novo : x)) });
  };
  const orgInclui = (id: string) => alterar({ organizacoes: alterna(doc.organizacoes, id) });
  const orgSai = (i: number) => {
    const id = orgs[i].id;
    alterar({
      organizacoesPublicas: orgs.filter((_, j) => j !== i),
      organizacoes: doc.organizacoes.filter((x) => x !== id),
      ligacoes: ligacoes.filter((l) => ![l.de, l.para].some((n) => n.tipo === "organizacao" && n.id === id)),
    });
  };

  // ── ligações da teia (nós: esta entrada, pessoas, organizações e o lugar)
  const nos = [
    { valor: `entrada:${doc.id || "esta-entrada"}`, nome: "Esta entrada" },
    ...pessoasPublicas.map((p) => ({ valor: `pessoa:${p.id}`, nome: p.nome || p.id })),
    ...orgs.map((o) => ({ valor: `organizacao:${o.id}`, nome: o.nome || o.id })),
  ];
  const ligacaoNova = () =>
    alterar({
      ligacoes: [...ligacoes, { id: `l${ligacoes.length + 1}`, de: { tipo: "pessoa", id: pessoasPublicas[0]?.id ?? "" }, para: { tipo: "entrada", id: doc.id }, tipo: "citado_em", fonteIds: [], entradaId: doc.id } as Ligacao],
    });
  const ligacaoMuda = (i: number, parte: Partial<Ligacao>) => alterar({ ligacoes: ligacoes.map((l, j) => (j === i ? { ...l, ...parte } : l)) });
  const noDe = (valor: string) => {
    const [tipo, ...resto] = valor.split(":");
    return { tipo: tipo as "pessoa" | "organizacao" | "entrada", id: tipo === "entrada" ? doc.id : resto.join(":") };
  };

  // ── conferência ao vivo (sem arquivo: o arquivo é feito na aprovação)
  const pronto = useMemo(() => {
    const id = doc.id || idDaEntrada(doc.dataDoFato.slice(0, 4), doc.titulo);
    // Os nós "esta entrada" seguem o código da ficha, mesmo que ele só seja gerado agora.
    const no = (n: Ligacao["de"]) => (n.tipo === "entrada" ? { ...n, id } : n);
    const d = limparDoc({ ...doc, id, ligacoes: ligacoes.map((l) => ({ ...l, entradaId: id, de: no(l.de), para: no(l.para) })) });
    return { d, c: conferirDoc(d, { publicada: false }) };
  }, [doc, ligacoes]);

  async function garantirFila(d: DocumentoDeEntrada): Promise<string> {
    if (filaId) {
      await rpc("vale_fila_salvar", { p_id: filaId, p_rascunho: d });
      return filaId;
    }
    const novo = await rpc<{ id: string }>("vale_fila_criar", { p_rascunho: d });
    setFilaId(novo.id);
    await rpc("vale_fila_salvar", { p_id: novo.id, p_rascunho: d });
    return novo.id;
  }
  async function rodar(passo: () => Promise<void>) {
    setOcupado(true);
    setAviso("");
    try {
      await passo();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }
  const guardar = () =>
    rodar(async () => {
      await garantirFila(pronto.d);
      setAviso("Rascunho guardado.");
      depois();
    });

  const aprovar = () =>
    rodar(async () => {
      let d = pronto.d;
      if (!pronto.c.ok) {
        setErros(pronto.c.erros);
        setAviso("Ainda falta coisa: veja a lista abaixo. Nada foi enviado.");
        return;
      }
      setErros([]);
      // Código já no ar: gravar por cima apagaria o histórico de situação e as respostas da ficha. Mudança é em Publicadas.
      const existente = await rpc<{ id: string } | null>("vale_publicada", { p_id: d.id });
      if (existente) {
        setAviso(`Já existe uma ficha publicada com o código “${d.id}”. Mude o código aqui, ou altere a ficha existente na aba Publicadas.`);
        return;
      }
      const resumo =`${d.titulo}\nSituação jurídica: ${ROTULO_SITUACAO[d.situacao]}. Confiança: ${NOME_DA_CONFIANCA[d.confianca]}.\n${d.fontes.length} fonte(s); ${d.pessoas.length} pessoa(s).\n\nAprovar publica a ficha para todo mundo, com a curadoria anônima, e pede o arquivo de cada fonte no Internet Archive. Confirmar?`;
      if (!window.confirm(resumo)) return;
      // O Internet Archive primeiro: sem cópia (ou sem a marca de falha) a entrada não passa nas regras.
      const fontes = [...d.fontes];
      const falhas: string[] = [];
      for (let i = 0; i < fontes.length; i++) {
        if (fontes[i].arquivoUrl || fontes[i].arquivoFalhou === true) continue;
        setAviso(`Arquivando a fonte ${i + 1} de ${fontes.length} no Internet Archive…`);
        const r = await pedirArquivo(fontes[i].url);
        if (r.arquivoUrl) fontes[i] = { ...fontes[i], arquivoUrl: r.arquivoUrl };
        else {
          fontes[i] = { ...fontes[i], arquivoFalhou: true };
          falhas.push(`fonte ${i + 1}: ${r.erro ?? "falhou"}`);
        }
      }
      d = { ...d, fontes, publicadoEm: d.publicadoEm && d.publicadoEm <= hoje ? d.publicadoEm : hoje, atualizadoEm: hoje };
      const final = conferirDoc(d, { publicada: true });
      if (!final.ok) {
        setDoc(d);
        setErros(final.erros);
        setAviso("A conferência final barrou a entrada. Nada foi publicado.");
        return;
      }
      const id = await garantirFila(d);
      await rpc("vale_fila_decidir", { p_id: id, p_decisao: "aprovar", p_nota: nota, p_doc: d });
      setAviso(falhas.length ? `Publicada. O Internet Archive falhou em: ${falhas.join("; ")}. A ficha está marcada "arquivo em refação": tente de novo em Publicadas.` : "Publicada, com o arquivo de todas as fontes.");
      depois();
      window.setTimeout(fechar, 1500);
    });

  const decidir = (decisao: "recusar" | "devolver") =>
    rodar(async () => {
      if (nota.trim().length < 5) {
        setAviso(decisao === "recusar" ? "Diga o motivo da recusa (5 letras ou mais) na caixa Nota." : "Diga o que precisa mudar (5 letras ou mais) na caixa Nota.");
        return;
      }
      if (!window.confirm(decisao === "recusar" ? "Recusar esta sugestão? Ela sai da fila." : "Devolver esta sugestão com a nota?")) return;
      const id = await garantirFila(pronto.d);
      await rpc("vale_fila_decidir", { p_id: id, p_decisao: decisao, p_nota: nota.trim() });
      depois();
      fechar();
    });

  const mesclar = () =>
    rodar(async () => {
      const outro = irmaos.find((x) => x.id === duplicata);
      if (!outro) return;
      if (!window.confirm("Juntar as fontes e as pessoas da outra sugestão a esta e recusar a outra como duplicata?")) return;
      const juntado = mesclarDuplicata(doc, rascunhoDoItem(outro, hoje));
      setDoc(juntado);
      await rpc("vale_fila_decidir", { p_id: outro.id, p_decisao: "recusar", p_nota: `Duplicata de ${filaId ?? doc.id ?? "outra sugestão"}` });
      setDuplicata("");
      setAviso("Juntado. A outra sugestão foi recusada como duplicata. Revise e guarde.");
      depois();
    });

  const trechoRestante = (f: Fonte) => 400 - (f.trecho?.length ?? 0);
  const dossieAtual = NOME_DO_DOSSIE[doc.dossie] ?? doc.dossie;

  return (
    <div className="border-2 border-ink bg-folha p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold">{doc.titulo || "Nova entrada"} <span className="text-sm font-normal text-ink-soft">({dossieAtual})</span></h3>
        <button type="button" className={botaoClaro} onClick={fechar}>Fechar sem guardar</button>
      </div>
      {item && (item.sugestao_url || item.envio_url) && (
        <div className="mt-3 border border-rule bg-parchment-deep p-3 text-sm">
          <p className={rotulo}>{item.origem === "robo" ? "O robô achou" : "O público enviou"}</p>
          <p className="mt-1 break-all">{item.sugestao_url ?? item.envio_url}</p>
          {item.envio_descricao && <p className="mt-1">O que a pessoa disse que a fonte mostra: {item.envio_descricao}</p>}
          {item.resumo_ia && <p className="mt-1 text-ink-soft">Sugestão de resumo da IA ({item.provedor_ia ?? "gratuita"}): confira tudo na fonte e reescreva com “segundo [veículo]”.</p>}
        </div>
      )}
      <p className="mt-3 max-w-3xl text-sm text-ink-soft">
        Nada vai ao ar sem fonte, data, trecho (de 20 a 400 letras, nunca a página) e situação jurídica escrita. Pessoa só entra se o nome já é público no caso, nunca vítima, criança, adolescente nem testemunha (ECA, arts. 17, 143 e 247;
        LGPD, art. 14). Quem aprova fica só no histórico interno: a ficha mostra “curadoria do Vale o Escrito”.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Rotulado texto="Dossiê">
          <select className={campo} value={doc.dossie} onChange={(e) => alterar({ dossie: e.target.value })}>
            {SLUGS_DOS_DOSSIES.map((s) => <option key={s} value={s}>{NOME_DO_DOSSIE[s] ?? s}</option>)}
          </select>
        </Rotulado>
        <Rotulado texto="Código da ficha (automático se vazio)">
          <input className={campo} value={doc.id} maxLength={80} placeholder={idDaEntrada(doc.dataDoFato.slice(0, 4) || "2026", doc.titulo || "titulo")} onChange={(e) => alterar({ id: slugDe(e.target.value) })} />
        </Rotulado>
        <Rotulado texto="Título" largura="sm:col-span-2">
          <input className={campo} value={doc.titulo} maxLength={200} onChange={(e) => alterar({ titulo: e.target.value })} />
        </Rotulado>
        <Rotulado texto={`Resumo neutro (${doc.resumo.length}/1200). Tem de dizer “segundo [veículo]” de uma fonte; o que só se alega, “supostamente”`} largura="sm:col-span-2">
          <textarea className={`${campo} min-h-28`} value={doc.resumo} maxLength={1200} onChange={(e) => alterar({ resumo: e.target.value })} />
        </Rotulado>
        <Rotulado texto="Data do fato (AAAA, AAAA-MM ou AAAA-MM-DD)">
          <input className={campo} value={doc.dataDoFato} maxLength={10} onChange={(e) => alterar({ dataDoFato: e.target.value })} />
        </Rotulado>
        <Rotulado texto="Situação jurídica (obrigatória)">
          <select className={campo} value={doc.situacao} onChange={(e) => alterar({ situacao: e.target.value as DocumentoDeEntrada["situacao"] })}>
            {SITUACOES.map((s) => <option key={s} value={s}>{ROTULO_SITUACAO[s]}</option>)}
          </select>
        </Rotulado>
        <Rotulado texto="Confiança">
          <select className={campo} value={doc.confianca} onChange={(e) => alterar({ confianca: e.target.value as DocumentoDeEntrada["confianca"] })}>
            {CONFIANCAS.map((c) => <option key={c} value={c}>{NOME_DA_CONFIANCA[c]}</option>)}
          </select>
        </Rotulado>
        <Rotulado texto="Etiquetas (separadas por vírgula)">
          <input className={campo} value={doc.etiquetas.join(", ")} onChange={(e) => alterar({ etiquetas: e.target.value.split(",").map((t) => t.replace(/^\s+/, "")) })} />
        </Rotulado>
        <Rotulado texto="UF">
          <select className={campo} value={doc.lugar.regiao ?? ""} onChange={(e) => alterar({ lugar: { ...doc.lugar, regiao: e.target.value || undefined, ...(e.target.value ? {} : { municipioIbge: undefined }) } })}>
            <option value="">(sem UF)</option>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </Rotulado>
        <Rotulado texto="Município (código IBGE de 7 dígitos)">
          <input className={campo} inputMode="numeric" value={doc.lugar.municipioIbge ?? ""} maxLength={7} onChange={(e) => alterar({ lugar: { ...doc.lugar, municipioIbge: e.target.value.replace(/\D/g, "") || undefined } })} />
        </Rotulado>
        <Rotulado texto="Nome do município ou lugar">
          <input className={campo} value={doc.lugar.nome ?? ""} maxLength={120} onChange={(e) => alterar({ lugar: { ...doc.lugar, nome: e.target.value } })} />
        </Rotulado>
      </div>

      <h4 className="mt-6 font-semibold">Fontes (a ficha numera na ordem daqui)</h4>
      {doc.fontes.map((f, i) => (
        <div key={f.id} className="mt-3 border border-rule p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className={rotulo}>Fonte {i + 1} ({f.id})</p>
            <button type="button" className={`${botaoClaro} !px-3 !py-1 text-sm`} onClick={() => fonteSai(i)}>Tirar</button>
          </div>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Rotulado texto="Veículo ou órgão (entra em “segundo …”)"><input className={campo} value={f.veiculo} maxLength={120} onChange={(e) => fonteMuda(i, { veiculo: e.target.value })} /></Rotulado>
            <Rotulado texto="Tipo">
              <select className={campo} value={f.tipo} onChange={(e) => fonteMuda(i, { tipo: e.target.value as Fonte["tipo"] })}>
                {TIPOS_DE_FONTE.map((t) => <option key={t} value={t}>{NOME_DO_TIPO_DE_FONTE[t]}</option>)}
              </select>
            </Rotulado>
            <Rotulado texto="Título da página ou do documento" largura="sm:col-span-2"><input className={campo} value={f.titulo} maxLength={300} onChange={(e) => fonteMuda(i, { titulo: e.target.value })} /></Rotulado>
            <Rotulado texto="Link (https://…)" largura="sm:col-span-2"><input className={campo} value={f.url} maxLength={2000} onChange={(e) => fonteMuda(i, { url: e.target.value, arquivoUrl: undefined, arquivoFalhou: undefined })} /></Rotulado>
            <Rotulado texto={`Trecho citado (${trechoRestante(f)} letras sobrando; de 20 a 400)`} largura="sm:col-span-2"><textarea className={`${campo} min-h-20`} value={f.trecho} maxLength={400} onChange={(e) => fonteMuda(i, { trecho: e.target.value })} /></Rotulado>
            <Rotulado texto="Data da fonte (AAAA-MM-DD)"><input className={campo} value={f.data} maxLength={10} onChange={(e) => fonteMuda(i, { data: e.target.value })} /></Rotulado>
            <Rotulado texto="Lida em (AAAA-MM-DD)"><input className={campo} value={f.acessadoEm} maxLength={10} onChange={(e) => fonteMuda(i, { acessadoEm: e.target.value })} /></Rotulado>
          </div>
          <p className="mt-2 text-sm">
            Cópia no Internet Archive:{" "}
            {f.arquivoUrl ? <a className="break-all underline" href={f.arquivoUrl} target="_blank" rel="noreferrer noopener">{f.arquivoUrl}</a> : f.arquivoFalhou ? <span className="text-oxblood">falhou; a entrada sai marcada “arquivo em refação” até a nova tentativa</span> : <span className="text-ink-soft">será feita ao aprovar</span>}
            {" "}
            <button
              type="button"
              className="cursor-pointer underline hover:text-oxblood disabled:opacity-50"
              disabled={ocupado || !/^https?:\/\//.test(f.url)}
              onClick={() => void rodar(async () => {
                const r = await pedirArquivo(f.url);
                if (r.arquivoUrl) fonteMuda(i, { arquivoUrl: r.arquivoUrl, arquivoFalhou: undefined });
                else {
                  fonteMuda(i, { arquivoFalhou: true });
                  setAviso(r.erro ?? "O arquivo não foi feito.");
                }
              })}
            >
              arquivar agora
            </button>
          </p>
        </div>
      ))}
      <button type="button" className={`mt-3 ${botaoClaro}`} onClick={fonteNova}>+ Fonte</button>

      <h4 className="mt-6 font-semibold">Pessoas (só quem já é público no caso)</h4>
      {pessoasPublicas.map((p, i) => {
        const naEntrada = doc.pessoas.find((x) => x.pessoaId === p.id);
        const muda = (parte: Partial<NonNullable<typeof naEntrada>>) => alterar({ pessoas: doc.pessoas.map((x) => (x.pessoaId === p.id ? { ...x, ...parte } : x)) });
        return (
          <div key={i} className="mt-3 border border-rule p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Rotulado texto="Nome público no caso"><input className={campo} value={p.nome} maxLength={160} onChange={(e) => pessoaNome(i, e.target.value)} /></Rotulado>
              <Rotulado texto="Papel como nó da teia">
                <select className={campo} value={p.papel} onChange={(e) => pessoaMuda(i, { papel: e.target.value as typeof p.papel })}>
                  {PAPEIS_DE_PESSOA.map((x) => <option key={x} value={x}>{NOME_DO_PAPEL[x]}</option>)}
                </select>
              </Rotulado>
              <Rotulado texto="Cargo ou função pública (opcional)"><input className={campo} value={p.cargo ?? ""} maxLength={120} onChange={(e) => pessoaMuda(i, { cargo: e.target.value })} /></Rotulado>
              <Rotulado texto="Situação jurídica DELA neste caso">
                <select className={campo} value={naEntrada?.situacao ?? "investigado"} onChange={(e) => muda({ situacao: e.target.value as DocumentoDeEntrada["situacao"] })}>
                  {SITUACOES.map((s) => <option key={s} value={s}>{ROTULO_SITUACAO[s]}</option>)}
                </select>
              </Rotulado>
              <Rotulado texto="Papel no caso (com “segundo [fonte]” ou “supostamente”)" largura="sm:col-span-2"><input className={campo} value={naEntrada?.papelNoCaso ?? ""} maxLength={300} onChange={(e) => muda({ papelNoCaso: e.target.value })} /></Rotulado>
            </div>
            <label className="mt-2 flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={p.publicaNoCaso === true} onChange={(e) => pessoaMuda(i, { publicaNoCaso: e.target.checked as unknown as true })} />
              <span><strong>Pública no caso:</strong> conferi que o nome já consta publicamente no processo, na investigação oficial ou na reportagem. Não é vítima, criança, adolescente nem testemunha.</span>
            </label>
            <p className="mt-2 text-sm">Fontes onde o nome aparece:{" "}
              {doc.fontes.map((f, k) => (
                <label key={f.id} className="mr-3 inline-flex items-center gap-1"><input type="checkbox" checked={p.fonteIds.includes(f.id)} onChange={() => pessoaMuda(i, { fonteIds: alterna(p.fonteIds, f.id) })} />{k + 1}</label>
              ))}
            </p>
            <button type="button" className={`mt-2 ${botaoClaro} !px-3 !py-1 text-sm`} onClick={() => pessoaSai(i)}>Tirar pessoa</button>
          </div>
        );
      })}
      <button type="button" className={`mt-3 ${botaoClaro}`} onClick={pessoaNova}>+ Pessoa</button>

      <h4 className="mt-6 font-semibold">Organizações</h4>
      {orgs.map((o, i) => (
        <div key={i} className="mt-3 border border-rule p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Rotulado texto="Nome"><input className={campo} value={o.nome} maxLength={160} onChange={(e) => orgNome(i, e.target.value)} /></Rotulado>
            <Rotulado texto="Tipo">
              <select className={campo} value={o.tipo} onChange={(e) => orgMuda(i, { tipo: e.target.value as typeof o.tipo })}>
                {TIPOS_DE_ORGANIZACAO.map((t) => <option key={t} value={t}>{NOME_DA_ORG[t]}</option>)}
              </select>
            </Rotulado>
            <Rotulado texto="CNPJ (14 dígitos, opcional)"><input className={campo} inputMode="numeric" value={o.cnpj ?? ""} maxLength={14} onChange={(e) => orgMuda(i, { cnpj: e.target.value.replace(/\D/g, "") })} /></Rotulado>
          </div>
          <p className="mt-2 text-sm">
            <label className="mr-4 inline-flex items-center gap-1"><input type="checkbox" checked={doc.organizacoes.includes(o.id)} onChange={() => orgInclui(o.id)} />citada nesta entrada</label>
            Fontes:{" "}
            {doc.fontes.map((f, k) => (
              <label key={f.id} className="mr-3 inline-flex items-center gap-1"><input type="checkbox" checked={o.fonteIds.includes(f.id)} onChange={() => orgMuda(i, { fonteIds: alterna(o.fonteIds, f.id) })} />{k + 1}</label>
            ))}
          </p>
          <button type="button" className={`mt-2 ${botaoClaro} !px-3 !py-1 text-sm`} onClick={() => orgSai(i)}>Tirar organização</button>
        </div>
      ))}
      <button type="button" className={`mt-3 ${botaoClaro}`} onClick={orgNova}>+ Organização</button>

      <h4 className="mt-6 font-semibold">Ligações da teia (sem fonte não existe ligação)</h4>
      {ligacoes.map((l, i) => (
        <div key={i} className="mt-3 grid gap-3 border border-rule p-3 sm:grid-cols-3">
          <Rotulado texto="De">
            <select className={campo} value={`${l.de.tipo}:${l.de.tipo === "entrada" ? doc.id || "esta-entrada" : l.de.id}`} onChange={(e) => ligacaoMuda(i, { de: noDe(e.target.value) })}>
              {nos.map((n) => <option key={n.valor} value={n.valor}>{n.nome}</option>)}
            </select>
          </Rotulado>
          <Rotulado texto="Tipo">
            <select className={campo} value={l.tipo} onChange={(e) => ligacaoMuda(i, { tipo: e.target.value as Ligacao["tipo"] })}>
              {TIPOS_DE_LIGACAO.map((t) => <option key={t} value={t}>{NOME_DA_LIGACAO[t]}</option>)}
            </select>
          </Rotulado>
          <Rotulado texto="Para">
            <select className={campo} value={`${l.para.tipo}:${l.para.tipo === "entrada" ? doc.id || "esta-entrada" : l.para.id}`} onChange={(e) => ligacaoMuda(i, { para: noDe(e.target.value) })}>
              {nos.map((n) => <option key={n.valor} value={n.valor}>{n.nome}</option>)}
            </select>
          </Rotulado>
          <Rotulado texto="Rótulo curto (com “segundo [fonte]”, opcional)" largura="sm:col-span-3"><input className={campo} value={l.rotulo ?? ""} maxLength={160} onChange={(e) => ligacaoMuda(i, { rotulo: e.target.value })} /></Rotulado>
          <p className="text-sm sm:col-span-3">Fontes:{" "}
            {doc.fontes.map((f, k) => (
              <label key={f.id} className="mr-3 inline-flex items-center gap-1"><input type="checkbox" checked={l.fonteIds.includes(f.id)} onChange={() => ligacaoMuda(i, { fonteIds: alterna(l.fonteIds, f.id) })} />{k + 1}</label>
            ))}
            <button type="button" className="ml-4 cursor-pointer underline hover:text-oxblood" onClick={() => alterar({ ligacoes: ligacoes.filter((_, j) => j !== i) })}>tirar ligação</button>
          </p>
        </div>
      ))}
      <button type="button" className={`mt-3 ${botaoClaro}`} disabled={nos.length < 2} onClick={ligacaoNova}>+ Ligação</button>

      {irmaos.length > 0 && (
        <div className="mt-6 border border-rule p-3">
          <h4 className="font-semibold">Mesclar duplicata</h4>
          <p className="text-sm text-ink-soft">Outra sugestão que fala do mesmo fato: as fontes e as pessoas dela vêm para cá e ela é recusada como duplicata.</p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <select className={campo + " max-w-md"} value={duplicata} onChange={(e) => setDuplicata(e.target.value)}>
              <option value="">Escolha a outra sugestão</option>
              {irmaos.filter((x) => x.id !== filaId).map((x) => <option key={x.id} value={x.id}>{x.rascunho?.titulo || x.sugestao_titulo || x.sugestao_url || x.envio_url || x.id}</option>)}
            </select>
            <button type="button" className={botaoClaro} disabled={!duplicata || ocupado} onClick={() => void mesclar()}>Mesclar aqui</button>
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-rule pt-4">
        <Rotulado texto="Nota da curadoria (fica só no histórico interno; obrigatória para recusar ou devolver)"><textarea className={`${campo} min-h-16`} value={nota} maxLength={2000} onChange={(e) => setNota(e.target.value)} /></Rotulado>
        {!pronto.c.ok && <p className="mt-3 text-sm text-ink-soft">Falta para poder aprovar: {pronto.c.erros.length} ponto(s). {pronto.c.erros.slice(0, 3).join(" · ")}{pronto.c.erros.length > 3 ? " …" : ""}</p>}
        {erros.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-sm text-oxblood">{erros.map((e) => <li key={e}>{e}</li>)}</ul>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className={botaoClaro} disabled={ocupado} onClick={() => void guardar()}>Guardar rascunho</button>
          <button type="button" className={botao} disabled={ocupado} onClick={() => void aprovar()}>Aprovar e publicar</button>
          <button type="button" className={botaoClaro} disabled={ocupado} onClick={() => void decidir("devolver")}>Devolver</button>
          <button type="button" className={botaoClaro} disabled={ocupado} onClick={() => void decidir("recusar")}>Recusar</button>
        </div>
        <p role="status" className={`mt-3 min-h-5 ${aviso ? "painel-aviso" : ""}`}>{aviso}</p>
      </div>
    </div>
  );
}
