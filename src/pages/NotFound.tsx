import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <p className="text-xs font-semibold text-primary">404</p>
      <h1 className="mt-3 text-2xl font-semibold text-foreground">
        We can't find that page.
      </h1>
      <p className="mt-2 max-w-[44ch] text-sm text-muted-foreground">
        The link may be stale, or the route was renamed.
      </p>
      <Button variant="ink" size="default" asChild className="mt-8">
        <Link to="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
