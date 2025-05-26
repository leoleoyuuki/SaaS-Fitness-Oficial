import { Button } from "@/components/ui/button";
import { DumbbellIcon, LineChart, Utensils } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary">
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DumbbellIcon className="h-8 w-8" />
            <span className="text-2xl font-bold">FitPro</span>
          </div>
          <div className="space-x-4">
            <Button variant="ghost" asChild>
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-6">Transform Your Fitness Journey</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Science-based workout plans, personalized nutrition, and progress tracking
            all in one place.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-card p-6 rounded-lg shadow-lg">
            <DumbbellIcon className="h-12 w-12 mb-4" />
            <h2 className="text-2xl font-semibold mb-3">Smart Workouts</h2>
            <p className="text-muted-foreground">
              Personalized training plans based on scientific principles for maximum muscle growth.
            </p>
          </div>

          <div className="bg-card p-6 rounded-lg shadow-lg">
            <Utensils className="h-12 w-12 mb-4" />
            <h2 className="text-2xl font-semibold mb-3">Nutrition Planning</h2>
            <p className="text-muted-foreground">
              Custom meal plans aligned with your goals, preferences, and dietary needs.
            </p>
          </div>

          <div className="bg-card p-6 rounded-lg shadow-lg">
            <LineChart className="h-12 w-12 mb-4" />
            <h2 className="text-2xl font-semibold mb-3">Progress Tracking</h2>
            <p className="text-muted-foreground">
              Visual insights into your fitness journey with detailed analytics and metrics.
            </p>
          </div>
        </div>

        <div className="text-center mt-16">
          <Button size="lg" className="text-lg px-8" asChild>
            <Link href="/register">Start Your Journey</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
