// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
//
// As regras de alerta e o índice de postura. Funções puras: recebem o que a coleta trouxe e o que o banco já sabia,
// devolvem alertas e nota. Nada aqui fala com a rede, para dar para testar sem rede.
import type { Alerta, Configuracao, Evento, Regra, Verificacao } from "./tipos.ts";
import type { Deploy, AlertaGitHub } from "./coletores/plataformas.ts";
import type { Certificado, DominioParecido, RegistroDns } from "./coletores/integridade.ts";
import { faltasDoDns } from "./coletores/integridade.ts";
import { notaDosCabecalhos } from "./coletores/site.ts";

export interface Coletado {
  verificacoes: Verificacao[];
  metricas: { em: string; requisicoes: number; bloqueios: number; desafios: number }[];
  eventos: Evento[];
  dnsMudancas: { nome: string; tipo: string; de: string[]; para: string[] }[];
  certificadosNovos: Certificado[];
  terceirosNovos: { pagina: string; tipo: string; host: string }[];
  dominiosNovos: DominioParecido[];
  deploysMudaram: (Deploy & { estado_antes?: string | null })[];
  githubNovos: AlertaGitHub[];
  cspNovas: number;
}

const ORDEM = ["baixa", "media", "alta", "critica"] as const;
const ORDEM_GITHUB: Record<string, number> = { low: 0, medium: 1, moderate: 1, high: 2, critical: 3 };

const regra = (config: Configuracao, id: string): Regra | undefined => config.regras.find((r) => r.id === id && r.ligada);
const n = (r: Regra | undefined, chave: string, padrao: number) => {
  const v = Number(r?.parametros?.[chave]);
  return Number.isFinite(v) ? v : padrao;
};
const hora = () => new Date().toISOString().slice(0, 13);

/** As últimas verificações de um alvo, da mais nova para a mais velha, incluindo a de agora. */
function seguidas(config: Configuracao, alvo: string, agora: Verificacao | undefined, quantas: number): (boolean | null)[] {
  const antigas = config.verificacoes_recentes.filter((v) => v.alvo === alvo).sort((a, b) => b.em.localeCompare(a.em));
  const lista: (boolean | null)[] = [];
  if (agora) lista.push(agora.no_ar);
  for (const v of antigas) lista.push(v.no_ar);
  return lista.slice(0, quantas);
}

