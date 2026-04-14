-- ====================================================================
-- PROYECTO: PAE Inventory System
-- DESCRIPCIÓN: Esquema de Base de Datos, Triggers y Políticas RBAC
-- MOTOR: PostgreSQL (Supabase)
-- ÚLTIMA ACTUALIZACIÓN: 2026-04-14
-- ====================================================================
-- NOTA: Este archivo es la fuente de verdad de la estructura de la BD.
-- Se mantiene para documentación, control de versiones y sincronización.
-- ====================================================================


-- ####################################################################
-- PASO 1: TABLAS PRINCIPALES
-- ####################################################################

-- --------------------------------------------------------------------
-- Tabla: rol
-- Catálogo de roles del sistema RBAC (4 roles fijos)
-- --------------------------------------------------------------------
CREATE TABLE public.rol (
    id_rol   SERIAL PRIMARY KEY,
    rol_name TEXT NOT NULL UNIQUE,
    description TEXT
);

-- --------------------------------------------------------------------
-- Tabla: users
-- Perfiles de usuario vinculados a auth.users de Supabase
-- --------------------------------------------------------------------
CREATE TABLE public.users (
    id_user     UUID NOT NULL PRIMARY KEY,
    username    TEXT NOT NULL UNIQUE,
    id_rol      INTEGER DEFAULT 2 REFERENCES public.rol(id_rol),
    created_at  TIMESTAMPTZ DEFAULT now(),
    is_active   BOOLEAN DEFAULT TRUE,
    last_seen   TIMESTAMPTZ,
    last_ip     TEXT,
    disabled_at TIMESTAMPTZ DEFAULT NULL,  -- Timestamp de la última deshabilitación
    disabled_by TEXT DEFAULT NULL,          -- Nombre del responsable que deshabilitó
    CONSTRAINT users_id_user_fkey FOREIGN KEY (id_user) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- --------------------------------------------------------------------
-- Tabla: category
-- Categorías de rubros del inventario
-- --------------------------------------------------------------------
CREATE TABLE public.category (
    id_category   SERIAL PRIMARY KEY,
    category_name TEXT NOT NULL UNIQUE,
    description   TEXT
);

-- --------------------------------------------------------------------
-- Tabla: product
-- Rubros del inventario con sistema de archivado (Hybrid Deletion)
-- --------------------------------------------------------------------
CREATE TABLE public.product (
    id_product   SERIAL PRIMARY KEY,
    product_name TEXT NOT NULL,
    stock        NUMERIC(10,2) DEFAULT 0 CHECK (stock >= 0),
    unit_measure TEXT NOT NULL,
    description  TEXT,
    id_category  INTEGER REFERENCES public.category(id_category),
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now(),
    is_archived  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_product_active ON public.product (id_product) WHERE (is_archived = FALSE);

-- --------------------------------------------------------------------
-- Tabla: guia_entrada
-- Guías de entrada CNAE con flujo de aprobación (Pendiente → Aprobada/Rechazada)
-- --------------------------------------------------------------------
CREATE TABLE public.guia_entrada (
    id_guia                SERIAL PRIMARY KEY,
    numero_guia_sunagro    TEXT NOT NULL UNIQUE,
    numero_guia_sisecal    TEXT,
    fecha                  DATE DEFAULT CURRENT_DATE,
    vocera_nombre          TEXT,
    telefono_vocera        TEXT,
    notas                  TEXT,
    created_by             UUID REFERENCES public.users(id_user),
    created_at             TIMESTAMPTZ DEFAULT now(),
    estado                 TEXT DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Aprobada', 'Rechazada')),
    aprobado_por           UUID REFERENCES public.users(id_user),
    fecha_aprobacion       TIMESTAMPTZ,
    comentarios_aprobacion TEXT
);

COMMENT ON COLUMN public.guia_entrada.estado IS 'Estado del flujo de aprobación: Pendiente, Aprobada, Rechazada';
COMMENT ON COLUMN public.guia_entrada.aprobado_por IS 'Usuario que aprobó o rechazó la guía (Director o Desarrollador)';
COMMENT ON COLUMN public.guia_entrada.fecha_aprobacion IS 'Fecha y hora de aprobación o rechazo';
COMMENT ON COLUMN public.guia_entrada.comentarios_aprobacion IS 'Comentarios del aprobador (opcional para aprobación, obligatorio para rechazo)';

CREATE INDEX idx_guia_entrada_estado ON public.guia_entrada (estado);

-- --------------------------------------------------------------------
-- Tabla: input
-- Entradas de inventario ligadas a guías, con lotes de vencimiento JSONB
-- --------------------------------------------------------------------
CREATE TABLE public.input (
    id_input      SERIAL PRIMARY KEY,
    id_guia       INTEGER REFERENCES public.guia_entrada(id_guia) ON DELETE CASCADE,
    id_product    INTEGER REFERENCES public.product(id_product),
    amount        NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    unit_amount   INTEGER,
    fecha         DATE DEFAULT CURRENT_DATE,
    created_at    TIMESTAMPTZ DEFAULT now(),
    lotes_detalle JSONB
);

COMMENT ON COLUMN public.input.lotes_detalle IS 'Array JSON con detalles de lotes: [{cantidad, fecha_vencimiento}]';

CREATE INDEX idx_input_lotes_detalle ON public.input USING gin (lotes_detalle);

-- --------------------------------------------------------------------
-- Tabla: output
-- Salidas de inventario (consumo diario, menú, etc.)
-- --------------------------------------------------------------------
CREATE TABLE public.output (
    id_output   SERIAL PRIMARY KEY,
    id_product  INTEGER REFERENCES public.product(id_product),
    amount      NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    fecha       DATE DEFAULT CURRENT_DATE,
    motivo      TEXT,
    id_menu     INTEGER REFERENCES public.menu_diario(id_menu),
    created_by  UUID REFERENCES auth.users(id),
    created_at  TIMESTAMPTZ DEFAULT now(),
    id_registro INTEGER REFERENCES public.registro_diario(id_registro)
);

-- --------------------------------------------------------------------
-- Tabla: registro_diario
-- Cabecera de operaciones diarias (fecha, turno, asistencia)
-- --------------------------------------------------------------------
CREATE TABLE public.registro_diario (
    id_registro      SERIAL PRIMARY KEY,
    fecha            DATE NOT NULL,
    turno            VARCHAR(20) NOT NULL CHECK (turno IN ('Desayuno', 'Almuerzo', 'Merienda')),
    asistencia_total INTEGER NOT NULL CHECK (asistencia_total > 0),
    notas            TEXT,
    created_by       UUID REFERENCES public.users(id_user),
    created_at       TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_fecha_turno UNIQUE (fecha, turno)
);

-- --------------------------------------------------------------------
-- Tabla: receta_porcion
-- Rendimiento por unidad de cada rubro (porciones por unidad)
-- --------------------------------------------------------------------
CREATE TABLE public.receta_porcion (
    id_porcion             SERIAL PRIMARY KEY,
    id_product             INTEGER UNIQUE REFERENCES public.product(id_product),
    rendimiento_por_unidad NUMERIC(10,2) NOT NULL DEFAULT 1.0,
    unit_measure           TEXT NOT NULL,
    notas                  TEXT,
    created_at             TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------------------
-- Tabla: asistencia_diaria
-- Registro de asistencia escolar por día
-- --------------------------------------------------------------------
CREATE TABLE public.asistencia_diaria (
    id_asistencia SERIAL PRIMARY KEY,
    fecha         DATE NOT NULL UNIQUE,
    total_alumnos INTEGER NOT NULL CHECK (total_alumnos >= 0),
    notas         TEXT,
    created_by    UUID REFERENCES auth.users(id),
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------------------
-- Tabla: menu_diario
-- Menú planificado por día
-- --------------------------------------------------------------------
CREATE TABLE public.menu_diario (
    id_menu       SERIAL PRIMARY KEY,
    fecha         DATE NOT NULL UNIQUE,
    id_asistencia INTEGER REFERENCES public.asistencia_diaria(id_asistencia),
    notas         TEXT,
    confirmado    BOOLEAN DEFAULT FALSE,
    created_by    UUID REFERENCES auth.users(id),
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------------------
-- Tabla: menu_detalle
-- Detalles de rubros planificados y consumidos por menú
-- --------------------------------------------------------------------
CREATE TABLE public.menu_detalle (
    id_detalle          SERIAL PRIMARY KEY,
    id_menu             INTEGER REFERENCES public.menu_diario(id_menu) ON DELETE CASCADE,
    id_product          INTEGER REFERENCES public.product(id_product),
    cantidad_planificada NUMERIC(10,2),
    cantidad_real_usada  NUMERIC(10,2),
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------------------
-- Tabla: audit_log
-- Bitácora de auditoría del sistema
-- --------------------------------------------------------------------
CREATE TABLE public.audit_log (
    id_log         SERIAL PRIMARY KEY,
    id_user        UUID REFERENCES auth.users(id),
    action_type    TEXT NOT NULL,
    table_affected TEXT,
    record_id      INTEGER,
    details        TEXT,
    "timestamp"    TIMESTAMPTZ DEFAULT now(),
    ip_address     TEXT
);

-- --------------------------------------------------------------------
-- Tabla: institucion
-- Perfil institucional (fila única, CHECK id=1)
-- --------------------------------------------------------------------
CREATE TABLE public.institucion (
    id              INTEGER DEFAULT 1 NOT NULL PRIMARY KEY CHECK (id = 1),
    nombre          TEXT NOT NULL DEFAULT 'Nombre de la Institución',
    rif             TEXT DEFAULT 'J-00000000-0',
    codigo_dea      TEXT DEFAULT 'CÓDIGO-DEA',
    direccion       TEXT DEFAULT '',
    director_actual TEXT DEFAULT '',
    logo_url        TEXT DEFAULT '',
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------------------
-- Tabla: guia_entrada_backup (respaldo de migración)
-- --------------------------------------------------------------------
CREATE TABLE public.guia_entrada_backup (
    id_guia         INTEGER,
    numero_guia     TEXT,
    codigo_sunagro  TEXT,
    fecha           DATE,
    inspector       TEXT,
    vocera          TEXT,
    telefono_vocera TEXT,
    notas           TEXT,
    created_by      UUID,
    created_at      TIMESTAMPTZ
);

-- --------------------------------------------------------------------
-- Tabla: input_backup (respaldo de migración)
-- --------------------------------------------------------------------
CREATE TABLE public.input_backup (
    id_input    INTEGER,
    id_guia     INTEGER,
    id_product  INTEGER,
    amount      NUMERIC(10,2),
    unit_amount INTEGER,
    fecha       DATE,
    created_at  TIMESTAMPTZ
);


-- ####################################################################
-- PASO 2: FUNCIONES Y PROCEDIMIENTOS
-- ####################################################################

-- --------------------------------------------------------------------
-- Función: get_user_role()
-- Devuelve el id_rol del usuario autenticado actualmente
-- --------------------------------------------------------------------
CREATE FUNCTION public.get_user_role() RETURNS INTEGER
    LANGUAGE sql SECURITY DEFINER AS $$
    SELECT id_rol FROM users WHERE id_user = auth.uid();
$$;

-- --------------------------------------------------------------------
-- Función: update_updated_at_column()
-- Actualiza automáticamente la columna updated_at al modificar un registro
-- --------------------------------------------------------------------
CREATE FUNCTION public.update_updated_at_column() RETURNS TRIGGER
    LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- --------------------------------------------------------------------
-- Función: update_stock_on_output()
-- Descuenta stock del producto al registrar una salida.
-- Lanza excepción si el stock es insuficiente.
-- --------------------------------------------------------------------
CREATE FUNCTION public.update_stock_on_output() RETURNS TRIGGER
    LANGUAGE plpgsql AS $$
DECLARE
    v_stock_actual NUMERIC(10,2);
BEGIN
    SELECT stock INTO v_stock_actual
    FROM product
    WHERE id_product = NEW.id_product
    FOR UPDATE;

    IF v_stock_actual < NEW.amount THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto %. Stock actual: %, solicitado: %',
            NEW.id_product, v_stock_actual, NEW.amount;
    END IF;

    UPDATE product
    SET stock = stock - NEW.amount
    WHERE id_product = NEW.id_product;

    RETURN NEW;
END;
$$;

-- --------------------------------------------------------------------
-- Función: log_audit()
-- Trigger genérico de auditoría para INSERT, UPDATE, DELETE.
-- Registra acción, tabla, ID del registro y contenido JSON en audit_log.
-- --------------------------------------------------------------------
CREATE FUNCTION public.log_audit() RETURNS TRIGGER
    LANGUAGE plpgsql SECURITY DEFINER AS $$
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
$$;

-- --------------------------------------------------------------------
-- Función: protect_director_insert()
-- Trigger BEFORE INSERT en users. Impide la creación de usuarios
-- con rol Director (1) o Desarrollador (4) sin autorización.
-- --------------------------------------------------------------------
CREATE FUNCTION public.protect_director_insert() RETURNS TRIGGER
    LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_actor_role INTEGER;
BEGIN
    SELECT id_rol INTO v_actor_role FROM users WHERE id_user = auth.uid();

    IF NEW.id_rol = 4 THEN
        RAISE EXCEPTION 'El rol de Desarrollador solo se asigna desde la base de datos.';
    END IF;

    IF NEW.id_rol = 1 AND v_actor_role != 4 THEN
        RAISE EXCEPTION 'Solo el Desarrollador puede crear usuarios con rol de Director.';
    END IF;

    RETURN NEW;
END;
$$;

-- --------------------------------------------------------------------
-- Función: protect_director_users()
-- Trigger BEFORE UPDATE en users. Protege cuentas de Director y
-- Desarrollador contra modificaciones no autorizadas.
-- Las actualizaciones que solo tocan columnas de actividad (heartbeat:
-- last_seen, last_ip) se dejan pasar sin validación.
-- AUTOGESTÍON: Permite que un usuario cambie su propio username/contraseña
-- pero bloquea cambios de rol propio y auto-desactivación.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_director_users() RETURNS TRIGGER
    LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_actor_role INTEGER;
BEGIN
    -- Permitir actualizaciones que SOLO tocan columnas de actividad (heartbeat)
    IF OLD.username   IS NOT DISTINCT FROM NEW.username
       AND OLD.id_rol    IS NOT DISTINCT FROM NEW.id_rol
       AND OLD.is_active IS NOT DISTINCT FROM NEW.is_active
    THEN
        RETURN NEW;
    END IF;

    SELECT id_rol INTO v_actor_role FROM users WHERE id_user = auth.uid();

    -- ════════════════════════════════════════════════════════
    -- AUTOGESTÍON: El usuario edita su PROPIA cuenta
    -- Se permite cambiar username, pero NO rol ni is_active
    -- ════════════════════════════════════════════════════════
    IF OLD.id_user = auth.uid() THEN
        -- Bloquear cambio de rol propio
        IF OLD.id_rol IS DISTINCT FROM NEW.id_rol THEN
            RAISE EXCEPTION 'No puede cambiar su propio rol.';
        END IF;
        -- Bloquear auto-desactivación
        IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
            RAISE EXCEPTION 'No puede desactivar su propia cuenta.';
        END IF;
        -- Si solo cambia el username u otros campos inofensivos, se permite
        RETURN NEW;
    END IF;

    -- ════════════════════════════════════════════════════════
    -- GESTIÓN DE OTROS: Reglas RBAC normales
    -- ════════════════════════════════════════════════════════
    IF OLD.id_rol = 4 THEN
        RAISE EXCEPTION 'No puede modificar la cuenta de un Desarrollador.';
    END IF;

    IF v_actor_role = 1 AND OLD.id_rol = 1 THEN
        RAISE EXCEPTION 'Un Director no puede modificar a otro Director.';
    END IF;

    IF NEW.id_rol = 1 AND OLD.id_rol != 1 AND v_actor_role != 4 THEN
        RAISE EXCEPTION 'Solo el Desarrollador puede asignar el rol de Director.';
    END IF;

    IF NEW.id_rol = 4 AND OLD.id_rol != 4 THEN
        RAISE EXCEPTION 'El rol de Desarrollador solo se asigna desde la base de datos.';
    END IF;

    RETURN NEW;
END;
$$;

-- --------------------------------------------------------------------
-- Función RPC: aprobar_guia(p_id_guia, p_comentarios)
-- Aprueba una guía pendiente de forma transaccional:
--   1. Valida permisos (Director o Desarrollador)
--   2. Actualiza estado de la guía a 'Aprobada'
--   3. Suma cantidades al stock de cada producto asociado
--   4. Registra la acción en audit_log
-- --------------------------------------------------------------------
CREATE FUNCTION public.aprobar_guia(p_id_guia INTEGER, p_comentarios TEXT DEFAULT NULL) RETURNS JSON
    LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_input_record RECORD;
    v_total_productos INTEGER := 0;
    v_guia_info RECORD;
    v_user_role INTEGER;
BEGIN
    -- Verificar permisos
    SELECT id_rol INTO v_user_role FROM users WHERE id_user = auth.uid();
    IF v_user_role IS NULL OR v_user_role NOT IN (1, 4) THEN
        RAISE EXCEPTION 'No tiene permisos para aprobar guías.';
    END IF;

    -- Verificar existencia y estado
    SELECT * INTO v_guia_info FROM guia_entrada WHERE id_guia = p_id_guia;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Guía con ID % no encontrada', p_id_guia;
    END IF;
    IF v_guia_info.estado != 'Pendiente' THEN
        RAISE EXCEPTION 'La guía ya fue procesada. Estado actual: %', v_guia_info.estado;
    END IF;

    -- Actualizar estado de la guía
    UPDATE guia_entrada
    SET estado = 'Aprobada', aprobado_por = auth.uid(),
        fecha_aprobacion = NOW(), comentarios_aprobacion = p_comentarios
    WHERE id_guia = p_id_guia;

    -- Procesar cada producto: sumar al stock
    FOR v_input_record IN SELECT i.* FROM input i WHERE i.id_guia = p_id_guia
    LOOP
        v_total_productos := v_total_productos + 1;
        UPDATE product SET stock = stock + v_input_record.amount
        WHERE id_product = v_input_record.id_product;
    END LOOP;

    -- Auditoría
    INSERT INTO audit_log (id_user, action_type, table_affected, record_id, details)
    VALUES (auth.uid(), 'APPROVE', 'guia_entrada', p_id_guia,
        jsonb_build_object('numero_guia', v_guia_info.numero_guia_sunagro,
            'productos_procesados', v_total_productos, 'comentarios', p_comentarios)::text);

    RETURN json_build_object('success', true, 'id_guia', p_id_guia,
        'productos_procesados', v_total_productos,
        'mensaje', format('Guía %s aprobada. %s productos actualizados.',
            v_guia_info.numero_guia_sunagro, v_total_productos));
EXCEPTION
    WHEN OTHERS THEN RAISE EXCEPTION 'Error al aprobar guía: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.aprobar_guia(INTEGER, TEXT) IS 'Aprueba una guía pendiente y actualiza el inventario de forma transaccional';

-- --------------------------------------------------------------------
-- Función RPC: rechazar_guia(p_id_guia, p_motivo)
-- Rechaza una guía pendiente con motivo obligatorio.
-- El inventario NO se modifica.
-- --------------------------------------------------------------------
CREATE FUNCTION public.rechazar_guia(p_id_guia INTEGER, p_motivo TEXT) RETURNS JSON
    LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_guia_info RECORD;
    v_user_role INTEGER;
BEGIN
    -- Verificar permisos
    SELECT id_rol INTO v_user_role FROM users WHERE id_user = auth.uid();
    IF v_user_role IS NULL OR v_user_role NOT IN (1, 4) THEN
        RAISE EXCEPTION 'No tiene permisos para rechazar guías. Se requiere rol de Director o Desarrollador.';
    END IF;

    -- Verificar existencia y estado
    SELECT * INTO v_guia_info FROM guia_entrada WHERE id_guia = p_id_guia;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Guía con ID % no encontrada', p_id_guia;
    END IF;
    IF v_guia_info.estado != 'Pendiente' THEN
        RAISE EXCEPTION 'La guía ya fue procesada. Estado actual: %', v_guia_info.estado;
    END IF;

    -- Validar motivo obligatorio
    IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
        RAISE EXCEPTION 'Debe proporcionar un motivo para rechazar la guía';
    END IF;

    -- Actualizar estado
    UPDATE guia_entrada
    SET estado = 'Rechazada', aprobado_por = auth.uid(),
        fecha_aprobacion = NOW(), comentarios_aprobacion = p_motivo
    WHERE id_guia = p_id_guia;

    -- Auditoría
    INSERT INTO audit_log (id_user, action_type, table_affected, record_id, details)
    VALUES (auth.uid(), 'REJECT', 'guia_entrada', p_id_guia,
        jsonb_build_object('numero_guia', v_guia_info.numero_guia_sunagro, 'motivo', p_motivo)::text);

    RETURN json_build_object('success', true, 'id_guia', p_id_guia,
        'mensaje', format('Guía %s rechazada.', v_guia_info.numero_guia_sunagro));
EXCEPTION
    WHEN OTHERS THEN RAISE EXCEPTION 'Error al rechazar guía: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.rechazar_guia(INTEGER, TEXT) IS 'Rechaza una guía pendiente con motivo obligatorio';

-- --------------------------------------------------------------------
-- Función RPC: get_lotes_por_vencer(p_dias)
-- Devuelve los lotes de inventario que vencen dentro de los próximos
-- p_dias días (por defecto 30). Usado en el Dashboard.
-- --------------------------------------------------------------------
CREATE FUNCTION public.get_lotes_por_vencer(p_dias INTEGER DEFAULT 30)
    RETURNS TABLE (
        id_product       INTEGER,
        product_name     TEXT,
        stock            NUMERIC,
        unit_measure     TEXT,
        category_name    TEXT,
        fecha_vencimiento DATE,
        cantidad_lote    NUMERIC,
        dias_restantes   INTEGER
    )
    LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT p.id_product, p.product_name, p.stock, p.unit_measure,
        c.category_name, (lote->>'fecha_vencimiento')::DATE,
        (lote->>'cantidad')::NUMERIC(10,2),
        ((lote->>'fecha_vencimiento')::DATE - CURRENT_DATE)::INTEGER
    FROM input i
    JOIN guia_entrada g ON i.id_guia = g.id_guia
    JOIN product p ON i.id_product = p.id_product
    LEFT JOIN category c ON p.id_category = c.id_category
    CROSS JOIN LATERAL jsonb_array_elements(i.lotes_detalle) AS lote
    WHERE g.estado = 'Aprobada'
        AND i.lotes_detalle IS NOT NULL
        AND jsonb_array_length(i.lotes_detalle) > 0
        AND (lote->>'fecha_vencimiento')::DATE <= CURRENT_DATE + p_dias * INTERVAL '1 day'
    ORDER BY (lote->>'fecha_vencimiento')::DATE;
END;
$$;

-- --------------------------------------------------------------------
-- Función RPC: procesar_operacion_diaria(p_fecha, p_turno, p_asistencia, p_rubros)
-- Operación transaccional que:
--   1. Crea registro diario (cabecera)
--   2. Para cada rubro: calcula consumo via rendimiento
--   3. Descuenta lotes JSONB por FIFO (vencimiento ASC)
--   4. Inserta salidas (output) que disparan descuento de stock
--   5. Registra auditoría
-- --------------------------------------------------------------------
CREATE FUNCTION public.procesar_operacion_diaria(
    p_fecha DATE, p_turno VARCHAR, p_asistencia INTEGER, p_rubros INTEGER[]
) RETURNS JSON
    LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_id_registro        INTEGER;
    v_id_product         INTEGER;
    v_product_name       TEXT;
    v_rendimiento        NUMERIC;
    v_cantidad_necesaria NUMERIC;
    v_pendiente          NUMERIC;
    v_lote_record        RECORD;
    v_disponible         NUMERIC;
    v_consumir           NUMERIC;
    v_total_rubros       INTEGER := 0;
    v_detalle            JSONB   := '[]'::JSONB;
BEGIN
    -- Validaciones
    IF p_asistencia <= 0 THEN
        RAISE EXCEPTION 'La asistencia debe ser mayor a 0.';
    END IF;
    IF array_length(p_rubros, 1) IS NULL THEN
        RAISE EXCEPTION 'Debe incluir al menos un rubro.';
    END IF;

    -- 1. Insertar cabecera del registro diario
    INSERT INTO registro_diario (fecha, turno, asistencia_total, created_by)
    VALUES (p_fecha, p_turno, p_asistencia, auth.uid())
    RETURNING id_registro INTO v_id_registro;

    -- 2. Procesar cada rubro
    FOREACH v_id_product IN ARRAY p_rubros
    LOOP
        -- Obtener nombre y rendimiento
        SELECT p.product_name, rp.rendimiento_por_unidad
        INTO   v_product_name, v_rendimiento
        FROM   product p
        LEFT JOIN receta_porcion rp ON p.id_product = rp.id_product
        WHERE  p.id_product = v_id_product;

        IF v_product_name IS NULL THEN
            RAISE EXCEPTION 'El rubro con ID % no existe.', v_id_product;
        END IF;
        IF v_rendimiento IS NULL OR v_rendimiento <= 0 THEN
            RAISE EXCEPTION 'El rubro "%" (ID %) no tiene rendimiento configurado.',
                v_product_name, v_id_product;
        END IF;

        -- Cantidad exacta a descontar
        v_cantidad_necesaria := ROUND(p_asistencia::NUMERIC / v_rendimiento, 2);
        v_pendiente := v_cantidad_necesaria;

        -- 3. FIFO sobre lotes JSONB: bloquear filas para evitar condiciones de carrera
        PERFORM NULL
        FROM input i
        JOIN guia_entrada g ON i.id_guia = g.id_guia
        WHERE g.estado = 'Aprobada'
            AND i.id_product = v_id_product
            AND i.lotes_detalle IS NOT NULL
        FOR UPDATE OF i;

        -- Iterar lotes ordenados por vencimiento ASC (primero los más antiguos)
        FOR v_lote_record IN
            SELECT
                i.id_input,
                (arr.ordinality - 1)::INTEGER AS lote_idx,
                (arr.elem->>'cantidad')::NUMERIC AS cantidad,
                (arr.elem->>'fecha_vencimiento')::DATE AS fecha_venc
            FROM input i
            JOIN guia_entrada g ON i.id_guia = g.id_guia
            CROSS JOIN LATERAL jsonb_array_elements(i.lotes_detalle)
                WITH ORDINALITY AS arr(elem, ordinality)
            WHERE g.estado = 'Aprobada'
                AND i.id_product = v_id_product
                AND i.lotes_detalle IS NOT NULL
                AND jsonb_array_length(i.lotes_detalle) > 0
                AND (arr.elem->>'cantidad')::NUMERIC > 0
            ORDER BY (arr.elem->>'fecha_vencimiento')::DATE ASC
        LOOP
            EXIT WHEN v_pendiente <= 0;

            v_disponible := v_lote_record.cantidad;
            v_consumir   := LEAST(v_disponible, v_pendiente);

            -- Actualizar la cantidad del lote JSONB específico
            UPDATE input
            SET lotes_detalle = jsonb_set(
                lotes_detalle,
                ARRAY[v_lote_record.lote_idx::TEXT, 'cantidad'],
                to_jsonb(ROUND(v_disponible - v_consumir, 2))
            )
            WHERE id_input = v_lote_record.id_input;

            v_pendiente := ROUND(v_pendiente - v_consumir, 2);
        END LOOP;

        -- 4. Registrar salida (el trigger update_stock_on_output descuenta product.stock)
        INSERT INTO output (id_product, amount, fecha, motivo, id_registro, created_by)
        VALUES (
            v_id_product, v_cantidad_necesaria, p_fecha,
            format('%s — %s comensales', p_turno, p_asistencia),
            v_id_registro, auth.uid()
        );

        v_total_rubros := v_total_rubros + 1;

        -- Acumular detalle para la respuesta
        v_detalle := v_detalle || jsonb_build_array(jsonb_build_object(
            'id_product', v_id_product,
            'product_name', v_product_name,
            'rendimiento', v_rendimiento,
            'cantidad_descontada', v_cantidad_necesaria,
            'lotes_sin_cubrir', GREATEST(v_pendiente, 0)
        ));
    END LOOP;

    -- 5. Auditoría
    INSERT INTO audit_log (id_user, action_type, table_affected, record_id, details)
    VALUES (auth.uid(), 'INSERT', 'registro_diario', v_id_registro,
        jsonb_build_object(
            'fecha', p_fecha, 'turno', p_turno,
            'asistencia', p_asistencia,
            'rubros_procesados', v_total_rubros,
            'detalle', v_detalle
        )::text
    );

    -- Respuesta JSON
    RETURN json_build_object(
        'success', true,
        'id_registro', v_id_registro,
        'rubros_procesados', v_total_rubros,
        'detalle', v_detalle,
        'mensaje', format('Operación registrada: %s rubros procesados para %s comensales (%s).',
            v_total_rubros, p_asistencia, p_turno)
    );
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'Ya existe un registro para % — %. No se puede duplicar.', p_fecha, p_turno;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error procesando operación diaria: %', SQLERRM;
END;
$$;


-- ####################################################################
-- PASO 3: TRIGGERS DE SEGURIDAD Y AUDITORÍA
-- ####################################################################

-- Auditoría automática en tablas principales
CREATE TRIGGER audit_product      AFTER INSERT OR UPDATE OR DELETE ON public.product      FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_guia         AFTER INSERT OR UPDATE OR DELETE ON public.guia_entrada  FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_menu         AFTER INSERT OR UPDATE OR DELETE ON public.menu_diario   FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_output       AFTER INSERT OR UPDATE OR DELETE ON public.output        FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- Actualización automática de updated_at en product
CREATE TRIGGER update_product_updated_at BEFORE UPDATE ON public.product FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Descuento automático de stock al insertar salida
CREATE TRIGGER trigger_update_stock_output AFTER INSERT ON public.output FOR EACH ROW EXECUTE FUNCTION public.update_stock_on_output();

-- Protección RBAC en tabla users
CREATE TRIGGER trigger_protect_director        BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.protect_director_users();
CREATE TRIGGER trigger_protect_director_insert BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.protect_director_insert();


-- ####################################################################
-- PASO 4: POLÍTICAS DE SEGURIDAD DE NIVEL DE FILA (RLS)
-- ####################################################################

-- Habilitar RLS en todas las tablas
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guia_entrada       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.input              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.output             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registro_diario    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receta_porcion     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencia_diaria  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_diario        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_detalle       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institucion        ENABLE ROW LEVEL SECURITY;

-- ---- users ----
CREATE POLICY "Users: Todos pueden ver"       ON public.users FOR SELECT USING (true);
CREATE POLICY "Users: Director puede insertar" ON public.users FOR INSERT WITH CHECK (get_user_role() IN (1, 4));
CREATE POLICY "Users: Director puede actualizar" ON public.users FOR UPDATE USING (get_user_role() IN (1, 4));
CREATE POLICY "Users can update own activity"  ON public.users FOR UPDATE USING (id_user = auth.uid()) WITH CHECK (id_user = auth.uid());

-- ---- product ----
CREATE POLICY "Products: Todos pueden ver"      ON public.product FOR SELECT USING (true);
CREATE POLICY "Products: Director y Madre Procesadora pueden crear"      ON public.product FOR INSERT WITH CHECK (get_user_role() IN (1, 2, 4));
CREATE POLICY "Products: Director y Madre Procesadora pueden actualizar" ON public.product FOR UPDATE USING (get_user_role() IN (1, 2, 4));
CREATE POLICY "Products: Solo Director puede borrar"                     ON public.product FOR DELETE USING (get_user_role() IN (1, 4));

-- ---- category ----
CREATE POLICY "Categories: Todos pueden ver"    ON public.category FOR SELECT USING (true);
CREATE POLICY "Categories: Admin puede modificar" ON public.category USING (get_user_role() IN (1, 4));

-- ---- guia_entrada ----
CREATE POLICY "Guias: Todos pueden ver"          ON public.guia_entrada FOR SELECT USING (true);
CREATE POLICY "Guias: Admin y Cocinera pueden crear" ON public.guia_entrada FOR INSERT WITH CHECK (get_user_role() IN (1, 2, 4));
CREATE POLICY "Guias: Admin puede modificar"     ON public.guia_entrada FOR UPDATE USING (get_user_role() IN (1, 4));

-- ---- input ----
CREATE POLICY "Input: Todos pueden ver"          ON public.input FOR SELECT USING (true);
CREATE POLICY "Input: Admin y Cocinera pueden crear" ON public.input FOR INSERT WITH CHECK (get_user_role() IN (1, 2, 4));

-- ---- output ----
CREATE POLICY "Output: Todos pueden ver"         ON public.output FOR SELECT USING (true);
CREATE POLICY "Output: Admin y Cocinera pueden crear" ON public.output FOR INSERT WITH CHECK (get_user_role() IN (1, 2, 4));

-- ---- registro_diario ----
CREATE POLICY "registro_diario_select" ON public.registro_diario FOR SELECT USING (true);
CREATE POLICY "registro_diario_insert" ON public.registro_diario FOR INSERT WITH CHECK (get_user_role() IN (1, 2, 4));
CREATE POLICY "registro_diario_update" ON public.registro_diario FOR UPDATE USING (get_user_role() IN (1, 2, 4));

-- ---- receta_porcion ----
CREATE POLICY "Porciones: Todos pueden ver"           ON public.receta_porcion FOR SELECT USING (true);
CREATE POLICY "Porciones: Admin y Cocinera pueden modificar" ON public.receta_porcion USING (get_user_role() IN (1, 2, 4));

-- ---- asistencia_diaria ----
CREATE POLICY "Asistencia: Todos pueden ver"           ON public.asistencia_diaria FOR SELECT USING (true);
CREATE POLICY "Asistencia: Admin y Cocinera pueden crear"      ON public.asistencia_diaria FOR INSERT WITH CHECK (get_user_role() IN (1, 2, 4));
CREATE POLICY "Asistencia: Admin y Cocinera pueden actualizar" ON public.asistencia_diaria FOR UPDATE USING (get_user_role() IN (1, 2, 4));
CREATE POLICY "Asistencia: Admin y Cocinera pueden eliminar"   ON public.asistencia_diaria FOR DELETE USING (get_user_role() IN (1, 2, 4));

-- ---- menu_diario ----
CREATE POLICY "Menu: Todos pueden ver"                ON public.menu_diario FOR SELECT USING (true);
CREATE POLICY "Menu: Admin y Cocinera pueden crear"      ON public.menu_diario FOR INSERT WITH CHECK (get_user_role() IN (1, 2, 4));
CREATE POLICY "Menu: Admin y Cocinera pueden actualizar" ON public.menu_diario FOR UPDATE USING (get_user_role() IN (1, 2, 4));

-- ---- menu_detalle ----
CREATE POLICY "Menu detalle: Todos pueden ver"                ON public.menu_detalle FOR SELECT USING (true);
CREATE POLICY "Menu detalle: Admin y Cocinera pueden modificar" ON public.menu_detalle USING (get_user_role() IN (1, 2, 4));

-- ---- audit_log ----
CREATE POLICY "Audit: Todos pueden ver" ON public.audit_log FOR SELECT USING (true);

-- ---- institucion ----
CREATE POLICY "institucion_select" ON public.institucion FOR SELECT TO authenticated USING (true);
CREATE POLICY "institucion_update" ON public.institucion FOR UPDATE TO authenticated
    USING  (EXISTS (SELECT 1 FROM users WHERE id_user = auth.uid() AND id_rol = 4))
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id_user = auth.uid() AND id_rol = 4));


-- ####################################################################
-- PASO 5: VISTAS DEL SISTEMA
-- ####################################################################

-- --------------------------------------------------------------------
-- Vista: inventario_actual
-- Resumen del inventario con nivel de stock calculado
-- --------------------------------------------------------------------
CREATE VIEW public.inventario_actual AS
SELECT
    p.id_product, p.product_name, p.stock, p.unit_measure,
    c.category_name,
    CASE
        WHEN p.stock < 10 THEN 'BAJO'
        WHEN p.stock < 50 THEN 'MEDIO'
        ELSE 'SUFICIENTE'
    END AS nivel_stock
FROM product p
LEFT JOIN category c ON p.id_category = c.id_category
ORDER BY c.category_name, p.product_name;

-- --------------------------------------------------------------------
-- Vista: productos_stock_bajo
-- Productos con stock menor a 10 unidades
-- --------------------------------------------------------------------
CREATE VIEW public.productos_stock_bajo AS
SELECT
    p.id_product, p.product_name, p.stock, p.unit_measure,
    c.category_name
FROM product p
LEFT JOIN category c ON p.id_category = c.id_category
WHERE p.stock < 10
ORDER BY p.stock;

-- --------------------------------------------------------------------
-- Vista: guias_pendientes
-- Guías en estado Pendiente con nombre del creador y total de productos
-- --------------------------------------------------------------------
CREATE VIEW public.guias_pendientes AS
SELECT
    g.*,
    u.username AS creador_nombre,
    COUNT(i.id_input) AS total_productos
FROM guia_entrada g
LEFT JOIN users u ON g.created_by = u.id_user
LEFT JOIN input i ON g.id_guia = i.id_guia
WHERE g.estado = 'Pendiente'
GROUP BY g.id_guia, u.username
ORDER BY g.fecha DESC, g.created_at DESC;

-- --------------------------------------------------------------------
-- Vista: historial_aprobaciones
-- Guías aprobadas/rechazadas con nombres de creador y aprobador
-- --------------------------------------------------------------------
CREATE VIEW public.historial_aprobaciones AS
SELECT
    g.*,
    u_creador.username AS creador_nombre,
    u_aprobador.username AS aprobador_nombre,
    COUNT(i.id_input) AS total_productos
FROM guia_entrada g
LEFT JOIN users u_creador ON g.created_by = u_creador.id_user
LEFT JOIN users u_aprobador ON g.aprobado_por = u_aprobador.id_user
LEFT JOIN input i ON g.id_guia = i.id_guia
WHERE g.estado IN ('Aprobada', 'Rechazada')
GROUP BY g.id_guia, u_creador.username, u_aprobador.username
ORDER BY g.fecha_aprobacion DESC;
