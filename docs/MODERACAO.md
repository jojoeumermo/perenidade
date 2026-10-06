# Guia de moderação

A moderação da Perenidade acontece no GitHub. O site só mostra a fila (página **Fila de moderação**), lendo dados públicos. Não existe painel com senha: quem pode aprovar é quem tem permissão de escrita neste repositório.

## Revisar uma contribuição

Cada contribuição é um Pull Request. Abra a aba "Files changed" para ver, linha por linha, o que entra e o que sai.

Confira, nesta ordem:

1. **Origem.** O texto é do próprio autor, de domínio público ou de licença aberta? Pesquise um trecho entre aspas em um buscador. Se aparecer em outro site ou livro, peça a fonte ou recuse.
2. **Fichas do acervo.** Abra o link. Ele leva à página da obra em uma fonte legítima? A licença informada é a mesma que a fonte declara? O link não aponta direto para um PDF?
3. **Correção.** As informações estão certas? Datas, nomes e exemplos conferem?
4. **Clareza.** Um iniciante entenderia?
5. **Verificação automática.** O selo "CI" do Pull Request precisa estar verde. Ele confirma que o conteúdo está no formato certo e que o site compila.

Para aprovar, faça o merge. Para pedir ajustes, comente no Pull Request. Para recusar, feche explicando o motivo.

Quando uma aula tiver sido conferida por um moderador, acrescente `revisada: true` ao cabeçalho dela. Isso remove o aviso "aguarda revisão da comunidade".

## Quarentena (denúncias)

Denúncias chegam como Issues com a etiqueta `denuncia`.

Em denúncia de **direitos autorais**, tire o item do ar primeiro e analise depois. Acrescente ao cabeçalho do arquivo:

```yaml
ativo: false
```

O item some do site na próxima publicação, mas continua no repositório para análise. Isso vale para aulas, trilhas e fichas do acervo.

- Denúncia procedente: apague o arquivo e feche a Issue explicando.
- Denúncia improcedente: remova a linha `ativo: false` e feche a Issue explicando.

Agir rápido depois de notificado é o que protege o projeto. Não deixe denúncia de direitos autorais parada.

## Desfazer uma aprovação errada

Nada do que entra pelo Git é definitivo.

```bash
git revert <hash-do-commit>
git push
```

Pelo site do GitHub: abra o Pull Request que foi aceito e clique em "Revert".

## Se uma conta de moderador for invadida

1. Remova o acesso da conta em Settings > Collaborators.
2. Reverta os commits indevidos com `git revert`.
3. O histórico mostra exatamente o que foi alterado, por quem e quando.

Não há dados pessoais, senhas nem arquivos de terceiros guardados aqui. O pior caso é conteúdo indevido publicado por algumas horas, e ele se desfaz com uma reversão.

## Proteções recomendadas no repositório

Em Settings > Branches, proteja o branch principal:

- exigir Pull Request antes de qualquer merge;
- exigir que a verificação "CI" passe;
- proibir force push.

Ative também a verificação em duas etapas na conta de cada moderador.
