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
  [PENDING_TRIAGE_CATEGORY]:
    "bg-fuchsia-500/12 text-fuchsia-900 ring-1 ring-fuchsia-400/30 backdrop-blur-sm",
  [CUSTOMER_FOLLOWUP_CATEGORY]:
    "bg-amber-500/12 text-amber-950 ring-1 ring-amber-400/30 backdrop-blur-sm",
  suggestions: "bg-blue-500/12 text-blue-900 ring-1 ring-blue-400/25 backdrop-blur-sm",
  bugs: "bg-rose-500/12 text-rose-900 ring-1 ring-rose-400/25 backdrop-blur-sm",
  premium: "bg-violet-500/12 text-violet-900 ring-1 ring-violet-400/25 backdrop-blur-sm",
  copyright: "bg-amber-500/12 text-amber-900 ring-1 ring-amber-400/25 backdrop-blur-sm",
  artist: "bg-emerald-500/12 text-emerald-900 ring-1 ring-emerald-400/25 backdrop-blur-sm",
  spam: "bg-slate-500/10 text-slate-700 ring-1 ring-slate-400/20 backdrop-blur-sm",
  handled: "bg-emerald-500/12 text-emerald-900 ring-1 ring-emerald-400/25 backdrop-blur-sm",
  Customer_Support: "bg-sky-500/12 text-sky-900 ring-1 ring-sky-400/25 backdrop-blur-sm",
  Billing: "bg-orange-500/12 text-orange-900 ring-1 ring-orange-400/25 backdrop-blur-sm",
  Spam: "bg-slate-500/10 text-slate-700 ring-1 ring-slate-400/20 backdrop-blur-sm"
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
