// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A prática lúdica das aulas de idioma: os tipos de exercício, a conferência do cabeçalho (campo "pratica" da aula),
// a comparação de respostas e o progresso (pontos, sequência de dias e cartões de memória), guardado só no navegador.
// Serve ao site (lib/content.ts valida; components/Pratica.tsx joga) e ao painel (o educador monta).

export interface Escolha {
  tipo: "escolha";
  pergunta: string;
  opcoes: string[];
  resposta: number;
  /** Texto na língua estudada que o botão de ouvir fala (a própria pergunta, quando vazio). */
  audio?: string;
  dica?: string;
}
export interface Traduzir {
  tipo: "traduzir";
  frase: string;
  /** Traduções aceitas (qualquer uma vale). */
  resposta: string[];
  /** Banco de palavras para montar a resposta tocando; sem ele, a pessoa digita. */
  palavras?: string[];
  /** A frase está na língua estudada (true) ou em português (false, o padrão)? Decide o que o botão de ouvir fala. */
  na_lingua?: boolean;
}
export interface Pares {
  tipo: "pares";
  pares: [string, string][];
}
export interface Lacuna {
  tipo: "lacuna";
  /** Com "___" no lugar da palavra que falta. */
  frase: string;
  resposta: string;
  opcoes?: string[];
  dica?: string;
}
export interface Ordenar {
  tipo: "ordenar";
  frase: string;
  traducao?: string;
}
export interface Ouvir {
  tipo: "ouvir";
  frase: string;
  traducao?: string;
}
export interface Falar {
  tipo: "falar";
  frase: string;
  traducao?: string;
}
export interface Cartoes {
  tipo: "cartoes";
  cartoes: { frente: string; verso: string }[];
}
export type Exercicio = Escolha | Traduzir | Pares | Lacuna | Ordenar | Ouvir | Falar | Cartoes;
export type TipoDeExercicio = Exercicio["tipo"];

export const TIPOS: TipoDeExercicio[] = ["escolha", "traduzir", "pares", "lacuna", "ordenar", "ouvir", "falar", "cartoes"];

/** A língua falada pelo aparelho em cada disciplina de idioma. */
export const LINGUAS: Record<string, string> = { ingles: "en-US", "ingles-infantil": "en-US", espanhol: "es-ES", frances: "fr-FR", chines: "zh-CN", russo: "ru-RU" };
export const linguaDe = (area: string) => LINGUAS[area] ?? "";

const erro = (file: string, mensagem: string): never => {
  throw new Error(`Conteúdo inválido em ${file}: pratica: ${mensagem}`);
};
const texto = (valor: unknown, onde: string, file: string, max = 400): string => {
  if (typeof valor !== "string" || !valor.trim()) erro(file, `${onde} precisa de texto`);
  if ((valor as string).length > max) erro(file, `${onde} passou de ${max} caracteres`);
  return (valor as string).trim();
};
const lista = (valor: unknown, onde: string, file: string, min: number, max: number): string[] => {
  if (!Array.isArray(valor) || valor.length < min || valor.length > max) erro(file, `${onde} precisa de ${min} a ${max} itens`);
  return (valor as unknown[]).map((item, i) => texto(item, `${onde}[${i}]`, file, 200));
};

