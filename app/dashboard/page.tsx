'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DumbbellIcon, LineChart, Utensils, Trophy } from 'lucide-react';
import Link from 'next/link';

interface UserProfile {
  goal: 'bulking' | 'cutting' | null;
  weeklyAvailability: number | null;
  weight: number | null;
  height: number | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
      } else {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserProfile(userDoc.data() as UserProfile);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading...</div>
      </div>
    );
  }

  if (!userProfile?.goal) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Welcome to FitPro! Let's get started.</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Complete your profile to get personalized workout and nutrition plans.</p>
            <Button asChild>
              <Link href="/onboarding">Complete Profile</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Button variant="outline" onClick={() => auth.signOut()}>
            Sign Out
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="workout">Workout</TabsTrigger>
            <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center space-x-4">
                  <DumbbellIcon className="w-8 h-8" />
                  <div>
                    <CardTitle className="text-lg">Next Workout</CardTitle>
                    <p className="text-sm text-muted-foreground">Push Day</p>
                  </div>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center space-x-4">
                  <Utensils className="w-8 h-8" />
                  <div>
                    <CardTitle className="text-lg">Daily Calories</CardTitle>
                    <p className="text-sm text-muted-foreground">2,500 kcal</p>
                  </div>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center space-x-4">
                  <Trophy className="w-8 h-8" />
                  <div>
                    <CardTitle className="text-lg">Level</CardTitle>
                    <p className="text-sm text-muted-foreground">Level 3</p>
                  </div>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center space-x-4">
                  <LineChart className="w-8 h-8" />
                  <div>
                    <CardTitle className="text-lg">Progress</CardTitle>
                    <p className="text-sm text-muted-foreground">+2.5kg this month</p>
                  </div>
                </CardHeader>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="workout">
            <Card>
              <CardHeader>
                <CardTitle>Your Workout Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/workout">View Workout Plan</Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="nutrition">
            <Card>
              <CardHeader>
                <CardTitle>Your Nutrition Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/nutrition">View Nutrition Plan</Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="progress">
            <Card>
              <CardHeader>
                <CardTitle>Your Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/progress">View Progress</Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
