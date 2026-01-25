import { z } from "zod";

// Auth validations
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .max(255, "Email must be less than 255 characters"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters")
    .max(72, "Password must be less than 72 characters"),
});

export const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(100, "Name must be less than 100 characters"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .max(255, "Email must be less than 255 characters"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters")
    .max(72, "Password must be less than 72 characters"),
  role: z.enum(["placement_officer", "department_coordinator", "management"], {
    required_error: "Please select a role",
  }),
  departmentId: z.string().uuid().optional().nullable(),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;

// Company validations
export const companySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(200, "Company name must be less than 200 characters"),
  address: z.string().trim().max(500, "Address must be less than 500 characters").optional(),
  location: z.string().trim().max(100, "Location must be less than 100 characters").optional(),
  industry_domain: z.string().trim().max(100, "Industry must be less than 100 characters").optional(),
  contact_person: z.string().trim().max(100, "Contact person must be less than 100 characters").optional(),
  contact_email: z.string().trim().email("Please enter a valid email").max(255).optional().or(z.literal("")),
  contact_phone: z.string().trim().max(20, "Phone must be less than 20 characters").optional(),
  alternate_phone: z.string().trim().max(20, "Phone must be less than 20 characters").optional(),
});

export type CompanyFormData = z.infer<typeof companySchema>;

// Drive validations
export const driveSchema = z.object({
  company_id: z.string().uuid("Please select a company"),
  academic_year_id: z.string().uuid("Please select an academic year"),
  drive_type: z.enum(["placement", "internship", "both"]),
  role_offered: z.string().trim().max(200, "Role must be less than 200 characters").optional(),
  visit_date: z.string().min(1, "Visit date is required"),
  visit_time: z.string().optional(),
  visit_mode: z.enum(["on_campus", "off_campus", "virtual"]),
  stipend_amount: z.number().min(0).optional().nullable(),
  ctc_amount: z.number().min(0).optional().nullable(),
  remarks: z.string().trim().max(1000, "Remarks must be less than 1000 characters").optional(),
  eligible_departments: z.array(z.string().uuid()).min(1, "Select at least one department"),
});

export type DriveFormData = z.infer<typeof driveSchema>;

// Statistics validations
export const statisticsSchema = z.object({
  drive_id: z.string().uuid(),
  department_id: z.string().uuid(),
  students_appeared: z.number().int().min(0, "Cannot be negative"),
  students_selected: z.number().int().min(0, "Cannot be negative"),
  ppo_count: z.number().int().min(0, "Cannot be negative"),
});

export type StatisticsFormData = z.infer<typeof statisticsSchema>;