// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O aviso de Pix no cartão do post (Prompt 4, item 100), pendurado pelo encaixe da ação coletiva (sem mexer no cartão). Só para quem
// tem conta e só quando o post fala em Pix: o banco confere se o post cita uma organização com selo e traz OUTRA chave; a resposta
// nunca traz o texto do post nem a chave achada, só o @ e o nome da organização.
import "./coletiva.css";
import { useEffect, useState } from "react";
import { acaoColetiva, type OrgResumo } from "@/lib/rede/coletiva/cliente";
import { falaEmPix } from "@/lib/rede/coletiva/regras";
import type { Post } from "@/lib/rede/tipos";
import type { ContextoDoEncaixe } from "../encaixes";
import { com, useTextosDaColetiva } from "./textos";

export default function AvisoDePix({ lang, situacao, post }: ContextoDoEncaixe & { post: Post }) {
  const t = useTextosDaColetiva(lang);
  const [org, setOrg] = useState<Pick<OrgResumo, "handle" | "nome"> | null>(null);
  const conferir = situacao.logado && falaEmPix(post.texto);
  useEffect(() => {
    if (!conferir) return;
    let vivo = true;
    acaoColetiva.conferirPix(post.id).then(
      (r) => vivo && setOrg(r.alerta && r.org ? r.org : null),
      () => vivo && setOrg(null),
    );
    return () => { vivo = false; };
  }, [conferir, post.id]);
  if (!org || !t) return null;
  return (
    <div className="ac-pix" role="note">
      <p>{com(t.pix.aviso, { nome: org.nome, handle: org.handle })}</p>
      <a href={`/${lang}/alumia/acao-coletiva?aba=orgs&org=${encodeURIComponent(org.handle)}`}>{t.pix.ver}</a>
    </div>
  );
}
