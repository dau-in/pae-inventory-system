-- Otorga privilegios DML sobre el esquema public a los roles de la API
-- (anon, authenticated, service_role). Las versiones recientes del CLI de
-- Supabase ya no conceden estos privilegios por defecto en entornos locales,
-- por lo que sin esta migración las consultas fallan con "permission denied"
-- aunque las políticas RLS sean correctas. El control de acceso efectivo
-- sigue estando definido por RLS.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Privilegios por defecto para objetos creados en futuras migraciones
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
