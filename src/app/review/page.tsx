import { redirect } from "next/navigation";

export default function ReviewRedirectPage() {
  redirect("/mobile/triage?queue=active");
}
