<?php

return [
    'secret_key' => getenv('JWT_SECRET') ?: 'your-secret-key-change-in-production',
    'algorithm' => 'HS256',
    'expiration' => 86400, // 24 hours in seconds
];
