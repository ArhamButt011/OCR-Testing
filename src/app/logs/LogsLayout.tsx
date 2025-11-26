// app/logs/layout.tsx
export default function LogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="w-full h-screen">{children}</div>;
}