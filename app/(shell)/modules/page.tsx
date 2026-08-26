import { ModulesView } from "@/components/modules/modules-view";

/**
 * Modules management page — server component.
 *
 * Renders the module configuration view. Module state is managed
 * client-side in ModulesView for the current session; persistence
 * would be added in a later phase via a module_settings table.
 */
export const dynamic = "force-dynamic";

export default function ModulesPage() {
  return <ModulesView />;
}
