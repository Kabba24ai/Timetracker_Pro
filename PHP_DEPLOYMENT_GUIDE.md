# PHP API Deployment Guide

This guide will help you deploy the Time Tracking System with PHP/Medoo backend and React frontend.

## Architecture Overview

The system consists of:
- **Frontend**: React + TypeScript (Vite)
- **Backend**: PHP + Medoo Framework
- **Database**: MySQL

## Prerequisites

Before deploying, ensure you have:

1. A server with:
   - PHP 7.4+ with extensions: `mysqli`, `pdo_mysql`, `mbstring`, `json`
   - MySQL 5.7+ or MariaDB 10.3+
   - Apache 2.4+ or Nginx 1.18+
   - Composer (PHP package manager)

2. Domain name (optional, can use IP address)

3. SSL certificate (recommended for production)

## Deployment Steps

### Step 1: Server Setup

#### Ubuntu/Debian

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Apache, PHP, and MySQL
sudo apt install apache2 php php-mysql php-mbstring php-json mysql-server composer -y

# Enable required Apache modules
sudo a2enmod rewrite
sudo systemctl restart apache2
```

#### CentOS/RHEL

```bash
# Install Apache, PHP, and MySQL
sudo yum install httpd php php-mysqlnd php-mbstring php-json mariadb-server composer -y

# Start services
sudo systemctl start httpd
sudo systemctl start mariadb
sudo systemctl enable httpd
sudo systemctl enable mariadb
```

### Step 2: Upload Files

Upload your project to the server:

```bash
# Using SCP
scp -r /path/to/project user@yourserver:/var/www/html/

# Or using Git
ssh user@yourserver
cd /var/www/html
git clone your-repository-url
```

### Step 3: Install PHP Dependencies

```bash
cd /var/www/html/project/MedooApi
composer install --no-dev --optimize-autoloader
```

### Step 4: Configure Environment

```bash
cd /var/www/html/project/MedooApi
cp .env.example .env
nano .env
```

Update with your settings:

```env
DB_HOST=localhost
DB_NAME=time_tracking
DB_USER=time_tracking_user
DB_PASSWORD=your_secure_password
DB_PORT=3306

JWT_SECRET=your-long-random-secret-key-min-32-chars
CORS_ORIGIN=https://yourdomain.com
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

# Import schema
mysql -u time_tracking_user -p time_tracking < /var/www/html/project/database/mysql-schema.sql
```

### Step 6: Configure Web Server

#### Apache Configuration

Create a virtual host:

```bash
sudo nano /etc/apache2/sites-available/timetracking.conf
```

Add:

```apache
<VirtualHost *:80>
    ServerName yourdomain.com
    DocumentRoot /var/www/html/project

    <Directory /var/www/html/project>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    <Directory /var/www/html/project/MedooApi>
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/timetracking_error.log
    CustomLog ${APACHE_LOG_DIR}/timetracking_access.log combined
</VirtualHost>
```

Enable the site:

```bash
sudo a2ensite timetracking.conf
sudo systemctl reload apache2
```

#### Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/timetracking
```

Add:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/html/project/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /MedooApi {
        alias /var/www/html/project/MedooApi;
        index index.php;

        location ~ \.php$ {
            include fastcgi_params;
            fastcgi_pass unix:/var/run/php/php7.4-fpm.sock;
            fastcgi_param SCRIPT_FILENAME $request_filename;
        }

        try_files $uri $uri/ /MedooApi/index.php?$query_string;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/timetracking /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 7: Build Frontend

```bash
cd /var/www/html/project

# Update .env with production API URL
echo "VITE_API_URL=https://yourdomain.com/MedooApi" > .env

# Install dependencies and build
npm install
npm run build
```

### Step 8: Set Permissions

```bash
# Set ownership
sudo chown -R www-data:www-data /var/www/html/project

# Set permissions
sudo find /var/www/html/project -type d -exec chmod 755 {} \;
sudo find /var/www/html/project -type f -exec chmod 644 {} \;

# Make sure MedooApi is executable
sudo chmod -R 755 /var/www/html/project/MedooApi
```

### Step 9: SSL Certificate (Production)

#### Using Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-apache -y  # For Apache
# OR
sudo apt install certbot python3-certbot-nginx -y   # For Nginx

# Get certificate
sudo certbot --apache -d yourdomain.com  # For Apache
# OR
sudo certbot --nginx -d yourdomain.com   # For Nginx
```

### Step 10: Test the Deployment

1. Visit `https://yourdomain.com` (or `http://yourserver-ip`)
2. Try logging in with default credentials:
   - Email: `admin@example.com`
   - Password: `password`

## Maintenance

### Update Application

```bash
cd /var/www/html/project
git pull origin main
cd MedooApi
composer install --no-dev
cd ..
npm install
npm run build
```

### Database Backup

```bash
# Create backup
mysqldump -u time_tracking_user -p time_tracking > backup_$(date +%Y%m%d).sql

# Restore backup
mysql -u time_tracking_user -p time_tracking < backup_20250101.sql
```

### View Logs

```bash
# Apache logs
sudo tail -f /var/log/apache2/timetracking_error.log

# Nginx logs
sudo tail -f /var/log/nginx/error.log

# PHP logs
sudo tail -f /var/log/php7.4-fpm.log
```

## Security Checklist

- [ ] Change default database passwords
- [ ] Generate strong JWT_SECRET
- [ ] Enable HTTPS with SSL certificate
- [ ] Change default employee passwords
- [ ] Configure firewall (allow only 80, 443, 22)
- [ ] Disable PHP error display in production
- [ ] Set up regular database backups
- [ ] Keep PHP and dependencies updated
- [ ] Restrict database user permissions
- [ ] Enable rate limiting for API

## Troubleshooting

### Issue: Cannot connect to database

**Solution**: Check database credentials in `.env` and ensure MySQL is running:
```bash
sudo systemctl status mysql
```

### Issue: 500 Internal Server Error

**Solution**: Check Apache/Nginx error logs:
```bash
sudo tail -f /var/log/apache2/error.log
```

### Issue: CORS errors

**Solution**: Update `CORS_ORIGIN` in MedooApi/.env to match your frontend URL

### Issue: API endpoints return 404

**Solution**:
- Ensure mod_rewrite is enabled (Apache)
- Check .htaccess file exists in MedooApi folder
- Verify web server configuration allows .htaccess overrides

## Support

For issues or questions:
1. Check the logs for error messages
2. Verify all configuration files
3. Ensure all dependencies are installed
4. Test API endpoints with curl
