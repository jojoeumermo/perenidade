# Alumia: chat privado (mensagens diretas)

**Situação em 7/11/2026:** implementado e testado no banco local (`npm run testar:rede-chat`). Fica no ar junto com a Alumia
(recurso `rede-v2`, ligado): não tem chave liga/desliga própria. **Falta aplicar a migração em produção**
(`supabase/migracoes/20261106-t19-rede-chat-privado.sql`, o mesmo bloco que está no fim do `supabase/install.sql`), no Supabase,
depois das migrações da Rede v2 (`2026-11-rede-*.sql`) e da Alumia (`2026-11-alumia.sql`). Nenhuma chave nova, nenhuma variável de
ambiente nova, nenhum serviço de fora.

Pedido da coordenação (T19): "o chat privado no Alumia", com "TODAS as regras de segurança possíveis", "a mesma tecnologia que já
temos no chat interno", "nada pode vazar, nem de dentro nem de fora", seguindo a LGPD.

## Onde fica

| Peça | Arquivo |
|---|---|
| Tela `/comunidade/conversas` (menu "Conversas" da casca, só para quem entrou) | `app/[lang]/comunidade/conversas/page.tsx` → `components/rede/chat/Tela.tsx` |
| Uma conversa aberta (ler, escrever, prazo, código de segurança, bloquear, denunciar, apagar) | `components/rede/chat/Conversa.tsx` |
| Denúncia com trechos escolhidos | `components/rede/chat/Denuncia.tsx` |
| Ajustes (quem pode me chamar, prazo padrão, apagar tudo do chat) | `components/rede/chat/Ajustes.tsx` |
| Botão "Mensagem privada" no perfil (`?com=@handle`) | `components/rede/perfil/TelaDoPerfil.tsx` |
| A cifra (sem navegador além do WebCrypto; roda no Node nos testes) | `lib/rede/chat-privado.ts` (usa `lib/sigilo.ts`) |
| O chaveiro deste aparelho (IndexedDB próprio, `lucia-alumia-chat`) | `lib/rede/chat-chaveiro.ts` |
| As chamadas ao banco | `lib/rede/cliente-chat.ts` |
| Textos (pt final; en, es, fr, ru, zh) carregados sob demanda | `i18n/rede/chat/*.json`, `lib/rede/textos-chat.ts` |
| Banco: tabelas, regras, permissões | `supabase/migracoes/20261106-t19-rede-chat-privado.sql` |
| Testes | `scripts/testar-rede-chat.mjs` (`npm run testar:rede-chat`) |

Componentes próprios (`components/rede/chat/`), carregados só quando a tela é aberta (`dynamic(..., { ssr: false })` no
`components/rede/registro.tsx`): não pesam nas outras páginas da Alumia e não dependem do visual que a Alumia estiver usando.

## A tecnologia (a mesma das conversas da equipe)

O chat interno da equipe (`lib/sigilo.ts`, `docs/RELATORIO-CHAT-E-CARGOS.md`, `npm run testar:sigilo`) é cifrado de ponta a
ponta com WebCrypto puro, sem biblioteca de fora. O chat da Alumia usa **as mesmas funções** de `lib/sigilo.ts`:

- **Chave do aparelho:** par ECDH P-256 criado no navegador, parte privada **não exportável** (o próprio navegador não deixa
  ler), guardada no IndexedDB.
- **Identidade:** par ECDSA P-256, também não exportável, que **assina (certifica)** a chave do aparelho. O banco guarda só as
  partes públicas e o certificado.
- **Chave da conversa:** AES-GCM-256, uma por versão, **embrulhada** (ECDH + HKDF-SHA-256 + AES-GCM) para a chave de cada um dos
  dois participantes. O embrulho é amarrado à conversa, à versão, a quem recebe e à versão da chave de quem recebe.
- **Mensagem:** assinada com a identidade de quem escreve (amarrada à conversa e ao autor) e cifrada com AES-GCM no aparelho. O
  banco recebe só `c2.<versão>.<vetor>.<cifrado>` e **recusa texto aberto** (check na tabela e na função).
