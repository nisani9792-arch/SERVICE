import { redirect } from "next/navigation";

export default function TriageRedirectPage() {
  redirect("/dashboard?view=triage");
}
