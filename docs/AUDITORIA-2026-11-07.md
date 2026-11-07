# Auditoria de segurança e bugs (T33), 7 de novembro de 2026

Rodada auditada: os commits de `255233a3..HEAD` (inscrição de militantes, pessoas do painel, assistente aberto, podcast ao
vivo, chat privado da Alumia, jogos em grupo, matéria com prazo no Jornal, Territórios). Dois verificadores independentes
confirmaram 25 achados (dois deles repetidos). Este documento diz o que foi corrigido, como, e o que ficou.

Banco: uma migração só, `supabase/migracoes/20261107-t33-seguranca.sql`, que pode rodar mais de uma vez e está inteira no fim
do `supabase/install.sql`. **Ela precisa rodar depois de todas as migrações de 6/11** (rodar de novo a T15, a T19 ou a de
pessoas do painel desfaz as correções; basta rodar a T33 de novo em seguida).

## O que foi corrigido

| # | Achado | Gravidade | Corrigido | Como |
|---|--------|-----------|-----------|------|
| 1 | Resumo do IP é `md5('lucia:'‖IP)` com sal público, guardado em `perfis.origem` | média | sim, em parte | `interno.origem()` passa a SHA-256 com um segredo aleatório só do banco (`interno.origem_segredo`, RLS sem política, fora da cópia semanal). Resumos md5 antigos apagados (perfis, banimentos, tentativas de entrada, limites) ou embaralhados de novo (aceite do podcast, registro de armadilha). `perfis.origem` some depois de 30 dias sem entrar (`interno.t33_faxina`, pg_cron). Ver "O que ficou". |
| 19 | O mesmo, visto pelo lado de `interno.limites` | alta | sim, em parte | Igual ao 1. |
| 2, 15 | `GET /api/painel/operacao` responde a qualquer `Bearer x` | baixa | sim | O token passa por `operacao_situacao` (exige `interno.coord()`) antes da resposta; sem isso, 401 ou 403. |
| 3 | `departamento_ver('revolucionarios')` entrega quadro, bastões e pedidos com nomes; `departamentos_resumo` conta as pessoas | alta | sim | Quem não é da coordenação nem do departamento recebe só a descrição (listas vazias, `reservado: true`); a contagem vem `null`. `interno.departamento_pedido_json` esconde o nome de quem pediu pelos Revolucionários (ou cuidou lá) em qualquer departamento. |
| 4 | Representante dos Revolucionários aparece no registro, em `voluntarios_listar` e em `departamento_ver` de outros departamentos | alta | sim | `interno.papel_visivel` filtra o papel em `voluntarios_listar`, `departamento_ver`, `equipe_supervisao`, `equipe_membros` e `equipe()` (esta era pública). Quem só representa os Revolucionários não aparece entre os Representantes nem na contagem deles. O registro grava "reservado" (`papel_conceder_um`, `papel_remover`), e `auditoria_listar` esconde de quem não vê o departamento as linhas reservadas, inclusive as antigas. Só a coordenação retira esse papel. |
| 5 | A supervisão lê as inscrições de militante | alta | sim | `pedidos_supervisao` deixa as militantes de fora. Aceite e recusa de inscrição militante somem do registro para quem não é da coordenação. As contagens de `install.sql:4592` (só coordenação) e `15724` (só número) não identificam ninguém e ficaram. |
| 6 | Inscrição militante manda dados por e-mail e confirma a qualquer endereço | média | sim | Ver 20. O aviso à liderança diz só "Há uma inscrição nova no painel", com o link. |
| 7 | `ja_pediu` revela se um e-mail tem inscrição militante | média | sim | Pedido repetido, ou e-mail com dois pedidos no dia, recebe a MESMA resposta do sucesso (`{id}`), sem gravar nem mandar nada. Vale também para o voluntariado. |
| 20 | Inscrição militante aceita e-mail de terceiro sem confirmação | média | sim | A inscrição fica em `interno.inscricoes_a_confirmar` (só o resumo do código) e vai só um e-mail neutro, sem citar a Frente, com link de uso único por 3 dias (`/pt/voluntarios?confirmar=`, componente `ConfirmarInscricao`). Só no clique (`public.inscricao_confirmar`) a inscrição entra, com o consentimento registrado nessa hora, e a liderança é avisada. Não confirmada some em 3 dias. |
| 8 | Quem foi recusado apaga a recusa com `rede_dm_apagar_tudo` | média | sim | Apaga só as recusas que a própria pessoa fez (`quem = v`). |
| 9 | Quem assedia apaga as provas antes da denúncia | média | sim | Apagar a conversa sai só da lista de quem apaga (`a_apagou_em`/`b_apagou_em`); a outra pessoa continua lendo e denunciando até o prazo; quando as duas apagam, some de vez. Encurtar o prazo vale só para mensagens novas. Mensagem não se apaga depois de bloqueio ou com denúncia aberta da outra pessoa. `rede_dm_apagar_tudo` segue a mesma regra. |
| 10 | `rede_dm_nova_versao` sem limite | baixa | sim | Ação `versao` em `interno.rede_dm_limite` (20 por hora) e recusa de versão nova enquanto a atual tem menos de 5 minutos e já serve às chaves atuais dos dois (trocar de aparelho continua valendo na hora). |
| 11 | Credenciais TURN sem limite | alta | sim, em parte | `/api/aovivo/rede`: limite por pessoa e faixa de rede (resumo do IP com sal do dia, só na memória), uma credencial por sala a cada 5 minutos (pedir de novo devolve a mesma) e teto do mês em 600 GB. Ver "O que ficou". |
| 12 | Assistente: limite por /64 deixa uma pessoa esgotar a cota | média | sim, em parte | Conta também por faixa (IPv4 /24; IPv6 /56 e /48), com teto por hora (5× o da pessoa) e por dia (um quarto do site). Chaves próprias opcionais (`ASSISTENTE_GROQ_API_KEY` etc.) separam do robô do Vale. Ver "O que ficou". |
| 13 | Devolução da vez anula o limite quando as cotas acabam | média | sim | A vez só volta numa chamada só, sem culpa do pedido (fora do ar, sem conexão, chave recusada). Com todos os provedores descansando, 503 na hora, sem chamar ninguém. Teto de pedidos em voo: 12 no site (`ASSISTENTE_SIMULTANEOS`) e 2 por pessoa. |
| 14 | Teto de 3 MB só confere o `Content-Length` | baixa | sim | O corpo é lido com `lerCorpoLimitado`, que corta no teto mesmo em `chunked`, antes de qualquer interpretação. |
| 16, 17, 23 | Jogos em grupo: o `de` não é conferido; qualquer um age como anfitrião ou toma a sala | alta | sim | Cada aba sorteia um par ECDSA P-256 (só na memória), anuncia a pública na presença e assina cada mensagem (`components/jogos/grupo/assinatura.ts`). Quem recebe confere com a primeira chave vista para o id e recusa repetição. O anfitrião recusa ação que diga vir dele mesmo ou de quem não está na presença; quem joga só aceita a vista assinada pelo anfitrião que diz mandá-la. O comando só muda quando o anfitrião sai, ou para a sala com mais gente na presença (a lista da vista não conta). `vistaValida` confere a partida, a partida fica atrás de uma barreira de erro, pacote com itens sem forma não começa, o texto que chega passa por um filtro de contato (zero acertos falsos nos bancos de debates e questões) e link de fonte só aparece se bate com o banco de debates do site. |
| 18 | Podcast sem TURN liga direto (STUN do Google) | alta | sim | Sem retransmissão, quem assiste não entra na sala direta (vê a reserva) e quem transmite é avisado e sai do ar. |
| 21 | Podcast: presenças falsas ocupam as 15 vagas | média | sim, em parte | A vaga vai por ordem de chegada vista por quem transmite (não pela chave escolhida pela aba) e só fica com quem liga o vídeo: quem não liga em 20 s perde a vaga e espera 2 min, recebendo o aviso de sala cheia (e a reserva). |
| 22 | Assistente manda pergunta e foto a planos que treinam, e o aviso não diz | média | sim | O aviso (6 idiomas) diz que o plano gratuito pode guardar e treinar, com leitura por pessoas, e pede foto sem rosto, nome ou escola. Foto que cai no assistente aberto só vai depois de uma confirmação explícita (`fotoAoAberto` em `lib/backend.ts`). No OpenRouter, o pedido sai com `provider.data_collection = "deny"` (desliga com `ASSISTENTE_OPENROUTER_TREINO=1`). |
| 24 | Podcast sem câmera: no ar sem vídeo, "Só áudio" inacessível, microfone aceso | média | sim | Câmera em `try` separado: sem ela, segue só com o som (faixa preta). Sem microfone, para o pulso, solta os trilhos e sai do ar com aviso. Os trilhos param também na saída. |
| 25 | `sai_do_ar_em` com hora e sem aspas sai da lista 3 h antes do 410 | baixa | sim | `instanteDeSaida` recusa `Date` com hora; a montagem falha pedindo aspas (a mensagem já pedia). |

