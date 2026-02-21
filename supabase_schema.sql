-- =====================================================
-- SCHEMA SQL COMPLETO PARA SUPABASE
-- Sistema de Inventario PAE
-- Escuela Nacional Maestro Carlos González
-- Última actualización: 2026-02-21
-- =====================================================

-- =====================================================
-- PASO 1: Crear tablas principales
-- =====================================================

-- Tabla de roles
CREATE TABLE IF NOT EXISTS rol (
    id_rol SERIAL PRIMARY KEY,
    rol_name TEXT NOT NULL UNIQUE,
    description TEXT
);

-- Insertar roles por defecto
INSERT INTO rol (rol_name, description) VALUES
    ('Director', 'Administrador del sistema escolar'),
    ('Madre Procesadora', 'Gestión operativa de cocina e inventario'),
    ('Supervisor', 'Solo lectura y supervisión')
ON CONFLICT (rol_name) DO NOTHING;

-- Rol Desarrollador (id_rol=4) - Administrador técnico, solo asignable desde la BD
INSERT INTO rol (id_rol, rol_name, description)
VALUES (4, 'Desarrollador', 'Administrador técnico del sistema - control total')
ON CONFLICT (rol_name) DO NOTHING;

-- Tabla de usuarios (extiende auth.users de Supabase)
CREATE TABLE IF NOT EXISTS users (
    id_user UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    id_rol INTEGER REFERENCES rol(id_rol) DEFAULT 2,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de categorías
CREATE TABLE IF NOT EXISTS category (
    id_category SERIAL PRIMARY KEY,
    category_name TEXT NOT NULL UNIQUE,
    description TEXT
);

-- Insertar categorías por defecto
INSERT INTO category (category_name, description) VALUES
    ('Lácteos', 'Leche, queso, yogurt'),
    ('Proteínas', 'Carne, pollo, pescado, huevos'),
    ('Carbohidratos', 'Arroz, pasta, pan, harina'),
    ('Legumbres', 'Caraotas, lentejas, arvejas'),
    ('Vegetales', 'Verduras y hortalizas'),
    ('Frutas', 'Frutas frescas'),
    ('Aceites y grasas', 'Aceite, mantequilla'),
    ('Condimentos', 'Sal, especias, salsas'),
    ('Otros', 'Productos varios')
ON CONFLICT (category_name) DO NOTHING;

-- Tabla de productos
CREATE TABLE IF NOT EXISTS product (
    id_product SERIAL PRIMARY KEY,
    product_name TEXT NOT NULL,
    product_code TEXT,
    expiration_date DATE,
    stock NUMERIC(10,2) DEFAULT 0 CHECK (stock >= 0),
    unit_measure TEXT NOT NULL, -- 'kg', 'unidades', 'lt'
    description TEXT,
    id_category INTEGER REFERENCES category(id_category),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de guías de entrada (con sistema de aprobación maker-checker)
CREATE TABLE IF NOT EXISTS guia_entrada (
    id_guia SERIAL PRIMARY KEY,
    numero_guia_sunagro TEXT NOT NULL,
    numero_guia_sisecal TEXT,
    fecha DATE DEFAULT CURRENT_DATE,
    vocera_nombre TEXT,
    telefono_vocera TEXT,
    notas TEXT,
    estado TEXT DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Aprobada', 'Rechazada')),
    aprobado_por UUID REFERENCES users(id_user),
    fecha_aprobacion TIMESTAMPTZ,
    comentarios_aprobacion TEXT,
    created_by UUID REFERENCES users(id_user),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas por estado
CREATE INDEX IF NOT EXISTS idx_guia_entrada_estado ON guia_entrada(estado);

-- Tabla de entradas (detalles de guía)
CREATE TABLE IF NOT EXISTS input (
    id_input SERIAL PRIMARY KEY,
    id_guia INTEGER REFERENCES guia_entrada(id_guia) ON DELETE CASCADE,
    id_product INTEGER REFERENCES product(id_product),
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    unit_amount INTEGER, -- cantidad en bultos si aplica
    lotes_detalle JSONB, -- [{cantidad, fecha_vencimiento}]
    fecha DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice GIN para búsquedas en lotes JSONB
CREATE INDEX IF NOT EXISTS idx_input_lotes_detalle ON input USING GIN (lotes_detalle);

-- Tabla de porciones por producto
CREATE TABLE IF NOT EXISTS receta_porcion (
    id_porcion SERIAL PRIMARY KEY,
    id_product INTEGER REFERENCES product(id_product) UNIQUE,
    porciones_por_unidad NUMERIC(10,2) NOT NULL DEFAULT 1.0,
    unit_measure TEXT NOT NULL,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de asistencia diaria
CREATE TABLE IF NOT EXISTS asistencia_diaria (
    id_asistencia SERIAL PRIMARY KEY,
    fecha DATE UNIQUE NOT NULL,
    total_alumnos INTEGER NOT NULL CHECK (total_alumnos >= 0),
    notas TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de menú diario
CREATE TABLE IF NOT EXISTS menu_diario (
    id_menu SERIAL PRIMARY KEY,
    fecha DATE UNIQUE NOT NULL,
    id_asistencia INTEGER REFERENCES asistencia_diaria(id_asistencia),
    notas TEXT,
    confirmado BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de detalle de menú
CREATE TABLE IF NOT EXISTS menu_detalle (
    id_detalle SERIAL PRIMARY KEY,
    id_menu INTEGER REFERENCES menu_diario(id_menu) ON DELETE CASCADE,
    id_product INTEGER REFERENCES product(id_product),
    cantidad_planificada NUMERIC(10,2),
    cantidad_real_usada NUMERIC(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de salidas
CREATE TABLE IF NOT EXISTS output (
    id_output SERIAL PRIMARY KEY,
    id_product INTEGER REFERENCES product(id_product),
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    fecha DATE DEFAULT CURRENT_DATE,
    motivo TEXT,
    id_menu INTEGER REFERENCES menu_diario(id_menu),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de auditoría
CREATE TABLE IF NOT EXISTS audit_log (
    id_log SERIAL PRIMARY KEY,
    id_user UUID REFERENCES auth.users(id),
    action_type TEXT NOT NULL, -- INSERT, UPDATE, DELETE, APPROVE, REJECT
    table_affected TEXT,
    record_id INTEGER,
    details TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT
);

-- =====================================================
-- PASO 2: Crear funciones y triggers
-- =====================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para products updated_at
DROP TRIGGER IF EXISTS update_product_updated_at ON product;
CREATE TRIGGER update_product_updated_at
    BEFORE UPDATE ON product
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- NOTA: El trigger automático de stock en input fue ELIMINADO.
-- El stock de entrada se actualiza SOLO mediante la función aprobar_guia().
-- La función antigua fue renombrada a update_stock_on_input_OLD() como referencia.

-- Función de protección para UPDATE en users
-- Jerarquía: Desarrollador(4) > Director(1) > Madre Procesadora(2) / Supervisor(3)
CREATE OR REPLACE FUNCTION protect_director_users()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_role INTEGER;
BEGIN
  SELECT id_rol INTO v_actor_role FROM users WHERE id_user = auth.uid();

  -- Nadie puede modificarse a sí mismo desde gestión de usuarios
  IF OLD.id_user = auth.uid() THEN
    RAISE EXCEPTION 'No puede modificar su propia cuenta desde la gestión de usuarios.';
  END IF;

  -- Nadie puede modificar a un Desarrollador (solo desde BD directamente)
  IF OLD.id_rol = 4 THEN
    RAISE EXCEPTION 'No puede modificar la cuenta de un Desarrollador.';
  END IF;

  -- Un Director no puede modificar a otro Director
  IF v_actor_role = 1 AND OLD.id_rol = 1 THEN
    RAISE EXCEPTION 'Un Director no puede modificar a otro Director.';
  END IF;

  -- Nadie puede promover a Director excepto Desarrollador
  IF NEW.id_rol = 1 AND OLD.id_rol != 1 AND v_actor_role != 4 THEN
    RAISE EXCEPTION 'Solo el Desarrollador puede asignar el rol de Director.';
  END IF;

  -- Nadie puede asignar el rol Desarrollador
  IF NEW.id_rol = 4 AND OLD.id_rol != 4 THEN
    RAISE EXCEPTION 'El rol de Desarrollador solo se asigna desde la base de datos.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_protect_director ON users;
CREATE TRIGGER trigger_protect_director
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION protect_director_users();

-- Función de protección para INSERT en users
-- Desarrollador puede crear Directores; Director solo puede crear roles 2 y 3; nadie crea Desarrolladores
CREATE OR REPLACE FUNCTION protect_director_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_role INTEGER;
BEGIN
  SELECT id_rol INTO v_actor_role FROM users WHERE id_user = auth.uid();

  -- Nadie puede crear un Desarrollador desde la app
  IF NEW.id_rol = 4 THEN
    RAISE EXCEPTION 'El rol de Desarrollador solo se asigna desde la base de datos.';
  END IF;

  -- Solo Desarrollador puede crear Directores
  IF NEW.id_rol = 1 AND v_actor_role != 4 THEN
    RAISE EXCEPTION 'Solo el Desarrollador puede crear usuarios con rol de Director.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_protect_director_insert ON users;
CREATE TRIGGER trigger_protect_director_insert
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION protect_director_insert();

-- Función para actualizar stock al crear salida
-- Usa SELECT FOR UPDATE para evitar race conditions
CREATE OR REPLACE FUNCTION update_stock_on_output()
RETURNS TRIGGER AS $$
DECLARE
    v_stock_actual NUMERIC(10,2);
BEGIN
    -- Bloquear la fila del producto para evitar modificaciones concurrentes
    SELECT stock INTO v_stock_actual
    FROM product
    WHERE id_product = NEW.id_product
    FOR UPDATE;

    -- Verificar stock ANTES de restar
    IF v_stock_actual < NEW.amount THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto %. Stock actual: %, solicitado: %',
            NEW.id_product, v_stock_actual, NEW.amount;
    END IF;

    UPDATE product
    SET stock = stock - NEW.amount
    WHERE id_product = NEW.id_product;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar stock en salidas
DROP TRIGGER IF EXISTS trigger_update_stock_output ON output;
CREATE TRIGGER trigger_update_stock_output
    AFTER INSERT ON output
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_on_output();

-- Función genérica para logging automático
CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER AS $$
DECLARE
    record_id_value INTEGER;
BEGIN
    record_id_value := NULL;

    IF (TG_OP = 'INSERT') THEN
        BEGIN
            IF TG_TABLE_NAME = 'product' THEN
                record_id_value := NEW.id_product;
            ELSIF TG_TABLE_NAME = 'guia_entrada' THEN
                record_id_value := NEW.id_guia;
            ELSIF TG_TABLE_NAME = 'menu_diario' THEN
                record_id_value := NEW.id_menu;
            ELSIF TG_TABLE_NAME = 'output' THEN
                record_id_value := NEW.id_output;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            record_id_value := NULL;
        END;

        INSERT INTO audit_log (id_user, action_type, table_affected, record_id, details)
        VALUES (auth.uid(), 'INSERT', TG_TABLE_NAME, record_id_value, row_to_json(NEW)::text);
        RETURN NEW;

    ELSIF (TG_OP = 'UPDATE') THEN
        BEGIN
            IF TG_TABLE_NAME = 'product' THEN
                record_id_value := NEW.id_product;
            ELSIF TG_TABLE_NAME = 'guia_entrada' THEN
                record_id_value := NEW.id_guia;
            ELSIF TG_TABLE_NAME = 'menu_diario' THEN
                record_id_value := NEW.id_menu;
            ELSIF TG_TABLE_NAME = 'output' THEN
                record_id_value := NEW.id_output;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            record_id_value := NULL;
        END;

        INSERT INTO audit_log (id_user, action_type, table_affected, record_id, details)
        VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, record_id_value,
            'Antes: ' || row_to_json(OLD)::text || ' | Después: ' || row_to_json(NEW)::text);
        RETURN NEW;

    ELSIF (TG_OP = 'DELETE') THEN
        BEGIN
            IF TG_TABLE_NAME = 'product' THEN
                record_id_value := OLD.id_product;
            ELSIF TG_TABLE_NAME = 'guia_entrada' THEN
                record_id_value := OLD.id_guia;
            ELSIF TG_TABLE_NAME = 'menu_diario' THEN
                record_id_value := OLD.id_menu;
            ELSIF TG_TABLE_NAME = 'output' THEN
                record_id_value := OLD.id_output;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            record_id_value := NULL;
        END;

        INSERT INTO audit_log (id_user, action_type, table_affected, record_id, details)
        VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, record_id_value, row_to_json(OLD)::text);
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar triggers de auditoría a tablas importantes
DROP TRIGGER IF EXISTS audit_product ON product;
CREATE TRIGGER audit_product AFTER INSERT OR UPDATE OR DELETE ON product
    FOR EACH ROW EXECUTE FUNCTION log_audit();

DROP TRIGGER IF EXISTS audit_guia ON guia_entrada;
CREATE TRIGGER audit_guia AFTER INSERT OR UPDATE OR DELETE ON guia_entrada
    FOR EACH ROW EXECUTE FUNCTION log_audit();

DROP TRIGGER IF EXISTS audit_menu ON menu_diario;
CREATE TRIGGER audit_menu AFTER INSERT OR UPDATE OR DELETE ON menu_diario
    FOR EACH ROW EXECUTE FUNCTION log_audit();

DROP TRIGGER IF EXISTS audit_output ON output;
CREATE TRIGGER audit_output AFTER INSERT OR UPDATE OR DELETE ON output
    FOR EACH ROW EXECUTE FUNCTION log_audit();

-- =====================================================
-- PASO 3: Funciones RPC para aprobación de guías
-- =====================================================

-- Función transaccional para aprobar guía y actualizar inventario
CREATE OR REPLACE FUNCTION aprobar_guia(
  p_id_guia INTEGER,
  p_comentarios TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_input_record RECORD;
  v_fecha_mas_cercana DATE;
  v_total_productos INTEGER := 0;
  v_guia_info RECORD;
  v_user_role INTEGER;
BEGIN
  -- Verificar que el usuario tiene rol de Director(1) o Desarrollador(4)
  SELECT id_rol INTO v_user_role FROM users WHERE id_user = auth.uid();
  IF v_user_role IS NULL OR v_user_role NOT IN (1, 4) THEN
    RAISE EXCEPTION 'No tiene permisos para aprobar guías. Se requiere rol de Director o Desarrollador.';
  END IF;

  SELECT * INTO v_guia_info
  FROM guia_entrada
  WHERE id_guia = p_id_guia;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guía con ID % no encontrada', p_id_guia;
  END IF;

  IF v_guia_info.estado != 'Pendiente' THEN
    RAISE EXCEPTION 'La guía ya fue procesada. Estado actual: %', v_guia_info.estado;
  END IF;

  -- Actualizar estado de la guía
  UPDATE guia_entrada
  SET
    estado = 'Aprobada',
    aprobado_por = auth.uid(),
    fecha_aprobacion = NOW(),
    comentarios_aprobacion = p_comentarios
  WHERE id_guia = p_id_guia;

  -- Procesar cada producto de la guía
  FOR v_input_record IN
    SELECT i.*, p.unit_measure
    FROM input i
    JOIN product p ON i.id_product = p.id_product
    WHERE i.id_guia = p_id_guia
  LOOP
    v_total_productos := v_total_productos + 1;

    -- Sumar stock
    UPDATE product
    SET stock = stock + v_input_record.amount
    WHERE id_product = v_input_record.id_product;

    -- Si hay lotes, usar la fecha de vencimiento más cercana
    IF v_input_record.lotes_detalle IS NOT NULL AND
       jsonb_array_length(v_input_record.lotes_detalle) > 0 THEN

      SELECT MIN((lote->>'fecha_vencimiento')::DATE)
      INTO v_fecha_mas_cercana
      FROM jsonb_array_elements(v_input_record.lotes_detalle) AS lote;

      UPDATE product
      SET expiration_date = v_fecha_mas_cercana
      WHERE id_product = v_input_record.id_product;
    END IF;
  END LOOP;

  -- Registrar en auditoría
  INSERT INTO audit_log (id_user, action_type, table_affected, record_id, details)
  VALUES (
    auth.uid(), 'APPROVE', 'guia_entrada', p_id_guia,
    jsonb_build_object(
      'numero_guia', v_guia_info.numero_guia_sunagro,
      'productos_procesados', v_total_productos,
      'comentarios', p_comentarios
    )::text
  );

  RETURN json_build_object(
    'success', true,
    'id_guia', p_id_guia,
    'productos_procesados', v_total_productos,
    'mensaje', format('Guía %s aprobada exitosamente. %s productos actualizados en inventario.',
      v_guia_info.numero_guia_sunagro, v_total_productos)
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al aprobar guía: %', SQLERRM;
END;
$$;

-- Función para rechazar guía
CREATE OR REPLACE FUNCTION rechazar_guia(
  p_id_guia INTEGER,
  p_motivo TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guia_info RECORD;
  v_user_role INTEGER;
BEGIN
  -- Verificar que el usuario tiene rol de Director(1) o Desarrollador(4)
  SELECT id_rol INTO v_user_role FROM users WHERE id_user = auth.uid();
  IF v_user_role IS NULL OR v_user_role NOT IN (1, 4) THEN
    RAISE EXCEPTION 'No tiene permisos para rechazar guías. Se requiere rol de Director o Desarrollador.';
  END IF;

  SELECT * INTO v_guia_info
  FROM guia_entrada
  WHERE id_guia = p_id_guia;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guía con ID % no encontrada', p_id_guia;
  END IF;

  IF v_guia_info.estado != 'Pendiente' THEN
    RAISE EXCEPTION 'La guía ya fue procesada. Estado actual: %', v_guia_info.estado;
  END IF;

  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Debe proporcionar un motivo para rechazar la guía';
  END IF;

  UPDATE guia_entrada
  SET
    estado = 'Rechazada',
    aprobado_por = auth.uid(),
    fecha_aprobacion = NOW(),
    comentarios_aprobacion = p_motivo
  WHERE id_guia = p_id_guia;

  INSERT INTO audit_log (id_user, action_type, table_affected, record_id, details)
  VALUES (
    auth.uid(), 'REJECT', 'guia_entrada', p_id_guia,
    jsonb_build_object(
      'numero_guia', v_guia_info.numero_guia_sunagro,
      'motivo', p_motivo
    )::text
  );

  RETURN json_build_object(
    'success', true,
    'id_guia', p_id_guia,
    'mensaje', format('Guía %s rechazada.', v_guia_info.numero_guia_sunagro)
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al rechazar guía: %', SQLERRM;
END;
$$;

-- Permisos para las funciones RPC
GRANT EXECUTE ON FUNCTION aprobar_guia(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rechazar_guia(INTEGER, TEXT) TO authenticated;

-- =====================================================
-- PASO 4: Configurar Row Level Security (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE product ENABLE ROW LEVEL SECURITY;
ALTER TABLE category ENABLE ROW LEVEL SECURITY;
ALTER TABLE guia_entrada ENABLE ROW LEVEL SECURITY;
ALTER TABLE input ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencia_diaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE output ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE receta_porcion ENABLE ROW LEVEL SECURITY;

-- Función helper para obtener rol del usuario
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS INTEGER AS $$
    SELECT id_rol FROM users WHERE id_user = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Policies para users
CREATE POLICY "Users: Todos pueden ver" ON users FOR SELECT USING (true);
CREATE POLICY "Users: Director puede insertar" ON users FOR INSERT
    WITH CHECK (get_user_role() IN (1, 4));
CREATE POLICY "Users: Director puede actualizar" ON users FOR UPDATE
    USING (get_user_role() IN (1, 4));

-- Policies para products
CREATE POLICY "Products: Todos pueden ver" ON product FOR SELECT USING (true);
CREATE POLICY "Products: Director y Madre Procesadora pueden crear" ON product FOR INSERT
    WITH CHECK (get_user_role() IN (1, 2, 4));
CREATE POLICY "Products: Director y Madre Procesadora pueden actualizar" ON product FOR UPDATE
    USING (get_user_role() IN (1, 2, 4));
CREATE POLICY "Products: Solo Director puede borrar" ON product FOR DELETE
    USING (get_user_role() IN (1, 4));

-- Policies para category
CREATE POLICY "Categories: Todos pueden ver" ON category FOR SELECT USING (true);
CREATE POLICY "Categories: Admin puede modificar" ON category FOR ALL
    USING (get_user_role() IN (1, 4));

-- Policies para guia_entrada (actualizadas para sistema de aprobación)
CREATE POLICY "guia_entrada_select" ON guia_entrada
    FOR SELECT USING (true);
CREATE POLICY "guia_entrada_insert" ON guia_entrada
    FOR INSERT WITH CHECK (get_user_role() IN (1, 2, 4));
CREATE POLICY "guia_entrada_update" ON guia_entrada
    FOR UPDATE USING (get_user_role() IN (1, 4));

-- Policies para input
CREATE POLICY "Input: Todos pueden ver" ON input FOR SELECT USING (true);
CREATE POLICY "Input: Admin y Cocinera pueden crear" ON input FOR INSERT
    WITH CHECK (get_user_role() IN (1, 2, 4));

-- Policies para menu_diario
CREATE POLICY "Menu: Todos pueden ver" ON menu_diario FOR SELECT USING (true);
CREATE POLICY "Menu: Admin y Cocinera pueden crear" ON menu_diario FOR INSERT
    WITH CHECK (get_user_role() IN (1, 2, 4));
CREATE POLICY "Menu: Admin y Cocinera pueden actualizar" ON menu_diario FOR UPDATE
    USING (get_user_role() IN (1, 2, 4));

-- Policies para menu_detalle
CREATE POLICY "Menu detalle: Todos pueden ver" ON menu_detalle FOR SELECT USING (true);
CREATE POLICY "Menu detalle: Admin y Cocinera pueden modificar" ON menu_detalle FOR ALL
    USING (get_user_role() IN (1, 2, 4));

-- Policies para asistencia_diaria
CREATE POLICY "Asistencia: Todos pueden ver" ON asistencia_diaria FOR SELECT USING (true);
CREATE POLICY "Asistencia: Admin y Cocinera pueden crear" ON asistencia_diaria FOR INSERT
    WITH CHECK (get_user_role() IN (1, 2, 4));
CREATE POLICY "Asistencia: Admin y Cocinera pueden actualizar" ON asistencia_diaria FOR UPDATE
    USING (get_user_role() IN (1, 2, 4));
CREATE POLICY "Asistencia: Admin y Cocinera pueden eliminar" ON asistencia_diaria FOR DELETE
    USING (get_user_role() IN (1, 2, 4));

-- Policies para output
CREATE POLICY "Output: Todos pueden ver" ON output FOR SELECT USING (true);
CREATE POLICY "Output: Admin y Cocinera pueden crear" ON output FOR INSERT
    WITH CHECK (get_user_role() IN (1, 2, 4));

-- Policies para audit_log
CREATE POLICY "Audit: Todos pueden ver" ON audit_log FOR SELECT USING (true);

-- Policies para receta_porcion
CREATE POLICY "Porciones: Todos pueden ver" ON receta_porcion FOR SELECT USING (true);
CREATE POLICY "Porciones: Admin y Cocinera pueden modificar" ON receta_porcion FOR ALL
    USING (get_user_role() IN (1, 2, 4));

-- =====================================================
-- PASO 5: Crear vistas útiles
-- =====================================================

-- Vista de productos con stock bajo
CREATE OR REPLACE VIEW productos_stock_bajo AS
SELECT
    p.id_product, p.product_name, p.stock, p.unit_measure, c.category_name
FROM product p
LEFT JOIN category c ON p.id_category = c.id_category
WHERE p.stock < 10
ORDER BY p.stock ASC;

-- Vista de productos próximos a vencer
CREATE OR REPLACE VIEW productos_por_vencer AS
SELECT
    p.id_product, p.product_name, p.expiration_date, p.stock, p.unit_measure,
    (p.expiration_date - CURRENT_DATE) as dias_restantes
FROM product p
WHERE p.expiration_date IS NOT NULL
    AND p.expiration_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY p.expiration_date ASC;

-- Vista de inventario completo
CREATE OR REPLACE VIEW inventario_actual AS
SELECT
    p.id_product, p.product_name, p.product_code, p.stock, p.unit_measure,
    p.expiration_date, c.category_name,
    CASE
        WHEN p.stock < 10 THEN 'BAJO'
        WHEN p.stock < 50 THEN 'MEDIO'
        ELSE 'SUFICIENTE'
    END as nivel_stock
FROM product p
LEFT JOIN category c ON p.id_category = c.id_category
ORDER BY c.category_name, p.product_name;

-- Vista de guías pendientes de aprobación
CREATE OR REPLACE VIEW guias_pendientes AS
SELECT
    g.*,
    u.full_name as creador_nombre,
    COUNT(i.id_input) as total_productos
FROM guia_entrada g
LEFT JOIN users u ON g.created_by = u.id_user
LEFT JOIN input i ON g.id_guia = i.id_guia
WHERE g.estado = 'Pendiente'
GROUP BY g.id_guia, u.full_name
ORDER BY g.fecha DESC, g.created_at DESC;

-- Vista de historial de aprobaciones
CREATE OR REPLACE VIEW historial_aprobaciones AS
SELECT
    g.*,
    u_creador.full_name as creador_nombre,
    u_aprobador.full_name as aprobador_nombre,
    COUNT(i.id_input) as total_productos
FROM guia_entrada g
LEFT JOIN users u_creador ON g.created_by = u_creador.id_user
LEFT JOIN users u_aprobador ON g.aprobado_por = u_aprobador.id_user
LEFT JOIN input i ON g.id_guia = i.id_guia
WHERE g.estado IN ('Aprobada', 'Rechazada')
GROUP BY g.id_guia, u_creador.full_name, u_aprobador.full_name
ORDER BY g.fecha_aprobacion DESC;

-- =====================================================
-- PASO 6: Datos de ejemplo (OPCIONAL)
-- =====================================================

INSERT INTO product (product_name, product_code, stock, unit_measure, id_category, expiration_date) VALUES
    ('Arroz', 'ARR001', 100.00, 'kg', 3, CURRENT_DATE + INTERVAL '6 months'),
    ('Aceite de girasol', 'ACE001', 20.50, 'lt', 7, CURRENT_DATE + INTERVAL '1 year'),
    ('Leche en polvo', 'LEC001', 15.00, 'kg', 1, CURRENT_DATE + INTERVAL '3 months'),
    ('Pollo', 'POL001', 30.00, 'kg', 2, CURRENT_DATE + INTERVAL '10 days'),
    ('Caraotas negras', 'CAR001', 50.00, 'kg', 4, CURRENT_DATE + INTERVAL '1 year'),
    ('Pasta corta', 'PAS001', 40.00, 'kg', 3, CURRENT_DATE + INTERVAL '8 months'),
    ('Tomate', 'TOM001', 5.00, 'kg', 5, CURRENT_DATE + INTERVAL '5 days'),
    ('Sal', 'SAL001', 10.00, 'kg', 8, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO receta_porcion (id_product, porciones_por_unidad, unit_measure) VALUES
    (1, 12.00, 'kg'),  -- 1 kg arroz = 12 porciones
    (3, 40.00, 'kg'),  -- 1 kg leche = 40 porciones
    (4, 4.00, 'kg'),   -- 1 kg pollo = 4 porciones
    (5, 10.00, 'kg'),  -- 1 kg caraotas = 10 porciones
    (6, 10.00, 'kg')   -- 1 kg pasta = 10 porciones
ON CONFLICT DO NOTHING;

-- =====================================================
-- FIN DEL SCHEMA
-- =====================================================
