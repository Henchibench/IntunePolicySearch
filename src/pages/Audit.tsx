import { PillNav } from '@/components/PillNav';
import { UtilityRow } from '@/components/UtilityRow';

export default function Audit() {
  return (
    <div className="min-h-screen bg-canvas">
      <PillNav />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <UtilityRow />
        <h1 className="mt-6 text-2xl font-medium tracking-tight2 text-ink">
          Audit Log
        </h1>
        <p className="mt-1 text-sm text-slate">Coming soon</p>
      </div>
    </div>
  );
}
