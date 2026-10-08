// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useState } from "react";
import { areaSlugs, licenses } from "@/lib/areas";
import { can, type Me } from "@/lib/backend";
import tipos from "@/lib/tipos.json";
import { cleanSources, MarkdownEditor, SourcesField, type EditorLabels, type SourceDraft, type SourceLabels } from "../Editor";
import { useI18n } from "../I18n";
import { useTrackOptions } from "../useTrackOptions";
import { Aviso, botao, campo, useAcao } from "./comum";

type TipoId = keyof typeof tipos;
interface Campo {
  nome: string;
  rotulo: string;
  tipo: string;
  obrigatorio?: boolean;
  max?: number;
  opcoes?: string[];
}
interface Tipo {
  rotulo: string;
  ajuda: string;
  titulo: string;
  papel?: string;
  disciplina: string;
  fonte: boolean;
  corpo: { rotulo: string; min: number; editor: boolean };
  campos: Campo[];
}

export const editorPt: EditorLabels = {
  bold: "Negrito",
  italic: "Itálico",
  heading: "Título de seção",
  subheading: "Subtítulo",
  quote: "Citação",
  list: "Lista",
  numbered: "Lista numerada",
  link: "Link",
  linkPrompt: "Endereço do link:",
  preview: "Pré-visualizar",
  write: "Voltar a escrever",
  empty: "*Nada para mostrar ainda.*",
};

export const fontesPt: SourceLabels = {
  title: "Fontes",
  hint: "De onde vêm as informações: livro, artigo, documento, site confiável. Pelo menos uma.",
  name: "Título da obra ou da página",
  author: "Autor",
  url: "Link (se houver)",
  add: "Adicionar fonte",
  remove: "Remover fonte",
};

