import { useState } from 'react';
import { Loader2, ListPlus } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useEntraGroupSearch, type EntraGroupMatch } from '@/hooks/useEntraGroupSearch';

export interface GroupSearchBoxProps {
  onSelect: (group: EntraGroupMatch) => void;
  autoFocus?: boolean;
}

const SHOW_ALL_VALUE = '__show-all__';

export function GroupSearchBox({ onSelect, autoFocus = false }: GroupSearchBoxProps) {
  const [query, setQuery] = useState('');
  const { matches, total, isLoading, error, mode, expandToFullList } =
    useEntraGroupSearch(query);

  const hasMore =
    mode === 'typeahead' && total !== null && total > matches.length;

  return (
    <div className="w-full max-w-2xl">
      <Command shouldFilter={false} className="rounded-lg border shadow-sm">
        <div className="relative">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search groups by display name…"
            autoFocus={autoFocus}
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground pointer-events-none" />
          )}
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
                    onSelect={() => {
                      onSelect(g);
                      setQuery('');
                    }}
                    className="flex flex-col items-start gap-0.5"
                  >
                    <span className="font-medium">{g.displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      {g.mail || g.description || g.id}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {hasMore && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      value={SHOW_ALL_VALUE}
                      onSelect={expandToFullList}
                      className="flex items-center gap-2 text-sm"
                    >
                      <ListPlus className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Show all matches for "{query}" ({total})
                      </span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
              {mode === 'full' && total !== null && total > matches.length && (
                <div className="px-4 py-2 text-xs text-muted-foreground">
                  Showing first {matches.length} of {total} matches.
                </div>
              )}
            </>
          )}
        </CommandList>
      </Command>
    </div>
  );
}