export function avaliar(config: Configuracao, c: Coletado): Alerta[] {
  const alertas: Alerta[] = [];
  const site = c.verificacoes.find((v) => v.alvo === "site");
  const permitidos = (config.configuracoes.site?.terceiros_permitidos ?? []).map((h) => h.toLowerCase());

  let r = regra(config, "site_fora");
  if (r && site && !site.no_ar) {
    const q = n(r, "coletas_seguidas", 2);
    const ultimas = seguidas(config, "site", site, q);
    if (ultimas.length >= q && ultimas.every((v) => v === false)) alertas.push({ regra: r.id, gravidade: r.gravidade, titulo: "O site não está respondendo", resumo: `Sem resposta em ${q} coletas seguidas (${site.erro || `HTTP ${site.status}`}).`, detalhes: { status: site.status, erro: site.erro }, impressao: "site_fora" });
  }

  r = regra(config, "site_lento");
  if (r && site?.no_ar && (site.ms ?? 0) > n(r, "ms", 3000)) {
    const q = n(r, "coletas_seguidas", 3);
    const antigas = config.verificacoes_recentes.filter((v) => v.alvo === "site" && v.no_ar).sort((a, b) => b.em.localeCompare(a.em)).slice(0, q - 1);
    if (antigas.length >= q - 1 && antigas.every((v) => (v.ms ?? 0) > n(r, "ms", 3000))) alertas.push({ regra: r.id, gravidade: r.gravidade, titulo: "O site está lento", resumo: `Tempo de resposta acima de ${n(r, "ms", 3000)} ms em ${q} coletas seguidas (agora: ${site.ms} ms).`, detalhes: { ms: site.ms }, impressao: `site_lento:${hora()}` });
  }

  const ultima = c.metricas.at(-1);
  r = regra(config, "pico_bloqueios");
  if (r && ultima && config.mediana_bloqueios !== null && ultima.bloqueios >= Math.max(n(r, "minimo", 50), n(r, "vezes_mediana", 5) * (config.mediana_bloqueios || 1))) {
    alertas.push({ regra: r.id, gravidade: r.gravidade, titulo: "Pico de bloqueios no WAF", resumo: `${ultima.bloqueios} bloqueios em cinco minutos (mediana da semana: ${Math.round(config.mediana_bloqueios)}).`, detalhes: { bloqueios: ultima.bloqueios, mediana: config.mediana_bloqueios, em: ultima.em }, impressao: `pico_bloqueios:${hora()}` });
  }
  r = regra(config, "pico_requisicoes");
  if (r && ultima && config.mediana_requisicoes !== null && ultima.requisicoes >= Math.max(n(r, "minimo", 2000), n(r, "vezes_mediana", 8) * (config.mediana_requisicoes || 1))) {
    alertas.push({ regra: r.id, gravidade: r.gravidade, titulo: "Pico de requisições (possível DDoS)", resumo: `${ultima.requisicoes} requisições em cinco minutos (mediana da semana: ${Math.round(config.mediana_requisicoes)}).`, detalhes: { requisicoes: ultima.requisicoes, mediana: config.mediana_requisicoes, em: ultima.em }, impressao: `pico_requisicoes:${hora()}` });
  }

  r = regra(config, "logins_falhos");
  const falhos = c.eventos.filter((e) => e.fonte === "auth");
  if (r && falhos.length >= n(r, "maximo_10min", 30)) {
    const ips = new Set(falhos.map((e) => e.ip).filter(Boolean));
    alertas.push({ regra: r.id, gravidade: r.gravidade, titulo: "Muitas tentativas de entrada erradas", resumo: `${falhos.length} tentativas recusadas no último intervalo, de ${ips.size} origem(ns).`, detalhes: { total: falhos.length, origens: ips.size }, impressao: `logins_falhos:${hora()}` });
  }

  r = regra(config, "pagina_mudou");
  for (const e of r ? c.eventos.filter((e) => e.fonte === "pagina" && e.tipo === "mudou_sem_deploy") : []) {
    alertas.push({ regra: r!.id, gravidade: r!.gravidade, titulo: `Página mudou sem deploy: ${e.caminho}`, resumo: "O conteúdo entregue mudou e não houve deploy recente. Pode ser alteração legítima fora do fluxo, ou adulteração.", detalhes: e.detalhes, impressao: e.impressao });
  }

  r = regra(config, "dns_mudou");
  for (const m of r ? c.dnsMudancas : []) {
    alertas.push({ regra: r!.id, gravidade: r!.gravidade, titulo: `DNS mudou: ${m.tipo} de ${m.nome}`, resumo: `De ${m.de.join(", ") || "(vazio)"} para ${m.para.join(", ") || "(vazio)"}.`, detalhes: m, impressao: `dns:${m.nome}:${m.tipo}:${m.para.join(",")}` });
  }

  r = regra(config, "certificado_novo");
  for (const cert of r ? c.certificadosNovos.filter((x) => !x.conhecido) : []) {
    alertas.push({ regra: r!.id, gravidade: r!.gravidade, titulo: `Certificado de emissor desconhecido: ${cert.emissor}`, resumo: `Emitido para ${cert.nomes.slice(0, 3).join(", ")} (CT log ${cert.crt_id}).`, detalhes: { crt_id: cert.crt_id, emissor: cert.emissor, nomes: cert.nomes }, impressao: `cert:${cert.crt_id}` });
  }

  r = regra(config, "terceiro_novo");
  for (const t of r ? c.terceirosNovos.filter((x) => !permitidos.includes(x.host.toLowerCase())) : []) {
    alertas.push({ regra: r!.id, gravidade: r!.gravidade, titulo: `Recurso de terceiro novo: ${t.host}`, resumo: `A página ${t.pagina} passou a carregar ${t.tipo} de ${t.host}, que não está na lista de domínios permitidos.`, detalhes: t, impressao: `terceiro:${t.pagina}:${t.tipo}:${t.host}` });
  }

  r = regra(config, "dominio_parecido");
  for (const d of r ? c.dominiosNovos : []) {
    alertas.push({ regra: r!.id, gravidade: r!.gravidade, titulo: `Domínio parecido passou a existir: ${d.dominio}`, resumo: `Resolve para ${(d.registros.A ?? []).join(", ")}${d.registros.MX?.length ? " e recebe e-mail" : ""}.`, detalhes: d.registros, impressao: `dominio:${d.dominio}` });
  }

  r = regra(config, "deploy_falhou");
  for (const d of r ? c.deploysMudaram.filter((x) => /ERROR|CANCELED|FAILED/.test(x.estado)) : []) {
    alertas.push({ regra: r!.id, gravidade: r!.gravidade, titulo: `Deploy falhou (${d.ramo || d.ambiente})`, resumo: d.mensagem || d.id, detalhes: { id: d.id, estado: d.estado, autor: d.autor }, impressao: `deploy_falhou:${d.id}` });
  }
  r = regra(config, "deploy_desconhecido");
  for (const d of r ? c.deploysMudaram.filter((x) => x.ambiente === "production" && x.estado === "READY" && x.ramo && !["master", "main"].includes(x.ramo)) : []) {
    alertas.push({ regra: r!.id, gravidade: r!.gravidade, titulo: `Deploy de produção fora do ramo principal: ${d.ramo}`, resumo: d.mensagem || d.id, detalhes: { id: d.id, ramo: d.ramo, autor: d.autor }, impressao: `deploy_desconhecido:${d.id}` });
  }

  r = regra(config, "github_alerta");
  const minimoGitHub = ORDEM_GITHUB[String(r?.parametros?.minimo ?? "high")] ?? 2;
  for (const g of r ? c.githubNovos.filter((x) => (ORDEM_GITHUB[x.gravidade.toLowerCase()] ?? 1) >= minimoGitHub || x.tipo === "segredo") : []) {
    alertas.push({ regra: r!.id, gravidade: g.tipo === "segredo" ? "critica" : r!.gravidade, titulo: `GitHub: ${g.tipo} — ${g.titulo}`.slice(0, 160), resumo: g.pacote ? `Pacote ${g.pacote}, gravidade ${g.gravidade}.` : `Gravidade ${g.gravidade}.`, detalhes: { id: g.id, url: g.url }, impressao: `github:${g.id}` });
  }

  r = regra(config, "supabase_fora");
  const sb = c.verificacoes.find((v) => v.alvo === "supabase");
  if (r && sb && !sb.no_ar) {
    const q = n(r, "coletas_seguidas", 2);
    const ultimas = seguidas(config, "supabase", sb, q);
    if (ultimas.length >= q && ultimas.every((v) => v === false)) alertas.push({ regra: r.id, gravidade: r.gravidade, titulo: "O serviço de contas do site não responde", resumo: `Sem resposta em ${q} coletas seguidas (${sb.erro}). Entrada, painel e comunidade do site ficam fora.`, detalhes: { erro: sb.erro }, impressao: "supabase_fora" });
  }

  r = regra(config, "cabecalho_sumiu");
  for (const e of r ? c.eventos.filter((e) => e.fonte === "cabecalho") : []) {
    alertas.push({ regra: r!.id, gravidade: r!.gravidade, titulo: `Cabeçalho de segurança sumiu: ${String(e.detalhes?.cabecalho ?? "")}`, resumo: "O site deixou de enviar um cabeçalho que estava lá na coleta anterior.", detalhes: e.detalhes, impressao: e.impressao });
  }

  r = regra(config, "csp_violacoes");
  if (r && c.cspNovas >= n(r, "minimo_hora", 20)) alertas.push({ regra: r.id, gravidade: r.gravidade, titulo: "Muitas violações da política de segurança do conteúdo", resumo: `${c.cspNovas} relatos distintos chegaram de uma vez.`, detalhes: { total: c.cspNovas }, impressao: `csp:${hora()}` });

  r = regra(config, "isca_pico");
  const iscas = c.eventos.filter((e) => e.fonte === "isca");
  if (r && iscas.length >= n(r, "maximo_hora", 100)) alertas.push({ regra: r.id, gravidade: r.gravidade, titulo: "Varredura em andamento", resumo: `${iscas.length} pedidos a endereços-isca no último intervalo, de ${new Set(iscas.map((e) => e.ip)).size} origem(ns).`, detalhes: { total: iscas.length }, impressao: `isca_pico:${hora()}` });

  r = regra(config, "reputacao_ruim");
  for (const e of r ? c.eventos.filter((e) => e.fonte === "reputacao" && Number(e.detalhes?.abuso ?? 0) >= n(r, "minimo_abuso", 80)) : []) {
    alertas.push({ regra: r!.id, gravidade: r!.gravidade, titulo: `Origem com reputação ruim insistindo: ${e.ip}`, resumo: `Índice de abuso ${String(e.detalhes?.abuso)} (${String(e.detalhes?.relatos ?? 0)} relatos). Já bloqueada pelo WAF; candidata a bloqueio na borda.`, detalhes: e.detalhes, impressao: `reputacao:${e.ip}` });
  }

  r = regra(config, "assetlinks_mudou");
  const assetlinks = c.verificacoes.find((v) => v.alvo === "pagina:/.well-known/assetlinks.json");
  if (r && assetlinks) {
    const antes = config.ultimo_hash["pagina:/.well-known/assetlinks.json"];
    if (!assetlinks.no_ar) alertas.push({ regra: r.id, gravidade: r.gravidade, titulo: "O arquivo assetlinks.json do aplicativo Android sumiu", resumo: `HTTP ${assetlinks.status ?? "sem resposta"}. O aplicativo pode deixar de abrir o site como dele.`, detalhes: { status: assetlinks.status }, impressao: "assetlinks_fora" });
    else if (antes && assetlinks.hash && antes !== assetlinks.hash) alertas.push({ regra: r.id, gravidade: r.gravidade, titulo: "O arquivo assetlinks.json do aplicativo Android mudou", resumo: "Mudou a lista de assinaturas que o site confia. Confira se foi você.", detalhes: { de: antes.slice(0, 16), para: assetlinks.hash.slice(0, 16) }, impressao: `assetlinks:${assetlinks.hash}` });
  }

  // Nunca mais de 20 alertas por passada: uma enxurrada vira um só aviso.
  if (alertas.length > 20) {
    const corte = alertas.slice(0, 19);
    corte.push({ regra: alertas[19].regra, gravidade: "alta", titulo: `Mais ${alertas.length - 19} alertas na mesma coleta`, resumo: "Veja a lista completa de eventos no painel.", impressao: `enxurrada:${hora()}` });
    return corte;
  }
  return alertas;
}

