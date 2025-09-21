# Deployment Guide - Time Clock System

## 🚀 Production Deployment Checklist

### **Pre-Deployment Requirements**
- [ ] Node.js 18+ installed
- [ ] Supabase account created
- [ ] Hosting platform selected (Netlify, Vercel, AWS, etc.)
- [ ] Domain name configured (optional)
- [ ] SSL certificate ready

### **Database Setup (Supabase)**

#### **1. Create Supabase Project**
```bash
# Visit https://supabase.com/dashboard
# Create new project
# Note your project URL and anon key
```

#### **2. Environment Variables**
Create `.env.production` file:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

#### **3. Database Schema**
Run these SQL commands in Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (handled by Supabase Auth)
-- Employees table
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('employee', 'admin')) DEFAULT 'employee',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Time entries table
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  entry_type TEXT CHECK (entry_type IN ('clock_in', 'clock_out', 'lunch_out', 'lunch_in', 'unpaid_out', 'unpaid_in')) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vacation records table
CREATE TABLE vacation_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  allotted_hours DECIMAL(5,2) DEFAULT 0,
  accrued_hours DECIMAL(5,2) DEFAULT 0,
  used_hours DECIMAL(5,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vacation requests table
CREATE TABLE vacation_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  hours DECIMAL(5,2) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'approved', 'denied')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Work schedule table
CREATE TABLE work_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  store_location TEXT,
  is_scheduled BOOLEAN DEFAULT false,
  hours DECIMAL(4,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

-- System settings table
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **4. Row Level Security (RLS)**
```sql
-- Enable RLS on all tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Employees policies
CREATE POLICY "Users can read own employee data" ON employees
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all employee data" ON employees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Time entries policies
CREATE POLICY "Users can manage own time entries" ON time_entries
  FOR ALL USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all time entries" ON time_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Similar policies for other tables...
```

### **Build & Deploy**

#### **1. Build Production Bundle**
```bash
# Install dependencies
npm install

# Run type checking
npm run type-check

# Build for production
npm run build

# Test production build locally
npm run preview
```

#### **2. Deploy to Netlify**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod --dir=dist
```

#### **3. Deploy to Vercel**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

#### **4. Deploy to AWS S3 + CloudFront**
```bash
# Build
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

### **Post-Deployment Configuration**

#### **1. Create Admin User**
```sql
-- In Supabase SQL Editor
INSERT INTO employees (user_id, first_name, last_name, email, role)
VALUES (
  'user-uuid-from-auth-users-table',
  'Admin',
  'User',
  'admin@yourcompany.com',
  'admin'
);
```

#### **2. Configure System Settings**
```sql
-- Default system settings
INSERT INTO system_settings (setting_key, setting_value) VALUES
('pay_increments', '15'),
('pay_period_type', '"biweekly"'),
('pay_period_start_date', '"2025-01-05"'),
('default_lunch_duration_minutes', '60'),
('holidays', '{
  "2025": {
    "new_years_day": true,
    "memorial_day": true,
    "independence_day": true,
    "labor_day": true,
    "thanksgiving_day": true,
    "christmas_day": true
  }
}');
```

#### **3. Test Core Functionality**
- [ ] User registration and login
- [ ] Employee time clock in/out
- [ ] Admin dashboard access
- [ ] Time reports generation
- [ ] Vacation request workflow
- [ ] Work schedule management

### **Monitoring & Maintenance**

#### **1. Set Up Monitoring**
- **Supabase Dashboard**: Monitor database performance
- **Hosting Platform**: Monitor uptime and performance
- **Error Tracking**: Consider Sentry or similar service

#### **2. Backup Strategy**
```bash
# Automated daily backups (Supabase handles this)
# Additional backup to external storage if needed
```

#### **3. Update Procedures**
```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Run tests
npm run type-check

# Build and deploy
npm run build
# Deploy using your chosen method
```

### **Security Checklist**
- [ ] HTTPS enabled
- [ ] Environment variables secured
- [ ] RLS policies tested
- [ ] Admin access restricted
- [ ] Regular security updates scheduled
- [ ] Backup procedures tested

### **Performance Optimization**
- [ ] CDN configured for static assets
- [ ] Gzip compression enabled
- [ ] Database indexes optimized
- [ ] Image optimization implemented
- [ ] Caching headers configured

### **Support & Maintenance**
- [ ] Documentation updated
- [ ] Team training completed
- [ ] Support procedures established
- [ ] Update schedule defined
- [ ] Monitoring alerts configured

---

## 🆘 Troubleshooting

### **Common Issues**

#### **Build Errors**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### **Database Connection Issues**
- Verify Supabase URL and keys
- Check RLS policies
- Confirm user authentication

#### **Deployment Failures**
- Check build logs
- Verify environment variables
- Test locally first

### **Getting Help**
- Check GitHub Issues
- Review Supabase documentation
- Contact development team

---

**🎉 Your Time Clock System is now ready for production use!**