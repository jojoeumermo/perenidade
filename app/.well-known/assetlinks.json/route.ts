// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

// O aplicativo de Android (o site embrulhado em uma "atividade web confiável") só abre sem a barra de endereço
// se o site declarar aqui que confia nele. Os dois valores vêm das variáveis do serviço de hospedagem:
//   ANDROID_PACKAGE  o nome do pacote do aplicativo (ex.: org.institutolucia.app)
//   ANDROID_SHA256   a impressão digital SHA-256 da chave que assina o aplicativo (várias, separadas por vírgula)
// Sem elas, a lista fica vazia e nada muda.
export const dynamic = "force-static";

export function GET() {
  const pacote = (process.env.ANDROID_PACKAGE ?? "").trim();
  const digitais = (process.env.ANDROID_SHA256 ?? "").split(",").map((valor) => valor.trim().toUpperCase()).filter((valor) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(valor));
  const lista = pacote && digitais.length > 0 ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: pacote, sha256_cert_fingerprints: digitais } }] : [];
  return Response.json(lista);
}
