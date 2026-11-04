# Rede Lúcia v2: moderação (Etapa 7, R4, itens 45 a 49)

Texto das regras que a Rede cumpre e que o código garante. O que muda de número (limites dos níveis) mora na tabela pública
`interno.rede_niveis` e aparece em `/comunidade/cuidado`; este arquivo explica o desenho. Código: `supabase/migracoes/2026-11-rede-moderacao.sql`,
`components/rede/moderacao/`, `lib/rede/{tipos,cliente,textos}-moderacao.ts`. Teste: `npm run testar:rede-moderacao`.

Tudo atrás do recurso `rede-v2` (só liga pelo nome). Com ele desligado, a Rede de hoje fica como está.

## 1. Níveis de confiança (como o Discourse)

| Nível | Nome | Como se chega | Links por post | Imagens por post | Posts por dia |
| --- | --- | --- | --- | --- | --- |
| 0 | novo | quem entrou na Rede | 1 | 1 | 30 |
| 1 | básico | 2 dias de conta, 5 participações, 30 dias sem decisão procedente | 2 | 2 | 60 |
| 2 | membro | 15 dias, 30 participações, 3 posts, 90 dias sem decisão procedente | 4 | 4 | 120 |
| 3 | regular | 60 dias, 120 participações, 20 posts, 180 dias sem decisão procedente | 8 | 4 | 240 |
| 4 | líder | designado pela coordenação (`rede_mod_lider`) | 15 | 4 | 500 |

- **Sobe e desce sozinho**: `interno.rede3_mod_nivel(pessoa)` calcula na hora a partir das regras da tabela; não há nível guardado que fique velho. Uma decisão
  procedente (post removido, pessoa tirada de comunidade, suspensão) nos últimos N dias derruba o nível; se o recurso reverter a decisão, ela deixa de contar.
- **"Leitura"**: o Discourse conta tempo de leitura. A Rede **não acompanha o que a pessoa lê** (sem rastreamento). No lugar, conta **participação**: apoios,
  úteis e salvos que a pessoa deu. É sinal de que ela lê, sem registrar o quê. É um desvio consciente do modelo original, por privacidade.
- **Os limites valem para qualquer função que grave**: são gatilhos em `rede_posts` e `rede_midia` (`rede3_mod_posts`, `rede3_mod_midia`), então continuam valendo
  quando os pacotes publicar e comunidades redefinirem `rede_publicar`. Quem modera o lugar (equipe, moderação da comunidade, mediação do núcleo) não é barrado.
  O gatilho só olha posts feitos por uma pessoa logada; a migração do Fórum e as funções do banco passam livres.
- Erros: `nivel_links`, `nivel_imagens`, `limite_diario`, com texto em `erros` nos seis idiomas.
- As regras são públicas: `rede_mod_niveis()` responde a visitante; a tela é `/comunidade/cuidado`. Quem entrou vê o próprio nível e o que falta (`rede_mod_meu_nivel`).

## 2. Denúncia com protocolo

- **Botão** em post (no cartão), perfil e comunidade: `rede_mod_denunciar(tipo, alvo, categoria, texto)`. Categorias: menores, ameaça, exposição de dados,
  incitação à violência, autolesão, ódio, assédio, golpe, spam, outro.
- **Quem denuncia nunca é revelado**: nem ao autor, nem à moderação. A tabela guarda a conta apenas para avisar o andamento; nenhuma função a devolve a ninguém
  além da própria pessoa (`rede_mod_minhas_denuncias`). O teste confere que a fila e o detalhe não contêm o identificador nem o @ de quem denunciou.
- **Só se denuncia o que se pode ver**: a matriz de visibilidade (`interno.rede_ve`) vale aqui também. Não se denuncia o próprio post.
- **Protocolo**: dez caracteres. Mesma pessoa e mesmo alvo com denúncia aberta devolve o mesmo protocolo. Teto de 20 denúncias por hora (`rede2_limite`), contra uso
  da ferramenta como arma (ECA Digital, art. 33 pede procedimento contra abuso do canal de denúncia).
- **Acompanhamento**: aviso (categoria `rede`) quando a denúncia é resolvida ou descartada; tela `/comunidade/denuncias` com protocolo, categoria e andamento.
- **Visitante**: pela página `/denunciar` que já existe. Um gatilho em `interno.denuncias` (`rede3_mod_ponte`) leva à mesma fila toda denúncia cujo endereço é um post
  da Rede **que um visitante pode ver**; a categoria sai do motivo escolhido. Visitante não tem conta, então não acompanha: o protocolo vale só para a moderação.
