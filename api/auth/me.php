<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['ok' => false, 'error' => 'Método no permitido.'], 405);
}

$userId = require_user();
$stmt = db()->prepare('SELECT id,name,email,role,status FROM users WHERE id = ? LIMIT 1');
$stmt->execute([$userId]);
$user = $stmt->fetch();
if (!$user || $user['status'] !== 'active') {
    session_unset();
    session_destroy();
    json_response(['ok' => false, 'error' => 'Sesión inválida.'], 401);
}

$workspace = null;
if (!empty($_SESSION['workspace_id'])) {
    $stmt = db()->prepare('SELECT w.id,w.name,wu.role FROM workspace_users wu JOIN workspaces w ON w.id=wu.workspace_id WHERE wu.user_id=? AND w.id=? LIMIT 1');
    $stmt->execute([$userId, (int)$_SESSION['workspace_id']]);
    $workspace = $stmt->fetch() ?: null;
}

json_response([
    'ok' => true,
    'user' => [
        'id' => (int)$user['id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'role' => $user['role'],
    ],
    'workspace' => $workspace ? [
        'id' => (int)$workspace['id'],
        'name' => $workspace['name'],
        'role' => $workspace['role'],
    ] : null,
    'csrf_token' => csrf_token(),
]);
