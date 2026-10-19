# Texto para a página de privacidade: VLibras

Entra em `content/paginas/privacidade.md` **no mesmo dia em que o recurso `vlibras` for ligado** (veja `docs/RECURSOS.md`), nem antes nem depois. Sugestão de lugar: depois do parágrafo sobre os serviços públicos e abertos que o servidor do instituto consulta.

---

**Libras (VLibras).** No botão de acessibilidade há a opção de ativar o VLibras, o tradutor de português para Libras do Governo Federal. Ele só é carregado se você clicar em "Ativar" e confirmar o aviso. A partir daí, o seu navegador baixa o tradutor diretamente dos endereços do governo (o repositório oficial do VLibras e os serviços em vlibras.gov.br), e o texto que você escolher traduzir é enviado a esses serviços. Como em qualquer site, eles recebem o endereço de rede do seu aparelho. O próprio tradutor guarda no seu navegador a escolha de deixá-lo aberto. Se você marcar "Lembrar neste aparelho", o site guarda só essa escolha, e o tradutor passa a carregar sozinho nas próximas páginas; para desfazer, use "Não carregar sozinho" no mesmo lugar, ou apague tudo em [Meus dados](/meus-dados). O Instituto Lúcia não controla o VLibras. As tentativas do tradutor de enviar dados para serviços de métrica de terceiros são bloqueadas pela política de segurança do site, na página; o avatar roda num quadro à parte, sob as regras do próprio serviço.

---

## Para quem mantém

- Versão em uso: `VERSAO_VLIBRAS` em `lib/vlibras.ts` (hoje `v7.12.2`). O endereço `vlibras.gov.br/app` redireciona para o repositório `spbgovbr-vlibras/vlibras-portal` no jsDelivr; o site aponta direto para a versão fixa, sem redirecionamento.
- A política de segurança (`next.config.ts`) libera, só com o recurso ligado: `https://cdn.jsdelivr.net/gh/spbgovbr-vlibras/` (programa, estilos, imagens, fontes e o quadro do avatar) e `https://vlibras.gov.br`, `https://*.vlibras.gov.br` (tradução e dicionário). Não libera WebAssembly na página: o avatar roda dentro do quadro.
- Na versão 7.12.2, o código do tradutor que roda na página tenta chamar um serviço de métricas (PostHog). A política bloqueia; o tradutor segue funcionando.
- Ao trocar de versão: ative, abra o avatar, traduza um trecho e veja no console do navegador se a política barrou algo necessário.
