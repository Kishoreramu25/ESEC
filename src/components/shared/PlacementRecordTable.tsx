import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Save, Trash2, Upload, Loader2, RefreshCw, Download } from "lucide-react";

// ... inside the component ...

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

// Start with snake_case definition to match DB
interface PlacementRecord {
    id?: number; // Optional for new records
    company_name: string;
    company_mail: string;
    company_address: string;
    hr_name: string;
    hr_mail: string;
    placed_student_name: string;
    department: string;
    internship_or_placed: string;
    stipend_salary: string;
    package_lpa: string;
    student_id: string;
    student_mail_id: string;
    student_address: string;
    placed_year: string;
    placed_sem: string;
    date_of_join: string;
    reference: string;
}

export function PlacementRecordTable() {
    const [records, setRecords] = useState<PlacementRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Search and Filter State
    const [searchTerm, setSearchTerm] = useState("");

    // Dynamic Filters
    interface FilterCriterion {
        id: string;
        field: keyof PlacementRecord;
        label: string;
        value: string;
    }

    const [activeFilters, setActiveFilters] = useState<FilterCriterion[]>([]);
    const [isAddingFilter, setIsAddingFilter] = useState(false);
    const [newFilterField, setNewFilterField] = useState<string>("");
    const [newFilterValue, setNewFilterValue] = useState<string>("");

    // Filter Fields Configuration
    const FILTER_FIELDS: { label: string; key: keyof PlacementRecord }[] = [
        { label: "Department", key: "department" },
        { label: "Company", key: "company_name" },
        { label: "Year", key: "placed_year" },
        { label: "Status", key: "internship_or_placed" },
        { label: "Semester", key: "placed_sem" },
        { label: "Package (LPA)", key: "package_lpa" },
        { label: "HR Name", key: "hr_name" },
        { label: "Student Name", key: "placed_student_name" },
        { label: "Join Date", key: "date_of_join" } // Exact date match
    ];

    // Fetch records on mount
    useEffect(() => {
        fetchRecords();
    }, []);

    const fetchRecords = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from("placement_records" as any)
                .select("*")
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching records:", error);
            } else {
                setRecords((data as any) || []);
            }
        } catch (err) {
            console.error("Exception fetching records:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const addRow = () => {
        const newRecord: PlacementRecord = {
            // id is undefined for new rows
            company_name: "",
            company_mail: "",
            company_address: "",
            hr_name: "",
            hr_mail: "",
            placed_student_name: "",
            department: "",
            internship_or_placed: "Placed",
            stipend_salary: "",
            package_lpa: "",
            student_id: "",
            student_mail_id: "",
            student_address: "",
            placed_year: new Date().getFullYear().toString(),
            placed_sem: "",
            date_of_join: "",
            reference: "",
        };
        // Add to the beginning of the list for better visibility
        setRecords([newRecord, ...records]);
    };

    const removeRow = async (index: number, id?: number) => {
        if (id) {
            // Delete from DB
            const { error } = await supabase
                .from("placement_records" as any)
                .delete()
                .eq("id", id);

            if (error) {
                toast.error("Failed to delete record");
                return;
            }
            toast.success("Record deleted");
        }

        // Remove from local state
        const newRecords = [...records];
        newRecords.splice(index, 1);
        setRecords(newRecords);
    };

    const updateRecord = (index: number, field: keyof PlacementRecord, value: string) => {
        const newRecords = [...records];
        newRecords[index] = { ...newRecords[index], [field]: value };
        setRecords(newRecords);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = records.map(r => {
                const { id, ...rest } = r;
                return id ? r : rest; // remove id if it's undefined (though usually it's fine)
            });

            const { data, error } = await supabase
                .from("placement_records" as any)
                .upsert(payload)
                .select();

            if (error) throw error;

            toast.success("All records saved successfully!");
            // Update local state with the returned data (which includes new IDs)
            if (data) {
                setRecords(data as any);
            }
        } catch (error: any) {
            console.error("Save error:", error);
            toast.error("Failed to save records: " + (error.message || "Unknown error"));
        } finally {
            setIsSaving(false);
        }
    };

    // Helper to map excel keys to snake_case
    const mapExcelRowToRecord = (row: any): PlacementRecord => {
        const getVal = (keys: string[]) => {
            for (const key of keys) {
                if (row[key] !== undefined) return String(row[key]);
                const rowKey = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
                if (rowKey) return String(row[rowKey]);
            }
            return "";
        };

        return {
            company_name: getVal(["Company Name", "Name of Company", "Company"]),
            company_mail: getVal(["Company Mail", "Company Email", "Email ID (Company)"]),
            company_address: getVal(["Company Address", "Address"]),
            hr_name: getVal(["HR Name", "HR"]),
            hr_mail: getVal(["HR Mail", "HR Email"]),
            placed_student_name: getVal(["Placed Student Name", "Student Name", "Name"]),
            department: getVal(["Department", "Dept"]),
            internship_or_placed: getVal(["Internship / Placed", "Type", "Selection Type"]) || "Placed",
            stipend_salary: getVal(["Stipend / Salary", "Salary", "Stipend"]),
            package_lpa: getVal(["Package [LPA]", "Package", "CTC"]),
            student_id: getVal(["Student ID", "Register No", "Reg No"]),
            student_mail_id: getVal(["Student Mail ID", "Student Email", "Email ID"]),
            student_address: getVal(["Student Address"]),
            placed_year: getVal(["Placed Year", "Year"]) || new Date().getFullYear().toString(),
            placed_sem: getVal(["Placed Sem", "Semester"]),
            date_of_join: getVal(["Date of Join", "Joining Date"]),
            reference: getVal(["Reference", "Ref"]),
        };
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const workbook = XLSX.read(bstr, { type: "binary" });
                const wsname = workbook.SheetNames[0];
                const ws = workbook.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data && data.length > 0) {
                    const newRecords = data.map((row: any) => mapExcelRowToRecord(row));
                    // Append new records to the top
                    setRecords((prev) => [...newRecords, ...prev]);
                    toast.success(`Imported ${newRecords.length} records. Click "Save Changes" to persist them.`);
                } else {
                    toast.error("No data found in file.");
                }
            } catch (error) {
                console.error("Error parsing file:", error);
                toast.error("Failed to parse file.");
            }
            if (fileInputRef.current) fileInputRef.current.value = "";
        };
        reader.readAsBinaryString(file);
    };

    const handleDownload = () => {
        if (filteredRecords.length === 0) {
            toast.error("No records to download based on current filters.");
            return;
        }

        const wb = XLSX.utils.book_new();
        // Format data for export - nice headers
        const exportData = filteredRecords.map((r, i) => ({
            "S.No": i + 1,
            "Company Name": r.company_name,
            "Company Mail": r.company_mail,
            "Company Address": r.company_address,
            "HR Name": r.hr_name,
            "HR Mail": r.hr_mail,
            "Student Name": r.placed_student_name,
            "Department": r.department,
            "Type": r.internship_or_placed,
            "Salary": r.stipend_salary,
            "Package (LPA)": r.package_lpa,
            "Student ID": r.student_id,
            "Student Mail": r.student_mail_id,
            "Student Address": r.student_address,
            "Year": r.placed_year,
            "Semester": r.placed_sem,
            "Join Date": r.date_of_join,
            "Reference": r.reference
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, "Placement Records");
        XLSX.writeFile(wb, `Placement_Records_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success(`Downloaded ${filteredRecords.length} records.`);
    };

    // Get unique available values for a selected field
    const getAvailableValues = (fieldKey: string) => {
        if (!fieldKey) return [];
        const unique = new Set(records.map((r: any) => r[fieldKey]).filter((v: any) => v !== undefined && v !== null && v !== ""));
        return Array.from(unique).sort();
    };

    const handleAddFilter = () => {
        if (!newFilterField || !newFilterValue) return;

        const fieldConfig = FILTER_FIELDS.find(f => f.key === newFilterField);
        if (!fieldConfig) return;

        const newFilter: FilterCriterion = {
            id: Math.random().toString(36).substr(2, 9),
            field: fieldConfig.key,
            label: fieldConfig.label,
            value: newFilterValue
        };

        setActiveFilters([...activeFilters, newFilter]);
        setIsAddingFilter(false);
        setNewFilterField("");
        setNewFilterValue("");
    };

    const removeFilter = (id: string) => {
        setActiveFilters(activeFilters.filter(f => f.id !== id));
    };

    // Derived filtered records
    const filteredRecords = records.filter((record) => {
        // 1. Universal Search
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            const matchesSearch = (
                (record.company_name?.toLowerCase() || "").includes(lowerSearch) ||
                (record.placed_student_name?.toLowerCase() || "").includes(lowerSearch) ||
                (record.student_id?.toLowerCase() || "").includes(lowerSearch) ||
                (record.hr_name?.toLowerCase() || "").includes(lowerSearch) ||
                (record.reference?.toLowerCase() || "").includes(lowerSearch)
            );
            if (!matchesSearch) return false;
        }

        // 2. Dynamic Filters (AND Logic)
        for (const filter of activeFilters) {
            const recordVal = String(record[filter.field] || "").toLowerCase();
            const filterVal = filter.value.toLowerCase();
            if (recordVal !== filterVal) {
                return false;
            }
        }

        return true;
    });

    return (
        <Card className="w-full border-t-4 border-t-primary shadow-lg">
            <CardHeader className="space-y-4 pb-6 bg-muted/10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-2xl font-bold flex items-center gap-2">
                            Placement Records
                            {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                        </CardTitle>
                        <CardDescription className="text-base mt-1">
                            Centralized placement data history and management
                        </CardDescription>
                    </div>
                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            className="hidden"
                            accept=".xlsx, .xls, .csv"
                        />
                        <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="shadow-sm">
                            <Upload className="mr-2 h-4 w-4" /> Import Excel
                        </Button>
                        <Button onClick={handleDownload} variant="secondary" className="shadow-sm">
                            <Download className="mr-2 h-4 w-4" /> Download Filtered
                        </Button>
                        <Button onClick={handleDownload} variant="secondary" className="shadow-sm">
                            <Download className="mr-2 h-4 w-4" /> Download Filtered
                        </Button>
                        <Button onClick={addRow} variant="outline" className="shadow-sm">
                            <Plus className="mr-2 h-4 w-4" /> Add Row
                        </Button>
                        <Button onClick={fetchRecords} variant="ghost" size="icon" title="Refresh">
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving} className="shadow-sm">
                            {isSaving ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="mr-2 h-4 w-4" />
                            )}
                            Save Changes
                        </Button>
                    </div>
                </div>

                {/* SEARCH & DYNAMIC FILTERS */}
                <div className="flex flex-col gap-4 mt-4 p-5 bg-background rounded-xl border shadow-sm">
                    {/* Search Bar */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <Input
                            className="h-12 pl-12 text-lg shadow-inner bg-muted/20 focus-visible:bg-background transition-colors"
                            placeholder="Universal Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Active Filters List */}
                    {activeFilters.length > 0 && (
                        <div className="flex flex-wrap gap-2 py-2">
                            {activeFilters.map(filter => (
                                <span key={filter.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                                    <span className="opacity-70">{filter.label}:</span>
                                    {filter.value}
                                    <button
                                        onClick={() => removeFilter(filter.id)}
                                        className="ml-1 rounded-full p-0.5 hover:bg-primary/20 text-primary"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </span>
                            ))}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground text-xs"
                                onClick={() => setActiveFilters([])}
                            >
                                Clear All
                            </Button>
                        </div>
                    )}

                    {/* Filter Creator Row */}
                    {!isAddingFilter ? (
                        <div className="flex items-center justify-between">
                            <Button
                                variant="outline"
                                onClick={() => setIsAddingFilter(true)}
                                className="border-dashed gap-2"
                            >
                                <Plus className="h-4 w-4" />
                                Add Custom Filter
                            </Button>
                            <div className="text-right text-sm text-muted-foreground">
                                Records Found: <span className="text-primary text-lg font-bold">{filteredRecords.length}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col sm:flex-row items-end gap-3 p-4 bg-muted/20 rounded-lg animate-in fade-in slide-in-from-top-2">
                            <div className="w-full sm:w-1/3 space-y-2">
                                <label className="text-sm font-medium">Filter By</label>
                                <Select value={newFilterField} onValueChange={setNewFilterField}>
                                    <SelectTrigger className="bg-background">
                                        <SelectValue placeholder="Select Field" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FILTER_FIELDS.map(f => (
                                            <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="w-full sm:w-1/3 space-y-2">
                                <label className="text-sm font-medium">Select Value</label>
                                <Select value={newFilterValue} onValueChange={setNewFilterValue} disabled={!newFilterField}>
                                    <SelectTrigger className="bg-background">
                                        <SelectValue placeholder={!newFilterField ? "Select Field First" : "Select Value"} />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[200px]">
                                        {getAvailableValues(newFilterField).map((val: any) => (
                                            <SelectItem key={String(val)} value={String(val)}>
                                                {String(val)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex gap-2">
                                <Button onClick={handleAddFilter} disabled={!newFilterField || !newFilterValue}>
                                    Apply Filter
                                </Button>
                                <Button variant="ghost" onClick={() => setIsAddingFilter(false)}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

            </CardHeader>
            <CardContent className="p-0">
                <div className="rounded-none border-t overflow-x-auto relative">
                    <Table className="min-w-[2400px]">
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                            <TableRow>
                                <TableHead className="w-[50px] sticky left-0 bg-muted/50 z-20">S.No</TableHead>
                                <TableHead className="min-w-[150px]">Company Name</TableHead>
                                <TableHead className="min-w-[150px]">Company Mail</TableHead>
                                <TableHead className="min-w-[200px]">Company Address</TableHead>
                                <TableHead className="min-w-[150px]">HR Name</TableHead>
                                <TableHead className="min-w-[150px]">HR Mail</TableHead>
                                <TableHead className="min-w-[150px]">Student Name</TableHead>
                                <TableHead className="min-w-[100px]">Dept</TableHead>
                                <TableHead className="min-w-[120px]">Type</TableHead>
                                <TableHead className="min-w-[100px]">Salary</TableHead>
                                <TableHead className="min-w-[100px]">Package (LPA)</TableHead>
                                <TableHead className="min-w-[120px]">Student ID</TableHead>
                                <TableHead className="min-w-[150px]">Student Mail</TableHead>
                                <TableHead className="min-w-[200px]">Student Address</TableHead>
                                <TableHead className="min-w-[80px]">Year</TableHead>
                                <TableHead className="min-w-[80px]">Sem</TableHead>
                                <TableHead className="min-w-[130px]">Join Date</TableHead>
                                <TableHead className="min-w-[100px]">Ref</TableHead>
                                <TableHead className="w-[80px] text-right sticky right-0 bg-muted/50 z-20">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRecords.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={19} className="text-center h-32 text-muted-foreground">
                                        No matching records found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredRecords.map((record, index) => (
                                    <TableRow key={record.id || `temp-${index}`} className="hover:bg-muted/10">
                                        <TableCell className="sticky left-0 bg-background z-10 font-medium">
                                            {index + 1}
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.company_name}
                                                onChange={(e) => updateRecord(index, "company_name", e.target.value)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                                placeholder="Company"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.company_mail}
                                                onChange={(e) => updateRecord(index, "company_mail", e.target.value)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.company_address}
                                                onChange={(e) => updateRecord(index, "company_address", e.target.value)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.hr_name}
                                                onChange={(e) => updateRecord(index, "hr_name", e.target.value)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.hr_mail}
                                                onChange={(e) => updateRecord(index, "hr_mail", e.target.value)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.placed_student_name}
                                                onChange={(e) => updateRecord(index, "placed_student_name", e.target.value)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors font-medium"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={record.department}
                                                onValueChange={(val) => updateRecord(index, "department", val)}
                                            >
                                                <SelectTrigger className="h-8 border-transparent hover:border-input focus:border-ring">
                                                    <SelectValue placeholder="-" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="CSE">CSE</SelectItem>
                                                    <SelectItem value="ECE">ECE</SelectItem>
                                                    <SelectItem value="EEE">EEE</SelectItem>
                                                    <SelectItem value="MECH">MECH</SelectItem>
                                                    <SelectItem value="CIVIL">CIVIL</SelectItem>
                                                    <SelectItem value="IT">IT</SelectItem>
                                                    <SelectItem value="AIDS">AIDS</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={record.internship_or_placed}
                                                onValueChange={(val) => updateRecord(index, "internship_or_placed", val)}
                                            >
                                                <SelectTrigger className="h-8 border-transparent hover:border-input focus:border-ring">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Placed">Placed</SelectItem>
                                                    <SelectItem value="Internship">Internship</SelectItem>
                                                    <SelectItem value="Both">Both</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.stipend_salary}
                                                onChange={(e) => updateRecord(index, "stipend_salary", e.target.value)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.package_lpa}
                                                onChange={(e) => updateRecord(index, "package_lpa", e.target.value)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.student_id}
                                                onChange={(e) => updateRecord(index, "student_id", e.target.value)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.student_mail_id}
                                                onChange={(e) => updateRecord(index, "student_mail_id", e.target.value)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.student_address}
                                                onChange={(e) => updateRecord(index, "student_address", e.target.value)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.placed_year}
                                                onChange={(e) => updateRecord(index, "placed_year", e.target.value)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.placed_sem}
                                                onChange={(e) => updateRecord(index, "placed_sem", e.target.value)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="date"
                                                value={record.date_of_join}
                                                onChange={(e) => updateRecord(index, "date_of_join", e.target.value)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.reference}
                                                onChange={(e) => updateRecord(index, "reference", e.target.value)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                            />
                                        </TableCell>
                                        <TableCell className="sticky right-0 bg-background z-10 text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => removeRow(index, record.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
