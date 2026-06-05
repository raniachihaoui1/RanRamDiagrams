import type { ImageOut } from "./api";

/** Human label for a date relative to today (Today / Yesterday / explicit). */
export function dateGroupLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export interface DateGroup {
  label: string;
  images: ImageOut[];
}

/** Group images (assumed sorted desc by created_at) into date buckets. */
export function groupByDate(images: ImageOut[]): DateGroup[] {
  const groups: DateGroup[] = [];
  let current: DateGroup | null = null;
  for (const img of images) {
    const label = dateGroupLabel(img.created_at);
    if (!current || current.label !== label) {
      current = { label, images: [] };
      groups.push(current);
    }
    current.images.push(img);
  }
  return groups;
}
