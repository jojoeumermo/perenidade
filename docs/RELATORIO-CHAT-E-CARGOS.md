# Cargos múltiplos e evolução do chat — relatório final

Branch: `worktree-chat-e-cargos` (worktree em `.claude/worktrees/chat-e-cargos`, a partir de `origin/master` em `938aac6`). **Nada foi publicado, nada tocou o banco de produção.** Todo o trabalho rodou contra o banco em memória (`scripts/banco-local.mjs`) e o servidor local de teste (`scripts/backend-local.mjs`), com contas falsas.

Commits, na ordem: `14b691a` (Passo Zero), `fb4eeb0` (Parte A: cargos), `1f41971` (Etapa 1: confiança), `6fa01df` (Etapa 2: mensagens), `653fbaa` (Etapa 3: mídia), `5db97c2` (Etapa 4: organização e grupos).

Testes no fim: `testar:banco` 906 conferências, `testar:sigilo` 60, `testar:mensagens` 24, `testar:anexos` 24, `testar:fumaca` 76, `lint` e `typecheck` limpos. Tudo isso roda no CI (`.github/workflows/ci.yml`).

## 1. Resumo do projeto

**O que é.** Site Next.js 16 (App Router, React 19, Tailwind 4) do Instituto Lúcia: biblioteca digital e escola popular gratuita, em cinco idiomas. O conteúdo publicado (aulas, acervo, memorial, glossário, jornal, checagens, debates, vídeos) mora em `content/` como Markdown e JSON, versionado no git; o site é estático e funciona sem banco. O banco (Supabase) é só apoio: contas, equipe, fila de contribuições, comunidade, mural, reforço, rádio, podcast, horas e certificados, e as conversas cifradas da equipe.

**Como o banco é protegido.** `supabase/install.sql` é o banco inteiro, idempotente (roda quantas vezes for preciso): todas as tabelas no esquema fechado `interno`, RLS ligado sem política nenhuma (ninguém lê tabela direto), e toda entrada por funções `security definer` em `public` que conferem permissão. O site chama só essas funções (`lib/backend.ts`, `rpc`).

**Como o chat era antes deste trabalho.** Cada aparelho tem um par ECDH P-256 (chave privada não exportável, guardada no IndexedDB do navegador). Cada conversa tem uma chave AES-GCM-256, embrulhada para cada aparelho de cada membro. As mensagens vão cifradas (`c2.<versão>.<iv>.<cifrado>`) e o banco só vê o cifrado. Quando alguém sai, a chave troca. **Buraco que existia:** o banco (ou quem tiver a chave `service_role`) podia registrar um "aparelho fantasma" em nome de uma pessoa e os colegas entregariam as chaves a ele, porque ninguém conferia de quem era o aparelho.

**Como os cargos eram.** A premissa "um cargo por pessoa" não se confirmava: `interno.papeis` já era muitos-para-muitos e as permissões já eram a soma dos papéis. O que faltava: hierarquia formal de quem pode dar e tirar o quê, um cargo de supervisão, histórico com quem tirou e quando, pedir outra função pela tela, e testes com vários papéis.

## 2. O que foi feito

### Parte A: cargos múltiplos (commit `fb4eeb0`)

- **Hierarquia no banco** (`interno.nivel`, `nivel_de`, `gere_cargos`, `pode_conceder`, `pode_mexer`): coordenação 4, vice 3, supervisão 2, papéis de trabalho 1. Quem gere cargos só dá papel de nível **menor** que o próprio e só mexe em pessoa de nível **menor** que o próprio; ninguém mexe nos próprios cargos; a coordenação mexe em todos (respeitando a regra da última coordenação). Vale em `papel_conceder`, `papel_remover`, `candidatura_decidir`, `inscricao_decidir` e `convite_criar`, ou seja, no servidor.
- **Cargo novo `supervisao`** (nível 2): confia e retira papéis de trabalho, vê a lista de pessoas sem e-mail, e nada mais.
- **Histórico** `interno.papeis_historico` (quem deu, quando, quem tirou, quando, por qual caminho), preenchido por gatilho e semeado com os papéis atuais; `papeis_historico_listar` para a coordenação; a tela Pessoas mostra o histórico de cada pessoa.
- **Tela:** etiquetas de função com adicionar e tirar, só o que o meu nível permite; "+N" onde cabe um nome só; "Pedir outra função" na Mesa para quem já tem papel; os grupos de departamento seguem todos os papéis (já era assim; conferido por teste).
- **Testes:** pessoa com 0, 1 e 3 papéis; vice tentando tirar papel do coordenador (falha no servidor); supervisão dando vice (falha) e revisão (passa); histórico com quem tirou.

