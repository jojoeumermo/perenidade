// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Entrar com um código de recuperação, no cartão da entrada da Alumia (components/rede/entrada/, pendurado ali por quem junta: o
// PedirCodigo mostra o link "Perdi o celular do aplicativo" e troca o formulário por este). Com a senha já conferida (sessão aal1)
// e um dos dez códigos, o banco (public.conta_codigo_usar) tira o aplicativo autenticador da conta, desconecta os outros aparelhos
// e avisa a pessoa por aviso e e-mail. A entrada então pede o cadastro de um aplicativo novo (CadastrarFator): sem ele, a
// sessão não chega a aal2 e a Alumia não abre.
import { useId, useState } from "react";
import { getClient, hasBackend } from "@/lib/backend";
import { contaSegura } from "@/lib/rede/seguranca/cliente";
import { codigoCompleto, formatarCodigo } from "@/lib/rede/seguranca/codigos";
import { Mensagem } from "../entrada/Formularios";
import { useTextosDaSeguranca } from "./base";

/** O link que abre o formulário (para o PedirCodigo pôr embaixo do campo do código do aplicativo). */
export function LinkPerdiOAplicativo({ lang, aoAbrir }: { lang: string; aoAbrir: () => void }) {
  const t = useTextosDaSeguranca(lang);
  if (!t) return null;
  return (
    <button type="button" className="ale-link" onClick={aoAbrir}>{t.recuperar.link}</button>
  );
}

/** O formulário do código de recuperação. `aoRecuperar` volta à entrada, que agora pede o cadastro do aplicativo novo. */
export function RecuperarComCodigo({ lang, aoRecuperar, aoVoltar }: { lang: string; aoRecuperar: () => void; aoVoltar: () => void }) {
  const t = useTextosDaSeguranca(lang);
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [certo, setCerto] = useState(false);
  const id = useId();
  if (!t) return null;

  async function usar() {
    if (!t) return;
    setOcupado(true);
    setErro("");
    try {
      const r = await contaSegura.usarCodigo(codigo);
      if (!r.ok) {
        setErro(t.recuperar.errado);
        return;
      }
      setCerto(true);
      // O fator saiu da conta: a sessão é renovada para a entrada ler o estado novo e pedir o aplicativo de novo.
      if (hasBackend) {
        const supabase = await getClient();
        await supabase.auth.refreshSession().catch(() => null);
      }
      aoRecuperar();
    } catch (e) {
      setErro(e instanceof Error && /muitos_pedidos/.test(e.message) ? t.erros.muitos : t.erros.falha);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <h2 tabIndex={-1} data-ale-foco="" className="ale-cond ale-cartao-titulo">{t.recuperar.titulo}</h2>
      <p className="ale-cartao-texto">{t.recuperar.texto}</p>
      <form className="ale-form" noValidate onSubmit={(e) => { e.preventDefault(); void usar(); }}>
        <div className="ale-campo">
          <label className="ale-rotulo" htmlFor={`${id}-codigo`}>{t.recuperar.rotulo}</label>
          <input
            id={`${id}-codigo`}
            className="ale-entrada ale-codigo"
            value={codigo}
            onChange={(e) => setCodigo(formatarCodigo(e.target.value))}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={11}
            placeholder="A1B2C-3D4E5"
            required
            autoFocus
            aria-invalid={Boolean(erro) || undefined}
            aria-describedby={erro ? `${id}-erro` : undefined}
          />
        </div>
        {erro && <Mensagem tipo="erro" id={`${id}-erro`}>{erro}</Mensagem>}
        {certo && <Mensagem tipo="ok">{t.recuperar.certo}</Mensagem>}
        <button type="submit" className="ale-botao ale-botao-principal" disabled={ocupado || !codigoCompleto(codigo)} aria-busy={ocupado || undefined}>
          {t.recuperar.botao}
        </button>
        <button type="button" className="ale-link" onClick={aoVoltar}>{t.recuperar.voltar}</button>
      </form>
    </>
  );
}
