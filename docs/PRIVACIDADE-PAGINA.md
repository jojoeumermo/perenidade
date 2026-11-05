# Página de privacidade (Etapa 12)

Texto: `content/paginas/privacidade.md` (só em português; a rota `app/[lang]/privacidade` serve o mesmo texto nos 6 idiomas, não há `privacidade.<lang>.md`). Teste: `npm run testar:privacidade` (27 conferências).

## O que a Etapa 12 acrescentou (data: 5 de novembro de 2026)

| Assunto | Onde na página | Fonte técnica |
|---|---|---|
| Teste dos 12 eixos no aparelho (`lucia:eixos`) | "Se você só estuda" | `components/estudo/DozeEixos.tsx` |
| Jogos: nada sai do aparelho | "Se você só estuda" | `docs/jogos/` |
| App e offline (caches `lucia-*`, fila, sem permissões) | "Se você só estuda" | `docs/APP.md`, `docs/APP-OFFLINE.md` |
| Progresso por QR (cifrado) | "Se você só estuda" | plano, R1 4-5; **recurso ainda não existe no código** |
| Aula ao vivo na sala própria (Galène) e gravação | "Os serviços que mantêm o site no ar" | `docs/AULA-AO-VIVO.md` |
| Rede Lúcia v2 (tabela, aviso no celular, e-mail) | seção própria "Rede Lúcia (a comunidade renovada)" | `docs/rede/PRIVACIDADE.md`, `docs/rede/AVISOS.md` |
| Pesquisa anônima dos 12 eixos da equipe | "Se você é da equipe de voluntários" | `docs/eixos-equipe.md` |
| Bases legais (art. 11, I; Vale o Escrito) | "Com que base a lei permite isso" | |

O Vale o Escrito (envio de fonte, correção, direito de resposta, hash com sal diário, Lei 13.188/2015 arts. 2º e 3º (conferidos no planalto.gov.br em 05/11/2026)) já estava na página e foi mantido.

## Leis citadas

LGPD (Lei 13.709/2018) arts. 5º II e XI, 7º I e IX, 8º, 11 I, 12, 14, 18; Lei 15.211/2025 art. 9º § 1º; Lei 13.188/2015 arts. 2º e 3º (conferidos no planalto.gov.br em 05/11/2026). Os artigos foram conferidos no planalto.gov.br pelos pacotes anteriores (04/11/2026, ver `docs/rede/PRIVACIDADE.md` e `docs/eixos-equipe.md`). Nesta etapa o acesso ao planalto.gov.br não respondeu a tempo, então **a reconferência dos artigos fica para a revisão jurídica**.

## Cuidados ao editar

- Não renomeie os títulos "Se você só estuda" e "Os serviços que mantêm o site no ar": `lib/selos.ts` (`ANCORAS`) e `testar:acesso` dependem das âncoras.
- Mudou o texto de uma promessa? Mude a data no alto.
- Quando o progresso por QR entrar no ar, confira o parágrafo (retransmissão, validade de um dia) contra o código; se divergir, corrija a página, não o código.
- Tradução: a página não tem versões por idioma; fazer `privacidade.en.md` etc. exige trocar o carregador em `app/[lang]/privacidade/page.tsx` (fora do escopo).
