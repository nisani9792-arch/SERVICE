import { CustomerTimeline } from "@/components/CustomerTimeline";

export default function CustomerPage({
  params
}: {
  params: { email: string };
}) {
  const email = decodeURIComponent(params.email);
  return <CustomerTimeline email={email} />;
}
