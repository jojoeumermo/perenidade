// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { NextResponse } from "next/server";
import { validarEntrada } from "@/supabase/functions/assistente/assistente.ts";
import { FalhaDoProvedor, modeloDe, perguntar, PROVEDORES } from "@/supabase/functions/assistente/provedores.ts";
import { criarLimitador, criarRodizio, ipDoPedido, limitesDaConfig } from "@/lib/assistente/limite";
import { recursoLigado } from "@/lib/recursos-vivos";

/**
 * O assistente aberto a todo o site, sem conta (pedido da coordenação, novembro de 2026). Roda no servidor do site (a VPS,
 * docs/HOSPEDAGEM.md), nunca no navegador, e usa SÓ provedores com plano gratuito, em rodízio: Groq, Gemini, Cerebras e
 * OpenRouter (modelos ":free"), com as mesmas chaves do robô do Vale o Escrito (docs/vale-o-escrito/ROBO.md). O Claude
 * (pago) fica só na função da conta (supabase/functions/assistente), que segue igual.
 *
 * A conferência do pedido, o texto do sistema e a leitura da resposta são os MESMOS da função da conta (importados de
 * supabase/functions/assistente): o que se aceita, o que se manda e o que se devolve não muda de um caminho para o outro.
 *
 * O que vai para a IA: só a pergunta (e o que a própria pessoa colou nela: trecho da aula, foto do exercício), o idioma e
 * a disciplina escolhidos e títulos de aulas do site. Nada da pessoa: nem IP, nem conta, nem página, nem cookie. O pedido
 * sai daqui, não do aparelho de quem pergunta.
 *
 * Limite (lib/assistente/limite.ts): por pessoa, 40 por hora e 150 por dia; do site, 1.200 por dia (mudam nas variáveis
 * ASSISTENTE_POR_HORA, ASSISTENTE_POR_DIA e ASSISTENTE_LIMITE_GLOBAL). "Pessoa" é um resumo do IP com sal do dia, só na
 * memória: o IP nunca é guardado nem registrado (LGPD, art. 6º, III, e art. 12). Falha de todos os provedores devolve a vez.
 * A memória é de cada contêiner (na troca de versão, os dois que se revezam contam separado por alguns segundos): é um
 * freio, não uma cerca. O teto que manda de verdade é a cota de cada provedor.
 *
 * Desligar sem publicar de novo: pelo painel (Site › Controles avançados › Recursos › assistente-publico, vale em 1 minuto)
 * ou ASSISTENTE_PUBLICO=0 em /opt/lucia/site.env (e reiniciar o contêiner). Publicar de novo
 * com NEXT_PUBLIC_RECURSOS="-assistente-publico" tira também o botão das páginas.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Uma foto reduzida no navegador cabe com folga; acima disso, nem se lê o pedido (o mesmo teto da função da conta). */
const TAMANHO_MAXIMO = 3_000_000;
/** O Claude é pago: fica de fora daqui. */
const GRATUITOS = PROVEDORES.filter((p) => p.id !== "anthropic");
/** Modelos que mudaram desde provedores.ts (o robô do Vale já usa este na Cerebras). A variável de cada um manda. */
const MODELO_ATUAL: Record<string, string> = { cerebras: "gpt-oss-120b" };

const limitador = criarLimitador(limitesDaConfig(process.env));
const rodizio = criarRodizio();

const SEM_GUARDAR = { "Cache-Control": "no-store" };
const responder = (corpo: unknown, status = 200, extra: Record<string, string> = {}) => NextResponse.json(corpo, { status, headers: { ...SEM_GUARDAR, ...extra } });

