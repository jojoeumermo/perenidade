// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Prompt 4, itens 6, 1 e 9: a seção "Presença e proteção contra print" dos Ajustes (/alumia/seguranca, pelo encaixe
// secoesDeAjustes). Duas escolhas, as duas desligadas por padrão: mostrar "ativo recentemente" à roda de confiança (item 6) e
// proteger a foto de perfil (item 1). Desligar o status apaga o campo no servidor. O aviso fixo diz o limite da proteção.
import "./presenca.css";
import { useEffect, useId, useState } from "react";
import { clienteDePresencaEPrint, type MinhasEscolhas } from "@/lib/rede/cliente-presenca-print";
import { plataformaDaProtecao } from "@/lib/rede/protecao-print";
import type { ContextoDoEncaixe } from "../encaixes";
import { useTextosDePresencaEPrint } from "./textos";
import { voltarAMarcar } from "./usar";

export default function PresencaEPrintNosAjustes({ lang, situacao }: ContextoDoEncaixe) {
  const t = useTextosDePresencaEPrint(lang);
  const [escolhas, setEscolhas] = useState<MinhasEscolhas | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(false);
  // A tela só monta no aparelho (import dinâmico sem SSR): o agente de usuário já está aqui.
  const [plataforma] = useState(() => (typeof navigator === "undefined" ? "navegador" : plataformaDaProtecao(navigator.userAgent)));
  const id = useId();

  useEffect(() => {
    if (!situacao.logado) return;
    let vivo = true;
    clienteDePresencaEPrint()
      .minhas()
      .then((r) => vivo && setEscolhas(r))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [situacao.logado]);

  if (!t || !situacao.logado) return null;
  if (!escolhas) return <p className="p4-nota" role={erro ? "alert" : "status"}>{erro ? t.ajustes.erro : t.ajustes.carregando}</p>;

  async function mudar(qual: keyof MinhasEscolhas, sim: boolean) {
    setOcupado(true);
    setErro(false);
    try {
      const c = clienteDePresencaEPrint();
      const r = qual === "presenca" ? await c.ligarPresenca(sim) : await c.protegerFoto(sim);
      setEscolhas(r);
      if (qual === "presenca" && sim) voltarAMarcar();
    } catch {
      setErro(true);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="p4-ajustes" data-p4-ajustes="">
      <label className="p4-escolha">
        <input type="checkbox" checked={escolhas.presenca} disabled={ocupado} onChange={(e) => void mudar("presenca", e.target.checked)} aria-describedby={`${id}-p`} />
        <span>
          {t.ajustes.presenca}
          <small id={`${id}-p`}>{t.ajustes.presencaAjuda}</small>
        </span>
      </label>
      <label className="p4-escolha">
        <input type="checkbox" checked={escolhas.foto} disabled={ocupado} onChange={(e) => void mudar("foto", e.target.checked)} aria-describedby={`${id}-f`} />
        <span>
          {t.ajustes.foto}
          <small id={`${id}-f`}>{t.ajustes.fotoAjuda}</small>
        </span>
      </label>
      <p className="p4-nota">{t.ajustes.story}</p>
      <p className="p4-nota">{t.aviso}</p>
      <p className="p4-nota">{plataforma === "app" ? t.avisoApp : t.avisoNavegador}</p>
      <p className="p4-nota">{t.naoAvisa}</p>
      <p className="p4-nota">{t.ajustes.sairRapido}</p>
      {erro ? (
        <p className="p4-nota" role="alert">
          {t.ajustes.erro}
        </p>
      ) : null}
    </div>
  );
}
