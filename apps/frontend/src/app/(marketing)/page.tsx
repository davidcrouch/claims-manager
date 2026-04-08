import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="flex items-center justify-between p-4 border-b">
        <span className="text-lg font-semibold">Claims Manager</span>
        <div className="flex gap-2">
          <a href="/api/auth/login">
            <Button variant="ghost">Sign in</Button>
          </a>
          <a href="/api/auth/register">
            <Button>Sign up</Button>
          </a>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight text-center max-w-2xl">
          Claims Manager
        </h1>
        <p className="mt-4 text-lg text-muted-foreground text-center max-w-xl">
          Manage insurance claims, jobs, quotes, and more. Streamline your
          workflow with our comprehensive claims management platform.
        </p>
        <div className="mt-8 flex gap-4">
          <a href="/api/auth/login">
            <Button size="lg">Sign in</Button>
          </a>
          <a href="/api/auth/register">
            <Button size="lg" variant="outline">
              Create account
            </Button>
          </a>
        </div>
        <p className="mt-12 text-sm text-muted-foreground">
          Pricing (coming soon)
        </p>
      </main>
    </div>
  );
}
