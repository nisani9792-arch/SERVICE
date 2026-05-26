import { redirect } from "next/navigation";

export default function TrashRedirectPage() {
  redirect("/dashboard?view=trash");
}
