// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { site } from "@/lib/site";
import { useI18n } from "../I18n";
import { botao, botaoClaro, campo, dia } from "./comum";

export interface Assinatura {
  id: string;
  nome: string;
  /** Em nome de que função a pessoa assina. Certificados antigos não trazem. */
  papel?: "educacao" | "vice" | "coordenacao";
  disciplina?: string | null;
  confirmou_em: string | null;
}

export interface Certificado {
  id: string;
  codigo: string;
  usuario: string | null;
  nome: string;
  horas: number;
  inicio: string;
  fim: string;
  atividades: string;
  /** As assinaturas, na ordem em que saem na folha (o banco guarda com o nome antigo). */
  testemunhas: Assinatura[];
  status: "aberto" | "emitido" | "cancelado";
  emitido_em: string | null;
  /** SHA-256 de tudo o que o certificado afirma. */
  impressao: string;
}

export const codigoBonito = (codigo: string) => codigo.replace(/(.{4})(?=.)/g, "$1-");
const horasPorExtenso = (valor: number) => `${String(valor).replace(".", ",")} ${Number(valor) === 1 ? "hora" : "horas"}`;
/** A hora da assinatura sai sempre no horário de Brasília, seja onde for que a folha é aberta. */
const quandoAssinou = (iso: string) => `${new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })} (Brasília)`;

/** A folha com os controles de quem vai salvar: CPF (opcional, só na tela), salvar em PDF e voltar. */
export function Impresso({ certificado, fechar }: { certificado: Certificado; fechar: () => void }) {
  const [cpf, setCpf] = useState("");
  const emitido = certificado.status === "emitido";
  return (
    <div>
      {/* Enquanto a folha está na tela, a página de impressão é A4 deitada e sem margens. */}
      <style>{"@page { size: A4 landscape; margin: 0; }"}</style>
      <div className="no-print mb-6 flex flex-wrap items-end gap-3">
        <label className="block">
          CPF de quem recebe (opcional, não é guardado)
          <input value={cpf} onChange={(e) => setCpf(e.target.value)} maxLength={14} inputMode="numeric" placeholder="000.000.000-00" className={campo} />
        </label>
        <button type="button" className={botao} disabled={!emitido} onClick={() => window.print()}>
          Salvar em PDF ou imprimir
        </button>
        <button type="button" className={botaoClaro} onClick={fechar}>
          Voltar
        </button>
        <p className="w-full text-ink-soft">
          {emitido
            ? "Na janela de impressão, escolha “Salvar como PDF”, papel A4 e ligue “Gráficos de plano de fundo”. A orientação e as margens já vêm certas."
            : "Esta é a prévia. O certificado só pode ser salvo depois das três assinaturas."}
        </p>
      </div>
      <Folha certificado={certificado} cpf={cpf} />
    </div>
  );
}

/**
 * A folha do certificado: uma página A4 deitada, igual para todos, que se salva em PDF pelo próprio navegador.
 * Também serve de prévia ao vivo enquanto a coordenação preenche o formulário: nesse caso as horas e o número
 * ainda não existem, e a folha diz isso no lugar deles.
 */
export function Folha({ certificado, cpf = "", rascunho = false }: { certificado: Certificado; cpf?: string; rascunho?: boolean }) {
  const { lang, t } = useI18n();
  // O certificado é sempre em português: com o painel em outro idioma, o nome da disciplina vem do dicionário em português.
  const [areasPt, setAreasPt] = useState<Record<string, string[]> | null>(null);
  useEffect(() => {
    if (lang !== "pt") void import("@/i18n/pt.json").then((dicionario) => setAreasPt(dicionario.default.areas));
  }, [lang]);
  const areas: Record<string, string[]> = lang === "pt" ? t.areas : (areasPt ?? t.areas);
  const emitido = certificado.status === "emitido";
  const data = (iso: string) => (iso ? dia(iso) : "__/__/____");
  const endereco = `${site.url.replace(/^https?:\/\//, "")}/pt/certificado`;
  const cargo = (assinatura: Assinatura) =>
    assinatura.papel === "coordenacao"
      ? "Coordenador"
      : assinatura.papel === "vice"
        ? "Coordenador(a) pedagógico(a)"
        : assinatura.papel === "educacao"
          ? `Educador(a)${assinatura.disciplina ? ` de ${areas[assinatura.disciplina]?.[0] ?? assinatura.disciplina}` : ""}`
          : "Testemunha";

  return (
    // translate="no": o certificado é um documento em português e não muda com o idioma do painel.
    <article className="certificado" lang="pt-BR" translate="no">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/marca.png" alt="" className="certificado-fundo" />
      {!emitido && <p className="certificado-previa">Prévia · sem validade</p>}
      <div className="certificado-folha">
        <header>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca.png" alt="" className="certificado-emblema" />
          <p className="certificado-casa">{site.name}</p>
          <h2 className="certificado-titulo">Certificado</h2>
          <p className="certificado-subtitulo">de trabalho voluntário</p>
        </header>

        <div className="certificado-corpo">
          <p>O {site.name}, projeto educacional gratuito e sem fins lucrativos, certifica que</p>
          <p className="certificado-nome">{certificado.nome || "Nome de quem recebe"}</p>
          <p>
            {cpf.trim() && <>CPF {cpf.trim()}, </>}
            atuou como voluntária(o) no período de <strong>{data(certificado.inicio)}</strong> a <strong>{data(certificado.fim)}</strong>, cumprindo carga horária total de{" "}
            <strong>{rascunho ? "__ horas" : horasPorExtenso(Number(certificado.horas))}</strong>.
          </p>
          <p className="certificado-rotulo">Atividades realizadas</p>
          <p className={`certificado-atividades ${certificado.atividades.length > 420 ? "certificado-atividades-longas" : ""}`}>{certificado.atividades || "As atividades que você descrever aparecem aqui."}</p>
          <p className="certificado-lei">Trabalho prestado sem remuneração, nos termos da Lei nº 9.608/1998, mediante termo de adesão aceito pela pessoa voluntária.</p>
        </div>

        <ul className="certificado-assinaturas">
          {certificado.testemunhas.map((assinatura) => (
            <li key={`${assinatura.id}${assinatura.papel ?? ""}`}>
              <span className="certificado-selo">{assinatura.confirmou_em ? `Assinado eletronicamente em ${quandoAssinou(assinatura.confirmou_em)}` : "Aguardando assinatura"}</span>
              <span className="certificado-assina">{assinatura.nome}</span>
              <span className="certificado-cargo">{cargo(assinatura)}</span>
            </li>
          ))}
        </ul>

        <footer>
          <p>
            Certificado nº {rascunho ? "a definir na abertura" : codigoBonito(certificado.codigo)}
            {certificado.emitido_em && <> · emitido em {new Date(certificado.emitido_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</>} · confira a autenticidade em {endereco}
          </p>
          <p>Impressão digital (SHA-256): {rascunho ? "calculada na abertura do processo" : certificado.impressao}</p>
        </footer>
      </div>
    </article>
  );
}
