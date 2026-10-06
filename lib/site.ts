const owner = "jojoeumermo";
const name = "perenidade";
const branch = "master";

export const site = {
  name: "Perenidade",
  description:
    "Conhecimento livre, gratuito e preservado. Aulas, trilhas e um índice de obras de domínio público, mantidos pela comunidade.",
  // Defina NEXT_PUBLIC_SITE_URL no deploy para sitemap e metadados apontarem para o domínio certo.
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  repo: { owner, name, branch },
} as const;

export const repoUrl = `https://github.com/${owner}/${name}`;
export const repoApi = `https://api.github.com/repos/${owner}/${name}`;

// O GitHub recusa URLs muito longas; acima disso o texto vai pela área de transferência.
export const MAX_PREFILL_LENGTH = 6000;

export const github = {
  file: (path: string) => `${repoUrl}/blob/${branch}/${path}`,
  edit: (path: string) => `${repoUrl}/edit/${branch}/${path}`,
  history: (path: string) => `${repoUrl}/commits/${branch}/${path}`,
  commit: (hash: string) => `${repoUrl}/commit/${hash}`,
  newFile: (path: string, value?: string) => {
    const params = new URLSearchParams({ filename: path });
    if (value) params.set("value", value);
    return `${repoUrl}/new/${branch}?${params}`;
  },
  newIssue: (template: string, fields: Record<string, string>) =>
    `${repoUrl}/issues/new?${new URLSearchParams({ template, ...fields })}`,
};
