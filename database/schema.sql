CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE workspaces (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_workspaces_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE workspace_users (
  workspace_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role ENUM('owner','admin','member','viewer') NOT NULL DEFAULT 'member',
  PRIMARY KEY (workspace_id,user_id),
  CONSTRAINT fk_wu_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_wu_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Perfil fiscal del usuario/espacio de trabajo.
-- tax_regime_code debe almacenar la clave oficial aplicable; las reglas fiscales se versionan aparte.
CREATE TABLE fiscal_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workspace_id BIGINT UNSIGNED NOT NULL,
  tax_regime_code VARCHAR(20) NOT NULL,
  tax_regime_name VARCHAR(190) NOT NULL,
  activity_name VARCHAR(190) NOT NULL,
  activity_description VARCHAR(500) NULL,
  rfc VARCHAR(13) NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 1,
  effective_from DATE NULL,
  effective_to DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_fiscal_workspace (workspace_id,is_primary),
  CONSTRAINT fk_fiscal_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Catálogo de conceptos y reglas. No afirma deducibilidad automática: define compatibilidad y requisitos.
CREATE TABLE fiscal_concepts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(60) NOT NULL UNIQUE,
  category VARCHAR(100) NOT NULL,
  name VARCHAR(190) NOT NULL,
  description VARCHAR(500) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE fiscal_rules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tax_regime_code VARCHAR(20) NOT NULL,
  activity_key VARCHAR(120) NOT NULL DEFAULT '*',
  fiscal_concept_id BIGINT UNSIGNED NOT NULL,
  status ENUM('compatible','conditional','not_deductible','unclassified') NOT NULL DEFAULT 'unclassified',
  requirements_json JSON NULL,
  legal_basis VARCHAR(1000) NULL,
  source_url VARCHAR(1000) NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  rule_version VARCHAR(40) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fiscal_rule (tax_regime_code,activity_key,fiscal_concept_id,rule_version),
  KEY idx_fiscal_rule_lookup (tax_regime_code,activity_key,active),
  CONSTRAINT fk_rule_concept FOREIGN KEY (fiscal_concept_id) REFERENCES fiscal_concepts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Directorio reutilizable: una entidad puede ser cliente, proveedor o ambos.
CREATE TABLE parties (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workspace_id BIGINT UNSIGNED NOT NULL,
  party_type ENUM('person','business') NOT NULL DEFAULT 'business',
  display_name VARCHAR(190) NOT NULL,
  legal_name VARCHAR(190) NULL,
  rfc VARCHAR(13) NULL,
  customer_number VARCHAR(120) NULL,
  supplier_number VARCHAR(120) NULL,
  is_customer TINYINT(1) NOT NULL DEFAULT 0,
  is_supplier TINYINT(1) NOT NULL DEFAULT 0,
  default_category VARCHAR(100) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_party_workspace_name (workspace_id,display_name),
  KEY idx_party_rfc (workspace_id,rfc),
  CONSTRAINT fk_party_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE party_contacts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  party_id BIGINT UNSIGNED NOT NULL,
  contact_name VARCHAR(190) NULL,
  phone VARCHAR(40) NULL,
  email VARCHAR(190) NULL,
  job_title VARCHAR(120) NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  notes VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_contact_party FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ubicaciones persistentes para entrega, carga de combustible, taller, oficina, etc.
CREATE TABLE party_locations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  party_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(120) NOT NULL DEFAULT 'Principal',
  location_type ENUM('delivery','fuel','office','warehouse','service','billing','other') NOT NULL DEFAULT 'other',
  address_line VARCHAR(500) NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  place_reference VARCHAR(500) NULL,
  access_notes VARCHAR(500) NULL,
  business_hours VARCHAR(255) NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_location_party (party_id),
  KEY idx_location_geo (latitude,longitude),
  CONSTRAINT fk_location_party FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vehicles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workspace_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(120) NOT NULL,
  plate VARCHAR(40) NULL,
  brand VARCHAR(80) NULL,
  model VARCHAR(100) NULL,
  model_year SMALLINT UNSIGNED NULL,
  serial_number VARCHAR(120) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vehicle_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Operaciones/entregas reutilizan cliente, contacto y ubicación ya capturados.
CREATE TABLE operations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workspace_id BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  operation_type ENUM('delivery','pickup','service','visit','other') NOT NULL DEFAULT 'delivery',
  party_id BIGINT UNSIGNED NULL,
  location_id BIGINT UNSIGNED NULL,
  vehicle_id BIGINT UNSIGNED NULL,
  reference VARCHAR(120) NULL,
  scheduled_at DATETIME NULL,
  completed_at DATETIME NULL,
  status ENUM('planned','in_progress','completed','cancelled') NOT NULL DEFAULT 'planned',
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_operation_workspace_time (workspace_id,scheduled_at),
  CONSTRAINT fk_operation_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_operation_user FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_operation_party FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE SET NULL,
  CONSTRAINT fk_operation_location FOREIGN KEY (location_id) REFERENCES party_locations(id) ON DELETE SET NULL,
  CONSTRAINT fk_operation_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bolsas de viáticos: cada entrega/depósito conserva su propio saldo operativo.
CREATE TABLE per_diem_funds (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workspace_id BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  name VARCHAR(190) NOT NULL,
  purpose VARCHAR(500) NULL,
  received_date DATE NOT NULL,
  amount_received DECIMAL(14,2) NOT NULL,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  closed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_perdiem_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_perdiem_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE expenses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workspace_id BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  sequence_no INT UNSIGNED NOT NULL,
  expense_date DATE NULL,
  expense_week VARCHAR(80) NULL,
  provider_id BIGINT UNSIGNED NULL,
  provider VARCHAR(190) NOT NULL,
  document_folio VARCHAR(120) NULL,
  category VARCHAR(100) NULL,
  fiscal_concept_id BIGINT UNSIGNED NULL,
  original_concept VARCHAR(255) NOT NULL,
  description VARCHAR(500) NULL,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax_treatment ENUM('compatible','conditional','not_deductible','unclassified') NOT NULL DEFAULT 'unclassified',
  tax_rule_id BIGINT UNSIGNED NULL,
  tax_validation_json JSON NULL,
  receipt_status ENUM('pending','received','sent','not_required') NOT NULL DEFAULT 'pending',
  receipt_received_at DATETIME NULL,
  sent_week VARCHAR(80) NULL,
  per_diem_fund_id BIGINT UNSIGNED NULL,
  vehicle_id BIGINT UNSIGNED NULL,
  location_id BIGINT UNSIGNED NULL,
  operation_id BIGINT UNSIGNED NULL,
  is_period_closed TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_expense_sequence (workspace_id,sequence_no),
  KEY idx_expense_date (workspace_id,expense_date),
  KEY idx_expense_provider (workspace_id,provider_id),
  KEY idx_expense_perdiem (per_diem_fund_id),
  CONSTRAINT fk_expense_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_expense_user FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_expense_provider FOREIGN KEY (provider_id) REFERENCES parties(id) ON DELETE SET NULL,
  CONSTRAINT fk_expense_fiscal_concept FOREIGN KEY (fiscal_concept_id) REFERENCES fiscal_concepts(id) ON DELETE SET NULL,
  CONSTRAINT fk_expense_tax_rule FOREIGN KEY (tax_rule_id) REFERENCES fiscal_rules(id) ON DELETE SET NULL,
  CONSTRAINT fk_expense_perdiem FOREIGN KEY (per_diem_fund_id) REFERENCES per_diem_funds(id) ON DELETE SET NULL,
  CONSTRAINT fk_expense_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
  CONSTRAINT fk_expense_location FOREIGN KEY (location_id) REFERENCES party_locations(id) ON DELETE SET NULL,
  CONSTRAINT fk_expense_operation FOREIGN KEY (operation_id) REFERENCES operations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE expense_documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  expense_id BIGINT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  sha256 CHAR(64) NOT NULL,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_document_hash (expense_id,sha256),
  CONSTRAINT fk_doc_expense FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_user FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workspace_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  action VARCHAR(60) NOT NULL,
  detail_json JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_workspace_time (workspace_id,created_at),
  CONSTRAINT fk_audit_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
