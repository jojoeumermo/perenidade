// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { rpc } from "@/lib/backend";

/**
 * Formulário público da caixa de imprensa. Só pede o necessário (nome, veículo, e-mail, assunto, mensagem e um prazo
 * opcional), com o consentimento marcado pela pessoa (LGPD, art. 7º, I) e o aviso de que o pedido é eliminado 180 dias
 * depois de respondido. Sem rastreamento e sem script de terceiros. O campo "site" é uma isca invisível contra robôs.
 */
export function ImprensaForm() {
  const [enviado, setEnviado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setOcupado(true);
    setErro("");
    try {
      await rpc("imprensa_enviar", {
        p: {
          nome: f.get("nome"), veiculo: f.get("veiculo"), email: f.get("email"), assunto: f.get("assunto"), mensagem: f.get("mensagem"),
          prazo: f.get("prazo") || null, site: f.get("site") || "", consentimento: f.get("consentimento") === "on",
        },
      });
      setEnviado(true);
    } catch (x) {
      const codigo = x instanceof Error ? `${x.message} ${(x as { code?: string }).code ?? ""}` : "";
      setErro(/muitos_pedidos/.test(codigo) ? "Muitos pedidos seguidos. Tente de novo mais tarde." : "Não deu para enviar. Confira os campos e tente de novo, ou escreva para o e-mail do instituto.");
    } finally {
      setOcupado(false);
    }
  }

  if (enviado) return <p role="status" className="rounded-md border border-rule p-4">Recebemos o seu pedido. A pessoa que cuida da imprensa responde pelo e-mail que você informou.</p>;
  const campo = "mt-1 block w-full rounded-md border border-rule bg-parchment px-3 py-2 text-ink";
  return (
    <form onSubmit={(e) => void enviar(e)} className="relative space-y-4" aria-describedby="imprensa-aviso">
      <label className="block">Seu nome<input name="nome" required minLength={2} maxLength={100} autoComplete="name" className={campo} /></label>
      <label className="block">Veículo ou organização (opcional)<input name="veiculo" maxLength={100} autoComplete="organization" className={campo} /></label>
      <label className="block">E-mail para a resposta<input name="email" type="email" required maxLength={200} autoComplete="email" className={campo} /></label>
      <label className="block">Assunto<input name="assunto" required minLength={3} maxLength={150} className={campo} /></label>
      <label className="block">O que você precisa<textarea name="mensagem" required minLength={10} maxLength={3000} rows={6} className={campo} /></label>
      <label className="block">Prazo, se houver (opcional)<input name="prazo" type="date" className={campo} /></label>
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
        <label>Não preencha<input name="site" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <p id="imprensa-aviso" className="text-sm text-ink-soft">
        Usamos seu nome, veículo e e-mail só para responder a este pedido. Eles ficam guardados enquanto o pedido estiver em andamento e são eliminados 180 dias depois de respondido ou arquivado. Ninguém de fora da equipe de imprensa lê.
      </p>
      <label className="flex items-start gap-2"><input name="consentimento" type="checkbox" required className="mt-1" />Concordo com o uso dos meus dados para esta resposta.</label>
      {erro && <p role="alert" className="text-oxblood">{erro}</p>}
      <button type="submit" disabled={ocupado} className="cursor-pointer rounded-md border border-ink px-5 py-2.5 font-semibold disabled:opacity-50">{ocupado ? "Enviando..." : "Enviar o pedido"}</button>
    </form>
  );
}