### Etapa 1: confiança entre aparelhos (commit `1f41971`)

- **Identidade por conta** (par ECDSA P-256), criada no primeiro aparelho que abrir o painel. Cada aparelho tem um **certificado**: a chave pública ECDH dele assinada pela identidade. Os colegas guardam a identidade de cada pessoa na primeira vez que a veem (como o Signal) e **só embrulham chaves para aparelho com certificado válido, conferido no próprio aparelho**, não no servidor. O servidor também recusa aparelhos sem certificado (defesa em profundidade), mas a garantia real é a conferência no cliente: mesmo que o banco minta, os colegas não entregam chave a um aparelho que a identidade da pessoa não assinou.
- **Aprovação de aparelho novo:** o novo mostra um código de 8 dígitos e um QR; um aparelho já aprovado da mesma pessoa lê o QR (ou digita o código) e assina. O pedido fica selado com o código (PBKDF2 300 mil iterações + AES-GCM) e expira em um dia. A identidade vai para o aparelho novo embrulhada por ECDH (nunca em claro).
- **Código de segurança** de 60 dígitos (derivado das duas identidades), com QR, e o botão "verificado"; **aviso "o código de segurança mudou"**, e, se a pessoa tinha verificado, as chaves ficam retidas até ela confirmar.
- **Assinatura por mensagem** (ECDSA sobre conversa + versão + texto, dentro do cifrado): mensagem forjada em nome de outra pessoa aparece como "não foi possível verificar o autor".
- **Rotação periódica** da chave da conversa (7 dias ou mil mensagens). Recomendação, sem implementar: Double Ratchet nas privadas e MLS nos grupos, só com biblioteca auditada (nenhuma primitiva foi inventada: tudo é WebCrypto).
- **Cópia de recuperação** cifrada no aparelho com uma chave de 32 letras mostrada uma única vez; "Recomeçar a identidade" para quem perdeu tudo (os colegas veem o aviso).
- **Migração:** conta sem identidade: o primeiro aparelho que abrir as conversas cria a identidade e aprova sozinho os outros aparelhos antigos da conta (que já estavam registrados), avisando a pessoa para conferir a lista e remover o que não reconhecer. Daí em diante, todo aparelho novo passa pela aprovação com código ou QR. Guia: `docs/MANUTENCAO.md`, seção "Conversas e Mural da equipe".

### Etapa 2: mensagens (commit `6fa01df`)

Responder citando (tocar na citação leva até ela), reações com quem reagiu, editar até 15 minutos ("Editada"), encaminhar ("Encaminhada"), tiques enviada/entregue/lida e "Lida por" nos grupos, "digitando…"/"gravando áudio…", esconder "visto por último" e confirmação de leitura (recíproco, cortado no servidor), @menções com destaque e marca "@" na lista, formatação `*negrito*` `_itálico_` `~tachado~` `` `mono` `` e listas (vira elementos do React, nunca HTML), rascunho por conversa no aparelho, fixar (até cinco por conversa) e favoritar, seleção múltipla para apagar ou encaminhar, **prévia de link feita só do endereço, no aparelho de quem envia** (a política de segurança do site não deixa o navegador buscar outros sites e o servidor nunca busca o link). Citação, encaminhada, menções, prévia e emoji viajam **dentro do cifrado**; o banco só vê o tipo (`texto`, `reacao`, `edicao`) e o alvo, e garante no servidor a janela de edição, uma reação por pessoa e o limite de fixadas.

