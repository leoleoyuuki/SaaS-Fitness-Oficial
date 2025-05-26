'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, getDocs, orderBy, writeBatch } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Trophy, Star, TrendingUp, Medal, Target, Dumbbell, Calendar as CalendarIcon, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";


// Interface for set data
interface SetData {
  weight: number;
  reps: number;
  rir: number;
}

interface Exercise {
  name: string; // This will now store the specific exercise name (e.g., "Supino com Halteres")
  sets: number; // Number of sets planned (from the plan)
  reps: number; // Planned reps per set (or target from the plan)
  loggedSets?: SetData[]; // Array to store logged data for each set
  // Optional: Store the original movement pattern name for context if needed
  movementPatternName?: string;
}

interface ProgressData {
  date: string; // Stored as 'yyyy-MM-dd'
  bodyWeight: number;
  selectedPlanId?: string;
  selectedPlanDayId?: string;
  loggedExercises: Exercise[]; // Stores exercises with their logged sets
}

interface PredefinedTrainingPlan {
  id: string;
  name: string;
  description: string;
  days: {
    id: string;
    name: string;
    exercises: { // These exercises represent the *planned* movements/exercises
      name: string; // This might be the movement pattern name or a default exercise name
      sets: number;
      reps: number;
    }[];
  }[];
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: JSX.Element;
  progress: number;
  target: number;
  completed: boolean;
}

interface UserStats {
  level: number;
  experience: number;
  workoutsCompleted: number;
  streakDays: number;
  personalBests: {
    benchPress: number;
    squat: number;
    deadlift: number;
  };
  weeklyAvailability?: number;
  exercisePreferences?: { [movementPatternName: string]: string }; // Add exercise preferences
}

const calculateLevel = (experience: number) => {
  return Math.floor(Math.sqrt(experience / 100)) + 1;
};

const experienceForLevel = (level: number) => {
  return Math.pow(level - 1, 2) * 100;
};

