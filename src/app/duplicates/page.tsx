import { Suspense } from "react";
import ManageClient from "./ManageDuplicates";

export const dynamic = "force-dynamic"; // quick unblock; remove later if you want SSG

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ManageClient />
    </Suspense>
  );
}
