// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Partes puras da operação do site (Etapa 8, pacote backend-2): traduzem, em frases curtas, o que a Vercel, o GitHub e o
// banco respondem. Sem importar nada (o teste carrega este arquivo direto) e sem tocar em token: quem chama as APIs é a rota
// app/api/painel/operacao. Doc: docs/backend-2.md.

export type NivelDoToken = "indefinido" | "ok" | "aviso" | "urgente" | "vencido";

/** Dias entre hoje e o vencimento (datas AAAA-MM-DD, contadas em dias inteiros, sem fuso). Negativo: já venceu. */
export function diasAteVencer(expira: string, hoje: string): number | null {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expira);
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(hoje);
  if (!a || !b) return null;
  const dia = (m: RegExpExecArray) => Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.round((dia(a) - dia(b)) / 86_400_000);
}

/** As mesmas faixas do banco (interno.instagram_token_estado): mais de 14 dias é ok; 14 ou menos, aviso; 3 ou menos, urgente. */
export function nivelDoToken(dias: number | null): NivelDoToken {
  if (dias === null) return "indefinido";
  if (dias < 0) return "vencido";
  if (dias <= 3) return "urgente";
  if (dias <= 14) return "aviso";
  return "ok";
}

export function fraseDoToken(dias: number | null): string {
  const nivel = nivelDoToken(dias);
  if (nivel === "indefinido" || dias === null) return "A data de vencimento ainda não foi anotada.";
  if (nivel === "vencido") return "O token venceu: as publicações agendadas no Instagram vão falhar até trocar.";
  if (dias === 0) return "O token vence hoje.";
  if (dias === 1) return "O token vence amanhã.";
  return `O token vence em ${dias} dias.`;
}

export interface ResumoDaPublicacao {
  estado: "pronta" | "em_andamento" | "falhou" | "cancelada" | "desconhecida";
  frase: string;
  haMinutos: number | null;
  endereco: string;
}

/** O estado da última publicação de produção, a partir de um item de GET /v7/deployments (campos readyState, created, errorMessage). */
export function resumirPublicacao(item: unknown, agora: number): ResumoDaPublicacao {
  const d = (item ?? {}) as { readyState?: string; state?: string; created?: number; errorMessage?: string | null; url?: string | null };
  const estado = String(d.readyState ?? d.state ?? "");
  const haMinutos = typeof d.created === "number" ? Math.max(0, Math.round((agora - d.created) / 60_000)) : null;
  const endereco = typeof d.url === "string" && /^[a-z0-9.-]+$/i.test(d.url) ? `https://${d.url}` : "";
  const quando = haMinutos === null ? "" : ` (há ${haMinutos < 90 ? `${haMinutos} min` : `${Math.round(haMinutos / 60)} h`})`;
  if (estado === "READY") return { estado: "pronta", frase: `A última publicação está no ar${quando}.`, haMinutos, endereco };
  if (["BUILDING", "INITIALIZING", "QUEUED"].includes(estado)) return { estado: "em_andamento", frase: `Uma publicação está em andamento${quando}.`, haMinutos, endereco };
  if (estado === "ERROR" || estado === "BLOCKED") return { estado: "falhou", frase: `A última publicação falhou${quando}. O site no ar é a versão anterior.`, haMinutos, endereco };
  if (estado === "CANCELED") return { estado: "cancelada", frase: `A última publicação foi cancelada${quando}.`, haMinutos, endereco };
  return { estado: "desconhecida", frase: "Não deu para saber o estado da última publicação.", haMinutos, endereco: "" };
}

export interface ResumoDoBackup {
  estado: "ok" | "falhou" | "em_andamento" | "pulado" | "nenhum" | "desconhecido";
  frase: string;
  haDias: number | null;
}

/**
 * A última rodada da rotina backup.yml, a partir de um item de GET /repos/{repo}/actions/workflows/backup.yml/runs
 * (status, conclusion, created_at). "Pulado" é normal enquanto o repositório for público: a rotina só roda com ele privado.
 */
export function resumirBackup(item: unknown, agora: number): ResumoDoBackup {
  if (!item) return { estado: "nenhum", frase: "Nenhuma rodada da cópia do banco foi encontrada.", haDias: null };
  const r = item as { status?: string; conclusion?: string | null; created_at?: string };
  const criado = r.created_at ? Date.parse(r.created_at) : NaN;
  const haDias = Number.isFinite(criado) ? Math.max(0, Math.floor((agora - criado) / 86_400_000)) : null;
  const quando = haDias === null ? "" : haDias === 0 ? " (hoje)" : ` (há ${haDias} dia${haDias === 1 ? "" : "s"})`;
  if (r.status && r.status !== "completed") return { estado: "em_andamento", frase: `A cópia do banco está rodando${quando}.`, haDias };
  if (r.conclusion === "success") return { estado: "ok", frase: `A última cópia do banco deu certo${quando}.`, haDias };
  if (r.conclusion === "skipped") return { estado: "pulado", frase: `A última rodada foi pulada${quando}: a cópia só roda com o repositório privado e com os segredos criados.`, haDias };
  if (r.conclusion) return { estado: "falhou", frase: `A última cópia do banco falhou${quando}. Abra o GitHub, em Actions, para ver o motivo.`, haDias };
  return { estado: "desconhecido", frase: "Não deu para saber o resultado da última cópia.", haDias };
}

/** A cópia é semanal (domingo): com mais de 9 dias sem sucesso, vale avisar. */
export function backupAtrasado(r: ResumoDoBackup): boolean {
  return r.estado === "falhou" || (r.haDias !== null && r.haDias > 9 && r.estado !== "em_andamento");
}

/** Taxa de acertos de uma aula, em texto, escondendo o que tem poucos testes (o banco já esconde; isto evita mostrar "NaN"). */
export function fraseDaAula(a: { poucos?: boolean; testes?: number; pct?: number; dificil?: boolean; recente_pct?: number | null; anterior_pct?: number | null }): string {
  if (a.poucos || typeof a.testes !== "number" || typeof a.pct !== "number") return "Poucos testes ainda (menos de 5): sem números, para não apontar ninguém.";
  const base = `${a.testes} testes, ${a.pct}% com 70% ou mais`;
  const tendencia =
    typeof a.recente_pct === "number" && typeof a.anterior_pct === "number"
      ? a.recente_pct > a.anterior_pct + 5 ? "; melhorando nos últimos 30 dias" : a.recente_pct < a.anterior_pct - 5 ? "; piorando nos últimos 30 dias" : "; estável nos últimos 30 dias"
      : "";
  return `${base}${tendencia}${a.dificil ? " (difícil: vale uma segunda explicação)" : ""}.`;
}