// Dummy data for predefined training plans (used if Firestore is empty)
// NOTE: The 'name' field in exercises here represents the *planned* exercise or movement pattern name
const dummyPredefinedPlans: PredefinedTrainingPlan[] = [
  {
    id: 'upperLower',
    name: 'Upper/Lower (2 dias/semana)',
    description: 'Foco em grupos musculares superiores e inferiores.',
    days: [
      {
        id: 'upper1',
        name: 'Dia de Superior A',
        exercises: [
          { name: 'Horizontal Push', sets: 3, reps: 8 }, // Use movement pattern name
          { name: 'Horizontal Pull', sets: 3, reps: 8 }, // Use movement pattern name
          { name: 'Vertical Push', sets: 3, reps: 10 }, // Use movement pattern name
          { name: 'Bicep Curl', sets: 3, reps: 12 }, // Use movement pattern name
          { name: 'Triceps Extension', sets: 3, reps: 12 }, // Use movement pattern name
        ],
      },
      {
        id: 'lower1',
        name: 'Dia de Inferior A',
        exercises: [
          { name: 'Squat Pattern', sets: 3, reps: 8 }, // Use movement pattern name
          { name: 'Hip Hinge', sets: 3, reps: 8 }, // Use movement pattern name
          { name: 'Leg Press', sets: 3, reps: 10 }, // Use specific exercise name if not a pattern
          { name: 'Quad Isolation', sets: 3, reps: 12 }, // Use movement pattern name
          { name: 'Hamstring Curl', sets: 3, reps: 12 }, // Use movement pattern name
        ],
      },
    ],
  },
  {
    id: 'pushPullLegs',
    name: 'Push Pull Legs (3 dias/semana)',
    description: 'Um split clássico para crescimento muscular e força.',
    days: [
      {
        id: 'push',
        name: 'Dia de Empurrar (Push)',
        exercises: [
          { name: 'Horizontal Push', sets: 3, reps: 8 },
          { name: 'Incline Push', sets: 3, reps: 10 },
          { name: 'Vertical Push', sets: 3, reps: 8 },
          { name: 'Lateral Deltoid', sets: 3, reps: 12 },
          { name: 'Triceps Extension', sets: 3, reps: 10 },
        ],
      },
      {
        id: 'pull',
        name: 'Dia de Puxar (Pull)',
        exercises: [
          { name: 'Vertical Pull', sets: 3, reps: 8 },
          { name: 'Horizontal Pull', sets: 3, reps: 8 },
          { name: 'Vertical Pull (Wide)', sets: 3, reps: 10 },
          { name: 'Rear Delt Fly', sets: 3, reps: 15 },
          { name: 'Bicep Curl', sets: 3, reps: 10 },
        ],
      },
      {
        id: 'legs',
        name: 'Dia de Pernas (Legs)',
        exercises: [
          { name: 'Squat Pattern', sets: 3, reps: 8 },
          { name: 'Hip Hinge', sets: 3, reps: 8 },
          { name: 'Leg Press', sets: 3, reps: 10 },
          { name: 'Quad Isolation', sets: 3, reps: 12 },
          { name: 'Hamstring Curl', sets: 3, reps: 12 },
        ],
      },
    ],
  },
  {
    id: 'upperLower4Days',
    name: 'Upper/Lower (4 dias/semana)',
    description: 'Split de 4 dias com foco em superior e inferior.',
    days: [
      {
        id: 'upperA',
        name: 'Dia de Superior A',
        exercises: [
          { name: 'Horizontal Push', sets: 4, reps: 6 },
          { name: 'Horizontal Pull', sets: 4, reps: 6 },
          { name: 'Vertical Push', sets: 3, reps: 8 },
          { name: 'Hammer Curl', sets: 3, reps: 10 },
          { name: 'Triceps Extension', sets: 3, reps: 10 },
        ],
      },
      {
        id: 'lowerA',
        name: 'Dia de Inferior A',
        exercises: [
          { name: 'Squat Pattern', sets: 4, reps: 6 },
          { name: 'Deadlift Pattern', sets: 3, reps: 5 }, // Assuming a Deadlift Pattern exists
          { name: 'Quad Isolation', sets: 3, reps: 12 },
          { name: 'Hamstring Curl', sets: 3, reps: 12 },
          { name: 'Calf Raise', sets: 4, reps: 15 },
        ],
      },
      {
        id: 'upperB',
        name: 'Dia de Superior B',
        exercises: [
          { name: 'Incline Push', sets: 4, reps: 8 },
          { name: 'Horizontal Pull (Unilateral)', sets: 4, reps: 8 }, // Assuming a Unilateral Horizontal Pull pattern
          { name: 'Lateral Deltoid', sets: 3, reps: 12 },
          { name: 'Bicep Curl (Concentrated)', sets: 3, reps: 10 }, // Assuming a Concentrated Curl pattern
          { name: 'Triceps Dip', sets: 3, reps: 10 }, // Assuming a Triceps Dip pattern
        ],
      },
      {
        id: 'lowerB',
        name: 'Dia de Inferior B',
        exercises: [
          { name: 'Leg Press', sets: 4, reps: 10 },
          { name: 'Hip Hinge', sets: 3, reps: 8 },
          { name: 'Lunge Pattern', sets: 3, reps: 10 }, // Assuming a Lunge Pattern
          { name: 'Glute Isolation', sets: 3, reps: 12 }, // Assuming a Glute Isolation pattern
          { name: 'Calf Raise (Seated)', sets: 4, reps: 15 }, // Assuming a Seated Calf Raise pattern
        ],
      },
    ],
  },
  {
    id: 'fiveDaySplit',
    name: 'Split de 5 dias (5 dias/semana)',
    description: 'Foco em grupos musculares específicos por dia.',
    days: [
      {
        id: 'chestTriceps',
        name: 'Peito e Tríceps',
        exercises: [
          { name: 'Horizontal Push', sets: 4, reps: 8 },
          { name: 'Incline Push', sets: 3, reps: 10 },
          { name: 'Chest Fly', sets: 3, reps: 12 },
          { name: 'Triceps Extension', sets: 4, reps: 10 },
          { name: 'Overhead Triceps Extension', sets: 3, reps: 12 }, // Assuming Overhead Triceps Extension pattern
        ],
      },
      {
        id: 'backBiceps',
        name: 'Costas e Bíceps',
        exercises: [
          { name: 'Vertical Pull', sets: 4, reps: 8 },
          { name: 'Horizontal Pull', sets: 4, reps: 8 },
          { name: 'Vertical Pull (Wide)', sets: 3, reps: 10 },
          { name: 'Bicep Curl', sets: 4, reps: 10 },
          { name: 'Hammer Curl', sets: 3, reps: 12 },
        ],
      },
      {
        id: 'legsShoulders',
        name: 'Pernas e Ombros',
        exercises: [
          { name: 'Squat Pattern', sets: 4, reps: 8 },
          { name: 'Leg Press', sets: 3, reps: 10 },
          { name: 'Hip Hinge', sets: 3, reps: 10 },
          { name: 'Vertical Push', sets: 4, reps: 8 },
          { name: 'Lateral Deltoid', sets: 3, reps: 12 },
        ],
      },
      {
        id: 'upperBodyLight',
        name: 'Superior Leve',
        exercises: [
          { name: 'Horizontal Push (Machine)', sets: 3, reps: 12 }, // Assuming Machine Horizontal Push pattern
          { name: 'Horizontal Pull (Low)', sets: 3, reps: 12 }, // Assuming Low Horizontal Pull pattern
          { name: 'Front Deltoid', sets: 3, reps: 15 }, // Assuming Front Deltoid pattern
          { name: 'Triceps Rope Pushdown', sets: 3, reps: 15 }, // Assuming Rope Pushdown pattern
          { name: 'Bicep Curl (Scott)', sets: 3, reps: 15 }, // Assuming Scott Curl pattern
        ],
      },
      {
        id: 'lowerBodyLight',
        name: 'Inferior Leve',
        exercises: [
          { name: 'Adductor Isolation', sets: 3, reps: 15 }, // Assuming Adductor Isolation pattern
          { name: 'Abductor Isolation', sets: 3, reps: 15 }, // Assuming Abductor Isolation pattern
          { name: 'Calf Raise (Seated)', sets: 3, reps: 20 },
          { name: 'Quad Isolation', sets: 3, reps: 15 },
          { name: 'Hamstring Curl', sets: 3, reps: 15 },
        ],
      },
    ],
  },
  {
    id: 'sixDaySplit',
    name: 'Split de 6 dias (6 dias/semana)',
    description: 'Alta frequência para maximizar o crescimento.',
    days: [
      {
        id: 'push1',
        name: 'Push Day 1',
        exercises: [
          { name: 'Horizontal Push', sets: 3, reps: 8 },
          { name: 'Vertical Push', sets: 3, reps: 10 },
          { name: 'Triceps Extension', sets: 3, reps: 12 },
        ],
      },
      {
        id: 'pull1',
        name: 'Pull Day 1',
        exercises: [
          { name: 'Horizontal Pull', sets: 3, reps: 8 },
          { name: 'Vertical Pull (Wide)', sets: 3, reps: 10 },
          { name: 'Bicep Curl', sets: 3, reps: 12 },
        ],
      },
      {
        id: 'legs1',
        name: 'Legs Day 1',
        exercises: [
          { name: 'Squat Pattern', sets: 3, reps: 8 },
          { name: 'Hip Hinge', sets: 3, reps: 10 },
          { name: 'Leg Press', sets: 3, reps: 12 },
        ],
      },
      {
        id: 'push2',
        name: 'Push Day 2',
        exercises: [
          { name: 'Incline Push', sets: 3, reps: 8 },
          { name: 'Lateral Deltoid', sets: 3, reps: 12 },
          { name: 'Overhead Triceps Extension', sets: 3, reps: 12 },
        ],
      },
      {
        id: 'pull2',
        name: 'Pull Day 2',
        exercises: [
          { name: 'Vertical Pull', sets: 3, reps: 8 },
          { name: 'Horizontal Pull (Low)', sets: 3, reps: 10 },
          { name: 'Hammer Curl', sets: 3, reps: 12 },
        ],
      },
      {
        id: 'legs2',
        name: 'Legs Day 2',
        exercises: [
          { name: 'Deadlift Pattern', sets: 2, reps: 5 },
          { name: 'Quad Isolation', sets: 3, reps: 12 },
          { name: 'Hamstring Curl', sets: 3, reps: 12 },
        ],
      },
    ],
  },
];

