# Laravel Backend Deployment Guide

Complete guide for deploying the Time Tracking System with Laravel backend and React frontend.

## System Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Laravel 10 API
- **Database**: MySQL 5.7+
- **Authentication**: Laravel Sanctum (Token-based)

## Server Requirements

### Minimum Requirements

- PHP 8.1 or higher
- MySQL 5.7+ or MariaDB 10.3+
- Nginx 1.18+ or Apache 2.4+
- Composer 2.x
- Node.js 18+ and npm (for frontend)
- 1GB RAM minimum (2GB recommended)

### Required PHP Extensions

- OpenSSL
- PDO
- Mbstring
- Tokenizer
- XML
- Ctype
- JSON
- BCMath

## Installation Steps

### Step 1: Server Setup

#### Ubuntu/Debian

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install PHP and extensions
sudo apt install php8.1 php8.1-fpm php8.1-mysql php8.1-mbstring \
  php8.1-xml php8.1-bcmath php8.1-curl php8.1-zip -y

# Install MySQL
sudo apt install mysql-server -y

# Install Nginx
sudo apt install nginx -y

# Install Composer
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer

# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y
```

#### CentOS/RHEL

```bash
# Install PHP and extensions
sudo dnf install php php-fpm php-mysqlnd php-mbstring \
  php-xml php-bcmath php-json -y

# Install MySQL/MariaDB
sudo dnf install mariadb-server -y

# Install Nginx
sudo dnf install nginx -y

# Install Composer
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
```

### Step 2: Upload Project Files

```bash
# Using Git
cd /var/www
sudo git clone your-repository-url html
sudo chown -R $USER:www-data html

# Or using SCP
scp -r /local/project user@server:/var/www/html
```

### Step 3: Install Laravel Dependencies

```bash
cd /var/www/html/LaravelBackend
composer install --optimize-autoloader --no-dev
```

### Step 4: Configure Laravel

```bash
# Copy environment file
cp .env.example .env

# Edit environment variables
nano .env
```

Configure these values:

```env
APP_NAME="Time Tracking API"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://yourdomain.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=time_tracking
DB_USERNAME=time_tracking_user
DB_PASSWORD=your_secure_password

CORS_ALLOWED_ORIGINS=https://yourdomain.com
SANCTUM_STATEFUL_DOMAINS=yourdomain.com
```

Generate application key:

```bash
php artisan key:generate
```

### Step 5: Setup Database

```bash
# Login to MySQL
sudo mysql -u root -p

# Create database and user
CREATE DATABASE time_tracking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'time_tracking_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON time_tracking.* TO 'time_tracking_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Run migrations
cd /var/www/html/LaravelBackend
php artisan migrate --force

# Seed database with default users
php artisan db:seed --force
```

### Step 6: Build Frontend

```bash
cd /var/www/html

# Update API URL
echo "VITE_API_URL=https://yourdomain.com/api" > .env

# Install dependencies and build
npm install
npm run build
```

### Step 7: Configure Nginx

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/timetracking
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/html/dist;
    index index.html;

    # Frontend - Serve React app
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Laravel API
    location /api {
        try_files $uri $uri/ /LaravelBackend/public/index.php?$query_string;
    }

    # Laravel backend files
    location ~ ^/LaravelBackend/public/(.*)$ {
        alias /var/www/html/LaravelBackend/public/$1;
        try_files $uri $uri/ /LaravelBackend/public/index.php?$query_string;

        location ~ \.php$ {
            include snippets/fastcgi-php.conf;
            fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
            fastcgi_param SCRIPT_FILENAME $request_filename;
        }
    }

    # Deny access to sensitive files
    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/timetracking /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 8: Set Permissions

```bash
cd /var/www/html

# Set ownership
sudo chown -R www-data:www-data LaravelBackend/storage LaravelBackend/bootstrap/cache

# Set permissions
sudo chmod -R 775 LaravelBackend/storage
sudo chmod -R 775 LaravelBackend/bootstrap/cache
```

### Step 9: Optimize Laravel

```bash
cd /var/www/html/LaravelBackend

# Cache configuration
php artisan config:cache

# Cache routes
php artisan route:cache

# Optimize application
php artisan optimize
```

### Step 10: Configure SSL (Production)

#### Using Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renew setup (already included with certbot)
sudo certbot renew --dry-run
```

Update Nginx configuration to redirect HTTP to HTTPS:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Rest of configuration...
}
```

## Apache Configuration

If using Apache instead of Nginx:

```apache
<VirtualHost *:80>
    ServerName yourdomain.com
    DocumentRoot /var/www/html/dist

    # React frontend
    <Directory /var/www/html/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # Laravel API
    Alias /api /var/www/html/LaravelBackend/public/index.php

    <Directory /var/www/html/LaravelBackend/public>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/timetracking_error.log
    CustomLog ${APACHE_LOG_DIR}/timetracking_access.log combined