- **Precaução** (só `menores` e `exposição de dados` em post): o post fica retido, só o autor o vê, até a moderação ler. É reversível, sai no registro como
  ação do sistema (regra `precaucao`), o autor é avisado de que a decisão foi automática e pode recorrer. Teto de 5 retenções por conta por dia, para a denúncia não
  derrubar posts em série.

## 3. A fila por prioridade e a ação

- **Prioridade 1** (na frente): abuso de menores, ameaça, exposição de dados, incitação à violência, autolesão. Depois ódio, assédio e golpe; depois o resto.
  A prioridade vem de `interno.rede2_prioridade`. Denúncia de prioridade 1 avisa a coordenação e a mediação.
- **Quem vê o quê**: equipe que cuida vê tudo; moderação de comunidade vê o que é da comunidade dela; mediação de núcleo vê o que é do núcleo.
- **Núcleo e o quebra-vidro**: a equipe geral não lê post de núcleo (ESPEC, seção 2). Numa denúncia, a fila mostra o item sem trecho; abrir o conteúdo registra
  `quebra_vidro` (uma vez por pessoa e denúncia) e **avisa a mediação do núcleo**. Sem denúncia, a equipe geral não age em post de núcleo.
- **Ação com regra e motivo**: `rede_mod_agir` (remover, restaurar, reter, travar, destravar, avisar; tirar e devolver uma pessoa de uma comunidade). Regra
  (3 a 80 caracteres) e motivo (3 a 1000) são obrigatórios; a tela pede uma segunda confirmação, dentro da página, para o que esconde. A ação fecha a denúncia e
  avisa quem denunciou. Suspender a conta continua no painel (`mediacao_banir`), que já registra no histórico dele.
- **Registro só de inserção**: `rede_moderacao` tem gatilhos que barram `update`, `delete` e `truncate`. Todo ato daqui entra nele: ações, descarte de denúncia
  (`descartar`), modo lento, rótulo, listas, designação de líder, quebra-vidro e a decisão final dos recursos.
- **Aviso a quem foi moderado**: com a regra, o motivo, o dado de que foi uma pessoa da moderação (ou o sistema, na precaução) e o caminho do recurso.

## 4. Recurso em até 30 dias, revisto por outra pessoa

- `rede_mod_minhas_decisoes` mostra a quem foi atingido a regra, o motivo e o prazo (nunca quem decidiu).
- `rede_mod_recorrer(decisão, texto)`: de 10 a 2.000 caracteres, **um por decisão**, só pela pessoa atingida, em até 30 dias (`prazo_vencido`, `recurso_ja_feito`).
- `rede_mod_rever(recurso, 'mantido'|'revertido', motivo)`: **nunca por quem tomou a decisão** (a função recusa com `outra_pessoa` e um gatilho do banco recusa de novo).
  `revertido` desfaz o efeito (post volta, trava sai, banimento sai), avisa a pessoa e entra no registro; `mantido` também entra. A decisão final fica gravada.

## 5. Modo lento, trava, silenciar, listas

- **Modo lento** (`rede_mod_modo_lento`): intervalo de 5 segundos a 24 horas entre dois posts da mesma pessoa, por comunidade ou por conversa; `0` desliga. Liga quem
  modera o lugar. `rede_mod_lento_de` deixa a tela avisar antes de escrever. Erro: `modo_lento`.
- **Trava de conversa**: `rede_mod_agir` com `travar` e `destravar`; a fundação recusa resposta em conversa travada.
- **Silenciar** (`rede_mod_silenciar`): pessoa, conversa, comunidade ou palavra (sem acento), no servidor (`rede_silenciados`), com validade opcional (1 a 365 dias)
  e teto de 200 itens. A linha, o "N novos" e a busca já respeitam. **Ninguém é avisado.** Opção **só no aparelho**: a lista fica no navegador
  (`lib/rede/silenciar-local.ts`, chave `lucia:rede:silenciados`, apagada pelo "Sair rápido"), nada vai ao servidor.
- **Listas de bloqueio da mediação** (comunidade e núcleo): **palavra** deixa o post retido para a mediação ler (nada some em silêncio; o autor vê "lista da mediação"),
  **pessoa** não escreve naquele lugar. A equipe nunca entra na lista. A lista é só da mediação: nem o conteúdo dela é público.
- Os posts retidos esperam na aba "Esperando leitura" do painel.

## 6. Rótulo de desinformação ligado à Checagem

