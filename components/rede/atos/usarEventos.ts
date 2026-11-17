// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os ganchos da frente 10F na página do ato: o rede_ato_mais (organizações, série, álbum e linha), carregado uma vez e trocado
// pelo que cada ação devolve; a frase de cada erro novo (série, convite, álbum, linha) e as datas curtas no idioma da página.
import { useCallback } from "react";
import { codigoDoErro } from "@/lib/rede/atos/erros";
import { FUSO_DOS_ATOS } from "@/lib/rede/atos/eventos";
import { atos as cliente } from "@/lib/rede/cliente-atos";
import type { TextosDosAtos } from "@/lib/rede/textos-atos";
import type { MaisDoAto } from "@/lib/rede/tipos-atos";
import { frase } from "./usar";
import { useQuadro } from "./usarQuadro";

/** O rede_ato_mais de um ato. `ligado` falso não pergunta nada (o ato ainda não carregou). */
export function useMaisDoAto(id: string, ligado: boolean) {
  const carregar = useCallback(() => cliente.mais(id), [id]);
  return useQuadro<MaisDoAto>(carregar, id, ligado && Boolean(id));
}

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e ?? "")).toLowerCase();

/** A frase de um erro, com os códigos novos da 10F antes dos de sempre dos atos. */
export function fraseDoEvento(t: TextosDosAtos, e: unknown): string {
  const m = mensagem(e);
  const x = t.eventos.erros;
  if (m.includes("serie_existe")) return x.serie_existe;
  if (m.includes("ja_convidada")) return x.ja_convidada;
  if (m.includes("album_fechado")) return x.album_fechado;
  if (m.includes("linha_fechada")) return x.linha_fechada;
  if (m.includes("rostos_nao_conferidos")) return x.rostos;
  if (m.includes("midia_cheia")) return x.midia_cheia;
  if (/invalido:fotos(?!_grande)/.test(m)) return x.fotos;
  if (/invalido:(arquivo|fotos_grande)/.test(m)) return x.arquivo;
  if (/invalido:(frequencia)/.test(m)) return t.eventos.serie.problemas.frequencia;
  if (/invalido:ate/.test(m)) return t.eventos.serie.problemas.ate;
  if (/invalido:excecoes/.test(m)) return t.eventos.serie.problemas.excecoes;
  return codigoDoErro(e) === "generico" ? t.tela.erro : frase(t, e);
}

const local = (lang: string) => (lang === "pt" ? "pt-BR" : lang);

/** "sex., 20/11" — o dia de um ato, no horário do ato. */
export function diaCurto(iso: string, lang: string): string {
  try {
    return new Intl.DateTimeFormat(local(lang), { weekday: "short", day: "2-digit", month: "2-digit", timeZone: FUSO_DOS_ATOS }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** "20/11/2026" a partir de um dia AAAA-MM-DD. */
export function diaDaData(data: string, lang: string): string {
  try {
    return new Intl.DateTimeFormat(local(lang), { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${data}T12:00:00Z`));
  } catch {
    return data;
  }
}

/** "14:05" de um instante, no idioma da página (no fuso do aparelho de quem lê). */
export function horaDe(iso: string, lang: string): string {
  try {
    return new Intl.DateTimeFormat(local(lang), { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return "";
  }
}
