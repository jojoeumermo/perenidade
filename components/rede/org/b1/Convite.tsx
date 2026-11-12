// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Quem chega pelo QR do cartaz do lampião: o código do convite vem no fragmento (#convite=…), que o navegador não manda a servidor
// nenhum (não fica em registro de acesso). Membro logado entra no núcleo com um toque (rede_fix_convite_usar confere hash, validade,
// revogação e limite de usos; ECA Digital art. 9º: só 18+ com consentimento); o fragmento é apagado do endereço logo depois.
import { useState } from "react";
import { clienteOrgB1 } from "@/lib/rede/cliente-org-b1";
import { conviteDoFragmento } from "@/lib/rede/org/b1";
import { fraseDoErro, useTextosDaOrgB1 } from "@/lib/rede/textos-org-b1";
import { Botao } from "../../ui/Botao";

export function ConviteDoLink({ lang, membro, aoEntrar }: { lang: string; membro: boolean; aoEntrar: () => void }) {
  const t = useTextosDaOrgB1(lang);
  // Lido uma vez: este bloco só aparece depois que o perfil chegou do banco (nunca na hidratação do HTML do servidor).
  const [codigo] = useState<string | null>(() => (typeof window === "undefined" ? null : conviteDoFragmento(window.location.hash)));
  const [estado, setEstado] = useState<"" | "entrou" | "erro">("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  if (!t || !codigo) return null;
  const limparEndereco = () => {
    try {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch {
      // Sem history: o código some ao sair da página.
    }
  };
  async function entrar() {
    setOcupado(true);
    try {
      const r = await clienteOrgB1().usarConvite(codigo!);
      if (r?.ok === false) throw Object.assign(new Error("convite_vencido"), { code: "convite_vencido" });
      setEstado("entrou");
      limparEndereco();
      aoEntrar();
    } catch (e) {
      setEstado("erro");
      setErro(fraseDoErro(t!, e));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <div className="b1-convite" role="region" aria-label={t.lampiao.usarConvite}>
      {estado === "entrou" ? <p className="al-ok" role="status">{t.lampiao.entrou}</p> : (
        <>
          <p style={{ margin: 0 }}>{t.lampiao.entrarComConvite}</p>
          {membro ? <Botao variante="dourado" disabled={ocupado} onClick={() => void entrar()}>{t.lampiao.usarConvite}</Botao> : <p className="al-perfil-nota" style={{ margin: 0 }}>{t.erros.entre_primeiro}</p>}
        </>
      )}
      {estado === "erro" ? <p className="al-perfil-erro" role="alert">{erro}</p> : null}
    </div>
  );
}
