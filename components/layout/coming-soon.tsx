"use client";

import { motion } from "framer-motion";
import { Construction } from "lucide-react";
import { useTranslations } from "@/hooks/use-translations";

/**
 * Reusable "Coming Soon" placeholder for modules that are not built yet.
 * Used by Customers, Leads, Deals, Activities, Tasks, Reports, AI and
 * Settings routes until their business logic is implemented.
 */
export function ComingSoon() {
  const { t } = useTranslations();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border px-6 py-24 text-center"
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300">
        <Construction className="size-7" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold">{t("common.comingSoon")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {t("common.comingSoonHint")}
        </p>
      </div>
    </motion.div>
  );
}
