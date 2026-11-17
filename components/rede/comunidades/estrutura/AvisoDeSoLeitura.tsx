// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { estrutura as cliente } from "@/lib/rede/estrutura/cliente";
import type { ContextoDoEncaixe } from "../../encaixes";
import { useTextosEstrutura } from "./base";
import "./estrutura.css";

/**
 * O carimbo "Comunidade de avisos" no alto da comunidade (encaixe altoDaComunidade, entre a capa e as abas), com uma linha que diz
 * quem abre post (e, para quem não pode, que dá para responder conforme a regra). Para quem não abre post ali, a mesma linha vai no
 * lugar do "Escrever aqui" do menu da comunidade (aoBarrarEscrever). Sem comunidade de avisos, não desenha nada.
 */
export function AvisoDeSoLeitura({ lang, slug, aoBarrarEscrever }: ContextoDoEncaixe & { slug: string; aoBarrarEscrever?: (motivo: string | null) => void }) {
  const te = useTextosEstrutura(lang);
  const [dado, setDado] = useState<{ slug: string; so: boolean; posso: boolean } | null>(null);

  useEffect(() => {
    let vivo = true;
    cliente.ver(slug).then(
      (e) => vivo && setDado({ slug, so: e.so_leitura, posso: e.posso_abrir_post }),
      () => vivo && setDado(null),
    );
    return () => {
      vivo = false;
    };
  }, [slug]);

  // Quem não abre post numa comunidade de avisos não vê o "Escrever aqui": vê a regra no lugar dele.
  const barrado = Boolean(te && dado && dado.slug === slug && dado.so && !dado.posso);
  const motivo = barrado && te ? te.avisos.paraQuemLe : null;
  useEffect(() => {
    aoBarrarEscrever?.(motivo);
  }, [aoBarrarEscrever, motivo]);

  if (!te || !dado || dado.slug !== slug || !dado.so) return null;
  return (
    <p className="e10 e10-aviso-avisos" role="note">
      <span className="e10-carimbo e10-carimbo-ouro">{te.avisos.carimbo}</span>
      <span>{dado.posso ? te.avisos.paraModeracao : te.avisos.paraQuemLe}</span>
    </p>
  );
}
