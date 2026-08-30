<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'Método no permitido.'], 405);
}

$data = request_json();
$name = trim((string)($data['name'] ?? ''));
$email = strtolower(trim((string)($data['email'] ?? '')));
$password = (string)($data['password'] ?? '');

if ($name === '' || mb_strlen($name) < 2) {
    json_response(['ok' => false, 'error' => 'Nombre inválido.'], 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(['ok' => false, 'error' => 'Correo inválido.'], 422);
}
if (strlen($password) < 8) {
    json_response(['ok' => false, 'error' => 'La contraseña debe tener al menos 8 caracteres.'], 422);
}

$pdo = db();
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    json_response(['ok' => false, 'error' => 'Ese correo ya está registrado.'], 409);
}

try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)');
    $stmt->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT)]);
    $userId = (int)$pdo->lastInsertId();

    $workspaceName = trim((string)($data['workspace_name'] ?? ''));
    if ($workspaceName === '') {
        $workspaceName = 'Mi espacio MRFC';
    }

    $stmt = $pdo->prepare('INSERT INTO workspaces (owner_user_id,name) VALUES (?,?)');
    $stmt->execute([$userId, $workspaceName]);
    $workspaceId = (int)$pdo->lastInsertId();

    $stmt = $pdo->prepare("INSERT INTO workspace_users (workspace_id,user_id,role) VALUES (?,?,'owner')");
    $stmt->execute([$workspaceId, $userId]);

    $pdo->commit();

    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;
    $_SESSION['workspace_id'] = $workspaceId;

    audit($workspaceId, $userId, 'user', $userId, 'register', ['email' => $email]);

    json_response([
        'ok' => true,
        'user' => ['id' => $userId, 'name' => $name, 'email' => $email],
        'workspace' => ['id' => $workspaceId, 'name' => $workspaceName],
        'csrf_token' => csrf_token(),
    ], 201);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('MRFC register error: ' . $e->getMessage());
    json_response(['ok' => false, 'error' => 'No fue posible crear la cuenta.'], 500);
}
