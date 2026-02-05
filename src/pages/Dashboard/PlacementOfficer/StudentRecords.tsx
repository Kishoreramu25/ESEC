import { StudentPlacementTable } from "@/components/placement/StudentPlacementTable";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function StudentRecords() {
    return (
        <DashboardLayout>
            <div className="space-y-6 pb-10">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Records</h1>
                    <p className="text-muted-foreground">
                        Manage your department's individual student placement offers.
                    </p>
                </div>
                <StudentPlacementTable />
            </div>
        </DashboardLayout>
    );
}
