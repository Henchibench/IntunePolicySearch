import { useState } from "react";
import { ChevronDown, ChevronRight, Smartphone, Laptop, Shield, AppWindow } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export interface PolicySetting {
  category: string;
  key: string;
  value: string;
  description?: string;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  type: "Device Configuration" | "Compliance Policy" | "App Protection" | "Conditional Access";
  platform: "Windows" | "iOS" | "Android" | "All Platforms";
  lastModified: string;
  settings: PolicySetting[];
}

interface PolicyCardProps {
  policy: Policy;
  searchTerm?: string;
}

const platformConfig = {
  Windows: {
    color: "bg-windows text-windows-foreground",
    lightBg: "bg-windows-light",
    border: "border-windows-border",
    icon: Laptop,
  },
  iOS: {
    color: "bg-ios text-ios-foreground",
    lightBg: "bg-ios-light",
    border: "border-ios-border",
    icon: Smartphone,
  },
  Android: {
    color: "bg-android text-android-foreground",
    lightBg: "bg-android-light",
    border: "border-android-border",
    icon: Smartphone,
  },
  "All Platforms": {
    color: "bg-all-platforms text-all-platforms-foreground",
    lightBg: "bg-all-platforms-light",
    border: "border-all-platforms-border",
    icon: AppWindow,
  },
};

const typeIcons = {
  "Device Configuration": Laptop,
  "Compliance Policy": Shield,
  "App Protection": AppWindow,
  "Conditional Access": Shield,
};

const highlightText = (text: string, searchTerm: string) => {
  if (!searchTerm) return text;
  
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, index) => 
    regex.test(part) ? (
      <mark key={index} className="bg-primary-glow animate-search-highlight px-1 rounded">
        {part}
      </mark>
    ) : part
  );
};

export const PolicyCard = ({ policy, searchTerm = "" }: PolicyCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const platformStyle = platformConfig[policy.platform];
  const PlatformIcon = platformStyle.icon;
  const TypeIcon = typeIcons[policy.type];
  
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const groupedSettings = policy.settings.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, PolicySetting[]>);

  return (
    <Card className="hover:shadow-lg transition-all duration-300 hover:bg-card-hover border-border">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${platformStyle.lightBg} ${platformStyle.border} border`}>
                <PlatformIcon className={`h-5 w-5 ${platformStyle.color.split(' ')[0].replace('bg-', 'text-')}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">
                  {highlightText(policy.name, searchTerm)}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {highlightText(policy.description, searchTerm)}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={platformStyle.color}>
                {policy.platform}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <TypeIcon className="h-3 w-3" />
                {policy.type}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Last modified: {policy.lastModified}
              </span>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleExpanded}
            className="ml-4"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0 animate-card-expand">
          <Separator className="mb-4" />
          <div className="space-y-6">
            <h4 className="font-medium text-foreground">Policy Settings</h4>
            
            {Object.entries(groupedSettings).map(([category, settings]) => (
              <div key={category} className="space-y-3">
                <h5 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  {highlightText(category, searchTerm)}
                </h5>
                <div className="space-y-2 pl-4">
                  {settings.map((setting, index) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg border border-border/50">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {highlightText(setting.key, searchTerm)}
                          </div>
                          {setting.description && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {highlightText(setting.description, searchTerm)}
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-foreground font-mono bg-background px-2 py-1 rounded border">
                          {highlightText(setting.value, searchTerm)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
};