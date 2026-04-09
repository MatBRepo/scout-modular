// src/app/admin/page.tsx
import { redirect } from "next/navigation";

export default function AdminPage() {
    // Automatic redirect from /admin to /admin/manage
    // Resolves 404 issue when user tries to access /admin or clicks breadcrumbs.
    redirect("/admin/manage");
}
