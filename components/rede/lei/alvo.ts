// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que a pessoa cola no canal de conteúdo ilegal, virado no alvo da denúncia: o endereço de um post (/alumia/p/<id>, ou só o
// número dele), de um perfil (/alumia/u/<@>, ou só o @) ou de uma comunidade (/alumia/c/<nome>). Puro (o teste chama no Node).

export type AlvoDaDenuncia = { tipo: "post" | "perfil" | "comunidade"; alvo: string };

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function lerAlvo(entrada: string): AlvoDaDenuncia | null {
  const texto = entrada.trim();
  if (!texto || texto.length > 300) return null;
  const caminho = (() => {
    try {
      return /^https?:\/\//i.test(texto) ? decodeURIComponent(new URL(texto).pathname) : texto;
    } catch {
      return texto;
    }
  })();
  const post = caminho.match(/\/p\/([^/?#]+)/);
  if (post && UUID.test(post[1])) return { tipo: "post", alvo: post[1].match(UUID)![0].toLowerCase() };
  const perfil = caminho.match(/\/u\/@?([a-z0-9_.]{2,40})/i);
  if (perfil) return { tipo: "perfil", alvo: perfil[1].toLowerCase() };
  const comunidade = caminho.match(/\/c\/([a-z0-9-]{2,60})/i);
  if (comunidade) return { tipo: "comunidade", alvo: comunidade[1].toLowerCase() };
  if (/^[0-9a-f-]{36}$/i.test(caminho) && UUID.test(caminho)) return { tipo: "post", alvo: caminho.toLowerCase() };
  const arroba = caminho.match(/^@([a-z0-9_.]{2,40})$/i);
  if (arroba) return { tipo: "perfil", alvo: arroba[1].toLowerCase() };
  return null;
}
