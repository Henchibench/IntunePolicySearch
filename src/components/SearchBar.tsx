import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchBar = ({ 
  value, 
  onChange, 
  placeholder = "Search policies, settings, and configurations..." 
}: SearchBarProps) => {
  return (
    <div className="relative flex items-center gap-2">
      <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate" />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10"
      />
    </div>
  );
};