</VirtualHost>
```

Enable modules and site:

```bash
sudo a2enmod rewrite
sudo a2ensite timetracking
sudo systemctl reload apache2
```

## Post-Deployment

### Test the Application

1. Visit `https://yourdomain.com`
2. Login with default credentials:
   - Admin: `admin@example.com` / `password`
   - Employee: `employee@example.com` / `password`
3. Change default passwords immediately

### Security Hardening

```bash
# Configure firewall
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable

# Secure MySQL
sudo mysql_secure_installation

# Disable PHP functions in php.ini
disable_functions = exec,passthru,shell_exec,system,proc_open,popen

# Set secure file permissions
find /var/www/html -type f -exec chmod 644 {} \;
find /var/www/html -type d -exec chmod 755 {} \;
```

## Maintenance

### Update Application

```bash
cd /var/www/html

# Pull latest changes
git pull origin main

# Update Laravel
cd LaravelBackend
composer install --optimize-autoloader --no-dev
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan optimize

# Update Frontend
cd ..
npm install
npm run build

# Restart services
sudo systemctl restart php8.1-fpm
sudo systemctl reload nginx
```

### Database Backup

```bash
# Create backup script
sudo nano /usr/local/bin/backup-timetracking

#!/bin/bash
BACKUP_DIR="/backups/timetracking"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
mysqldump -u time_tracking_user -p'password' time_tracking > \
  $BACKUP_DIR/db_backup_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "db_backup_*.sql" -mtime +7 -delete

# Make executable
sudo chmod +x /usr/local/bin/backup-timetracking

# Add to crontab (daily at 2 AM)
sudo crontab -e
0 2 * * * /usr/local/bin/backup-timetracking
```

### Monitor Logs

```bash
# Laravel logs
tail -f /var/www/html/LaravelBackend/storage/logs/laravel.log

# Nginx logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log

# PHP-FPM logs
tail -f /var/log/php8.1-fpm.log
```

## Troubleshooting

### 500 Internal Server Error

Check permissions:
```bash
sudo chown -R www-data:www-data /var/www/html/LaravelBackend/storage
sudo chmod -R 775 /var/www/html/LaravelBackend/storage
```

Check Laravel logs:
```bash
tail -f /var/www/html/LaravelBackend/storage/logs/laravel.log
```

### Database Connection Failed

Verify credentials in `.env` and test connection:
```bash
php artisan tinker
DB::connection()->getPdo();
```

### CORS Errors

Update `CORS_ALLOWED_ORIGINS` in `.env`:
```env
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

Clear cache:
```bash
php artisan config:clear
php artisan config:cache
```

### Token Authentication Not Working

Ensure `APP_KEY` is set:
```bash
php artisan key:generate
php artisan config:cache
```

### Frontend Not Loading

Check if build files exist:
```bash
ls /var/www/html/dist
```

Rebuild if necessary:
```bash
npm run build
```

## Performance Optimization

### Enable OPcache

Edit `/etc/php/8.1/fpm/php.ini`:

```ini
opcache.enable=1
opcache.memory_consumption=128
opcache.interned_strings_buffer=8
opcache.max_accelerated_files=4000
opcache.revalidate_freq=60
```

### Enable Gzip Compression

Add to Nginx configuration:

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript text/xml;
```

### Configure Laravel Queue Worker

For background jobs:

```bash
# Create supervisor configuration
sudo nano /etc/supervisor/conf.d/laravel-worker.conf

[program:laravel-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/html/LaravelBackend/artisan queue:work --sleep=3 --tries=3
autostart=true
autorestart=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/html/LaravelBackend/storage/logs/worker.log

# Restart supervisor
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start laravel-worker:*
```

## Security Checklist

- [ ] HTTPS enabled with valid SSL certificate
- [ ] `APP_DEBUG=false` in production
- [ ] Strong `APP_KEY` generated
- [ ] Secure database passwords
- [ ] Firewall configured
- [ ] Regular backups scheduled
- [ ] Error logging enabled
- [ ] Rate limiting configured
- [ ] File permissions set correctly
- [ ] Default passwords changed
- [ ] Unnecessary PHP functions disabled
- [ ] MySQL secure installation completed

## Support Resources

- Laravel Documentation: https://laravel.com/docs
- Laravel Sanctum: https://laravel.com/docs/sanctum
- Nginx Documentation: https://nginx.org/en/docs/
- Let's Encrypt: https://letsencrypt.org/