### Etapa 3: mídia (commit `653fbaa`)

Foto, vídeo, áudio, PDF e DOCX, **cada arquivo cifrado no aparelho com uma chave só dele** (AES-GCM, presa à conversa); a chave, o vetor e o SHA-256 do conteúdo vão dentro da mensagem assinada. O banco guarda só bytes cifrados, tamanho e dono (nem tipo, nem nome). O tipo é descoberto pelos primeiros bytes, nunca pela extensão; HTML, executável e o resto são recusados. Fotos são redesenhadas (somem os dados da câmera) e têm cortar, desenhar e borrar (o borrão reduz a blocos; não volta). Áudio: segurar para gravar, travar, ouvir antes de enviar, forma de onda calculada no aparelho, 1,5× e 2×. PDF abre no leitor do navegador; DOCX é convertido no aparelho (`mammoth`) e mostrado num quadro isolado sem permissão nenhuma. Ctrl+V e arrastar. "Ver uma vez": quem enviou não relê, cada pessoa abre uma vez, o banco apaga os bytes quando todos abriram. Galeria por conversa. Limites de 12 MB por arquivo e seis por mensagem, no aparelho e no banco. **Sem transcrição** (ver decisões).

### Etapa 4: organização e grupos (commit `5db97c2`)

Fixar no alto, arquivar, silenciar (8 h, 7 dias, sempre), marcar como não lida, trancar com a digital; filtros Todas/Não lidas/Grupos/Fixadas e a aba Arquivadas; **busca com índice só no aparelho** (IndexedDB + MiniSearch, apagado ao sair da conta); **avisos do navegador sem prévia** (nenhum, "chegou mensagem" ou "chegou mensagem de Fulana"), sem serviço de push; **trava com a digital** reaproveitando a chave de acesso já cadastrada, ao abrir as conversas e nas conversas trancadas uma a uma; grupos com **administradores e permissões** ("só administradores mudam nome, descrição e foto", "só administradores mandam mensagem"), conferidas no servidor; descrição e **foto do grupo** (uma mensagem cifrada); **avisos do sistema** ("Fulana entrou", "mudou o nome"…); **enquetes** e **eventos com vou/talvez/não**, tudo dentro do cifrado, um voto e uma resposta por pessoa; **relato à coordenação** com as mensagens que a própria pessoa escolhe e abre no aparelho dela.

### Ajustes pedidos depois (16/10/2026)

- **Disciplina nova "Edição de vídeo"** (`edicao-de-video`, nos cinco idiomas).
- **Consenso antes de ir ao ar:** aula (e material avulso) só é aprovada com parecer favorável de outro educador da mesma disciplina; se não houver outro educador, vale o parecer da supervisão, vice ou coordenação. Quem aprova por fim precisa ser uma terceira pessoa (nem o autor, nem quem deu o parecer). Conferido no servidor (`interno.consenso_de_aula`, erro `sem_consenso`). Recusar não exige consenso.
- **Privado só para trabalho:** conversa privada só com coordenação, vice ou supervisão, ou entre quem colabora numa contribuição em andamento (`interno.privado_permitido`, erro `privado_fechado`). Coordenação, vice e supervisão conversam com todos. A coordenação vê quem está em privado (`chat_privadas`, botão 👥), nunca o conteúdo. Conversas privadas que já existiam continuam abertas.
- **Nomes e e-mails:** no painel, cada pessoa vê as outras só pelo primeiro nome (`interno.nome_visto`); nome completo e e-mail, só a coordenação (nem a vice nem a supervisão).
- **Representante do departamento** (papel `representante`, nível 1, com o departamento no campo da disciplina): nomeado pela coordenação, vice ou supervisão; entra no grupo do departamento e o administra (descrição, foto, "só administradores mandam mensagem"), sem dar nem tirar funções. Quem entra e sai do grupo continua sendo decidido pelas funções.
- **Auditoria rápida:** todas as suítes passam (`testar:banco` 921, `testar:fumaca` 76 com as seções de cada função, `testar:podcast` 98, `testar:emails` 19, `testar:moderacao` 30, `testar:sigilo` 60, `testar:mensagens` 24, `testar:anexos` 24), mais lint, typecheck, traduções e build.
- **Manual do painel:** `docs/manual-do-painel.html`, publicado também como Artifact.

