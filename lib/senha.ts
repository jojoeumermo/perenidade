// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

/**
 * A senha já apareceu em algum vazamento conhecido? (Have I Been Pwned, Pwned Passwords.)
 * O SHA-1 é calculado aqui no aparelho; só os cinco primeiros caracteres dele vão para o nosso servidor
 * (/api/senha-vazada), que devolve a lista de finais com esse começo. A comparação acontece aqui.
 * Devolve null quando não deu para conferir (sem conexão, serviço fora): aí quem decide é a pessoa.
 */
export async function senhaVazada(senha: string): Promise<boolean | null> {
  try {
    const bytes = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(senha)));
    const resumo = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
    const resposta = await fetch(`/api/senha-vazada?prefixo=${resumo.slice(0, 5)}`, { signal: AbortSignal.timeout(8000) });
    if (!resposta.ok) return null;
    const lista = await resposta.text();
    const final = resumo.slice(5);
    // Linhas "FINAL:QUANTIDADE". As de enchimento vêm com quantidade zero e não contam.
    return lista.split("\n").some((linha) => {
      const [sufixo, vezes] = linha.trim().split(":");
      return sufixo === final && Number(vezes) > 0;
    });
  } catch {
    return null;
  }
}
