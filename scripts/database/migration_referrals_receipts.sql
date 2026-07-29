-- 1. Añadir deactivation_reason a users
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivation_reason VARCHAR(255);

-- 2. Añadir receipt_url a ticket_registers
ALTER TABLE ticket_registers ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- 3. Crear tabla user_referrals
CREATE TABLE IF NOT EXISTS user_referrals (
    id SERIAL PRIMARY KEY,
    referrer_phone VARCHAR(50) NOT NULL,
    referred_phone VARCHAR(50) NOT NULL,
    points_awarded INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_referral UNIQUE (referrer_phone, referred_phone)
);

-- 4. Crear tabla pending_referrals
CREATE TABLE IF NOT EXISTS pending_referrals (
    id SERIAL PRIMARY KEY,
    referrer_phone VARCHAR(50) NOT NULL,
    new_user_phone VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT false,
    CONSTRAINT unique_pending_referral UNIQUE (referrer_phone, new_user_phone)
);

-- 5. Añadir configuración de puntos a app_config
INSERT INTO app_config (key, value) VALUES ('referral_points', '150'::jsonb) ON CONFLICT DO NOTHING;

-- 6. Actualizar vista user_stats para calcular puntos de referidos
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.id AS user_id,
    u.username,
    u.is_active,
    (SELECT COUNT(*) FROM user_parroquia_visits WHERE user_id = u.id) AS parroquias_visitadas,
    (SELECT COUNT(*) FROM user_trivia_answers WHERE user_id = u.id) AS respuestas_enviadas,
    (SELECT COUNT(*) FROM user_trivia_answers WHERE user_id = u.id AND is_correct = true) AS respuestas_correctas,
    
    (SELECT STRING_AGG(ticket_number::TEXT, ',') FROM tickets WHERE user_id = u.id) AS tickets_numbers,
    (SELECT STRING_AGG(fixed, ',') FROM tickets WHERE user_id = u.id) AS tickets_fixed,
    
    -- Calcula el score sumando: visitas a parroquias + trivias + referidos
    COALESCE((SELECT SUM(points_awarded) FROM user_parroquia_visits WHERE user_id = u.id), 0) +
    COALESCE((SELECT SUM(snapshot_reward) FROM user_trivia_answers WHERE user_id = u.id AND is_correct = true), 0) +
    COALESCE((SELECT SUM(points_awarded) FROM user_referrals WHERE referrer_phone = u.phone), 0) AS calculated_score
FROM users u;