## 3. Mudanças no banco e como desfazer cada uma

Tudo está em `supabase/install.sql`, **aditivo e idempotente**: rodar o arquivo inteiro de novo cria o que falta e troca as funções, sem apagar dado nenhum. Nenhuma migração apaga ou altera dados existentes; as únicas escritas em dados existentes são (a) semear `papeis_historico` com os papéis atuais (só insere) e (b) marcar como administrador quem criou cada grupo existente (`update conversa_membros set admin = true` onde `criada_por` bate).

| O quê | Objetos | Como desfazer |
| --- | --- | --- |
| Cargo `supervisao` | valor novo nos `check` de `papeis` e `convites`; funções `interno.nivel*`, `gere_cargos`, `pode_conceder`, `pode_mexer` | `delete from interno.papeis where papel = 'supervisao';` e voltar `install.sql` do master (as funções são `create or replace`) |
| Histórico de cargos | tabela `interno.papeis_historico`, gatilho `lucia_papeis_historico`, função `papeis_historico_listar` | `drop trigger lucia_papeis_historico on interno.papeis; drop table interno.papeis_historico; drop function public.papeis_historico_listar;` |
| Confiança (Etapa 1) | tabela `interno.chat_identidades`; colunas em `chat_aparelhos` (`certificado`, `aprovado_por`, `aprovado_em`, `identidade_embrulho`, `aprovado_publica`, `pedido`, `pedido_em`); tabela `interno.chat_recuperacoes`; funções `chat_aparelho_pedir/estado/aprovar/recuperar`, `chat_identidade_definir/redefinir`, `chat_recuperacao_guardar/ler` | `drop table interno.chat_identidades, interno.chat_recuperacoes;` e `alter table interno.chat_aparelhos drop column …` para cada coluna. **Atenção:** voltar as funções antigas faz o chat voltar ao modelo sem certificado (os aparelhos continuam funcionando) |
| Mensagens (Etapa 2) | colunas `tipo`, `alvo`, `detalhe` em `conversa_mensagens`; `recebido_em`, `digitando_em`, `digitando`, `admin` em `conversa_membros`; `chat_visto`, `chat_leitura` em `perfis`; tabelas `conversa_fixadas`, `conversa_favoritas`; funções `chat_recebidas`, `chat_digitando`, `chat_fixar`, `chat_favoritar`, `chat_favoritas`, `perfil_preferencias` | `drop table` das duas tabelas e `drop column` de cada coluna (as linhas de reação/edição somem junto com `tipo`: apague antes `delete from interno.conversa_mensagens where tipo <> 'texto'`) |
| Mídia (Etapa 3) | tabela `interno.conversa_anexos`; funções `chat_anexo_enviar`, `chat_anexo_ler`; `chat_enviar` ganhou `p_anexos`; limite do corpo cifrado subiu de 4.000 para 12.000 caracteres | `drop table interno.conversa_anexos;` e as duas funções |
| Organização (Etapa 4) | tabela `interno.conversa_prefs`; colunas `descricao`, `foto`, `so_admins_enviam`, `so_admins_mudam` em `conversas`; tipos `sistema`, `voto`, `rsvp` em `conversa_mensagens`; tabela `interno.conversa_relatos`; funções `chat_conversa_marcar`, `chat_relatar`, `chat_relatos`, `chat_relato_resolver`, `interno.chat_admin`, `interno.chat_aviso` | `drop table interno.conversa_prefs, interno.conversa_relatos;` `drop column` das quatro colunas; `delete from interno.conversa_mensagens where tipo in ('sistema','voto','rsvp')` antes de voltar o `check` |
| Faxina (`interno.limpeza`) | passou a apagar pedidos de aparelho com mais de um dia, arquivos soltos com mais de uma hora, bytes de "ver uma vez" com 14 dias e relatos resolvidos com um ano | voltar a função do master |

