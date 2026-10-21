// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useState } from "react";
import { rpc } from "@/lib/backend";
import { registroCompleto } from "@/lib/saude";
import { textoDoErro } from "../../comum";
import { conferirProjeto, type Problema } from "../conferir";
import { Icone } from "../Icone";
import { type CamadaImagem, type CamadaTexto, type Documento, formatoPorMedida, type FormatoId, novoId } from "../motor";
import { projetoNovo } from "../projeto";
import { semMarcas } from "../texto-rico";
import { BOTAO, BOTAO_PRIMARIO, CAMPO, Chave, Dialogo, ROTULO, useEditor } from "../ui";
import { EditorDeFoto } from "./EditorDeFoto";
import { Publicar, Revisao, Versoes } from "./Equipe";
import { JanelaBaixar } from "./Exportar";
import type { Comando } from "./Flutuantes";
import { Previa } from "./Previa";

/** As janelas do estúdio: abre a que estiver pedida. */
export function Janelas({ fotoEmEdicao, fecharFoto, redesenhar }: { comandos: Comando[]; fotoEmEdicao: string | null; fecharFoto: () => void; redesenhar: () => void }) {
  const ed = useEditor();
  const fechar = () => ed.setJanela(null);
  return (
    <>
      {ed.janela === "previa" && <Previa fechar={fechar} />}
      {ed.janela === "baixar" && <JanelaBaixar fechar={fechar} />}
      {ed.janela === "conferir" && <Conferencia fechar={fechar} />}
      {ed.janela === "idioma" && <OutroIdioma fechar={fechar} />}
      {ed.janela === "lote" && <EmLote fechar={fechar} />}
      {ed.janela === "revisao" && <Revisao fechar={fechar} />}
      {ed.janela === "historico" && <Versoes fechar={fechar} />}
      {ed.janela === "publicar" && <Publicar fechar={fechar} />}
      {fotoEmEdicao && <EditorDeFoto id={fotoEmEdicao} fechar={fecharFoto} redesenhar={redesenhar} />}
    </>
  );
}

const NIVEL: Record<Problema["nivel"], { nome: string; cor: string }> = {
  erro: { nome: "Resolver", cor: "text-[#c21f16]" },
  aviso: { nome: "Conferir", cor: "text-e-ouro" },
  dica: { nome: "Dica", cor: "text-e-suave" },
};

