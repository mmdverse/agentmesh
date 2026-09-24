import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleString();
}

export function truncate(str: string, len = 50): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + "...";
}