// Define the available exercises and their alternatives (matching the workout page)
const exerciseDatabase: { [key: string]: { name: string; sets: number; reps: string; rir: number; notes?: string; } } = {
  'Bench Press': { name: 'Bench Press', sets: 4, reps: '6-8', rir: 1, notes: 'Control the eccentric phase' },
  'Incline Dumbbell Press': { name: 'Incline Dumbbell Press', sets: 3, reps: '8-10', rir: 1 },
  'Overhead Press': { name: 'Overhead Press', sets: 3, reps: '8-10', rir: 2 },
  'Lateral Raises': { name: 'Lateral Raises', sets: 3, reps: '10-12', rir: 1 },
  'Tricep Pushdowns': { name: 'Tricep Pushdowns', sets: 3, reps: '8-10', rir: 1 },
  'Barbell Rows': { name: 'Barbell Rows', sets: 4, reps: '6-8', rir: 1, notes: 'Focus on scapular retraction' },
  'Pull-ups/Lat Pulldowns': { name: 'Pull-ups/Lat Pulldowns', sets: 3, reps: '8-10', rir: 2 },
  'Face Pulls': { name: 'Face Pulls', sets: 3, reps: '10-12', rir: 1 },
  'Bicep Curls': { name: 'Bicep Curls', sets: 3, reps: '8-10', rir: 1 },
  'Hammer Curls': { name: 'Hammer Curls', sets: 2, reps: '8-10', rir: 1 },
  'Squats': { name: 'Squats', sets: 4, reps: '6-8', rir: 1, notes: 'Break parallel for full ROM' },
  'Romanian Deadlifts': { name: 'Romanian Deadlifts', sets: 3, reps: '8-10', rir: 2 },
  'Leg Press': { name: 'Leg Press', sets: 3, reps: '8-10', rir: 1 },
  'Leg Extensions': { name: 'Leg Extensions', sets: 3, reps: '10-12', rir: 1 },
  'Leg Curls': { name: 'Leg Curls', sets: 3, reps: '10-12', rir: 1 },
  'Standing Calf Raises': { name: 'Standing Calf Raises', sets: 4, reps: '8-10', rir: 1 },
  // Alternatives (ensure these names match the workout page and dummy data patterns)
  'Machine Chest Press': { name: 'Machine Chest Press', sets: 4, reps: '8-10', rir: 1 }, // Matches 'Horizontal Push (Machine)'? Need consistency. Let's assume 'Machine Chest Press' is the preferred name for 'Horizontal Push (Machine)' pattern.
  'Dumbbell Bench Press': { name: 'Dumbbell Bench Press', sets: 4, reps: '8-10', rir: 1 },
  'Cable Crossover (High)': { name: 'Cable Crossover (High)', sets: 3, reps: '10-12', rir: 1 }, // Matches 'Chest Fly' pattern
  'Seated Cable Rows': { name: 'Seated Cable Rows', sets: 4, reps: '8-10', rir: 1 }, // Matches 'Horizontal Pull (Low)'? Need consistency. Let's assume 'Seated Cable Rows' is preferred for 'Horizontal Pull (Low)'.
  'T-Bar Rows': { name: 'T-Bar Rows', sets: 4, reps: '6-8', rir: 1 },
  'Machine Shoulder Press': { name: 'Machine Shoulder Press', sets: 3, reps: '8-10', rir: 2 },
  'Dumbbell Shoulder Press': { name: 'Dumbbell Shoulder Press', sets: 3, reps: '8-10', rir: 2 },
  'Hack Squats': { name: 'Hack Squats', sets: 4, reps: '8-10', rir: 1 },
  'Bulgarian Split Squats': { name: 'Bulgarian Split Squats', sets: 3, reps: '8-10', rir: 1, notes: 'Per leg' }, // Matches 'Lunge Pattern'
  'Glute Ham Raises': { name: 'Glute Ham Raises', sets: 3, reps: '8-10', rir: 2 },
  'Seated Calf Raises': { name: 'Seated Calf Raises', sets: 4, reps: '10-15', rir: 1 }, // Matches 'Calf Raise (Seated)'
  // Need to add other exercises/patterns used in dummy data if they are not in the original exerciseDatabase
  'Deadlift Pattern': { name: 'Deadlift Pattern', sets: 3, reps: '5', rir: 1 }, // Placeholder, assuming Barbell Deadlift is standard
  'Horizontal Pull (Unilateral)': { name: 'Horizontal Pull (Unilateral)', sets: 4, reps: '8', rir: 1 }, // Placeholder, e.g., Dumbbell Rows
  'Bicep Curl (Concentrated)': { name: 'Bicep Curl (Concentrated)', sets: 3, reps: '10', rir: 1 }, // Placeholder, e.g., Concentration Curls
  'Triceps Dip': { name: 'Triceps Dip', sets: 3, reps: '10', rir: 1 }, // Placeholder, e.g., Bench Dips or Machine Dips
  'Glute Isolation': { name: 'Glute Isolation', sets: 3, reps: '12', rir: 1 }, // Placeholder, e.g., Glute Kickbacks
  'Overhead Triceps Extension': { name: 'Overhead Triceps Extension', sets: 3, reps: '12', rir: 1 }, // Placeholder, e.g., Overhead Dumbbell Extension
  'Front Deltoid': { name: 'Front Deltoid', sets: 3, reps: '15', rir: 1 }, // Placeholder, e.g., Front Raises
  'Triceps Rope Pushdown': { name: 'Triceps Rope Pushdown', sets: 3, reps: '15', rir: 1 }, // Placeholder
  'Bicep Curl (Scott)': { name: 'Bicep Curl (Scott)', sets: 3, reps: '15', rir: 1 }, // Placeholder
  'Adductor Isolation': { name: 'Adductor Isolation', sets: 3, reps: '15', rir: 1 }, // Placeholder
  'Abductor Isolation': { name: 'Abductor Isolation', sets: 3, reps: '15', rir: 1 }, // Placeholder
};


