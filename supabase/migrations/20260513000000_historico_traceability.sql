-- ====================================================================
-- MIGRACIÓN: 20260513000000_historico_traceability
-- PROYECTO: PAE Inventory System
-- DESCRIPCIÓN: Extensión de tablas existentes para datos históricos.
--              Agrega columnas de trazabilidad a guia_entrada y
--              columnas de demografía a registro_diario.
-- MOTOR: PostgreSQL 15+ (Supabase)
-- FECHA DE CREACIÓN: 2026-05-13
-- PREREQUISITO: 20260220000000_baseline.sql
-- ====================================================================

-- ────────────────────────────────────────────────────────────────────
-- 1. GUIA_ENTRADA: Campos de trazabilidad del cuaderno físico
--    (numero_guia_sunagro y numero_guia_sisecal ya son nullable)
-- ────────────────────────────────────────────────────────────────────

ALTER TABLE public.guia_entrada
  ADD COLUMN IF NOT EXISTS entregado_por        TEXT,
  ADD COLUMN IF NOT EXISTS entregado_por_ci     TEXT,
  ADD COLUMN IF NOT EXISTS origen               TEXT,
  ADD COLUMN IF NOT EXISTS vocera_ci            TEXT,
  ADD COLUMN IF NOT EXISTS tipo_documento       TEXT DEFAULT 'guia_entrada',
  ADD COLUMN IF NOT EXISTS plantel_destino      TEXT,
  ADD COLUMN IF NOT EXISTS matricula_referencia INTEGER;

COMMENT ON COLUMN public.guia_entrada.entregado_por
  IS 'Nombre de la persona que entrega la mercancía (transportista/funcionario)';
COMMENT ON COLUMN public.guia_entrada.entregado_por_ci
  IS 'Cédula de identidad del entregador';
COMMENT ON COLUMN public.guia_entrada.origen
  IS 'Centro de distribución de procedencia del despacho';
COMMENT ON COLUMN public.guia_entrada.vocera_ci
  IS 'Cédula de identidad de la vocera que recibe';
COMMENT ON COLUMN public.guia_entrada.tipo_documento
  IS 'Tipo de documento: guia_entrada, acta_entrega_combos, etc.';
COMMENT ON COLUMN public.guia_entrada.plantel_destino
  IS 'Nombre del plantel destino del despacho (si aplica)';
COMMENT ON COLUMN public.guia_entrada.matricula_referencia
  IS 'Matrícula escolar de referencia al momento del despacho';


-- ────────────────────────────────────────────────────────────────────
-- 2. REGISTRO_DIARIO: Demografía por género y descripción del menú
-- ────────────────────────────────────────────────────────────────────

ALTER TABLE public.registro_diario
  ADD COLUMN IF NOT EXISTS asistencia_varones INTEGER,
  ADD COLUMN IF NOT EXISTS asistencia_hembras INTEGER,
  ADD COLUMN IF NOT EXISTS ingesta_total      INTEGER,
  ADD COLUMN IF NOT EXISTS menu_descripcion   TEXT;

COMMENT ON COLUMN public.registro_diario.asistencia_varones
  IS 'Cantidad de varones (V) atendidos en este turno';
COMMENT ON COLUMN public.registro_diario.asistencia_hembras
  IS 'Cantidad de hembras (H) atendidas en este turno';
COMMENT ON COLUMN public.registro_diario.ingesta_total
  IS 'Matrícula total de referencia del plantel para ese día';
COMMENT ON COLUMN public.registro_diario.menu_descripcion
  IS 'Descripción del plato servido (ej: Arroz con pollo, ensalada)';
