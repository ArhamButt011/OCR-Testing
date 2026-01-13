export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Root Page Works!</h1>
        <a href="/admin-login" className="text-blue-500 underline">
          Go to Admin Login
        </a>
      </div>
    </div>
  );
}