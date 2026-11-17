# Rede Lúcia v2: privacidade e dados (ESPEC, seção 7)

O que a Rede (hoje Alumia) guarda, por quê, por quanto tempo e quem vê. Vale para o pacote de moderação e serve de base para os outros. Leis conferidas no planalto.gov.br em 04/11/2026.
Não é parecer jurídico.

**Lei e ajuda:** o texto para quem usa está nas páginas `/alumia/termos`, `/alumia/privacidade`,
`/alumia/o-que-guardamos`, `/alumia/regras` e `/alumia/ajuda` (`components/rede/lei/`, textos em `i18n/rede/lei/`). A seção 9
abaixo é o inventário conferido nas migrações que deu origem à página "O que guardamos". Onde as seções antigas (1 a 8) e a 9
discordarem, vale a 9.

## 1. Princípios

- **Codinome por padrão.** Por padrão ninguém aparece com o nome de verdade. A pessoa pode escolher, de forma consciente e reversível, aparecer com nome e foto de verdade (decisão de 12/11/2026). O nome do painel nunca sai por função da Rede.
- **Sem rastreamento.** Nada de pixel, de tempo de leitura, de histórico do que cada pessoa abriu. Contagens são agregadas. O nível de confiança conta o que a pessoa **faz**
  (apoios, úteis, salvos, posts), nunca o que ela lê.
- **Sem endereço de IP guardado** (decisão de 13/11/2026, nas duas faixas). Nem tabela, nem registro de acesso, nem log. Banir por rede usa só a impressão HMAC com segredo do servidor e prazo (`alumia_impressoes`, 30 dias; banimento por rede, até 90 dias).
- **Minimização.** CPF, telefone e e-mail no texto do post são recusados. EXIF e GPS saem das imagens no navegador e no servidor (pacote publicar).
- **Chat privado cifrado de ponta a ponta** (`docs/rede/CHAT-PRIVADO.md`): o servidor guarda só o texto cifrado e quem está em cada conversa.

## 2. Dados que a moderação guarda

| Dado | Para quê | Quem vê | Por quanto tempo |
| --- | --- | --- | --- |
| Denúncia (alvo, categoria, texto, situação, protocolo) | tratar a denúncia | a moderação do lugar | enquanto a decisão puder ser contestada; depois, só o necessário para o registro |
| **Conta de quem denunciou** | avisar o andamento; atender ao ECA Digital, art. 29, § 2º (notificante identificável) | **só a própria pessoa**; nunca a moderação, nunca o autor | até a denúncia ser encerrada e o prazo de recurso passar |
| Registro de moderação (ação, regra, motivo, quem decidiu, quando) | prestar contas, garantir o recurso, evitar abuso | a moderação; o motivo e a regra, a quem foi moderado (sem dizer quem decidiu) | só inserção, não se apaga nem altera; revisão da retenção com a assessoria jurídica |
| Recurso (texto, decisão, quem revisou) | contraditório | a moderação; a decisão, a quem recorreu | junto do registro |
| Silenciados (pessoa, conversa, comunidade, palavra) | filtrar a linha de quem silenciou | **só quem silenciou**; nunca o silenciado | até a pessoa desfazer ou a validade acabar |
| Listas de bloqueio da mediação | proteger a comunidade ou o núcleo | só a mediação do lugar | até a mediação retirar |
| Rótulo de desinformação (post, slug da checagem) | avisar que há checagem | quem pode ver o post | junto do post |
| Nível de confiança | limites de links, imagens e posts por dia | só a própria pessoa e a moderação (na fila) | calculado na hora, não guardado |

Dado de moderação **não vai** para prévia de link (OG), busca de fora, exportação pública nem contagem: a matriz de visibilidade (`interno.rede_ve`) vale para todos eles.

## 3. LGPD (Lei 13.709/2018)

- **Art. 5º, II**: opinião política e filiação sindical são dado pessoal **sensível**. Uma conversa política numa rede de luta pode revelar isso; por isso o número de apoios
  só aparece para o autor, o "eu vou" só para quem organizou, e **ninguém vê lista de nomes**. Silenciar e denunciar também não expõem ninguém.
- **Art. 11, I**: consentimento **específico e destacado**, para finalidades específicas. É a caixa própria da primeira entrada (`rede_aderir`), com a versão das normas guardada em
  `rede_consentimentos`, revogável.
- **Art. 14**: dado de criança e adolescente só no **melhor interesse** deles. A Rede é **só para maiores de 18 anos** (decisão aprovada em 30/10/2026): não trata dado de menor de propósito.
  Se um menor aparecer, a categoria `menores` da denúncia é prioridade 1 e retém a conta por precaução (seção 4).
