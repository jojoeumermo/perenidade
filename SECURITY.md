# Segurança

Achou uma falha de segurança no site, no painel ou no banco do Instituto Lúcia? Obrigado por avisar.

**Não abra issue pública.** Escreva para **institutolucia@tutamail.com** com o assunto "Segurança", contando:

- o que é a falha e onde ela está (endereço, arquivo ou função);
- como reproduzir, de preferência num ambiente local (`npm run dev:local`);
- o impacto que você imagina.

Responderemos assim que possível. O projeto é mantido por voluntários e não tem programa de recompensa, mas quem ajudar será creditado, se quiser.

## O que pedimos

- Teste só na sua máquina ou numa cópia sua. Não ataque o site em produção, não tente acessar dados de outras pessoas e não faça teste de carga.
- Não divulgue a falha antes de ela ser corrigida.

## O que já fazemos

Toda leitura e escrita no banco passa por funções que conferem quem pede (segurança por linha em todas as tabelas), as contas da equipe usam segundo fator, as conversas da equipe são cifradas de ponta a ponta, a política de segurança de conteúdo (CSP) barra scripts de fora e o histórico de tudo o que vai ao ar fica no repositório.