## Testes

Regressões novas em `scripts/testar-militantes.mjs`, `testar-pessoas-painel.mjs`, `testar-rede-chat.mjs`,
`testar-backend-2.mjs`, `testar-assistente.mjs`, `testar-podcast-imersivo.mjs`, `testar-jogos-em-grupo.mjs` e
`testar-jornal-prazo.mjs`. Todos passam, junto com `testar:banco`, `privacidade`, `departamentos-termos`, `moderacao`,
`isolamento`, `interdicao`, `sigilo`, `mensagens`, `painel-fundacao`, `aovivo` e `podcast`; `tsc` e `eslint` limpos nos
arquivos mexidos. (`testar:aula-ao-vivo` tem 3 falhas que já existiam: arquivos fora do Git, `infra/aula-ao-vivo/.env.exemplo`
e `docs/plano-2026-11/notas/aula-ao-vivo.md`.)

## O que ficou (e por quê)

- **Resumo do IP (1, 19):** o segredo é fixo, não gira por dia. Girar por dia desfaria o bloqueio de origem decidido pela
  mediação (`mediacao_banir` com `p_origem`), que precisa reconhecer o mesmo endereço por semanas. Quem lê o banco inteiro
  com o segredo (o operador, um vazamento do servidor) ainda consegue testar os 4 bilhões de IPv4; quem lê só a cópia
  semanal, um vazamento de tabela ou um registro, não. `perfis.origem` continua existindo para o bloqueio de origem, com
  retenção de 30 dias. Para girar o segredo à mão: `update interno.origem_segredo set segredo = …` (os bloqueios de origem
  ativos deixam de valer). O bloqueio de origem decidido antes desta migração também deixou de valer (a conta continua
  banida).
