# Rodada 2 do painel e do site — relatório

Ramo `worktree-chat-e-cargos`, juntado ao `master` em 18/10/2026. Tudo o que está aqui foi conferido com `npm run testar:banco` (1204 conferências), `tsc`, `eslint` e `conferir:i18n`.

## Preciso de você (em ordem)

1. **Banco de produção**: rode o `supabase/install.sql` inteiro de novo no SQL Editor do Supabase. Ele é idempotente. Traz: coordenação pedagógica (antiga vice; pode haver mais de uma), porta-voz, a regra nova de aprovação, avatar, termo de voluntário, aprendizado interno, controles das conversas, caixa de sugestões do marketing, estatísticas, educadores públicos e a nova versão de aulas publicadas.
2. **Transcrição automática das aulas em vídeo**: publique a função nova `supabase/functions/transcrever-audio` (`supabase functions deploy transcrever-audio`). Ela usa os mesmos segredos da do podcast (`TRANSCRICAO_CHAVE` ou `GROQ_API_KEY`), que já estão cadastrados.
3. **Conferidor de ortografia próprio (opcional, recomendado)**: suba um LanguageTool num VPS com Docker (`docker run -d --restart=always -p 8010:8010 erikvl87/languagetool`, 2 GB de RAM bastam; ponha atrás de HTTPS, por exemplo `gramatica.institutolucia.org`) e defina na Vercel a variável `LANGUAGETOOL_URL=https://gramatica.institutolucia.org/v2`. Sem a variável, o site usa o serviço público, como antes, mas agora pelo próprio endereço `/api/gramatica` (30 pedidos por minuto por origem). Nada é guardado.
4. **Linha do tempo do acervo**: ela é montada a partir do histórico do Git na hora do build. Na Vercel o clone é raso e só os últimos registros aparecem. Defina na Vercel a variável `VERCEL_DEEP_CLONE=true` e faça um redeploy. O que é aprovado no painel só entra no site depois da rotina de publicação (de hora em hora) e do build seguinte: não dá para ser "em tempo real" sem isso.
5. **Anna's Archive** entrou em Fontes abertas porque você pediu, com a nota "indique nas fontes só o que for livre ou em domínio público". Ela cataloga bibliotecas-sombra; se preferir tirar, é uma linha em `components/painel/FontesAbertas.tsx`.

## O que mudou

### Cargos e aprovação
- **Coordenação pedagógica** no lugar da vice-coordenação (o valor no banco continua `vice`; pode haver mais de uma pessoa). Textos, certificados (educador + coordenação pedagógica + coordenação) e página de voluntários atualizados em cinco idiomas.
- **Porta-voz**: cargo novo, nomeado pela coordenação, coordenação pedagógica ou supervisão; fica só no grupo geral.
- **Autonomia dos educadores**: uma pessoa que revisa basta para pôr no ar: outro educador ou educador secundário da mesma disciplina, a revisão, a supervisão, a coordenação pedagógica ou a coordenação. O autor nunca aprova a própria aula. A curadoria decide só o acervo (obras, verbetes, memorial, vídeos, frases, debates).
- **Quem é de fora**: pessoa de fora → mediação (triagem) → parecer favorável de um educador → a revisão (ou liderança) põe no ar. A coordenação aprova a qualquer momento.
- **Cada função só vê o que é dela**: mediação, reforço, representante e porta-voz não escrevem aula pelo painel; Escrever e Meus envios aparecem só para quem produz. Fontes abertas para todo voluntário (educador secundário incluído).
- Podcast sem a tarefa de supervisão própria; a supervisão geral cobre.
- "Curadoria" virou "revisão" em todos os textos de aula; aulas em vídeo até **480p**.

### Painel
- Menu **recolhível** (só ícones, no computador), **tela cheia** e **modo foco** (só o essencial no menu), guardados por aparelho.
- **Termo de voluntário** ao entrar: aceita e segue; recusa, lê o porquê e sai. Fica registrado com data.
- **Estatísticas** (coordenação e coordenação pedagógica): por disciplina, aulas, reforço, vídeos, ao vivo, dúvidas e educadores; seis meses de série; pedidos de disciplinas novas; alerta de disciplina com procura e sem educador.
- **Ícones de perfil**: 16 desenhos nossos (estrela, punho, engrenagem, trigo, livro, pomba…) para todos; a liderança sobe imagem (reduzida no aparelho a 128 px, até 40 KB). Aparecem no menu, nas conversas, no mural e nos cartões públicos de educadores.
- **Controles das conversas** (Controles do site): fechar todas (com motivo), fechar grupos, silenciar pessoas. Quem está barrado continua lendo. A liderança nunca é barrada. Tudo no registro.
- **Conversas**: filtro Pessoas/Grupos; marca ⛔ em conversa fechada; mensagens claras de "fechado" e "silenciado".
- **Mesa**: "Envios do público" leva à triagem (e a Controles do site só quando estão pausados). Caixa "Ideia para a divulgação" para qualquer voluntário.
- **Divulgação**: aba "Caixa de sugestões" com as ideias da equipe (nova, em andamento, feita, não vai acontecer; "Pôr no calendário").
- **Avisos à equipe** também vão por e-mail (modelo do instituto) e continuam por cima do painel até a pessoa fechar.
- **Aprendizado interno**: canal próprio no mural da equipe, com termo de participação; cada dia de participação vale meia hora, só para quem tem o termo de adesão do certificado.
- **Escrever**: trilha em dois passos (disciplina → trilha), caixa **Atalhos** no guia (esqueleto, pergunta rápida, conta passo a passo, seções, citação, vocabulário), guia mostra quantas aulas a trilha tem e o que falta, busca de colega em "Trabalhar junto" não estoura o quadro.
- **Editar aula publicada**: o educador carrega o texto de uma aula sua, escreve a nova versão e ela passa pela revisão como aula nova; aprovada, substitui a atual (o banco só aceita de quem ensina a disciplina, revisão ou liderança). Aula de outro educador: pede a ele pelas Conversas.
- **Ortografia e gramática**: pelo próprio site (`/api/gramatica`), nível "picky", opção "Conferir enquanto escrevo" (confere alguns segundos depois de parar de digitar) e os apontamentos **sublinhados no texto**.
- **Aulas em vídeo**: modo "tela e câmera juntas" (câmera no canto, composta num quadro de 854×480), "Mostrar um PDF" (abre aqui e você compartilha a aba), botão "Transcrever automaticamente (Whisper)" que preenche transcrição e legenda.

