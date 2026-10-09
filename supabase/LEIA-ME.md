# Ligar o banco de pedidos e o painel da Coxitas

Enquanto o `assets/config.js` estiver vazio, o site funciona como antes: o pedido vai pronto para o WhatsApp,
o `/pedido/` avisa que o acompanhamento ainda não está ligado e o `/admin/` avisa que falta ligar o banco.
Depois destes passos (uns 15 minutos), o pedido passa a ser gravado com número, aparece no painel na hora e o
cliente acompanha o andamento.

## 1. Criar o projeto (conta da loja, não a sua pessoal)
1. Entre em https://supabase.com, crie a conta e um projeto novo.
2. Região: **South America (São Paulo)**. Guarde a senha do banco num lugar seguro (não vai para o site).

> Plano grátis: o Supabase pausa o projeto depois de 7 dias **sem nenhum acesso**. Com o site recebendo visitas
> isso não costuma acontecer, mas se pausar, os pedidos voltam para o WhatsApp sozinhos até reativar o projeto
> no painel do Supabase. O plano pago (Pro) não pausa e tem backup diário.

## 2. Criar as tabelas e as permissões
No Supabase, abra **SQL Editor > New query**:
1. Cole o arquivo `01-estrutura.sql` inteiro e clique em **Run**.
2. Cole o `02-cardapio.sql` e clique em **Run** (cardápio e preços, gerados a partir do site).

Os dois podem ser rodados de novo sem apagar pedidos.

## 3. Fechar o cadastro e criar as contas da equipe
1. **Authentication > Sign In / Providers**: desligue **Allow new users to sign up** (ninguém se cadastra sozinho).
2. **Authentication > Users > Add user > Create new user**: e-mail e senha forte do dono, com **Auto Confirm User** marcado.
3. Dê acesso ao painel no **SQL Editor** (troque o nome e o e-mail):

```sql
insert into public.equipe (user_id, nome, papel)
select id, 'Nome do dono', 'dono' from auth.users where email = 'email-do-dono@exemplo.com';
```

Para um funcionário, crie a conta do mesmo jeito e use `'atendente'` no lugar de `'dono'`
(atendente vê e atende os pedidos; só o dono muda taxa, pagamentos e pausa). Para tirar o acesso de alguém:

```sql
update public.equipe set ativo = false where user_id = (select id from auth.users where email = 'email@exemplo.com');
```

Conta que fizer login mas não estiver na tabela `equipe` vê só "Esta conta não tem acesso" e o banco não entrega nada.

## 4. Ligar o site ao banco
1. **Project Settings > API** (ou **Data API**): copie a **Project URL** e a chave **anon public**.
2. Cole as duas em `assets/config.js`:

```js
window.COXITAS = {
  supabaseUrl: 'https://SEU-PROJETO.supabase.co',
  supabaseChave: 'eyJ...a chave anon public...',
};
```

3. Suba a versão do `config.js` no `index.html`, em `pedido/index.html` e em `admin/index.html` (`config.js?v=2`),
   faça commit e push.

**Nunca** coloque a chave `service_role` no site: ela passa por cima de todas as permissões.
A chave `anon` é pública de propósito; quem protege os pedidos são as regras do banco (RLS e as funções do `01-estrutura.sql`).

4. **Authentication > URL Configuration > Site URL**: `https://davizzinn.github.io/coxitas/admin/`
   (ou o domínio novo, se trocar).

## 5. Conferir (com pedido de teste)
1. Abra o site com `?teste=1` no fim do endereço (ex.: `https://davizzinn.github.io/coxitas/?teste=1`) e faça um pedido.
   Pedido feito assim fica marcado como **teste**.
2. Abra `/admin/`, entre com a conta do dono e marque **Mostrar testes**: o pedido tem que estar lá.
3. Mude o status (Confirmar, Começar o preparo, ...) e abra o link **Acompanhar o pedido** que apareceu no site:
   o andamento tem que mudar sozinho em até 30 segundos.
4. Faça outro pedido com o painel aberto: ele tem que aparecer sozinho (indicador **Ao vivo** verde).
5. Em **Loja**, confira as **formas de pagamento** que a Coxitas aceita de verdade e a **taxa de entrega**
   (vazio = a combinar). Depois, em **Loja > Pedidos de teste**, apague os testes.

## Dia a dia
- **Mudou um preço ou item no site?** Rode `node supabase/gerar-cardapio.mjs` e cole o `02-cardapio.sql` novo no SQL Editor.
  O pedido usa o preço do banco (o cliente não consegue mudar o valor pelo navegador).
- **Pausar pedidos pelo site** (feriado, acabou o estoque): painel > **Loja** > desligue "Recebendo pedidos pelo site".
  O site passa a mandar o cliente para o WhatsApp com o aviso que você escrever.
- **Som de pedido novo**: botão do sino no painel (o navegador só toca depois de um clique na página).
- **Imprimir para a cozinha**: abra o pedido > "Imprimir para a cozinha".

## Segurança, em resumo
- Toda tabela tem RLS ligado. Visitante só consegue **criar pedido**, **acompanhar o próprio pedido** (com o código do
  link, ou com o número + 4 últimos dígitos do telefone, com limite de 5 tentativas erradas por hora) e ler a
  configuração pública (taxa, formas de pagamento, se está aceitando pedidos).
- O preço, o subtotal e o total são calculados no banco. Até 6 pedidos por telefone por hora e 40 por loja a cada 5 minutos.
- O painel só funciona com login **e** cadastro ativo na tabela `equipe`. As mudanças de status seguem uma ordem
  (não dá para concluir pedido cancelado, por exemplo) e ficam no histórico com horário e quem fez.
- O acompanhamento do cliente não mostra telefone, endereço nem nome completo.

## Domínio próprio
Recomendado: `coxitassalgados.com.br` (livre em 09/10/2026) ou `coxitas.com` (livre). O `coxitas.com.br` já está
registrado desde 07/10/2026 por outra pessoa/empresa: vale perguntar ao dono se foi ele.
1. Registre no nome da loja (Registro.br para `.com.br`).
2. Rode `node ferramentas/trocar-endereco.mjs https://www.SEUDOMINIO.com.br/`, faça commit e push.
3. No Registro.br, crie os registros DNS do GitHub Pages: `www` como CNAME para `davizzinn.github.io`, e o domínio
   sem `www` com os 4 registros A do GitHub (185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153).
4. No GitHub: repositório > Settings > Pages > Custom domain = `www.SEUDOMINIO.com.br` e marque **Enforce HTTPS**.
   O endereço antigo (`davizzinn.github.io/coxitas/`) passa a redirecionar sozinho para o novo.
5. No Supabase, troque o **Site URL** (passo 4.4).

Sem gastar nada: criar a organização gratuita **coxitas** no GitHub (o nome estava livre em 09/10/2026), transferir o
repositório para ela com o nome `coxitas.github.io` e rodar o `trocar-endereco.mjs https://coxitas.github.io/`.