- **Rotação:** versão nova da chave quando alguém troca de aparelho e, no mínimo, a cada 7 dias.
- **Confiar na primeira vez, avisar quando mudar:** o aparelho guarda a identidade de cada pessoa com quem conversou. Se ela
  mudar (troca de aparelho, ou alguém tentando se passar por ela), a conversa avisa e **não entrega chave nem envia nada** até a
  pessoa confirmar. Há **código de segurança** (o mesmo `codigoDeSeguranca` da equipe) para comparar pessoalmente e marcar como
  verificado.
- **Contextos próprios** (`alumia-dm:…`): nada assinado ou cifrado no chat da Alumia serve nas conversas da equipe, nem o contrário.

Diferenças de propósito em relação à equipe (menos comodidade, menos coisa que pode vazar):

- **Um aparelho por conta.** A identidade não é exportável: não há cópia de recuperação nem aprovação de outro aparelho. Ativar
  num aparelho novo troca a chave; o que foi escrito antes só abre no aparelho antigo.
- O "Sair rápido" da Alumia apaga o que ela guarda no `localStorage`; o chaveiro do chat (só chaves, nunca mensagens) fica, para
  não apagar sem querer o acesso às conversas. As mensagens decifradas **nunca são gravadas** no aparelho: vivem só na memória da
  aba aberta. "Apagar tudo do chat" (Ajustes) apaga também o chaveiro deste aparelho.

## As regras, todas conferidas no servidor

1. **Só entre membros da Alumia:** 18+, consentimento em vigor, conta não suspensa (`interno.rede2_membro`). Visitante (`anon`)
   não chama nenhuma função. A Alumia não tem menores (LGPD art. 14; ECA art. 241-D), e o chat privado também não.