export interface Componente {
  nome: string;
  pontos: number;
  maximo: number;
  faltas: string[];
}

/** O índice de postura: o quanto o site está bem protegido, de 0 a 100, com o que falta em cada parte. */
export function postura(dados: { cabecalhos?: Record<string, string>; dns: RegistroDns[]; certificados: Certificado[]; supabaseNoAr: boolean | null; githubAbertos: AlertaGitHub[]; alertasCriticos: number; ultimoDeployOk: boolean | null; segundoFatorTodos: boolean | null }): { nota: number; componentes: Componente[] } {
  const componentes: Componente[] = [];
  const cab = notaDosCabecalhos(dados.cabecalhos ?? {});
  componentes.push({ nome: "Cabeçalhos de segurança", pontos: Math.round((cab.nota / 100) * 30), maximo: 30, faltas: dados.cabecalhos ? cab.faltas : ["sem leitura ainda"] });
  const faltasDns = dados.dns.length ? faltasDoDns(dados.dns) : ["sem leitura ainda"];
  componentes.push({ nome: "DNS (CAA, SPF, DMARC)", pontos: Math.max(0, 15 - faltasDns.length * 5), maximo: 15, faltas: faltasDns });
  const validos = dados.certificados.filter((c) => c.nao_depois && new Date(c.nao_depois).getTime() > Date.now() + 14 * 86400_000);
  const estranhos = dados.certificados.filter((c) => !c.conhecido && c.nao_depois && new Date(c.nao_depois).getTime() > Date.now());
  componentes.push({ nome: "Certificados", pontos: dados.certificados.length === 0 ? 5 : estranhos.length ? 0 : validos.length ? 10 : 3, maximo: 10, faltas: [...(estranhos.length ? [`${estranhos.length} certificado(s) de emissor desconhecido`] : []), ...(dados.certificados.length && !validos.length ? ["nenhum certificado com mais de 14 dias de validade"] : [])] });
  componentes.push({ nome: "Serviço de contas", pontos: dados.supabaseNoAr === null ? 5 : dados.supabaseNoAr ? 10 : 0, maximo: 10, faltas: dados.supabaseNoAr === false ? ["fora do ar"] : dados.supabaseNoAr === null ? ["não configurado"] : [] });
  const graves = dados.githubAbertos.filter((g) => (ORDEM_GITHUB[g.gravidade.toLowerCase()] ?? 1) >= 2 || g.tipo === "segredo");
  componentes.push({ nome: "Dependências e código (GitHub)", pontos: Math.max(0, 15 - graves.length * 5), maximo: 15, faltas: graves.slice(0, 5).map((g) => `${g.tipo}: ${g.titulo}`.slice(0, 120)) });
  componentes.push({ nome: "Alertas críticos em aberto", pontos: Math.max(0, 10 - dados.alertasCriticos * 5), maximo: 10, faltas: dados.alertasCriticos ? [`${dados.alertasCriticos} alerta(s) crítico(s) sem tratamento`] : [] });
  componentes.push({ nome: "Último deploy", pontos: dados.ultimoDeployOk === null ? 3 : dados.ultimoDeployOk ? 5 : 0, maximo: 5, faltas: dados.ultimoDeployOk === false ? ["o último deploy falhou"] : [] });
  componentes.push({ nome: "Segundo fator da equipe do painel", pontos: dados.segundoFatorTodos === null ? 3 : dados.segundoFatorTodos ? 5 : 0, maximo: 5, faltas: dados.segundoFatorTodos === false ? ["há conta sem aplicativo autenticador"] : [] });
  const nota = componentes.reduce((s, c) => s + c.pontos, 0);
  return { nota: Math.max(0, Math.min(100, nota)), componentes };
}

export const gravidadeMaior = (a: (typeof ORDEM)[number], b: (typeof ORDEM)[number]) => (ORDEM.indexOf(a) >= ORDEM.indexOf(b) ? a : b);