### Site público
- **Quem somos** (`/quem-somos`, no rodapé): o instituto, o fundador (com os dados que você mandou; sem citar a escola) e a lista de educadores, em cinco idiomas. No fim de cada aula, o **cartão de quem ensina** a disciplina, com setas entre os educadores.
- **Dedicatória** de volta à faixa principal do menu.
- **Voluntariado em destaque** na página de entrar.
- Quando o aviso de abertura acaba (ou não há), entra o **convite ao apoio** (uma vez a cada trinta dias).
- **Caixa de ferramentas**: altura certa no celular e no aplicativo (`dvh` e teto), redação do ENEM com espaço, ENEM sem tabela periódica, elemento clicado rola para os detalhes.
- **Caderno de estudos**: mapa mental radial (e a lista de antes) e "Baixar o caderno inteiro" (resumo, palavras-chave, cartões, questionário, mapa, linha do tempo e notas num .md).
- **Disciplinas** (cinco idiomas): grupo **Tecnologia** (informática, programação, Engenharia de Sistemas, redes e segurança, IA, manutenção, edição de vídeo); **Engenharia de Sistemas** com as 12 trilhas que você listou (8 aulas planejadas cada); na **teoria revolucionária**, antes do capitalismo: "O que é e como funciona o Estado?", "Congresso, STF, PGR: as instituições" e "Eleições, partidos e voto" (trilhas de ensino médio, e uma superior sobre Estado e classes); **Neurodiversidade e psicanálise** (duas trilhas); **Costura e crochê** com "Crochê do zero" e "Crochê para vender" (ensino médio). Todas em preparação, com roteiro.

## Decisões pendentes e o que não coube

- **Painel para criar disciplinas e trilhas**: as disciplinas vivem no código (`lib/areas.ts`, cinco dicionários, `content/trilhas`), e o site é estático. Criar pelo painel exige mover isso para o banco e gerar as páginas a partir dele: um projeto próprio (estimativa: uma rodada inteira). Por ora, Estatísticas mostra os pedidos de disciplina e a sugestão vai por "sugestão" em Contribuir.
- **Francês como sexto idioma**: são ~2.600 textos de interface mais as páginas; sem tradução automática paga, é trabalho de tradutor. O código já aceita um `fr.json` (basta copiar `pt.json`, traduzir e registrar em `i18n/config.ts`).
- **Banco de questões público "que se atualiza sozinho pela internet"**: buscar questões de concursos e vestibulares automaticamente esbarra em direitos autorais e em fontes sem licença; o caminho seguro é os educadores enviarem questões (tipo "questão" em Contribuir já existe) e uma página pública que as liste. A página não foi feita nesta rodada.
- **Sala Lúcia (Jitsi) e Reuniões**: as aulas ao vivo já abrem sala com vídeo e bate-papo direto do navegador e aceitam sala de fora (Jitsi/Meet). Trocar o motor por Jitsi IFrame API com servidor próprio e criar a aba Reuniões (propostas, aprovação, presenças) são projetos à parte.
- **Estúdio de design + PhotoCraft, FilmCraft/EffectCraft, editor por blocos, laboratório de redes, laboratórios de prática/IDE, comentários em tempo real, reforma do acervo/comunidade/contribuir/apoie, remoção da Rádio Lúcia própria, auditoria de SEO/404/hreflang/a11y, sistema de tarefas "Para você hoje"**: não couberam nesta rodada. Cada um é uma rodada própria; os prompts que você mandou servem como estão.
- **Anna's Archive**: veja "Preciso de você".
- A exigência "nenhuma ação que hoje alguém pode fazer pode passar a ser negada" tem duas exceções pedidas por você: mediação não escreve aula pelo painel, e a curadoria não decide aulas (só acervo).
