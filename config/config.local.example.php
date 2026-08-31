<?php
return [
    'app' => [
        'env' => 'production',
        'base_url' => 'https://TU-DOMINIO.com',
        'session_name' => 'mrfc_session',
        'upload_dir' => dirname(__DIR__) . '/storage/uploads',
        'max_upload_bytes' => 10 * 1024 * 1024,
    ],
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'TU_BASE_DE_DATOS',
        'user' => 'TU_USUARIO_DB',
        'pass' => 'TU_PASSWORD_DB',
        'charset' => 'utf8mb4',
    ],
];
