// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// "Entrar pelo Tor", na Segurança da conta: o chat por texto pelo endereço .onion. O endereço NÃO fica no código: vem da variável de
// montagem NEXT_PUBLIC_CHAT_ONION (a mesma do cabeçalho Onion-Location do chat), e sem ela o bloco diz que ainda não foi publicado
// (e não ensina a abrir um endereço que não existe).
// A tela só promete o texto: a sala de voz não passa pelo Tor. Como o serviço está montado não é publicado (é da operação).
import type { T } from "./base";

const ONION = (process.env.NEXT_PUBLIC_CHAT_ONION ?? "").trim();
/** Só um endereço .onion v3 de verdade (56 letras base32), com ou sem http://. */
const ENDERECO = /^(?:http:\/\/)?([a-z2-7]{56}\.onion)\/?$/.exec(ONION)?.[1] ?? null;

export function EntrarPeloTor({ t }: { t: T }) {
  const tor = t.tor;
  return (
    <section className="sg-bloco" aria-labelledby="sg-tor-t">
      <h2 id="sg-tor-t" className="sg-titulo al-cond">{tor.titulo}</h2>
      <p className="sg-texto">{tor.texto}</p>
      {ENDERECO ? (
        <>
          <p className="sg-subtitulo">{tor.endereco}</p>
          <code className="sg-onion" translate="no">http://{ENDERECO}</code>
          <p className="sg-cinza sg-tor-uso">{tor.comoUsar}</p>
        </>
      ) : (
        <p className="sg-cinza">{tor.semEndereco}</p>
      )}
    </section>
  );
}
