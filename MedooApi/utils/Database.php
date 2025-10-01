<?php

namespace Api\Utils;

use Medoo\Medoo;

class Database
{
    private static $instance = null;
    private $db;

    private function __construct()
    {
        $config = require __DIR__ . '/../config/database.php';
        $this->db = new Medoo($config);
    }

    public static function getInstance()
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getConnection()
    {
        return $this->db;
    }
}
