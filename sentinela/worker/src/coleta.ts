// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
//
// As duas passadas do coletor: a rápida (a cada 5 minutos) e a lenta (a cada 6 horas). Cada parte falha sozinha:
// uma plataforma fora do ar não impede as outras de serem lidas, e o que falhou fica dito no resumo.
import { Banco } from "./banco.ts";
import { aplicarAcao, coletarCloudflare, desfazerAcao } from "./coletores/cloudflare.ts";
import { coletarCertificados, coletarDns, coletarDominios, reputacao } from "./coletores/integridade.ts";
import { coletarGitHub, coletarLoginsFalhos, coletarVercel, verificarSupabase } from "./coletores/plataformas.ts";
import { eventoDeMudanca, eventosDeCabecalho, verificarPagina } from "./coletores/site.ts";
import { enviarFila, registrarAlertas } from "./email.ts";
import { avaliar, postura, type Coletado } from "./regras.ts";
import type { Configuracao, Env, Evento, Verificacao } from "./tipos.ts";
import { impressao, limpo } from "./util.ts";

export interface Resumo {
  inicio: string;
  duracao_ms: number;
  partes: Record<string, string>;
  alertas: number;
  emails: number;
}

const vazio = (): Coletado => ({ verificacoes: [], metricas: [], eventos: [], dnsMudancas: [], certificadosNovos: [], terceirosNovos: [], dominiosNovos: [], deploysMudaram: [], githubNovos: [], cspNovas: 0 });

/** Tenta uma parte; o erro vira texto no resumo em vez de derrubar a passada. */
async function parte(resumo: Resumo, nome: string, tarefa: () => Promise<string>) {
  try {
    resumo.partes[nome] = await tarefa();
  } catch (erro) {
    resumo.partes[nome] = `falhou: ${limpo(erro instanceof Error ? erro.message : String(erro), 160)}`;
  }
}

