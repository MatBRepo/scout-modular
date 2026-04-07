// src/app/admin/page.tsx
import { redirect } from "next/navigation";

export default function AdminPage() {
    // Automatyczne przekierowanie z /admin na /admin/manage
    // Rozwiązuje to problem 404, gdy użytkownik próbuje wejść na /admin lub klika w breadcrumbs.
    redirect("/admin/manage");
}
