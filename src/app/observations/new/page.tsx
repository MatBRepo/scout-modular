// src/app/observations/new/page.tsx
import { redirect } from "next/navigation";
export default function Page() {
  redirect("/observations?create=1");
}
