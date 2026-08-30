-- MRFC Cloud Core v1
-- Amplía la ficha de vehículo para gastos, combustible, mantenimiento, rutas y entregas.

ALTER TABLE vehicles
  ADD COLUMN vehicle_type ENUM(
    'motorcycle',
    'car',
    'suv',
    'pickup',
    'van',
    'truck',
    'bicycle',
    'other'
  ) NOT NULL DEFAULT 'car' AFTER label,
  ADD COLUMN vehicle_use ENUM('business','personal','mixed') NOT NULL DEFAULT 'business' AFTER vehicle_type,
  ADD COLUMN ownership_type ENUM('owned','leased','financed','third_party','other') NOT NULL DEFAULT 'owned' AFTER vehicle_use,
  ADD COLUMN fuel_type ENUM('gasoline','diesel','hybrid','electric','lp_gas','natural_gas','other') NULL AFTER model_year,
  ADD COLUMN nickname VARCHAR(120) NULL AFTER label,
  ADD KEY idx_vehicle_workspace_type (workspace_id, vehicle_type, active);
