# Coxitas na Vercel: site, pedidos e painel

O site fica em **https://coxitas.vercel.app** e se atualiza sozinho a cada `git push` no GitHub (repositório DAVIZZINN/coxitas, branch main).
O link antigo do GitHub Pages (davizzinn.github.io/coxitas) leva as pessoas para o endereço da Vercel.

Como está montado:

| Parte | Onde fica | O que faz |
| --- | --- | --- |
| Site, fotos e vídeos | arquivos da raiz, `assets/` | servidos pela CDN da Vercel |
| API pública | `api/publico.js` | grava o pedido (o preço é recalculado no banco), mostra o andamento e a configuração da loja |
| API do painel | `api/admin.js` | só responde com sessão válida de alguém ativo na equipe |
| Login do painel | `api/auth.js` | código de 6 números no e-mail (principal) ou conta da Vercel (opcional) |
| Banco | Postgres (Neon) ligado pela Vercel | as tabelas são criadas sozinhas na primeira chamada (`lib/db.js`) |
| Segurança | `vercel.json` | cabeçalhos (CSP, anti-moldura, nosniff), rotas da API, cache |

Enquanto o banco não estiver ligado, o site continua funcionando e manda o pedido pelo WhatsApp.

## Entrar no painel (o jeito principal)

1. Abra https://coxitas.vercel.app/admin/
2. Digite o e-mail da equipe e toque em **Receber código**.
3. Chega um e-mail com um código de 6 números (olhe também o spam e as promoções). Digite o código: o painel abre sozinho.

* Só e-mails da equipe recebem código. Para qualquer outro e-mail a tela responde igual, mas nada é enviado
  (ninguém consegue descobrir quem é da equipe).
* O código vale por poucos minutos e uma vez só. Errar demais bloqueia o código; pedir códigos demais bloqueia por alguns minutos.
* O aparelho fica logado por 7 dias. **Sair**, desativar ou remover a pessoa derruba o acesso na hora.
* Quem está em `ADMIN_EMAILS` (hoje: daavi.magalhaess@gmail.com) é dono sempre.
* Quem gera e manda o código é o login do Neon (Managed Better Auth), que veio ligado junto com o banco
  (variável `NEON_AUTH_BASE_URL`). O site conversa com ele só pelo servidor.

### E-mail do código com o seu nome (opcional, recomendado depois)

O Neon manda o código por um servidor de e-mail compartilhado, feito para começar. Para a loja usar um remetente próprio
(menos chance de cair no spam): Vercel > **Storage** > banco Neon > **Open in Neon** > **Auth** > configurações de e-mail >
SMTP próprio (por exemplo o do Gmail com senha de app, ou Resend).

## Equipe

No painel, aba **Loja** > **Equipe** (só o dono vê):

* Adicione nome e e-mail. A pessoa já pode entrar pelo código que chega nesse e-mail.
* **Atendente** vê e atende pedidos. **Dono** também muda a loja, apaga testes e cuida da equipe.
* **Desativar** ou **Remover** derruba o acesso na hora, até de quem já está com o painel aberto.

## Banco de pedidos (já ligado)

Vercel > projeto **coxitas** > **Storage**: banco Neon `neon-almond-button`, região Washington (iad1), plano Free.
Ele cria as variáveis (`DATABASE_URL` e outras) sozinho. Se um dia trocar o banco, faça **Redeploy** depois.

## Entrar com a conta da Vercel (opcional)

O botão "Entrar com a conta da Vercel" só aparece quando as duas chaves abaixo estão certas.

1. Vercel > **Settings** (da conta) > **Apps** > abra o app **Coxitas Painel**.
2. Copie o **Client ID**: é um código que começa com `cl_` seguido de letras e números (não é uma frase).
3. Em **Authentication**, deixe ligado **client_secret_post** e gere um **Client Secret** (aparece uma vez só).
4. Em **Authorization Callback URLs** precisa estar exatamente: `https://coxitas.vercel.app/api/auth/retorno`
5. Em **Permissions**: **openid**, **email** e **profile**.
6. Projeto **coxitas** > **Settings** > **Environment Variables**: edite `VERCEL_APP_CLIENT_ID` (cole o `cl_...`)
   e `VERCEL_APP_CLIENT_SECRET` (cole o segredo). Marque Production e Preview.
7. **Deployments** > menu **...** do último > **Redeploy**. Variável nova ou mudada só vale depois de um deploy novo.

## Análise de visitas

Projeto **coxitas** > aba **Analytics** > **Enable** (Web Analytics). O site já tem o código.

## Área de entrega

* O cliente escreve rua, número, bairro e complemento. Assim que termina a rua, o site confere no mapa
  (OpenStreetMap, pelo servidor) se ela existe em Votuporanga e a quantos km fica da loja.
* Rua que não existe não passa. Rua fora do raio também não: o site sugere retirar na loja ou falar pelo WhatsApp.
  O servidor confere de novo na hora de gravar o pedido (não dá para burlar pelo navegador).
* O raio fica no painel, aba **Loja** > **Raio de entrega** (começa em 12 km em linha reta; Votuporanga inteira cabe,
  Valentim Gentil fica a uns 14,5 km). O pedido mostra no painel a distância aproximada.
* O mapa de Votuporanga quase não tem número de casa: a conferência é da rua. O número e o bairro vão para o entregador.
* Se o mapa estiver fora do ar, o site avisa e oferece mandar o pedido pelo WhatsApp.

## Pedido em andamento

Depois de pedir, se a pessoa fechar a página, quando abrir o site de novo aparece um cartão no topo com o número do
pedido, a etapa (recebido, confirmado, em preparo, saiu para entrega) e o botão para acompanhar. Ele some quando o
pedido é cancelado, ou 40 minutos depois de entregue. O X esconde até a próxima mudança de etapa.

## Como o painel se atualiza

O painel confere os pedidos a cada 10 segundos (pedido novo aparece com aviso e som, se o som estiver ligado).
Para não gastar a cota grátis do banco à toa, ele confere a cada 5 minutos quando a loja está fechada no painel
ou quando ninguém mexe nele há 3 horas sem pedido em andamento. Qualquer toque na tela volta ao normal.
Dica: ao parar de atender, desligue **Recebendo pedidos pelo site** na aba Loja.

## Manutenção

* Mudou preço, produto ou sabor no `index.html`? Rode `node banco/gerar.mjs` e publique. A API atualiza o banco sozinha.
* Mexeu no script escrito dentro do `index.html` ou do `404.html`? Rode `node ferramentas/cabecalhos.mjs`.
* Domínio próprio: projeto > **Settings** > **Domains** > Add. Depois rode
  `node ferramentas/trocar-endereco.mjs https://www.seudominio.com.br/` e publique. Se usar o botão da Vercel,
  adicione também `https://www.seudominio.com.br/api/auth/retorno` no app.
* Testar no computador: `review-coxitas/backend/vercel-local.mjs` imita a Vercel com um Postgres em memória
  (`MOCK_VERCEL=1` finge o login da Vercel e o código do Neon). Pedidos feitos em `localhost` ou com `?teste=1` ficam marcados como teste.