- **Art. 18**: acesso, correção, portabilidade e eliminação. Exportar e apagar a conta: `/alumia/meus-dados` (frente 8C). A pessoa vê o que a moderação fez sobre ela em "Denúncias e recursos" (posts) e em `/alumia/regras#revisao` (conta suspensa ou retida, mesmo sem passar pela porta). O registro de moderação só se retira por decisão formal, porque é a prova de que o processo foi cumprido.
- **Art. 7º**: bases legais: consentimento e execução da atividade educativa; segurança da própria plataforma para o registro de moderação.

## 4. ECA Digital (Lei 15.211/2025)

- **Art. 9º, § 1º**: veda a **autodeclaração** como verificação de idade para conteúdo impróprio a menores. A troca registrada no backlog de 12/11/2026 (sem documento nem biometria, que seriam dado sensível):
  a **triagem humana da entrada** (`alumia_entrada`: uma pessoa lê o pedido e pode conversar antes de aprovar) vale como aferição reforçada, somada à autodeclaração; e a **denúncia de menor retém a conta por
  precaução** até a mediação ver (`20261114-alumia-o8-lei.sql`: `interno.alumia_lei_reter_menor`, sanção sem pessoa em `alumia_sancoes`, prazo de 24 h na fila, decisão em `alumia_lei_menor_decidir`).
  Contra o abuso do canal (art. 33): só membro retém, no máximo duas retenções por quem denuncia a cada 30 dias, nunca sobre a equipe, e quem foi liberado não é retido de novo por 90 dias.
  **Ponto de revisão jurídica antes de ligar para todos** (se a triagem humana basta como aferição).
- **Arts. 28 a 30 e 33**: canal de denúncia, retirada sem ordem judicial após notificação identificável, devido processo e procedimento contra abuso do canal: veja `docs/rede/MODERACAO.md`, seção 8.

## 5. Marco Civil (Lei 12.965/2014) e o STF

- **Art. 15**: registros de acesso a aplicações de internet. A Rede não grava registros de acesso.
- **Art. 19 e art. 21; Temas 987 e 533 do STF**: notificação, devido processo, canal permanente. Cumprido por denúncia com protocolo, fila, registro, aviso e recurso (`docs/rede/MODERACAO.md`).
- **Código Penal, arts. 138 a 140** (calúnia, difamação, injúria): têm categoria de denúncia (`assédio`, `ódio`, `outro`) e recurso com contraditório; a retirada por notificação é possível, a
  responsabilização segue a Justiça.

## 6. Direitos de quem é moderado

Aviso com a **regra** e o **motivo**; saber se a decisão foi de uma **pessoa** ou automática; **recurso em até 30 dias**, revisto por **outra** pessoa; decisão final registrada; reversão que desfaz o
efeito (post volta, banimento sai) e deixa de contar contra o nível de confiança.

## 7. Pendências para a assessoria jurídica

1. Aferição de idade (ECA Digital, art. 9º, § 1º) antes de abrir para todos.
2. Retenção do registro de moderação e da conta de quem denunciou depois do encerramento.
3. Guarda de registros de acesso (Marco Civil, art. 15): resolvida em 13/11/2026 (não se aplica; nada é guardado).
4. Relatório anual de transparência sobre notificações (tese do STF): os números saem do registro; falta o formato.

## 8. Contagens na vitrine das comunidades (T32, 07/11/2026)

O Jonathan pediu contagens na vitrine (`/comunidade/comunidades`) para ela não parecer 77 cartões iguais. A decisão antiga era
"nenhuma contagem de membros", porque estar numa comunidade de luta pode revelar opinião política (dado sensível, LGPD, art. 5º,
II e art. 11). As duas coisas cabem juntas assim:

- Só **atividade da semana**, nunca membros: quantos posts e quantas pessoas escreveram ali nos últimos 7 dias. Quem só lê não
  conta em lugar nenhum.
- **Agregado e anônimo**: nenhum nome, nenhuma lista, nada por pessoa. Pessoas só aparecem a partir de 3; abaixo disso, a tela
  diz "poucas pessoas" (o banco devolve nulo), para que "1 pessoa" não aponte alguém (minimização, art. 6º, III).
- Visitante vê, das lutas e do Instituto, só nome, descrição e regras, sem contagem e sem post; a página da luta continua fechada
  para quem não tem conta.
- A ordem é pública e escrita na tela: mais posts na semana primeiro, depois alfabética. Sem algoritmo.

## 9. Inventário conferido nas migrações

Base da página `/alumia/o-que-guardamos` e da política `/alumia/privacidade`. Conferido lendo `supabase/install.sql`
e `20261114-alumia-o8-lei.sql`; o que não está aqui a Alumia não guarda.