/** Confere o campo "pratica" do cabeçalho de uma aula. Erro derruba a montagem do site, de propósito. */
export function validarPratica(raw: unknown, file: string): Exercicio[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) erro(file, "deve ser uma lista");
  const itens = raw as Record<string, unknown>[];
  if (itens.length > 60) erro(file, "no máximo 60 exercícios");
  return itens.map((item, i) => {
    const onde = `[${i}]`;
    const tipo = item?.tipo as TipoDeExercicio;
    if (!TIPOS.includes(tipo)) erro(file, `${onde}: tipo desconhecido (${String(item?.tipo)})`);
    switch (tipo) {
      case "escolha": {
        const opcoes = lista(item.opcoes, `${onde}.opcoes`, file, 2, 6);
        const resposta = item.resposta;
        if (typeof resposta !== "number" || !Number.isInteger(resposta) || resposta < 0 || resposta >= opcoes.length) erro(file, `${onde}.resposta deve ser a posição da opção certa`);
        return { tipo, pergunta: texto(item.pergunta, `${onde}.pergunta`, file), opcoes, resposta: resposta as number, audio: typeof item.audio === "string" ? item.audio.trim().slice(0, 300) : undefined, dica: typeof item.dica === "string" ? item.dica.trim().slice(0, 300) : undefined };
      }
      case "traduzir":
        return {
          tipo,
          frase: texto(item.frase, `${onde}.frase`, file),
          resposta: lista(item.resposta, `${onde}.resposta`, file, 1, 8),
          palavras: Array.isArray(item.palavras) ? lista(item.palavras, `${onde}.palavras`, file, 1, 20) : undefined,
          na_lingua: item.na_lingua === true,
        };
      case "pares": {
        if (!Array.isArray(item.pares) || item.pares.length < 2 || item.pares.length > 8) erro(file, `${onde}.pares precisa de 2 a 8 pares`);
        return { tipo, pares: (item.pares as unknown[]).map((par, j) => { const [a, b] = lista(par, `${onde}.pares[${j}]`, file, 2, 2); return [a, b] as [string, string]; }) };
      }
      case "lacuna": {
        const frase = texto(item.frase, `${onde}.frase`, file);
        if (!frase.includes("___")) erro(file, `${onde}.frase precisa de "___" no lugar da palavra que falta`);
        return { tipo, frase, resposta: texto(item.resposta, `${onde}.resposta`, file, 100), opcoes: Array.isArray(item.opcoes) ? lista(item.opcoes, `${onde}.opcoes`, file, 2, 6) : undefined, dica: typeof item.dica === "string" ? item.dica.trim().slice(0, 300) : undefined };
      }
      case "ordenar":
      case "ouvir":
      case "falar":
        return { tipo, frase: texto(item.frase, `${onde}.frase`, file, 200), traducao: typeof item.traducao === "string" ? item.traducao.trim().slice(0, 300) : undefined };
      case "cartoes": {
        if (!Array.isArray(item.cartoes) || item.cartoes.length < 1 || item.cartoes.length > 30) erro(file, `${onde}.cartoes precisa de 1 a 30 cartões`);
        return { tipo, cartoes: (item.cartoes as Record<string, unknown>[]).map((c, j) => ({ frente: texto(c?.frente, `${onde}.cartoes[${j}].frente`, file, 200), verso: texto(c?.verso, `${onde}.cartoes[${j}].verso`, file, 300) })) };
      }
    }
  });
}

/** Compara respostas sem ligar para maiúsculas, pontuação, espaços dobrados nem (na segunda passada) acentos. */
export function normalizar(valor: string, semAcentos = false): string {
  const base = valor
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return semAcentos ? base.normalize("NFD").replace(/\p{M}/gu, "") : base;
}
export const confere = (dado: string, esperado: string | string[]) => {
  const aceitas = Array.isArray(esperado) ? esperado : [esperado];
  return aceitas.some((certa) => normalizar(certa) === normalizar(dado)) || aceitas.some((certa) => normalizar(certa, true) === normalizar(dado, true));
};
/** Quantas palavras da frase esperada apareceram no que foi dito (de 0 a 1), para a fala. */
export function parecido(dito: string, esperado: string): number {
  const alvo = normalizar(esperado, true).split(" ").filter(Boolean);
  const falado = new Set(normalizar(dito, true).split(" ").filter(Boolean));
  if (alvo.length === 0) return 0;
  return alvo.filter((palavra) => falado.has(palavra)).length / alvo.length;
}
/** Separa em palavras (ou em caracteres, no chinês, que não usa espaços). */
export const palavrasDe = (frase: string, lingua: string) => (lingua.startsWith("zh") && !frase.includes(" ") ? [...frase.replace(/[\p{P}\p{S}]/gu, "")] : frase.replace(/[\p{P}\p{S}]/gu, "").split(/\s+/).filter(Boolean));
export const juntar = (palavras: string[], lingua: string) => (lingua.startsWith("zh") ? palavras.join("") : palavras.join(" "));

