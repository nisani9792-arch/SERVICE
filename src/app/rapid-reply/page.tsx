import { redirect } from "next/navigation";

export default function RapidReplyRedirectPage() {
  redirect("/dashboard?view=rapid");
}
