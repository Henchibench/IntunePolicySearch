import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { EyebrowLabel } from '@/components/ui/EyebrowLabel';
import type { ScriptBlock } from '@/lib/settingsExtractor';

export interface ScriptContentSectionProps {
  scripts: ScriptBlock[];
}

export function ScriptContentSection({ scripts }: ScriptContentSectionProps) {
  if (scripts.length === 0) return null;

  return (
    <div className="space-y-4">
      <EyebrowLabel>SCRIPT CONTENT</EyebrowLabel>
      {scripts.map((script) => (
        <ScriptCodeBlock key={script.label} script={script} />
      ))}
    </div>
  );
}

function ScriptCodeBlock({ script }: { script: ScriptBlock }) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(script.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-border bg-lifted overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-muted transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {script.label}
        <span className="ml-auto text-muted-foreground/60 tabular-nums">
          {script.content.split('\n').length} lines
        </span>
      </button>
      {expanded && (
        <div className="relative">
          <button
            type="button"
            onClick={handleCopy}
            className="absolute right-2 top-2 rounded-md border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <pre className="overflow-x-auto bg-muted px-4 py-3 text-xs leading-relaxed text-foreground font-mono">
            <code>{script.content}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
