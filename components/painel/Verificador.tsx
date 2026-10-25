// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O verificador antes de enviar (uma das ideias do painel): confere no próprio navegador o que costuma voltar da
// revisão. "Falta" impede o envio (o formulário já barra); "atenção" só avisa: quem escreveu decide.

export interface Conferencia {
  nivel: "ok" | "atencao" | "falta";
  texto: string;
}

const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
const TELEFONE = /(?:\(?\b\d{2}\)?\s?)9\d{4}[-\s]?\d{4}\b/;
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/;

export function conferir({ titulo, corpo, fontes, exigeFonte, minimo }: { titulo: string; corpo: string; fontes: number; exigeFonte: boolean; minimo: number }): Conferencia[] {
  const lista: Conferencia[] = [];
  const t = titulo.trim();
  const texto = corpo.trim();
  const palavras = texto.split(/\s+/).filter(Boolean).length;

  lista.push(t.length >= 3 ? (t.length > 90 ? { nivel: "atencao", texto: "O título passa de 90 caracteres: títulos curtos aparecem inteiros na busca e no celular." } : { nivel: "ok", texto: "Título." }) : { nivel: "falta", texto: "Falta o título." });
  lista.push(texto.length >= minimo ? { nivel: "ok", texto: `Texto com ${palavras} palavras.` } : { nivel: "falta", texto: `O texto ainda está curto: faltam ${minimo - texto.length} caracteres.` });
  if (exigeFonte) lista.push(fontes > 0 ? { nivel: "ok", texto: fontes === 1 ? "Uma fonte citada." : `${fontes} fontes citadas.` } : { nivel: "falta", texto: "Falta pelo menos uma fonte." });

  // Dado pessoal no texto: CPF, telefone ou e-mail de alguém.
  if (CPF.test(texto) || TELEFONE.test(texto) || EMAIL.test(texto.replace(/\]\([^)]*\)/g, "]"))) lista.push({ nivel: "atencao", texto: "Parece haver CPF, telefone ou e-mail no texto. Dado pessoal não vai ao ar: confira." });
  // Imagem sem descrição: quem usa leitor de tela fica sem saber o que é.
  const semDescricao = (texto.match(/!\[\s*\]\(/g) ?? []).length;
  if (semDescricao) lista.push({ nivel: "atencao", texto: `${semDescricao === 1 ? "Uma imagem está" : `${semDescricao} imagens estão`} sem descrição (o texto entre os colchetes de ![…]).` });
  if (/\]\(http:\/\//.test(texto)) lista.push({ nivel: "atencao", texto: "Há link com http:// (sem cadeado). Use o endereço com https:// quando existir." });
  if (/\[(clique aqui|aqui|link)\]\(/i.test(texto)) lista.push({ nivel: "atencao", texto: "Evite “clique aqui” como texto de link: diga para onde o link leva." });
  // Parágrafo enorme cansa no celular.
  const longos = texto.split(/\n\s*\n/).filter((p) => !/^\s*(\||```|>|- |\d+\.)/.test(p) && p.split(/\s+/).length > 140).length;
  if (longos) lista.push({ nivel: "atencao", texto: `${longos === 1 ? "Um parágrafo passa" : `${longos} parágrafos passam`} de 140 palavras. Quebre em partes menores: lê-se melhor no celular.` });
  if (palavras > 700 && !/^#{2,3}\s/m.test(texto)) lista.push({ nivel: "atencao", texto: "Texto longo sem subtítulos (## ou ###). Subtítulos ajudam a achar as partes." });
  if (/[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{12,}/.test(texto.replace(/`[^`]*`/g, ""))) lista.push({ nivel: "atencao", texto: "Há palavras inteiras em maiúsculas. No texto corrido, parece grito: prefira negrito." });
  return lista;
}

export function Verificador(props: { titulo: string; corpo: string; fontes: number; exigeFonte: boolean; minimo: number }) {
  if (props.corpo.trim().length < 40) return null;
  const lista = conferir(props);
  const faltas = lista.filter((c) => c.nivel === "falta").length;
  const atencoes = lista.filter((c) => c.nivel === "atencao").length;
  const resumo = faltas ? `${faltas} ${faltas === 1 ? "coisa falta" : "coisas faltam"}` : atencoes ? `${atencoes} ${atencoes === 1 ? "ponto de atenção" : "pontos de atenção"}` : "tudo certo para a revisão";
  return (
    <details className={`mt-4 border-2 p-3 ${faltas ? "border-oxblood" : atencoes ? "border-gold" : "border-ok"} bg-folha`} open={faltas + atencoes > 0}>
      <summary className="cursor-pointer text-sm font-semibold">
        Verificador antes de enviar: <span className={faltas ? "text-oxblood" : atencoes ? "" : "text-ok"}>{resumo}</span>
      </summary>
      <ul className="mt-2 space-y-1 text-sm">
        {lista.map((c) => (
          <li key={c.texto} className={c.nivel === "falta" ? "text-oxblood" : c.nivel === "ok" ? "text-ok" : ""}>
            <span aria-hidden className="mr-1.5 inline-block w-3 font-bold">{c.nivel === "ok" ? "✓" : c.nivel === "falta" ? "✕" : "!"}</span>
            {c.texto}
          </li>
        ))}
      </ul>
    </details>
  );
}
