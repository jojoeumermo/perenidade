// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { rede } from "@/lib/rede/cliente";
import { redeOrg } from "@/lib/rede/cliente-org";
import { conferirPedido, type FaltaNoPedido } from "@/lib/rede/org/pedido";
import { preencher } from "@/lib/rede/preencher";
import { carregarTextosDaOrg, type TextosDaOrg } from "@/lib/rede/textos-org";
import { LIMITES, TIPOS_DE_ORG, type PedidoDeSelo, type TipoDeOrg } from "@/lib/rede/tipos-org";
import { Botao, LinkBotao } from "../ui/Botao";
import { Faixa } from "../ui/Faixa";
import { enderecosDaOrg } from "./ParaOrganizacoes";
import "./org.css";

const VAZIO: PedidoDeSelo = { codinome: "", handle: "", tipo: "coletivo", cidade: "", documentoTipo: "cnpj", documento: "", sobre: "", maior: false };

/**
 * Pedir o selo (/alumia/organizacoes/selo): o formulário que põe o pedido na fila da equipe (rede_org_pedir_selo). Só para quem
 * está logado; só documento público da organização; quem cuida da conta não aparece para ninguém (PLANO-ALUMIA §6.5 e §6.6).
 */
export function PedirOSelo({ lang }: { lang: string }) {
  const [t, setT] = useState<TextosDaOrg | null>(null);
  const [logado, setLogado] = useState<boolean | null>(null);
  const [p, setP] = useState<PedidoDeSelo>(VAZIO);
  const [regras, setRegras] = useState(false);
  const [falta, setFalta] = useState<FaltaNoPedido | "regras" | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [feito, setFeito] = useState(false);

  useEffect(() => {
    let vivo = true;
    carregarTextosDaOrg(lang).then((x) => vivo && setT(x)).catch(() => undefined);
    rede
      .situacao()
      .then((s) => vivo && setLogado(s.logado))
      .catch(() => vivo && setLogado(false));
    return () => {
      vivo = false;
    };
  }, [lang]);

  if (!t) return <div aria-busy className="al-perfil" style={{ minHeight: "60vh" }} />;
  const tp = t.pedir;
  const erros = t.erros;
  const rotulos: Record<FaltaNoPedido | "regras", string> = {
    codinome: tp.codinome,
    handle: tp.handle,
    tipo: tp.tipo,
    cidade: tp.cidade,
    documentoTipo: tp.docTipo,
    documento: tp.documento,
    sobre: tp.sobre,
    maior: tp.maior,
    regras: tp.regras,
    docPessoal: tp.documento,
  };
  const mudar = <K extends keyof PedidoDeSelo>(k: K, v: PedidoDeSelo[K]) => setP((x) => ({ ...x, [k]: v }));

  async function mandar() {
    const f = conferirPedido(p) ?? (regras ? null : "regras");
    setFalta(f);
    setErro("");
    if (f) return;
    setOcupado(true);
    try {
      await redeOrg.pedirSelo({ ...p, codinome: p.codinome.trim(), cidade: p.cidade.trim(), documento: p.documento.trim(), sobre: p.sobre.trim() });
      setFeito(true);
    } catch (e) {
      const codigo = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
      setErro(codigo === "banco_desatualizado" || codigo === "sem_servico" ? erros.semBanco : erros.falha);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="al-perfil">
      <Faixa />
      <div className="al-selo-form">
        <p>
          <Link href={enderecosDaOrg.pagina(lang)} className="al-org-ferramenta-ver">
            ← {t.pagina.titulo}
          </Link>
        </p>
        <h1 className="al-cond al-perfil-nome">{tp.titulo}</h1>
        <p className="al-perfil-bio">{tp.intro}</p>
        <p className="al-perfil-nota">{t.selo.regra}</p>

        {logado === false ? (
          <div className="al-perfil-acoes" style={{ marginTop: 16 }}>
            <p className="al-perfil-bio" style={{ width: "100%" }}>
              {tp.entre}
            </p>
            <LinkBotao href={`${enderecosDaOrg.entrar(lang)}/selo`} variante="primario">
              {tp.entrar}
            </LinkBotao>
          </div>
        ) : feito ? (
          <p className="al-ok" role="status" style={{ marginTop: 16 }}>
            {tp.enviado}
          </p>
        ) : (
          <form
            className="al-form"
            style={{ marginTop: 16 }}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void mandar();
            }}
          >
            <label className="al-campo">
              <span>{tp.codinome}</span>
              <input className="al-entrada" value={p.codinome} maxLength={60} onChange={(e) => mudar("codinome", e.target.value)} aria-invalid={falta === "codinome"} />
              <small>{tp.codinomeAjuda}</small>
            </label>
            <label className="al-campo">
              <span>{tp.handle}</span>
              <input
                className="al-entrada"
                value={p.handle}
                maxLength={20}
                autoCapitalize="none"
                spellCheck={false}
                onChange={(e) => mudar("handle", e.target.value.toLowerCase().replace(/^@/, ""))}
                aria-invalid={falta === "handle"}
              />
              <small>{tp.handleAjuda}</small>
            </label>
            <label className="al-campo">
              <span>{tp.tipo}</span>
              <select className="al-entrada" value={p.tipo} onChange={(e) => mudar("tipo", e.target.value as TipoDeOrg)}>
                {TIPOS_DE_ORG.map((x) => (
                  <option key={x} value={x}>
                    {t.tipos[x]}
                  </option>
                ))}
              </select>
            </label>
            <label className="al-campo">
              <span>{tp.cidade}</span>
              <input className="al-entrada" value={p.cidade} maxLength={60} onChange={(e) => mudar("cidade", e.target.value)} aria-invalid={falta === "cidade"} />
              <small>{tp.cidadeAjuda}</small>
            </label>
            <label className="al-campo">
              <span>{tp.docTipo}</span>
              <select className="al-entrada" value={p.documentoTipo} onChange={(e) => mudar("documentoTipo", e.target.value)}>
                {(Object.keys(tp.docTipos) as (keyof typeof tp.docTipos)[]).map((x) => (
                  <option key={x} value={x}>
                    {tp.docTipos[x]}
                  </option>
                ))}
              </select>
            </label>
            <label className="al-campo">
              <span>{tp.documento}</span>
              <input
                className="al-entrada"
                value={p.documento}
                maxLength={LIMITES.documento}
                onChange={(e) => mudar("documento", e.target.value)}
                aria-invalid={falta === "documento" || falta === "docPessoal"}
              />
              <small>{tp.documentoAjuda}</small>
            </label>
            <label className="al-campo">
              <span>{tp.sobre}</span>
              <textarea className="al-entrada" value={p.sobre} maxLength={LIMITES.sobre} onChange={(e) => mudar("sobre", e.target.value)} aria-invalid={falta === "sobre"} />
            </label>
            <label className="al-marcar">
              <input type="checkbox" checked={p.maior} onChange={(e) => mudar("maior", e.target.checked)} />
              <span>{tp.maior}</span>
            </label>
            <label className="al-marcar">
              <input type="checkbox" checked={regras} onChange={(e) => setRegras(e.target.checked)} />
              <span>{tp.regras}</span>
            </label>
            <p className="al-perfil-nota">{tp.privacidade}</p>
            {falta ? (
              <p className="al-perfil-erro" role="alert">
                {falta === "docPessoal" ? tp.docPessoal : preencher(tp.faltou, { campo: rotulos[falta] })}
              </p>
            ) : null}
            {erro ? (
              <p className="al-perfil-erro" role="alert">
                {erro}
              </p>
            ) : null}
            <div>
              <Botao type="submit" tamanho="g" disabled={ocupado || logado === null}>
                {tp.enviar}
              </Botao>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
