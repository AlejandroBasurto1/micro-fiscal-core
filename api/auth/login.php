<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'Método no permitido.'], 405);
}

$data = request_json();
$email = strtolower(trim((string)($data['email'] ?? '')));
$password = (string)($data['password'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
    json_response(['ok' => false, 'error' => 'Credenciales inválidas.'], 422);
}

$stmt = db()->prepare('SELECT id,name,email,password_hash,role,status FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || $user['status'] !== 'active' || !password_verify($password, $user['password_hash'])) {
    usleep(250000);
    json_response(['ok' => false, 'error' => 'Correo o contraseña incorrectos.'], 401);
}

$stmt = db()->prepare("SELECT w.id,w.name,wu.role FROM workspace_users wu JOIN workspaces w ON w.id = wu.workspace_id WHERE wu.user_id = ? ORDER BY FIELD(wu.role,'owner','admin','member','viewer'), w.id LIMIT 1");
$stmt->execute([(int)$user['id']]);
$workspace = $stmt->fetch();

session_regenerate_id(true);
$_SESSION['user_id'] = (int)$user['id'];
$_SESSION['workspace_id'] = $workspace ? (int)$workspace['id'] : null;

if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
    $rehash = db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    $rehash->execute([password_hash($password, PASSWORD_DEFAULT), (int)$user['id']]);
}

audit($_SESSION['workspace_id'], (int)$user['id'], 'user', (int)$user['id'], 'login');

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
