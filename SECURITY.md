# Segurança

Achou uma falha de segurança no site, na Alumia (a rede social e o chat), no painel, no banco ou nos apps do Instituto Lúcia?
Obrigado por avisar. Esta página diz como avisar sem expor a falha, em quanto tempo respondemos e quando ela é publicada.

## Como avisar

**Não abra issue pública** nem comente a falha em lugar aberto.

1. **Cifrado de ponta a ponta, hoje:** escreva para **institutolucia@tutamail.com** a partir de uma conta do Tuta (é gratuita).
   Entre duas contas do Tuta o e-mail vai cifrado de ponta a ponta, sem nada a configurar.
2. **De outro e-mail:** mande para o mesmo endereço só uma linha, sem detalhes da falha: "Quero avisar uma falha de
   segurança". Respondemos com um e-mail cifrado do Tuta, protegido por uma senha que combinamos por outro meio; a sua resposta
   nesse mesmo e-mail também vai cifrada, e é por ela que você manda os detalhes.
3. **Com chave pública (OpenPGP):** quando a chave de reporte do Instituto estiver publicada, ela fica no campo `Encryption` de
   [/.well-known/security.txt](https://institutolucia.org/.well-known/security.txt) e aqui, com a impressão digital. Até lá, use
   o 1 ou o 2.

No aviso, conte:

- o que é a falha e onde ela está (endereço, arquivo ou função);
- como reproduzir, de preferência num ambiente local (`npm run dev:local`);
- o impacto que você imagina e a gravidade que você daria (veja abaixo);
- se quer ser creditado e com que nome ou apelido.

## Em quanto tempo respondemos

O projeto é mantido por voluntários, mas falha de segurança passa na frente.

| Etapa | Prazo, contado do seu aviso |
| --- | --- |
| Confirmação de que recebemos | até 7 dias |
| Avaliação (se é falha, a gravidade e o plano) | até 30 dias |
| Correção de falha crítica ou alta | o quanto antes; a meta é 30 dias |
| Correção de falha média ou baixa | até 90 dias |

Se um prazo não der, avisamos antes de ele vencer, com o motivo e a data nova.

## Gravidade

- **Crítica:** lê conversa cifrada, liga quem fala com quem, revela voto, puxa lista de pessoas, entra em conta alheia ou toma o
  servidor, sem precisar de nada da vítima.
- **Alta:** o mesmo, mas exigindo algo da vítima (abrir um link, estar num grupo com quem ataca) ou acesso que não deveria
  bastar; ou derrubar o chat de todo mundo.
- **Média:** vaza dado que não deveria sair, mas sem ligar a uma pessoa; ou fura um limite (de tentativas, de tamanho, de
  tempo) sem chegar ao conteúdo.
- **Baixa:** endurecimento, erro que vaza pouco ou nada, falha que só funciona com o aparelho já desbloqueado na mão de quem
  ataca.

## Divulgação responsável

- Pedimos que você não publique a falha antes de ela ser corrigida, ou até **90 dias** depois do seu aviso, o que vier
  primeiro. Se precisarmos de mais tempo, pedimos antes, com o motivo; se a falha estiver sendo explorada, corrigimos e
  publicamos antes disso.
- Depois da correção, a falha entra no **relatório trimestral de segurança** em
  [institutolucia.org/transparencia/trimestral](https://institutolucia.org/transparencia/trimestral): o que era, a gravidade,
  desde quando estava no ar e quando foi corrigida. Falha ainda aberta aparece só com a gravidade e a área.
- Quem avisou é creditado ali, se quiser.

## Recompensa

Não há recompensa em dinheiro: o Instituto é um projeto voluntário, sem fins lucrativos. Quem ajudar recebe o crédito público e
o nosso agradecimento.

## O que pedimos

- Teste só na sua máquina ou numa cópia sua. Não ataque o site em produção, não tente acessar dados de outras pessoas e não
  faça teste de carga.
- Se encontrar dado de outra pessoa por acaso, pare, não guarde cópia e conte no aviso.
- Engenharia social contra a equipe, ataque físico e derrubar o serviço estão fora.

## Auditorias

O plano de auditorias externas (o que é auditado, em que ordem e quando) está em [docs/AUDITORIAS.md](docs/AUDITORIAS.md). Os
relatórios saem na íntegra em [institutolucia.org/transparencia/relatorios](https://institutolucia.org/transparencia/relatorios).

## O que já fazemos

Toda leitura e escrita no banco passa por funções que conferem quem pede (segurança por linha em todas as tabelas). As conversas
são cifradas de ponta a ponta nos aparelhos e os pacotes do chat passam por caixas anônimas, que não guardam conta. Nenhum
endereço de rede fica guardado. As contas da equipe usam segundo fator, a política de segurança de conteúdo (CSP) barra scripts
de fora e o histórico de tudo o que vai ao ar fica no repositório. A cada mudança, o código passa por análise estática (CodeQL e
Semgrep com as regras da casa), testes de propriedade e conferência de dependências e de segredos no histórico; toda semana, por
fuzzing das rotas e das funções do banco que recebem dados de fora. A lista completa do que o servidor guarda é gerada do banco e está em
[institutolucia.org/transparencia/o-que-o-servidor-guarda](https://institutolucia.org/transparencia/o-que-o-servidor-guarda).
