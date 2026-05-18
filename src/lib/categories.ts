import {
  Archive,
  BadgeHelp,
  Bug,
  CreditCard,
  Crown,
  Inbox,
  MessageSquareHeart,
  MicVocal,
  Reply,
  ShieldAlert,
  LayoutGrid
} from "lucide-react";
import type { LegacyTicketCategory } from "@/lib/types";
import { CUSTOMER_FOLLOWUP_CATEGORY, PENDING_TRIAGE_CATEGORY } from "@/lib/triage";

export const CATEGORY_LABELS_HE: Record<string, string> = {
  [PENDING_TRIAGE_CATEGORY]: "ממתין לסינון",
  [CUSTOMER_FOLLOWUP_CATEGORY]: "תשובות חוזרות",
  suggestions: "בקשות / הצעות ייעול",
  bugs: "באגים ובעיות שימוש",
  premium: "מנויי פרימיום / הרשמה",
  copyright: "זכויות יוצרים",
  artist: "בקשת זמר להצטרף",
  spam: "ספאם",
  handled: "טופל (Legacy)",
  Customer_Support: "שירות לקוחות",
  Billing: "חיוב",
  Spam: "ספאם (מובנה)"
};

export const CATEGORY_COLORS: Record<string, string> = {
  [PENDING_TRIAGE_CATEGORY]: "bg-fuchsia-100 text-fuchsia-950 ring-1 ring-fuchsia-300",
  [CUSTOMER_FOLLOWUP_CATEGORY]: "bg-amber-100 text-amber-950 ring-1 ring-amber-300",
  suggestions: "bg-blue-100 text-blue-800",
  bugs: "bg-rose-100 text-rose-800",
  premium: "bg-violet-100 text-violet-800",
  copyright: "bg-amber-100 text-amber-800",
  artist: "bg-emerald-100 text-emerald-800",
  spam: "bg-zinc-200 text-zinc-800",
  handled: "bg-green-100 text-green-800",
  Customer_Support: "bg-sky-100 text-sky-900",
  Billing: "bg-orange-100 text-orange-900",
  Spam: "bg-stone-200 text-stone-800"
};

export const CATEGORY_ICONS: Record<string, typeof BadgeHelp> = {
  [PENDING_TRIAGE_CATEGORY]: Inbox,
  [CUSTOMER_FOLLOWUP_CATEGORY]: Reply,
  suggestions: MessageSquareHeart,
  bugs: Bug,
  premium: Crown,
  copyright: ShieldAlert,
  artist: MicVocal,
  spam: BadgeHelp,
  handled: Archive,
  Customer_Support: LayoutGrid,
  Billing: CreditCard,
  Spam: BadgeHelp
};

export const ACTIVE_CATEGORIES: Exclude<LegacyTicketCategory, "handled">[] = [
  "suggestions",
  "bugs",
  "premium",
  "copyright",
  "artist",
  "spam",
  "Customer_Support",
  "Billing",
  "Spam"
];

export function categoryLabel(category: string): string {
  if (category in CATEGORY_LABELS_HE) {
    return CATEGORY_LABELS_HE[category];
  }
  return category.replace(/_/g, " ");
}

export function categoryBadgeClass(category: string): string {
  if (category in CATEGORY_COLORS) {
    return CATEGORY_COLORS[category];
  }
  return "bg-primary-soft text-primary";
}
