/* Coxitas · ligação com o banco de pedidos (Supabase).
   Preencha depois de criar o projeto (passo a passo em supabase/LEIA-ME.md):
   Supabase > Project Settings > API > "Project URL" e a chave "anon public".
   A chave anon é pública por natureza (vai para o navegador de qualquer visitante). Quem protege os pedidos são as
   permissões do banco (RLS e as funções do 01-estrutura.sql). NUNCA coloque aqui a chave "service_role".
   Vazio = o site continua mandando o pedido pelo WhatsApp e o painel avisa que falta configurar. */
window.COXITAS = {
  supabaseUrl: '',
  supabaseChave: '',
};
