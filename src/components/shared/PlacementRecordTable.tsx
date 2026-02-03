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
import { Plus, Save, Trash2, Upload, Loader2, RefreshCw, Download, Clipboard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Definition to match PLACEMENT_TEMPLATE.xlsx and placement_records table (Designation removed)
interface PlacementRecord {
    id?: string;
    v_visit_type: string;
    date_of_visit: string;
    v_company_name: string;
    v_company_address: string;
    v_location: string;
    v_company_contact_person: string;
    v_company_contact_number: string;
    v_company_mail_id: string;
    company_type: string;
    salary_package: string;
    remark: string;
    [key: string]: any; // Support dynamic fields
}

export function PlacementRecordTable() {
    const [records, setRecords] = useState<PlacementRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [focusedCell, setFocusedCell] = useState<{ index: number, field: string } | null>(null);
    const [customColumns, setCustomColumns] = useState<string[]>([]);

    const COLUMN_KEYS: (keyof PlacementRecord)[] = [
        "v_visit_type",
        "date_of_visit",
        "v_company_name",
        "v_company_address",
        "v_location",
        "v_company_contact_person",
        "v_company_contact_number",
        "v_company_mail_id",
        "company_type",
        "salary_package",
        "remark"
    ];

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
        { label: "Visit Type", key: "v_visit_type" },
        { label: "Company", key: "v_company_name" },
        { label: "Location", key: "v_location" },
        { label: "Company Type", key: "company_type" },
        { label: "Date of Visit", key: "date_of_visit" }
    ];

    const filteredRecords = records.filter((record) => {
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            const matchesSearch = (
                (record.v_company_name?.toLowerCase() || "").includes(lowerSearch) ||
                (record.v_location?.toLowerCase() || "").includes(lowerSearch) ||
                (record.v_company_contact_person?.toLowerCase() || "").includes(lowerSearch) ||
                (record.v_company_mail_id?.toLowerCase() || "").includes(lowerSearch) ||
                (record.remark?.toLowerCase() || "").includes(lowerSearch)
            );
            if (!matchesSearch) return false;
        }

        for (const filter of activeFilters) {
            const recordVal = String(record[filter.field] || "").toLowerCase();
            const filterVal = filter.value.toLowerCase();
            if (recordVal !== filterVal) {
                return false;
            }
        }

        return true;
    });


    const processClipboardData = (clipboardText: string, useFocus: boolean = true) => {
        try {
            const rows = clipboardText.split(/\r?\n/).filter(line => line.length > 0);
            if (rows.length === 0) return false;
            const matrix = rows.map(row => row.split("\t"));

            if (useFocus && focusedCell) {
                const { index: startRow, field: startField } = focusedCell;
                const startColIndex = COLUMN_KEYS.indexOf(startField);

                if (startColIndex !== -1) {
                    setRecords(prev => {
                        const newRecords = [...prev];
                        matrix.forEach((cells, rOffset) => {
                            const targetRowIndex = startRow + rOffset;
                            if (!newRecords[targetRowIndex]) {
                                newRecords[targetRowIndex] = {
                                    v_visit_type: "On Campus",
                                    date_of_visit: "",
                                    v_company_name: "",
                                    v_company_address: "",
                                    v_location: "",
                                    v_company_contact_person: "",
                                    v_company_contact_number: "",
                                    v_company_mail_id: "",
                                    company_type: "IT",
                                    salary_package: "",
                                    remark: "",
                                };
                            }
                            cells.forEach((cellValue, cOffset) => {
                                const targetColIndex = startColIndex + cOffset;
                                if (targetColIndex < COLUMN_KEYS.length) {
                                    const fieldKey = COLUMN_KEYS[targetColIndex];
                                    let val = cellValue.trim();
                                    if (fieldKey === "date_of_visit") val = parseExcelDate(val);
                                    newRecords[targetRowIndex] = { ...newRecords[targetRowIndex], [fieldKey]: val };
                                }
                            });
                        });
                        return newRecords;
                    });
                    toast.success("Data updated in table.");
                    return true;
                }
            }

            const firstRow = matrix[0];
            const headerKeywords = ["company", "visit", "date", "type", "location", "contact", "person", "number", "mail", "remark"];
            const hasHeaders = firstRow.some(cell => headerKeywords.some(keyword => cell.toLowerCase().includes(keyword)));

            let dataToMap: any[] = [];
            if (hasHeaders && matrix.length > 1) {
                const headers = firstRow;
                dataToMap = matrix.slice(1).map(rowCells => {
                    const obj: any = {};
                    headers.forEach((header, i) => { obj[header] = rowCells[i] || ""; });
                    return obj;
                });
            } else {
                if (!useFocus) toast.info("No headers detected. Mapping data based on default column order.");
                dataToMap = matrix.map(rowCells => {
                    const obj: any = {};
                    rowCells.forEach((cell, i) => { obj[`column_${i}`] = cell; });
                    return obj;
                });
            }

            const newRecords = dataToMap.map(row => mapExcelRowToRecord(row));
            setRecords(prev => [...newRecords, ...prev]);
            toast.success(`Imported ${newRecords.length} records.`);
            return true;
        } catch (err) {
            console.error("Paste error:", err);
            toast.error("Failed to parse clipboard data.");
            return false;
        }
    };

    const handlePasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) {
                toast.error("Clipboard is empty or access denied.");
                return;
            }
            processClipboardData(text, false);
        } catch (err) {
            toast.error("Browser blocked clipboard access. Please use Ctrl+V instead.");
        }
    };

    useEffect(() => {
        fetchRecords();

        const handlePaste = (e: ClipboardEvent) => {
            const clipboardData = e.clipboardData?.getData("text");
            if (!clipboardData) return;

            // Check if user is typing in a non-table input (like the search box)
            const target = e.target as HTMLInputElement;
            const isSearchInput = target.placeholder?.includes("Search");

            if (isSearchInput) return; // Let search input handle normal paste

            if (processClipboardData(clipboardData, true)) {
                // If it's a multi-cell paste or we're in "spreadsheet mode", prevent default
                if (focusedCell || clipboardData.includes("\t") || clipboardData.includes("\n")) {
                    e.preventDefault();
                }
            }
        };

        window.addEventListener("paste", handlePaste);
        return () => window.removeEventListener("paste", handlePaste);
    }, [focusedCell]);

    const fetchRecords = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await (supabase
                .from("placement_records" as any) as any)
                .select("*")
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching records:", error);
                toast.error("Failed to fetch records");
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
            v_visit_type: "On Campus",
            date_of_visit: new Date().toISOString().split('T')[0],
            v_company_name: "",
            v_company_address: "",
            v_location: "",
            v_company_contact_person: "",
            v_company_contact_number: "",
            v_company_mail_id: "",
            company_type: "IT",
            salary_package: "",
            remark: "",
        };
        setRecords([newRecord, ...records]);
    };

    const removeRow = async (index: number, id?: any) => {
        if (id) {
            const { error } = await (supabase
                .from("placement_records" as any) as any)
                .delete()
                .eq("id", id);

            if (error) {
                toast.error("Failed to delete record");
                return;
            }
            toast.success("Record deleted");
        }

        const newRecords = [...records];
        newRecords.splice(index, 1);
        setRecords(newRecords);
    };

    const handleDeleteAll = async () => {
        if (!confirm("Are you sure you want to delete ALL records? This action cannot be undone.")) return;

        setIsLoading(true);
        try {
            const { error } = await (supabase
                .from("placement_records" as any) as any)
                .delete()
                .not("id", "is", null);

            if (error) throw error;

            setRecords([]);
            toast.success("All records deleted successfully");
        } catch (error: any) {
            console.error("Delete all error:", error);
            toast.error("Failed to delete all records: " + (error.message || "Unknown error"));
        } finally {
            setIsLoading(false);
        }
    };

    const updateRecord = (index: number, field: keyof PlacementRecord, value: string) => {
        const newRecords = [...records];
        newRecords[index] = { ...newRecords[index], [field]: value };
        setRecords(newRecords);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const cleanRecord = (r: any) => {
                const cleaned: any = {};
                COLUMN_KEYS.forEach(key => {
                    cleaned[key] = r[key];
                });
                if (r.id) cleaned.id = r.id;
                return cleaned;
            };

            if (customColumns.length > 0) {
                toast.info("Note: Custom columns are for current session/export only and will not be saved to the database.");
            }

            const toUpdate = records
                .filter(r => r.id && String(r.id).length > 5)
                .map(cleanRecord);

            const toInsert = records
                .filter(r => !r.id || String(r.id).length < 5)
                .map(r => {
                    const { id, ...rest } = cleanRecord(r);
                    return rest;
                });

            if (toUpdate.length > 0) {
                const { error } = await (supabase
                    .from("placement_records" as any) as any)
                    .upsert(toUpdate);
                if (error) throw error;
            }

            if (toInsert.length > 0) {
                const { error } = await (supabase
                    .from("placement_records" as any) as any)
                    .insert(toInsert);
                if (error) throw error;
            }

            toast.success("All records saved successfully!");
            fetchRecords();
        } catch (error: any) {
            console.error("Save error:", error);
            toast.error("Failed to save records: " + (error.message || "Unknown error"));
        } finally {
            setIsSaving(false);
        }
    };

    const parseExcelDate = (value: any): string => {
        if (!value) return "";

        // If it's a number (Excel serial date), convert it
        if (typeof value === 'number' || (!isNaN(Number(value)) && !String(value).includes('-') && !String(value).includes('/'))) {
            const serial = Number(value);
            const date = new Date((serial - 25569) * 86400 * 1000);
            const offset = date.getTimezoneOffset() * 60000;
            const adjDate = new Date(date.getTime() + offset);
            return adjDate.toISOString().split('T')[0];
        }

        const dateStr = String(value).trim();
        if (!dateStr) return "";

        if (dateStr.includes('&') || dateStr.includes(' and ') || dateStr.includes(',') || dateStr.split(' ').length > 2) {
            return dateStr;
        }

        const parts = dateStr.split(/[./-]/);
        if (parts.length === 3) {
            const [d, m, y] = parts.map(Number);
            if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
                const fullYear = y < 100 ? 2000 + y : y;
                const dObj = new Date(fullYear, m - 1, d);
                if (!isNaN(dObj.getTime())) {
                    return dObj.toISOString().split('T')[0];
                }
            }
        }

        const parsed = Date.parse(dateStr);
        if (!isNaN(parsed)) {
            try {
                return new Date(parsed).toISOString().split('T')[0];
            } catch (e) {
                return dateStr;
            }
        }

        return dateStr;
    };

    const mapExcelRowToRecord = (row: any): PlacementRecord => {
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

        const findKeyByFuzzyMatch = (searchKeys: string[]) => {
            const normalizedSearchKeys = searchKeys.map(normalize);
            const rowKeys = Object.keys(row);

            for (const searchKey of searchKeys) {
                if (row[searchKey] !== undefined) return row[searchKey];
            }

            for (const rKey of rowKeys) {
                const normRKey = normalize(rKey);
                if (normalizedSearchKeys.includes(normRKey)) return row[rKey];
            }

            for (const rKey of rowKeys) {
                const normRKey = normalize(rKey);
                if (normalizedSearchKeys.some(sk => normRKey.includes(sk) || sk.includes(normRKey))) {
                    return row[rKey];
                }
            }
            return undefined;
        };

        const getVal = (keys: string[]) => String(findKeyByFuzzyMatch(keys) || "").trim();

        return {
            v_visit_type: getVal(["v_visit_type", "Visit Type", "Type", "Mode"]),
            date_of_visit: parseExcelDate(findKeyByFuzzyMatch(["date_of_visit", "Date of Visit", "Date", "Visit Date", "Arrival"])),
            v_company_name: getVal(["v_company_name", "Company Name", "Name of Company", "Company", "Organization"]),
            v_company_address: getVal(["v_company_address", "Company Address", "Address", "Office Address"]),
            v_location: getVal(["v_location", "Location", "City", "Venue"]),
            v_company_contact_person: getVal(["v_company_contact_person", "Contact Person", "HR Name", "Contact", "HR"]),
            v_company_contact_number: getVal(["v_company_contact_number", "Contact Number", "Mobile", "Phone", "HR Contact"]),
            v_company_mail_id: getVal(["v_company_mail_id", "Company Mail ID", "Email", "HR Mail", "Mail"]),
            company_type: getVal(["company_type", "Company Type", "Sector", "Industry"]),
            salary_package: getVal(["salary_package", "Salary Package", "Package", "CTC", "LPA", "Salary"]),
            remark: getVal(["remark", "Remark", "Notes", "Status"]),
        };
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const fileList = Array.from(files);
        setIsLoading(true);
        const processedFiles: string[] = [];

        try {
            const allFileResults = await Promise.all(fileList.map(async (file) => {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data);
                let fileRecords: PlacementRecord[] = [];

                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    if (jsonData.length > 0) {
                        const mapped = (jsonData as any[]).map(row => mapExcelRowToRecord(row));
                        fileRecords = [...fileRecords, ...mapped];
                    }
                });

                processedFiles.push(file.name);
                return fileRecords;
            }));

            const combinedRecords = allFileResults.flat();
            if (combinedRecords.length > 0) {
                setRecords(prev => [...combinedRecords, ...prev]);
                toast.success(`Imported ${combinedRecords.length} records from: ${processedFiles.join(", ")}`);
            } else {
                toast.error("No valid data found in the selected files.");
            }
        } catch (error) {
            console.error("Error parsing files:", error);
            toast.error("Failed to parse some files. Please ensure they are valid Excel/CSV files.");
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handlePasteAsNewColumn = async () => {
        const columnName = prompt("Enter a name for the new column:");
        if (!columnName) return;

        if (COLUMN_KEYS.includes(columnName as any) || customColumns.includes(columnName)) {
            toast.error("Column name already exists.");
            return;
        }

        try {
            const text = await navigator.clipboard.readText();
            if (!text) {
                toast.error("Clipboard is empty.");
                return;
            }

            const values = text.split(/\r?\n/).filter(line => line.length > 0);
            if (values.length === 0) {
                toast.error("No data found in clipboard.");
                return;
            }

            setRecords(prev => {
                return prev.map((record, index) => ({
                    ...record,
                    [columnName]: values[index] || "" // Map by index
                }));
            });

            setCustomColumns(prev => [...prev, columnName]);
            toast.success(`Added column "${columnName}" with ${values.length} values.`);
        } catch (err) {
            toast.error("Failed to read clipboard. Please provide permissions.");
        }
    };

    const handleDownload = () => {
        if (filteredRecords.length === 0) {
            toast.error("No records to download based on current filters.");
            return;
        }

        const wb = XLSX.utils.book_new();
        const exportData = filteredRecords.map((r, i) => ({
            "S.No": i + 1,
            "Visit Type": r.v_visit_type,
            "Date of Visit": r.date_of_visit,
            "Company Name": r.v_company_name,
            "Company Address": r.v_company_address,
            "Location": r.v_location,
            "Contact Person": r.v_company_contact_person,
            "Contact Number": r.v_company_contact_number,
            "Company Mail ID": r.v_company_mail_id,
            "Company Type": r.company_type,
            "Salary Package": r.salary_package,
            "Remark": r.remark,
            ...Object.fromEntries(customColumns.map(col => [col, r[col] || ""]))
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, "Placement Records");
        XLSX.writeFile(wb, `Placement_Records_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success(`Downloaded ${filteredRecords.length} records.`);
    };

    const handleMultipleExport = () => {
        if (records.length === 0) {
            toast.error("No records to export.");
            return;
        }

        const wb = XLSX.utils.book_new();

        const formatForExport = (data: PlacementRecord[]) => data.map((r, i) => ({
            "S.No": i + 1,
            "Visit Type": r.v_visit_type,
            "Date of Visit": r.date_of_visit,
            "Company Name": r.v_company_name,
            "Company Address": r.v_company_address,
            "Location": r.v_location,
            "Contact Person": r.v_company_contact_person,
            "Contact Number": r.v_company_contact_number,
            "Company Mail ID": r.v_company_mail_id,
            "Company Type": r.company_type,
            "Salary Package": r.salary_package,
            "Remark": r.remark,
            ...Object.fromEntries(customColumns.map(col => [col, r[col] || ""]))
        }));

        // Sheet 1: All Records
        const wsAll = XLSX.utils.json_to_sheet(formatForExport(records));
        XLSX.utils.book_append_sheet(wb, wsAll, "All Records");

        // Dynamic Sheets based on Company Type
        const types = ["IT", "CORE", "BPO", "OTHER"];
        types.forEach(type => {
            const filtered = records.filter(r => r.company_type === type);
            if (filtered.length > 0) {
                const wsType = XLSX.utils.json_to_sheet(formatForExport(filtered));
                XLSX.utils.book_append_sheet(wb, wsType, `${type} Records`);
            }
        });

        XLSX.writeFile(wb, `Multiple_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success(`Exported ${records.length} records in multiple sheets.`);
    };

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
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            className="hidden"
                            accept=".xlsx, .xls, .csv"
                            multiple
                        />
                        <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="shadow-sm">
                            <Upload className="mr-2 h-4 w-4" /> Import Excel
                        </Button>
                        <Button onClick={handlePasteFromClipboard} variant="outline" className="shadow-sm bg-primary/5 border-primary/20 hover:bg-primary/10">
                            <Clipboard className="mr-2 h-4 w-4 text-primary" /> Paste New Rows
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="secondary" className="shadow-sm">
                                    <Download className="mr-2 h-4 w-4" /> Export Data
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleDownload}>
                                    Export Filtered ({filteredRecords.length})
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleMultipleExport}>
                                    Export All (Multi-Sheet)
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button onClick={addRow} variant="outline" className="shadow-sm">
                            <Plus className="mr-2 h-4 w-4" /> Add Row
                        </Button>
                        <Button onClick={handlePasteAsNewColumn} variant="outline" className="shadow-sm">
                            <Plus className="mr-2 h-4 w-4" /> Paste New Column
                        </Button>
                        <Button onClick={fetchRecords} variant="ghost" size="icon" title="Refresh">
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button onClick={handleDeleteAll} variant="destructive" size="icon" title="Delete All">
                            <Trash2 className="h-4 w-4" />
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

                {/* Direct Paste Hint */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/5 px-3 py-1.5 rounded-md border border-primary/10 w-fit">
                    <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span>Tip: You can <b>Ctrl+V</b> anywhere on this page to paste records directly from Excel!</span>
                </div>

                <div className="flex flex-col gap-4 mt-4 p-5 bg-background rounded-xl border shadow-sm">
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
                                            <SelectItem key={String(f.key)} value={String(f.key)}>{f.label}</SelectItem>
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
                    <Table className="min-w-[2000px]">
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                            <TableRow>
                                <TableHead className="w-[50px] sticky left-0 bg-muted/50 z-20">S.No</TableHead>
                                <TableHead className="min-w-[120px]">Visit Type</TableHead>
                                <TableHead className="min-w-[130px]">Date of Visit</TableHead>
                                <TableHead className="min-w-[180px]">Company Name</TableHead>
                                <TableHead className="min-w-[200px]">Company Address</TableHead>
                                <TableHead className="min-w-[150px]">Location</TableHead>
                                <TableHead className="min-w-[150px]">Contact Person</TableHead>
                                <TableHead className="min-w-[150px]">Contact Number</TableHead>
                                <TableHead className="min-w-[180px]">Company Mail ID</TableHead>
                                <TableHead className="min-w-[120px]">Company Type</TableHead>
                                <TableHead className="min-w-[120px]">Salary Package</TableHead>
                                <TableHead className="min-w-[150px]">Remark</TableHead>
                                {customColumns.map(col => (
                                    <TableHead key={col} className="min-w-[150px]">{col}</TableHead>
                                ))}
                                <TableHead className="w-[80px] text-right sticky right-0 bg-muted/50 z-20">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRecords.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={13} className="text-center h-32 text-muted-foreground">
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
                                            <Select
                                                value={record.v_visit_type}
                                                onValueChange={(val) => updateRecord(index, "v_visit_type", val)}
                                            >
                                                <SelectTrigger
                                                    className="h-8 border-transparent hover:border-input focus:border-ring"
                                                    onFocus={() => setFocusedCell({ index, field: "v_visit_type" })}
                                                    onBlur={() => setFocusedCell(null)}
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="On Campus">On Campus</SelectItem>
                                                    <SelectItem value="Off Campus">Off Campus</SelectItem>
                                                    <SelectItem value="Virtual">Virtual</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.date_of_visit}
                                                onChange={(e) => updateRecord(index, "date_of_visit", e.target.value)}
                                                onFocus={() => setFocusedCell({ index, field: "date_of_visit" })}
                                                onBlur={() => setFocusedCell(null)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                                placeholder="YYYY-MM-DD or Range"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.v_company_name}
                                                onChange={(e) => updateRecord(index, "v_company_name", e.target.value)}
                                                onFocus={() => setFocusedCell({ index, field: "v_company_name" })}
                                                onBlur={() => setFocusedCell(null)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.v_company_address}
                                                onChange={(e) => updateRecord(index, "v_company_address", e.target.value)}
                                                onFocus={() => setFocusedCell({ index, field: "v_company_address" })}
                                                onBlur={() => setFocusedCell(null)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.v_location}
                                                onChange={(e) => updateRecord(index, "v_location", e.target.value)}
                                                onFocus={() => setFocusedCell({ index, field: "v_location" })}
                                                onBlur={() => setFocusedCell(null)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.v_company_contact_person}
                                                onChange={(e) => updateRecord(index, "v_company_contact_person", e.target.value)}
                                                onFocus={() => setFocusedCell({ index, field: "v_company_contact_person" })}
                                                onBlur={() => setFocusedCell(null)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.v_company_contact_number}
                                                onChange={(e) => updateRecord(index, "v_company_contact_number", e.target.value)}
                                                onFocus={() => setFocusedCell({ index, field: "v_company_contact_number" })}
                                                onBlur={() => setFocusedCell(null)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.v_company_mail_id}
                                                onChange={(e) => updateRecord(index, "v_company_mail_id", e.target.value)}
                                                onFocus={() => setFocusedCell({ index, field: "v_company_mail_id" })}
                                                onBlur={() => setFocusedCell(null)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={record.company_type}
                                                onValueChange={(val) => updateRecord(index, "company_type", val)}
                                            >
                                                <SelectTrigger
                                                    className="h-8 border-transparent hover:border-input focus:border-ring"
                                                    onFocus={() => setFocusedCell({ index, field: "company_type" })}
                                                    onBlur={() => setFocusedCell(null)}
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="IT">IT</SelectItem>
                                                    <SelectItem value="CORE">CORE</SelectItem>
                                                    <SelectItem value="BPO">BPO</SelectItem>
                                                    <SelectItem value="OTHER">OTHER</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.salary_package}
                                                onChange={(e) => updateRecord(index, "salary_package", e.target.value)}
                                                onFocus={() => setFocusedCell({ index, field: "salary_package" })}
                                                onBlur={() => setFocusedCell(null)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors font-medium"
                                                placeholder="e.g. 4.5 LPA"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={record.remark}
                                                onChange={(e) => updateRecord(index, "remark", e.target.value)}
                                                onFocus={() => setFocusedCell({ index, field: "remark" })}
                                                onBlur={() => setFocusedCell(null)}
                                                className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                            />
                                        </TableCell>
                                        {customColumns.map(col => (
                                            <TableCell key={col}>
                                                <Input
                                                    value={record[col] || ""}
                                                    onChange={(e) => updateRecord(index, col, e.target.value)}
                                                    onFocus={() => setFocusedCell({ index, field: col })}
                                                    onBlur={() => setFocusedCell(null)}
                                                    className="h-8 border-transparent hover:border-input focus:border-ring transition-colors"
                                                />
                                            </TableCell>
                                        ))}
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
