"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Handshake,
  Activity,
  CheckSquare,
  BarChart3,
  Sparkles,
  Settings,
  Layers,
  Network,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "@/hooks/use-translations";
import { MODULES, type ModuleDefinition, type ModuleKey } from "@/lib/modules/registry";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/cn";
import { Shield, ShieldOff } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  UserPlus,
  Handshake,
  Activity,
  CheckSquare,
  BarChart3,
  Sparkles,
  Settings,
  Layers,
  Network,
};

export function ModulesView() {
  const { t } = useTranslations();
  const [modules, setModules] = useState<ModuleDefinition[]>(() =>
    MODULES.map((m) => ({ ...m }))
  );

  const handleToggle = (key: ModuleKey) => {
    setModules((prev) =>
      prev.map((m) =>
        m.key === key ? { ...m, enabled: !m.enabled } : m
      )
    );
  };

  const enabledCount = modules.filter((m) => m.enabled).length;

  const resolveIcon = (iconName: string): LucideIcon => {
    return ICON_MAP[iconName] ?? LayoutDashboard;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("modules.title", "Modules")}
        </h1>
        <p className="text-muted-foreground">
          {t("modules.subtitle", "Configure which CRM modules are active for this organization.")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules
          .sort((a, b) => a.order - b.order)
          .map((module) => {
            const Icon = resolveIcon(module.icon);
            return (
              <Card
                key={module.key}
                className={cn(
                  "flex flex-col gap-3 p-4 transition-colors",
                  module.enabled
                    ? "border-primary/20 bg-primary/[0.02]"
                    : "opacity-60"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex size-10 items-center justify-center rounded-lg",
                        module.enabled
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {t(module.labelKey, module.key)}
                      </p>
                      {module.descriptionKey && (
                        <p className="text-xs text-muted-foreground">
                          {t(module.descriptionKey, "")}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggle(module.key)}
                    title={
                      module.enabled
                        ? t("modules.disable", "Disable")
                        : t("modules.enable", "Enable")
                    }
                  >
                    {module.enabled ? (
                      <Shield className="size-4 text-primary" />
                    ) : (
                      <ShieldOff className="size-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <Badge variant={module.enabled ? "primary" : "neutral"}>
                    {module.enabled
                      ? t("modules.enabled", "Enabled")
                      : t("modules.disabled", "Disabled")}
                  </Badge>
                  <span className="text-muted-foreground">
                    {module.table
                      ? `${t("modules.table", "Table")}: ${module.table}`
                      : t("modules.platform", "Platform")}
                  </span>
                </div>
              </Card>
            );
          })}
      </div>

      <div className="text-xs text-muted-foreground">
        {`${enabledCount} ${t("modules.of", "of")} ${modules.length} ${t("modules.modulesActive", "modules active")}`}
      </div>
    </div>
  );
}