**Migrações que alteram ou apagam dados, deixadas para você decidir:** nenhuma foi necessária. Se um dia quiser desfazer alguma etapa, os comandos acima apagam dados (por isso ficam aqui, e não no `install.sql`).

**Storage:** nada mudou nos buckets. Os arquivos das conversas ficam na tabela `conversa_anexos` (bytea), por decisão explicada na seção 6.

## 4. Modelo de ameaças atualizado

**O que o servidor (e quem tiver `service_role`) consegue ver:** quem fala com quem, quando, quanto, o tamanho de cada mensagem e arquivo, o tipo de cada linha (texto, reação, edição, voto…), nomes e descrições dos grupos, os avisos do sistema (quem entrou, quem saiu), as preferências (fixada, arquivada, silenciada, trancada), e os relatos à coordenação (por decisão de quem relata). Isso são **metadados**, e continuam visíveis.

**O que o servidor não consegue:**
- Ler mensagens, legendas, arquivos, enquetes, eventos, votos, citações, prévias de link: tudo cifrado no aparelho com chaves que nunca saem dele em claro. Conferido por teste: fora os avisos do sistema, nenhuma linha das tabelas das conversas tem texto aberto.
- **Fazer os aparelhos entregarem chaves a um aparelho falso:** cada aparelho só embrulha chave para aparelho cujo certificado é assinado pela identidade da pessoa, e a identidade é guardada no aparelho de cada colega na primeira vez que é vista. Um aparelho inventado pelo servidor não tem certificado válido; um certificado copiado de outro aparelho não bate com a chave pública. Testes: "aparelho falso registrado pelo banco não recebe chave", "certificado copiado não vale", "identidade trocada no banco gera aviso e retém chaves de quem verificou".
- Forjar mensagem em nome de alguém: a assinatura por mensagem não confere, e a tela avisa.
- Buscar links ou transcrever áudio: nada disso existe no servidor.

**O que a nova superfície adiciona e como foi tratado:** arquivos (tipo conferido pelos bytes, fotos redesenhadas, DOCX em quadro isolado, PDF no leitor do navegador, limites nos dois lados); menções e formatação (tudo vira texto/elementos, nunca HTML); relato à coordenação (texto aberto no servidor, mas só o que a pessoa escolheu, com aviso claro antes; limite de dez relatos por dia por pessoa; somem em um ano).

**Limites, ditos com franqueza:**
1. **JavaScript adulterado.** Quem controla o código que o site serve (hospedagem Vercel, repositório, DNS) pode servir um painel que rouba chaves. A cifra de ponta a ponta na web depende da integridade do site. Mitigações já existentes: CSP estrita, nada de terceiros, deploy só do `master`. Não há como resolver isso por completo sem aplicativo instalado com atualizações assinadas.
2. **Aparelho destravado.** Quem pega o aparelho aberto lê o que a pessoa lê (e o índice de busca local). A trava com a digital cobre a tela, não o disco. Não existe (nem poderia existir, sem senha a mais) cifra do IndexedDB.
3. **Metadados** continuam visíveis ao servidor, como acima.
4. **Primeiro contato (TOFU).** A identidade de um colega é aceita na primeira vez que é vista. Se o servidor trocar a identidade *antes* do primeiro contato, a pessoa precisa conferir o código de segurança pessoalmente para perceber. É o mesmo modelo do Signal e do WhatsApp; a conferência do código é o remédio.
5. **Código de aprovação de 8 dígitos.** Quem está no meio (servidor) tem um dia e PBKDF2 de 300 mil iterações contra 10⁸ possibilidades: caro, não impossível. Mitigação: o pedido expira em um dia, e a pessoa vê todos os aparelhos aprovados na conta. Se quiser mais, o QR (que carrega a chave inteira) é o caminho que dispensa o código.
6. **Sem sigilo perfeito por mensagem.** A rotação é por tempo e quantidade, não por mensagem (Double Ratchet/MLS). Um aparelho tomado lê o que a chave atual cobre (até 7 dias ou mil mensagens), não os 30 dias inteiros.
7. **Avisos do navegador** só com o painel aberto em alguma aba (sem push, por desenho).

