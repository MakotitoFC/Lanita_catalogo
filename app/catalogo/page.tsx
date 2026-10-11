import { redirect } from 'next/navigation';

// El catálogo vive en la portada.
export default function Catalogo() {
  redirect('/');
}
