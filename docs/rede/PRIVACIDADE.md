# Rede Lúcia v2: privacidade e dados (ESPEC, seção 7)

O que a Rede guarda, por quê, por quanto tempo e quem vê. Vale para o pacote de moderação e serve de base para os outros. Conferido no planalto.gov.br em 04/11/2026.
Não é parecer jurídico.

## 1. Princípios

- **Só codinome.** Ninguém aparece na Rede com o nome de verdade, nem a equipe. O nome do painel nunca sai por função da Rede.
- **Sem rastreamento.** Nada de pixel, de tempo de leitura, de histórico do que cada pessoa abriu. Contagens são agregadas. O nível de confiança conta o que a pessoa **faz**
  (apoios, úteis, salvos, posts), nunca o que ela lê.
- **Sem endereço de IP guardado.** A Rede não grava IP. O freio contra abuso por visitante usa um contador por origem sem guardar o endereço.
- **Minimização.** CPF, telefone e e-mail no texto do post são recusados. EXIF e GPS saem das imagens no navegador e no servidor (pacote publicar).
- **Sem chat privado.** Menos dado, menos risco.

## 2. Dados que a moderação guarda

| Dado | Para quê | Quem vê | Por quanto tempo |
| --- | --- | --- | --- |
| Denúncia (alvo, categoria, texto, situação, protocolo) | tratar a denúncia | a moderação do lugar | enquanto a decisão puder ser contestada; depois, só o necessário para o registro |
| **Conta de quem denunciou** | avisar o andamento; atender ao ECA Digital, art. 29, § 2º (notificante identificável) | **só a própria pessoa**; nunca a moderação, nunca o autor | até a denúncia ser encerrada e o prazo de recurso passar |
| Registro de moderação (ação, regra, motivo, quem decidiu, quando) | prestar contas, garantir o recurso, evitar abuso | a moderação; o motivo e a regra, a quem foi moderado (sem dizer quem decidiu) | só inserção, não se apaga nem altera; revisão da retenção com a assessoria jurídica |
| Recurso (texto, decisão, quem revisou) | contraditório | a moderação; a decisão, a quem recorreu | junto do registro |
| Silenciados (pessoa, conversa, comunidade, palavra) | filtrar a linha de quem silenciou | **só quem silenciou**; nunca o silenciado | até a pessoa desfazer ou a validade acabar |
| Listas de bloqueio da mediação | proteger a comunidade ou o núcleo | só a mediação do lugar | até a mediação retirar |
| Rótulo de desinformação (post, slug da checagem) | avisar que há checagem | quem pode ver o post | junto do post |
| Nível de confiança | limites de links, imagens e posts por dia | só a própria pessoa e a moderação (na fila) | calculado na hora, não guardado |

Dado de moderação **não vai** para prévia de link (OG), busca de fora, exportação pública nem contagem: a matriz de visibilidade (`interno.rede_ve`) vale para todos eles.

## 3. LGPD (Lei 13.709/2018)

- **Art. 5º, II**: opinião política e filiação sindical são dado pessoal **sensível**. Uma conversa política numa rede de luta pode revelar isso; por isso o número de apoios
  só aparece para o autor, o "eu vou" só para quem organizou, e **ninguém vê lista de nomes**. Silenciar e denunciar também não expõem ninguém.
- **Art. 11, I**: consentimento **específico e destacado**, para finalidades específicas. É a caixa própria da primeira entrada (`rede_aderir`), com a versão das normas guardada em
  `rede_consentimentos`, revogável.
- **Art. 14**: dado de criança e adolescente só no **melhor interesse** deles. A Rede é **só para maiores de 18 anos** (decisão aprovada em 30/10/2026): não trata dado de menor de propósito.
  Se um menor aparecer, a categoria `menores` da denúncia é prioridade 1.
- **Art. 18**: acesso, correção e eliminação. A pessoa vê o que a moderação fez sobre ela em "Denúncias e recursos" (regra, motivo, prazo) e silencia ou apaga o que é dela. Pedido de
  eliminação do que foi tratado por consentimento segue o canal do Instituto; o registro de moderação só se retira por decisão formal, porque é a prova de que o processo foi cumprido.
- **Art. 7º**: bases legais: consentimento e execução da atividade educativa; segurança da própria plataforma para o registro de moderação.

## 4. ECA Digital (Lei 15.211/2025)

- **Art. 9º, § 1º**: veda a **autodeclaração** como verificação de idade para conteúdo impróprio a menores. `rede_aderir` é só autodeclaração de 18 anos: é trava mínima de produto, **não aferição**.
  A Rede não hospeda conteúdo adulto e não tem chat privado, o que reduz, mas não elimina, o risco. **Ponto de revisão jurídica antes de ligar para todos.**
- **Arts. 28 a 30 e 33**: canal de denúncia, retirada sem ordem judicial após notificação identificável, devido processo e procedimento contra abuso do canal: veja `docs/rede/MODERACAO.md`, seção 8.

## 5. Marco Civil (Lei 12.965/2014) e o STF

- **Art. 15**: registros de acesso a aplicações de internet. A Rede não os grava; se a assessoria jurídica entender que a Rede se enquadra na guarda, é decisão a tomar fora desta migração.
- **Art. 19 e art. 21; Temas 987 e 533 do STF**: notificação, devido processo, canal permanente. Cumprido por denúncia com protocolo, fila, registro, aviso e recurso (`docs/rede/MODERACAO.md`).
- **Código Penal, arts. 138 a 140** (calúnia, difamação, injúria): têm categoria de denúncia (`assédio`, `ódio`, `outro`) e recurso com contraditório; a retirada por notificação é possível, a
  responsabilização segue a Justiça.

## 6. Direitos de quem é moderado

Aviso com a **regra** e o **motivo**; saber se a decisão foi de uma **pessoa** ou automática; **recurso em até 30 dias**, revisto por **outra** pessoa; decisão final registrada; reversão que desfaz o
efeito (post volta, banimento sai) e deixa de contar contra o nível de confiança.

## 7. Pendências para a assessoria jurídica

1. Aferição de idade (ECA Digital, art. 9º, § 1º) antes de abrir para todos.
2. Retenção do registro de moderação e da conta de quem denunciou depois do encerramento.
3. Guarda de registros de acesso (Marco Civil, art. 15): a Rede não grava IP; confirmar que é a leitura correta.
4. Relatório anual de transparência sobre notificações (tese do STF): os números saem do registro; falta o formato.

## 8. Contagens na vitrine das comunidades (T32, 07/11/2026)

O Jonathan pediu contagens na vitrine (`/comunidade/comunidades`) para ela não parecer 77 cartões iguais. A decisão antiga era
"nenhuma contagem de membros", porque estar numa comunidade de luta pode revelar opinião política (dado sensível, LGPD, art. 5º,
II e art. 11). As duas coisas cabem juntas assim:

- Só **atividade da semana**, nunca membros: quantos posts e quantas pessoas escreveram ali nos últimos 7 dias. Quem só lê não
  conta em lugar nenhum.
- **Agregado e anônimo**: nenhum nome, nenhuma lista, nada por pessoa. Pessoas só aparecem a partir de 3; abaixo disso, a tela
  diz "poucas pessoas" (o banco devolve nulo), para que "1 pessoa" não aponte alguém (minimização, art. 6º, III).
- Visitante vê, das lutas e do Instituto, só nome, descrição e regras, sem contagem e sem post; a página da luta continua fechada
  para quem não tem conta.
- A ordem é pública e escrita na tela: mais posts na semana primeiro, depois alfabética. Sem algoritmo.
