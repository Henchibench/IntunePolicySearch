import { useState } from 'react';
import { Bookmark, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  loadSavedViews,
  saveView,
  deleteView,
  type SavedView,
} from '@/lib/savedViews';

export interface SavedViewsMenuProps {
  tenantId: string;
  current: Omit<SavedView, 'name'>;
  onApply: (view: SavedView) => void;
}

export function SavedViewsMenu({ tenantId, current, onApply }: SavedViewsMenuProps) {
  const [views, setViews] = useState<SavedView[]>(() => loadSavedViews(tenantId));
  const [name, setName] = useState('');

  const refresh = () => setViews(loadSavedViews(tenantId));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bookmark className="h-4 w-4" /> Saved views
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Saved views
        </div>
        {views.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">No saved views</div>
        ) : (
          views.map((v) => (
            <DropdownMenuItem
              key={v.name}
              className="flex justify-between"
              onSelect={(e) => {
                e.preventDefault();
                onApply(v);
              }}
            >
              <span>{v.name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteView(tenantId, v.name);
                  refresh();
                }}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <div className="flex items-center gap-2 p-2">
          <Input
            placeholder="View name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-xs"
          />
          <Button
            size="sm"
            disabled={!name.trim()}
            onClick={() => {
              saveView(tenantId, { name: name.trim(), ...current });
              setName('');
              refresh();
            }}
            className="gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
