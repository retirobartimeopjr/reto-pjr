CREATE TABLE IF NOT EXISTS bartimeo (
  id                       BIGSERIAL PRIMARY KEY,
  sheet_row                INTEGER,
  marca_temporal           TIMESTAMPTZ,
  nombre_completo          TEXT NOT NULL,
  fecha_nacimiento         DATE,
  edad                     SMALLINT,
  documento_identidad      TEXT NOT NULL,
  direccion                TEXT,
  telefono_bartimeo        TEXT,
  retiros_previos          TEXT,
  inscrito_antes           TEXT,
  talla_camiseta           TEXT,
  sacramentos              TEXT[],
  colegio                  TEXT,
  conoce_servidor          TEXT,
  alergias                 TEXT,
  restriccion_alimentaria  TEXT,
  condicion_medica         TEXT,
  medicamentos             TEXT,
  acudiente1_nombre        TEXT,
  acudiente1_parentesco    TEXT,
  acudiente1_telefono      TEXT,
  acudiente1_email         TEXT,
  acudiente2_nombre        TEXT,
  acudiente2_parentesco    TEXT,
  acudiente2_email         TEXT,
  acudiente2_telefono      TEXT,
  doc_identidad_url        TEXT,
  doc_identidad_file_id    TEXT,
  eps                      TEXT,
  eps_certificado_url      TEXT,
  eps_certificado_file_id  TEXT,
  autoriza_datos           BOOLEAN,
  autoriza_imagen          BOOLEAN,
  
  -- Campos de tracking manual (UI)
  coordi_contactado        TEXT,
  acudiente1_contactado    BOOLEAN DEFAULT false,
  acudiente2_contactado    BOOLEAN DEFAULT false,
  comentarios              TEXT,
  correo_enviado           BOOLEAN DEFAULT false,
  
  -- Sistema
  raw                      JSONB NOT NULL,
  content_hash             TEXT NOT NULL,
  first_synced_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT bartimeo_documento_unico UNIQUE (documento_identidad)
);

CREATE INDEX IF NOT EXISTS idx_bartimeo_nombre ON bartimeo (nombre_completo);
CREATE INDEX IF NOT EXISTS idx_bartimeo_marca  ON bartimeo (marca_temporal DESC);

CREATE TABLE IF NOT EXISTS bartimeo_sync_log (
  id            BIGSERIAL PRIMARY KEY,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  status        TEXT NOT NULL,          -- 'ok' | 'error'
  rows_read     INTEGER,
  rows_inserted INTEGER,
  rows_updated  INTEGER,
  rows_skipped  INTEGER,
  error_message TEXT,
  triggered_by  TEXT
);
