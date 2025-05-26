'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DumbbellIcon, AlertCircle, Save } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label'; // Assuming you have a Label component

interface ExerciseDetail {
  name: string;
  sets: number;
  reps: string;
  rir: number;
  notes?: string;
}

interface MovementPattern {
  name: string;
  standard: ExerciseDetail;
  alternatives: ExerciseDetail[];
}

interface MuscleGroupPlan {
  [muscleGroup: string]: MovementPattern[];
}

interface WorkoutPlan {
  split: string[]; // e.g., ['Push', 'Pull', 'Legs']
  muscleGroupPlans: {
    [day: string]: MuscleGroupPlan; // e.g., { 'Push': { 'Chest': [...], 'Shoulders': [...] } }
  };
}

// Define the available exercises and their alternatives
const exerciseDatabase: { [key: string]: ExerciseDetail } = {
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
  // Alternatives
  'Machine Chest Press': { name: 'Machine Chest Press', sets: 4, reps: '8-10', rir: 1 },
  'Dumbbell Bench Press': { name: 'Dumbbell Bench Press', sets: 4, reps: '8-10', rir: 1 },
  'Cable Crossover (High)': { name: 'Cable Crossover (High)', sets: 3, reps: '10-12', rir: 1 },
  'Seated Cable Rows': { name: 'Seated Cable Rows', sets: 4, reps: '8-10', rir: 1 },
  'T-Bar Rows': { name: 'T-Bar Rows', sets: 4, reps: '6-8', rir: 1 },
  'Machine Shoulder Press': { name: 'Machine Shoulder Press', sets: 3, reps: '8-10', rir: 2 },
  'Dumbbell Shoulder Press': { name: 'Dumbbell Shoulder Press', sets: 3, reps: '8-10', rir: 2 },
  'Hack Squats': { name: 'Hack Squats', sets: 4, reps: '8-10', rir: 1 },
  'Bulgarian Split Squats': { name: 'Bulgarian Split Squats', sets: 3, reps: '8-10', rir: 1, notes: 'Per leg' },
  'Glute Ham Raises': { name: 'Glute Ham Raises', sets: 3, reps: '8-10', rir: 2 },
  'Seated Calf Raises': { name: 'Seated Calf Raises', sets: 4, reps: '10-15', rir: 1 },
};


