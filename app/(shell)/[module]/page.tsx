import { notFound } from "next/navigation";
import { getModule, getEnabledModules } from "@/lib/modules/registry";

export const dynamic = "force-dynamic";

const VIEW_MAP: Record<string, () => Promise<Record<string, unknown>>> = {
  customers: () => import("@/components/customers"),
  leads: () => import("@/components/leads"),
  deals: () => import("@/components/deals"),
  activities: () => import("@/components/activities"),
  tasks: () => import("@/components/tasks"),
  reports: () => import("@/components/reports"),
};

const VIEW_KEYS: Record<string, string> = {
  customers: "CustomersView",
  leads: "LeadsView",
  deals: "DealsView",
  activities: "ActivitiesView",
  tasks: "TasksView",
  reports: "ReportsView",
};

export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const moduleKey = module as string;

  const definition = getModule(moduleKey as never);
  if (!definition || !definition.enabled) {
    notFound();
  }

  const viewLoader = VIEW_MAP[moduleKey];
  if (!viewLoader) {
    notFound();
  }

  const moduleExports = await viewLoader();
  const viewKey = VIEW_KEYS[moduleKey];
  const ViewComponent = moduleExports[viewKey] as React.ComponentType<Record<string, unknown>> | undefined;

  if (!ViewComponent) {
    notFound();
  }

  return <ViewComponent />;
}

export async function generateStaticParams() {
  const modules = getEnabledModules();
  return modules.map((m) => ({ module: m.key }));
}
