<?php

namespace Api\Utils;

use Firebase\JWT\JWT as FirebaseJWT;
use Firebase\JWT\Key;

class JWT
{
    private static $config;

    private static function getConfig()
    {
        if (self::$config === null) {
            self::$config = require __DIR__ . '/../config/jwt.php';
        }
        return self::$config;
    }

    public static function encode($payload)
    {
        $config = self::getConfig();
        $issuedAt = time();
        $expire = $issuedAt + $config['expiration'];

        $payload['iat'] = $issuedAt;
        $payload['exp'] = $expire;

        return FirebaseJWT::encode($payload, $config['secret_key'], $config['algorithm']);
    }

    public static function decode($token)
    {
        try {
            $config = self::getConfig();
            $decoded = FirebaseJWT::decode($token, new Key($config['secret_key'], $config['algorithm']));
            return (array) $decoded;
        } catch (\Exception $e) {
            return null;
        }
    }

    public static function getTokenFromHeader()
    {
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            $authHeader = $headers['Authorization'];
            if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
                return $matches[1];
            }
        }
        return null;
    }
}
