# Manual da coordenação (Etapa 8, pacote manual)

O manual curto da coordenação tem um texto só, em `docs/MANUAL-DA-COORDENACAO.md`, e aparece igual dentro do painel, em Minha conta, aba **Ajuda**.

## Peças

| Peça | O que faz |
|---|---|
| `docs/MANUAL-DA-COORDENACAO.md` | O texto. Único lugar onde se edita. |
| `scripts/gerar-manual-painel.mjs` (`npm run manual-painel`) | Copia o texto para `components/painel/manual-texto.ts`. O painel não lê disco em tempo de execução. |
| `components/painel/manual-texto.ts` | Gerado. Não editar à mão. |
| `components/painel/Ajuda.tsx` | Desenha o manual: uma parte por `##`, cada uma abre e fecha, com busca sem acento. Só classes do tema novo, sem cor à mão. |
| `components/painel/MinhaConta.tsx` | Edição pontual: aba "Ajuda", carregada por `next/dynamic` só quando abre. |
| `docs/manual-do-painel.html` | Continua como guia de leitura da equipe inteira (conversas, mural, horas); ganhou um aviso no alto apontando para o manual novo. |

## Como mudar o manual
1. Edite `docs/MANUAL-DA-COORDENACAO.md`.
2. Rode `npm run manual-painel`.
3. Rode `npm run testar:manual-painel`: ele falha se a cópia do painel estiver velha.

## O que o manual cobre
Os oito espaços; aprovar aula, publicar agora, moderar, ligar recurso, responder imprensa, curadoria do Vale o Escrito, propostas e moderação da Rede, equipe; o que é seguro, o que o painel confirma, o que pede segunda pessoa e o que nunca se faz; o que fazer quando algo dá errado.

## Honestidade sobre o que ainda não existe
Escrito com base no código de hoje. O manual diz "ainda não" para: ligar e desligar recurso pelo painel (hoje é `NEXT_PUBLIC_RECURSOS` e novo deploy), caixa de imprensa para porta-voz, e zerar segundo fator ou aparelhos com confirmação de segunda pessoa. Esses itens são dos pacotes `controles`, `backend-1` e `backend-2`; quando chegarem, os passos correspondentes do manual precisam ser reescritos (o teste confere as três frases "Ainda não" e deve ser ajustado junto).

A segunda pessoa que existe hoje é a de interdição e expurgo (supervisão pede, coordenação ou coordenação pedagógica aprova). As citações de lei do manual (prazo de 7 dias para correção, anonimato da pesquisa dos 12 eixos) vêm dos documentos já conferidos em `docs/vale-o-escrito/CURADORIA.md` e `docs/eixos-equipe.md`; este pacote não cria regra nova nem toca dado pessoal.

## Teste
`npm run testar:manual-painel` (86 conferências): manual curto, partes pedidas, listas numeradas, quatro níveis de segurança, sem palavra proibida nem emoji, os oito espaços com o nome do menu, seções e botões citados existem no código, recursos que só ligam pelo nome conferidos em `lib/recursos.ts`, cópia do painel em dia, aba Ajuda ligada, sem cor à mão, aviso no HTML antigo.

Sem SQL, sem tabela, sem dependência nova. Não houve conferência visual no navegador.
