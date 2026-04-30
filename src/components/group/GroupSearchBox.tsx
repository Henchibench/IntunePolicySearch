import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useEntraGroupSearch, type EntraGroupMatch } from '@/hooks/useEntraGroupSearch';

export interface GroupSearchBoxProps {
  onSelect: (group: EntraGroupMatch) => void;
  autoFocus?: boolean;
}

export function GroupSearchBox({ onSelect, autoFocus = false }: GroupSearchBoxProps) {
  const [query, setQuery] = useState('');
  const { matches, isLoading, error } = useEntraGroupSearch(query);

  return (
    <div className="w-full max-w-2xl">
      <Command shouldFilter={false} className="rounded-lg border shadow-sm">
        <div className="flex items-center px-3 border-b">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search groups by display name…"
            autoFocus={autoFocus}
            className="flex-1 outline-none bg-transparent py-3 text-sm"
          />
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <CommandList>
          {query.trim().length < 2 ? (
            <div className="p-4 text-sm text-muted-foreground">
              Keep typing — at least 2 characters.
            </div>
          ) : (
            <>
              <CommandEmpty>{error ? `Error: ${error}` : 'No groups found.'}</CommandEmpty>
              <CommandGroup>
                {matches.map((g) => (
                  <CommandItem
                    key={g.id}
                    value={g.id}
                    onSelect={() => onSelect(g)}
                    className="flex flex-col items-start gap-0.5"
                  >
                    <span className="font-medium">{g.displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      {g.mail || g.description || g.id}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </div>
  );
}
