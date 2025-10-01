# Time Tracking API - Laravel

Modern RESTful API built with Laravel 10 for the Time Tracking System.

## Features

- Laravel Sanctum authentication with API tokens
- RESTful API design
- Eloquent ORM with relationships
- Database migrations and seeders
- Request validation
- CORS support
- Admin role-based access control

## Requirements

- PHP 8.1 or higher
- MySQL 5.7+ or MariaDB 10.3+
- Composer
- Extensions: OpenSSL, PDO, Mbstring, Tokenizer, XML, Ctype, JSON, BCMath

## Quick Start

### 1. Install Dependencies

```bash
cd LaravelBackend
composer install
```

### 2. Configure Environment

```bash
cp .env.example .env
php artisan key:generate
```

Edit `.env` with your database credentials:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=time_tracking
DB_USERNAME=your_username
DB_PASSWORD=your_password

CORS_ALLOWED_ORIGINS=http://localhost:5173
```

### 3. Run Migrations and Seeders

```bash
php artisan migrate
php artisan db:seed
```

This creates two default users:
- Admin: `admin@example.com` / `password`
- Employee: `employee@example.com` / `password`

### 4. Start Development Server

```bash
php artisan serve
```

API will be available at `http://localhost:8000/api`

## API Endpoints

### Authentication

```
POST   /api/auth/login           - Login with email/password
POST   /api/auth/register        - Register new employee
GET    /api/auth/me              - Get authenticated user info
POST   /api/auth/logout          - Logout (revoke token)
```

### Time Clock (Authenticated)

```
POST   /api/timeclock/clock-in   - Clock in
POST   /api/timeclock/clock-out  - Clock out
GET    /api/timeclock/active     - Get active time entry
GET    /api/timeclock/today      - Get today's entries
GET    /api/timeclock/entries    - Get entries (with date filters)
PUT    /api/timeclock/entries    - Update time entry
```

### Vacation (Authenticated)

```
GET    /api/vacation/balance          - Get vacation balance
GET    /api/vacation/requests         - Get user's requests
POST   /api/vacation/requests         - Create vacation request
PUT    /api/vacation/requests         - Update vacation request
POST   /api/vacation/requests/cancel  - Cancel vacation request
```

### Admin (Admin Role Required)

```
GET    /api/admin/employees                    - Get all employees
GET    /api/admin/employee?id={id}            - Get employee by ID
POST   /api/admin/employees                    - Create employee
PUT    /api/admin/employees                    - Update employee
DELETE /api/admin/employees                    - Delete employee

GET    /api/admin/time-entries                 - Get all time entries
GET    /api/admin/vacation-requests            - Get all vacation requests
POST   /api/admin/vacation-requests/approve    - Approve vacation
POST   /api/admin/vacation-requests/deny       - Deny vacation

GET    /api/admin/work-schedules               - Get work schedules
POST   /api/admin/work-schedules               - Save work schedule
```

## Authentication

This API uses Laravel Sanctum for token-based authentication.

### Login Example

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

Response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "1|abc123...",
    "user": { ... }
  }
}
```

### Using the Token

Include the token in the Authorization header:

```bash
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer 1|abc123..." \
  -H "Accept: application/json"
```

## Development

### Database Schema

The application uses 4 main tables:
- `employees` - User accounts and employee information
- `time_entries` - Clock in/out records
- `vacation_requests` - Vacation/PTO requests
- `work_schedules` - Employee work schedules

### Models

Located in `app/Models/`:
- `Employee` - User/employee model (extends Authenticatable)
- `TimeEntry` - Time clock entries
- `VacationRequest` - Vacation requests
- `WorkSchedule` - Work schedules

### Controllers

Located in `app/Http/Controllers/`:
- `AuthController` - Authentication endpoints
- `TimeClockController` - Time clock management
- `VacationController` - Vacation management
- `AdminController` - Admin operations

### Middleware

- `auth:sanctum` - Require authentication
- `EnsureUserIsAdmin` - Require admin role

## Testing

Run PHPUnit tests:

```bash
php artisan test
```

## Deployment

See [LARAVEL_DEPLOYMENT_GUIDE.md](../LARAVEL_DEPLOYMENT_GUIDE.md) for production deployment instructions.

### Production Checklist

- [ ] Set `APP_ENV=production`
- [ ] Set `APP_DEBUG=false`
- [ ] Generate secure `APP_KEY`
- [ ] Configure proper database credentials
- [ ] Set correct `CORS_ALLOWED_ORIGINS`
- [ ] Enable HTTPS
- [ ] Optimize application: `php artisan optimize`
- [ ] Cache configuration: `php artisan config:cache`
- [ ] Cache routes: `php artisan route:cache`

## Common Commands

```bash
# Clear all caches
php artisan cache:clear
php artisan config:clear
php artisan route:clear

# Optimize for production
php artisan optimize
php artisan config:cache
php artisan route:cache

# Database operations
php artisan migrate:fresh        # Drop all tables and re-run migrations
php artisan migrate:fresh --seed # Include seeders
php artisan db:seed              # Run seeders only

# Create new migration
php artisan make:migration create_table_name

# Create new model with migration
php artisan make:model ModelName -m

# Create new controller
php artisan make:controller ControllerName
```

## Troubleshooting

### CORS Errors

Update `CORS_ALLOWED_ORIGINS` in `.env` to include your frontend URL.

### Database Connection Errors

Verify database credentials and ensure MySQL is running:
```bash
sudo systemctl status mysql
```

### Permission Errors

Set proper permissions:
```bash
chmod -R 775 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
```

### Token Authentication Issues

Clear cache and regenerate application key:
```bash
php artisan config:clear
php artisan key:generate
```

## Support

For issues or questions:
1. Check Laravel documentation: https://laravel.com/docs
2. Review API endpoint responses for error details
3. Check `storage/logs/laravel.log` for errors
