# Rede Lúcia: pacote consertos (R4, itens 1 a 9)

Migração: `supabase/migracoes/2026-11-rede-consertos.sql` (roda depois da fundação). Teste: `npm run testar:rede-consertos` (151 conferências). Vale para a **Rede de hoje**, com o recurso `rede-v2` ligado ou não: são correções de segurança e privacidade.

| # | Conserto | Onde |
| --- | --- | --- |
| 1 | Total de "Apoiar" só para quem escreveu; "Eu vou" só para quem organizou. No SQL (`interno.rede_post_json`, `rede_vou`), não só na tela; o número de respostas conta só o que a pessoa vê. | SQL e `CartaoDoPost` em `components/comunidade/Rede.tsx` |
| 2 | Idade mínima 18 (`rede_18`). `rede_confirmar_idade(p_maior)`: quem declara menos de 18 fica fora **só da Rede** (`rede_menor_em`), com mensagem gentil; um gatilho no banco impede virar 18+ por update direto (inclusive `rede_aderir`); só a mediação desfaz (`rede_fix_idade_rever`). Quem tinha confirmado 16 confirma 18. | SQL, `components/rede/consertos/Idade.tsx`, `ForaDaRede.tsx`, dicionários `rede.idadeTexto` e `rede.idadeOk` nos 6 idiomas |
| 3 | "Esqueci a senha": `resetPasswordForEmail` (com o desafio contra robôs), o link volta para `/entrar` com `type=recovery`, que já abria a escolha da senha nova. Resposta sempre igual, haja conta ou não. | `components/rede/consertos/EsqueciASenha.tsx` (uma linha em `SignIn.tsx`) |
| 4 | Botão Escrever visível abaixo de `xl` (fixo no canto, acima da barra de baixo, alvo de 48 px). | `BotaoEscrever.tsx` |
| 5 | Paginação por cursor (`rede_fix_linha`, 20 por vez, máximo 50, desempate por id) e "Carregar mais". | SQL, `useLinha.ts` |
| 6 | "N novos" por aba (`rede_fix_novos_abas`, teto 99+), só números. | SQL, `useNovosPorAba.ts` |
| 7 | Posts da Rede na segunda avaliação externa: `rede_postar` usa `rede_triagem` e devolve `avaliar`; `comunidade_para_avaliar`, `comunidade_avaliada` e `comunidade_pendentes` ganham o ramo `rede`; a função `avaliar-comunidade` aceita `tipo: "rede"`. Falha nunca publica. | SQL, `supabase/functions/avaliar-comunidade`, `lib/backend.ts` (`evaluatePost`) |
| 8 | Convites com hash (sha256), validade (1 a 30 dias), limite de usos (1 a 200) e revogação, para núcleo (v2) e espaço fechado (hoje). O código aparece uma vez. Código antigo em texto vale mais 30 dias (a mediação é avisada na migração), depois é trocado por um sorteado. | SQL, `Convites.tsx` |
| 9 | Fórum só sob demanda (`next/dynamic`, sem SSR) com esqueleto; esqueleto também na linha. | `components/comunidade/ComunidadeComRede.tsx`, `Esqueletos.tsx` |

## Decisões

- **Convite inválido não levanta erro**: `rede_fix_convite_usar` devolve `{ok: false, erro: 'convite_vencido'}`. Um erro desfaria a contagem do limite de tentativas (20 por hora, na mesma transação) e o limite não valeria nada. O banco nunca diz por que o convite não vale.
- **Texto dos consertos** em `i18n/rede/consertos/{pt,…}.json` (en, es, fr, ru e zh são rascunho marcado), entregue à Rede de hoje por `ConsertosProvider` (contexto), com os textos de **um** idioma só. O dicionário `rede` do site só teve os valores de idade trocados de 16 para 18.
- **Contador de abas**: de 30 em 30 segundos com a página à vista, uma chamada só para as três abas.

## Leis (planalto.gov.br, 04/11/2026)

- LGPD (13.709/2018) art. 14 (dado de criança e adolescente) e art. 6º, III (necessidade: contagem só a quem precisa).
- **ECA Digital (Lei 15.211/2025), art. 9º, §1º**, veda a autodeclaração como verificação de idade para conteúdo impróprio a menores. A confirmação de 18 anos aqui é **autodeclaração**: trava de produto, não aferição. **Revisão jurídica antes de ligar para todos** (já era ponto da ESPEC, seção 7).
- Marco Civil (12.965/2014) art. 7º, VII: nada é repassado a terceiros; a avaliação externa só recebe o texto de post que espera decisão.

## Para a integração

1. Juntar a migração ao `install.sql` na ordem de `docs/rede/V2.md` (fundação, consertos, …).
2. Depois de juntar, ajustar `scripts/testar-banco.mjs` (Rede de hoje): o convite do espaço agora tem 32 caracteres (`/^[a-z0-9]{12}$/` falha); "o convite antigo morre" passa a devolver `{ok: false}` em vez de levantar `convite_vencido`; `p.vou === 1` lido por visitante passa a ser `null`.
3. Chamar `select public.rede_fix_manutencao()` (só com a chave de serviço) na rotina diária de limpeza, para trocar os códigos antigos vencidos.
4. `comunidade_controles().esperando` ainda conta só tópicos e respostas; somar `rede_posts where retido` quando o pacote de moderação mostrar a fila da Rede.
