# Cargos múltiplos e evolução do chat — relatório de trabalho

Branch: `worktree-chat-e-cargos` (worktree em `.claude/worktrees/chat-e-cargos`, a partir de `origin/master` em `938aac6`). Nada foi publicado, nada tocou o banco de produção.

**Situação em 15/10/2026:** o Passo Zero (leitura do projeto inteiro) foi concluído. Nenhuma linha de código ou de SQL foi alterada ainda. Este arquivo é o ponto de retomada: quem continuar começa pela seção 4 (plano da Parte A).

## 1. Resumo do projeto (Passo Zero)

**O que é.** Site Next.js 16 (App Router, React 19, Tailwind 4) do Instituto Lúcia: biblioteca digital e escola popular gratuita, em cinco idiomas. O conteúdo publicado (aulas, acervo com mais de mil obras, memorial, glossário, jornal, checagens, debates, vídeos) mora em `content/` como Markdown e JSON, versionado no git; o site é estático e funciona sem banco. O banco (Supabase) é só apoio: contas, equipe, fila de contribuições, comunidade, mural, reforço, rádio, podcast, horas e certificados, e as conversas cifradas da equipe.

**Organização.**
- `app/[lang]/` páginas públicas (acervo, trilhas, comunidade, jornal, rádio, podcasts, mural, ferramentas, voluntários, painel…); `app/api/` consultas a serviços abertos feitas no servidor.
- `components/` peças do site; `components/painel/` o painel da equipe (só em português): Mesa, Conversas, Mural da equipe, Escrever, filas, Comunidade, Reforço, Pessoas, Horas, Podcast, Segurança, Registro, Minha conta.
- `lib/` utilidades. Para esta tarefa: `backend.ts` (cliente Supabase, `rpc`, `Me`, `can`, `leads`), `sigilo.ts` (cifra: ECDH P-256 + HKDF + AES-GCM, formatos `c2.`/`w1.`), `chaveiro.ts` (par do aparelho em IndexedDB não exportável, chaves de conversa em memória, repasse), `device.ts` (marca do aparelho para o aviso de acesso), `passkey.ts` (digital via WebAuthn do Supabase), `upload.ts` (imagens limpas no navegador → bucket `envios`).
- `supabase/install.sql` (6.138 linhas) é o banco inteiro, idempotente: tabelas no esquema fechado `interno`, RLS ligado sem regra alguma, toda entrada por funções `security definer` em `public` que conferem permissão. `supabase/functions/` tem duas Edge Functions (moderação da comunidade, transcrição do podcast).
- `scripts/`: `banco-local.mjs` (Postgres em memória via PGlite com o install.sql aplicado), `backend-local.mjs` (substituto local do Supabase, contas `coord@local`, `vice@local`, `prof@local`…), `testar-banco.mjs` (1.509 linhas de testes de permissão e fluxo, roda no CI), `testar-sigilo.mjs` (cifra sem banco), `testar-fumaca.mjs`, `testar-podcast.mjs`, `testar-emails.mjs`, `testar-moderacao.mjs`.
- CI (`.github/workflows/ci.yml`): lint, typecheck, i18n, todos os `testar:*`, build. Deploy pela Vercel a partir do `master`; publicação de conteúdo aprovado por rotina de hora em hora com a chave `service_role` só em segredos do GitHub.
- Variáveis de ambiente (só nomes): `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_VIDEO_HOSTS`, `NEXT_PUBLIC_AUTH_GOOGLE`, `GOOGLE_FACTCHECK_KEY`; nos segredos das rotinas: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`; na função de moderação: `OPENAI_API_KEY`, `GOOGLE_SAFE_BROWSING_KEY`.

**Como os cargos funcionam hoje (achado central).** A premissa "cada pessoa tem um cargo só" **não se confirma no banco**: a tabela `interno.papeis` já é muitos-para-muitos (uma linha por papel, com `disciplina`, `concedido_por`, `criado_em`, índice único por pessoa + papel + disciplina). `interno.tem(papel)` já responde "sim" se **qualquer** linha da pessoa bate, ou seja, as permissões já são a união dos papéis. `eu()`, `voluntarios_listar`, `equipe_membros` devolvem `papeis` como lista; a tela Pessoas mostra os papéis como etiquetas com adicionar (busca de pessoa) e remover; a Mesa e a lista da equipe mostram todos. Os grupos de departamento já acompanham os papéis por gatilho (`lucia_departamentos` → `departamentos_sincronizar`), e sair de um grupo já troca a chave (`chat_retirar` → `chat_trocar_chave`). O registro de atividades (`auditoria`) e o livro do acervo (`audit_logs`, gatilho em `papeis`) já anotam cada papel dado ou tirado.

Papéis existentes: `coordenacao`, `vice`, `curadoria`, `mediacao`, `educacao`, `educacao_secundaria` (vale como educação), `revisao`, `traducao`, `jornalismo`, `mentoria`, `design`, `marketing` (vale como design), `desenvolvimento`. **Não existe cargo "supervisor"**: "supervisão" é só uma tarefa do podcast (`interno.podcast_funcoes`, valores `producao`/`edicao`/`supervisao`), dada pela coordenação.

**O que de fato falta para a Parte A (lista levantada na leitura):**
1. Histórico de remoção: hoje remover é `delete`; só os registros de auditoria guardam quem tirou. Falta uma tabela de histórico com quem atribuiu, quando, quem removeu e quando.
2. Hierarquia: `papel_conceder`/`papel_remover` só impedem a vice de nomear ou tirar vice/coordenação. A vice pode tirar um papel de trabalho do próprio coordenador. Não há "nível" formal.
3. "Supervisor" não existe (ver Decisões pendentes).
4. `candidatura_decidir`, `inscricao_decidir`, `convite_criar` e `lucia_conta_nova` também concedem papéis e precisam das mesmas regras de nível.
5. Interface: quem já tem um papel **não consegue pedir outro** pelo painel (o cartão "Quero ser voluntário" só aparece com zero papéis, `Painel.tsx` Mesa). O menu lateral mostra os papéis juntos (`funcao`); crachá por papel não existe no site público.
6. Testes: `testar-banco.mjs` tem casos com um papel só (`papeis[0]`), e nenhum caso de pessoa com vários papéis, nem de tentativa de dar cargo acima do próprio.
7. `pessoas_buscar` e `voluntarios_listar` devolvem e-mail: se um novo papel passar a gerir cargos, o e-mail precisa continuar só com a coordenação.

**Lugares que leem papel (para a revisão pedida):** `interno.tem`, `coord`, `lider`, `curador`, `cuida`, `media`, `radialista`, `media_mural`, `mentor`, `envia`, `voluntario`, `da_equipe`, `no_departamento`, `ve_canal`, `ve_fila`, `contribuir` (campo `como`, pega o primeiro que bate: por desenho), `certificado_abrir` (`min(disciplina)` do educador), `podcaster`/`podcast_pode`/`podcast_equipe`, `avisar_lideranca`, `email_lideranca`, `seguranca_ver`, `sucessao_conferir`, `lideranca_passar`, `promover_coordenacao`, `public.equipe()`; políticas de storage (`radio`, `envios`, `podcast`, `podcast-producao`) chamam essas funções. No site: `lib/backend.ts` (`can`, `leads`, `equivale`), `Painel.tsx` (seções), `Pessoas.tsx`, `Convites.tsx`, `Comecar.tsx`, `Horas.tsx` (educador que assina: `papeis.find`), `Equipe.tsx`, `Conversas.tsx` (NovoGrupo por função), `podcast/*`. Todos já tratam `papeis` como lista; nenhum depende de haver um só.

**Chat (o que existe, confirmado no código):** aparelhos ECDH em `chat_aparelhos` (só a pública), versões por conversa em `chat_versoes`, embrulhos por aparelho em `chat_chaves` (contexto amarra conversa + versão + aparelho), mensagens `c2.<versão>.<iv>.<cifrado>` amarradas a conversa + versão + autor via AAD, troca de versão ao sair alguém ou remover aparelho, repasse de chaves por quem está com o painel aberto (`chat_chaves_pendentes`/`chat_chaves_dar`), autodestruição, lido na privada, online/visto por último, grupos por departamento, mural da equipe cifrado com a chave do grupo do departamento. Limite já documentado no guia: quem tem `service_role` pode registrar um aparelho falso e receber as chaves das mensagens seguintes. É exatamente o buraco que a Etapa 1 da Parte B fecha (assinatura da chave pública do aparelho novo por um aparelho aprovado).

**Riscos e coisas estranhas notadas.**
- `chat_aparelho_registrar` aceita qualquer pública nova sem prova de posse (não há desafio assinado): além do servidor, um cliente malicioso com a sessão da pessoa cadastra aparelhos à vontade. A Etapa 1 resolve com cadeia de assinaturas.
- `chat_chaves_dar` aceita embrulho de qualquer aparelho que tenha a versão para qualquer aparelho de membro: sem assinatura de identidade, um aparelho "fantasma" registrado pelo servidor recebe tudo.
- Mensagens não têm assinatura do autor: o AAD impede troca de autor no banco, mas não prova quem escreveu (quem tem a chave do grupo pode forjar uma mensagem em nome de outro membro do grupo).
- A chave de uma conversa só muda quando alguém sai: sem rotação periódica, um aparelho comprometido lê 30 dias de histórico.
- `papeis_unico` usa `coalesce(disciplina, '')`: dar o mesmo papel duas vezes é silencioso (`on conflict do nothing`), bom para idempotência.
- A troca de senha no painel não pede a senha atual (já apontado na auditoria anterior, S5).
- O teste de fumaça e `backend-local.mjs` semeiam contas com um papel cada; servem de base para os casos de vários papéis.
- A memória do projeto diz que outras sessões podem estar editando o mesmo checkout: por isso o trabalho está num worktree.

## 2. Mapa curto do que existe

| Área | Tabelas (`interno.`) | Funções principais (`public.`) | Onde a tela chama |
| --- | --- | --- | --- |
| Pessoas e papéis | `perfis`, `papeis`, `candidaturas`, `inscricoes`, `convites`, `convites_usos`, `sucessao`, `auditoria`, `audit_logs` | `eu`, `papel_conceder`, `papel_remover`, `usuario_suspender`, `voluntarios_listar`, `pessoas_buscar`, `candidatura_decidir`, `inscricao_decidir`, `convite_criar`, `lideranca_passar`, `promover_coordenacao`, `equipe_membros`, `equipe` | `Pessoas.tsx`, `Convites.tsx`, `Lideranca.tsx`, `Painel.tsx` |
| Conversas | `conversas`, `conversa_membros`, `conversa_mensagens`, `chat_aparelhos`, `chat_versoes`, `chat_chaves`, `equipe_mensagens` | `chat_*` (conversas, direta, grupo_*, ver, enviar, apagar, aparelho_*, chaves, chave_nova, chaves_pendentes, chaves_dar, chaves_recusar, autodestruir), `presenca`, `equipe_*` | `Conversas.tsx`, `Equipe.tsx`, `Sigilo.tsx`, `lib/chaveiro.ts`, `lib/sigilo.ts` |
| RLS | todas as tabelas de `interno` com RLS ligado e sem política (ninguém lê direto); storage com políticas que chamam `interno.*` | — | — |

Fluxo de chave hoje: aparelho A cria versão N → embrulha para cada aparelho dos membros (ECDH A↔X, HKDF com contexto `embrulho:<conversa>:<versão>:<aparelho X>`) → `chat_chave_nova`. Aparelho novo Y de um membro → qualquer aparelho com o painel aberto vê em `chat_chaves_pendentes` que Y não tem a versão → embrulha e entrega (`chat_chaves_dar`). Saída de membro ou remoção de aparelho → `versao_minima` sobe → próxima mensagem cria versão nova.

## 3. Hierarquia adotada (interpretação mais restritiva)

| Nível | Papéis |
| --- | --- |
| 4 | `coordenacao` |
| 3 | `vice` |
| 2 | `supervisao` (novo; ver Decisões pendentes) |
| 1 | todos os papéis de trabalho (`curadoria`, `mediacao`, `educacao`, `educacao_secundaria`, `revisao`, `traducao`, `jornalismo`, `mentoria`, `design`, `marketing`, `desenvolvimento`) |

Regras: o nível de uma pessoa é o maior nível entre os papéis dela. Quem gere cargos (`coordenacao`, `vice`, `supervisao`) só concede papel de nível **menor** que o próprio e só mexe nos cargos de pessoa de nível **menor** que o próprio; a coordenação, por ser o topo, mexe em todos (respeitando `ultima_coordenacao`). Ninguém mexe nos próprios cargos por esse caminho. As restrições já existentes continuam valendo por cima (só a coordenação nomeia vice; só o coordenador confia curadoria por convite e candidatura).

## 4. Plano da Parte A (a executar, nesta ordem, cada passo com commit)

1. **SQL aditivo** em `install.sql`: `interno.nivel(papel)`, `interno.nivel_de(usuario)`, `interno.gere_cargos()`; papel `supervisao` nos `check` de `papeis`, `candidaturas`, `inscricoes`, `convites`, em `nome_papel` e no grupo de departamento; tabela `interno.papeis_historico` (pessoa, papel, disciplina, concedido_por, concedido_em, removido_por, removido_em) preenchida por gatilho em `papeis` e **semeada uma vez** com as linhas atuais de `papeis` (migração sem perder ninguém, idempotente); regra de nível em `papel_conceder`, `papel_remover`, `candidatura_decidir`, `inscricao_decidir`, `convite_criar`; e-mail em `voluntarios_listar`/`pessoas_buscar` só para `coord()`; função `papeis_historico_listar` para a coordenação.
2. **Site**: `Role["papel"]` e `papeis`/`oQueFaz` ganham `supervisao`; `can` reconhece `supervisao` para a seção Pessoas (só as abas Pessoas e Confiar função); Mesa passa a oferecer "Pedir outra função" a quem já tem papel; nomes das funções com "+N" onde só cabe uma (menu lateral do celular).
3. **Testes** em `testar-banco.mjs`: pessoa com 0, 1 e 3 papéis (soma de permissões conferida em `fila`, `reforco_fila`, `equipe_canais`, grupos de departamento); vice tentando tirar papel do coordenador (falha); supervisão tentando dar vice/supervisão (falha) e dando revisão (passa); histórico com quem tirou; `testar-fumaca.mjs` ganha uma conta com dois papéis.
4. Guia de manutenção (`docs/MANUTENCAO.md`): seção Papéis atualizada com a hierarquia e o histórico.

## 5. Plano da Parte B (resumo; detalhar na retomada)

- **Etapa 1 (confiança):** por aparelho, além do par ECDH, um par ECDSA P-256 de assinatura; o primeiro aparelho da conta é a identidade; aparelho novo exibe código de 6 dígitos (ou QR) que um aparelho aprovado digita e, com isso, assina a pública do novo; `chat_aparelhos` ganha `assinatura`, `assinado_por`, `identidade`; `chat_chaves_dar`, `chat_chave_nova` e o cliente só embrulham para aparelho com assinatura válida verificada **no cliente** (o servidor não é confiado); código de segurança de 60 dígitos derivado das duas identidades; aviso de mudança de identidade; assinatura por mensagem (`s1.` dentro do corpo cifrado); rotação por tempo/quantidade; cópia cifrada das chaves com chave de recuperação mostrada uma vez. Migração: o aparelho ativo mais antigo vira identidade e assina os outros na primeira abertura, com aviso. Recomendação prevista: Double Ratchet nas privadas e MLS nos grupos só com biblioteca auditada, fora do escopo.
- **Etapas 2 a 4:** mensagens (citar, reagir, editar 15 min, encaminhar, tiques, lida por, digitando, menções, formatação, rascunho, fixar, favoritar, seleção múltipla, prévia de link no aparelho), mídia cifrada por arquivo (bucket só com bytes ilegíveis), organização e grupos (busca local, arquivar, silenciar, filtros, administradores, enquetes, eventos, notificações sem prévia, bloqueio por digital, denúncia com reenvio decifrado pela própria pessoa).

## 6. Decisões pendentes (dependem de você)

1. **"Supervisor" não existe como cargo.** Plano: criar o papel `supervisao` (nível 2) só com o poder de confiar e retirar papéis de trabalho, sem ver e-mails, sem outras ferramentas. Alternativa: não criar e deixar só coordenação e vice gerindo cargos. Escolhido o caminho reversível (apagar as linhas e o valor do `check` desfaz).
2. **Autogestão de cargos:** pelo plano, ninguém tira o próprio papel (nem a vice o próprio). Se quiser permitir sair de um papel, é uma função nova e explícita.
3. **E-mails na gestão de pessoas:** se a supervisão puder confiar papéis, a busca de pessoas devolve só nome para ela. Confirmar se está bom.

## 7. Como retomar

```bash
git -C .claude/worktrees/chat-e-cargos status
npm run testar:banco
npm run testar:sigilo
```

Depois, seguir a seção 4, passo 1 (SQL), rodando `npm run testar:banco` a cada mudança.
