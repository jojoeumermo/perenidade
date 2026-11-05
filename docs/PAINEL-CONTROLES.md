# Controles do coordenador (Etapa 8, pacote controles)

Os sete controles que "só faltavam tela" e o Centro de controle. Código em `components/painel/controles/`; migração em `supabase/migracoes/2026-11-controles.sql` (ainda fora do `install.sql`: a integração junta). Teste: `npm run testar:controles`.

## Onde fica

Seção nova **Centro de controle** (`centro`), espaço Site e operação, molde Registro, visível para a coordenação. Tem sete abas além do Resumo. O resumo mostra como cada controle está agora (só liga/desliga e contagens, nunca endereço nem pessoa), leva a cada aba, tem o botão **Publicar agora**, o estado da publicação e atalhos para as outras seções do site (Controles do site, Aviso de abertura, Rádio no ar, Interdição, Segurança, Apoio, Estado técnico).

## Os sete, e o que já existia no banco

| Controle | Tela | Função do banco (já existia) | Quem pode |
|---|---|---|---|
| Canais WhatsApp e Telegram | `CanaisDoCelular` (molde Configuração) | `canais`, `canais_salvar` | coordenação e vice |
| Sala da equipe | `SalaDaEquipe` (Configuração) | `equipe_canais`, `equipe_sala_salvar` | coordenação |
| Canais e faixas da rádio | `RadioCanais` (também na seção Rádio) | `radio_estado`, `radio_canal_salvar/remover`, `radio_faixa_salvar/remover` | coordenação, vice, jornalismo |
| Moderadores de comunidade | `ModeradoresDaRede` (Tabela) | `rede_moderador_definir`, `pessoas_buscar` | mediação nomeia (cuida) |
| Núcleos fechados da Rede | `NucleosFechados` (Tabela) | `rede_com_nucleo_abrir` | coordenação ou quem acompanha o núcleo |
| Bloquear arquivo | `BloquearArquivo` | `arquivo_bloquear` | curadoria, coordenação, vice |
| Publicar agora em mais lugares | `PublicarAgora` | rota `/api/painel/publicar-agora` | ver abaixo |

## O que a migração acrescenta

Só leitura e um pedido; nenhuma tabela nova, nenhuma função `interno.*` liberada. Todas `security definer`, `search_path = interno, pg_temp`, `revoke all ... from public` e `grant` só a `authenticated`.

- `rede_moderadores_listar()` (cuida): comunidades e quem modera cada uma (nome público da equipe).
- `rede_nucleos_fechados_listar()` (coordenação): núcleos ativos, se o espaço da Rede já está aberto e quantas pessoas há (só contagem).
- `arquivos_bloqueados_ver()` e `arquivo_desbloquear(sha256)` (curadoria): ver a lista e desfazer um engano. A `arquivos_bloqueados()` antiga continua só da rotina de publicação.
- `publicar_agora_pedir()`: coordenação, vice, curadoria, desenvolvimento e quem decide o currículo. Divide o limite de 6 por hora com `curriculo_publicar_agora`.
- `controles_resumo()` (coordenação): liga/desliga e contagens para o resumo do Centro.

## Publicar agora

O botão (`PublicarAgora.tsx`) aparece em: Disciplinas e trilhas (já havia), Materiais e arquivos, Estado técnico e Centro de controle. Antes de pedir ele confirma, porque a rotina publica tudo o que já foi aprovado, não só o que está na tela. A rota tenta `publicar_agora_pedir` e, se o banco ainda não tiver a migração, cai em `curriculo_publicar_agora`. Sem `GITHUB_PUBLICAR_TOKEN` no servidor o botão some (no Centro e no Estado técnico há uma linha explicando). O token nunca vai ao navegador.

## Privacidade e leis

- Nada novo de dado pessoal é guardado. Moderadores são pessoas da própria equipe, nomeadas pela mediação (já era assim); a lista mostra só o nome que a equipe já vê. O Centro mostra contagens e liga/desliga, nunca endereços dos canais nem quem faz parte dos núcleos.
- Nenhum script, iframe ou widget de terceiros. WhatsApp, Telegram e sala de vídeo entram só como endereço, que a pessoa abre se quiser.
- Bloquear arquivo calcula o SHA-256 no aparelho de quem bloqueia (`crypto.subtle`); o arquivo não é enviado. Serve para impedir material de terceiros sem licença (Lei 9.610/1998, direitos autorais) ou com dado de pessoa (LGPD, Lei 13.709/2018) de entrar no site.
- Rádio: o formulário pede o crédito e a licença de cada faixa; só vale áudio livre ou do próprio instituto, sempre em https. Nada de áudio ou código de terceiros foi acrescentado por este pacote.
- Os textos das leis não foram abertos de novo no planalto.gov.br neste pacote: ele não coleta dado novo nem trata dado sensível. Quem for ampliar (por exemplo, mostrar quem participa de cada núcleo) precisa conferir a LGPD antes.

## Pendências

- Falta rodar `2026-11-controles.sql` no Supabase (o painel mostra "ainda não disponível" nas listas novas até lá; os formulários que usam funções antigas funcionam sem ela).
- Sem conferência visual no navegador nem `next build`; vale olhar as abas no celular e no tema escuro.
- A seção Núcleos antiga continua a cadastrar núcleos; fechar o espaço da Rede depois de aberto não tem função no banco (não foi pedido).
- Os outros 18 itens de back-end novo do plano ficam nos pacotes `backend-1` e `backend-2`.
