import { ReactNode } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Header } from "./Header";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col">
          <Header />
          <main className="flex-1 bg-background p-6">{children}</main>
          <footer className="py-2 text-center text-xs text-muted-foreground border-t bg-background">
            <p>&copy; {new Date().getFullYear()} All Rights Reserved by Zenetive Infotech.</p>
          </footer>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}