## 5. O que você precisa fazer, na ordem

1. **Revisar a branch** `worktree-chat-e-cargos` (seis commits). Rodar na sua máquina, se quiser conferir: `npm ci && npm run lint && npm run typecheck && npm run testar:banco && npm run testar:sigilo && npm run testar:mensagens && npm run testar:anexos && npm run testar:fumaca`.
2. **Testar na tela, em ambiente local** (`npm run dev:local` sobe o site com o banco em memória e as contas de teste): abra `http://localhost:3100` e `http://127.0.0.1:3100` como duas pessoas (contas `*@local`, qualquer senha, segundo fator `123456`) ou como dois aparelhos da mesma pessoa, e passe pela aprovação de aparelho, mensagens, arquivos e grupos.
3. **Decidir as pendências da seção 6.**
4. **Aplicar o banco:** no SQL Editor do Supabase, rodar `supabase/install.sql` inteiro (é idempotente). Ele cria o que falta e troca as funções. Faça um backup antes (Database → Backups). Nenhuma linha é apagada.
5. **Juntar ao `master`** (abrir PR da branch) e deixar a Vercel publicar.
6. **Primeira abertura depois de publicar:** o primeiro aparelho que cada pessoa abrir cria a identidade dela e aprova os aparelhos antigos já registrados; ela verá na lista de aparelhos o aviso para conferir e remover o que não reconhecer. Aparelhos novos, daí em diante, pedem aprovação por código ou QR. Vale avisar a equipe antes (ver `docs/MANUTENCAO.md`, "Migração dos aparelhos de antes").
7. **Cadastrar a digital** (quem quiser a trava) em Minha conta → Entrar com a digital; só depois a opção de trancar aparece.

## 6. Decisões pendentes

1. **Cargo `supervisao`.** Criado como nível 2, só com o poder de confiar e retirar papéis de trabalho, sem e-mails. Se preferir não ter, basta não confiar o papel a ninguém (ou apagar o valor; ver seção 3).
2. **Ninguém mexe nos próprios cargos**, nem a vice no próprio. Se quiser "sair de uma função" pela tela, é uma função nova e explícita.
3. **Quem gere cargos sem ser coordenação não vê e-mails** na busca de pessoas (só nomes).
4. **Identidade = primeiro aparelho a abrir** depois da publicação. Alternativa seria exigir um ritual (todos reaprovam tudo); escolhido o caminho mais simples, com aviso.
5. **Prévia de link só do endereço.** A CSP do site proíbe buscar outros sites; fazer a prévia "de verdade" no aparelho exigiria abrir a CSP para qualquer domínio, o que enfraquece a proteção contra vazamento. Ficou: domínio e título tirados do próprio endereço.
6. **Arquivos no banco (bytea), não no Storage.** Motivo: com os arquivos presos às mensagens por chave estrangeira, apagar mensagem, autodestruição, trinta dias, "ver uma vez" e "apagar tudo" apagam os bytes com uma regra só, no servidor, sem rotina de limpeza no Storage (que exigiria a chave `service_role` ou um cliente apagando por fora). Custo: 12 MB por arquivo, seis por mensagem, trinta dias de vida; cabe no plano do Supabase para uma equipe pequena. Se o volume crescer, migrar para um bucket fechado é trocar duas funções (`chat_anexo_enviar`/`chat_anexo_ler`) por upload/download com política de storage.
7. **Sem transcrição de áudio.** A única API de reconhecimento de voz dos navegadores (Web Speech) manda o áudio ao servidor do fabricante; um modelo local (Whisper em WebAssembly) pesa dezenas de MB e não roda bem em celular fraco. Pela regra "no aparelho ou nada", ficou nada. Reavaliar se um dia houver modelo local leve.
8. **DOCX com `mammoth`.** Dependência nova (BSD, muito usada); converte no aparelho e o resultado vai para um quadro `sandbox` sem permissão. Alternativa seria mostrar só o texto. PDF usa o leitor do navegador num quadro `blob:` (foi preciso liberar `blob:` em `frame-src` na CSP).
9. **Nome e descrição dos grupos em claro** no banco (o nome já era). Cifrar exigiria chave de grupo para metadados, mudando o modelo; deixado como está, documentado como metadado.
10. **Relato à coordenação guarda texto aberto** no servidor, por decisão de quem relata, com aviso antes. Somem em um ano. Se quiser menos, mude o prazo em `interno.limpeza`.
11. **`allowedDevOrigins: ["127.0.0.1"]`** em `next.config.ts` (só desenvolvimento) para testar dois aparelhos numa máquina só.
12. **Trava com a digital** só confere a presença da pessoa (assinatura local com verificação do usuário); não há verificação no servidor, por desenho (é trava de tela).

