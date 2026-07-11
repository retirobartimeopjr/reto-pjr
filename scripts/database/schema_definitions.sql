-- ==========================================
-- ⚠️ RESET ABSOLUTO (Elimina TODO y empieza de cero)
-- ==========================================
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- ==========================================
-- SCRIPT DE MIGRACIÓN: BARTIMEO-DB (V2)
-- ==========================================

-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. TABLA DE USUARIOS
-- ==========================================
CREATE TABLE users (
    id VARCHAR(128) PRIMARY KEY,
    phone VARCHAR(50),
    username VARCHAR(255),
    cedula VARCHAR(50),
    email VARCHAR(255),
    referencia VARCHAR(50),
    referidos INT DEFAULT 0,
    tickets_quantity INT DEFAULT 0,
    payed_tickets INT DEFAULT 0,
    pending_pay INT DEFAULT 0,
    total_points INT DEFAULT 0,
    last_trivia_date DATE,
    daily_trivia_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 2. TABLA DE PARROQUIAS
-- ==========================================
CREATE TABLE parroquias (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    vicaria VARCHAR(255),
    arcipestre VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    reward INT DEFAULT 0,
    foto TEXT,
    horarios TEXT,
    santisimo TEXT,
    radius VARCHAR(50),
    euclidean VARCHAR(50)
);

-- ==========================================
-- 3. TABLA DE PREGUNTAS (TRIVIA)
-- ==========================================
CREATE TABLE preguntas (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) DEFAULT 'multiple',
    pregunta TEXT NOT NULL,
    opcion_a VARCHAR(255) NOT NULL,
    opcion_b VARCHAR(255) NOT NULL,
    opcion_c VARCHAR(255),
    opcion_d VARCHAR(255),
    respuesta_correcta VARCHAR(255) NOT NULL,
    dia INT,
    mes INT,
    hora INT,
    reward INT DEFAULT 0
);

-- ==========================================
-- 4. VISITAS A PARROQUIAS
-- ==========================================
CREATE TABLE user_parroquia_visits (
    id VARCHAR(128) PRIMARY KEY, -- Usamos el ID de Firebase para poder migrar el historial exacto
    user_id VARCHAR(128) REFERENCES users(id) ON DELETE CASCADE,
    parroquia_id INT REFERENCES parroquias(id) ON DELETE RESTRICT,
    points_awarded INT DEFAULT 0,
    photo_url TEXT,
    valor_otorgado INT DEFAULT 0,
    puntos_otorgados BOOLEAN DEFAULT false,
    visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_parroquia_visit UNIQUE (user_id, parroquia_id)
);

-- ==========================================
-- 5. RESPUESTAS DE TRIVIA
-- ==========================================
CREATE TABLE user_trivia_answers (
    id VARCHAR(128) PRIMARY KEY, -- Usamos el ID de Firebase para migrar el historial exacto
    user_id VARCHAR(128) REFERENCES users(id) ON DELETE CASCADE,
    pregunta_id INT REFERENCES preguntas(id) ON DELETE RESTRICT,
    respuesta_enviada VARCHAR(255),
    is_correct BOOLEAN NOT NULL,
    snapshot_reward INT DEFAULT 0,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_trivia_answer UNIQUE (user_id, pregunta_id)
);

-- ==========================================
-- 6. TABLA DE TICKETS (Rifas/Sorteos)
-- ==========================================
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    ticket_number INT UNIQUE NOT NULL,
    fixed VARCHAR(50),
    security VARCHAR(50),
    
    -- PROTECCIÓN: ON DELETE SET NULL. Si borras un usuario, sus tickets no se destruyen,
    -- simplemente vuelven a quedar disponibles (user_id se vuelve NULL).
    user_id VARCHAR(128) REFERENCES users(id) ON DELETE SET NULL,
    
    payed VARCHAR(20),
    cleared_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 7. REGISTRO DE TICKETS (Historial/Logs)
-- ==========================================
CREATE TABLE ticket_registers (
    id VARCHAR(128) PRIMARY KEY,
    ticket_number INT,
    phone VARCHAR(50),
    cedula VARCHAR(50),
    username VARCHAR(255),
    payed VARCHAR(20),
    fixed VARCHAR(50),
    status VARCHAR(50),
    error TEXT,
    user_id VARCHAR(128) REFERENCES users(id) ON DELETE CASCADE,
    imported_at TIMESTAMP,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- VISTAS MÁGICAS (Solucionan todos tus problemas de concurrencia)
-- ==========================================

-- Vista 1: Visitas a parroquias (Siempre actualizado, sin bloqueos)
CREATE OR REPLACE VIEW parroquia_stats AS
SELECT 
    p.id,
    p.code,
    p.name,
    COUNT(v.id) AS total_visits
FROM parroquias p
LEFT JOIN user_parroquia_visits v ON p.id = v.parroquia_id
GROUP BY p.id;

-- Vista 2: El Super-Usuario. Genera en tiempo real los arrays separados por comas que tenías en Firebase.
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.id AS user_id,
    u.username,
    (SELECT COUNT(*) FROM user_parroquia_visits WHERE user_id = u.id) AS parroquias_visitadas,
    (SELECT COUNT(*) FROM user_trivia_answers WHERE user_id = u.id) AS respuestas_enviadas,
    (SELECT COUNT(*) FROM user_trivia_answers WHERE user_id = u.id AND is_correct = true) AS respuestas_correctas,
    
    -- Aquí recreamos la magia de "tickets-numbers": "141,191" sin usar textos estáticos
    (SELECT STRING_AGG(ticket_number::TEXT, ',') FROM tickets WHERE user_id = u.id) AS tickets_numbers,
    (SELECT STRING_AGG(fixed, ',') FROM tickets WHERE user_id = u.id) AS tickets_fixed,
    
    -- Calcula el score real sumando las fotos aprobadas y las trivias correctas
    COALESCE((SELECT SUM(points_awarded) FROM user_parroquia_visits WHERE user_id = u.id), 0) +
    COALESCE((SELECT SUM(snapshot_reward) FROM user_trivia_answers WHERE user_id = u.id AND is_correct = true), 0) AS calculated_score
FROM users u;