| Dado | Onde (tabela) | Quanto tempo | Quem lê |
| --- | --- | --- | --- |
| E-mail, resumo da senha, segredo do autenticador | serviço de contas (`auth.users`, fatores) | até apagar a conta | coordenação (e-mail); ninguém (o resto) |
| Codinome, @, bio, foto, modo público | `perfis` (`rede_*`), `rede_perfil_campos` | até trocar ou apagar | quem pode ver o perfil |
| Motivo do pedido e da decisão | `alumia_entrada` | 30 dias depois da decisão (`alumia_entrada_faxina`) | triagem |
| Idade declarada, consentimento, aceite dos termos | `perfis.rede_18`, `rede_consentimentos`, `alumia_termos_aceites` | enquanto a conta existir (cascata) | a pessoa e a coordenação |
| Posts, respostas, mídia sem EXIF | `rede_posts`, `rede_midia`, `rede_audios` | até apagar | o público do post |
| Reações, salvos, pastas, buscas salvas | `rede_reacoes*`, `rede_salvos`, `rede_alumia_pastas*`, `rede_alumia_buscas_salvas` | até desfazer | só a pessoa; totais a partir de 3 |
| Stories | `rede_stories` | 24 h (destaque ou prova de denúncia seguram) | público do story; sem registro de quem viu |
| Rascunhos na conta | `rede_rascunhos` (cifrados no aparelho) | 30 dias sem mudança | só a pessoa |
| Chat | `rede_dm_*` | prazo da conversa; pedido sem resposta 30 dias | só quem participa (texto); o servidor sabe quem está na conversa |
| Avisos | `avisos` | lidos 30 dias; todos 120 dias | só a pessoa |
| Push | `rede_push_assinaturas` | até desligar | ninguém |
| Denúncias (com `responder_ate`) | `rede_denuncias` | até encerrar e passar o recurso | mediação (a conta de quem denunciou, só a própria pessoa) |
| Registro de moderação | `rede_moderacao` (só inserção) | não se apaga (revisão jurídica) | mediação; regra e motivo ao moderado |
| Recursos (com `responder_ate`, 7 dias) | `rede_recursos` | junto do registro | mediação; a decisão a quem pediu |
| Retenção por precaução | `alumia_lei_retencoes` + `alumia_sancoes` | até a decisão; depois junto do registro | mediação e coordenação; a pessoa vê a situação |
| Impressão HMAC da rede | `alumia_impressoes`, `alumia_impressao_banidas` | 30 dias sem uso; banimento até 90 dias | ninguém (só comparação) |
| Contadores de uso | `limites` | 2 dias | ninguém |
| Registro de ações | `auditoria` (via `interno.registrar`) | 400 dias | coordenação |
| Registro do painel | `alumia_painel_registro` (só inserção) | não se apaga | coordenação e admin |

Acrescentado depois (conferido em `20261114-alumia-o8-{conta,porta,meusdados,operacao}.sql`):

| Dado | Onde (tabela) | Quanto tempo | Quem lê |
| --- | --- | --- | --- |
| Códigos de recuperação do segundo fator | `codigos_recuperacao` (só o resumo bcrypt) | até gerar outros; cada um vale uma vez | ninguém |
| Aviso de entrada nova (navegador, sistema, dia e hora; nunca o endereço) | `avisos` | como os outros avisos | só a pessoa |
| Convites gerados (resumo do código, prazo, situação; nunca quem usou) | `alumia_convites` | 45 dias (`alumia_cadastro_faxina`) | só quem gerou |
| Marca "veio por convite" | `alumia_convite_pedidos` | até a triagem decidir | triagem (sem saber de quem) |
| Freio do cadastro por rede (resumo por hora, nem a impressão do painel) | `alumia_cadastro_freio` | 1 dia | ninguém (só contagem) |
| Desafios usados e passes do pedido | `alumia_cadastro_gastos`, `alumia_cadastro_passes` | até vencerem (10 e 30 minutos) | ninguém |
| Números da porta por hora | `alumia_cadastro_horas` (só contagens) | 8 dias | coordenação e admin |
| Pedido de apagar a conta | `alumia_apagamentos`, `alumia_apagamento_escondidos` | os 7 dias do prazo; depois a conta é apagada | a pessoa; o painel, só quantos |
| Arquivos a tirar do depósito (contas apagadas) | `alumia_arquivos_a_apagar` (só o caminho) | até o arquivo sair | ninguém |
| Horário de silêncio do push | `rede_avisos_silencio` | até mudar | ninguém (só o envio) |

Serviços de fora que recebem algum dado: hospedagem e banco (parte fora do Brasil), envio de e-mails, serviço de entrega do push
do navegador (só número cifrado), servidores do Fediverso (só se a pessoa ligar) e, quando a coordenação liga a avaliação
externa (`interno.avaliacao_externa()`), o serviço de moderação que recebe título e texto do post, sem conta nem nome.
