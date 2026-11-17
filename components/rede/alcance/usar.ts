// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O que as peças da frente 13C dividem: os textos sob demanda, o QR feito no aparelho (biblioteca qrcode do projeto, carregada só
// quando precisa), o endereço absoluto a partir de onde a pessoa está, os domínios que contam como "daqui" e copiar um texto.
import { useEffect, useState } from "react";
import { ALUMIA_URL } from "@/lib/rede/alumia";
import { enderecosDaFederacao } from "@/lib/rede/fediverso/enderecos";
import { PALETA_CREME } from "@/lib/rede/alcance/arte";
import { enderecoAbsoluto } from "@/lib/rede/alcance/regras";
import { carregarTextosDoAlcance, type TextosDoAlcance } from "@/lib/rede/alcance/textos";

const cache = new Map<string, TextosDoAlcance>();

/** Os textos da frente no idioma da página (nulo enquanto chegam). Com `ativo` falso, não baixa nada. */
export function useTextosDoAlcance(lang: string, ativo = true): TextosDoAlcance | null {
  const [chegou, setChegou] = useState<{ lang: string; texto: TextosDoAlcance } | null>(null);
  useEffect(() => {
    if (!ativo || cache.has(lang)) return;
    let vivo = true;
    carregarTextosDoAlcance(lang)
      .then((texto) => {
        cache.set(lang, texto);
        if (vivo) setChegou({ lang, texto });
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang, ativo]);
  return cache.get(lang) ?? (chegou?.lang === lang ? chegou.texto : null);
}

/** O QR de um endereço como imagem (data URL), feito no aparelho. Nulo enquanto faz; "" se não deu. Tinta sobre papel, sempre. */
export function useQr(endereco: string | null, largura = 480): string | null {
  const [qr, setQr] = useState<{ de: string; url: string } | null>(null);
  useEffect(() => {
    if (!endereco) return;
    let vivo = true;
    import("qrcode")
      .then((q) => q.toDataURL(endereco, { errorCorrectionLevel: "M", margin: 2, width: largura, color: { dark: PALETA_CREME.qrEscuro, light: PALETA_CREME.qrClaro } }))
      .then((url) => vivo && setQr({ de: endereco, url }))
      .catch(() => vivo && setQr({ de: endereco, url: "" }));
    return () => {
      vivo = false;
    };
  }, [endereco, largura]);
  return qr && qr.de === endereco ? qr.url : null;
}

/** A origem de onde a pessoa está (no servidor, a do site). */
export const origemAqui = (): string => (typeof window === "undefined" ? "" : window.location.origin);

/** O endereço absoluto de uma tela da Alumia, como a pessoa a abriria. */
export function enderecoDaTela(lang: string, caminho: string): string {
  return enderecoAbsoluto(lang, caminho, { alumia: ALUMIA_URL, site: origemAqui() });
}

/** Os domínios que contam como "daqui" ao trazer uma lista, e o do @ que vai no arquivo (vazio sem o endereço da Alumia). */
export function dominiosDaqui(): { lista: string[]; doArquivo: string; daFederacao: boolean } {
  const fed = enderecosDaFederacao();
  const aqui = typeof window === "undefined" ? "" : window.location.host.toLowerCase();
  return { lista: [fed.dominio, fed.dominioCurto, aqui].filter(Boolean).map((d) => d.toLowerCase()), doArquivo: fed.dominio || aqui, daFederacao: Boolean(fed.dominio) };
}

/** Copia um texto; devolve se deu. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

/** Baixa um arquivo feito no aparelho (nenhum servidor no meio). */
export function baixarArquivo(conteudo: Blob | string, nome: string): void {
  const url = typeof conteudo === "string" ? conteudo : URL.createObjectURL(conteudo);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (typeof conteudo !== "string") setTimeout(() => URL.revokeObjectURL(url), 2000);
}