/** Formulário único para tudo o que entra no site. O que muda de um tipo para outro são os campos. */
export function Escrever({ me }: { me: Me }) {
  const { lang, t } = useI18n();
  const tracks = useTrackOptions(lang);
  const disponiveis = (Object.keys(tipos) as TipoId[]).filter((id) => {
    const tipo = tipos[id] as Tipo;
    return !tipo.papel || can(me, "coordenacao") || can(me, tipo.papel as "jornalismo");
  });
  const [id, setId] = useState<TipoId>(disponiveis[0]);
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [valores, setValores] = useState<Record<string, string>>({});
  const [fontes, setFontes] = useState<SourceDraft[]>([{ titulo: "", autor: "", url: "" }]);
  const { agir, aviso, setAviso, ocupado } = useAcao();

  const tipo = tipos[id] as Tipo;
  const trilha = tracks.find((track) => track.slug === valores.trilha) ?? tracks[0];
  const mudar = (nome: string, valor: string) => setValores((antes) => ({ ...antes, [nome]: valor }));

  // Educadores só publicam nas disciplinas que lhes foram confiadas; o aviso evita trabalho perdido.
  const minhas = me.papeis.filter((p) => p.papel === "educacao").map((p) => p.disciplina);
  const alvo = tipo.disciplina === "trilha" ? trilha?.area : disciplina;

  async function enviar() {
    for (const c of tipo.campos) {
      if (c.tipo !== "trilha" && c.obrigatorio && !(valores[c.nome] ?? "").trim()) return setAviso(`Preencha: ${c.rotulo}.`);
    }
    if (titulo.trim().length < 3) return setAviso(`Preencha: ${tipo.titulo}.`);
    if (corpo.trim().length < tipo.corpo.min) return setAviso(`${tipo.corpo.rotulo}: escreva pelo menos ${tipo.corpo.min} caracteres.`);
    if (tipo.disciplina === "obrigatoria" && !disciplina) return setAviso("Escolha a disciplina.");
    const lista = cleanSources(fontes);
    if (tipo.fonte && lista.length === 0) return setAviso("Cite pelo menos uma fonte.");

    const { alvo: caminho, ...dados } = Object.fromEntries(tipo.campos.map((c) => [c.nome, c.tipo === "trilha" ? (trilha?.slug ?? "") : (valores[c.nome] ?? "").trim()]));
    const resposta = await agir(
      "contribuir",
      { p: { tipo: id, titulo, corpo, disciplina: alvo || null, dados, fontes: lista, alvo: caminho ?? null } },
      "Recebido. Sua contribuição entrou na fila de revisão.",
    );
    if (resposta) {
      setTitulo("");
      setCorpo("");
      setFontes([{ titulo: "", autor: "", url: "" }]);
      setValores({ trilha: valores.trilha });
    }
  }

  function campoDe(c: Campo) {
    const valor = valores[c.nome] ?? "";
    if (c.tipo === "trilha") {
      return (
        <select value={trilha?.slug ?? ""} onChange={(e) => setValores((antes) => ({ ...antes, trilha: e.target.value, slug: "" }))} className={campo}>
          {areaSlugs.map((area) => {
            const daArea = tracks.filter((track) => track.area === area);
            return daArea.length > 0 ? (
              <optgroup key={area} label={t.areas[area][0]}>
                {daArea.map((track) => (
                  <option key={track.slug} value={track.slug}>
                    {track.title}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </select>
      );
    }
    if (c.tipo === "plano") {
      return (
        <select
          value={valor}
          onChange={(e) => {
            mudar("slug", e.target.value);
            const escolhida = trilha?.planned.find((item) => item.slug === e.target.value);
            if (escolhida) setTitulo(escolhida.title);
          }}
          className={campo}
        >
          <option value="">Outro tema (entra no fim da trilha)</option>
          {trilha?.planned.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.title}
            </option>
          ))}
        </select>
      );
    }
    if (c.tipo === "licenca" || c.tipo === "select") {
      const opcoes = c.tipo === "licenca" ? [...licenses] : (c.opcoes ?? []);
      return (
        <select value={valor} onChange={(e) => mudar(c.nome, e.target.value)} className={campo}>
          <option value="">Escolha…</option>
          {opcoes.map((opcao) => (
            <option key={opcao}>{opcao}</option>
          ))}
        </select>
      );
    }
    if (c.tipo === "longo") return <textarea value={valor} onChange={(e) => mudar(c.nome, e.target.value)} maxLength={c.max} rows={4} className={campo} />;
    return (
      <input
        value={valor}
        onChange={(e) => mudar(c.nome, e.target.value)}
        maxLength={c.max ?? 300}
        type={c.tipo === "url" ? "url" : "text"}
        placeholder={c.tipo === "url" ? "https://…" : c.tipo === "caminho" ? "/trilhas/…" : ""}
        className={`${campo} ${c.tipo === "url" || c.tipo === "caminho" ? "font-mono" : ""}`}
      />
    );
  }

  return (
    <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
      <label className="block">
        O que você quer publicar
        <select value={id} onChange={(e) => setId(e.target.value as TipoId)} className={campo}>
          {disponiveis.map((tipoId) => (
            <option key={tipoId} value={tipoId}>
              {(tipos[tipoId] as Tipo).rotulo}
            </option>
          ))}
        </select>
      </label>
      <p className="border-l-2 border-gold pl-4 text-ink-soft">{tipo.ajuda}</p>

      {tipo.campos
        .filter((c) => c.tipo === "trilha" || c.tipo === "plano")
        .map((c) => (
          <label key={c.nome} className="block">
            {c.rotulo}
            {campoDe(c)}
          </label>
        ))}
      {minhas.length > 0 && tipo.disciplina !== "nao" && alvo && !minhas.includes(alvo) && !can(me, "coordenacao", "curadoria") && (
        <p className="text-ink-soft">
          Esta disciplina não está entre as suas ({minhas.map((slug) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug).join(", ")}). O envio entra na fila como contribuição pública.
        </p>
      )}

      {(tipo.disciplina === "obrigatoria" || tipo.disciplina === "opcional") && (
        <label className="block">
          Disciplina{tipo.disciplina === "opcional" ? " (opcional)" : ""}
          <select value={disciplina} onChange={(e) => setDisciplina(e.target.value)} className={campo}>
            <option value="">Escolha…</option>
            {areaSlugs.map((area) => (
              <option key={area} value={area}>
                {t.areas[area][0]}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        {tipo.titulo}
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={160} className={campo} />
      </label>

      {tipo.campos
        .filter((c) => c.tipo !== "trilha" && c.tipo !== "plano")
        .map((c) => (
          <label key={c.nome} className="block">
            {c.rotulo}
            {campoDe(c)}
          </label>
        ))}

      <div>
        <label htmlFor="painel-corpo">{tipo.corpo.rotulo}</label>
        <div className="mt-1">
          {tipo.corpo.editor ? (
            <MarkdownEditor id="painel-corpo" value={corpo} onChange={setCorpo} labels={editorPt} />
          ) : (
            <textarea id="painel-corpo" value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={6} className="w-full border-2 border-ink bg-parchment-deep px-3 py-2" />
          )}
        </div>
      </div>

      {tipo.fonte && <SourcesField value={fontes} onChange={setFontes} labels={fontesPt} />}

      <p className="text-ink-soft">
        Você assina como <strong>{me.nome}</strong>. Tudo passa pela curadoria antes de ir ao ar.
      </p>
      <button type="button" onClick={enviar} disabled={ocupado} className={botao}>
        Enviar para revisão
      </button>
      <Aviso texto={aviso} />
    </form>
  );
}
