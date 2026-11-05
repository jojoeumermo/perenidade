// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Recursos ligados sem publicar de novo (Etapa 8, back-end 1). A coordenação liga e desliga pelo painel (Site › Controles
// avançados); a decisão fica numa tabela do banco e o site a lê em tempo de execução, com cache curto (60 s), somando-se
// ao NEXT_PUBLIC_RECURSOS (lib/recursos.ts). Regras:
//   - desligado no banco desliga sempre (é o interruptor de emergência);
//   - ligado no banco liga, inclusive os de SO_PELO_NOME, mas o banco só grava esses depois da confirmação de uma segunda pessoa;
//   - banco fora do ar ou sem configuração: vale só a variável de montagem, como sempre valeu.
// Limite honesto: página já gerada na montagem (estática) só muda quando for gerada de novo; a decisão do banco vale para
// o que é lido em tempo de execução (rotas dinâmicas, componentes do navegador e este módulo).
//
// Sem os atalhos "@/" de propósito: `npm run testar:backend-1` roda este arquivo direto no Node.
import { definirVivos, ligado, RECURSOS, type Recurso, type Vivos } from "./recursos";

/** Quanto tempo o servidor guarda a resposta do banco. */
export const SEGUNDOS_DE_CACHE = 60;

const nomes = new Set<string>(Object.keys(RECURSOS));

/** Lê a resposta de public.recursos_lidos(), ignorando o que não é um recurso conhecido (nunca confia no formato). */
export function lerVivos(bruto: unknown): Vivos {
  const objeto = (bruto && typeof bruto === "object" ? bruto : {}) as { ligados?: unknown; desligados?: unknown };
  const filtrar = (v: unknown) => new Set((Array.isArray(v) ? v : []).filter((n): n is string => typeof n === "string" && nomes.has(n)));
  const desligados = filtrar(objeto.desligados);
  // Um nome nos dois lados vale como desligado.
  const ligados = new Set([...filtrar(objeto.ligados)].filter((n) => !desligados.has(n)));
  return { ligados, desligados };
}

let guardado: { em: number; vivos: Vivos } | null = null;

/** Busca no banco (servidor) e guarda para ligado(). Com o fetch de verdade, reaproveita a resposta por 60 s (uma ida ao banco por minuto, não por visita). */
export async function carregarVivos(buscar: typeof fetch = fetch): Promise<Vivos> {
  const real = buscar === fetch;
  if (real && guardado && Date.now() - guardado.em < SEGUNDOS_DE_CACHE * 1000) return guardado.vivos;
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !chave) return { ligados: new Set(), desligados: new Set() };
  try {
    const resposta = await buscar(`${url}/rest/v1/rpc/recursos_lidos`, {
      method: "POST",
      headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: "{}",
      next: { revalidate: SEGUNDOS_DE_CACHE },
      signal: AbortSignal.timeout(4000),
    } as RequestInit);
    if (!resposta.ok) throw new Error(String(resposta.status));
    const vivos = lerVivos(await resposta.json());
    definirVivos(vivos);
    if (real) guardado = { em: Date.now(), vivos };
    return vivos;
  } catch {
    return { ligados: new Set(), desligados: new Set() };
  }
}

/** Para rotas e páginas dinâmicas: o recurso está ligado agora (variável de montagem + decisão do painel)? */
export async function recursoLigado(recurso: Recurso): Promise<boolean> {
  await carregarVivos();
  return ligado(recurso);
}