2. **Pedido de conversa.** Se a outra pessoa **segue você**, a conversa abre direto. Se não segue, vira **pedido** ("fulana quer
   conversar", sem mensagem nenhuma): ninguém escreve até ser aceito. Cada pessoa escolhe quem pode chamá-la: pedidos de qualquer
   membro (padrão), só de quem ela segue, ou ninguém. Perfil invisível não recebe pedido. Pedido recusado não se repete por
   30 dias; pedido sem resposta some em 30 dias.
3. **Bloquear** (o mesmo bloqueio da Alumia, `interno.rede_bloqueios`) corta tudo: não pede, não envia, não lê chave nem mensagem.
4. **Denunciar:** quem denuncia **escolhe os trechos** e eles são decifrados no aparelho dela (a moderação nunca tem a chave da
   conversa). Vai para a fila de denúncias da Alumia como denúncia do perfil, com a prioridade da categoria; quem denuncia nunca é
   revelado; pode bloquear junto.
5. **Limite de envio** por pessoa (`interno.limite`): 120 mensagens por hora, 20 pedidos por dia, 10 trocas de chave e 10
   denúncias por dia; conta com menos de 3 dias tem metade.
6. **Resposta igual para tudo o que é fechado:** bloqueio, preferência da pessoa, perfil invisível, não membro, recusa recente,
   @ inexistente: o mesmo erro `dm_fechada`. Conversa alheia e conversa inexistente: o mesmo `nao_encontrado`. Nada revela algo da
   outra pessoa.
7. **RLS estrita:** as tabelas `interno.rede_dm_*` têm RLS ligada **sem política nenhuma** e nenhum privilégio para `anon` ou
   `authenticated`: ninguém lê tabela. Só as funções (`security definer`) conferem que quem chama é participante. O embrulho feito
   para a outra pessoa nunca sai.
8. **Nada em log:** as funções do chat não chamam o registro de atividades (`interno.registrar`), não mandam avisos com conteúdo e
   não fazem `raise notice`. As telas não escrevem no console e não chamam nenhum serviço de fora.
9. **Nada federado:** mensagem privada **não vai ao Fediverso**. Nenhuma função do Fediverso no banco e nenhum código em
   `lib/rede/fediverso`, `app/api/fediverso` ou `.well-known` toca nas tabelas do chat (conferido no teste).
10. **Metadados mínimos:** o chat mostra da outra pessoa só codinome, @handle e rosto (nunca nome do painel nem e-mail). A página
    não é indexada (`robots: noindex`) e não leva nada nos metadados. Não há "visto por último", "digitando" nem confirmação de
    leitura para a outra pessoa; só a contagem de não lidas para a própria pessoa.

## Retenção mínima e apagar

- Toda mensagem nasce com **prazo**: 1, 7 ou 30 dias (padrão 7, escolhido por cada pessoa nos Ajustes e por conversa). Encurtar o
  prazo vale também para o que já foi escrito. Venceu, some: as leituras já filtram e a faxina (`interno.rede_dm_faxina`) apaga
  de vez, junto das próprias chamadas. Embrulhos de versões antigas sem mensagem viva também somem.
- **Apagar a mensagem** (quem escreveu): some para os dois.
- **Apagar a conversa** (qualquer participante): mensagens e chaves embrulhadas somem para os dois.
- **Apagar tudo do chat** (Ajustes): conversas, chave pública, preferências e recusas da pessoa, e o chaveiro deste aparelho.
- **Apagar a conta:** chave estrangeira com `on delete cascade` em tudo (`interno.perfis`): mensagens, conversas, chaves e
  preferências somem junto.

## LGPD (Lei 13.709/2018) e outras leis, artigo por artigo

Conferido em 06/11/2026.

| Artigo | Como o chat cumpre |
|---|---|
| LGPD art. 6º, I a III (finalidade, adequação, necessidade) | Guarda só o necessário para entregar a mensagem: chaves públicas, embrulhos, o cifrado e as datas. Nada de IP, aparelho, localização ou lista de contatos. |
| LGPD art. 6º, VII e VIII (segurança, prevenção) | Cifra de ponta a ponta; o servidor não consegue ler. RLS sem política, funções que conferem o participante, limite de envio, aviso de troca de identidade. |
| LGPD art. 6º, X (responsabilização) | Testes automáticos provam o sigilo (`npm run testar:rede-chat`) e este documento descreve cada regra. |
| LGPD art. 7º, I e V; art. 8º | Base: o consentimento da Alumia (`rede2_membro`) e a execução do serviço que a própria pessoa pede (ativar o chat, abrir a conversa). |
| LGPD art. 11 | Conversas podem revelar dado sensível (saúde, orientação, opinião política): por isso ninguém além dos dois consegue ler, nem a equipe. |
| LGPD art. 14 | Sem crianças e adolescentes: só membros 18+ da Alumia. |
| LGPD art. 15 e 16 | Término do tratamento: prazo de 1/7/30 dias, faxina automática; nada guardado depois do fim da finalidade. |
| LGPD art. 18, VI | Eliminação a pedido: apagar mensagem, conversa, tudo do chat, ou a conta (cascata). |
| LGPD art. 46 e 47 | Medidas técnicas de segurança desde a concepção (cifra, RLS, sem log de conteúdo). |
| LGPD art. 48 | Em incidente, o banco vazado só tem cifrado e chaves públicas; o texto não pode ser lido sem os aparelhos. |
| Marco Civil (Lei 12.965/2014) art. 7º, II e III; art. 10 | Sigilo das comunicações privadas: o conteúdo não é acessível ao instituto. Por isso não há como entregar conteúdo a terceiros; só o que o banco tem (cifrado e datas), e só por ordem judicial. |
| Marco Civil art. 19 e 21 | Denúncia com os trechos que a própria vítima escolhe mostrar; moderação age no perfil (suspender, bloquear). |
| ECA (Lei 8.069/1990) art. 241-D | Sem menores no chat; denúncia com categoria "menores" tem a maior prioridade na fila. |

## O que o chat NÃO faz (de propósito)

- Não manda arquivo, foto, áudio ou link com prévia (prévia de link faria o servidor ou o aparelho buscar endereço de fora).
- Não tem grupo: só duas pessoas por conversa (grupos ficam nos núcleos e comunidades).
- Não mostra "online", "visto por último", "digitando" nem confirmação de leitura.
- Não guarda cópia em nuvem nem recuperação de chave.
- Não aparece em busca, notificação por e-mail ou push com conteúdo.

## Para aplicar em produção

1. No Supabase (SQL editor), rodar `supabase/migracoes/20261106-t19-rede-chat-privado.sql` (acrescentável: pode rodar de novo).
2. Publicar a imagem do site como de costume (`docs/HOSPEDAGEM.md`). Nenhuma variável nova em `/opt/lucia/site.env`.
