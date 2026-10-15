// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
//
// Dados fictícios para o modo de demonstração: mesmos formatos que o banco devolve, para avaliar as telas sem serviço.
// Nenhum endereço aqui é real (faixas reservadas para documentação).

const agora = Date.now();
const iso = (msAtras: number) => new Date(agora - msAtras).toISOString();
const semente = (n: number) => Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1;

const pessoas = [
  { id: "p1", nome: "Jonathan Santos", email: "jonathan@exemplo.org", papel: "dono", ativo: true, criado_em: iso(90 * 86400000), visto_em: iso(60000), segundo_fator: true },
  { id: "p2", nome: "Ana Analista", email: "ana@exemplo.org", papel: "analista", ativo: true, criado_em: iso(40 * 86400000), visto_em: iso(3600000), segundo_fator: true },
  { id: "p3", nome: "Leo Leitor", email: "leo@exemplo.org", papel: "leitor", ativo: true, criado_em: iso(10 * 86400000), visto_em: iso(2 * 86400000), segundo_fator: false },
];

const tempos = Array.from({ length: 288 }, (_, i) => ({ em: iso((287 - i) * 300000), ms: Math.round(160 + semente(i) * 120 + (i === 200 ? 2400 : 0)), no_ar: i !== 150 }));
const trafego = Array.from({ length: 288 }, (_, i) => {
  const hora = new Date(agora - (287 - i) * 300000).getHours();
  const base = 180 + Math.round(140 * Math.max(0, Math.sin(((hora - 6) / 24) * Math.PI * 2)));
  return { em: iso((287 - i) * 300000), requisicoes: base + Math.round(semente(i + 7) * 60) + (i > 230 && i < 240 ? 900 : 0), bloqueios: Math.round(3 + semente(i + 3) * 8 + (i > 230 && i < 240 ? 120 : 0)), desafios: Math.round(semente(i + 11) * 4) };
});
const ips = [
  { ip: "203.0.113.9", pais: "BR", asn: "AS64500", asn_nome: "Exemplo Hospedagem", total: 184, bloqueios: 184, primeiro: iso(5 * 3600000), ultimo: iso(300000), abuso: 92 },
  { ip: "198.51.100.77", pais: "US", asn: "AS64501", asn_nome: "Cloud Example", total: 61, bloqueios: 58, primeiro: iso(26 * 3600000), ultimo: iso(900000), abuso: 40 },
  { ip: "192.0.2.14", pais: "DE", asn: "AS64502", asn_nome: "Example Net", total: 23, bloqueios: 23, primeiro: iso(2 * 3600000), ultimo: iso(1800000), abuso: -1 },
  { ip: "203.0.113.200", pais: "CN", asn: "AS64503", asn_nome: "Example Telecom", total: 12, bloqueios: 10, primeiro: iso(12 * 3600000), ultimo: iso(5400000), abuso: 15 },
];
const caminhos = ["/wp-login.php", "/.env", "/xmlrpc.php", "/admin", "/pt/entrar", "/.git/config", "/backup.sql"];
const eventos = Array.from({ length: 120 }, (_, i) => {
  const o = ips[i % ips.length];
  const isca = i % 3 !== 0;
  return { id: 1000 - i, em: iso(i * 420000), fonte: i % 9 === 0 ? "auth" : isca ? "isca" : "waf", tipo: i % 9 === 0 ? "login_falho" : isca ? "isca" : "firewallManaged", gravidade: i % 9 === 0 ? "baixa" : "media", ip: o.ip, pais: o.pais, asn: o.asn, asn_nome: o.asn_nome, caminho: caminhos[i % caminhos.length], agente: "Mozilla/5.0 (compatible; scanner)", acao: i % 9 === 0 ? "" : "block", regra: i % 9 === 0 ? "" : "managed", detalhes: {} };
});
const alertas = [
  { id: 1, em: iso(1500000), regra: "pico_bloqueios", gravidade: "alta", titulo: "Pico de bloqueios no WAF", resumo: "131 bloqueios em cinco minutos (mediana da semana: 6).", estado: "aberto", detalhes: { bloqueios: 131, mediana: 6 }, incidente: null, visto_nome: null },
  { id: 2, em: iso(5 * 3600000), regra: "reputacao_ruim", gravidade: "media", titulo: "Origem com reputação ruim insistindo: 203.0.113.9", resumo: "Índice de abuso 92 (310 relatos). Já bloqueada pelo WAF; candidata a bloqueio na borda.", estado: "visto", detalhes: { abuso: 92 }, incidente: "i1", visto_nome: "Ana Analista", incidente_numero: 1 },
  { id: 3, em: iso(2 * 86400000), regra: "certificado_novo", gravidade: "alta", titulo: "Certificado de emissor desconhecido: Example CA", resumo: "Emitido para mail.institutolucia.org (CT log 1234567).", estado: "resolvido", detalhes: {}, incidente: null, visto_nome: "Jonathan Santos" },
  { id: 4, em: iso(3 * 86400000), regra: "deploy_falhou", gravidade: "media", titulo: "Deploy falhou (master)", resumo: "Build quebrou na validação do conteúdo.", estado: "resolvido", detalhes: {}, incidente: null, visto_nome: "Jonathan Santos" },
];
const incidentes = [
  { id: "i1", numero: 1, titulo: "Varredura insistente a partir de 203.0.113.9", resumo: "Centenas de pedidos a endereços-isca (/wp-login.php, /.env) em poucas horas.", gravidade: "alta", estado: "investigando", modelo: "credenciais", aberto_por: "p2", atribuido_a: "p2", aberto_em: iso(4 * 3600000), atualizado_em: iso(1200000), resolvido_em: null, aberto_nome: "Ana Analista", atribuido_nome: "Ana Analista", alertas: 1, eventos: 12, acoes: 1 },
  { id: "i2", numero: 2, titulo: "Certificado estranho para mail.institutolucia.org", resumo: "Era o certificado do provedor de e-mail; emissor acrescentado à lista de conhecidos.", gravidade: "media", estado: "resolvido", modelo: "certificado", aberto_por: "p1", atribuido_a: "p1", aberto_em: iso(2 * 86400000), atualizado_em: iso(86400000), resolvido_em: iso(86400000), aberto_nome: "Jonathan Santos", atribuido_nome: "Jonathan Santos", alertas: 1, eventos: 0, acoes: 0 },
];
const acoes = [
  { id: "a1", incidente: "i1", incidente_numero: 1, tipo: "bloquear_ip", alvo: "203.0.113.9", motivo: "varredura insistente, reputação de abuso 92", duracao_horas: 72, estado: "proposta", proposta_por: "p2", proposta_nome: "Ana Analista", proposta_em: iso(1200000), confirmada_por: null, confirmada_nome: null, confirmada_em: null, executada_em: null, resultado: {}, referencia: "" },
  { id: "a0", incidente: null, incidente_numero: null, tipo: "bloquear_pais", alvo: "KP", motivo: "teste da ferramenta na instalação", duracao_horas: 1, estado: "desfeita", proposta_por: "p1", proposta_nome: "Jonathan Santos", proposta_em: iso(20 * 86400000), confirmada_por: "p2", confirmada_nome: "Ana Analista", confirmada_em: iso(20 * 86400000), executada_em: iso(20 * 86400000), resultado: { desfeita: "prazo vencido" }, referencia: "x" },
];
const postura = { nota: 86, em: iso(300000), componentes: [
  { nome: "Cabeçalhos de segurança", pontos: 30, maximo: 30, faltas: [] },
  { nome: "DNS (CAA, SPF, DMARC)", pontos: 10, maximo: 15, faltas: ["sem registro CAA (qualquer autoridade pode emitir certificado para o domínio)"] },
  { nome: "Certificados", pontos: 10, maximo: 10, faltas: [] },
  { nome: "Serviço de contas", pontos: 10, maximo: 10, faltas: [] },
  { nome: "Dependências e código (GitHub)", pontos: 10, maximo: 15, faltas: ["dependabot: KaTeX: prototype pollution (low)"] },
  { nome: "Alertas críticos em aberto", pontos: 10, maximo: 10, faltas: [] },
  { nome: "Último deploy", pontos: 5, maximo: 5, faltas: [] },
  { nome: "Segundo fator da equipe do painel", pontos: 1, maximo: 5, faltas: ["há conta sem aplicativo autenticador"] },
] };