/** A conferência antes de postar: o que a marca pede e o que costuma escapar. */
function Conferencia({ fechar }: { fechar: () => void }) {
  const ed = useEditor();
  const problemas = useMemo(() => conferirProjeto(ed.projeto), [ed.projeto]);
  const ir = (p: Problema) => {
    if (p.pagina >= 0) ed.irParaPagina(p.pagina);
    if (p.camada) window.setTimeout(() => ed.selecionar([p.camada!]), 0);
    fechar();
  };
  return (
    <Dialogo titulo="Conferir antes de postar" fechar={fechar} largura="max-w-2xl" rodape={<button type="button" className={BOTAO_PRIMARIO} onClick={() => ed.setJanela("baixar")}>Ir para Baixar</button>}>
      {!problemas.length ? (
        <p className="flex items-center gap-2 text-sm">
          <Icone nome="aprovar" className="h-6 w-6 text-[#2f5d34]" /> Tudo certo: contraste, tamanho de letra, cores, áreas do Instagram, legenda e textos alternativos.
        </p>
      ) : (
        <ul className="divide-y divide-e-fio">
          {problemas.map((p, i) => (
            <li key={i} className="flex items-start gap-3 py-2.5 text-sm">
              <span className={`w-16 shrink-0 font-mono text-[0.7rem] uppercase ${NIVEL[p.nivel].cor}`}>{NIVEL[p.nivel].nome}</span>
              <span className="min-w-0 flex-1">
                {p.pagina >= 0 && ed.projeto.paginas.length > 1 && <span className="text-e-suave">Página {p.pagina + 1} · </span>}
                {p.mensagem}
              </span>
              {(p.camada || p.pagina >= 0) && (
                <button type="button" className="shrink-0 cursor-pointer text-e-bordo underline" onClick={() => ir(p)}>
                  Mostrar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-e-suave">A conferência olha: contraste do texto com o que está atrás (WCAG), letra pequena para o celular, cor fora da paleta, texto saindo da página ou caindo atrás dos botões do Instagram, texto de exemplo esquecido, variável sem valor, imagem sem crédito ou pequena demais, legenda (2.200 caracteres, 30 hashtags) e texto alternativo.</p>
    </Dialogo>
  );
}

const IDIOMAS: [string, string][] = [
  ["en", "Inglês"],
  ["es", "Espanhol"],
  ["fr", "Francês"],
  ["ru", "Russo"],
  ["zh", "Chinês"],
  ["pt-BR", "Português"],
];

/**
 * Duplicar a arte em outro idioma: todos os textos de todas as páginas numa lista, com o original ao lado; a cópia
 * abre no estúdio (o original continua guardado como estava).
 */
function OutroIdioma({ fechar }: { fechar: () => void }) {
  const ed = useEditor();
  const textos = useMemo(() => ed.projeto.paginas.flatMap((d, pagina) => d.camadas.filter((c): c is CamadaTexto => c.tipo === "texto" && !c.texto.match(/^\{[\p{L}_]+\}$/u)).map((c) => ({ pagina, id: c.id, original: c.texto }))), [ed.projeto]);
  const [idioma, setIdioma] = useState("en");
  const [traducoes, setTraducoes] = useState<Record<string, string>>({});
  const [legenda, setLegenda] = useState("");
  const faltam = textos.filter((t) => !(traducoes[t.id] ?? "").trim()).length;
  const criar = () => {
    const nome = IDIOMAS.find(([id]) => id === idioma)?.[1] ?? idioma;
    const projeto = {
      ...ed.projeto,
      idioma,
      legenda: legenda || ed.projeto.legenda,
      paginas: ed.projeto.paginas.map((d) => ({ ...d, id: novoId(), camadas: d.camadas.map((c) => (c.tipo === "texto" && traducoes[c.id]?.trim() ? ed.ajustarAltura({ ...c, texto: traducoes[c.id] }) : c)) })),
    };
    fechar();
    ed.abrir({ tipo: "projeto", projeto, titulo: `${ed.titulo} (${nome})`.slice(0, 120), formato: ed.formato });
  };
  return (
    <Dialogo
      titulo="Versão em outro idioma"
      fechar={fechar}
      largura="max-w-4xl"
      rodape={
        <>
          <span className="mr-auto text-sm text-e-suave">{faltam ? `${faltam} texto(s) sem tradução ficam como estão.` : "Todos os textos traduzidos."}</span>
          <button type="button" className={BOTAO_PRIMARIO} onClick={criar}>
            Criar a versão
          </button>
        </>
      }
    >
      <label className="mb-4 block max-w-xs text-sm">
        Idioma da versão
        <select value={idioma} onChange={(e) => setIdioma(e.target.value)} className={`${CAMPO} mt-1`}>
          {IDIOMAS.map(([id, nome]) => (
            <option key={id} value={id}>
              {nome}
            </option>
          ))}
        </select>
      </label>
      <p className="mb-3 text-sm text-e-suave">Escreva a tradução de cada texto. As marcas de estilo (_itálico_, **negrito**, ==destaque==) e as variáveis ({"{link}"}) podem ficar na tradução. A cópia abre no estúdio sem mexer no original.</p>
      <ul className="space-y-3">
        {textos.map((t) => (
          <li key={t.id} className="grid gap-2 md:grid-cols-2">
            <p className="rounded-md bg-e-fundo p-2 text-sm whitespace-pre-wrap">
              {ed.projeto.paginas.length > 1 && <span className="mr-1 font-mono text-xs text-e-suave">p.{t.pagina + 1}</span>}
              {semMarcas(t.original)}
            </p>
            <textarea value={traducoes[t.id] ?? ""} onChange={(e) => setTraducoes((x) => ({ ...x, [t.id]: e.target.value }))} rows={Math.min(5, t.original.split("\n").length + 1)} lang={idioma} spellCheck className="rounded-md border border-e-fio bg-e-campo p-2 text-sm focus:border-e-bordo focus:outline-none" aria-label={`Tradução de: ${semMarcas(t.original).slice(0, 60)}`} />
          </li>
        ))}
      </ul>
      <label className="mt-4 block text-sm">
        Legenda traduzida
        <textarea value={legenda} onChange={(e) => setLegenda(e.target.value)} rows={4} lang={idioma} className="mt-1 w-full rounded-md border border-e-fio bg-e-campo p-2 text-sm" placeholder={ed.projeto.legenda.slice(0, 200)} />
      </label>
    </Dialogo>
  );
}

type Fonte = "lista" | "saude" | "mural";

/** Lê uma planilha colada (CSV com vírgula ou ponto e vírgula, ou colada do Calc/Excel com tabulação). */
function lerPlanilha(texto: string): { cabecas: string[]; linhas: Record<string, string>[] } {
  const linhas = texto.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (!linhas.length) return { cabecas: [], linhas: [] };
  const sep = linhas[0].includes("\t") ? "\t" : linhas[0].includes(";") ? ";" : ",";
  const dividir = (l: string) => {
    const saida: string[] = [];
    let atual = "";
    let aspas = false;
    for (const ch of l) {
      if (ch === '"') aspas = !aspas;
      else if (ch === sep && !aspas) {
        saida.push(atual.trim());
        atual = "";
      } else atual += ch;
    }
    saida.push(atual.trim());
    return saida;
  };
  const cabecas = dividir(linhas[0]).map((c) =>
    c
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_|_$/g, ""),
  );
  return { cabecas, linhas: linhas.slice(1, 201).map((l) => Object.fromEntries(dividir(l).map((v, i) => [cabecas[i] ?? `c${i}`, v]))) };
}

/**
 * Gerar várias artes de uma vez: a página aberta vira o molde e cada linha da lista (uma planilha colada, a Vitrine
 * da Saúde ou o Mural dos trabalhadores) vira uma página nova, com {coluna} trocado pelo valor. Uma imagem chamada
 * "foto" troca pela foto da linha, quando houver.
 */
function EmLote({ fechar }: { fechar: () => void }) {
  const ed = useEditor();
  const [fonte, setFonte] = useState<Fonte>("lista");
  const [colado, setColado] = useState("nome;funcao\nAna;Educadora de matemática\nJoão;Revisor");
  const [dados, setDados] = useState<{ cabecas: string[]; linhas: Record<string, string>[] }>(() => lerPlanilha("nome;funcao\nAna;Educadora de matemática\nJoão;Revisor"));
  const [carregando, setCarregando] = useState(false);
  const [substituir, setSubstituir] = useState(false);
  const molde = ed.doc;
  const usadas = useMemo(() => [...new Set(molde.camadas.flatMap((c) => (c.tipo === "texto" ? [...c.texto.matchAll(/\{([\p{L}_]+)\}/gu)].map((m) => m[1].toLowerCase()) : [])))], [molde]);
  const carregar = async (f: Fonte) => {
    setFonte(f);
    if (f === "lista") return setDados(lerPlanilha(colado));
    setCarregando(true);
    try {
      if (f === "saude") {
        const r = await rpc<{ perfis?: { nome: string; profissao: string; conselho: string; registro: string; uf: string; abordagem: string; modalidade: string | null; valor: string | null; cidade?: string; foto: string }[] }>("saude_vitrine", {});
        const linhas = (r?.perfis ?? []).map((p) => ({ nome: p.nome, profissao: p.profissao, registro: registroCompleto(p), abordagem: p.abordagem, modalidade: p.modalidade === "online" ? "On-line" : p.modalidade === "presencial" ? "Presencial" : "On-line e presencial", valor: p.valor === "gratuito" ? "Gratuito" : p.valor === "social" ? "Valor social" : "Gratuito ou valor social", cidade: p.cidade ?? "", foto: p.foto }));
        setDados({ cabecas: ["nome", "profissao", "registro", "abordagem", "modalidade", "valor", "cidade", "foto"], linhas });
      } else {
        const r = await rpc<{ titulo: string; oficio: string; descricao: string; cidade: string; uf: string; categoria: string }[]>("mural_listar", {});
        setDados({ cabecas: ["titulo", "oficio", "descricao", "cidade", "uf", "categoria"], linhas: (r ?? []).map((m) => ({ titulo: m.titulo, oficio: m.oficio, descricao: m.descricao, cidade: m.cidade, uf: m.uf, categoria: m.categoria })) });
      }
    } catch (erro) {
      ed.avisar(textoDoErro(erro), "erro");
      setDados({ cabecas: [], linhas: [] });
    } finally {
      setCarregando(false);
    }
  };
  const gerar = () => {
    if (!dados.linhas.length) return;
    const paginas: Documento[] = dados.linhas.map((linha, i) => ({
      ...molde,
      id: novoId(),
      nome: (linha.nome || linha.titulo || `Linha ${i + 1}`).slice(0, 40),
      camadas: molde.camadas.map((c) => {
        const nova = { ...c, id: novoId() };
        if (nova.tipo === "texto") return ed.ajustarAltura({ ...nova, texto: nova.texto.replace(/\{([\p{L}_]+)\}/gu, (inteiro, nome: string) => linha[nome.toLowerCase()] ?? inteiro) });
        if (nova.tipo === "imagem" && /^foto$/i.test((nova.nome ?? "").trim()) && linha.foto) return { ...nova, src: linha.foto, enquadre: null } as CamadaImagem;
        return nova;
      }),
    }));
    fechar();
    if (substituir) ed.abrir({ tipo: "projeto", projeto: { ...projetoNovo(paginas), variaveis: ed.projeto.variaveis, estilos: ed.projeto.estilos, paleta: ed.projeto.paleta }, titulo: `${ed.titulo} (lote)`, formato: (formatoPorMedida(molde.w, molde.h)?.id ?? ed.formato) as FormatoId });
    else {
      ed.setProjeto((p) => ({ ...p, paginas: [...p.paginas, ...paginas] }), true, `Gerou ${paginas.length} páginas`);
      ed.irParaPagina(ed.projeto.paginas.length);
      ed.avisar(`${paginas.length} páginas novas no fim do trabalho. Baixe todas em Baixar › Todas as páginas.`);
    }
  };
  return (
    <Dialogo
      titulo="Gerar várias artes de uma lista"
      fechar={fechar}
      largura="max-w-3xl"
      rodape={
        <>
          <Chave rotulo="Abrir como trabalho novo (sem mexer neste)" ligado={substituir} mudar={setSubstituir} />
          <button type="button" className={BOTAO_PRIMARIO} disabled={!dados.linhas.length || carregando} onClick={gerar}>
            Gerar {dados.linhas.length} página(s)
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-e-suave">
        A página aberta é o molde. Escreva {"{coluna}"} nos textos (por exemplo {"{nome}"}) e cada linha da lista vira uma página.
        {usadas.length > 0 ? ` Este molde usa: ${usadas.map((u) => `{${u}}`).join(", ")}.` : " Este molde ainda não tem nenhuma variável."}
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(
          [
            ["lista", "Colar uma planilha"],
            ["saude", "Vitrine da Saúde"],
            ["mural", "Mural dos trabalhadores"],
          ] as [Fonte, string][]
        ).map(([id, nome]) => (
          <button key={id} type="button" className={`${BOTAO} ${fonte === id ? "border-e-bordo bg-e-bordo-claro text-e-bordo" : ""}`} onClick={() => void carregar(id)}>
            {nome}
          </button>
        ))}
      </div>
      {fonte === "lista" && (
        <label className="block text-sm">
          Cole aqui (a primeira linha são os nomes das colunas; vale copiar do Calc, do Excel ou do Google Planilhas)
          <textarea value={colado} onChange={(e) => { setColado(e.target.value); setDados(lerPlanilha(e.target.value)); }} rows={6} className="mt-1 w-full rounded-md border border-e-fio bg-e-campo p-2 font-mono text-xs" />
        </label>
      )}
      {carregando && <p className="text-sm text-e-suave">Carregando…</p>}
      {dados.linhas.length > 0 && (
        <div className="mt-3 max-h-60 overflow-auto rounded-md border border-e-fio">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-e-fundo">
              <tr>
                {dados.cabecas.filter((c) => c !== "foto").map((c) => (
                  <th key={c} className={`px-2 py-1.5 font-mono font-normal ${usadas.includes(c) ? "text-e-bordo" : "text-e-suave"}`}>{`{${c}}`}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-e-fio">
              {dados.linhas.slice(0, 30).map((l, i) => (
                <tr key={i}>
                  {dados.cabecas.filter((c) => c !== "foto").map((c) => (
                    <td key={c} className="max-w-48 truncate px-2 py-1">{l[c]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={`${ROTULO} mt-3`}>{dados.linhas.length} linha(s){dados.linhas.length >= 200 ? " (o máximo é 200)" : ""}</p>
    </Dialogo>
  );
}
