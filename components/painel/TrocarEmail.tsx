// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Trocar o e-mail da conta de alguém, a pedido da pessoa (T29). Só a coordenação comunitária vê e usa. A regra de verdade
// está no banco (public.usuario_email_trocar, supabase/migracoes/20261106-pessoas-painel.sql): nunca a própria conta nem
// a de outra coordenação, motivo obrigatório, no máximo 10 trocas por dia, registro com o e-mail mascarado e aviso por
// e-mail ao endereço antigo e ao novo. O e-mail é dado pessoal (LGPD, art. 6º, III e VII): aparece só aqui, para quem
// já o via na lista da equipe.

import { AtSign } from "lucide-react";
import { useState } from "react";
import { Aviso, useAcao } from "./comum";
import { Botao, Campo, confirmarFrase } from "./ui";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function TrocarEmail({ pessoa, depois }: { pessoa: { id: string; nome: string; email: string; papeis: { papel: string }[] }; depois: () => void }) {
  const [novo, setNovo] = useState("");
  const [confirma, setConfirma] = useState("");
  const [motivo, setMotivo] = useState("");
  const acao = useAcao(depois);
  if (pessoa.papeis.some((p) => p.papel === "coordenacao")) return null;
  const limpo = novo.trim().toLowerCase();
  const valido = EMAIL.test(limpo) && limpo.length <= 200;
  const iguais = limpo === confirma.trim().toLowerCase();
  const mesmo = limpo === pessoa.email.trim().toLowerCase();
  const pronto = valido && iguais && !mesmo && motivo.trim().length >= 5;

  async function trocar() {
    const ok = await confirmarFrase(`Trocar o e-mail de ${pessoa.nome} para ${limpo}? A pessoa passa a entrar com o endereço novo (a senha continua a mesma). Os dois endereços recebem um aviso, e a troca fica no registro.`, { confirmar: "Trocar o e-mail" });
    if (!ok) return;
    if (await acao.agir("usuario_email_trocar", { p_usuario: pessoa.id, p_email: limpo, p_motivo: motivo.trim() }, `E-mail trocado. ${pessoa.nome} recebeu um recado no painel, e os dois endereços, um aviso por e-mail.`)) {
      setNovo("");
      setConfirma("");
      setMotivo("");
    }
  }

  return (
    <section className="space-y-2">
      <h3 className="font-semibold">Trocar o e-mail</h3>
      <p className="pn-ajuda">
        Só a pedido da pessoa, confirmado por outro canal. {pessoa.email ? <>Hoje: <span className="font-mono">{pessoa.email}</span>.</> : null} O endereço antigo e o novo recebem um aviso; a senha não muda.
      </p>
      <Campo rotulo="E-mail novo" type="email" autoComplete="off" spellCheck={false} value={novo} maxLength={200} onChange={(e) => setNovo(e.target.value)} erro={novo && !valido ? "Confira o e-mail." : mesmo && novo ? "É o mesmo e-mail de hoje." : undefined} />
      <Campo rotulo="Repita o e-mail novo" type="email" autoComplete="off" spellCheck={false} value={confirma} maxLength={200} onChange={(e) => setConfirma(e.target.value)} erro={confirma && !iguais ? "Os dois não batem." : undefined} />
      <Campo rotulo="Motivo (vai para o registro)" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: pediu pelo grupo da coordenação em 06/11" />
      <Botao pequeno simbolo={AtSign} disabled={!pronto} carregando={acao.ocupado} onClick={() => void trocar()}>
        Trocar o e-mail
      </Botao>
      <Aviso texto={acao.aviso} />
    </section>
  );
}
