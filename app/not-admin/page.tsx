import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export default function NotAdminPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <ShieldAlert className="h-10 w-10 text-amber-600 mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">Admin access required</h1>
        <p className="text-sm text-muted-foreground mb-6">
          You don&apos;t have permission to view this page.
        </p>
        <Link href="/">
          <Button className="w-full">Back to Home</Button>
        </Link>
      </div>
    </div>
  );
}
