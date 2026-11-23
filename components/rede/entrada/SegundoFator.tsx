// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O segundo fator da Alumia (obrigatório para todo mundo): cadastrar o aplicativo autenticador (TOTP do Supabase MFA, o mesmo do
// painel: components/painel/Seguranca.tsx) e, nas outras vezes, pedir o código. A sessão só vira aal2 depois do código certo, e
// o banco da rede só abre com aal2 (interno.rede2_membro e interno.rede_aba, 20261110-alumia-entrada.sql).
import { useState } from "react";
import { getClient, hasBackend, localBackend, rpc } from "@/lib/backend";
import { gerador, sementeDe } from "@/lib/rede/mosaico";
import type { TextosDaEntrada } from "@/lib/rede/entrada/textos";
import { RecuperarComCodigo } from "../seguranca/RecuperarComCodigo";
import { PerdiOAplicativo } from "../uso/NaEntrada";
import { Mensagem } from "./Formularios";

type T = TextosDaEntrada;

/**
 * Um QR de mentira, só para a prévia sem banco (NEXT_PUBLIC_ALUMIA_PREVIA): quadradinhos de uma semente fixa, com os três
 * cantos. Não cadastra nada em aplicativo nenhum; o QR de verdade vem do serviço de contas.
 */
function qrDeExemplo(): string {
  const n = 29;
  const sorte = gerador(sementeDe("entrada:qr-de-exemplo"));
  let pontos = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const canto = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
      if (!canto && sorte() < 0.47) pontos += `M${x} ${y}h1v1h-1z`;
    }
  }
  const olho = (x: number, y: number) => `M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5zM${x + 2} ${y + 2}h3v3h-3z`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><path fill="#0f0e0d" fill-rule="evenodd" d="${pontos}${olho(0, 0)}${olho(n - 7, 0)}${olho(0, n - 7)}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function CampoCodigo({ t, valor, mudar, invalido, descrito, foco }: { t: T; valor: string; mudar: (v: string) => void; invalido: boolean; descrito?: string; foco?: boolean }) {
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
        placeholder="000000"
        required
        autoFocus={foco}
        aria-invalid={invalido || undefined}
        aria-describedby={descrito}
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
export function PedirCodigo({ t, lang, fator, conta, aoConfirmar, aoSair }: { t: T; lang: string; fator: string; conta: string; aoConfirmar: () => void; aoSair: () => void }) {
  const [recuperando, setRecuperando] = useState(false);
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
  // Perdeu o celular do aplicativo: um dos códigos de recuperação tira o aplicativo da conta (onda 8, conta segura) e a entrada,
  // lida de novo, pede o cadastro de um aplicativo novo.
  if (recuperando) return <RecuperarComCodigo lang={lang} aoRecuperar={aoConfirmar} aoVoltar={() => setRecuperando(false)} />;
  return (
    <>
      <h2 tabIndex={-1} data-ale-foco="" className="ale-cond ale-cartao-titulo">{t.codigoTitulo}</h2>
      <p className="ale-cartao-texto">{t.codigoTexto}</p>
      <form className="ale-form" noValidate onSubmit={(e) => { e.preventDefault(); void confirmar(); }}>
        <CampoCodigo t={t} valor={codigo} mudar={setCodigo} invalido={Boolean(erro)} descrito={erro ? "ale-codigo-erro" : undefined} foco />
        {erro && <Mensagem tipo="erro" id="ale-codigo-erro">{erro}</Mensagem>}
        <button type="submit" className="ale-botao ale-botao-principal" disabled={ocupado || codigo.replace(/\D/g, "").length !== 6} aria-busy={ocupado || undefined}>
          {t.codigoConfirmar}
        </button>
        <button type="button" className="ale-link" onClick={aoSair}>{t.outraConta}</button>
      </form>
      {/* R1 (A3.2): o caminho de quem perdeu o celular do aplicativo, à vista, e o que fazer sem os códigos. */}
      <PerdiOAplicativo lang={lang} aoAbrir={() => setRecuperando(true)} />
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
      // Na prévia sem banco, só o desenho da tela: um QR de exemplo, que não cadastra nada.
      if (!hasBackend) return setCadastro({ id: "exemplo", qr: qrDeExemplo(), segredo: "EXEMPLO SEM VALOR" });
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
      <h2 tabIndex={-1} data-ale-foco="" className="ale-cond ale-cartao-titulo">{t.fatorTitulo}</h2>
      <p className="ale-cartao-texto">{t.fatorTexto}</p>
      <ol className="ale-numerada">
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
            {cadastro.id === "exemplo" && <span className="ale-ajuda">{t.p.qrExemplo}</span>}
            <button type="button" className="ale-link" aria-expanded={verChave} onClick={() => setVerChave((v) => !v)}>{t.fatorChave}</button>
            {verChave && (
              <p>
                <span className="ale-ajuda">{t.fatorChaveRotulo}: </span>
                <span className="ale-chave">{cadastro.segredo}</span>
              </p>
            )}
          </div>
          <Mensagem tipo="info">{t.fatorAviso}</Mensagem>
          <CampoCodigo t={t} valor={codigo} mudar={setCodigo} invalido={Boolean(erro)} descrito={erro ? "ale-codigo-erro" : undefined} />
          {erro && <Mensagem tipo="erro" id="ale-codigo-erro">{erro}</Mensagem>}
          <button type="submit" className="ale-botao ale-botao-principal" disabled={ocupado || codigo.replace(/\D/g, "").length !== 6} aria-busy={ocupado || undefined}>
            {t.codigoConfirmar}
          </button>
        </form>
      )}
    </>
  );
}
