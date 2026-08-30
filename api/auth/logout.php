<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'Método no permitido.'], 405);
}

verify_csrf();
$userId = current_user_id();
$workspaceId = isset($_SESSION['workspace_id']) ? (int)$_SESSION['workspace_id'] : null;
if ($userId) {
    audit($workspaceId, $userId, 'user', $userId, 'logout');
}

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
}
session_destroy();

json_response(['ok' => true]);