const respostas: Record<string, (args: Record<string, unknown>) => unknown> = {
  eu: () => ({ ...pessoas[0], segundo_fator_na_sessao: true, tem_fator: true, avisos: { email: true, desktop: true, minimo: "media" }, alertas_abertos: 1 }),
  resumo: () => ({
    agora: iso(0), ultima_coleta: iso(120000),
    site: { no_ar: true, status: 200, ms: 212, em: iso(120000), nota: 95 },
    disponibilidade: 99.65, ms_mediana: 214,
    tempos, trafego,
    totais: { requisicoes: trafego.reduce((s, t) => s + t.requisicoes, 0), bloqueios: trafego.reduce((s, t) => s + t.bloqueios, 0), desafios: trafego.reduce((s, t) => s + t.desafios, 0) },
    postura, postura_historico: Array.from({ length: 30 }, (_, i) => ({ em: iso((29 - i) * 86400000), nota: 78 + Math.round(semente(i) * 10) })),
    alertas_abertos: 1, alertas_recentes: alertas.slice(0, 4), incidentes_abertos: 1,
    eventos_por_fonte: { waf: 48, isca: 59, auth: 13 },
    supabase: { no_ar: true, ms: 98, em: iso(120000) },
    ultimo_deploy: { id: "dpl_1", estado: "READY", ambiente: "production", ramo: "master", commit: "827d49a", mensagem: "Instagram: o perfil do instituto no rodapé", autor: "jojoeumermo", criado_em: iso(9 * 3600000), pronto_em: iso(9 * 3600000 - 240000) },
  }),
  ameacas_resumo: () => ({
    ips, paises: [{ pais: "BR", total: 190 }, { pais: "US", total: 61 }, { pais: "DE", total: 23 }, { pais: "CN", total: 12 }, { pais: "RU", total: 6 }],
    caminhos: caminhos.map((c, i) => ({ caminho: c, total: 80 - i * 9 })),
    regras: [{ regra: "managed", acao: "block", total: 230 }, { regra: "rate_limit_api", acao: "block", total: 24 }, { regra: "bot_fight", acao: "managed_challenge", total: 18 }],
    logins_falhos: Array.from({ length: 24 }, (_, i) => ({ em: iso((23 - i) * 3600000), total: Math.round(semente(i + 5) * 4) })),
    por_hora: Array.from({ length: 24 }, (_, i) => ({ em: iso((23 - i) * 3600000), waf: Math.round(2 + semente(i) * 6 + (i === 20 ? 120 : 0)), isca: Math.round(1 + semente(i + 2) * 5), auth: Math.round(semente(i + 5) * 3) })),
  }),
  eventos_listar: (a) => {
    const p = (a.p ?? {}) as { fonte?: string; busca?: string; ip?: string };
    return eventos.filter((e) => (!p.fonte || e.fonte === p.fonte) && (!p.ip || e.ip === p.ip) && (!p.busca || e.caminho.includes(p.busca) || e.ip.includes(p.busca)));
  },
  integridade_ver: () => ({
    paginas: ["site", "pagina:/pt", "pagina:/pt/entrar", "pagina:/pt/trilhas", "pagina:/pt/acervo", "pagina:/.well-known/assetlinks.json"].map((alvo, i) => ({ alvo, hash: `c0ffee${i}a9e3b1${i}`, em: iso(120000), status: 200, ms: 150 + i * 20, versoes_7d: i === 0 ? 2 : 1, mudou_em: i === 0 ? iso(9 * 3600000) : null })),
    mudancas: [{ id: 5, em: iso(9 * 3600000), tipo: "mudou_com_deploy", caminho: "/", detalhes: { deploy_recente: true } }],
    dns: [
      { nome: "institutolucia.org", tipo: "A", valores: ["198.51.100.1", "198.51.100.2"], em: iso(3600000) },
      { nome: "institutolucia.org", tipo: "NS", valores: ["ns1.example-dns.com", "ns2.example-dns.com"], em: iso(3600000) },
      { nome: "institutolucia.org", tipo: "MX", valores: ["10 mx.example-mail.com"], em: iso(3600000) },
      { nome: "institutolucia.org", tipo: "TXT", valores: ["v=spf1 include:_spf.example-mail.com ~all"], em: iso(3600000) },
      { nome: "_dmarc.institutolucia.org", tipo: "TXT", valores: ["v=DMARC1; p=quarantine; rua=mailto:dmarc@exemplo.org"], em: iso(3600000) },
      { nome: "institutolucia.org", tipo: "CAA", valores: [], em: iso(3600000) },
    ],
    dns_mudancas: [],
    certificados: [
      { crt_id: 9876543, emissor: "Google Trust Services", nome_comum: "institutolucia.org", nomes: ["institutolucia.org", "*.institutolucia.org"], nao_antes: iso(20 * 86400000), nao_depois: iso(-70 * 86400000), visto_em: iso(3600000), conhecido: true },
      { crt_id: 1234567, emissor: "Example CA", nome_comum: "mail.institutolucia.org", nomes: ["mail.institutolucia.org"], nao_antes: iso(3 * 86400000), nao_depois: iso(-87 * 86400000), visto_em: iso(2 * 86400000), conhecido: false },
    ],
    terceiros: [{ id: 1, pagina: "/pt/entrar", tipo: "script", host: "challenges.cloudflare.com", url: "https://challenges.cloudflare.com/turnstile/v0/api.js", primeiro_em: iso(30 * 86400000), visto_em: iso(120000), permitido: true }],
    dominios: [{ dominio: "institutolucia.com", resolve: true, registros: { A: ["192.0.2.50"], MX: [] }, primeiro_em: iso(60 * 86400000), visto_em: iso(3600000), mudou_em: null }, { dominio: "instituto-lucia.org", resolve: false, registros: { A: [] }, primeiro_em: iso(60 * 86400000), visto_em: iso(3600000), mudou_em: null }],
    cabecalhos: { "strict-transport-security": "max-age=63072000; includeSubDomains", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; …", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "strict-origin-when-cross-origin", "permissions-policy": "camera=(), microphone=(self)", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin" },
    nota: 95,
  }),
  plataforma_ver: () => ({
    deploys: Array.from({ length: 8 }, (_, i) => ({ id: `dpl_${i}`, estado: i === 3 ? "ERROR" : "READY", ambiente: i % 4 === 1 ? "preview" : "production", url: "", ramo: i % 4 === 1 ? "podcasts" : "master", commit: `${(1000 + i * 37).toString(16)}f3a`, mensagem: ["Instagram: o perfil do instituto no rodapé", "Celular: barra de abas encostada embaixo", "Podcast: manual explica o teste local", "Jornal: título principal para leitor de tela"][i % 4], autor: "jojoeumermo", criado_em: iso((i + 1) * 9 * 3600000), pronto_em: iso((i + 1) * 9 * 3600000 - 240000) })),
    github: [{ id: "dependabot:12", tipo: "dependabot", gravidade: "low", titulo: "KaTeX: Existing prototype pollution can bypass trust restrictions", pacote: "katex", estado: "open", url: "", criado_em: iso(12 * 86400000), visto_em: iso(3600000) }],
    supabase: [{ alvo: "supabase", no_ar: true, ms: 98, em: iso(120000), status: 200, erro: "" }, { alvo: "supabase:rest", no_ar: true, ms: 131, em: iso(120000), status: 200, erro: "" }, { alvo: "supabase:storage", no_ar: true, ms: 142, em: iso(120000), status: 200, erro: "" }],
    supabase_historico: tempos.map((t) => ({ em: t.em, ms: Math.round(t.ms * 0.5), no_ar: true })),
    csp: [{ id: 1, impressao: "x", documento: "https://institutolucia.org/pt/ferramentas/python", diretiva: "script-src", bloqueado: "eval", vezes: 7, primeiro_em: iso(3 * 86400000), ultimo_em: iso(7200000) }],
    emails: { pendentes: 0, falhos: 0, enviados_7d: 3 },
  }),
  alertas_listar: (a) => alertas.filter((x) => !a.p_estado || a.p_estado === "ativos" ? x.estado !== "resolvido" || !a.p_estado : x.estado === a.p_estado),
  alerta_marcar: () => ({ ok: true }),
  incidentes_listar: (a) => incidentes.filter((i) => !a.p_estado || (a.p_estado === "ativos" ? i.estado !== "resolvido" : i.estado === a.p_estado)),
  incidente_ver: (a) => ({ ...incidentes.find((i) => i.id === a.p_id)!, notas: [{ id: 1, texto: "Incidente aberto.", tipo: "sistema", em: iso(4 * 3600000), autor: "p2", nome: "Ana Analista" }, { id: 2, texto: "Mesma origem desde ontem; reputação de abuso 92. Proponho bloqueio por 72 h.", tipo: "nota", em: iso(1300000), autor: "p2", nome: "Ana Analista" }, { id: 3, texto: "Proposta: bloquear_ip 203.0.113.9 (varredura insistente). Aguarda confirmação de outra pessoa.", tipo: "sistema", em: iso(1200000), autor: "p2", nome: "Ana Analista" }], alertas_lista: alertas.slice(1, 2), eventos_lista: eventos.slice(0, 12), acoes_lista: acoes.slice(0, 1) }),
  incidente_abrir: () => ({ id: "i1" }),
  incidente_atualizar: () => incidentes[0],
  incidente_nota: () => ({ ok: true }),
  incidente_vincular: () => ({ ok: true }),
  acao_propor: () => acoes[0],
  acao_confirmar: () => ({ ...acoes[0], estado: "confirmada" }),
  acoes_listar: () => acoes,
  equipe_listar: () => pessoas,
  convites_listar: () => [{ id: "c1", email: "nova@exemplo.org", papel: "leitor", criado_em: iso(86400000), expira_em: iso(-6 * 86400000), usado: false, revogado: false, vale: true }],
  convite_criar: () => ({ id: "c2", codigo: "demo".repeat(16), expira_em: iso(-7 * 86400000) }),
  convite_revogar: () => ({ ok: true }),
  papel_mudar: () => ({ ok: true }),
  conta_ativar: () => ({ ok: true }),
  perfil_salvar: () => ({ ok: true }),
  avisos_configurar: (a) => a.p,
  auditoria_listar: () => Array.from({ length: 30 }, (_, i) => ({ id: 500 - i, quem: pessoas[i % 3].id, nome: pessoas[i % 3].nome, acao: ["viu:ameacas", "alerta_visto", "incidente_nota", "viu:incidente", "acao_proposta", "exportou:relatorio", "viu:auditoria"][i % 7], alvo: i % 7 === 3 ? "i1" : "", detalhes: {}, criado_em: iso(i * 2700000) })),
  tela_vista: () => ({ ok: true }),
  configuracoes_ver: () => ({ site: { url: "https://institutolucia.org", dominio: "institutolucia.org", paginas: ["/", "/pt", "/pt/entrar", "/pt/trilhas", "/pt/acervo", "/.well-known/assetlinks.json"], terceiros_permitidos: ["challenges.cloudflare.com", "www.youtube-nocookie.com", "player.vimeo.com", "api.languagetool.org"] }, plataformas: { cloudflare_zona: "(demonstração)", vercel_projeto: "prj_demo", github_repositorio: "jojoeumermo/perenidade", supabase_site_url: "https://exemplo.supabase.co", supabase_site_ref: "exemplo" }, retencao: { eventos_dias: 90, verificacoes_dias: 90, agregados_dias: 400 } }),
  configuracoes_salvar: (a) => a.p,
  regras_listar: () => ["site_fora", "site_lento", "pico_bloqueios", "pico_requisicoes", "logins_falhos", "pagina_mudou", "dns_mudou", "certificado_novo", "terceiro_novo", "dominio_parecido", "deploy_falhou", "deploy_desconhecido", "github_alerta", "supabase_fora", "cabecalho_sumiu", "csp_violacoes", "isca_pico", "reputacao_ruim", "assetlinks_mudou"].map((id, i) => ({ id, ligada: i !== 15, gravidade: ["critica", "media", "alta", "alta", "alta", "alta", "critica", "alta", "alta", "media", "media", "media", "media", "alta", "alta", "baixa", "media", "media", "alta"][i], parametros: {}, descricao: "" })),
  regra_salvar: (a) => ({ id: a.p_id, ligada: a.p_ligada }),
  relatorio: () => ({ periodo: { desde: iso(30 * 86400000), ate: iso(0), gerado_em: iso(0), por: "Jonathan Santos" }, disponibilidade: { total: 8640, no_ar: 8610, percentual: 99.653, ms_mediana: 214, ms_p95: 410 }, trafego: { requisicoes: 612340, bloqueios: 4210, desafios: 380 }, trafego_por_dia: Array.from({ length: 30 }, (_, i) => ({ dia: iso((29 - i) * 86400000), requisicoes: 18000 + Math.round(semente(i) * 6000), bloqueios: 100 + Math.round(semente(i + 1) * 120) })), eventos_por_fonte: { waf: 2800, isca: 1300, auth: 110 }, alertas, incidentes, acoes, ips_top: ips.map((i) => ({ ip: i.ip, pais: i.pais, asn_nome: i.asn_nome, total: i.total })), postura: Array.from({ length: 30 }, (_, i) => ({ em: iso((29 - i) * 86400000), nota: 78 + Math.round(semente(i) * 10) })), deploys: [], certificados_novos: [] }),
};

export function demo(fn: string, args: Record<string, unknown>): unknown {
  const r = respostas[fn];
  if (!r) return { ok: true };
  return JSON.parse(JSON.stringify(r(args)));
}
