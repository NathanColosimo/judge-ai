import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router";
import { AppSidebar } from "@/components/app-sidebar";
import Loader from "@/components/loader";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

export default function DashboardLayout() {
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!(session || isPending)) {
      navigate("/signin");
    }
  }, [session, isPending, navigate]);

  if (isPending) {
    return <Loader />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