export default function ProgressPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState<ProgressData[]>([]); // All historical progress entries

  const [predefinedTrainingPlans, setPredefinedTrainingPlans] = useState<PredefinedTrainingPlan[]>([]);
  const [selectedPredefinedPlanId, setSelectedPredefinedPlanId] = useState<string | null>(null);
  const [selectedPredefinedPlanDayId, setSelectedPredefinedPlanDayId] = useState<string | null>(null);
  const [availableDaysFromSelectedPlan, setAvailableDaysFromSelectedPlan] = useState<Array<{ id: string; name: string; exercises: { name: string; sets: number; reps: number; }[] }>>([]);

  // State to hold the list of exercises for the *current logging session*, based on preferences
  const [currentLoggingExercises, setCurrentLoggingExercises] = useState<Exercise[]>([]);
  // State to hold logged set data for the current session being registered
  const [currentLoggedSets, setCurrentLoggedSets] = useState<Record<string, SetData[]>>({});

  const [bodyWeight, setBodyWeight] = useState<number | ''>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date()); // Date for the NEW entry

  const [userStats, setUserStats] = useState<UserStats>({
    level: 1,
    experience: 0,
    workoutsCompleted: 0,
    streakDays: 0,
    personalBests: {
      benchPress: 0,
      squat: 0,
      deadlift: 0,
    },
    weeklyAvailability: 3,
    exercisePreferences: {}, // Initialize exercise preferences
  });

  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null); // State to manage expanded workout card

  const achievements: Achievement[] = [
    {
      id: 'workout-streak',
      title: 'Rei da Consistência',
      description: 'Complete treinos por 7 dias seguidos',
      icon: <Trophy className="w-8 h-8 text-yellow-500" />,
      progress: userStats.streakDays,
      target: 7,
      completed: userStats.streakDays >= 7,
    },
    {
      id: 'bench-press',
      title: 'Mestre do Supino',
      description: 'Alcance 100kg no supino',
      icon: <Dumbbell className="w-8 h-8 text-blue-500" />,
      progress: userStats.personalBests.benchPress,
      target: 100,
      completed: userStats.personalBests.benchPress >= 100,
    },
    {
      id: 'workouts-completed',
      title: 'Atleta Dedicado',
      description: 'Complete 50 treinos',
      icon: <Target className="w-8 h-8 text-green-500" />,
      progress: userStats.workoutsCompleted,
      target: 50,
      completed: userStats.workoutsCompleted >= 50,
    },
  ];

  // Get the currently selected plan object for display in the log tab
  const currentSelectedPlan = useMemo(() => {
    return predefinedTrainingPlans.find(p => p.id === selectedPredefinedPlanId);
  }, [selectedPredefinedPlanId, predefinedTrainingPlans]);

  // Get the name of a plan day by its ID
  const getPlanDayName = (planId?: string, dayId?: string): string => {
    if (!planId || !dayId) return 'Dia de Treino Desconhecido';
    const plan = predefinedTrainingPlans.find(p => p.id === planId);
    if (!plan) return 'Dia de Treino Desconhecido';
    const day = plan.days.find(d => d.id === dayId);
    return day ? day.name : 'Dia de Treino Desconhecido';
  };

  // Find the best set (highest weight) for a given exercise from a list of logged exercises
  const findBestSetForExercise = (loggedExercises: Exercise[], exerciseName: string): SetData | null => {
    const exerciseEntry = loggedExercises.find(ex => ex.name === exerciseName);
    if (!exerciseEntry || !exerciseEntry.loggedSets || exerciseEntry.loggedSets.length === 0) {
      return null;
    }
    return exerciseEntry.loggedSets.reduce((maxSet, currentSet) => {
      return currentSet.weight > maxSet.weight ? currentSet : maxSet;
    }, { weight: 0, reps: 0, rir: 0 }); // Initialize with a dummy set
  };


  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        // Fetch progress data
        const progressRef = collection(db, 'users', user.uid, 'progress');
        // Order by date descending to show most recent first in the list
        const progressQuery = query(progressRef, orderBy('date', 'desc'));
        const progressSnapshot = await getDocs(progressQuery);
        // Map Firestore documents to ProgressData interface
        const progressData = progressSnapshot.docs.map(doc => ({
          date: doc.id, // Use document ID as date (assuming it's stored as 'yyyy-MM-dd')
          ...doc.data(),
        })) as ProgressData[];
        setProgressData(progressData);

        // Fetch user stats (including weeklyAvailability and exercisePreferences)
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        let fetchedUserStats: UserStats = {
          level: 1,
          experience: 0,
          workoutsCompleted: 0,
          streakDays: 0,
          personalBests: {
            benchPress: 0,
            squat: 0,
            deadlift: 0,
          },
          weeklyAvailability: 3, // Default to 3 if not found
          exercisePreferences: {}, // Default to empty object
        };

        if (userDoc.exists()) {
          const userData = userDoc.data();
          // Assign weeklyAvailability and exercisePreferences from the main user document
          fetchedUserStats.weeklyAvailability = userData.weeklyAvailability as number | undefined;
          fetchedUserStats.exercisePreferences = userData.exercisePreferences as { [movementPatternName: string]: string } | undefined || {};
        }

        // Also fetch stats from the 'stats/overview' subcollection if it exists
        const statsDoc = await getDoc(doc(db, 'users', user.uid, 'stats', 'overview'));
        if (statsDoc.exists()) {
          const statsData = statsDoc.data() as UserStats;
          // Merge stats data, prioritizing weeklyAvailability and exercisePreferences from the main user doc if found
          fetchedUserStats = {
            ...fetchedUserStats, // Start with data from main user doc (including weeklyAvailability and preferences if found)
            ...statsData, // Overlay stats data (excluding weeklyAvailability and preferences if already set from user doc)
            weeklyAvailability: fetchedUserStats.weeklyAvailability !== undefined ? fetchedUserStats.weeklyAvailability : (statsData.weeklyAvailability !== undefined ? statsData.weeklyAvailability : 3), // Ensure weeklyAvailability is set
            exercisePreferences: fetchedUserStats.exercisePreferences && Object.keys(fetchedUserStats.exercisePreferences).length > 0 ? fetchedUserStats.exercisePreferences : (statsData.exercisePreferences && Object.keys(statsData.exercisePreferences).length > 0 ? statsData.exercisePreferences : {}) // Ensure preferences are set
          };
        } else {
           // If stats/overview doesn't exist, ensure personalBests are initialized
           fetchedUserStats.personalBests = {
            benchPress: 0,
            squat: 0,
            deadlift: 0,
          };
        }

        // Ensure weeklyAvailability and exercisePreferences have defaults if still undefined/empty
        if (fetchedUserStats.weeklyAvailability === undefined) {
            fetchedUserStats.weeklyAvailability = 3; // Final default
        }
         if (!fetchedUserStats.exercisePreferences || Object.keys(fetchedUserStats.exercisePreferences).length === 0) {
            fetchedUserStats.exercisePreferences = {}; // Final default
        }


        setUserStats(fetchedUserStats);

        // Fetch predefined training plans
        const predefinedPlansRef = collection(db, 'predefinedTrainingPlans');
        const predefinedPlansSnapshot = await getDocs(predefinedPlansRef);
        let fetchedPredefinedPlans = predefinedPlansSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as PredefinedTrainingPlan[];

        // If no predefined plans exist in Firestore, upload dummy data
        if (fetchedPredefinedPlans.length === 0) {
          console.log('No predefined plans found in Firestore. Uploading dummy data...');
          const batch = writeBatch(db); // Use batch writes for efficiency
          dummyPredefinedPlans.forEach(plan => {
            const planDocRef = doc(predefinedPlansRef, plan.id);
            batch.set(planDocRef, plan);
          });
          await batch.commit();
          console.log('Dummy predefined plans uploaded to Firestore.');
          fetchedPredefinedPlans = dummyPredefinedPlans; // Use dummy data immediately after upload
        }

        setPredefinedTrainingPlans(fetchedPredefinedPlans);

        // Automatically select plan based on weeklyAvailability fetched from user doc
        const daysToPlanIdMap: { [key: number]: string } = {
          2: 'upperLower',
          3: 'pushPullLegs',
          4: 'upperLower4Days',
          5: 'fiveDaySplit',
          6: 'sixDaySplit',
        };

        // Use the fetched weeklyAvailability to determine the default plan
        const defaultPlanId = daysToPlanIdMap[fetchedUserStats.weeklyAvailability || 4] || 'pushPullLegs';
        const initialSelectedPlan = fetchedPredefinedPlans.find(p => p.id === defaultPlanId);

        if (initialSelectedPlan) {
          setSelectedPredefinedPlanId(initialSelectedPlan.id);
          setAvailableDaysFromSelectedPlan(initialSelectedPlan.days);
          // DO NOT pre-select the first day of the plan. User will choose or click a historical workout.
          setSelectedPredefinedPlanDayId(null);
          setCurrentLoggingExercises([]); // Clear exercises
          setCurrentLoggedSets({}); // Clear logged sets state
        } else if (fetchedPredefinedPlans.length > 0) {
          // Fallback if the mapped plan isn't found, pick the first available
          setSelectedPredefinedPlanId(fetchedPredefinedPlans[0].id);
          setAvailableDaysFromSelectedPlan(fetchedPredefinedPlans[0].days);
          setSelectedPredefinedPlanDayId(null);
          setCurrentLoggingExercises([]); // Clear exercises
          setCurrentLoggedSets({}); // Clear logged sets state
        }

      } catch (error) {
        console.error('Error fetching user data:', error);
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'Falha ao carregar dados de progresso.',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [router, toast]);

  // This handler is no longer directly tied to a user-selectable plan dropdown
  // but is kept for consistency if plan selection logic were to change.
  const handlePredefinedPlanSelect = (planId: string) => {
    setSelectedPredefinedPlanId(planId);
    setSelectedPredefinedPlanDayId(null); // Reset day selection when plan changes
    setCurrentLoggingExercises([]); // Clear exercises
    setCurrentLoggedSets({}); // Clear logged sets state

    const selectedPlan = predefinedTrainingPlans.find(p => p.id === planId);
    if (selectedPlan) {
      setAvailableDaysFromSelectedPlan(selectedPlan.days);
    } else {
      setAvailableDaysFromSelectedPlan([]);
    }
  };

  // MODIFIED: This function now uses user preferences to determine the exercises for logging
  const handlePredefinedPlanDaySelect = (dayId: string) => {
    setSelectedPredefinedPlanDayId(dayId);
    const selectedPlan = predefinedTrainingPlans.find(p => p.id === selectedPredefinedPlanId);

    if (selectedPlan) {
      const day = selectedPlan.days.find(d => d.id === dayId);
      if (day) {
        // Map the planned exercises/patterns to the user's preferred exercises
        const exercisesForLogging: Exercise[] = day.exercises.map(plannedExercise => {
            // Use user's preference if available, otherwise use the planned exercise name
            const preferredExerciseName = userStats.exercisePreferences?.[plannedExercise.name] || plannedExercise.name;

            // Find the details (like RIR, notes) from the exerciseDatabase using the preferred name
            // Fallback to a basic structure if not found in database (shouldn't happen if database is complete)
            const exerciseDetails = exerciseDatabase[preferredExerciseName] || {
                name: preferredExerciseName,
                sets: plannedExercise.sets,
                reps: plannedExercise.reps.toString(), // Convert number to string for consistency with ExerciseDetail
                rir: 0, // Default RIR if not found
                notes: undefined,
            };

            return {
                name: preferredExerciseName, // Store the specific preferred name
                sets: plannedExercise.sets, // Keep planned sets
                reps: plannedExercise.reps, // Keep planned reps (as number)
                loggedSets: [], // Start with empty logged sets for a new session
                movementPatternName: plannedExercise.name, // Store original pattern name for context
            };
        });

        setCurrentLoggingExercises(exercisesForLogging);

        // Initialize logged sets state based on the number of sets planned, with empty values for a new session
        const initialLoggedSets: Record<string, SetData[]> = {};
        exercisesForLogging.forEach(ex => {
          // Use the specific exercise name as the key
          initialLoggedSets[ex.name] = Array.from({ length: ex.sets }).map(() => ({ weight: 0, reps: 0, rir: 0 }));
        });
        setCurrentLoggedSets(initialLoggedSets);

      } else {
        setCurrentLoggingExercises([]);
        setCurrentLoggedSets({});
      }
    }
  };

  const handleSetInputChange = (exerciseName: string, setIndex: number, field: keyof SetData, value: string) => {
    setCurrentLoggedSets(prev => {
      const exerciseSets = [...(prev[exerciseName] || [])];
      // Ensure the set exists before trying to update it
      if (!exerciseSets[setIndex]) {
         exerciseSets[setIndex] = { weight: 0, reps: 0, rir: 0 };
      }
      exerciseSets[setIndex] = {
        ...exerciseSets[setIndex],
        [field]: parseFloat(value) || 0, // Parse to float for weight, int for reps/rir. || 0 ensures 0 is valid.
      };
      return {
        ...prev,
        [exerciseName]: exerciseSets,
      };
    });
  };


  const handleProgressUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPredefinedPlanId) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'O plano de treino não foi carregado automaticamente. Tente recarregar a página.',
      });
      return;
    }

    if (!selectedPredefinedPlanDayId) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Por favor, selecione um dia de treino.',
      });
      return;
    }

    if (!selectedDate) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Por favor, selecione uma data para o progresso.',
      });
      return;
    }

    // Map the exercises selected for logging with their actual logged sets
    const loggedExercisesWithSets: Exercise[] = currentLoggingExercises.map(ex => ({
      ...ex,
      loggedSets: currentLoggedSets[ex.name] || [], // Use logged sets based on the specific exercise name
    }));

    // Calculate personal bests from the logged sets for this session
    let currentSessionBenchPress = 0;
    let currentSessionSquat = 0;
    let currentSessionDeadlift = 0;

    loggedExercisesWithSets.forEach(ex => {
      const bestSetForExercise = ex.loggedSets?.reduce((maxSet, currentSet) => {
        return currentSet.weight > maxSet.weight ? currentSet : maxSet;
      }, { weight: 0, reps: 0, rir: 0 });

      if (bestSetForExercise && bestSetForExercise.weight > 0) {
        const exerciseNameLower = ex.name.toLowerCase();
        // Check for common names or patterns related to the big lifts
        if (exerciseNameLower.includes('supino') || exerciseNameLower.includes('bench press')) {
          currentSessionBenchPress = Math.max(currentSessionBenchPress, bestSetForExercise.weight);
        }
        if (exerciseNameLower.includes('agachamento') || exerciseNameLower.includes('squat')) {
          currentSessionSquat = Math.max(currentSessionSquat, bestSetForExercise.weight);
        }
        if (exerciseNameLower.includes('levantamento terra') || exerciseNameLower.includes('deadlift')) {
          currentSessionDeadlift = Math.max(currentSessionDeadlift, bestSetForExercise.weight);
        }
      }
    });


    const newProgress: ProgressData = {
      date: format(selectedDate, 'yyyy-MM-dd'), // Format date for Firestore document ID
      bodyWeight: parseFloat(bodyWeight as string),
      selectedPlanId: selectedPredefinedPlanId,
      selectedPlanDayId: selectedPredefinedPlanDayId,
      loggedExercises: loggedExercisesWithSets, // Save the specific exercises performed
    };

    try {
      const user = auth.currentUser;
      if (!user) return;

      // Update progress
      // Use the date as the document ID
      await setDoc(doc(db, 'users', user.uid, 'progress', newProgress.date), newProgress);

      // Update personal bests and add experience
      const updatedStats = { ...userStats };
      let experienceGained = 0;

      // Update personal bests only if the current session's best is higher than the stored best
      if (currentSessionBenchPress > userStats.personalBests.benchPress) {
        updatedStats.personalBests.benchPress = currentSessionBenchPress;
        experienceGained += 50;
      }
      if (currentSessionSquat > userStats.personalBests.squat) {
        updatedStats.personalBests.squat = currentSessionSquat;
        experienceGained += 50;
      }
      if (currentSessionDeadlift > userStats.personalBests.deadlift) {
        updatedStats.personalBests.deadlift = currentSessionDeadlift;
        experienceGained += 50;
      }

      updatedStats.workoutsCompleted += 1;
      updatedStats.experience += experienceGained + 100; // Base experience for logging progress
      updatedStats.level = calculateLevel(updatedStats.experience);

      // Ensure exercisePreferences are not overwritten if they exist in userStats
      const statsToSave = {
          ...updatedStats,
          // Explicitly include exercisePreferences from the current state
          exercisePreferences: userStats.exercisePreferences || {}
      };


      await setDoc(doc(db, 'users', user.uid, 'stats', 'overview'), statsToSave);
      setUserStats(updatedStats); // Update local state with new stats


      // Update UI and reset form
      // Fetch all progress data again to ensure the list is updated with the new entry
      const progressRef = collection(db, 'users', user.uid, 'progress');
      const progressQuery = query(progressRef, orderBy('date', 'desc')); // Fetch descending for list view
      const progressSnapshot = await getDocs(progressQuery);
      const updatedProgressData = progressSnapshot.docs.map(doc => ({
         date: doc.id, // Use document ID as date
         ...doc.data(),
      })) as ProgressData[];
      setProgressData(updatedProgressData);


      setBodyWeight('');
      setSelectedDate(new Date()); // Reset date to current
      // Reset day selection for next entry, but keep plan selected
      setSelectedPredefinedPlanDayId(null);
      setCurrentLoggingExercises([]); // Clear exercises
      setCurrentLoggedSets({}); // Clear logged sets state

      toast({
        title: 'Progresso Atualizado',
        description: `Ganhou ${experienceGained + 100} XP! ${experienceGained > 0 ? 'Novo recorde pessoal!' : ''}`,
      });
    } catch (error) {
      console.error('Error updating progress:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao atualizar progresso.',
      });
    }
  };

  // Handler to select a historical workout to pre-fill the log form
  const handleSelectHistoricalWorkout = (workout: ProgressData) => {
    // Find the corresponding plan and day from predefined plans (for context/display)
    const plan = predefinedTrainingPlans.find(p => p.id === workout.selectedPlanId);
    if (!plan) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Plano de treino histórico não encontrado.',
      });
      // Still proceed to load the logged exercises even if the original plan isn't found
    }
    const day = plan?.days.find(d => d.id === workout.selectedPlanDayId);
    if (!day && plan) { // Only show error if plan was found but day wasn't
       toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Dia de treino histórico não encontrado no plano original.',
      });
      // Still proceed to load the logged exercises
    }

    // Set the state for the log form based on the historical workout's *logged exercises*
    // These already contain the specific exercise names performed
    setSelectedPredefinedPlanId(workout.selectedPlanId || null); // Keep the original plan ID if available
    // If plan was found, update available days based on it. Otherwise, clear.
    setAvailableDaysFromSelectedPlan(plan?.days || []);
    setSelectedPredefinedPlanDayId(workout.selectedPlanDayId || null); // Keep the original day ID if available

    // Use exercises from the historical workout data, as they contain the logged sets and specific names
    setCurrentLoggingExercises(workout.loggedExercises);

    // Initialize currentLoggedSets with the logged sets from the historical workout
    const initialLoggedSets: Record<string, SetData[]> = {};
    workout.loggedExercises.forEach(ex => {
       // Use the specific exercise name as the key
       initialLoggedSets[ex.name] = ex.loggedSets || []; // Use logged sets from history
    });
    setCurrentLoggedSets(initialLoggedSets);

    // Optionally pre-fill body weight from the historical entry
    setBodyWeight(workout.bodyWeight || '');

    // Set the date for the *new* entry (default to today)
    setSelectedDate(new Date());

    // Switch to the log tab
    const logTabButton = document.querySelector('button[data-state="inactive"][value="log"]');
    if (logTabButton instanceof HTMLElement) {
      logTabButton.click();
    }

     toast({
        title: 'Treino Selecionado',
        description: `Pronto para registrar um novo treino baseado em "${day?.name || 'Treino Histórico'}".`,
      });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl">Carregando seu progresso...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Acompanhamento de Progresso</h1>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Voltar para o Painel
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Nível {userStats.level}</CardTitle>
              <Star className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userStats.experience} XP</div>
              <p className="text-xs text-muted-foreground">
                Próximo nível: {experienceForLevel(userStats.level + 1)} XP
              </p>
              <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${((userStats.experience - experienceForLevel(userStats.level)) /
                      (experienceForLevel(userStats.level + 1) - experienceForLevel(userStats.level))) *
                      100}%`,
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Treinos Concluídos</CardTitle>
              <Dumbbell className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userStats.workoutsCompleted}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sequência Atual</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userStats.streakDays} dias</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conquistas</CardTitle>
              <Medal className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {achievements.filter(a => a.completed).length}/{achievements.length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="history" className="space-y-6"> {/* Changed default tab */}
          <TabsList>
            <TabsTrigger value="history">Histórico de Treinos</TabsTrigger> {/* New tab */}
            <TabsTrigger value="log">Registrar Progresso</TabsTrigger>
            <TabsTrigger value="achievements">Conquistas</TabsTrigger>
          </TabsList>

          <TabsContent value="history"> {/* New tab content */}
             <Card>
                <CardHeader>
                  <CardTitle>Histórico de Treinos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {progressData.length > 0 ? (
                    progressData.map((workout, index) => {
                      const isExpanded = expandedWorkout === workout.date;
                      const isLastWorkout = index === 0; // Check if it's the most recent workout

                      return (
                        <Collapsible
                          key={workout.date}
                          open={isExpanded}
                          onOpenChange={() => setExpandedWorkout(isExpanded ? null : workout.date)}
                          className="border rounded-md p-4 space-y-2"
                        >
                          <CollapsibleTrigger asChild>
                            <div className="flex justify-between items-center cursor-pointer">
                              <div>
                                <h3 className="font-semibold">{format(new Date(workout.date), 'dd/MM/yyyy')}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {getPlanDayName(workout.selectedPlanId, workout.selectedPlanDayId)} - {workout.bodyWeight} kg
                                </p>
                              </div>
                              <div className="flex items-center space-x-2">
                                {/* Button to select this workout for logging a new session */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent collapsible from toggling
                                    handleSelectHistoricalWorkout(workout);
                                  }}
                                >
                                  Registrar Novo Treino
                                </Button>
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-3 pt-2">
                            {workout.loggedExercises.length > 0 ? (
                              workout.loggedExercises.map(exercise => {
                                // Find best set within this specific workout entry for highlighting
                                const bestSet = findBestSetForExercise([exercise], exercise.name);
                                return (
                                  <div key={exercise.name} className="space-y-1">
                                    {/* Display the specific exercise name that was logged */}
                                    <h4 className="text-sm font-medium">{exercise.name} ({exercise.sets} séries planejadas)</h4> {/* Show planned sets */}
                                    <ul className="list-disc list-inside text-sm text-muted-foreground">
                                      {exercise.loggedSets && exercise.loggedSets.length > 0 ? (
                                        exercise.loggedSets.map((set, setIndex) => (
                                          <li key={setIndex} className={cn(
                                            // Highlight the best set from the *last* workout entry being viewed
                                            isLastWorkout && bestSet && set.weight === bestSet.weight && set.reps === bestSet.reps ? 'font-bold text-primary' : ''
                                          )}>
                                            Série {setIndex + 1}: {set.weight} kg x {set.reps} reps (RIR: {set.rir})
                                          </li>
                                        ))
                                      ) : (
                                        <li>Nenhuma série registrada</li>
                                      )}
                                    </ul>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-sm text-muted-foreground">Nenhum exercício registrado para este treino.</p>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })
                  ) : (
                    <Alert>
                      <AlertTitle>Nenhum treino registrado</AlertTitle>
                      <AlertDescription>
                        Registre seu primeiro treino na aba "Registrar Progresso".
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
          </TabsContent>

          <TabsContent value="log">
            <Card>
              <CardHeader>
                <CardTitle>Registrar Progresso de Hoje</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProgressUpdate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Data do Treino</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !selectedDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? format(selectedDate, 'PPP') : <span>Selecione uma data</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trainingPlan">Plano de Treino</Label>
                    {/* Display the selected plan name */}
                    <div className="p-2 border rounded-md bg-muted text-muted-foreground">
                      {currentSelectedPlan ? currentSelectedPlan.name : 'Carregando plano...'}
                    </div>
                     {/* Note: Plan selection dropdown is removed as it's now auto-selected or picked from history */}
                  </div>

                  {selectedPredefinedPlanId && availableDaysFromSelectedPlan.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="trainingDay">Dia de Treino</Label>
                      {/* Day selection dropdown - can be selected manually or pre-filled from history */}
                      <Select value={selectedPredefinedPlanDayId || ''} onValueChange={handlePredefinedPlanDaySelect}>
                        <SelectTrigger id="trainingDay">
                          <SelectValue placeholder="Selecione um dia de treino" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableDaysFromSelectedPlan.map(day => (
                            <SelectItem key={day.id} value={day.id}>
                              {day.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {!selectedPredefinedPlanId && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Plano de Treino Não Carregado</AlertTitle>
                      <AlertDescription>
                        Não foi possível carregar seu plano de treino automaticamente. Verifique suas configurações ou tente recarregar a página.
                      </AlertDescription>
                    </Alert>
                  )}
                  {selectedPredefinedPlanId && !selectedPredefinedPlanDayId && availableDaysFromSelectedPlan.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Dia de Treino Não Selecionado</AlertTitle>
                      <AlertDescription>
                        Por favor, selecione um dia de treino manualmente ou clique em um treino no histórico para pré-preencher.
                      </AlertDescription>
                    </Alert>
                  )}


                  <div className="space-y-2">
                    <Label htmlFor="bodyWeight">Peso Corporal (kg)</Label>
                    <Input
                      id="bodyWeight"
                      name="bodyWeight"
                      type="number"
                      step="0.1"
                      required
                      value={bodyWeight}
                      onChange={(e) => setBodyWeight(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    />
                  </div>

                  {/* Use currentLoggingExercises to display exercises for logging */}
                  {currentLoggingExercises.length > 0 && (
                    <div className="space-y-4">
                      <Label className="text-lg font-semibold">Registrar Séries:</Label>
                      {currentLoggingExercises.map((exercise, exerciseIndex) => (
                        <div key={exercise.name} className="space-y-2 border p-4 rounded-md">
                          {/* Display the specific exercise name */}
                          <h3 className="font-medium">{exercise.name} ({exercise.sets} séries planejadas)</h3> {/* Show planned sets */}
                          {/* Render input fields based on the number of sets initialized in currentLoggedSets */}
                          {/* Use exercise.name as the key for currentLoggedSets */}
                          {Array.from({ length: currentLoggedSets[exercise.name]?.length || 0 }).map((_, setIndex) => (
                            <div key={`${exercise.name}-set-${setIndex}`} className="grid grid-cols-3 gap-2 items-center">
                              <Label htmlFor={`${exercise.name}-set-${setIndex}-weight`} className="text-sm">
                                Série {setIndex + 1}:
                              </Label>
                              <Input
                                id={`${exercise.name}-set-${setIndex}-weight`}
                                type="number"
                                step="0.5"
                                placeholder="Peso (kg)"
                                value={currentLoggedSets[exercise.name]?.[setIndex]?.weight || ''}
                                onChange={(e) => handleSetInputChange(exercise.name, setIndex, 'weight', e.target.value)}
                                required
                              />
                               <Input
                                id={`${exercise.name}-set-${setIndex}-reps`}
                                type="number"
                                step="1"
                                placeholder="Reps"
                                value={currentLoggedSets[exercise.name]?.[setIndex]?.reps || ''}
                                onChange={(e) => handleSetInputChange(exercise.name, setIndex, 'reps', e.target.value)}
                                required
                              />
                               <Input
                                id={`${exercise.name}-set-${setIndex}-rir`}
                                type="number"
                                step="1"
                                placeholder="RIR"
                                value={currentLoggedSets[exercise.name]?.[setIndex]?.rir || ''}
                                onChange={(e) => handleSetInputChange(exercise.name, setIndex, 'rir', e.target.value)}
                                required
                              />
                            </div>
                          ))}
                           {/* Optional: Button to add more sets if needed */}
                           <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCurrentLoggedSets(prev => {
                                  const exerciseSets = [...(prev[exercise.name] || [])];
                                  exerciseSets.push({ weight: 0, reps: 0, rir: 0 });
                                  return { ...prev, [exercise.name]: exerciseSets };
                                });
                              }}
                            >
                              Adicionar Série
                            </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={!selectedPredefinedPlanId || !selectedPredefinedPlanDayId || currentLoggingExercises.length === 0}>Registrar Progresso</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="achievements">
            <div className="grid gap-6">
              {achievements.map((achievement) => (
                <Card key={achievement.id}>
                  <CardHeader className="flex flex-row items-center space-x-4">
                    {achievement.icon}
                    <div>
                      <CardTitle>{achievement.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">{achievement.description}</p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progresso: {achievement.progress}/{achievement.target}</span>
                        <span>{Math.round((achievement.progress / achievement.target) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${(achievement.progress / achievement.target) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
