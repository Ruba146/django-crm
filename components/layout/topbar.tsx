"use client";

import { useSyncExternalStore } from "react";
import { Bell, Menu, Moon, Search, Sun } from "lucide-react";
import { useTranslations } from "@/hooks/use-translations";
import { useLanguageStore } from "@/stores/language-store";
import { useNotificationStore } from "@/stores/notification-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useThemeStore } from "@/stores/theme-store";
import {
  Avatar,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
  Input,
} from "@/components/ui";

export function Topbar() {
  const { t } = useTranslations();
  const locale = useLanguageStore((s) => s.locale);
  const setLocale = useLanguageStore((s) => s.setLocale);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const openMobile = useSidebarStore((s) => s.openMobile);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  // Derive resolved dark state reactively without a synchronizing effect.
  const systemDark = useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") return () => {};
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false
  );
  const isDark = theme === "dark" || (theme === "system" && systemDark);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
      {/* Mobile menu + search */}
      <button
        type="button"
        onClick={openMobile}
        className="rounded-md p-2 text-muted-foreground hover:bg-accent lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      <div className="relative hidden max-w-md flex-1 items-center md:flex">
        <Search className="pointer-events-none absolute start-3 size-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t("common.searchPlaceholder")}
          className="ps-9"
        />
      </div>

      <div className="ms-auto flex items-center gap-1">
        <Search className="size-5 text-muted-foreground md:hidden" />

        {/* Dark mode toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={t("common.toggleTheme")}
        >
          {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </button>

        {/* Language switch */}
        <Dropdown>
          <DropdownTrigger className="rounded-md px-2.5 py-2 text-sm font-semibold uppercase text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            {locale}
          </DropdownTrigger>
          <DropdownContent align="end">
            <DropdownItem onClick={() => setLocale("en")}>English</DropdownItem>
            <DropdownItem onClick={() => setLocale("ar")}>العربية</DropdownItem>
          </DropdownContent>
        </Dropdown>

        {/* Notifications */}
        <Dropdown>
          <DropdownTrigger className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <Bell className="size-5" />
            {unreadCount > 0 && (
              <span className="absolute end-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </DropdownTrigger>
          <DropdownContent align="end" className="w-72">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-sm font-medium">{t("common.notifications")}</span>
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-primary-600 hover:underline"
              >
                Mark all read
              </button>
            </div>
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t("common.noNotifications")}
            </div>
          </DropdownContent>
        </Dropdown>

        {/* User profile */}
        <Dropdown>
          <DropdownTrigger className="ms-1 rounded-full">
            <Avatar size="sm" name="U" />
          </DropdownTrigger>
          <DropdownContent align="end" className="w-56">
            <div className="flex items-center gap-3 px-3 py-2">
              <Avatar name="U" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">User</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t("common.profile")}
                </p>
              </div>
            </div>
            <DropdownSeparator />
            <DropdownItem>{t("common.profile")}</DropdownItem>
            <DropdownItem>{t("common.settings")}</DropdownItem>
            <DropdownSeparator />
            <DropdownItem>{t("common.signOut")}</DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>
    </header>
  );
}