## 7. Publicação segura

**Ordem:** (1) backup do banco; (2) rodar `install.sql` no SQL Editor; (3) juntar a branch ao `master` e esperar a Vercel; (4) abrir o painel você mesmo, ir em Conversas, criar a sua identidade e aprovar os seus outros aparelhos; (5) avisar a equipe.

Por que o banco primeiro: o site novo chama funções novas (`chat_aparelho_pedir`, `chat_anexo_enviar`…); se o site subir antes, as Conversas mostram erro até o banco ser atualizado. O contrário (banco novo, site velho) funciona: as funções antigas continuam existindo com os mesmos nomes, e o site velho ignora as colunas novas. Por isso o passo 2 vem antes do 3.

**O que testar logo depois (dez minutos):**
- Entrar com duas contas em dois aparelhos (ou duas origens). A primeira abertura cria a identidade sem erro; o segundo aparelho da mesma pessoa mostra o código e é aprovado pelo primeiro.
- Mandar uma mensagem privada, uma com foto, uma com áudio; ver chegar do outro lado com os tiques.
- Num grupo de departamento, mandar uma enquete e votar.
- Em Pessoas, confiar e tirar uma função de trabalho e ver o histórico.
- Em Minha conta, as duas caixas de privacidade e os avisos.

**Voltar atrás, se algo der errado:**
- **Site:** na Vercel, "Promote to production" o deploy anterior (ou `git revert` dos seis commits no `master`). Funciona com o banco novo, porque as funções antigas foram mantidas com os mesmos nomes e assinaturas compatíveis (`chat_enviar` e `chat_grupo_mudar` ganharam só parâmetros com valor padrão).
- **Banco:** rodar o `install.sql` do `master` anterior troca as funções de volta; as tabelas e colunas novas ficam (sem atrapalhar) até você rodar os `drop` da seção 3, se quiser.
- **Chat em especial:** se a aprovação de aparelhos travar alguém (perdeu todos os aparelhos aprovados e não tem a chave de recuperação), "Recomeçar a identidade" (na tela do aparelho pendente) tira os aparelhos antigos da conta e cria identidade nova; os colegas veem o aviso de mudança e seguem.

## Como retomar o trabalho (para quem continuar)

```bash
git -C .claude/worktrees/chat-e-cargos status
npm run testar:banco
```

Tudo está commitado; não há trabalho pela metade. O guia de manutenção (`docs/MANUTENCAO.md`, seção "Conversas e Mural da equipe" e "Papéis") descreve cada mecanismo com os nomes das funções e arquivos.
