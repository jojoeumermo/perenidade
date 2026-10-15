// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.

export const dataHora = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
export const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
export const numero = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n)));
export const porcento = (n: number | null | undefined, casas = 2) => (n === null || n === undefined ? "—" : `${Number(n).toFixed(casas).replace(".", ",")} %`);

/** Quanto tempo faz, em palavras curtas. */
export function faz(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return `há ${Math.round(s / 86400)} d`;
}

export type Gravidade = "info" | "baixa" | "media" | "alta" | "critica";
export const nomeGravidade: Record<string, string> = { info: "info", baixa: "baixa", media: "média", alta: "alta", critica: "crítica" };
export const nomeEstado: Record<string, string> = { aberto: "aberto", visto: "visto", silenciado: "silenciado", resolvido: "resolvido", investigando: "investigando", contido: "contido", proposta: "proposta", confirmada: "confirmada", executada: "executada", falhou: "falhou", recusada: "recusada", desfeita: "desfeita" };
export const nomeFonte: Record<string, string> = { waf: "WAF", auth: "entrada", isca: "isca", csp: "CSP", vercel: "Vercel", github: "GitHub", supabase: "Supabase", dns: "DNS", certificado: "certificado", pagina: "página", terceiro: "terceiro", dominio: "domínio", reputacao: "reputação", uptime: "disponibilidade", cabecalho: "cabeçalho", manual: "manual" };
export const nomePapel: Record<string, string> = { dono: "Dono", analista: "Analista", leitor: "Leitor" };
export const nomeTipoAcao: Record<string, string> = { bloquear_ip: "Bloquear IP", bloquear_asn: "Bloquear ASN", bloquear_pais: "Bloquear país", desafiar_ip: "Desafiar IP", desbloquear: "Desbloquear" };
export const nomeRegra: Record<string, string> = {
  site_fora: "Site fora do ar", site_lento: "Site lento", pico_bloqueios: "Pico de bloqueios", pico_requisicoes: "Pico de requisições", logins_falhos: "Entradas erradas", pagina_mudou: "Página mudou sem deploy",
  dns_mudou: "DNS mudou", certificado_novo: "Certificado de emissor desconhecido", terceiro_novo: "Recurso de terceiro novo", dominio_parecido: "Domínio parecido ativo", deploy_falhou: "Deploy falhou", deploy_desconhecido: "Deploy fora do ramo principal",
  github_alerta: "Alerta do GitHub", supabase_fora: "Serviço de contas fora", cabecalho_sumiu: "Cabeçalho de segurança sumiu", csp_violacoes: "Violações de CSP", isca_pico: "Varredura (iscas)", reputacao_ruim: "Origem com reputação ruim", assetlinks_mudou: "assetlinks.json do app mudou",
};
export const modelos: { id: string; nome: string; passos: string[] }[] = [
  { id: "ddos", nome: "Pico de tráfego / DDoS", passos: ["Confirme na Cloudflare (Security → Events) se o pico é de poucas origens ou distribuído.", "Ligue o modo 'Under Attack' na Cloudflare se o site estiver lento para visitantes.", "Proponha aqui o bloqueio das origens ou ASNs mais insistentes (outra pessoa confirma).", "Pause os envios do público no painel do site se a fila estiver sendo inundada.", "Registre horários, origens e o que foi feito; resolva quando o tráfego voltar à mediana."] },
  { id: "credenciais", nome: "Tentativas de entrada / credential stuffing", passos: ["Confira em Ameaças quantas origens e quantas contas foram alvo.", "Garanta que o Turnstile está ligado no Supabase do site (Attack Protection).", "Avise a coordenação do site para conferir contas sensíveis e a exigência de segundo fator.", "Proponha o bloqueio ou desafio das origens insistentes.", "Peça troca de senha a quem teve tentativa certa de origem estranha."] },
  { id: "defacement", nome: "Página alterada sem deploy", passos: ["Compare a impressão da página em Integridade com o último deploy da Vercel.", "Abra o site em navegador anônimo e em outro aparelho: a mudança aparece para todos?", "Confira na Vercel se houve deploy manual ou mudança de variável de ambiente.", "Confira o DNS (Integridade): o domínio aponta para a Vercel?", "Se adulterado: 'Promote to Production' de um deploy bom na Vercel e troque todos os tokens."] },
  { id: "certificado", nome: "Certificado estranho nos CT logs", passos: ["Veja em Integridade o emissor e os nomes do certificado.", "É o provedor de e-mail, a Vercel ou a Cloudflare? Então acrescente o emissor à regra 'certificado_novo'.", "Se ninguém reconhece: confira o DNS e peça revogação à autoridade emissora.", "Crie o registro CAA no DNS para só as autoridades que você usa."] },
  { id: "deploy", nome: "Deploy não reconhecido", passos: ["Veja em Plataforma quem fez o deploy e de que ramo.", "Confira no GitHub se o commit existe e quem o assinou.", "Se não foi a equipe: revogue tokens da Vercel e do GitHub e ative a proteção do ramo master.", "Promova o último deploy bom."] },
  { id: "dns", nome: "DNS mudou", passos: ["Confira na Cloudflare (DNS) quem alterou e quando (Audit Log).", "Se não foi você: troque a senha e o segundo fator da conta Cloudflare, revogue tokens de API.", "Restaure os registros corretos e confira certificado e e-mail."] },
];
