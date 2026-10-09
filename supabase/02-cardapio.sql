-- Gerado por supabase/gerar-cardapio.mjs a partir do index.html em 2026-10-09. Não edite à mão:
-- mude o preço no site e rode o gerador de novo.
-- 15 produtos e 7 sabores.

insert into public.produtos (id, nome, detalhe, preco_centavos, pede_sabores, ativo, ordem) values
  ('combo-individual', 'Combo Fome Individual', '20 salgados à escolha + 1 Guaraná Antártica 350ml', 2290, true, true, 0),
  ('combo-dupla', 'Combo Dupla Fome', '40 salgados à escolha + 2 Guaraná Antártica 350ml', 4490, true, true, 1),
  ('combo-familia', 'Combo Fome Família', '60 salgados + 20 mini churros + 1 Guaraná Antártica 2L', 7390, true, true, 2),
  ('combo-galera', 'Combo Fome Galera', '100 salgados + 30 mini churros + 1 Guaraná Antártica 2L', 11290, true, true, 3),
  ('salgados-30', 'Salgados', '30 unidades', 2390, true, true, 4),
  ('salgados-50', 'Salgados', '50 unidades', 4290, true, true, 5),
  ('salgados-80', 'Salgados', '80 unidades', 6290, true, true, 6),
  ('salgados-100', 'Salgados', '100 unidades', 7490, true, true, 7),
  ('churros-10', 'Mini Churros 20g', '10 unidades', 1000, false, true, 8),
  ('churros-20', 'Mini Churros 20g', '20 unidades', 1890, false, true, 9),
  ('churros-30', 'Mini Churros 20g', '30 unidades', 2790, false, true, 10),
  ('churros-40', 'Mini Churros 20g', '40 unidades', 3690, false, true, 11),
  ('churros-50', 'Mini Churros 20g', '50 unidades', 4690, false, true, 12),
  ('churros-80', 'Mini Churros 20g', '80 unidades', 7190, false, true, 13),
  ('churros-100', 'Mini Churros 20g', '100 unidades', 8990, false, true, 14)
on conflict (id) do update set nome = excluded.nome, detalhe = excluded.detalhe, preco_centavos = excluded.preco_centavos,
  pede_sabores = excluded.pede_sabores, ativo = true, ordem = excluded.ordem;

-- o que saiu do site fica inativo (não aparece e não pode ser pedido), mas continua nos pedidos antigos
update public.produtos set ativo = false where id not in ('combo-individual', 'combo-dupla', 'combo-familia', 'combo-galera', 'salgados-30', 'salgados-50', 'salgados-80', 'salgados-100', 'churros-10', 'churros-20', 'churros-30', 'churros-40', 'churros-50', 'churros-80', 'churros-100');

update public.loja_config set sabores = array['Coxinha', 'Bolinho de queijo', 'Bolinho de carne', 'Risole', 'Enroladinho de salsicha', 'Quibe', 'Bolinho de calabresa'] where id = 1;
