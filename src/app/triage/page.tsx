import { redirect } from "next/navigation";

export default function TriageRedirectPage() {
  redirect("/mobile/triage?queue=triage");
}
