// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaFormacao } from "@/i18n/escola/formacao";
import { preencher } from "@/lib/escola/textos";
import { useCompleted } from "@/lib/progress";
import { speechSupported, startReading, stopReading, useSpeaking } from "@/lib/speech";
import { useDiscreto } from "./discreto";
import { aulaDeAgora } from "./LadoAeB";
import type { AulaDoCaderno } from "./vista";

const ALVO = "eff-caderno-inteiro";

/** Tira a marcação do Markdown que atrapalha a leitura em voz alta e o arquivo (cercas, #, **, links). */
export function textoLimpo(md: string): string[] {
  return md
    .replace(/^```.*$/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`]/g, "")
    .replace(/^\s*[-|]+\s*$/gm, "")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Os botões do caderno (pranchas Caderno e Cel-Caderno): "Continuar" na aula de agora (a primeira pronta ainda não feita
 * neste aparelho), ouvir as aulas do caderno inteiro, baixar num arquivo só para ler sem internet e imprimir. O texto
 * vem do endereço público de cada aula em texto puro (/trilhas/.../texto, o mesmo de /trilhas): nada da pessoa sai do
 * aparelho, e a leitura em voz alta roda no próprio aparelho (lib/speech.ts).
 */
export function AcoesDoCaderno({ lang, nome, numero, prontas, t }: { lang: Locale; nome: string; numero: number; prontas: AulaDoCaderno[]; t: TextosDaFormacao["caderno"] }) {
  const feitas = useCompleted();
  const discreto = useDiscreto();
  const falando = useSpeaking();
  const agora = aulaDeAgora(prontas, feitas) ?? prontas[0] ?? null;
  const tudoFeito = prontas.length > 0 && prontas.every((a) => feitas.has(a.id));
  const [aulas, setAulas] = useState<{ titulo: string; partes: string[] }[] | null>(null);
  const [estado, setEstado] = useState<"" | "carregando" | "falhou" | "baixado" | "sem-voz">("");
  const depois = useRef<null | (() => void)>(null);

  // Depois que o texto entrou na página, faz o que foi pedido (ouvir, imprimir).
  useEffect(() => {
    if (!aulas || !depois.current) return;
    const fazer = depois.current;
    depois.current = null;
    fazer();
  }, [aulas]);

  async function juntar(): Promise<{ titulo: string; partes: string[] }[] | null> {
    if (aulas) return aulas;
    setEstado("carregando");
    try {
      const lidas = await Promise.all(
        prontas.map(async (a) => {
          const r = await fetch(localePath(lang, `/trilhas/${a.id}/texto`));
          if (!r.ok) throw new Error(String(r.status));
          const [, , , ...resto] = (await r.text()).split("\n");
          return { titulo: `${a.codigo ?? ""} · ${a.titulo}`, partes: textoLimpo(resto.join("\n")) };
        }),
      );
      setEstado("");
      return lidas;
    } catch {
      setEstado("falhou");
      return null;
    }
  }

  async function ouvir() {
    if (falando) return stopReading();
    if (!speechSupported()) return setEstado("sem-voz");
    if (aulas) return startReading([`#${ALVO}`]);
    const lidas = await juntar();
    if (!lidas) return;
    depois.current = () => startReading([`#${ALVO}`]);
    setAulas(lidas);
  }

  async function imprimir() {
    const lidas = await juntar();
    if (!lidas) return;
    depois.current = () => {
      document.documentElement.setAttribute("data-eff-imprimir", "");
      const limpar = () => {
        document.documentElement.removeAttribute("data-eff-imprimir");
        window.removeEventListener("afterprint", limpar);
      };
      window.addEventListener("afterprint", limpar);
      window.print();
    };
    if (aulas) {
      const fazer = depois.current;
      depois.current = null;
      fazer();
    } else setAulas(lidas);
  }

  async function baixar() {
    const lidas = await juntar();
    if (!lidas) return;
    if (!aulas) setAulas(lidas);
    const titulo = `${String(numero).padStart(2, "0")} · ${nome}`;
    const corpo = lidas.map((a) => `<section><h2>${escapar(a.titulo)}</h2>${a.partes.map((p) => `<p>${escapar(p)}</p>`).join("")}</section>`).join("");
    const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapar(titulo)}</title><style>body{font:18px/1.6 system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;color:#1b1f1c;background:#fbfaf6}h1{color:#8a100b}h2{margin-top:2.5rem;color:#b3140e}footer{margin-top:3rem;font-size:14px;color:#5a5f5b}</style></head><body><h1>${escapar(titulo)}</h1>${corpo}<footer>${escapar(t.arquivoRodape)}</footer></body></html>`;
    const endereco = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: endereco, download: `caderno-${String(numero).padStart(2, "0")}.html` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(endereco), 10_000);
    setEstado("baixado");
  }

  const aviso = { carregando: t.carregando, falhou: t.falhou, baixado: t.baixado, "sem-voz": t.semVoz, "": "" }[estado];

  return (
    <>
      <div className="eff-acoes-todas">
        <div className="eff-acoes">
          {agora?.href && (
            <Link href={localePath(lang, agora.href)} replace={discreto} className="ef-botao-vermelho eff-continuar">
              <span className="ef-so-computador">{preencher(tudoFeito ? t.rever : t.continuar, { codigo: agora.codigo ?? "", titulo: agora.titulo })}</span>
              <span className="ef-so-celular">{preencher(tudoFeito ? t.rever : t.continuarCurto, { codigo: agora.codigo ?? "" })}</span>
            </Link>
          )}
          {prontas.length > 0 && (
            <button type="button" className="eff-botao-tinta eff-ouvir" onClick={ouvir} aria-pressed={falando}>
              <span className="ef-so-computador">{falando ? t.parar : t.ouvir}</span>
              <span className="ef-so-celular">{falando ? t.parar : t.ouvirCurto}</span>
            </button>
          )}
        </div>
        {prontas.length > 0 && (
          <div className="eff-acoes-mais">
            <button type="button" className="eff-botao-tinta" onClick={baixar}>
              {t.baixar}
            </button>
            <button type="button" className="eff-botao-tinta" onClick={imprimir}>
              {t.imprimir}
            </button>
          </div>
        )}
      </div>
      <p role="status" className="eff-aviso-acoes">
        {aviso}
      </p>
      {aulas && (
        <div id={ALVO} className="eff-inteiro" aria-hidden>
          {aulas.map((a) => (
            <section key={a.titulo}>
              <h2>{a.titulo}</h2>
              {a.partes.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
