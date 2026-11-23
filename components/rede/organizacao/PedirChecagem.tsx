// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 66. "Pedir checagem ao Instituto", no menu "mais" do cartão (encaixe acoesDoCartao; o cartão não muda). Só para post aberto à
// internet: vai para a fila da Checagem do site só o endereço do post e o motivo escrito por quem pede, sem quem pediu.
import { useState } from "react";
import { perguntar } from "@/components/perguntar";
import type { ContextoDoEncaixe } from "../encaixes";
import type { Post } from "@/lib/rede/tipos";
import { organizacao } from "@/lib/rede/organizacao/cliente";
import { podePedirChecagem } from "@/lib/rede/organizacao/regras";
import { fraseDoErro, useTextosDaOrganizacao } from "./textos";

export function PedirChecagem({ lang, situacao, post }: ContextoDoEncaixe & { post: Post }) {
  const t = useTextosDaOrganizacao(lang);
  const [estado, setEstado] = useState<string | null>(null);
  if (!t || !situacao.logado || situacao.suspenso || !post.id || !podePedirChecagem({ publico: post.publico, cifrado: !!post.corpo_grupo })) return null;
  const c = t.checagem;
  async function pedir() {
    const motivo = await perguntar(c.pergunta, "", { sim: c.mandar, nao: c.cancelar });
    if (!motivo || !t) return;
    try {
      const r = await organizacao.pedirChecagem(post.id, motivo);
      setEstado(r.ja_na_fila ? c.jaNaFila : c.mandado);
    } catch (e) {
      setEstado(fraseDoErro(t, e));
    }
  }
  return (
    <button type="button" className="al2-acao justify-start" disabled={estado !== null} onClick={(e) => { e.stopPropagation(); void pedir(); }}>
      <span role={estado ? "status" : undefined}>{estado ?? c.pedir}</span>
    </button>
  );
}
