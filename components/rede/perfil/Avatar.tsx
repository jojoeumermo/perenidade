// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { redePerfil } from "@/lib/rede/cliente-perfil";
import { avatarDaGaleria, caminhoDoAvatar, origemDaImagem } from "@/lib/rede/perfil";
import type { ImagemDePerfil } from "@/lib/rede/tipos-perfil";

// Os rostos dos cartões chegam em lote: cada cartão pede o do seu autor, os pedidos da mesma página se juntam numa chamada só
// (até 60 pessoas) e o resultado fica guardado enquanto a aba está aberta. Foto enviada (e já aceita) vem à parte, só quando o
// cartão aparece, para a linha não pesar no 3G. Falha de rede = iniciais; nada quebra.
const guardados = new Map<string, string | null>();
const esperando = new Map<string, ((origem: string | null) => void)[]>();
let agendado = false;

async function resolverLote() {
  agendado = false;
  const ids = [...esperando.keys()].slice(0, 60);
  let achados: Record<string, string> = {};
  try {
    achados = await redePerfil.avatares(ids);
  } catch {
    // sem rede ou banco antigo: ficam as iniciais
  }
  for (const id of ids) {
    const valor = achados[id];
    const fila = esperando.get(id) ?? [];
    esperando.delete(id);
    if (valor && avatarDaGaleria(valor)) {
      guardados.set(id, caminhoDoAvatar(valor));
      for (const f of fila) f(caminhoDoAvatar(valor));
    } else if (valor === "envio") {
      let dados: string | null = null;
      try {
        dados = await redePerfil.imagem(id, "avatar");
      } catch {
        dados = null;
      }
      const origem = dados && /^data:image\/webp;base64,/.test(dados) ? dados : null;
      guardados.set(id, origem);
      for (const f of fila) f(origem);
    } else {
      guardados.set(id, null);
      for (const f of fila) f(null);
    }
  }
  if (esperando.size) agendar();
}

function agendar() {
  if (agendado) return;
  agendado = true;
  setTimeout(() => void resolverLote(), 30);
}

function pedir(id: string): Promise<string | null> {
  if (guardados.has(id)) return Promise.resolve(guardados.get(id) ?? null);
  return new Promise((resolver) => {
    esperando.set(id, [...(esperando.get(id) ?? []), resolver]);
    agendar();
  });
}

/** As iniciais do codinome: o rosto de quem ainda não escolheu um. */
export const iniciaisDoCodinome = (codinome: string): string =>
  codinome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

/**
 * O rosto de uma pessoa: o desenho ou a foto que ela escolheu (aceita pela mediação) ou as iniciais do codinome. Nos cartões
 * basta o `usuario` (o rosto vem em lote); na página do perfil o `imagem` já vem pronto. Decorativo: o codinome está ao lado.
 */
export function Avatar({ usuario, imagem, codinome, tamanho = 40, className = "" }: { usuario?: string | null; imagem?: ImagemDePerfil | null; codinome: string; tamanho?: number; className?: string }) {
  const direta = imagem !== undefined ? origemDaImagem(imagem, "avatar") : null;
  const [achada, setAchada] = useState<{ usuario: string; origem: string | null } | null>(null);
  useEffect(() => {
    if (imagem !== undefined || !usuario) return;
    let vivo = true;
    pedir(usuario).then((origem) => vivo && setAchada({ usuario, origem }));
    return () => {
      vivo = false;
    };
  }, [usuario, imagem]);
  const origem = imagem !== undefined ? direta : usuario && achada?.usuario === usuario ? achada.origem : usuario ? (guardados.get(usuario) ?? null) : null;
  const caixa = { width: tamanho, height: tamanho };
  if (origem) {
    // eslint-disable-next-line @next/next/no-img-element -- SVG do projeto ou WebP já reencodado: não passa pelo otimizador de imagens.
    return <img src={origem} alt="" aria-hidden width={tamanho} height={tamanho} decoding="async" loading="lazy" style={caixa} className={`shrink-0 rounded-full bg-parchment-deep object-cover ${className}`} />;
  }
  return (
    <div aria-hidden style={{ ...caixa, fontSize: Math.max(11, Math.round(tamanho * 0.36)) }} className={`grid shrink-0 place-items-center rounded-full bg-[#1f1a14] font-sans font-bold text-[#f4ecd8] ${className}`}>
      {iniciaisDoCodinome(codinome)}
    </div>
  );
}
