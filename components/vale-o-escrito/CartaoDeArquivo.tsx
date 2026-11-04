// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import "@/styles/vale-o-escrito.css";
import type { FotoLivre } from "@/lib/vale-o-escrito/tipos";

/**
 * O cartão de arquivo da ficha: a foto presa por um clipe, com o crédito e a licença, e o código de arquivo. A foto só
 * aparece quando a pessoa ou a organização tem foto de domínio público ou de licença livre (FotoLivre: crédito,
 * licença e página de origem, conferidos em regras.ts). Sem foto, o cartão mostra o espaço marcado, nunca uma imagem
 * qualquer. Nunca foto de vítima, de criança nem de testemunha: esses nem entram como nó (ECA, arts. 17, 143 e 247).
 */
export function CartaoDeArquivo({
  codigo,
  titulo,
  linhas,
  foto,
  legendaDaFoto,
  carimbo,
  textoSemFoto,
  rotuloCredito,
  rotuloLicenca,
}: {
  codigo: string;
  titulo: string;
  linhas: string[];
  foto?: FotoLivre;
  /** Quem aparece na foto, em uma linha ("Fulano de Tal"). Vai antes do crédito. */
  legendaDaFoto?: string;
  /** A situação jurídica, em carimbo. */
  carimbo?: string;
  textoSemFoto: string;
  rotuloCredito: string;
  rotuloLicenca: string;
}) {
  return (
    <div className="ve-cartao">
      <svg className="ve-clipe" viewBox="0 0 22 52" aria-hidden="true" focusable="false">
        <path d="M6 44V12a5 5 0 0 1 10 0v28a3 3 0 0 1-6 0V16" fill="none" stroke="#8b8f98" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <figure className="ve-cartao-foto">
        {foto ? (
          // Foto externa de licença livre: <img> simples, sem enviar a página de origem como referência (privacidade).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto.url} alt={legendaDaFoto ?? titulo} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        ) : (
          <div className="ve-cartao-semfoto">{textoSemFoto}</div>
        )}
        {foto && (
          <figcaption>
            {legendaDaFoto ? `${legendaDaFoto}. ` : ""}
            {rotuloCredito}: {foto.credito}. {rotuloLicenca}: {foto.licenca}.{" "}
            <a href={foto.origem} target="_blank" rel="noopener noreferrer nofollow">
              ↗
            </a>
          </figcaption>
        )}
      </figure>
      <div className="ve-cartao-corpo">
        <span className="ve-codigo">{codigo}</span>
        <p className="ve-cartao-nome">{titulo}</p>
        {linhas.map((l, i) => (
          <span key={i} className="ve-cartao-linha">
            {l}
          </span>
        ))}
        {carimbo && <span className="ve-carimbo">{carimbo}</span>}
      </div>
    </div>
  );
}
