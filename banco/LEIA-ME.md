# Coxitas na Vercel: site, pedidos e painel

O site fica em **https://coxitas.vercel.app** e se atualiza sozinho a cada `git push` no GitHub (repositório DAVIZZINN/coxitas, branch main).
O link antigo do GitHub Pages (davizzinn.github.io/coxitas) leva as pessoas para o endereço da Vercel.

Como está montado:

| Parte | Onde fica | O que faz |
| --- | --- | --- |
| Site, fotos e vídeos | arquivos da raiz, `assets/` | servidos pela CDN da Vercel |
| API pública | `api/publico.js` | grava o pedido (o preço é recalculado no banco), mostra o andamento e a configuração da loja |
| API do painel | `api/admin.js` | só responde com sessão válida de alguém ativo na equipe |
| Login do painel | `api/auth.js` | "Sign in with Vercel": a pessoa entra com a conta da Vercel e o site confere o e-mail |
| Banco | Postgres (Neon) ligado pela Vercel | as tabelas são criadas sozinhas na primeira chamada (`lib/db.js`) |
| Segurança | `vercel.json` | cabeçalhos (CSP, anti-moldura, nosniff), rotas da API, cache |

Enquanto o banco não estiver ligado, o site continua funcionando e manda o pedido pelo WhatsApp.

## O que só o dono da conta pode fazer (uma vez só)

### 1. Ligar o banco de pedidos (grátis)

1. Entre em https://vercel.com, abra o projeto **coxitas**.
2. Aba **Storage** > **Create Database** > **Neon (Serverless Postgres)** > Continue.
3. Plano **Free**. Região: **Washington, D.C., USA (iad1)** (fica junto das funções do site, que rodam lá).
4. Nome: `coxitas-pedidos`. Confirme.
5. Na tela seguinte, conecte ao projeto **coxitas** marcando **Production** e **Preview**, sem mudar o prefixo das variáveis
   (deixe em branco ou `DATABASE`). Isso cria a variável `DATABASE_URL` sozinha (é secreta, nunca vai para o navegador).

### 2. Criar o login com a Vercel (grátis)

1. Na Vercel, menu da esquerda > **Settings** (da conta, não do projeto) > **Apps** > **Create**.
2. Nome: `Coxitas Painel`. Salve.
3. Em **Authentication**, deixe ligado **client_secret_post**.
4. Clique em **Generate** para criar o **Client Secret**. Copie e guarde: ele aparece uma vez só.
5. Em **Authorization Callback URLs**, adicione exatamente:
   `https://coxitas.vercel.app/api/auth/retorno`
6. Em **Permissions**, ligue **openid**, **email** e **profile**. Salve.
7. Em **Sign-In Access**, deixe **Anyone with a Vercel account** (quem pode entrar no painel é decidido pela equipe da loja, não pela Vercel).

### 3. Colocar as chaves no projeto

Projeto **coxitas** > **Settings** > **Environment Variables**. Crie, marcando **Production** e **Preview**:

| Nome | Valor | Tipo |
| --- | --- | --- |
| `VERCEL_APP_CLIENT_ID` | o Client ID do app (começa com `cl_`) | normal |
| `VERCEL_APP_CLIENT_SECRET` | o Client Secret do passo 2.4 | **Sensitive** |
| `ADMIN_EMAILS` | e-mail de quem é dono, separados por vírgula | normal (já criada) |

Depois: aba **Deployments** > no último deploy, menu **...** > **Redeploy**. As variáveis só valem para deploys novos.

### 4. Ligar a análise de visitas (grátis)

Projeto **coxitas** > aba **Analytics** > **Enable** (Web Analytics). O site já tem o código; os números começam a aparecer depois de alguns minutos.

## Entrar no painel

1. Abra https://coxitas.vercel.app/admin/ e toque em **Entrar com a Vercel**.
2. A Vercel pede para autorizar o app **Coxitas Painel** (só na primeira vez).
3. O site confere a assinatura do login, se o e-mail está **verificado** na Vercel e se ele está na equipe da loja.
   Quem está em `ADMIN_EMAILS` vira dono no primeiro login.

Nenhuma senha passa pelo site da Coxitas. A sessão dura 12 horas e o cookie é protegido (HttpOnly, Secure, SameSite=Strict).

## Equipe

No painel, aba **Loja** > **Equipe** (só o dono vê):

* Adicione nome e e-mail. A pessoa cria uma conta grátis na Vercel com esse mesmo e-mail (pode ser com Google, GitHub ou e-mail) e entra pelo botão do painel.
* **Atendente** vê e atende pedidos. **Dono** também muda a loja, apaga testes e cuida da equipe.
* **Desativar** ou **Remover** derruba o acesso na hora, até de quem já está com o painel aberto.

## Como o painel se atualiza

O painel confere os pedidos a cada 10 segundos (pedido novo aparece com aviso e som, se o som estiver ligado).
Para não gastar a cota grátis do banco à toa, ele confere a cada 5 minutos quando a loja está fechada no painel
ou quando ninguém mexe nele há 3 horas sem pedido em andamento. Qualquer toque na tela volta ao normal.
Dica: ao parar de atender, desligue **Recebendo pedidos pelo site** na aba Loja.

## Manutenção

* Mudou preço, produto ou sabor no `index.html`? Rode `node banco/gerar.mjs` e publique. A API atualiza o banco sozinha.
* Mexeu no script escrito dentro do `index.html` ou do `404.html`? Rode `node ferramentas/cabecalhos.mjs`.
* Domínio próprio: projeto > **Settings** > **Domains** > Add. Depois rode
  `node ferramentas/trocar-endereco.mjs https://www.seudominio.com.br/`, publique e adicione o novo endereço de retorno
  (`https://www.seudominio.com.br/api/auth/retorno`) no app de login.
* Testar no computador: `review-coxitas/backend/vercel-local.mjs` imita a Vercel com um Postgres em memória
  (`MOCK_VERCEL=1` finge o login da Vercel). Pedidos feitos em `localhost` ou com `?teste=1` ficam marcados como teste.
