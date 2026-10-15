// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.

/** Variáveis e segredos do Worker. Os segredos nunca saem daqui: nem para o banco, nem para o app, nem para registros. */
export interface Env {
  SENTINELA_SUPABASE_URL: string;
  SENTINELA_SERVICE_KEY?: string;
  CLOUDFLARE_API_TOKEN?: string;
  VERCEL_TOKEN?: string;
  GITHUB_TOKEN?: string;
  SUPABASE_SITE_PAT?: string;
  RESEND_API_KEY?: string;
  ABUSEIPDB_KEY?: string;
  EMAIL_REMETENTE?: string;
  APP_URL?: string;
}

export type Gravidade = "info" | "baixa" | "media" | "alta" | "critica";

export interface Evento {
  em?: string;
  fonte: "waf" | "auth" | "isca" | "csp" | "vercel" | "github" | "supabase" | "dns" | "certificado" | "pagina" | "terceiro" | "dominio" | "reputacao" | "uptime" | "cabecalho" | "manual";
  tipo: string;
  gravidade: Gravidade;
  ip?: string;
  pais?: string;
  asn?: string;
  asn_nome?: string;
  caminho?: string;
  agente?: string;
  acao?: string;
  regra?: string;
  detalhes?: Record<string, unknown>;
  impressao: string;
}

export interface Alerta {
  regra: string;
  gravidade: Exclude<Gravidade, "info">;
  titulo: string;
  resumo?: string;
  detalhes?: Record<string, unknown>;
  impressao: string;
}

export interface Regra {
  id: string;
  ligada: boolean;
  gravidade: Exclude<Gravidade, "info">;
  parametros: Record<string, unknown>;
}

/** O que o banco devolve em coleta_configuracao: o estado que o coletor precisa para comparar. */
export interface Configuracao {
  configuracoes: {
    site?: { url?: string; dominio?: string; paginas?: string[]; terceiros_permitidos?: string[]; app_url?: string };
    plataformas?: { cloudflare_zona?: string; vercel_projeto?: string; vercel_equipe?: string; github_repositorio?: string; supabase_site_url?: string; supabase_site_ref?: string; supabase_site_anon?: string };
    retencao?: Record<string, number>;
  };
  regras: Regra[];
  terceiros_conhecidos: { pagina: string; tipo: string; host: string }[];
  certificados_conhecidos: number[];
  dominios: Record<string, boolean>;
  dns_atual: { nome: string; tipo: string; valores: string[] }[];
  ultimo_hash: Record<string, string>;
  ultimo_deploy_em: string | null;
  verificacoes_recentes: { alvo: string; no_ar: boolean; ms: number | null; em: string }[];
  mediana_bloqueios: number | null;
  mediana_requisicoes: number | null;
  ultima_metrica: string | null;
  ultimo_evento_waf: string | null;
  ultimo_evento_auth: string | null;
  deploys_conhecidos: string[];
  github_conhecidos: Record<string, string>;
  alertas_recentes: { regra: string; impressao: string | null; em: string }[];
  ultimos_cabecalhos: Record<string, string> | null;
  segundo_fator_todos: boolean | null;
  ips_insistentes: { ip: string; bloqueios: number }[];
}

export interface Verificacao {
  alvo: string;
  regiao?: string;
  no_ar: boolean;
  status?: number;
  ms?: number;
  hash?: string;
  cabecalhos?: Record<string, string>;
  nota?: number;
  erro?: string;
}
