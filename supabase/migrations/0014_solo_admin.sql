-- =====================================================================
-- Lanita · 0014 · Un solo rol: administrador
-- El negocio lo opera únicamente el dueño. Los roles 'produccion' y 'ventas'
-- dejan de existir: ningún perfil puede tener otro rol que 'admin'.
-- (Las políticas RLS que mencionan otros roles quedan inertes e inofensivas;
--  si algún día se necesitan, basta con volver a ampliar esta restricción.)
-- =====================================================================

-- Por si existiera algún perfil con otro rol, se desactiva en vez de promoverlo a admin.
update public.perfiles set activo = false where rol <> 'admin';
update public.perfiles set rol = 'admin' where rol <> 'admin' and activo = false;

alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check check (rol = 'admin');
