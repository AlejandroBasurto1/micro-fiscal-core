# Despliegue MRFC Cloud Core en cPanel

## 1. Requisitos
- PHP 8.1 o superior.
- MySQL/MariaDB con InnoDB y utf8mb4.
- Extensión PDO MySQL habilitada.
- HTTPS activo.

## 2. Base de datos
1. Crea una base MySQL y un usuario desde cPanel.
2. Asigna todos los privilegios del usuario sobre esa base.
3. Importa `database/schema.sql`.
4. Aplica después las migraciones de `database/migrations/` en orden numérico.

## 3. Configuración
1. Copia `config/config.local.example.php` como `config/config.php`.
2. Completa `base_url`, nombre de base, usuario y contraseña.
3. No subas `config/config.php` a GitHub.

Ejemplo mínimo:

```php
<?php
return [
  'app' => [
    'env' => 'production',
    'base_url' => 'https://mrfc.tudominio.com',
    'session_name' => 'mrfc_session',
    'upload_dir' => dirname(__DIR__) . '/storage/uploads',
    'max_upload_bytes' => 10485760,
  ],
  'db' => [
    'host' => 'localhost',
    'port' => 3306,
    'name' => 'BASE',
    'user' => 'USUARIO',
    'pass' => 'CONTRASENA',
    'charset' => 'utf8mb4',
  ],
];
```

## 4. Verificación
Abre `/api/health.php` en el dominio. Debe responder `ok: true`, `status: ready` y `database: connected`.

Después prueba:
- `POST /api/auth/register.php`
- `POST /api/auth/login.php`
- `GET /api/auth/me.php`
- `POST /api/auth/logout.php`

## 5. Seguridad
- Mantén `config/config.php` fuera de commits.
- Usa HTTPS.
- No uses una contraseña MySQL reutilizada.
- Restringe permisos de archivos y carpetas desde cPanel.
- Si es posible, mueve `storage/uploads` fuera de `public_html`.
