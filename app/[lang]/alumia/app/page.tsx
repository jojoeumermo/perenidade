// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { carregarTextosDoApp, preencherApp, type TextosDoApp } from "@/components/rede/transparencia-apps/textos";
import "@/components/rede/transparencia-apps/app.css";
import { loadLang } from "@/i18n";
import { ligado } from "@/lib/recursos";
import { REPOSITORIO } from "@/lib/rede/transparencia-apps/identidade";
import { enderecoNoLancamento, enderecoNoRekor, lerVersoes, type PlataformaDoApp } from "@/lib/rede/transparencia-apps/versoes";
import { textosDaRede } from "@/lib/rede/textos";
import versoesPublicadas from "@/public/apps/versoes.json";

// Feita a cada pedido: no endereço próprio do chat (lib/rede/chat/origem.ts) a política de scripts leva um "nonce" novo por resposta, e o
// Next só o aplica aos scripts dele em página feita na hora (como /alumia/conversas).
export const dynamic = "force-dynamic";

const ROTEIRO = `https://github.com/${REPOSITORIO}/blob/master/docs/BUILD-REPRODUZIVEL.md`;

export async function generateMetadata({ params }: PageProps<"/[lang]/alumia/app">): Promise<Metadata> {
  if (!ligado("rede-v2")) return {};
  const { lang } = await loadLang(params);
  const t = await carregarTextosDoApp(lang);
  return { title: `${t.titulo} · ${textosDaRede(lang).marca}`, description: t.soApp.texto };
}

function tamanho(bytes: number, lang: string): string {
  return `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(bytes / 1_000_000)} MB`;
}

function nomeDaPlataforma(t: TextosDoApp, p: PlataformaDoApp): string {
  return t.baixar[p];
}

/**
 * Baixar e conferir o app (/alumia/app), pública e sem conta: é para onde o site manda quem quer conversar quando o recurso
 * "alumia-chat-so-app" está ligado, e para onde vai o endereço próprio do chat (lib/rede/chat/origem.ts). Mostra cada arquivo da
 * última versão com o resumo SHA-256, a entrada no livro público (Rekor) e como conferir antes de instalar. Nenhuma importação do
 * chat. Com "rede-v2" desligada, 404.
 */
export default async function Pagina({ params }: PageProps<"/[lang]/alumia/app">) {
  if (!ligado("rede-v2")) notFound();
  const { lang } = await loadLang(params);
  const t = await carregarTextosDoApp(lang);
  const { versao, arquivos } = lerVersoes(versoesPublicadas);
  const exemplo = { versao: versao ?? "X.Y.Z", arquivo: arquivos[0]?.nome ?? "alumia-X.Y.Z-windows-x64-setup.exe" };
  const identidade = `https://github.com/${REPOSITORIO}/.github/workflows/apps-lancamento.yml@refs/tags/v${exemplo.versao}`;
  return (
    <article className="ap-pagina" data-pagina-do-app="">
      <h1>{t.titulo}</h1>
      <p className="ap-lead">{t.lead}</p>

      <section aria-labelledby="ap-baixar">
        <h2 id="ap-baixar">{t.baixar.titulo}</h2>
        <ul className="ap-plataformas">
          {(["android", "windows", "macos", "linux"] as const).map((p) => (
            <li key={p}>{nomeDaPlataforma(t, p)}</li>
          ))}
        </ul>
        <p className="ap-nota">{t.baixar.iphone}</p>
        {versao === null || arquivos.length === 0 ? (
          <p className="ap-cartao">{t.baixar.semVersao}</p>
        ) : (
          <>
            <h3>{preencherApp(t.baixar.versao, { versao })}</h3>
            <div className="ap-rolar">
              <table className="ap-tabela">
                <thead>
                  <tr>
                    <th scope="col">{t.baixar.arquivo}</th>
                    <th scope="col">{t.baixar.para}</th>
                    <th scope="col">{t.baixar.tamanho}</th>
                    <th scope="col">{t.baixar.resumo}</th>
                    <th scope="col">{t.baixar.livro}</th>
                  </tr>
                </thead>
                <tbody>
                  {arquivos.map((a) => (
                    <tr key={a.nome}>
                      <td>
                        <a href={enderecoNoLancamento(versao, a.nome)} rel="noopener noreferrer">
                          {a.nome}
                        </a>
                        <br />
                        <a className="ap-nota" href={enderecoNoLancamento(versao, a.pacote)} rel="noopener noreferrer">
                          {t.baixar.pacote}
                        </a>
                      </td>
                      <td>{nomeDaPlataforma(t, a.plataforma)}</td>
                      <td>{tamanho(a.tamanho, lang)}</td>
                      <td className="ap-resumo">{a.sha256}</td>
                      <td>
                        <a href={enderecoNoRekor(a.rekor.indice)} rel="noopener noreferrer">
                          {preencherApp(t.baixar.entrada, { indice: String(a.rekor.indice) })}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="ap-conferir">
        <h2 id="ap-conferir">{t.conferir.titulo}</h2>
        <p>{t.conferir.texto}</p>
        <ol>
          {t.conferir.passos.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
        <p>{t.conferir.comandoNode}</p>
        <pre className="ap-comando">{`node scripts/conferir-app.mjs ${exemplo.arquivo} ${exemplo.arquivo}.sigstore.json --versao ${exemplo.versao}`}</pre>
        <p>{t.conferir.comandoCosign}</p>
        <pre className="ap-comando">{`cosign verify-blob-attestation --new-bundle-format --type slsaprovenance1 \\
  --bundle ${exemplo.arquivo}.sigstore.json \\
  --certificate-identity ${identidade} \\
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \\
  ${exemplo.arquivo}`}</pre>
        {versao === null && <p className="ap-nota">{preencherApp(t.conferir.trocar, { versao: "X.Y.Z", arquivo: exemplo.arquivo })}</p>}
        <p>
          <a href={ROTEIRO} rel="noopener noreferrer">
            {t.conferir.roteiro}
          </a>
        </p>
      </section>

      <section aria-labelledby="ap-sistema">
        <h2 id="ap-sistema">{t.sistema.titulo}</h2>
        <p>{t.sistema.texto}</p>
      </section>

      <section aria-labelledby="ap-atualizacao">
        <h2 id="ap-atualizacao">{t.atualizacao.titulo}</h2>
        <p>{t.atualizacao.texto}</p>
      </section>
    </article>
  );
}
