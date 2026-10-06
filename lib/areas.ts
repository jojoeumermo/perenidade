export const areas = [
  { slug: "ingles", name: "Inglês", blurb: "Do alfabeto à conversação." },
  { slug: "historia", name: "História", blurb: "Da Antiguidade ao mundo atual." },
  { slug: "informatica", name: "Informática", blurb: "Como os computadores funcionam." },
  { slug: "programacao", name: "Programação", blurb: "Lógica, web e além." },
  { slug: "matematica", name: "Matemática", blurb: "Do básico ao raciocínio formal." },
  { slug: "literatura", name: "Literatura", blurb: "Clássicos em domínio público." },
] as const;

export type Area = (typeof areas)[number];
export type AreaSlug = Area["slug"];

export const areaSlugs = areas.map((a) => a.slug) as readonly string[];

export function areaName(slug: string): string {
  return areas.find((a) => a.slug === slug)?.name ?? slug;
}

export const licenses = [
  "Domínio público",
  "CC BY",
  "CC BY-SA",
  "CC BY-NC",
  "CC BY-NC-SA",
  "CC BY-NC-ND",
] as const;

export type License = (typeof licenses)[number];

export const levels = ["Iniciante", "Intermediário", "Avançado"] as const;
export type Level = (typeof levels)[number];
