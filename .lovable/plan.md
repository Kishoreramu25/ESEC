
# Placement Management System - Implementation Plan

## Overview

Building a production-ready, role-based Placement Management & Intelligence System with premium UI/UX, featuring secure authentication, comprehensive CRUD operations, analytics dashboards, and audit logging.

## System Architecture

```text
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|  Landing Page    |---->|  Auth System     |---->|  Role Routing    |
|  (Email/Pass/    |     |  (Supabase Auth) |     |  (RBAC Guards)   |
|   Role Select)   |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
                                                          |
                         +--------------------------------+
                         |              |                 |
                         v              v                 v
              +----------+--+  +--------+----+  +---------+---+
              |             |  |             |  |             |
              |  TPO Admin  |  |  Dept Coord |  | Management  |
              |  Dashboard  |  |  Dashboard  |  | Dashboard   |
              |  (Full CRUD)|  | (Read Only) |  | (Analytics) |
              +-------------+  +-------------+  +-------------+
```

## Database Schema Design

### 1. User Management Tables

**departments**
- id (UUID, PK)
- name (text, unique)
- code (text, unique, e.g., "CSE", "ECE")
- created_at (timestamp)

**user_roles** (Critical for RBAC - separate from profiles)
- id (UUID, PK)
- user_id (UUID, FK to auth.users)
- role (enum: 'placement_officer', 'department_coordinator', 'management')
- unique constraint on (user_id, role)

**profiles**
- id (UUID, PK, FK to auth.users)
- full_name (text)
- email (text)
- department_id (UUID, FK to departments, nullable)
- avatar_url (text, nullable)
- created_at (timestamp)
- updated_at (timestamp)
- last_login (timestamp)

### 2. Placement Data Tables

**companies**
- id (UUID, PK)
- name (text)
- address (text)
- location (text)
- industry_domain (text) - IT, Manufacturing, Finance, etc.
- contact_person (text)
- contact_email (text)
- contact_phone (text)
- alternate_phone (text, nullable)
- created_by (UUID, FK to profiles)
- created_at (timestamp)
- updated_at (timestamp)

**academic_years**
- id (UUID, PK)
- year_label (text, e.g., "2024-2025")
- start_date (date)
- end_date (date)
- is_current (boolean)

**placement_drives**
- id (UUID, PK)
- company_id (UUID, FK to companies)
- academic_year_id (UUID, FK to academic_years)
- drive_type (enum: 'placement', 'internship', 'both')
- role_offered (text)
- visit_date (date)
- visit_time (time)
- visit_mode (enum: 'on_campus', 'off_campus', 'virtual')
- stipend_amount (numeric, nullable)
- ctc_amount (numeric, nullable)
- remarks (text, nullable)
- created_by (UUID, FK to profiles)
- created_at (timestamp)
- updated_at (timestamp)

**drive_eligible_departments** (junction table)
- id (UUID, PK)
- drive_id (UUID, FK to placement_drives)
- department_id (UUID, FK to departments)

**selection_statistics**
- id (UUID, PK)
- drive_id (UUID, FK to placement_drives)
- department_id (UUID, FK to departments)
- students_appeared (integer)
- students_selected (integer)
- ppo_count (integer, default 0)
- created_at (timestamp)
- updated_at (timestamp)

### 3. Audit & Tracking

**audit_logs**
- id (UUID, PK)
- user_id (UUID, FK to profiles)
- action (text) - 'CREATE', 'UPDATE', 'DELETE'
- table_name (text)
- record_id (UUID)
- old_data (JSONB, nullable)
- new_data (JSONB, nullable)
- created_at (timestamp)

### 4. Sample Data from CSV
The uploaded CSV will be imported into the companies table with structure:
- visit_type mapping to drive visit_mode
- company_name, address, location, contact_person, phone, email
- company_type (IT) maps to industry_domain
- salary_package maps to ctc_amount
- remark maps to remarks in placement_drives

## Row-Level Security (RLS) Policies

### Critical Security Functions

```sql
-- Check user role (SECURITY DEFINER to prevent recursion)
CREATE OR REPLACE FUNCTION public.has_role(
  _user_id uuid, 
  _role app_role
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get user's department
CREATE OR REPLACE FUNCTION public.get_user_department(
  _user_id uuid
) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT department_id FROM public.profiles
  WHERE id = _user_id
$$;
```

### Policy Rules by Role

| Table | Placement Officer | Dept Coordinator | Management |
|-------|------------------|------------------|------------|
| companies | Full CRUD | Read only | Read only |
| placement_drives | Full CRUD | Read (own dept) | Read only |
| selection_statistics | Full CRUD | Read (own dept) | Read only |
| profiles | Own profile | Own profile | Own profile |
| audit_logs | Read all | Read own dept | No access |

## Frontend Architecture

### Page Structure