- **TURN (11):** a validade continua 4 horas: a retransmissão renova a reserva com a mesma credencial durante a aula, e o
  cliente ainda não sabe trocar de credencial no meio. Também não há Turnstile no pedido anônimo. Recomendado na Cloudflare:
  regra de limite em `/api/aovivo/rede`, que vale entre os contêineres (o limite daqui é por contêiner).
- **Assistente (12):** sem Turnstile no POST e sem cota reservada por faixa além do teto de um quarto. Recomendado: criar
  chaves só do assistente (`ASSISTENTE_*_API_KEY`) e uma regra de limite da Cloudflare em `/api/assistente`.
- **Podcast (21):** um script com muitas conexões ainda pode ocupar vagas por 20 s de cada vez, trocando de chave. A
  reserva (transmissão aberta) segue como saída; limitar presenças por conexão depende do Realtime.
- **Jogos (16, 17, 23):** um participante mal-intencionado que vire anfitrião (só quando o anfitrião sai e ele é o primeiro
  da fila) assina com a própria chave e pode montar a partida. O filtro de contato, a barreira de erro e a conferência dos
  links com o banco do site limitam o estrago; montar o conteúdo só do banco do site em todos os navegadores ficaria para
  uma rodada própria.
- **Aulas ao vivo:** continuam caindo na ligação direta (STUN do Google) sem TURN, como antes. São para pessoas com conta
  e o achado tratou do podcast; a mesma decisão vale ser tomada para as aulas.
- **Podcast (18):** `podcast_ao_vivo_iniciar` não recusa no banco quando não há TURN (o banco não sabe da configuração do
  servidor); quem recusa é o navegador de quem transmite, logo depois de iniciar.
