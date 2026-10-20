# Como contribuir com o código do Instituto Lúcia

Obrigado por querer ajudar. O Instituto Lúcia é uma escola e biblioteca comunitária, gratuita, sem anúncios e sem rastreadores, mantida por voluntários. O código é software livre (GNU AGPL 3.0 ou posterior, veja `LICENSE`); o conteúdo educacional é CC BY-SA 4.0 (veja `LICENSE-CONTEUDO.md`).

Quer contribuir com aulas, traduções, revisão ou o acervo, e não com código? O caminho é o site: [institutolucia.org/pt/contribuir](https://institutolucia.org/pt/contribuir) e [Voluntariado](https://institutolucia.org/pt/voluntarios).

## Antes de começar

1. Leia o `README.md` e rode o site na sua máquina (`npm install` e `npm run dev`). Para o painel e a comunidade, sem tocar no banco de verdade: `npm run dev:local`.
2. Procure uma tarefa nas issues com a etiqueta **voluntariado** ou **bom para começar**. Se for algo grande, abra uma issue antes, contando o que pretende fazer.
3. Escreva como o resto do código: nomes e comentários em português, comentários que explicam o porquê, nada de dependência nova sem necessidade.

## As regras que não se negociam

- **Privacidade.** Nada do que a pessoa faz ao estudar sai do aparelho dela. Sem analytics, sem pixel, sem script de terceiros em tempo de execução. Biblioteca nova é hospedada no próprio site, com versão fixa.
- **Licenças.** Só entra biblioteca, imagem, fonte ou dado com licença compatível (MIT, BSD, Apache, ISC, CC0, OFL, domínio público; CC BY com crédito). Copyleft (GPL, AGPL, CC BY-SA) é compatível com o código do site, mas pergunte antes de incluir. Nada proprietário.
- **Acessibilidade.** Teclado, leitor de tela, contraste AA, temas claro e escuro, tela de 360 px, `prefers-reduced-motion`.
- **Idiomas.** Texto de interface vai para os seis dicionários (`i18n/*.json`); `npm run conferir:i18n` confere.
- **Nada inventado.** Dado, número, citação e fonte têm de existir.
- **Segredos.** Nunca ponha chave, token ou senha no código. As variáveis ficam no ambiente (veja `.env.example`).

## Antes de pedir a revisão

Rode o mesmo que o CI roda:

```bash
npm run lint
npm run typecheck
npm run conferir:i18n
npm run testar:banco
npm run build
```

Mudou o banco? Edite `supabase/install.sql` (ele roda inteiro de novo a cada instalação, então tudo precisa ser idempotente) e acrescente conferências em `scripts/testar-banco.mjs`, que roda um Postgres de verdade dentro do Node.

## Autoria e licença do que você enviar

Ao enviar uma contribuição, você concorda que ela seja publicada sob a mesma licença do projeto (AGPL 3.0 ou posterior para código; CC BY-SA 4.0 para conteúdo), de forma gratuita e irrevogável, e declara que tem o direito de enviá-la. Você continua autor e aparece no histórico do repositório.

Siga o [Código de conduta](CODE_OF_CONDUCT.md). Achou uma falha de segurança? Não abra issue pública: veja [SECURITY.md](SECURITY.md).
