<?php

namespace Api\Middleware;

use Api\Utils\JWT;
use Api\Utils\Response;
use Api\Utils\Database;

class Auth
{
    public static function authenticate()
    {
        $token = JWT::getTokenFromHeader();

        if (!$token) {
            Response::error('Authentication required', 401);
        }

        $payload = JWT::decode($token);

        if (!$payload) {
            Response::error('Invalid or expired token', 401);
        }

        $db = Database::getInstance()->getConnection();
        $employee = $db->get('employees', '*', [
            'id' => $payload['user_id'],
            'is_active' => true
        ]);

        if (!$employee) {
            Response::error('User not found or inactive', 401);
        }

        return $employee;
    }

    public static function requireAdmin()
    {
        $employee = self::authenticate();

        if ($employee['role'] !== 'admin') {
            Response::error('Admin access required', 403);
        }

        return $employee;
    }
}
