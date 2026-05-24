import { signIn } from '@/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl border bg-white shadow-xl p-8 space-y-8">
          {/* Logo / hero area */}
          <div className="text-center space-y-2">
            <div className="text-4xl mb-3">🗂️</div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Flashcards</h1>
            <p className="text-muted-foreground text-sm">
              AI-powered study cards from your notes and PDFs
            </p>
          </div>

          {/* Form */}
          <form
            action={async (formData: FormData) => {
              'use server';
              await signIn('resend', {
                email: formData.get('email') as string,
                redirectTo: '/',
              });
            }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email address
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                className="h-11 text-base"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white transition-colors"
            >
              Send Magic Link
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            We&apos;ll send a sign-in link to your email — no password needed.
          </p>
        </div>
      </div>
    </div>
  );
}
