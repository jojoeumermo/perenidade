# Rodada geral de correções e melhorias: onde parou

Esta pasta guarda uma rodada de trabalho interrompida no meio: o plano completo, o código que ficou pela metade (em patches) e as especificações de cada frente. **Apague a pasta inteira quando a rodada terminar.** Nada aqui vai para o site (o site só lê `content/`).

## O que já está no ramo (commitado)

Conteúdo novo, que passa nas regras do build, mas **ainda sem a segunda conferência** (a etapa de conferir cada link e cada fato foi interrompida antes de rodar):

| Coleção | Antes | Agora | Falta para a meta |
| --- | --- | --- | --- |
| Acervo (`content/acervo`) | 881 | 1.072 (+191) | +128 para 1.200 |
| Cartões de debate | 9 | 24 (+15) | — |
| Checagens | 4 | 17 (+13) | — |
| Vídeos | 46 | 58 (+12) | ~30 |
| Guia de fontes | — | +25 linhas | ~40 lugares |
| Aulas | — | +33 | ~70 |
| Glossário, rádios, galeria | 53 / 19 / 9 | sem mudança | tudo |

Aulas novas: `ler-e-escrever` (8), `geografia-fundamental` (9), `lutas-do-povo` (8), `portugues-superior` (5), `linguistica` (3).

**Antes de publicar em produção**, confira esse conteúdo (links abrem? licença certa? fatos e números batem com a fonte?). As instruções de conferência de cada coleção estão nas especificações (funções `CONFERIR`/`REVISAR`). Para saber o que entrou nesta leva: `git show --stat HEAD~1` (o commit "primeira leva").

## O que ficou pela metade (patches, não commitados no código)

Cada patch se aplica limpo sobre este commit. Para retomar: `git checkout -b <nome> && git apply docs/rodada-geral/patches/<arquivo>.patch`.

| Patch | Frente | Estado |
| --- | --- | --- |
| `c6-cabecalho.patch` | Notícias de volta no app, "Olá, nome" no lugar de "Painel", histórico só pedagógico | Quase pronto: passa no typecheck, no lint e na conferência dos 5 idiomas. Falta conferir na tela (celular, app e computador) e rodar o build. |
| `c1-cargos.patch` | Supervisão, marketing (tabela de divulgação), edição de usuário e redefinição de senha, proteções, andamento das traduções | Só o banco (`install.sql`) e o banco de teste. 632 de 633 conferências passam; a que falha ("coordenação vê todos os canais") só precisa incluir o canal novo `supervisao` na lista esperada em `scripts/testar-banco.mjs`. **Falta toda a parte do painel** (telas), os testes novos e a documentação. |
| `c7-falacias.patch` | Guia das falácias e ferramentas de checagem | Começo: carregador em `lib/content.ts` e a lista de ferramentas de checagem. Faltam as falácias, as páginas e o i18n. |
| `c5a-ferramentas.patch` | Caixa de ferramentas nas aulas + ferramentas de ciências | Começo: analisador de expressões (`lib/expressao.ts`), frações (`lib/fracao.ts`) e passos (`lib/steps.ts`). Falta quase tudo. |

## O que nem começou

- Interdição do site ("site fantasma") e por área, expurgo das áreas públicas, pedidos da supervisão com aprovação da coordenação (especificação 1, tarefa C2).
- Gaveta Aberta, o espaço de trabalhos de estudantes com termo de cessão (especificação 1, tarefa C3).
- Ferramentas das outras disciplinas (especificação 2, C5b) e o assistente de reforço com leitura de foto (C4).
- Ocultar o botão de suspender a própria conta: é uma linha em `components/painel/Pessoas.tsx` (perto da linha 237, o botão que chama `usuario_suspender`): não mostrar quando `pessoa.id === me.id`. O banco já recusa.
- Glossário (+200 verbetes), rádios (+15, principalmente brasileiras do campo progressista), galeria.
- Ao final de tudo: testar o painel com cada cargo e a comunidade de ponta a ponta (`npm run dev:local`), `npm run build`, revisão geral.

## Como continuar numa sessão local do Claude Code

1. `git pull` neste ramo e `npm ci`.
2. Abra as especificações em `especificacoes/`. São os roteiros que os agentes estavam seguindo, com o pedido detalhado de cada frente (as constantes `C1`, `C2`, `C3`, `C5A`, `C5B`, `C4`, `C6`, `C7`, e os textos das tarefas de conteúdo). Cole uma de cada vez numa sessão (ou peça para o Claude ler o arquivo e executar a tarefa X).
3. Algumas instruções das especificações valem só para a nuvem e podem ser ignoradas: caminhos em `/tmp/claude-0`, portas, "worktree", e o aviso de que a internet estava bloqueada. Localmente a internet funciona, então dá para conferir os links abrindo de verdade. No lugar de `/tmp/claude-0/tools/validar.sh`, use `sh docs/rodada-geral/validar-conteudo.sh`, que confere `content/` em ~2 s.
4. Ordem recomendada: C6 (é só aplicar o patch e conferir) → C1 → C2 → C3 (uma depende da outra) → C5a → C5b → C4 → C7 → conteúdo → teste de ponta a ponta.
5. A galeria precisa baixar imagens do Wikimedia Commons, que estava bloqueado na nuvem. Localmente funciona.

## Decisões já tomadas (para não perder)

- Nome do mural de estudantes: **Gaveta Aberta**, "trabalhos de estudantes, livres para todos" (fácil de trocar).
- Supervisão: nomeada pela coordenação ou pela vice; segundo fator obrigatório como a coordenação; vê a equipe sem e-mails; suspende em emergência quem não é coordenação, vice nem supervisão (com motivo e aviso à liderança); modera o mural da equipe; lê o registro; liga a pausa de envios e o modo de segurança da Comunidade. Interdição e expurgo só como **pedido**, que vale depois da aprovação da coordenação ou da vice (vence em 72 h).
- Marketing: design + divulgação; calendário editorial de posts e stories; kit da marca; o acesso ao Instagram é dado pela coordenação pela Central de Contas da Meta, e **o site nunca guarda senha de rede social**. O papel "design" continua existindo para quem já tem.
- Edição de usuários: coordenação e vice mudam nome, apresentação e senha, nunca o e-mail; a vice não mexe na coordenação; a pessoa é obrigada a trocar a senha no próximo acesso; as sessões abertas dela são encerradas.
- "Photomath embutido": o Photomath é um aplicativo fechado do Google e não pode ser embutido. No lugar dele entra o **resolvedor** passo a passo próprio, mais a leitura de foto pelo assistente.
- Assistente de reforço: função de borda com a API do Claude, **desligada de nascença** (precisa da chave `ANTHROPIC_API_KEY`; é um serviço pago). Exige conta, tem limites diários e não guarda as perguntas. O texto de privacidade só entra no dia em que for ligado. Mesmo desligado, o reforço sugere aulas do próprio site enquanto a pessoa digita.
- Histórico: sem merges e sem o assunto dos commits. Mostra um resumo gerado a partir dos arquivos ("12 obras novas no acervo…"), só das coleções pedagógicas.
