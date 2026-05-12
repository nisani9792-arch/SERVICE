import {
  Archive,
  BadgeHelp,
  Bug,
  Crown,
  MessageSquareHeart,
  MicVocal,
  ShieldAlert
} from "lucide-react";
import { TicketCategory } from "@/lib/types";

export const CATEGORY_LABELS_HE: Record<TicketCategory, string> = {
  suggestions: "בקשות / הצעות ייעול",
  bugs: "באגים ובעיות שימוש",
  premium: "מנויי פרימיום / הרשמה",
  copyright: "זכויות יוצרים",
  artist: "בקשת זמר להצטרף",
  spam: "ספאם",
  handled: "טופל"
};

export const CATEGORY_COLORS: Record<TicketCategory, string> = {
  suggestions: "bg-blue-100 text-blue-700",
  bugs: "bg-rose-100 text-rose-700",
  premium: "bg-violet-100 text-violet-700",
  copyright: "bg-amber-100 text-amber-700",
  artist: "bg-emerald-100 text-emerald-700",
  spam: "bg-zinc-200 text-zinc-700",
  handled: "bg-green-100 text-green-700"
};

export const CATEGORY_ICONS: Record<TicketCategory, typeof BadgeHelp> = {
  suggestions: MessageSquareHeart,
  bugs: Bug,
  premium: Crown,
  copyright: ShieldAlert,
  artist: MicVocal,
  spam: BadgeHelp,
  handled: Archive
};

export const ACTIVE_CATEGORIES: Exclude<TicketCategory, "handled">[] = [
  "suggestions",
  "bugs",
  "premium",
  "copyright",
  "artist",
  "spam"
];
