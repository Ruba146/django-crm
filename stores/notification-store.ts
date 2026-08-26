"use client";

import { create } from "zustand";

export interface AppNotification {
  id: string;
  title: string;
  description?: string;
  read: boolean;
  createdAt: string;
}

interface NotificationState {
  items: AppNotification[];
  unreadCount: number;
  /** Queue a new notification (future: wired to DB / websockets). */
  push: (notification: Omit<AppNotification, "id" | "read" | "createdAt">) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clear: () => void;
}

/**
 * Notification store — UI-only state for the topbar bell.
 * Database records are NOT kept here; this only holds transient
 * client-side notification UI state.
 */
export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  unreadCount: 0,
  push: (notification) => {
    const item: AppNotification = {
      ...notification,
      id: crypto.randomUUID(),
      read: false,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      items: [item, ...s.items].slice(0, 50),
      unreadCount: s.unreadCount + 1,
    }));
  },
  markAllRead: () =>
    set((s) => ({
      items: s.items.map((i) => ({ ...i, read: true })),
      unreadCount: 0,
    })),
  markRead: (id) =>
    set((s) => {
      const items = s.items.map((i) =>
        i.id === id ? { ...i, read: true } : i
      );
      return {
        items,
        unreadCount: items.filter((i) => !i.read).length,
      };
    }),
clear: () => set({ items: [], unreadCount: 0 }),
}));
