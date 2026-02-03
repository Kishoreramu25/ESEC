import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/shared/LoadingState";
import { CSVUpload } from "@/components/shared/CSVUpload";
import { toast } from "sonner";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  CalendarDays,
  Building2,
  MapPin,
  Briefcase,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { driveSchema, DriveFormData } from "@/lib/validations";

interface PlacementDrive {
  id: string;
  company_id: string;
  academic_year_id: string;
  drive_type: "placement" | "internship" | "both";
  role_offered: string | null;
  visit_date: string;
  visit_time: string | null;
  visit_mode: "on_campus" | "off_campus" | "virtual";
  stipend_amount: number | null;
  ctc_amount: number | null;
  remarks: string | null;
  created_at: string;
  companies: { name: string } | null;
  academic_years: { year_label: string } | null;
}

interface Company {
  id: string;
  name: string;
}

interface AcademicYear {
  id: string;
  year_label: string;
  is_current: boolean;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

export default function Drives() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDrive, setEditingDrive] = useState<PlacementDrive | null>(null);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);

  const form = useForm<DriveFormData>({
    resolver: zodResolver(driveSchema),
    defaultValues: {
      company_id: "",
      academic_year_id: "",
      drive_type: "placement",
      role_offered: "",
      visit_date: "",
      visit_time: "",
      visit_mode: "on_campus",
      stipend_amount: null,
      ctc_amount: null,
      remarks: "",
      eligible_departments: [],
    },
  });

  // Fetch drives from placement_records (group by Company + Date basically)
  const { data: drives, isLoading } = useQuery({
    queryKey: ["drives", searchQuery],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("placement_records" as any) as any)
        .select("*")
        .order("date_of_visit", { ascending: false });

      if (error) throw error;

      // Group by Company to show unique drives
      const uniqueDrivesMap = new Map();

      (data || []).forEach((record: any) => {
        const companyName = record.v_company_name;
        if (!companyName) return;

        const key = companyName.toLowerCase();

        if (!uniqueDrivesMap.has(key)) {
          const ctcLpa = record.salary_package ? parseFloat(record.salary_package.replace(/[^0-9.]/g, '')) : null;

          uniqueDrivesMap.set(key, {
            id: record.id,
            visit_date: record.date_of_visit || record.created_at,
            drive_type: record.v_visit_type?.toLowerCase() || 'placement',
            visit_mode: 'on_campus',
            role_offered: null,
            ctc_amount: ctcLpa ? ctcLpa * 100000 : null,
            stipend_amount: null,
            companies: { name: companyName },
            academic_years: { year_label: new Date(record.date_of_visit || record.created_at).getFullYear().toString() }
          });
        }
      });

      let driveList = Array.from(uniqueDrivesMap.values());

      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        driveList = driveList.filter((d: any) =>
          d.companies.name.toLowerCase().includes(lowerQuery)
        );
      }

      return driveList as PlacementDrive[];
    },
  });

  // Fetch companies for dropdown
  const { data: companies } = useQuery({
    queryKey: ["companies-list"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").order("name");
      return data as Company[];
    },
  });

  // Fetch academic years
  const { data: academicYears } = useQuery({
    queryKey: ["academic-years"],
    queryFn: async () => {
      const { data } = await supabase.from("academic_years").select("*").order("year_label", { ascending: false });
      return data as AcademicYear[];
    },
  });

  // Fetch departments
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id, name, code").order("name");
      return data as Department[];
    },
  });

  // Fetch eligible departments for a drive
  const fetchEligibleDepts = async (driveId: string) => {
    const { data } = await supabase
      .from("drive_eligible_departments")
      .select("department_id")
      .eq("drive_id", driveId);
    return data?.map((d) => d.department_id) || [];
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: DriveFormData) => {
      // Get company name from ID
      const companyName = companies?.find(c => c.id === data.company_id)?.name || "Unknown Company";

      const recordData = {
        v_company_name: companyName,
        date_of_visit: data.visit_date,
        v_visit_type: data.drive_type,
        salary_package: data.ctc_amount ? `${(data.ctc_amount / 100000).toFixed(1)} LPA` : null,
        remark: data.remarks || null,
      };

      if (editingDrive) {
        const { error } = await (supabase
          .from("placement_records" as any) as any)
          .update(recordData)
          .eq("id", editingDrive.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase
          .from("placement_records" as any) as any)
          .insert([recordData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drives"] });
      setIsDialogOpen(false);
      setEditingDrive(null);
      setSelectedDepts([]);
      form.reset();
      toast.success(editingDrive ? "Drive updated successfully" : "Drive added successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "An error occurred");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("placement_records" as any) as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drives"] });
      toast.success("Drive deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete drive");
    },
  });

  const handleEdit = async (drive: PlacementDrive) => {
    setEditingDrive(drive);
    const eligibleDepts = await fetchEligibleDepts(drive.id);
    setSelectedDepts(eligibleDepts);
    form.reset({
      company_id: drive.company_id,
      academic_year_id: drive.academic_year_id,
      drive_type: drive.drive_type,
      role_offered: drive.role_offered || "",
      visit_date: drive.visit_date,
      visit_time: drive.visit_time || "",
      visit_mode: drive.visit_mode,
      stipend_amount: drive.stipend_amount,
      ctc_amount: drive.ctc_amount,
      remarks: drive.remarks || "",
      eligible_departments: eligibleDepts,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this drive? This action cannot be undone.")) {
      deleteMutation.mutate(id);
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingDrive(null);
    setSelectedDepts([]);
    form.reset();
  };

  const handleDeptToggle = (deptId: string) => {
    const newDepts = selectedDepts.includes(deptId)
      ? selectedDepts.filter((d) => d !== deptId)
      : [...selectedDepts, deptId];
    setSelectedDepts(newDepts);
    form.setValue("eligible_departments", newDepts);
  };

  const getDriveTypeBadge = (type: string) => {
    switch (type) {
      case "placement":
        return <Badge className="bg-success/20 text-success border-0">Placement</Badge>;
      case "internship":
        return <Badge className="bg-primary/20 text-primary border-0">Internship</Badge>;
      case "both":
        return <Badge className="bg-warning/20 text-warning border-0">Both</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const getVisitModeBadge = (mode: string) => {
    switch (mode) {
      case "on_campus":
        return <Badge variant="outline">On Campus</Badge>;
      case "off_campus":
        return <Badge variant="outline">Off Campus</Badge>;
      case "virtual":
        return <Badge variant="outline">Virtual</Badge>;
      default:
        return <Badge variant="outline">{mode}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Placement Drives</h1>
            <p className="text-muted-foreground">Manage placement and internship drives</p>
          </div>
          <div className="flex gap-3">
            <CSVUpload
              title="Upload Drives"
              description="Upload a CSV file to add multiple placement drives at once"
              templateHeaders={["Company Name", "Visit Date", "Drive Type", "Visit Mode", "Role Offered", "CTC", "Stipend", "Remarks"]}
              templateFileName="placement_drives"
              exampleData={[
                { company_name: "Tech Corp", visit_date: "2025-02-15", drive_type: "placement", visit_mode: "on_campus", role_offered: "Software Engineer", ctc: "800000", stipend: "", remarks: "Full stack role" },
                { company_name: "Data Systems", visit_date: "2025-02-20", drive_type: "internship", visit_mode: "virtual", role_offered: "Data Analyst Intern", ctc: "", stipend: "25000", remarks: "6 month internship" },
              ]}
              onUpload={async (data) => {
                // Get current academic year
                const { data: currentYear } = await supabase
                  .from("academic_years")
                  .select("id")
                  .eq("is_current", true)
                  .single();

                if (!currentYear) throw new Error("No current academic year found");

                // Get all companies to match by name
                const { data: allCompanies } = await supabase.from("companies").select("id, name");
                const companyMap = new Map((allCompanies || []).map((c) => [c.name.toLowerCase(), c.id]));

                const records = [];
                for (const row of data) {
                  const companyName = row.company_name || row.company || "";
                  const companyId = companyMap.get(companyName.toLowerCase());

                  if (!companyId || !row.visit_date) continue;

                  records.push({
                    company_id: companyId,
                    academic_year_id: currentYear.id,
                    visit_date: row.visit_date,
                    drive_type: (row.drive_type || "placement") as "placement" | "internship" | "both",
                    visit_mode: (row.visit_mode || "on_campus") as "on_campus" | "off_campus" | "virtual",
                    role_offered: row.role_offered || null,
                    ctc_amount: row.ctc ? parseFloat(row.ctc) : null,
                    stipend_amount: row.stipend ? parseFloat(row.stipend) : null,
                    remarks: row.remarks || null,
                    created_by: user?.id || null,
                  });
                }

                if (records.length === 0) throw new Error("No valid records found. Make sure company names match existing companies.");

                const { error } = await supabase.from("placement_drives").insert(records);
                if (error) throw error;

                queryClient.invalidateQueries({ queryKey: ["drives"] });
                toast.success(`${records.length} drives added successfully`);
              }}
            />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingDrive(null); setSelectedDepts([]); form.reset(); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Schedule Drive
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingDrive ? "Edit Drive" : "Schedule New Drive"}</DialogTitle>
                  <DialogDescription>
                    {editingDrive
                      ? "Update the drive details below"
                      : "Fill in the details to schedule a new placement drive"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))} className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Company Selection */}
                    <div className="space-y-2">
                      <Label>Company *</Label>
                      <Controller
                        name="company_id"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select company" />
                            </SelectTrigger>
                            <SelectContent>
                              {companies?.map((company) => (
                                <SelectItem key={company.id} value={company.id}>
                                  {company.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {form.formState.errors.company_id && (
                        <p className="text-sm text-destructive">{form.formState.errors.company_id.message}</p>
                      )}
                    </div>

                    {/* Academic Year */}
                    <div className="space-y-2">
                      <Label>Academic Year *</Label>
                      <Controller
                        name="academic_year_id"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select year" />
                            </SelectTrigger>
                            <SelectContent>
                              {academicYears?.map((year) => (
                                <SelectItem key={year.id} value={year.id}>
                                  {year.year_label} {year.is_current && "(Current)"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {form.formState.errors.academic_year_id && (
                        <p className="text-sm text-destructive">{form.formState.errors.academic_year_id.message}</p>
                      )}
                    </div>

                    {/* Drive Type */}
                    <div className="space-y-2">
                      <Label>Drive Type *</Label>
                      <Controller
                        name="drive_type"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="placement">Placement</SelectItem>
                              <SelectItem value="internship">Internship</SelectItem>
                              <SelectItem value="both">Both</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    {/* Visit Mode */}
                    <div className="space-y-2">
                      <Label>Visit Mode *</Label>
                      <Controller
                        name="visit_mode"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="on_campus">On Campus</SelectItem>
                              <SelectItem value="off_campus">Off Campus</SelectItem>
                              <SelectItem value="virtual">Virtual</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    {/* Role Offered */}
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Role Offered</Label>
                      <Input {...form.register("role_offered")} placeholder="e.g., Software Engineer, Data Analyst" />
                    </div>

                    {/* Visit Date & Time */}
                    <div className="space-y-2">
                      <Label>Visit Date *</Label>
                      <Input type="date" {...form.register("visit_date")} />
                      {form.formState.errors.visit_date && (
                        <p className="text-sm text-destructive">{form.formState.errors.visit_date.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Visit Time</Label>
                      <Input type="time" {...form.register("visit_time")} />
                    </div>

                    {/* Package Details */}
                    <div className="space-y-2">
                      <Label>Stipend (₹/month)</Label>
                      <Input
                        type="number"
                        {...form.register("stipend_amount", { valueAsNumber: true })}
                        placeholder="15000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CTC (₹ LPA)</Label>
                      <Input
                        type="number"
                        {...form.register("ctc_amount", { valueAsNumber: true })}
                        placeholder="600000"
                      />
                    </div>

                    {/* Remarks */}
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Remarks</Label>
                      <Textarea {...form.register("remarks")} placeholder="Additional notes about this drive" />
                    </div>

                    {/* Eligible Departments */}
                    <div className="space-y-3 sm:col-span-2">
                      <Label>Eligible Departments *</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {departments?.map((dept) => (
                          <label
                            key={dept.id}
                            className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                          >
                            <Checkbox
                              checked={selectedDepts.includes(dept.id)}
                              onCheckedChange={() => handleDeptToggle(dept.id)}
                            />
                            <span className="text-sm">{dept.code}</span>
                          </label>
                        ))}
                      </div>
                      {form.formState.errors.eligible_departments && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.eligible_departments.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={handleDialogClose}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saveMutation.isPending}>
                      {saveMutation.isPending ? "Saving..." : editingDrive ? "Update" : "Schedule Drive"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search drives..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Drives Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Placement Drives</CardTitle>
            <CardDescription>{drives?.length || 0} drives scheduled</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton rows={5} columns={6} />
            ) : drives && drives.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Visit</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drives.map((drive) => (
                      <TableRow key={drive.id} className="table-row-hover">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{drive.companies?.name || "Unknown"}</p>
                              <p className="text-sm text-muted-foreground">
                                {drive.academic_years?.year_label}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {getDriveTypeBadge(drive.drive_type)}
                            {getVisitModeBadge(drive.visit_mode)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{drive.role_offered || "Multiple Roles"}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            <span>
                              {new Date(drive.visit_date).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                          {drive.visit_time && (
                            <p className="text-sm text-muted-foreground mt-1">{drive.visit_time}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {drive.ctc_amount && (
                            <p className="font-medium">₹{(drive.ctc_amount / 100000).toFixed(1)} LPA</p>
                          )}
                          {drive.stipend_amount && (
                            <p className="text-sm text-muted-foreground">
                              ₹{drive.stipend_amount.toLocaleString()}/mo
                            </p>
                          )}
                          {!drive.ctc_amount && !drive.stipend_amount && <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(drive)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDelete(drive.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No drives scheduled</p>
                <p className="text-sm text-muted-foreground">
                  Schedule your first placement drive to get started
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}