export async function coletaRapida(env: Env, regiao = ""): Promise<Resumo> {
  const inicio = Date.now();
  const resumo: Resumo = { inicio: new Date(inicio).toISOString(), duracao_ms: 0, partes: {}, alertas: 0, emails: 0 };
  const banco = new Banco(env);
  if (!banco.pronto) {
    resumo.partes.banco = "falhou: SENTINELA_SUPABASE_URL ou SENTINELA_SERVICE_KEY não configurados";
    resumo.duracao_ms = Date.now() - inicio;
    return resumo;
  }
  const config = await banco.rpc<Configuracao>("coleta_configuracao");
  const site = config.configuracoes.site ?? {};
  const plat = config.configuracoes.plataformas ?? {};
  const base = (site.url ?? "https://institutolucia.org").replace(/\/$/, "");
  const c = vazio();
  const houveDeploy = Boolean(config.ultimo_deploy_em && Date.now() - new Date(config.ultimo_deploy_em).getTime() < 2 * 3600_000);

  // 1. Deploys primeiro: a regra "página mudou sem deploy" precisa saber se houve deploy agora há pouco.
  await parte(resumo, "vercel", async () => {
    const deploys = await coletarVercel(env.VERCEL_TOKEN ?? "", plat.vercel_projeto ?? "", plat.vercel_equipe ?? "");
    if (!deploys) return "sem token ou projeto";
    const r = await banco.rpc<{ mudaram: Coletado["deploysMudaram"] }>("coleta_deploys", { p: deploys });
    c.deploysMudaram = r.mudaram;
    return `${deploys.length} deploys lidos, ${r.mudaram.length} mudaram`;
  });
  const deployAgora = houveDeploy || c.deploysMudaram.some((d) => d.estado === "READY" && d.ambiente === "production");

  // 2. O site e as páginas vigiadas.
  await parte(resumo, "site", async () => {
    const hostDoSite = new URL(base).hostname;
    const paginas = ["/", ...(site.paginas ?? []).filter((p) => p !== "/")];
    const permitidos = (site.terceiros_permitidos ?? []).map((h) => h.toLowerCase());
    const terceirosNovos: Coletado["terceirosNovos"] = [];
    for (const caminho of paginas.slice(0, 12)) {
      const alvo = caminho === "/" ? "site" : `pagina:${caminho}`;
      const r = await verificarPagina(base, caminho, alvo, regiao);
      c.verificacoes.push(r.verificacao);
      await banco.rpc("coleta_verificacao", { p: r.verificacao });
      if (r.verificacao.no_ar) {
        const mudanca = await eventoDeMudanca(alvo, caminho, config.ultimo_hash[alvo], r.verificacao.hash, deployAgora);
        if (mudanca) c.eventos.push(mudanca);
        if (alvo === "site") c.eventos.push(...(await eventosDeCabecalho(config.ultimos_cabecalhos ?? undefined, r.verificacao.cabecalhos ?? {})));
        if (r.terceiros.length) {
          const novos = await banco.rpc<{ novos: Coletado["terceirosNovos"] }>("coleta_terceiros", { p: r.terceiros.map((t) => ({ ...t, permitido: permitidos.includes(t.host) })) });
          terceirosNovos.push(...novos.novos);
          for (const t of novos.novos.filter((t) => !permitidos.includes(t.host.toLowerCase()))) {
            c.eventos.push({ fonte: "terceiro", tipo: "novo", gravidade: "alta", caminho: t.pagina, detalhes: { host: t.host, tipo: t.tipo }, impressao: await impressao("terceiro", t.pagina, t.tipo, t.host) });
          }
        }
      }
      void hostDoSite;
    }
    c.terceirosNovos = terceirosNovos;
    const s = c.verificacoes.find((v) => v.alvo === "site");
    return s ? `${s.no_ar ? "no ar" : "FORA"} · ${s.status ?? "-"} · ${s.ms} ms · nota ${s.nota}` : "sem verificação";
  });

  // 3. O serviço de contas do site.
  await parte(resumo, "supabase", async () => {
    const vs = await verificarSupabase(plat.supabase_site_url ?? "", plat.supabase_site_anon ?? "");
    if (!vs.length) return "sem endereço configurado";
    for (const v of vs) {
      c.verificacoes.push(v);
      await banco.rpc("coleta_verificacao", { p: v });
    }
    return vs.map((v) => `${v.alvo.replace("supabase", "") || "auth"}: ${v.no_ar ? "ok" : "FORA"} ${v.ms} ms`).join(" · ");
  });

  // 4. Tráfego e eventos da Cloudflare.
  await parte(resumo, "cloudflare", async () => {
    const r = await coletarCloudflare(env.CLOUDFLARE_API_TOKEN ?? "", plat.cloudflare_zona ?? "");
    if (r.erro) return r.erro;
    if (r.metricas.length) await banco.rpc("coleta_metricas", { p: r.metricas });
    c.metricas = r.metricas;
    c.eventos.push(...r.eventos);
    return `${r.metricas.length} janelas, ${r.eventos.length} eventos`;
  });

  // 5. Entradas erradas no serviço de contas do site (opcional).
  await parte(resumo, "auth", async () => {
    const eventos = await coletarLoginsFalhos(env.SUPABASE_SITE_PAT ?? "", plat.supabase_site_ref ?? "");
    if (!eventos) return "sem token ou ref";
    c.eventos.push(...eventos);
    return `${eventos.length} tentativas recusadas`;
  });

  // 6. Grava os eventos de uma vez.
  await parte(resumo, "eventos", async () => {
    if (!c.eventos.length) return "nenhum";
    const r = await banco.rpc<{ novos: number }>("coleta_eventos", { p: c.eventos });
    return `${r.novos} novos de ${c.eventos.length}`;
  });

  // 7. Ações confirmadas pela equipe e bloqueios vencidos.
  await parte(resumo, "acoes", () => executarAcoes(env, banco, plat.cloudflare_zona ?? ""));

  // 8. Postura.
  await parte(resumo, "postura", async () => {
    const s = c.verificacoes.find((v) => v.alvo === "site" && v.no_ar);
    const sb = c.verificacoes.find((v) => v.alvo === "supabase");
    const p = postura({
      cabecalhos: s?.cabecalhos,
      dns: config.dns_atual,
      certificados: [],
      supabaseNoAr: sb ? sb.no_ar : null,
      githubAbertos: [],
      alertasCriticos: config.alertas_recentes.filter((a) => /site_fora|dns_mudou|supabase_fora/.test(a.regra)).length,
      ultimoDeployOk: c.deploysMudaram.length ? !/ERROR|CANCELED/.test(c.deploysMudaram[0].estado) : config.ultimo_deploy_em ? true : null,
      segundoFatorTodos: config.segundo_fator_todos,
    });
    await banco.rpc("coleta_postura", { p });
    return `nota ${p.nota}`;
  });

  // 9. Regras → alertas → e-mails.
  await parte(resumo, "alertas", async () => {
    const alertas = avaliar(config, c);
    const r = await registrarAlertas(env, banco, alertas);
    resumo.alertas = r.novos;
    resumo.emails += r.emails;
    return `${alertas.length} avaliados, ${r.novos} novos, ${r.emails} e-mails`;
  });

  // 10. A fila de e-mails (convites).
  await parte(resumo, "fila", async () => {
    const n = await enviarFila(env, banco);
    resumo.emails += n;
    return `${n} enviados`;
  });

  // 11. Avisa os apps abertos de que há dados novos (canal público "sentinela"; a mensagem só diz "coletei").
  await parte(resumo, "aviso", () => avisarApps(env, resumo.alertas));

  resumo.duracao_ms = Date.now() - inicio;
  return resumo;
}

