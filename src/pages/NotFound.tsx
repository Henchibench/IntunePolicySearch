import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EyebrowLabel } from "@/components/ui/EyebrowLabel";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center">
      <EyebrowLabel>404</EyebrowLabel>
      <h1 className="mt-4 text-[48px] font-medium tracking-tight2 text-ink">
        We can't find that page.
      </h1>
      <p className="mt-3 max-w-[44ch] text-[15px] font-[450] text-charcoal">
        The link may be stale, or the route was renamed.
      </p>
      <Button variant="outlined" size="default" asChild className="mt-8">
        <Link to="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
