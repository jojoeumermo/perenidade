// Os nomes e descrições de cada área ficam nos dicionários (i18n/), um por idioma.
export const areaSlugs = [
  "ingles",
  "portugues",
  "literatura",
  "historia",
  "geografia",
  "sociologia",
  "filosofia",
  "politica",
  "matematica",
  "ciencias",
  "informatica",
  "programacao",
] as const;

export type AreaSlug = (typeof areaSlugs)[number];

export const licenses = [
  "Domínio público",
  "CC BY",
  "CC BY-SA",
  "CC BY-NC",
  "CC BY-NC-SA",
  "CC BY-NC-ND",
  // Para arquivos como o marxists.org, em que a licença muda de texto para texto.
  "Conforme a fonte",
] as const;

export type License = (typeof licenses)[number];

export const levels = ["Iniciante", "Intermediário", "Avançado"] as const;
export type Level = (typeof levels)[number];
