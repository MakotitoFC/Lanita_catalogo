import { getCatalogo, getCategorias, getConfig, getPromociones } from '@/lib/data';
import { SeccionPromociones } from '@/components/promociones';
import { DetalleProvider } from '@/components/detalle';
import CatalogoCliente from './catalogo-cliente';

export const revalidate = 300;

// La portada ES el catálogo. Arriba, las promociones vigentes; luego los filtros y los productos, con aire entre cada bloque.
export default async function Catalogo() {
  const [cfg, categorias, items, promociones] = await Promise.all([getConfig(), getCategorias(), getCatalogo(), getPromociones()]);
  return (
    <>
      <h1 className="sr-only">{cfg.nombre_negocio}: catálogo de productos y combos</h1>
      <DetalleProvider items={items} categorias={categorias} simbolo={cfg.moneda_simbolo}>
        <div className="space-y-8 sm:space-y-10">
          {cfg.web_mostrar_promociones !== false && <SeccionPromociones promociones={promociones} />}
          <CatalogoCliente items={items} categorias={categorias} simbolo={cfg.moneda_simbolo} />
        </div>
      </DetalleProvider>
    </>
  );
}
