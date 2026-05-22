export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="text-muted-foreground text-sm">
          A magic link has been sent to your email address. Click it to sign in.
        </p>
        <p className="text-muted-foreground text-xs">
          You can close this tab.
        </p>
      </div>
    </div>
  );
}
