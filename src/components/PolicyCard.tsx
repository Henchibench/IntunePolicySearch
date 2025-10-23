import { useState, useMemo, useEffect } from "react";
import { ChevronDown, ChevronRight, Smartphone, Laptop, Shield, AppWindow } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Policy, PolicySetting } from "@/types/graph";

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
  macOS: {
    color: "bg-ios text-ios-foreground", // Reuse iOS styling for macOS
    lightBg: "bg-ios-light",
    border: "border-ios-border",
    icon: Laptop,
  },
};

const typeIcons = {
  "Device Configuration": Laptop,
  "Compliance Policy": Shield,
  "App Protection": AppWindow,
  "Configuration Policy": AppWindow,
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
  const [showAllSettings, setShowAllSettings] = useState(false);
  
  const platformStyle = platformConfig[policy.platform];
  const PlatformIcon = platformStyle.icon;
  const TypeIcon = typeIcons[policy.type];
  
  // Check if any settings match the search term
  const hasMatchingSettings = useMemo(() => {
    if (!searchTerm) return false;
    return policy.settings.some(setting => 
      setting.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      setting.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
      setting.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [policy.settings, searchTerm]);

  // Auto-expand if there are matching settings, collapse when search is cleared
  useEffect(() => {
    if (hasMatchingSettings && searchTerm) {
      setIsExpanded(true);
    } else if (!searchTerm) {
      // Collapse when search is cleared and reset show all
      setIsExpanded(false);
      setShowAllSettings(false);
    }
  }, [hasMatchingSettings, searchTerm]);
  
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Filter settings based on search term (unless showAllSettings is true)
  const filteredSettings = useMemo(() => {
    if (!searchTerm || showAllSettings) return policy.settings;
    
    return policy.settings.filter(setting => 
      setting.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      setting.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
      setting.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [policy.settings, searchTerm, showAllSettings]);

  const groupedSettings = filteredSettings.reduce((acc, setting) => {
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
                <h3 className="text-lg font-semibold text-foreground break-words">
                  {highlightText(policy.name, searchTerm)}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 break-words">
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
              {policy.createdBy && policy.createdBy !== "Unknown" && (
                <span className="text-xs text-muted-foreground">
                  • Created by: {policy.createdBy}
                </span>
              )}
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
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-foreground">Policy Settings</h4>
              <div className="flex items-center gap-2">
                {searchTerm && filteredSettings.length !== policy.settings.length && !showAllSettings && (
                  <Badge variant="secondary" className="text-xs">
                    {filteredSettings.length} of {policy.settings.length} settings match
                  </Badge>
                )}
                {searchTerm && !showAllSettings && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllSettings(true)}
                    className="gap-2"
                  >
                    Show All {policy.settings.length} Settings
                  </Button>
                )}
                {searchTerm && showAllSettings && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setShowAllSettings(false)}
                    className="gap-2"
                  >
                    Show Filtered Results
                  </Button>
                )}
              </div>
            </div>
            
            {Object.entries(groupedSettings).map(([category, settings]) => (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h5 className="text-sm font-medium text-muted-foreground tracking-wide">
                    {category.includes(' > ') ? (
                      <span className="font-mono text-xs">
                        {category.split(' > ').map((part, index, array) => (
                          <span key={index}>
                            {highlightText(part, searchTerm)}
                            {index < array.length - 1 && <span className="text-muted-foreground/60 mx-1">›</span>}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="uppercase">
                        {highlightText(category, searchTerm)}
                      </span>
                    )}
                  </h5>
                  <Badge variant="outline" className="text-xs">
                    {settings.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pl-4">
                  {settings.map((setting, index) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg border border-border/50">
                      <div className="space-y-2">
                        <div className="flex-1">
                          <div className="font-medium text-sm break-words">
                            {highlightText(setting.key, searchTerm)}
                          </div>
                          {setting.description && setting.description.trim() && (
                            <div className="text-xs text-muted-foreground mt-1 break-words">
                              {highlightText(setting.description, searchTerm)}
                            </div>
                          )}
                        </div>
                        <div className="inline-block text-sm text-foreground font-mono bg-background px-2 py-1 rounded border break-all overflow-wrap-anywhere max-w-full">
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