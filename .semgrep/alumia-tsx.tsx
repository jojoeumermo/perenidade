// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Arquivo de TESTE das regras de alumia-tsx.yml (semgrep --test .semgrep). Não é código do site.

export function MensagemRuim({ texto }: { texto: string }) {
  // ruleid: alumia-chat-sem-html-cru
  return <p dangerouslySetInnerHTML={{ __html: texto }} />;
}

export function MensagemBoa({ texto }: { texto: string }) {
  // ok: alumia-chat-sem-html-cru
  return <p>{texto}</p>;
}
