import { ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FilterDropdownProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export const FilterDropdown = ({
  label,
  value,
  options,
  onChange,
  placeholder = "Select..."
}: FilterDropdownProps) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="inline-flex h-8 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-normal text-foreground hover:bg-accent">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};