`rede_mod_rotular(post, slug da checagem, veredito, título)` liga o post a uma checagem **que já existe** em `/checagens` (a tela de moderação recebe do servidor
só slug, título e veredito, de `content/checagens`; o banco só confere o formato do slug). O **post não é apagado nem escondido**: ganha um rótulo "Verificado pela
Checagem" com o link `/checagens#<slug>`. O rótulo respeita a matriz: `rede_mod_detalhes(ids)` responde em lote e só para o que a pessoa pode ver. Quem modera o lugar
rotula e desrotula; os dois entram no registro.

## 7. Telas e rotas

| Rota | Quem | O quê |
| --- | --- | --- |
| `/comunidade/moderacao` | quem modera | fila de denúncias, esperando leitura, recursos, modo lento e listas, designar líder (coordenação) |
| `/comunidade/denuncias` | quem entrou | minhas denúncias (protocolo e andamento) e decisões sobre o que escrevi, com recurso |
| `/comunidade/silenciados` | quem entrou | o que silenciei, na conta e neste aparelho |
| `/comunidade/cuidado` | todo mundo | "Como a Rede cuida": regras escritas, níveis, a lei |

Nenhuma é indexada, nenhuma leva trecho de conteúdo nos metadados, todas dão 404 com o recurso desligado. Os textos vêm sob demanda, um idioma por vez
(`i18n/rede/moderacao/`, `lib/rede/textos-moderacao.ts`); en, es, fr, ru e zh são rascunho marcado.

## 8. O que a lei pede (conferido no planalto.gov.br e na página do STF em 04/11/2026)

- **Marco Civil da Internet (Lei 12.965/2014), art. 19 e art. 21; STF, Temas 987 e 533 (junho de 2025).** O texto da lei no Planalto traz o art. 19 sem nota da decisão; pela
  tese fixada, o art. 19 é **parcialmente inconstitucional**: para ilícitos em geral, a plataforma responde se, **notificada**, não retira o conteúdo; para **crimes contra a honra**
  (Código Penal, arts. 138 a 140), segue a ordem judicial, e a plataforma **pode** retirar a partir de notificação extrajudicial; para crimes graves (terrorismo, racismo, crimes
  contra mulheres e crianças, entre outros) há **dever de cuidado** e de agir logo. A tese também pede regras de **notificação, devido processo e canal de denúncia permanente,
  acessível e divulgado**, e relatórios de transparência. O art. 21 (conteúdo íntimo: responsabilidade subsidiária depois da notificação do participante) já pedia retirada diligente.
  **Como a Rede cumpre**: denúncia com protocolo a qualquer hora, fila com prioridade para os casos graves, retenção por precaução em menores e exposição, ação com regra e motivo,
  aviso e recurso. `/comunidade/cuidado` divulga o canal e o processo. Falta (pendência): relatório anual de transparência (os números já saem do registro).
- **Marco Civil, art. 15**: guarda de registros de acesso. Esta migração **não grava endereço de IP** em lugar nenhum; o limite por origem do visitante usa o contador
  existente (`interno.limite`), sem guardar o endereço.
- **ECA Digital (Lei 15.211/2025), arts. 28 a 30 e 33.** Canal para denunciar violação de direitos de crianças e adolescentes (art. 28): é o botão de denúncia com categoria
  `menores`. Retirada **sem ordem judicial** após notificação da vítima, de representantes, do Ministério Público ou de entidades de defesa da infância (art. 29): a Rede
  retém por precaução e prioriza. O art. 29, § 2º, exige que a notificação permita **identificar o notificante** e veda a anônima: por isso a conta de quem denuncia fica
  guardada (e só ela a vê); a denúncia de **visitante** é tratada, por dever de cuidado, mas não conta como notificação do art. 29. Devido processo na retirada (art. 30): aviso com o
  motivo, **se foi decisão humana ou automática**, direito de recurso, prazos: é o aviso e o recurso de 30 dias. Procedimento contra o abuso do canal (art. 33): teto por conta.
  **A autodeclaração de 18 anos não é verificação de idade (art. 9º, § 1º)**; segue como ponto de revisão jurídica antes de ligar a v2 para todos (veja `docs/rede/PRIVACIDADE.md`).
- **LGPD (Lei 13.709/2018)** arts. 5º II, 11 I, 14 e 18: veja `docs/rede/PRIVACIDADE.md`.

Isto não é parecer jurídico: a revisão por advogada ou advogado antes de ligar para todos continua pendente (ESPEC, seção 7).

## 9. Fora do pacote

Suspensão de conta (painel, `mediacao_banir`); semear a rede e comunidades (pacote comunidades); aviso em grupo e e-mail (pacote avisos). Para o aviso de moderação sair
agrupado no pacote avisos, as mensagens daqui usam a categoria `rede`.