const generateWorkoutPlan = (daysPerWeek: number): WorkoutPlan => {
  const splits: { [key: number]: string[] } = {
    2: ['Upper Body', 'Lower Body'],
    3: ['Push', 'Pull', 'Legs'],
    4: ['Upper Body', 'Lower Body', 'Upper Body', 'Lower Body'],
    5: ['Push', 'Pull', 'Legs', 'Upper Body', 'Lower Body'],
    6: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs']
  };

  const pushPlan: MuscleGroupPlan = {
    'Chest': [
      { name: 'Horizontal Push', standard: exerciseDatabase['Bench Press'], alternatives: [exerciseDatabase['Machine Chest Press'], exerciseDatabase['Dumbbell Bench Press']] },
      { name: 'Incline Push', standard: exerciseDatabase['Incline Dumbbell Press'], alternatives: [] },
      { name: 'Chest Fly', standard: exerciseDatabase['Cable Crossover (High)'], alternatives: [] },
    ],
    'Shoulders': [
      { name: 'Vertical Push', standard: exerciseDatabase['Overhead Press'], alternatives: [exerciseDatabase['Machine Shoulder Press'], exerciseDatabase['Dumbbell Shoulder Press']] },
      { name: 'Lateral Deltoid', standard: exerciseDatabase['Lateral Raises'], alternatives: [] },
    ],
    'Triceps': [
      { name: 'Triceps Extension', standard: exerciseDatabase['Tricep Pushdowns'], alternatives: [] },
    ]
  };

  const pullPlan: MuscleGroupPlan = {
    'Back (Thickness)': [
      { name: 'Horizontal Pull', standard: exerciseDatabase['Barbell Rows'], alternatives: [exerciseDatabase['Seated Cable Rows'], exerciseDatabase['T-Bar Rows']] },
      { name: 'Vertical Pull', standard: exerciseDatabase['Pull-ups/Lat Pulldowns'], alternatives: [] },
    ],
    'Back (Width)': [
       { name: 'Vertical Pull (Wide)', standard: exerciseDatabase['Pull-ups/Lat Pulldowns'], alternatives: [] }, // Could add wide grip lat pulldowns etc.
    ],
    'Rear Deltoids': [
      { name: 'Rear Delt Fly', standard: exerciseDatabase['Face Pulls'], alternatives: [] },
    ],
    'Biceps': [
      { name: 'Bicep Curl', standard: exerciseDatabase['Bicep Curls'], alternatives: [] },
      { name: 'Hammer Curl', standard: exerciseDatabase['Hammer Curls'], alternatives: [] },
    ]
  };

  const legsPlan: MuscleGroupPlan = {
    'Quads': [
      { name: 'Squat Pattern', standard: exerciseDatabase['Squats'], alternatives: [exerciseDatabase['Hack Squats'], exerciseDatabase['Leg Press']] },
      { name: 'Quad Isolation', standard: exerciseDatabase['Leg Extensions'], alternatives: [] },
    ],
    'Hamstrings': [
      { name: 'Hip Hinge', standard: exerciseDatabase['Romanian Deadlifts'], alternatives: [exerciseDatabase['Glute Ham Raises']] },
      { name: 'Hamstring Curl', standard: exerciseDatabase['Leg Curls'], alternatives: [] },
    ],
    'Calves': [
      { name: 'Calf Raise', standard: exerciseDatabase['Standing Calf Raises'], alternatives: [exerciseDatabase['Seated Calf Raises']] },
    ]
  };

  const upperBodyPlan: MuscleGroupPlan = {
    'Chest': [
      { name: 'Horizontal Push', standard: exerciseDatabase['Bench Press'], alternatives: [exerciseDatabase['Machine Chest Press'], exerciseDatabase['Dumbbell Bench Press']] },
      { name: 'Incline Push', standard: exerciseDatabase['Incline Dumbbell Press'], alternatives: [] },
    ],
     'Back': [
      { name: 'Horizontal Pull', standard: exerciseDatabase['Barbell Rows'], alternatives: [exerciseDatabase['Seated Cable Rows'], exerciseDatabase['T-Bar Rows']] },
      { name: 'Vertical Pull', standard: exerciseDatabase['Pull-ups/Lat Pulldowns'], alternatives: [] },
    ],
     'Shoulders': [
      { name: 'Vertical Push', standard: exerciseDatabase['Overhead Press'], alternatives: [exerciseDatabase['Machine Shoulder Press'], exerciseDatabase['Dumbbell Shoulder Press']] },
      { name: 'Lateral Deltoid', standard: exerciseDatabase['Lateral Raises'], alternatives: [] },
      { name: 'Rear Delt Fly', standard: exerciseDatabase['Face Pulls'], alternatives: [] },
    ],
    'Biceps': [
      { name: 'Bicep Curl', standard: exerciseDatabase['Bicep Curls'], alternatives: [] },
    ],
    'Triceps': [
      { name: 'Triceps Extension', standard: exerciseDatabase['Tricep Pushdowns'], alternatives: [] },
    ]
  };

  const lowerBodyPlan: MuscleGroupPlan = {
    'Quads': [
      { name: 'Squat Pattern', standard: exerciseDatabase['Squats'], alternatives: [exerciseDatabase['Hack Squats'], exerciseDatabase['Leg Press']] },
      { name: 'Quad Isolation', standard: exerciseDatabase['Leg Extensions'], alternatives: [] },
    ],
    'Hamstrings': [
      { name: 'Hip Hinge', standard: exerciseDatabase['Romanian Deadlifts'], alternatives: [exerciseDatabase['Glute Ham Raises']] },
      { name: 'Hamstring Curl', standard: exerciseDatabase['Leg Curls'], alternatives: [] },
    ],
    'Calves': [
      { name: 'Calf Raise', standard: exerciseDatabase['Standing Calf Raises'], alternatives: [exerciseDatabase['Seated Calf Raises']] },
    ]
  };


  const muscleGroupPlans: { [day: string]: MuscleGroupPlan } = {
    'Push': pushPlan,
    'Pull': pullPlan,
    'Legs': legsPlan,
    'Upper Body': upperBodyPlan,
    'Lower Body': lowerBodyPlan,
  };

  const split = splits[daysPerWeek as keyof typeof splits];

  // Map the split days to the actual muscle group plans
  const planMuscleGroupMapping: { [day: string]: MuscleGroupPlan } = {};
  split.forEach(dayName => {
      if (muscleGroupPlans[dayName]) {
          planMuscleGroupMapping[dayName] = muscleGroupPlans[dayName];
      }
  });


  return {
    split: split,
    muscleGroupPlans: planMuscleGroupMapping
  };
};

