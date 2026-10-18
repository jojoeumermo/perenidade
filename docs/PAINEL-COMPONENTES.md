# Componentes do painel

O painel existe só em português e usa a mesma identidade do site (pergaminho, tinta, bordô e vermelho; EB Garamond,
Inter e IBM Plex Mono; tema claro e escuro). Antes de criar um elemento novo, procure aqui.

## Estilos prontos (`components/painel/comum.tsx`)

| Nome | Para quê |
| --- | --- |
| `campo` | Campo de texto, seleção e área de texto. |
| `botao` | Botão principal (fundo tinta). Uma ação principal por bloco. |
| `botaoClaro` | Botão secundário (contorno). |
| `elo` | Ação discreta, com cara de link (Abrir, Remover…). |
| `rotulo` | Etiqueta pequena em monoespaçada dourada, acima de títulos. |
| `painel-cartao` (classe CSS) | Cartão com fundo e fio claro: use em vez de bordas pretas grossas. |

Ação perigosa (apagar, desligar, devolver, enviar para muitas pessoas) sempre com confirmação que diz exatamente o que vai
acontecer: `window.confirm("Apagar “X”? Não tem volta.")` ou, quando pede mais cuidado, duas etapas (veja Apagar minha conta).

## Componentes

| Componente | Onde | Uso |
| --- | --- | --- |
| `Aviso` | comum.tsx | Linha de retorno sob a ação (`role="status"`): “Salvo ✓”, erro claro. Sempre presente, vazia quando não há nada. |
| `Abas` | comum.tsx | Abas de uma seção (`role="tablist"`), com contador opcional. |
| `useLista` | comum.tsx | Carrega uma função do banco e recarrega quando outro painel avisa que algo mudou. |
| `useAcao` | comum.tsx | Executa uma ação, mostra “ocupado”, a mensagem de sucesso ou o erro traduzido (`textoDoErro`). |
| `CampoData` | Campos.tsx | Data em português (dd/mm/aaaa), com calendário próprio; valor AAAA-MM-DD. Teclado: setas, Enter, Esc. |
| `CampoArquivo` | Campos.tsx | Arrastar e soltar (ou clicar), confere tipo e tamanho; nada de “Choose File”. |
| `Selo` | MinhaConta.tsx | Estado com palavra e cor (ok, atenção, erro), nunca só cor. |
| `Avatar` | Avatar.tsx | Foto, desenho ou iniciais da pessoa. |

## Regras de escrita e acessibilidade

- Texto de leitura com 14 px ou mais; parágrafos curtos; listas e passos numerados em vez de blocos longos.
- Título, descrição curta, ação: nessa ordem.
- Todo campo com rótulo visível; erro em `role="alert"` perto do campo.
- Foco visível e tudo alcançável pelo teclado; diálogos fecham com Esc e devolvem o foco.
- Nada depende só de cor: “✓ aprovado”, “✗ falhou”, “! atenção”.
- Testar no tema claro e no escuro e na largura de celular.
- Ação de risco testada com uma conta sem privilégios e com a conta da coordenação.
