-- =====================================================
-- SCHEMA SQL COMPLETO PARA SUPABASE
-- Sistema de Inventario PAE
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
    ('Administrador', 'Acceso completo al sistema'),
    ('Cocinera', 'Puede registrar menús y ver inventario'),
    ('Director', 'Solo lectura y reportes')
ON CONFLICT (rol_name) DO NOTHING;

-- Tabla de usuarios (extiende auth.users de Supabase)
CREATE TABLE IF NOT EXISTS users (
    id_user UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    id_rol INTEGER REFERENCES rol(id_rol) DEFAULT 2,
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

-- Tabla de guías de entrada
CREATE TABLE IF NOT EXISTS guia_entrada (
    id_guia SERIAL PRIMARY KEY,
    numero_guia TEXT NOT NULL,
    codigo_sunagro TEXT,
    fecha DATE DEFAULT CURRENT_DATE,
    inspector TEXT,
    vocera TEXT,
    telefono_vocera TEXT,
    notas TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de entradas (detalles de guía)
CREATE TABLE IF NOT EXISTS input (
    id_input SERIAL PRIMARY KEY,
    id_guia INTEGER REFERENCES guia_entrada(id_guia) ON DELETE CASCADE,
    id_product INTEGER REFERENCES product(id_product),
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    unit_amount INTEGER, -- cantidad en unidades si aplica
    fecha DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- Tabla de auditoría (OBLIGATORIA)
CREATE TABLE IF NOT EXISTS audit_log (
    id_log SERIAL PRIMARY KEY,
    id_user UUID REFERENCES auth.users(id),
    action_type TEXT NOT NULL,
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

-- Trigger para products
DROP TRIGGER IF EXISTS update_product_updated_at ON product;
CREATE TRIGGER update_product_updated_at
    BEFORE UPDATE ON product
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Función para actualizar stock al crear entrada
CREATE OR REPLACE FUNCTION update_stock_on_input()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE product
    SET stock = stock + NEW.amount
    WHERE id_product = NEW.id_product;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar stock en entradas
DROP TRIGGER IF EXISTS trigger_update_stock_input ON input;
CREATE TRIGGER trigger_update_stock_input
    AFTER INSERT ON input
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_on_input();

-- Función para actualizar stock al crear salida
CREATE OR REPLACE FUNCTION update_stock_on_output()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE product
    SET stock = stock - NEW.amount
    WHERE id_product = NEW.id_product;
    
    IF (SELECT stock FROM product WHERE id_product = NEW.id_product) < 0 THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto %', NEW.id_product;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar stock en salidas
DROP TRIGGER IF EXISTS trigger_update_stock_output ON output;
CREATE TRIGGER trigger_update_stock_output
    AFTER INSERT ON output
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_on_output();

-- Función genérica para logging automático (versión corregida)
CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER AS $$
DECLARE
    record_id_value INTEGER;
BEGIN
    -- Extraer el ID del registro según la tabla
    record_id_value := NULL;
    
    IF (TG_OP = 'INSERT') THEN
        -- Intentar extraer el ID de forma segura
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
        VALUES (
            auth.uid(),
            'INSERT',
            TG_TABLE_NAME,
            record_id_value,
            row_to_json(NEW)::text
        );
        RETURN NEW;
        
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Intentar extraer el ID de forma segura
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
        VALUES (
            auth.uid(),
            'UPDATE',
            TG_TABLE_NAME,
            record_id_value,
            'Antes: ' || row_to_json(OLD)::text || ' | Después: ' || row_to_json(NEW)::text
        );
        RETURN NEW;
        
    ELSIF (TG_OP = 'DELETE') THEN
        -- Intentar extraer el ID de forma segura
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
        VALUES (
            auth.uid(),
            'DELETE',
            TG_TABLE_NAME,
            record_id_value,
            row_to_json(OLD)::text
        );
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
-- PASO 3: Configurar Row Level Security (RLS)
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

-- Policies para users (solo admins pueden modificar)
CREATE POLICY "Users: Todos pueden ver" ON users FOR SELECT USING (true);
CREATE POLICY "Users: Admins pueden insertar" ON users FOR INSERT 
    WITH CHECK (get_user_role() = 1);
CREATE POLICY "Users: Admins pueden actualizar" ON users FOR UPDATE 
    USING (get_user_role() = 1);

-- Policies para products (todos leen, admin y cocinera escriben)
CREATE POLICY "Products: Todos pueden ver" ON product FOR SELECT USING (true);
CREATE POLICY "Products: Admin y Cocinera pueden crear" ON product FOR INSERT 
    WITH CHECK (get_user_role() IN (1, 2));
CREATE POLICY "Products: Admin y Cocinera pueden actualizar" ON product FOR UPDATE 
    USING (get_user_role() IN (1, 2));
CREATE POLICY "Products: Solo Admin puede borrar" ON product FOR DELETE 
    USING (get_user_role() = 1);

-- Policies para category
CREATE POLICY "Categories: Todos pueden ver" ON category FOR SELECT USING (true);
CREATE POLICY "Categories: Admin puede modificar" ON category FOR ALL 
    USING (get_user_role() = 1);

-- Policies para guia_entrada
CREATE POLICY "Guias: Todos pueden ver" ON guia_entrada FOR SELECT USING (true);
CREATE POLICY "Guias: Admin y Cocinera pueden crear" ON guia_entrada FOR INSERT 
    WITH CHECK (get_user_role() IN (1, 2));
CREATE POLICY "Guias: Admin puede modificar" ON guia_entrada FOR UPDATE 
    USING (get_user_role() = 1);

-- Policies para input
CREATE POLICY "Input: Todos pueden ver" ON input FOR SELECT USING (true);
CREATE POLICY "Input: Admin y Cocinera pueden crear" ON input FOR INSERT 
    WITH CHECK (get_user_role() IN (1, 2));

-- Policies para menu_diario
CREATE POLICY "Menu: Todos pueden ver" ON menu_diario FOR SELECT USING (true);
CREATE POLICY "Menu: Admin y Cocinera pueden crear" ON menu_diario FOR INSERT 
    WITH CHECK (get_user_role() IN (1, 2));
CREATE POLICY "Menu: Admin y Cocinera pueden actualizar" ON menu_diario FOR UPDATE 
    USING (get_user_role() IN (1, 2));

-- Policies para menu_detalle
CREATE POLICY "Menu detalle: Todos pueden ver" ON menu_detalle FOR SELECT USING (true);
CREATE POLICY "Menu detalle: Admin y Cocinera pueden modificar" ON menu_detalle FOR ALL 
    USING (get_user_role() IN (1, 2));

-- Policies para asistencia_diaria
CREATE POLICY "Asistencia: Todos pueden ver" ON asistencia_diaria FOR SELECT USING (true);
CREATE POLICY "Asistencia: Admin y Cocinera pueden crear" ON asistencia_diaria FOR INSERT 
    WITH CHECK (get_user_role() IN (1, 2));
CREATE POLICY "Asistencia: Admin y Cocinera pueden actualizar" ON asistencia_diaria FOR UPDATE 
    USING (get_user_role() IN (1, 2));

-- Policies para output
CREATE POLICY "Output: Todos pueden ver" ON output FOR SELECT USING (true);
CREATE POLICY "Output: Admin y Cocinera pueden crear" ON output FOR INSERT 
    WITH CHECK (get_user_role() IN (1, 2));

-- Policies para audit_log (solo lectura para todos)
CREATE POLICY "Audit: Todos pueden ver" ON audit_log FOR SELECT USING (true);

-- Policies para receta_porcion
CREATE POLICY "Porciones: Todos pueden ver" ON receta_porcion FOR SELECT USING (true);
CREATE POLICY "Porciones: Admin y Cocinera pueden modificar" ON receta_porcion FOR ALL 
    USING (get_user_role() IN (1, 2));

-- =====================================================
-- PASO 4: Crear vistas útiles
-- =====================================================

-- Vista de productos con stock bajo
CREATE OR REPLACE VIEW productos_stock_bajo AS
SELECT 
    p.id_product,
    p.product_name,
    p.stock,
    p.unit_measure,
    c.category_name
FROM product p
LEFT JOIN category c ON p.id_category = c.id_category
WHERE p.stock < 10
ORDER BY p.stock ASC;

-- Vista de productos próximos a vencer
CREATE OR REPLACE VIEW productos_por_vencer AS
SELECT 
    p.id_product,
    p.product_name,
    p.expiration_date,
    p.stock,
    p.unit_measure,
    (p.expiration_date - CURRENT_DATE) as dias_restantes
FROM product p
WHERE p.expiration_date IS NOT NULL 
    AND p.expiration_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY p.expiration_date ASC;

-- Vista de inventario completo
CREATE OR REPLACE VIEW inventario_actual AS
SELECT 
    p.id_product,
    p.product_name,
    p.product_code,
    p.stock,
    p.unit_measure,
    p.expiration_date,
    c.category_name,
    CASE 
        WHEN p.stock < 10 THEN 'BAJO'
        WHEN p.stock < 50 THEN 'MEDIO'
        ELSE 'SUFICIENTE'
    END as nivel_stock
FROM product p
LEFT JOIN category c ON p.id_category = c.id_category
ORDER BY c.category_name, p.product_name;

-- =====================================================
-- PASO 5: Datos de ejemplo (OPCIONAL - comentar si no quieres)
-- =====================================================

-- Productos de ejemplo
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

-- Porciones de ejemplo
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

-- Verificar creación exitosa
SELECT 'Schema creado exitosamente!' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
