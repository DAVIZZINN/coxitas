# Ligar o banco de pedidos e o painel da Coxitas (passo a passo)

Enquanto o `assets/config.js` estiver vazio, o site funciona como antes: o pedido vai pronto para o WhatsApp,
o `/pedido/` avisa que o acompanhamento ainda não está ligado e o `/admin/` avisa que falta ligar o banco.
Depois destes passos (uns 15 minutos), o pedido passa a ser gravado com número, aparece no **Quadro de pedidos**
do painel na hora (como no gestor do iFood) e o cliente acompanha o andamento.

## 1. Criar o projeto (de preferência na conta da loja)
1. Entre em https://supabase.com e crie a conta (pode ser com o GitHub ou e-mail).
2. **New project**: nome `coxitas`, região **South America (São Paulo)**, crie uma senha do banco e guarde
   num lugar seguro (ela não vai para o site).
3. Espere 1 a 2 minutos até o projeto ficar pronto.

> Plano grátis: o Supabase pausa o projeto depois de 7 dias **sem nenhum acesso**. Com o site recebendo visitas
> isso não costuma acontecer; se pausar, os pedidos voltam para o WhatsApp sozinhos até reativar o projeto
> no painel do Supabase. O plano Pro não pausa e tem backup diário.

## 2. Criar a conta de quem vai entrar no painel
1. Menu da esquerda: **Authentication > Users > Add user > Create new user**.
2. Coloque o e-mail e uma senha forte do dono e marque **Auto Confirm User**. Clique em **Create user**.

## 3. Instalar o banco (um arquivo só)
1. Abra o arquivo `supabase/instalar.sql` (no computador ou no GitHub) e, **lá no fim**, troque
   `EMAIL-DO-DONO@exemplo.com` pelo e-mail que você criou no passo 2 (e `Dono da Coxitas` pelo nome).
2. No Supabase: **SQL Editor > New query**, cole o arquivo inteiro e clique em **Run**.
3. O resultado no fim tem que mostrar uma linha com o e-mail do dono e o papel `dono`. Pronto: tabelas,
   permissões, cardápio, tempo real e o acesso do dono foram criados. Pode rodar de novo sem apagar pedidos.

## 4. Fechar o cadastro
**Authentication > Sign In / Providers**: desligue **Allow new users to sign up**. Assim ninguém cria conta
sozinho (e mesmo quem tivesse conta não veria nada sem estar na equipe).

## 5. Ligar o site
1. **Project Settings > API** (ou **Data API**): copie a **Project URL** e a chave **anon public**
   (às vezes chamada de **publishable key**).
2. Mande as duas para o David/Claude, ou cole em `assets/config.js`:

```js
window.COXITAS = {
  supabaseUrl: 'https://SEU-PROJETO.supabase.co',
  supabaseChave: 'a chave anon public',
};
```

3. Suba a versão do `config.js` em `index.html`, `pedido/index.html` e `admin/index.html` (`config.js?v=2`),
   faça commit e push.
4. **Authentication > URL Configuration > Site URL**: `https://davizzinn.github.io/coxitas/admin/`.

**Nunca** coloque a chave `service_role` (nem a senha do banco) no site: ela passa por cima de todas as
permissões. A chave anon é pública de propósito; quem protege os pedidos são as regras do banco.

## 6. Conferir (com pedido de teste)
1. Abra o site com `?teste=1` no fim do endereço (`https://davizzinn.github.io/coxitas/?teste=1`) e faça um pedido.
   Pedido feito assim fica marcado como **teste**.
2. Abra `https://davizzinn.github.io/coxitas/admin/`, entre com o e-mail e a senha do passo 2 e marque
   **Mostrar testes**: o pedido aparece na coluna **Novos** do Quadro.
3. Toque no sino (som ligado), faça outro pedido de teste: ele tem que aparecer sozinho, com aviso e toque
   (o toque repete a cada 20 segundos enquanto houver pedido sem aceitar, como no iFood).
4. **Aceitar pedido** > **Começar o preparo** > **Saiu para entrega** (ou **Pronto para retirada**) > **Entregue**.
   O link **Acompanhar o pedido** que o cliente recebeu mostra cada passo.
5. Em **Loja**, confira as **formas de pagamento** que a Coxitas aceita de verdade e a **taxa de entrega**
   (vazio = a combinar). Depois apague os testes em **Loja > Pedidos de teste**.

## Funcionários
Crie a conta como no passo 2 e rode no SQL Editor (troque o e-mail e o nome):

```sql
insert into public.equipe (user_id, nome, papel)
select id, 'Nome do atendente', 'atendente' from auth.users where email = 'email@exemplo.com';
```

Atendente vê e atende os pedidos; só o dono muda taxa, pagamentos e pausa. Para tirar o acesso:

```sql
update public.equipe set ativo = false where user_id = (select id from auth.users where email = 'email@exemplo.com');
```

Senha esquecida: **Authentication > Users**, clique na conta e use **Send password recovery** (ou crie outra senha).

## Dia a dia no painel
- **Quadro**: os pedidos em andamento em colunas (Novos, Em preparo, Prontos e a caminho, Finalizados hoje).
  Cada cartão mostra há quanto tempo o pedido chegou (fica amarelo e depois vermelho quando demora), cliente,
  itens, endereço, pagamento e total, com o botão do próximo passo. **Recusar** abre o pedido para cancelar com motivo.
- **Painel**: números do período (recebidos, novos, em preparo, prontos, concluídos, cancelados, vendido).
- **Pedidos**: busca por número, nome ou telefone, filtros por status e data, detalhes, WhatsApp e ligar para o
  cliente, histórico e impressão para a cozinha.
- **Loja**: pausar pedidos pelo site, taxa de entrega, pedido mínimo, formas de pagamento, apagar testes.
- **Mudou um preço ou item no site?** Rode `node supabase/gerar-cardapio.mjs` e cole o `02-cardapio.sql` no SQL Editor.

## Segurança, em resumo
- Toda tabela tem RLS ligado. Visitante só consegue criar pedido, acompanhar o próprio pedido (com o código do
  link, ou número + 4 últimos dígitos do telefone, com limite de 5 tentativas erradas por hora) e ler a
  configuração pública.
- O preço, o subtotal e o total são calculados no banco. Até 6 pedidos por telefone por hora e 40 por loja a cada 5 minutos.
- O painel só funciona com login **e** cadastro ativo na tabela `equipe`. As mudanças de status seguem uma ordem e
  ficam no histórico com horário e quem fez. O acompanhamento do cliente não mostra telefone, endereço nem nome completo.

## Domínio próprio
Livres em 09/10/2026: `coxitassalgados.com.br` e `coxitas.com`. O `coxitas.com.br` já está registrado por outra
pessoa desde 07/10/2026 (perguntar ao dono se foi ele).
1. Registre no nome da loja (Registro.br para `.com.br`).
2. Rode `node ferramentas/trocar-endereco.mjs https://www.SEUDOMINIO.com.br/`, faça commit e push.
3. No Registro.br: `www` como CNAME para `davizzinn.github.io`, e o domínio sem `www` com os registros A do GitHub
   (185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153).
4. GitHub: repositório > Settings > Pages > Custom domain = `www.SEUDOMINIO.com.br` e **Enforce HTTPS**.
   O endereço antigo passa a redirecionar sozinho.
5. Supabase: troque o **Site URL** (passo 5.4).
