// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A conferência dos links do lado de quem LÊ (onda 11, 11F). A conferência do compositor só pega quem publica pela tela; quem
// publica chamando o banco direto pula a tela. Por isso o link de fora de um post (o do texto formatado e o da prévia do link) é
// conferido também no cartão de quem lê: os links que aparecem juntos vão num pedido só (até 10 por vez) à mesma rota
// /api/rede/links, e a resposta fica na memória desta página (um link conferido não é perguntado de novo). Link marcado como
// perigoso sai como texto, sem clique. Nada é guardado no aparelho nem no servidor.
import { conferenciaLigada, conferirNoServidor } from "./cliente";

/** Os tipos de perigo de cada link já conferido nesta página ([] = limpo; nulo = não deu para conferir). */
const respostas = new Map<string, Promise<string[] | null>>();
let fila: { link: string; pronto: (tipos: string[] | null) => void }[] = [];
let relogio: ReturnType<typeof setTimeout> | null = null;

async function esvaziar() {
  relogio = null;
  const lote = fila;
  fila = [];
  if (!(await conferenciaLigada())) {
    for (const p of lote) p.pronto(null);
    return;
  }
  for (let i = 0; i < lote.length; i += 10) {
    const parte = lote.slice(i, i + 10);
    const r = await conferirNoServidor(parte.map((p) => p.link));
    for (const p of parte) {
      if (!r?.conferido) p.pronto(null);
      else p.pronto(r.perigosos.find((x) => x.link === p.link)?.tipos ?? []);
    }
  }
}

/** Os tipos de perigo de um link de fora ([] = limpo; nulo = não deu para conferir, e o link segue como link). */
export function conferirParaLer(link: string): Promise<string[] | null> {
  if (!/^https?:\/\//i.test(link)) return Promise.resolve([]);
  let r = respostas.get(link);
  if (!r) {
    r = new Promise((pronto) => {
      fila.push({ link, pronto });
      relogio ??= setTimeout(() => void esvaziar(), 60);
    });
    respostas.set(link, r);
    if (respostas.size > 2000) respostas.delete(respostas.keys().next().value as string);
  }
  return r;
}
