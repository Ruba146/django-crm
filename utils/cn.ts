import { clsx, type ClassValue } from "clsx";

/**
 * Merge conditional class names.
 * Uses clsx for conditional logic and returns a single string.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
