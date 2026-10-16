// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O caderno de estudos: as contas que ele faz sobre os textos escolhidos (resumo, palavras-chave, cartões, questionário,
// mapa, linha do tempo, roteiro de áudio), todas aqui no navegador, sem nenhum serviço de fora. Não há modelo de
// linguagem: é estatística de texto honesta, e o caderno diz isso a quem usa.

export interface Fonte {
  id: string;
  titulo: string;
  tipo: "aula" | "texto" | "arquivo" | "site";
  /** Markdown ou texto puro. */
  texto: string;
  /** Endereço no site ou de onde veio, se houver. */
  origem: string;
  /** Entra nas ferramentas? */
  ativa: boolean;
}

export interface Caderno {
  id: string;
  titulo: string;
  fontes: Fonte[];
  notas: string;
  criado: number;
  atualizado: number;
}

export const novoId = () => Math.random().toString(36).slice(2, 10);

const CHAVE = "lucia:caderno";

export function lerCadernos(): Caderno[] {
  try {
    const bruto = localStorage.getItem(CHAVE);
    const lista = bruto ? (JSON.parse(bruto) as Caderno[]) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}
export function guardarCadernos(lista: Caderno[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    // sem armazenamento (modo privado, cota): o caderno vive só nesta visita
  }
}

/** Markdown vira texto corrido, sem marcas, para as contas. Os títulos ficam como frases próprias. */
export function limpar(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^---[\s\S]*?---\n/, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/\|/g, " ")
    .replace(/[*_`~]/g, "")
    .replace(/\$\$[^$]*\$\$/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** As frases de um texto (pontuação latina e chinesa). */
export function frases(texto: string): string[] {
  return limpar(texto)
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((f) => f.trim())
    .filter((f) => f.length >= 25 && f.length <= 400);
}

const PARADAS = new Set(
  "a o e é de da do das dos em um uma uns umas para por com sem que se não mais como ou os as no na nos nas ao à às aos pelo pela pelos pelas ele ela eles elas eu tu nós vós você vocês seu sua seus suas este esta isto esse essa isso aquele aquela aquilo também já só mas porque quando onde quem qual quais muito muita muitos muitas pouco pouca todo toda todos todas outro outra outros outras mesmo mesma ser estar ter há foi era são está estão tem têm pode podem entre sobre até depois antes então assim ainda aqui ali lá the of and to in is are was were be a an that this it for on with as by at from or not".split(" "),
);
const normal = (p: string) => p.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
const palavras = (texto: string) => normal(texto).match(/[\p{L}\p{N}][\p{L}\p{N}-]{2,}/gu) ?? [];

/** As palavras que mais pesam no texto (frequência), fora as palavras de ligação. */
export function palavrasChave(texto: string, quantas = 12): { palavra: string; vezes: number }[] {
  const contagem = new Map<string, { palavra: string; vezes: number }>();
  for (const bruta of texto.match(/[\p{L}\p{N}][\p{L}\p{N}-]{2,}/gu) ?? []) {
    const chave = normal(bruta);
    if (PARADAS.has(chave) || /^\d+$/.test(chave)) continue;
    const atual = contagem.get(chave) ?? { palavra: bruta, vezes: 0 };
    atual.vezes++;
    // Guarda a grafia mais comum com inicial minúscula, menos para siglas e nomes.
    if (bruta[0] === bruta[0].toLowerCase()) atual.palavra = bruta;
    contagem.set(chave, atual);
  }
  return [...contagem.values()].sort((a, b) => b.vezes - a.vezes).slice(0, quantas);
}

/** Resumo por extração: as frases que mais concentram as palavras-chave, na ordem em que aparecem. */
export function resumir(texto: string, quantas = 6): string[] {
  const lista = frases(texto);
  if (lista.length <= quantas) return lista;
  const pesos = new Map(palavrasChave(texto, 40).map((p, i) => [normal(p.palavra), 1 + (40 - i) / 40]));
  const nota = lista.map((frase, i) => {
    const termos = palavras(frase);
    const soma = termos.reduce((s, t) => s + (pesos.get(t) ?? 0), 0);
    // Frases do começo pesam um pouco mais; frases enormes, um pouco menos.
    return { i, nota: (soma / Math.sqrt(Math.max(6, termos.length))) * (1 + 0.15 * (1 - i / lista.length)) };
  });
  return nota
    .sort((a, b) => b.nota - a.nota)
    .slice(0, quantas)
    .sort((a, b) => a.i - b.i)
    .map((x) => lista[x.i]);
}

export interface Trecho {
  frase: string;
  fonte: string;
  nota: number;
}
/** "Perguntar às fontes": as passagens que mais respondem à pergunta. */
export function procurar(fontes: Fonte[], pergunta: string, quantas = 8): Trecho[] {
  const termos = palavras(pergunta).filter((t) => !PARADAS.has(t));
  if (termos.length === 0) return [];
  const achados: Trecho[] = [];
  for (const fonte of fontes) {
    const lista = frases(fonte.texto);
    lista.forEach((frase, i) => {
      const bolsa = new Set(palavras(frase));
      let nota = 0;
      for (const termo of termos) {
        if (bolsa.has(termo)) nota += 2;
        else if ([...bolsa].some((p) => p.startsWith(termo) || termo.startsWith(p))) nota += 1;
      }
      if (nota > 0) {
        // Junta a frase seguinte para dar contexto.
        achados.push({ frase: `${frase}${lista[i + 1] ? ` ${lista[i + 1]}` : ""}`, fonte: fonte.titulo, nota: nota / termos.length });
      }
    });
  }
  return achados.sort((a, b) => b.nota - a.nota).slice(0, quantas);
}

export interface Cartao {
  frente: string;
  verso: string;
  fonte: string;
}
/** Cartões a partir de títulos (o que é X?), de termos em negrito com a frase onde aparecem e de linhas "termo: definição". */
export function cartoesDe(fonte: Fonte): Cartao[] {
  const saida: Cartao[] = [];
  const linhas = fonte.texto.split("\n");
  for (let i = 0; i < linhas.length; i++) {
    const titulo = /^#{2,3}\s+(.+)$/.exec(linhas[i]);
    if (titulo) {
      const corpo = [];
      for (let j = i + 1; j < linhas.length && !/^#{1,6}\s/.test(linhas[j]) && corpo.join(" ").length < 300; j++) if (linhas[j].trim() && !linhas[j].startsWith("```")) corpo.push(limpar(linhas[j]));
      const resposta = frases(corpo.join(" "))[0] ?? limpar(corpo.join(" ")).slice(0, 240);
      if (resposta) saida.push({ frente: titulo[1].replace(/[*_`]/g, "").trim(), verso: resposta, fonte: fonte.titulo });
    }
    const definicao = /^\s*(?:[-*]\s+)?\*\*([^*]{2,60})\*\*\s*[:：—-]\s*(.{10,300})$/.exec(linhas[i]);
    if (definicao) saida.push({ frente: definicao[1].trim(), verso: limpar(definicao[2]), fonte: fonte.titulo });
  }
  for (const frase of frases(fonte.texto)) {
    const negrito = /\*\*([^*]{3,50})\*\*/.exec(frase);
    if (negrito) continue;
  }
  // Termos em negrito dentro do texto: a frase inteira vira o verso.
  for (const paragrafo of fonte.texto.split(/\n{2,}/)) {
    const termos = [...paragrafo.matchAll(/\*\*([^*\n]{3,50})\*\*/g)].map((m) => m[1].trim());
    if (termos.length === 0 || termos.length > 3) continue;
    const frase = frases(paragrafo).find((f) => termos.some((t) => f.includes(t)));
    if (frase) for (const termo of termos) if (!saida.some((c) => c.frente === termo)) saida.push({ frente: termo, verso: frase, fonte: fonte.titulo });
  }
  const vistos = new Set<string>();
  return saida.filter((c) => {
    const chave = normal(c.frente);
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

export interface Questao {
  pergunta: string;
  opcoes: string[];
  resposta: number;
  explicacao: string;
  fonte: string;
}
/** Perguntas rápidas escritas na aula (blocos ```verificar) e lacunas sorteadas sobre as palavras-chave. */
export function questoesDe(fontes: Fonte[], quantas = 10): Questao[] {
  const saida: Questao[] = [];
  for (const fonte of fontes) {
    for (const bloco of fonte.texto.matchAll(/```verificar\n([\s\S]*?)```/g)) {
      const linhas = bloco[1].split("\n").map((l) => l.trim()).filter(Boolean);
      const pergunta = linhas.find((l) => !/^[-+>]/.test(l)) ?? "";
      const opcoes = linhas.filter((l) => /^[-+]\s/.test(l));
      const resposta = opcoes.findIndex((l) => l.startsWith("+"));
      const dica = linhas.find((l) => l.startsWith(">"))?.slice(1).trim() ?? "";
      if (pergunta && opcoes.length >= 2 && resposta >= 0) saida.push({ pergunta, opcoes: opcoes.map((o) => o.slice(2)), resposta, explicacao: dica, fonte: fonte.titulo });
    }
  }
  // Lacunas: uma frase com uma palavra-chave escondida; as outras alternativas são outras palavras-chave do mesmo texto.
  for (const fonte of fontes) {
    const chaves = palavrasChave(fonte.texto, 16).map((p) => p.palavra).filter((p) => p.length >= 5);
    if (chaves.length < 4) continue;
    const usadas = new Set<string>();
    for (const frase of frases(fonte.texto)) {
      if (saida.length >= quantas * 2) break;
      const alvo = chaves.find((p) => !usadas.has(p) && new RegExp(`(^|[^\\p{L}])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "u").test(frase));
      if (!alvo || frase.length > 220) continue;
      usadas.add(alvo);
      const erradas = chaves.filter((p) => p !== alvo && normal(p) !== normal(alvo)).sort(() => Math.random() - 0.5).slice(0, 3);
      const opcoes = [alvo, ...erradas].sort(() => Math.random() - 0.5);
      saida.push({ pergunta: frase.replace(new RegExp(`(^|[^\\p{L}])${alvo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "u"), "$1_____$2"), opcoes, resposta: opcoes.indexOf(alvo), explicacao: frase, fonte: fonte.titulo });
    }
  }
  return saida.slice(0, quantas * 2);
}

export interface Ramo {
  titulo: string;
  filhos: Ramo[];
}
/** A árvore de títulos de cada fonte, para o mapa mental. */
export function mapaDe(fontes: Fonte[]): Ramo[] {
  return fontes.map((fonte) => {
    const raiz: Ramo = { titulo: fonte.titulo, filhos: [] };
    let atual: Ramo | null = null;
    for (const linha of fonte.texto.split("\n")) {
      const m = /^(#{2,3})\s+(.+)$/.exec(linha);
      if (!m) continue;
      const ramo: Ramo = { titulo: m[2].replace(/[*_`]/g, "").trim().slice(0, 60), filhos: [] };
      if (m[1] === "##" || !atual) {
        raiz.filhos.push(ramo);
        atual = ramo;
      } else atual.filhos.push(ramo);
    }
    if (raiz.filhos.length === 0) raiz.filhos = palavrasChave(fonte.texto, 6).map((p) => ({ titulo: p.palavra, filhos: [] }));
    return raiz;
  });
}

export interface Marco {
  ano: number;
  texto: string;
  fonte: string;
}
/** Os anos citados nas fontes, com a frase em que aparecem, em ordem. */
export function linhaDoTempo(fontes: Fonte[]): Marco[] {
  const marcos: Marco[] = [];
  for (const fonte of fontes) {
    for (const frase of frases(fonte.texto)) {
      for (const m of frase.matchAll(/(?<![\d,.])(1[0-9]{3}|20[0-9]{2})(?![\d,.])/g)) {
        const ano = Number(m[1]);
        if (ano >= 1000 && ano <= 2100 && !marcos.some((x) => x.ano === ano && x.texto === frase)) marcos.push({ ano, texto: frase, fonte: fonte.titulo });
      }
    }
  }
  return marcos.sort((a, b) => a.ano - b.ano).slice(0, 80);
}

/** O roteiro do "resumo em áudio": duas vozes conversam sobre o resumo, no jeito de um programa curto. */
export function roteiroDeAudio(titulo: string, fontes: Fonte[], abertura: string[], perguntas: string[], fecho: string): { voz: 0 | 1; texto: string }[] {
  const todo = fontes.map((f) => f.texto).join("\n\n");
  const pontos = resumir(todo, 7);
  const chaves = palavrasChave(todo, 5).map((p) => p.palavra);
  const falas: { voz: 0 | 1; texto: string }[] = [];
  falas.push({ voz: 0, texto: `${abertura[0]} ${titulo}.` });
  falas.push({ voz: 1, texto: `${abertura[1]} ${fontes.map((f) => f.titulo).join(", ")}.` });
  if (chaves.length) falas.push({ voz: 0, texto: `${abertura[2]} ${chaves.join(", ")}.` });
  pontos.forEach((ponto, i) => {
    falas.push({ voz: (i % 2) as 0 | 1, texto: ponto });
    if (i === 2 && perguntas[0]) falas.push({ voz: 1, texto: perguntas[0] });
  });
  if (perguntas[1]) falas.push({ voz: 0, texto: perguntas[1] });
  falas.push({ voz: 1, texto: fecho });
  return falas;
}

/** Tempo estimado de leitura, em minutos. */
export const minutosDe = (texto: string) => Math.max(1, Math.round(limpar(texto).split(/\s+/).length / 180));
