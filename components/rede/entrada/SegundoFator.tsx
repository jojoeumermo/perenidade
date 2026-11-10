// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O segundo fator da Alumia (obrigatório para todo mundo): cadastrar o aplicativo autenticador (TOTP do Supabase MFA, o mesmo do
// painel: components/painel/Seguranca.tsx) e, nas outras vezes, pedir o código. A sessão só vira aal2 depois do código certo, e
// o banco da rede só abre com aal2 (interno.rede2_membro e interno.rede_aba, 20261110-alumia-entrada.sql).
import { useState } from "react";
import { getClient, localBackend, rpc } from "@/lib/backend";
import type { TextosDaEntrada } from "@/lib/rede/entrada/textos";
import { Mensagem } from "./Formularios";

type T = TextosDaEntrada;

function CampoCodigo({ t, valor, mudar, invalido }: { t: T; valor: string; mudar: (v: string) => void; invalido: boolean }) {
  return (
    <div className="ale-campo">
      <label className="ale-rotulo" htmlFor="ale-codigo">{t.codigoRotulo}</label>
      <input
        id="ale-codigo"
        className="ale-entrada ale-codigo"
        value={valor}
        onChange={(e) => mudar(e.target.value.replace(/[^\d ]/g, "").slice(0, 7))}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={7}
        required
        autoFocus
        aria-invalid={invalido || undefined}
      />
    </div>
  );
}

async function bloqueadoPorCodigo(conta: string): Promise<number | null> {
  if (localBackend) return null;
  try {
    const r = await rpc<{ bloqueado: boolean; segundos?: number }>("entrada_falhou", { p_email: `codigo:${conta}` });
    return r?.bloqueado ? Math.max(1, Math.ceil((r.segundos ?? 900) / 60)) : null;
  } catch {
    return null;
  }
}

/** Quem já tem o aplicativo: digita o código e a sessão vira aal2. */
export function PedirCodigo({ t, fator, conta, aoConfirmar, aoSair }: { t: T; fator: string; conta: string; aoConfirmar: () => void; aoSair: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  async function confirmar() {
    setOcupado(true);
    setErro("");
    try {
      const supabase = await getClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator, code: codigo.replace(/\D/g, "") });
      if (error) {
        setCodigo("");
        const espera = await bloqueadoPorCodigo(conta);
        return setErro(espera ? t.erros.bloqueado.replace("{min}", String(espera)) : t.erros.codigo);
      }
      aoConfirmar();
    } catch {
      setErro(t.erros.falha);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <>
      <h1 className="ale-cond ale-cartao-titulo">{t.codigoTitulo}</h1>
      <p className="ale-cartao-texto">{t.codigoTexto}</p>
      <form className="ale-form" noValidate onSubmit={(e) => { e.preventDefault(); void confirmar(); }}>
        <CampoCodigo t={t} valor={codigo} mudar={setCodigo} invalido={Boolean(erro)} />
        {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
        <button type="submit" className="ale-botao ale-botao-principal" disabled={ocupado || codigo.replace(/\D/g, "").length !== 6} aria-busy={ocupado || undefined}>
          {t.codigoConfirmar}
        </button>
        <button type="button" className="ale-link" onClick={aoSair}>{t.outraConta}</button>
      </form>
    </>
  );
}

/** Aprovada e sem aplicativo: cadastra agora (QR ou chave), confirma com o primeiro código, e a sessão já sai aal2. */
export function CadastrarFator({ t, aoConfirmar, aoSair }: { t: T; aoConfirmar: () => void; aoSair: () => void }) {
  const [cadastro, setCadastro] = useState<{ id: string; qr: string; segredo: string } | null>(null);
  const [verChave, setVerChave] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function comecar() {
    setOcupado(true);
    setErro("");
    try {
      const supabase = await getClient();
      // Tentativas que ficaram pela metade saem antes de começar outra.
      const { data: lista } = await supabase.auth.mfa.listFactors();
      for (const f of lista?.all ?? []) if (f.factor_type === "totp" && f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Alumia ${new Date().toISOString().slice(0, 10)} ${Math.random().toString(36).slice(2, 6)}` });
      if (error || !data) throw error ?? new Error("falha");
      setCadastro({ id: data.id, qr: data.totp.qr_code, segredo: data.totp.secret });
    } catch {
      setErro(t.erros.falha);
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    if (!cadastro) return;
    setOcupado(true);
    setErro("");
    try {
      const supabase = await getClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: cadastro.id, code: codigo.replace(/\D/g, "") });
      if (error) {
        setCodigo("");
        return setErro(t.erros.codigo);
      }
      await rpc("conta_evento", { p_acao: "segundo_fator_ativado" }).catch(() => null);
      aoConfirmar();
    } catch {
      setErro(t.erros.falha);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <h1 className="ale-cond ale-cartao-titulo">{t.fatorTitulo}</h1>
      <p className="ale-cartao-texto">{t.fatorTexto}</p>
      <ol className="ale-lista-num">
        {t.fatorPassos.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
      {!cadastro ? (
        <div className="ale-form">
          {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
          <button type="button" className="ale-botao ale-botao-principal" disabled={ocupado} aria-busy={ocupado || undefined} onClick={() => void comecar()}>
            {t.fatorComecar}
          </button>
          <button type="button" className="ale-link" onClick={aoSair}>{t.sair}</button>
        </div>
      ) : (
        <form className="ale-form" noValidate onSubmit={(e) => { e.preventDefault(); void confirmar(); }}>
          <div className="ale-qr">
            {/* O QR vem do próprio serviço de contas (imagem data:), feito no aparelho: nada sai para terceiros. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cadastro.qr} alt={t.fatorQr} width={200} height={200} />
            <button type="button" className="ale-link" aria-expanded={verChave} onClick={() => setVerChave((v) => !v)}>{t.fatorChave}</button>
            {verChave && (
              <p>
                <span className="ale-ajuda">{t.fatorChaveRotulo}: </span>
                <span className="ale-chave">{cadastro.segredo}</span>
              </p>
            )}
          </div>
          <Mensagem tipo="info">{t.fatorAviso}</Mensagem>
          <CampoCodigo t={t} valor={codigo} mudar={setCodigo} invalido={Boolean(erro)} />
          {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
          <button type="submit" className="ale-botao ale-botao-principal" disabled={ocupado || codigo.replace(/\D/g, "").length !== 6} aria-busy={ocupado || undefined}>
            {t.codigoConfirmar}
          </button>
        </form>
      )}
    </>
  );
}
