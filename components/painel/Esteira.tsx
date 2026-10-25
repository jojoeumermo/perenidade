// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Duas ideias do painel para quem escreve e quem revisa: a esteira (em que pé está cada envio, de um olhar) e a revisão
// lado a lado (o que mudou entre a versão guardada e a edição, linha por linha).

const ETAPAS = ["Enviado", "Triagem", "Revisão", "Aprovado", "No ar"] as const;

/** A esteira de um envio: as etapas já passadas, a atual e, se foi recusado, onde parou. */
export function Esteira({ status, triagem, pareceres, publico }: { status: string; triagem?: string; pareceres: number; publico: boolean }) {
  const etapas = ETAPAS.filter((e) => e !== "Triagem" || publico);
  const atual =
    status === "publicada" || status === "resolvida" ? etapas.length - 1
    : status === "aprovada" ? etapas.indexOf("Aprovado")
    : status === "pendente" && triagem === "aguardando" ? etapas.indexOf("Triagem")
    : etapas.indexOf("Revisão");
  const recusada = status === "recusada";
  return (
    <ol aria-label="Em que pé está" className="mt-2 flex flex-wrap items-center gap-y-1 text-[0.72rem] font-semibold">
      {etapas.map((etapa, i) => {
        const feita = i < atual || (i === atual && (status === "publicada" || status === "resolvida"));
        const aqui = i === atual && !feita;
        return (
          <li key={etapa} className="flex items-center">
            <span
              aria-current={aqui ? "step" : undefined}
              className={`border px-1.5 py-0.5 ${recusada && i === atual ? "border-oxblood bg-oxblood/10 text-oxblood" : feita ? "border-ink bg-ink text-parchment" : aqui ? "border-[#c21f16] bg-[#c21f16] text-white" : "border-rule text-ink-soft"}`}
            >
              {recusada && i === atual ? "✕ Não aprovado" : etapa}
              {etapa === "Revisão" && pareceres > 0 && ` · ${pareceres}`}
            </span>
            {i < etapas.length - 1 && <span aria-hidden className={`mx-1 h-px w-3 ${i < atual ? "bg-ink" : "bg-rule"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

type Trecho = { tipo: "igual" | "saiu" | "entrou"; linha: string };

/** Diferença por linhas (maior subsequência comum). Textos enormes caem para uma comparação simples, sem travar. */
export function diferenca(antes: string, depois: string): Trecho[] {
  const a = antes.split("\n");
  const b = depois.split("\n");
  if (a.length * b.length > 4_000_000) return [...a.map((linha) => ({ tipo: "saiu" as const, linha })), ...b.map((linha) => ({ tipo: "entrou" as const, linha }))];
  const m = a.length;
  const n = b.length;
  const lcs = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const saida: Trecho[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      saida.push({ tipo: "igual", linha: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) saida.push({ tipo: "saiu", linha: a[i++] });
    else saida.push({ tipo: "entrou", linha: b[j++] });
  }
  while (i < m) saida.push({ tipo: "saiu", linha: a[i++] });
  while (j < n) saida.push({ tipo: "entrou", linha: b[j++] });
  return saida;
}

/** As duas versões lado a lado: à esquerda a guardada (o que saiu, em vermelho), à direita a edição (o que entrou, em verde). */
export function LadoALado({ antes, depois }: { antes: string; depois: string }) {
  const trechos = diferenca(antes, depois);
  const mudancas = trechos.filter((t) => t.tipo !== "igual").length;
  // Linhas iguais longe de qualquer mudança ficam escondidas (como num "diff"): mostra três de cada lado.
  const perto = new Set<number>();
  trechos.forEach((t, i) => {
    if (t.tipo !== "igual") for (let k = i - 3; k <= i + 3; k++) perto.add(k);
  });
  const esquerda = trechos.map((t, i) => (t.tipo === "entrou" ? null : { ...t, i })).filter((t) => t !== null);
  const direita = trechos.map((t, i) => (t.tipo === "saiu" ? null : { ...t, i })).filter((t) => t !== null);
  const coluna = (lista: typeof esquerda, titulo: string) => (
    <div className="min-w-0">
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-ink-soft">{titulo}</p>
      <pre className="mt-1 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words border border-rule bg-parchment p-2 font-mono text-[0.78rem] leading-relaxed">
        {lista.map((t, k) =>
          t.tipo === "igual" && !perto.has(t.i) ? (
            lista[k - 1] && lista[k - 1]!.tipo === "igual" && !perto.has(lista[k - 1]!.i) ? null : <span key={t.i} className="block text-ink-soft">…</span>
          ) : (
            <span key={t.i} className={`block ${t.tipo === "saiu" ? "bg-oxblood/15 text-oxblood line-through decoration-oxblood/40" : t.tipo === "entrou" ? "bg-ok/20" : ""}`}>
              {t.linha || " "}
            </span>
          ),
        )}
      </pre>
    </div>
  );
  return (
    <div className="border-2 border-ink bg-folha p-3">
      <p className="text-sm font-semibold">{mudancas === 0 ? "Nenhuma mudança no texto ainda." : `${mudancas} ${mudancas === 1 ? "linha mudou" : "linhas mudaram"}.`}</p>
      {mudancas > 0 && <div className="mt-2 grid gap-3 lg:grid-cols-2">{coluna(esquerda, "Versão guardada")}{coluna(direita, "Sua edição")}</div>}
    </div>
  );
}