```text
src/
├── pages/
│   ├── Index.tsx (Landing/Marketing)
│   ├── Auth.tsx (Login/Signup with role selection)
│   ├── Dashboard/
│   │   ├── PlacementOfficer/
│   │   │   ├── Overview.tsx
│   │   │   ├── Companies.tsx
│   │   │   ├── Drives.tsx
│   │   │   ├── Statistics.tsx
│   │   │   └── Reports.tsx
│   │   ├── DepartmentCoordinator/
│   │   │   ├── Overview.tsx
│   │   │   └── DepartmentDrives.tsx
│   │   └── Management/
│   │       ├── Overview.tsx
│   │       └── Analytics.tsx
│   └── NotFound.tsx
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── SignupForm.tsx
│   │   └── ProtectedRoute.tsx
│   ├── layout/
│   │   ├── DashboardLayout.tsx
│   │   ├── AppSidebar.tsx
│   │   └── Header.tsx
│   ├── companies/
│   │   ├── CompanyTable.tsx
│   │   ├── CompanyForm.tsx
│   │   └── CompanyCard.tsx
│   ├── drives/
│   │   ├── DriveTable.tsx
│   │   ├── DriveForm.tsx
│   │   └── DriveCalendar.tsx
│   ├── analytics/
│   │   ├── PlacementChart.tsx
│   │   ├── DepartmentStats.tsx
│   │   ├── CompanyReliability.tsx
│   │   └── TrendAnalysis.tsx
│   └── shared/
│       ├── DataTable.tsx
│       ├── FilterBar.tsx
│       ├── StatsCard.tsx
│       └── LoadingState.tsx
├── hooks/
│   ├── useAuth.tsx
│   ├── useRole.tsx
│   ├── useCompanies.tsx
│   ├── useDrives.tsx
│   └── useAnalytics.tsx
└── lib/
    ├── supabase.ts
    ├── rbac.ts
    └── validations.ts
```

### Premium UI Components

1. **Landing Page**
   - Hero section with gradient background
   - Feature cards with icons
   - Testimonials carousel
   - Call-to-action buttons

2. **Auth Page**
   - Split-screen design (form + illustration)
   - Animated role selector cards
   - Form validation with zod
   - Loading states and error handling

3. **Dashboard Layout**
   - Collapsible sidebar with role-based menu items
   - Breadcrumb navigation
   - User profile dropdown
   - Dark/light mode toggle

4. **Data Tables**
   - Sortable columns
   - Advanced filtering
   - Pagination
   - Row actions (edit, delete, view)
   - Export to CSV

5. **Analytics Dashboard**
   - Stat cards with trend indicators
   - Interactive charts (Bar, Pie, Line)
   - Department comparison widgets
   - Date range selectors

## Implementation Steps

### Phase 1: Foundation Setup (Supabase + Auth)
1. Enable Supabase Cloud integration
2. Create database migrations for all tables
3. Set up RLS policies and security functions
4. Create user_roles enum and table
5. Implement profiles table with trigger for new users
6. Set up audit log triggers

### Phase 2: Authentication System
1. Create Auth page with login/signup tabs
2. Implement role selection during signup
3. Build ProtectedRoute component with role checking
4. Create useAuth hook with session management
5. Add email redirect configuration

### Phase 3: Dashboard Framework
1. Build DashboardLayout with sidebar
2. Create role-based routing logic
3. Implement AppSidebar with conditional menu items
4. Add header with user info and logout
5. Create shared UI components (StatsCard, DataTable)

### Phase 4: Placement Officer Module (Full CRUD)
1. Companies Management
   - Company listing with search/filter
   - Add/Edit company modal form
   - Company detail view with history
   - Delete with confirmation

2. Drives Management
   - Drive calendar view
   - Drive table with filters
   - Add/Edit drive form
   - Department eligibility selector
   - Selection statistics entry

3. Reports & Export
   - Generate placement reports
   - Export to CSV functionality

### Phase 5: Department Coordinator Module
1. Department-scoped drive view
2. Department statistics dashboard
3. Student placement tracking view

### Phase 6: Management Module
1. Executive dashboard with KPIs
2. Department comparison charts
3. Year-over-year trend analysis
4. Top companies widget
5. Placement percentage metrics

### Phase 7: Analytics Engine
1. Backend-calculated metrics:
   - Placement percentage per department
   - Internship to PPO conversion rate
   - Company reliability score
   - Department performance index
2. Create analytics edge function for complex calculations

### Phase 8: Data Import & Polish
1. Import CSV data into database
2. Add sample seed data
3. Implement search and filtering
4. Add loading skeletons
5. Error boundary components
6. Final UI polish and responsiveness

## Color Scheme (Premium Design)

```css
/* Primary palette - Professional Blue */
--primary: 222 47% 31%;
--primary-foreground: 210 40% 98%;

/* Accent - Success Green */
--accent: 142 76% 36%;

/* Dashboard-specific */
--chart-1: 221 83% 53%;  /* Blue */
--chart-2: 142 76% 36%;  /* Green */
--chart-3: 38 92% 50%;   /* Amber */
--chart-4: 280 65% 60%;  /* Purple */
--chart-5: 0 84% 60%;    /* Red */
```

## Security Checklist

- Password hashing via Supabase Auth
- JWT token validation on all routes
- RLS policies on every table
- Role validation on every API request
- Input validation with zod schemas
- Audit logging for all data modifications
- No sensitive data in localStorage
- Proper error messages (no data leakage)

## Technical Details

### Technologies Used
- React 18 with TypeScript
- Supabase (Auth, Database, RLS)
- TanStack Query for data fetching
- React Router for navigation
- Recharts for analytics visualization
- Shadcn/UI component library
- Tailwind CSS for styling
- Zod for validation

### Key Patterns
- Custom hooks for data operations
- Context providers for auth state
- Optimistic updates for better UX
- Debounced search inputs
- Infinite scroll for large lists
- Form validation before submission