// Helper to get all movement patterns for a given day
const getAllMovementPatternsForDay = (muscleGroupPlan: MuscleGroupPlan): MovementPattern[] => {
    let patterns: MovementPattern[] = [];
    for (const muscleGroup in muscleGroupPlan) {
        patterns = patterns.concat(muscleGroupPlan[muscleGroup]);
    }
    return patterns;
};

// Helper to get all unique movement patterns across the entire plan
const getAllUniqueMovementPatterns = (workoutPlan: WorkoutPlan): MovementPattern[] => {
    const uniquePatternsMap = new Map<string, MovementPattern>();
    workoutPlan.split.forEach(dayName => {
        const muscleGroupPlan = workoutPlan.muscleGroupPlans[dayName];
        if (muscleGroupPlan) {
            getAllMovementPatternsForDay(muscleGroupPlan).forEach(pattern => {
                if (!uniquePatternsMap.has(pattern.name)) {
                    uniquePatternsMap.set(pattern.name, pattern);
                }
            });
        }
    });
    return Array.from(uniquePatternsMap.values());
};


export default function WorkoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>('');
  // State now stores global preferences per movement pattern name
  const [selectedExercises, setSelectedExercises] = useState<{ [movementPatternName: string]: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [allUniquePatterns, setAllUniquePatterns] = useState<MovementPattern[]>([]);


  const fetchUserProfileAndPlan = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      router.push('/login');
      return;
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const plan = generateWorkoutPlan(userData.weeklyAvailability);
        setWorkoutPlan(plan);

        const uniquePatterns = getAllUniqueMovementPatterns(plan);
        setAllUniquePatterns(uniquePatterns);

        // Initialize selected exercises based on saved preferences or defaults
        const savedPreferences = userData.exercisePreferences || {}; // Assuming saved data is { [patternName: string]: string }
        const initialSelectedExercises: { [movementPatternName: string]: string } = {};

        uniquePatterns.forEach(pattern => {
            // Use saved preference if it exists, otherwise use the standard exercise name
            initialSelectedExercises[pattern.name] =
                savedPreferences[pattern.name] || pattern.standard.name;
        });

        setSelectedExercises(initialSelectedExercises);
        setSelectedDay(plan.split[0]); // Set initial tab to the first workout day
      } else {
         // Handle case where user doc doesn't exist (shouldn't happen if onboarding is done)
         console.error("User document not found!");
         router.push('/onboarding'); // Redirect to onboarding or error page
      }
    } catch (error) {
      console.error('Error fetching user profile or generating plan:', error);
      // Optionally set an error state to display to the user
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUserProfileAndPlan();
  }, [fetchUserProfileAndPlan]);

  // Handler for changing a GLOBAL exercise preference for a movement pattern
  const handleExercisePreferenceChange = (patternName: string, newExerciseName: string) => {
    setSelectedExercises(prev => ({
      ...prev,
      [patternName]: newExerciseName
    }));
    setSaveSuccess(false); // Reset save success message on change
  };

  const savePreferences = async () => {
      const user = auth.currentUser;
      if (!user) return;

      setIsSaving(true);
      try {
          const userDocRef = doc(db, 'users', user.uid);
          // Save the global exercise preferences
          await setDoc(userDocRef, { exercisePreferences: selectedExercises }, { merge: true });
          console.log("Exercise preferences saved successfully!");
          setSaveSuccess(true);
      } catch (error) {
          console.error("Error saving exercise preferences:", error);
          setSaveSuccess(false); // Indicate save failed
      } finally {
          setIsSaving(false);
      }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading your workout plan...</div>
      </div>
    );
  }

  if (!workoutPlan) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Card>
          <CardHeader>
            <CardTitle>Error Loading Workout Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Unable to load your workout plan. Please try again later.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Find the MovementPattern object by name to get its standard and alternatives
  const getMovementPatternByName = (patternName: string): MovementPattern | undefined => {
      // We can find it in the list of all unique patterns
      return allUniquePatterns.find(p => p.name === patternName);
  };


  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Your Workout Plan</h1>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>

        <Alert>
          <DumbbellIcon className="h-4 w-4" />
          <AlertTitle>Training Guidelines</AlertTitle>
          <AlertDescription>
            • Perform exercises with proper form
            • RIR (Reps in Reserve) indicates how many reps you should have left in the tank
            • Progressive overload: Increase weight when you can complete all sets with good form
          </AlertDescription>
        </Alert>

        <Tabs value={selectedDay} onValueChange={setSelectedDay}>
          <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 w-full"> {/* Added one more column for the new tab */}
            {workoutPlan.split.map((day, index) => (
              <TabsTrigger key={index} value={day}>
                Day {index + 1}: {day}
              </TabsTrigger>
            ))}
             <TabsTrigger value="change-exercises">
                Change Exercises
            </TabsTrigger>
          </TabsList>

          {/* Tab Content for each workout day */}
          {workoutPlan.split.map((day, index) => {
              const dayMuscleGroupPlan = workoutPlan.muscleGroupPlans[day];
              const dayMovementPatterns = dayMuscleGroupPlan ? getAllMovementPatternsForDay(dayMuscleGroupPlan) : [];

              // Get the actual ExerciseDetail objects based on GLOBAL selected preferences
              const exercisesForDay = dayMovementPatterns
                .map(pattern => {
                    const selectedExerciseName = selectedExercises[pattern.name]; // Use global preference
                    // Find the ExerciseDetail object - check standard first, then alternatives
                    if (pattern.standard.name === selectedExerciseName) {
                        return pattern.standard;
                    }
                    const alternative = pattern.alternatives.find(alt => alt.name === selectedExerciseName);
                    return alternative || pattern.standard; // Fallback to standard if selected name not found or preference is missing
                })
                .filter(exercise => exercise !== undefined); // Filter out any undefined in case of errors


              return (
                <TabsContent key={index} value={day}>
                  <Card>
                    <CardHeader>
                      <CardTitle>{day} Workout</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {exercisesForDay.map((exercise, exerciseIndex) => (
                          <div
                            key={exerciseIndex}
                            className="border rounded-lg p-4 hover:bg-accent transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-lg font-semibold">{exercise.name}</h3>
                              <span className="text-sm text-muted-foreground">
                                RIR: {exercise.rir}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>{exercise.sets} sets</span>
                              <span>{exercise.reps} reps</span>
                            </div>
                            {exercise.notes && (
                              <p className="mt-2 text-sm text-muted-foreground">
                                Note: {exercise.notes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              );
          })}

          {/* Tab Content for Changing Exercises (Global Preferences) */}
          <TabsContent value="change-exercises">
              <Card>
                  <CardHeader>
                      <CardTitle>Change Exercise Preferences</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <div className="space-y-6">
                          {/* List all unique movement patterns from the entire plan */}
                          {allUniquePatterns.map((pattern, patternIndex) => (
                              <div key={patternIndex} className="space-y-2">
                                  <Label>{pattern.name} (Standard: {pattern.standard.name})</Label>
                                  <Select
                                      // Use the global preference for this pattern
                                      value={selectedExercises[pattern.name] || pattern.standard.name}
                                      // Update the global preference state
                                      onValueChange={(newValue) => handleExercisePreferenceChange(pattern.name, newValue)}
                                  >
                                      <SelectTrigger>
                                          <SelectValue placeholder={`Select ${pattern.name}`} />
                                      </SelectTrigger>
                                      <SelectContent>
                                          {/* Always include the standard exercise */}
                                          <SelectItem value={pattern.standard.name}>
                                              {pattern.standard.name} (Standard)
                                          </SelectItem>
                                          {/* Include alternatives */}
                                          {pattern.alternatives.map((alt, altIndex) => (
                                              <SelectItem key={altIndex} value={alt.name}>
                                                  {alt.name}
                                              </SelectItem>
                                          ))}
                                      </SelectContent>
                                  </Select>
                              </div>
                          ))}
                      </div>
                      <Button onClick={savePreferences} disabled={isSaving} className="mt-6">
                          {isSaving ? 'Saving...' : 'Save Preferences'}
                          {!isSaving && <Save className="ml-2 h-4 w-4" />}
                      </Button>
                       {saveSuccess && (
                            <p className="mt-2 text-sm text-green-600">Preferences saved!</p>
                        )}
                  </CardContent>
              </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}