export function embaralhar<T>(itens: T[]): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Fala uma frase com a voz do aparelho, na língua estudada. Devolve quando terminar (ou logo, se não houver voz). */
export function falar(frase: string, lingua: string, rate = 1): Promise<void> {
  return new Promise((resolver) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolver();
    const synth = window.speechSynthesis;
    synth.cancel();
    const fala = new SpeechSynthesisUtterance(frase.slice(0, 300));
    const vozes = synth.getVoices();
    const voz = vozes.find((v) => v.lang.replace("_", "-").toLowerCase() === lingua.toLowerCase()) ?? vozes.find((v) => v.lang.toLowerCase().startsWith(lingua.slice(0, 2).toLowerCase()));
    fala.lang = lingua;
    if (voz) fala.voice = voz;
    fala.rate = rate;
    fala.onend = () => resolver();
    fala.onerror = () => resolver();
    synth.speak(fala);
  });
}
export const temVoz = () => typeof window !== "undefined" && "speechSynthesis" in window;

// ───── Progresso: pontos, sequência de dias e cartões (tudo só neste navegador) ─────

export interface CartaoGuardado {
  /** Facilidade (SM-2): começa em 2,5. */
  f: number;
  /** Intervalo em dias. */
  i: number;
  /** Próxima revisão (dia AAAA-MM-DD). */
  p: string;
}
export interface Progresso {
  xp: number;
  sequencia: number;
  ultimoDia: string;
  som: boolean;
  porAula: Record<string, { sessoes: number; melhor: number; em: string }>;
  cartoes: Record<string, CartaoGuardado>;
}

const CHAVE = "lucia:pratica";
export const hoje = () => new Date().toISOString().slice(0, 10);
const ontem = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

export function lerProgresso(): Progresso {
  const vazio: Progresso = { xp: 0, sequencia: 0, ultimoDia: "", som: true, porAula: {}, cartoes: {} };
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? { ...vazio, ...(JSON.parse(bruto) as Partial<Progresso>) } : vazio;
  } catch {
    return vazio;
  }
}
export function guardarProgresso(p: Progresso) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(p));
  } catch {
    // sem armazenamento: o jogo funciona, só não lembra
  }
  window.dispatchEvent(new Event("lucia:pratica"));
}

/** Uma sessão terminou: soma os pontos (10 por acerto, 5 por tentativa) e mantém a sequência de dias. */
export function registrarSessao(idAula: string, acertos: number, total: number): Progresso {
  const p = lerProgresso();
  const dia = hoje();
  if (p.ultimoDia !== dia) p.sequencia = p.ultimoDia === ontem() ? p.sequencia + 1 : 1;
  p.ultimoDia = dia;
  p.xp += acertos * 10 + (total - acertos) * 5;
  const atual = p.porAula[idAula] ?? { sessoes: 0, melhor: 0, em: dia };
  p.porAula[idAula] = { sessoes: atual.sessoes + 1, melhor: Math.max(atual.melhor, total ? Math.round((acertos / total) * 100) : 0), em: dia };
  guardarProgresso(p);
  return p;
}

/** Cartão de memória respondido: "fácil" afasta a próxima revisão, "difícil" aproxima (SM-2 simplificado). */
export function revisarCartao(chave: string, facil: boolean) {
  const p = lerProgresso();
  const c = p.cartoes[chave] ?? { f: 2.5, i: 0, p: hoje() };
  if (facil) {
    c.i = c.i === 0 ? 1 : c.i === 1 ? 3 : Math.round(c.i * c.f);
    c.f = Math.min(3, c.f + 0.1);
  } else {
    c.i = 0;
    c.f = Math.max(1.3, c.f - 0.2);
  }
  c.p = new Date(Date.now() + c.i * 86_400_000).toISOString().slice(0, 10);
  p.cartoes[chave] = c;
  guardarProgresso(p);
}
/** Os cartões cuja revisão venceu (ou nunca foram vistos). */
export const cartaoVencido = (chave: string, p: Progresso) => !p.cartoes[chave] || p.cartoes[chave].p <= hoje();
