export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="mx-auto w-full max-w-5xl px-5 py-10">{children}</div>;
}