async function avisarApps(env: Env, alertas: number): Promise<string> {
  const url = (env.SENTINELA_SUPABASE_URL ?? "").replace(/\/$/, "");
  const chave = env.SENTINELA_SERVICE_KEY ?? "";
  if (!url || !chave) return "sem banco";
  const resposta = await fetch(`${url}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ topic: "sentinela", event: "coleta", payload: { alertas } }] }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  return resposta?.ok ? "enviado" : `não enviado (${resposta?.status ?? "sem resposta"})`;
}

export async function coletaLenta(env: Env): Promise<Resumo> {
  const inicio = Date.now();
  const resumo: Resumo = { inicio: new Date(inicio).toISOString(), duracao_ms: 0, partes: {}, alertas: 0, emails: 0 };
  const banco = new Banco(env);
  if (!banco.pronto) {
    resumo.partes.banco = "falhou: banco não configurado";
    return resumo;
  }
  const config = await banco.rpc<Configuracao>("coleta_configuracao");
  const site = config.configuracoes.site ?? {};
  const plat = config.configuracoes.plataformas ?? {};
  const dominio = site.dominio ?? "institutolucia.org";
  const c = vazio();
  const eventos: Evento[] = [];

  await parte(resumo, "dns", async () => {
    const registros = await coletarDns(dominio);
    if (!registros.length) return "a resolução não respondeu";
    const r = await banco.rpc<{ mudancas: Coletado["dnsMudancas"] }>("coleta_dns", { p: registros });
    c.dnsMudancas = r.mudancas;
    for (const m of r.mudancas) eventos.push({ fonte: "dns", tipo: "mudou", gravidade: "critica", detalhes: m, impressao: await impressao("dns", m.nome, m.tipo, m.para.join(",")) });
    return `${registros.length} registros, ${r.mudancas.length} mudanças`;
  });

  await parte(resumo, "certificados", async () => {
    const conhecidos = (config.regras.find((r) => r.id === "certificado_novo")?.parametros?.emissores_conhecidos as string[] | undefined) ?? ["Let's Encrypt", "Google Trust Services", "Cloudflare", "Sectigo", "DigiCert"];
    const certs = await coletarCertificados(dominio, conhecidos);
    if (!certs) return "o crt.sh não respondeu";
    const r = await banco.rpc<{ novos: Coletado["certificadosNovos"] }>("coleta_certificados", { p: certs });
    c.certificadosNovos = r.novos;
    for (const cert of r.novos.filter((x) => !x.conhecido)) eventos.push({ fonte: "certificado", tipo: "emissor_desconhecido", gravidade: "alta", detalhes: { crt_id: cert.crt_id, emissor: cert.emissor, nomes: cert.nomes }, impressao: `cert:${cert.crt_id}` });
    return `${certs.length} vistos, ${r.novos.length} novos`;
  });

  await parte(resumo, "dominios", async () => {
    const lista = await coletarDominios(dominio);
    if (!lista.length) return "nada conferido";
    const r = await banco.rpc<{ passaram_a_resolver: Coletado["dominiosNovos"] }>("coleta_dominios", { p: lista });
    c.dominiosNovos = r.passaram_a_resolver;
    for (const d of r.passaram_a_resolver) eventos.push({ fonte: "dominio", tipo: "passou_a_resolver", gravidade: "media", detalhes: d.registros, impressao: `dominio:${d.dominio}:${(d.registros.A ?? []).join(",")}` });
    return `${lista.length} conferidos, ${lista.filter((d) => d.resolve).length} resolvem, ${r.passaram_a_resolver.length} novos`;
  });

  await parte(resumo, "github", async () => {
    const lista = await coletarGitHub(env.GITHUB_TOKEN ?? "", plat.github_repositorio ?? "");
    if (!lista) return "sem token ou repositório";
    const r = await banco.rpc<{ novos: Coletado["githubNovos"] }>("coleta_github", { p: lista });
    c.githubNovos = r.novos;
    for (const g of r.novos) eventos.push({ fonte: "github", tipo: g.tipo, gravidade: g.tipo === "segredo" ? "critica" : /high|critical/.test(g.gravidade) ? "alta" : "media", detalhes: { id: g.id, titulo: g.titulo, url: g.url }, impressao: `github:${g.id}` });
    return `${lista.length} abertos, ${r.novos.length} novos`;
  });

  await parte(resumo, "reputacao", async () => {
    if (!env.ABUSEIPDB_KEY) return "sem chave (opcional)";
    // Só origens que o WAF já bloqueou repetidas vezes nas últimas horas e ainda não foram consultadas nesta semana.
    const alvos = config.ips_insistentes.slice(0, 10);
    for (const alvo of alvos) {
      const r = await reputacao(env.ABUSEIPDB_KEY, alvo.ip);
      if (r) eventos.push({ fonte: "reputacao", tipo: "consulta", gravidade: r.abuso >= 80 ? "media" : "info", ip: alvo.ip, detalhes: r, impressao: await impressao("rep", alvo.ip, new Date().toISOString().slice(0, 10)) });
    }
    return `${alvos.length} origens consultadas`;
  });

  await parte(resumo, "eventos", async () => {
    if (!eventos.length) return "nenhum";
    c.eventos = eventos;
    const r = await banco.rpc<{ novos: number }>("coleta_eventos", { p: eventos });
    return `${r.novos} novos`;
  });

  await parte(resumo, "alertas", async () => {
    const alertas = avaliar(config, c);
    const r = await registrarAlertas(env, banco, alertas);
    resumo.alertas = r.novos;
    resumo.emails = r.emails;
    return `${alertas.length} avaliados, ${r.novos} novos, ${r.emails} e-mails`;
  });

  await parte(resumo, "limpeza", async () => {
    await banco.rpc("coleta_limpeza");
    return "feita";
  });

  resumo.duracao_ms = Date.now() - inicio;
  return resumo;
}

/** Executa na Cloudflare o que a equipe confirmou e desfaz o que venceu. */
export async function executarAcoes(env: Env, banco: Banco, zona: string): Promise<string> {
  const token = env.CLOUDFLARE_API_TOKEN ?? "";
  const pendentes = await banco.rpc<{ executar: { id: string; tipo: string; alvo: string; motivo: string }[]; desfazer: { id: string; referencia: string }[] }>("acoes_pendentes");
  let feitas = 0;
  for (const a of pendentes.executar) {
    if (a.tipo === "desbloquear") {
      const original = await banco.rpc<{ referencia?: string } | null>("coleta_acao_referencia", { p_id: a.alvo }).catch(() => null);
      const referencia = original?.referencia ?? "";
      const r = await desfazerAcao(token, zona, referencia);
      await banco.rpc("acao_resultado", { p_id: a.id, p_estado: r.ok ? "executada" : "falhou", p_resultado: r, p_referencia: referencia });
      if (r.ok) await banco.rpc("acao_resultado", { p_id: a.alvo, p_estado: "desfeita", p_resultado: { por: a.id } });
    } else {
      const r = await aplicarAcao(token, zona, a.tipo, a.alvo, a.motivo);
      await banco.rpc("acao_resultado", { p_id: a.id, p_estado: r.ok ? "executada" : "falhou", p_resultado: { ok: r.ok, erro: r.erro ?? "" }, p_referencia: r.referencia ?? "" });
    }
    feitas++;
  }
  for (const a of pendentes.desfazer) {
    const r = await desfazerAcao(token, zona, a.referencia);
    await banco.rpc("acao_resultado", { p_id: a.id, p_estado: r.ok ? "desfeita" : "executada", p_resultado: r.ok ? { desfeita: "prazo vencido" } : { aviso: `não deu para desfazer: ${r.erro}` } });
    feitas++;
  }
  return `${pendentes.executar.length} executadas, ${pendentes.desfazer.length} desfeitas`;
}

export { vazio as coletadoVazio };
export type { Verificacao };
