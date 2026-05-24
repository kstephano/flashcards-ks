export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border bg-white shadow-xl p-8 text-center space-y-4">
        <div className="text-4xl">📬</div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Check your email</h1>
        <p className="text-muted-foreground">
          A sign-in link has been sent to your email address.
        </p>
        <p className="text-sm text-muted-foreground">You can close this tab.</p>
      </div>
    </div>
  );
}
