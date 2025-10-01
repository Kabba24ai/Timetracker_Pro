# Time Tracking API - PHP with Medoo

This is the backend API for the Time Tracking System, built with PHP and the Medoo database framework.

## Requirements

- PHP 7.4 or higher
- MySQL 5.7 or higher
- Apache/Nginx web server
- Composer (PHP package manager)
- mod_rewrite enabled (for Apache)

## Installation

### 1. Install Dependencies

Navigate to the MedooApi directory and install PHP dependencies:

```bash
cd MedooApi
composer install
```

### 2. Configure Environment

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```
DB_HOST=localhost
DB_NAME=time_tracking
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_PORT=3306

JWT_SECRET=change-this-to-a-random-secret-key
CORS_ORIGIN=http://localhost:5173
```

### 3. Create Database

Create a MySQL database and import the schema:

```bash
mysql -u root -p
CREATE DATABASE time_tracking;
USE time_tracking;
SOURCE ../database/mysql-schema.sql;
EXIT;
```

### 4. Web Server Configuration

#### Apache

Ensure `.htaccess` is in place and mod_rewrite is enabled:

```bash
sudo a2enmod rewrite
sudo systemctl restart apache2
```

Your Apache virtual host should have `AllowOverride All`:

```apache
<VirtualHost *:80>
    ServerName localhost
    DocumentRoot /var/www/html

    <Directory /var/www/html/MedooApi>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

#### Nginx

Add this location block to your Nginx configuration:

```nginx
location /MedooApi {
    try_files $uri $uri/ /MedooApi/index.php?$query_string;

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php7.4-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login with email and password
- `POST /api/auth/register` - Register new employee
- `GET /api/auth/me` - Get current user info

### Time Clock

- `POST /api/timeclock/clock-in` - Clock in
- `POST /api/timeclock/clock-out` - Clock out
- `GET /api/timeclock/active` - Get active time entry
- `GET /api/timeclock/today` - Get today's entries
- `GET /api/timeclock/entries` - Get entries (with date range)
- `PUT /api/timeclock/entries` - Update time entry

### Vacation

- `GET /api/vacation/balance` - Get vacation balance
- `GET /api/vacation/requests` - Get vacation requests
- `POST /api/vacation/requests` - Create vacation request
- `PUT /api/vacation/requests` - Update vacation request
- `POST /api/vacation/requests/cancel` - Cancel vacation request

### Admin (requires admin role)

- `GET /api/admin/employees` - Get all employees
- `GET /api/admin/employee?id={id}` - Get employee by ID
- `POST /api/admin/employees` - Create employee
- `PUT /api/admin/employees` - Update employee
- `DELETE /api/admin/employees` - Delete employee
- `GET /api/admin/time-entries` - Get all time entries
- `GET /api/admin/vacation-requests` - Get all vacation requests
- `POST /api/admin/vacation-requests/approve` - Approve vacation
- `POST /api/admin/vacation-requests/deny` - Deny vacation
- `GET /api/admin/work-schedules` - Get work schedules
- `POST /api/admin/work-schedules` - Save work schedule

## Testing the API

You can test the API using curl:

```bash
# Login
curl -X POST http://localhost/MedooApi/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

# Get current user (replace TOKEN with the token from login)
curl http://localhost/MedooApi/api/auth/me \
  -H "Authorization: Bearer TOKEN"

# Clock in
curl -X POST http://localhost/MedooApi/api/timeclock/clock-in \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes":"Starting work"}'
```

## Default Users

The schema includes two default users (password: `password`):

1. Admin User:
   - Email: `admin@example.com`
   - Role: admin

2. Employee User:
   - Email: `employee@example.com`
   - Role: employee

## Security Notes

- Change the `JWT_SECRET` in your `.env` file to a strong random string
- Use HTTPS in production
- Ensure your database user has only necessary permissions
- Keep PHP and dependencies updated
- Enable error logging but disable display_errors in production

## Troubleshooting

### CORS Errors

If you're getting CORS errors, ensure:
1. `CORS_ORIGIN` in `.env` matches your frontend URL
2. The CORS middleware is being executed first
3. Your web server isn't blocking OPTIONS requests

### Database Connection Errors

Check:
1. Database credentials in `.env`
2. MySQL is running: `sudo systemctl status mysql`
3. Database exists: `mysql -u root -p -e "SHOW DATABASES;"`
4. User has permissions: `GRANT ALL ON time_tracking.* TO 'user'@'localhost';`

### 404 Errors

Ensure:
1. `.htaccess` file exists and is readable
2. mod_rewrite is enabled (Apache)
3. Web server configuration allows .htaccess overrides
