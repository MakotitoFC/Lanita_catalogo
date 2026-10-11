-- Lanita · seed inicial (idempotente solo tras `supabase db reset`).
-- No contiene datos personales ni credenciales.

insert into public.categorias (nombre, slug, orden) values
  ('Porta velas', 'porta-velas', 1),
  ('Macetas',     'macetas',     2),
  ('Bandejas',    'bandejas',    3),
  ('Combos',      'combos',      4),
  ('Decoración',  'decoracion',  5);

insert into public.categorias_gasto (nombre, slug, descripcion) values
  ('Materia prima', 'materia-prima', 'Cemento, arena, pinturas, barniz, resina'),
  ('Empaque y envoltorio', 'empaque', 'Cartón, papel seda, goma eva, bolsas'),
  ('Sellos',        'sellos',        'Sellos y marca para empaques'),
  ('Moldes',        'moldes',        'Moldes encargados a Temu'),
  ('Herramientas',  'herramientas',  'Pinceles, espátulas, balanza, etc.'),
  ('Envío y paquetería', 'envio',    'Courier, despachos y paquetería'),
  ('Fotos y contenido', 'fotos-y-contenido', 'Producción de fotos, videos y contenido para redes'),
  ('Publicidad',    'publicidad',    'Anuncios y material promocional'),
  ('Otros',         'otros',         'Gastos no clasificados')
on conflict (slug) do nothing;

insert into public.proveedores (nombre, sitio_web, notas) values
  ('Temu', 'https://www.temu.com', 'Moldes a pedido. Sin API: registrar fechas estimadas manualmente.');

-- Insumos base. stock_actual arranca en 0: cargar inventario inicial con un movimiento "ajuste".
insert into public.insumos (nombre, categoria, unidad_medida, color, stock_minimo, alerta_activa, rotacion, notas, categoria_gasto_id)
select v.nombre, v.categoria, v.unidad, v.color, v.minimo, v.alerta, v.rotacion, v.notas,
       (select id from public.categorias_gasto where slug = v.gasto)
from (values
  ('Cemento gris',               'materia_prima', 'kg',      null,       5,   true,  'alta',  null,                                   'materia-prima'),
  ('Arena fina',                 'materia_prima', 'kg',      null,       5,   true,  'alta',  null,                                   'materia-prima'),
  ('Pintura acrílica - Blanco',  'pintura',       'unidad',  'Blanco',   1,   true,  'media', 'Crear una fila por cada color',        'materia-prima'),
  ('Pintura acrílica - Negro',   'pintura',       'unidad',  'Negro',    1,   true,  'media', null,                                   'materia-prima'),
  ('Pintura acrílica - Dorado',  'pintura',       'unidad',  'Dorado',   1,   true,  'media', null,                                   'materia-prima'),
  ('Barniz',                     'acabado',       'unidad',  null,       1,   true,  'media', null,                                   'materia-prima'),
  ('Resina',                     'acabado',       'unidad',  null,       1,   true,  'media', null,                                   'materia-prima'),
  ('Goma eva',                   'empaque',       'plancha', null,       2,   true,  'alta',  'Refuerzo de bases: ~0,5 plancha por unidad', 'empaque'),
  ('Papel seda',                 'empaque',       'pliego',  null,       20,  true,  'alta',  '2 pliegos por producto',               'empaque'),
  ('Cartón dúplex',              'empaque',       'plancha', null,       3,   true,  'media', 'Para cajas hechas a mano',             'empaque'),
  ('Pinceles',                   'herramienta',   'unidad',  null,       0,   false, 'baja',  'No reponer hasta desgaste',            'herramientas'),
  ('Sellos de marca',            'marca',         'unidad',  null,       0,   false, 'baja',  'Pendiente de cotizar: completar proveedor y costo al comprar', 'empaque')
) as v(nombre, categoria, unidad, color, minimo, alerta, rotacion, notas, gasto);

-- Empaque por defecto: 2 pliegos de papel seda y 0,5 plancha de goma eva por producto.
insert into public.empaque_default (insumo_id, cantidad, aplica_por, notas)
select id, 2,   'producto', 'Papel seda por producto'  from public.insumos where nombre = 'Papel seda'
union all
select id, 0.5, 'producto', 'Goma eva para reforzar base' from public.insumos where nombre = 'Goma eva';

-- Caja mediana: medidas por definir (se editan desde Ajustes sin tocar código).
insert into public.cajas_envio (nombre, insumo_id, notas)
select 'Mediana', id, 'Medidas exactas por definir' from public.insumos where nombre = 'Cartón dúplex';

update public.config
   set caja_defecto_id = (select id from public.cajas_envio where nombre = 'Mediana'),
       eslogan = 'Decoración artesanal en cemento',
       descripcion_corta = 'Piezas decorativas hechas a mano en cemento y arena fina, pintadas con acrílicos, barniz y resina.',
       horarios = 'Lunes a sábado, 9:00 a 18:00',
       plantilla_resumen_pedido = 'Hola {cliente}, este es el resumen de tu pedido #{numero}:';