/** A configuração de agora. A chave liga/desliga do painel (interno.recursos_vivos) vale em até 1 minuto, sem publicar. */
async function configuracao() {
  const env = process.env;
  const doPainel = await recursoLigado("assistente-publico").catch(() => true);
  const chaves = Object.fromEntries(GRATUITOS.map((p) => [p.id, (env[p.segredo] ?? "").trim()]));
  // Aceita o nome da função da conta (GROQ_MODELO) e o do robô do Vale (GROQ_MODEL).
  const modelos = Object.fromEntries(GRATUITOS.map((p) => [p.id, modeloDe(p, env[p.segredoModelo] ?? env[p.segredoModelo.replace(/MODELO$/, "MODEL")] ?? MODELO_ATUAL[p.id])]));
  const pedida = (env.ASSISTENTE_ORDEM ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const base = pedida.length ? pedida.filter((id) => GRATUITOS.some((p) => p.id === id)) : ["groq", "gemini", "cerebras", "openrouter"];
  const comChave = base.filter((id) => chaves[id]);
  const desligado = /^(0|false|nao|não|desligado)$/i.test((env.ASSISTENTE_PUBLICO ?? "").trim()) || !doPainel;
  return { chaves, modelos, comChave, ativo: !desligado && comChave.length > 0, visao: comChave.some((id) => GRATUITOS.find((p) => p.id === id)?.visao) };
}

/** Endereços de onde o site roda (o mesmo critério de app/api/gramatica). */
function doProprioSite(request: Request): boolean {
  const origem = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  if (!origem) return true;
  const lista = new Set(["https://institutolucia.org", "https://www.institutolucia.org", "https://alumia.institutolucia.org"]);
  for (const endereco of [process.env.NEXT_PUBLIC_SITE_URL, request.url]) {
    try {
      if (endereco) lista.add(new URL(endereco).origin);
    } catch {
      // endereço mal escrito: ficam os outros
    }
  }
  if (lista.has(origem)) return true;
  return process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origem);
}

/** O estado público: ligado ou não, se aceita foto, e os limites. Igual para todo mundo, sem nada de quem pergunta. */
export async function GET() {
  const c = await configuracao();
  const limites = limitesDaConfig(process.env);
  return NextResponse.json({ ligado: c.ativo, visao: c.ativo && c.visao, porHora: limites.porHora, porDia: limites.porDia }, { headers: { "Cache-Control": "public, max-age=60" } });
}

export async function POST(request: Request) {
  if (!doProprioSite(request)) return responder({ erro: "sem_permissao" }, 403);
  const c = await configuracao();
  if (!c.ativo) return responder({ erro: "assistente_desligado" }, 503);
  if (Number(request.headers.get("content-length") ?? 0) > TAMANHO_MAXIMO) return responder({ erro: "imagem" }, 413);

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return responder({ erro: "pedido" }, 400);
  }
  // Só os campos conhecidos passam (validarEntrada monta um objeto novo): nada além da pergunta e do que ela precisa.
  const conferido = validarEntrada(corpo);
  if ("erro" in conferido) return responder({ erro: conferido.erro }, 400);
  // Foto só com um provedor que enxerga (hoje, o Gemini). Sem ele, nem gasta a vez da pessoa.
  if (conferido.entrada.imagem && !c.visao) return responder({ erro: "assistente_sem_foto" }, 503);

  // O IP vira resumo aqui e some: a variável não sai desta função.
  const vez = limitador.consumir(ipDoPedido(request.headers));
  if (!vez.ok) {
    const erro = vez.motivo === "hora" ? "assistente_limite_hora" : vez.motivo === "dia" ? "assistente_limite" : "assistente_lotado";
    return responder({ erro, tentarEm: vez.tentarEm }, 429, { "Retry-After": String(vez.tentarEm) });
  }

  const r = await perguntar({
    ordem: rodizio.ordem(c.comChave),
    chaves: c.chaves,
    modelos: c.modelos,
    entrada: conferido.entrada,
    buscar: (url, opcoes) => fetch(url, opcoes),
    claude: async () => {
      throw new FalhaDoProvedor("sem_chave");
    },
    prazo: 45_000,
  });
  for (const t of r.tentativas) rodizio.falhou(t.id, t.falha);
  if ("erro" in r.lido) {
    limitador.devolver(vez.chave);
    // Só códigos curtos no registro: nem pergunta, nem IP, nem resumo.
    console.error(`assistente aberto: nenhum provedor respondeu (${r.tentativas.map((t) => `${t.id}:${t.falha}`).join(", ")})`);
    return responder({ erro: r.lido.erro === "imagem" || r.tentativas.every((t) => t.falha === "sem_visao") ? "assistente_sem_foto" : "assistente_falhou" }, 502);
  }
  if ("recusa" in r.lido) return responder({ recusa: true, restantes: vez.restantesDia, restantesHora: vez.restantesHora });
  const nome = PROVEDORES.find((p) => p.id === r.provedor)?.nome ?? r.provedor;
  return responder({ ...r.lido, restantes: vez.restantesDia, restantesHora: vez.restantesHora, provedor: nome });
}
