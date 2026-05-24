export default function MobileTriageLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh touch-pan-y overscroll-none bg-surface">{children}</div>
  );
}
