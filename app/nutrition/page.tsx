'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Utensils, AlertCircle } from 'lucide-react';

interface NutritionPlan {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  meals: Meal[];
  selectedFoods: string[];
}

interface Meal {
  name: string;
  foods: {
    name: string;
    portion: string;
    protein: number;
    carbs: number;
    fats: number;
    calories: number;
  }[];
}

const foodDatabase = {
  proteins: [
    { name: 'Chicken Breast', protein: 31, carbs: 0, fats: 3.6, calories: 165, portion: '100g', minPortion: 100, maxPortion: 250 },
    { name: 'Salmon', protein: 25, carbs: 0, fats: 13, calories: 208, portion: '100g', minPortion: 100, maxPortion: 200 },
    { name: 'Egg Whites', protein: 11, carbs: 0, fats: 0, calories: 52, portion: '100g', minPortion: 100, maxPortion: 300 },
    { name: 'Lean Beef', protein: 26, carbs: 0, fats: 15, calories: 250, portion: '100g', minPortion: 100, maxPortion: 200 },
    { name: 'Greek Yogurt', protein: 10, carbs: 4, fats: 0.4, calories: 59, portion: '100g', minPortion: 150, maxPortion: 300 },
    { name: 'Whey Protein', protein: 24, carbs: 3, fats: 1, calories: 120, portion: '30g', minPortion: 25, maxPortion: 40 },
    { name: 'Tuna', protein: 26, carbs: 0, fats: 0.8, calories: 116, portion: '100g', minPortion: 100, maxPortion: 200 },
    { name: 'Turkey Breast', protein: 29, carbs: 0, fats: 1, calories: 135, portion: '100g', minPortion: 100, maxPortion: 250 },
    { name: 'Cottage Cheese', protein: 11, carbs: 3, fats: 4.3, calories: 98, portion: '100g', minPortion: 150, maxPortion: 300 },
    { name: 'Protein Bar', protein: 20, carbs: 25, fats: 8, calories: 250, portion: '60g', minPortion: 40, maxPortion: 80 }
  ],
  carbs: [
    { name: 'Brown Rice', protein: 2.6, carbs: 23, fats: 0.9, calories: 111, portion: '100g', minPortion: 50, maxPortion: 150 },
    { name: 'Sweet Potato', protein: 2, carbs: 20, fats: 0.2, calories: 86, portion: '100g', minPortion: 150, maxPortion: 300 },
    { name: 'Oatmeal', protein: 13, carbs: 68, fats: 7, calories: 389, portion: '100g', minPortion: 40, maxPortion: 80 },
    { name: 'Quinoa', protein: 4.4, carbs: 21, fats: 1.9, calories: 120, portion: '100g', minPortion: 50, maxPortion: 150 },
    { name: 'Banana', protein: 1.1, carbs: 23, fats: 0.3, calories: 89, portion: '100g', minPortion: 100, maxPortion: 150 },
    { name: 'White Rice', protein: 2.7, carbs: 28, fats: 0.3, calories: 130, portion: '100g', minPortion: 50, maxPortion: 150 },
    { name: 'Pasta', protein: 5.8, carbs: 31, fats: 0.9, calories: 158, portion: '100g', minPortion: 50, maxPortion: 150 },
    { name: 'Bread', protein: 9, carbs: 49, fats: 3.2, calories: 265, portion: '100g', minPortion: 30, maxPortion: 90 },
    { name: 'Granola', protein: 8, carbs: 65, fats: 12, calories: 400, portion: '100g', minPortion: 30, maxPortion: 60 },
    { name: 'Rice Cakes', protein: 2, carbs: 14, fats: 0.3, calories: 70, portion: '20g', minPortion: 20, maxPortion: 40 }
  ],
  fats: [
    { name: 'Avocado', protein: 2, carbs: 9, fats: 15, calories: 160, portion: '100g', minPortion: 50, maxPortion: 150 },
    { name: 'Almonds', protein: 21, carbs: 22, fats: 49, calories: 579, portion: '100g', minPortion: 15, maxPortion: 45 },
    { name: 'Olive Oil', protein: 0, carbs: 0, fats: 100, calories: 884, portion: '100g', minPortion: 5, maxPortion: 15 },
    { name: 'Chia Seeds', protein: 17, carbs: 42, fats: 31, calories: 486, portion: '100g', minPortion: 10, maxPortion: 30 },
    { name: 'Peanut Butter', protein: 25, carbs: 20, fats: 50, calories: 588, portion: '100g', minPortion: 15, maxPortion: 45 },
    { name: 'Walnuts', protein: 15, carbs: 14, fats: 65, calories: 654, portion: '100g', minPortion: 15, maxPortion: 45 },
    { name: 'Dark Chocolate', protein: 7.8, carbs: 46, fats: 43, calories: 546, portion: '100g', minPortion: 20, maxPortion: 50 },
    { name: 'Coconut Oil', protein: 0, carbs: 0, fats: 100, calories: 862, portion: '100g', minPortion: 5, maxPortion: 15 },
    { name: 'Eggs', protein: 13, carbs: 1.1, fats: 11, calories: 155, portion: '100g', minPortion: 50, maxPortion: 150 },
    { name: 'MCT Oil', protein: 0, carbs: 0, fats: 100, calories: 900, portion: '100g', minPortion: 5, maxPortion: 15 }
  ],
};

const calculateMacros = (weight: number, height: number, goal: 'bulking' | 'cutting'): NutritionPlan => {
  const bmr = 10 * weight + 6.25 * height - 5 * 25 + 5;
  const tdee = bmr * 1.55;
  const calories = goal === 'bulking' ? tdee + 500 : tdee - 500;
  const protein = weight * 2.2;
  const fats = (calories * 0.25) / 9;
  const carbs = (calories - (protein * 4 + fats * 9)) / 4;

  const meals = generateMeals(calories, protein, carbs, fats, []);

  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fats: Math.round(fats),
    meals,
    selectedFoods: [],
  };
};

const adjustPortion = (food: any, targetProtein: number, targetCarbs: number, targetFats: number) => {
  let scalingFactor = 1;
  
  if (food.protein > 10) {
    scalingFactor = targetProtein / food.protein;
  } else if (food.carbs > 15) {
    scalingFactor = targetCarbs / food.carbs;
  } else if (food.fats > 10) {
    scalingFactor = targetFats / food.fats;
  }

  let portion = Math.round(100 * scalingFactor);

  portion = Math.max(food.minPortion, Math.min(portion, food.maxPortion));

  const actualProtein = Math.round((food.protein * portion) / 100);
  const actualCarbs = Math.round((food.carbs * portion) / 100);
  const actualFats = Math.round((food.fats * portion) / 100);
  const actualCalories = Math.round((food.calories * portion) / 100);

  return {
    portion: `${portion}g`,
    protein: actualProtein,
    carbs: actualCarbs,
    fats: actualFats,
    calories: actualCalories
  };
};

const generateMeals = (calories: number, protein: number, carbs: number, fats: number, selectedFoods: string[]): Meal[] => {
  const mealsCount = 5;
  const mealProtein = protein / mealsCount;
  const mealCarbs = carbs / mealsCount;
  const mealFats = fats / mealsCount;

  const mealNames = [
    'Breakfast',
    'Morning Snack',
    'Lunch',
    'Afternoon Snack',
    'Dinner',
  ];

  const getRandomFood = (category: keyof typeof foodDatabase, selectedFoods: string[]) => {
    const availableFoods = foodDatabase[category].filter(food => 
      selectedFoods.length === 0 || selectedFoods.includes(food.name)
    );
    return availableFoods[Math.floor(Math.random() * availableFoods.length)] || foodDatabase[category][0];
  };

  return mealNames.map(name => {
    const proteinFood = getRandomFood('proteins', selectedFoods);
    const carbFood = getRandomFood('carbs', selectedFoods);
    const fatFood = getRandomFood('fats', selectedFoods);

    const adjustedProteinFood = { ...proteinFood, ...adjustPortion(proteinFood, mealProtein, mealCarbs, mealFats) };
    const adjustedCarbFood = { ...carbFood, ...adjustPortion(carbFood, mealProtein, mealCarbs, mealFats) };
    const adjustedFatFood = { ...fatFood, ...adjustPortion(fatFood, mealProtein, mealCarbs, mealFats) };

    return {
      name,
      foods: [adjustedProteinFood, adjustedCarbFood, adjustedFatFood]
    };
  });
};

export default function NutritionPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [nutritionPlan, setNutritionPlan] = useState<NutritionPlan | null>(null);
  const [selectedFoods, setSelectedFoods] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const user = auth.currentUser;
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserProfile(userData);
          const plan = calculateMacros(userData.weight, userData.height, userData.goal);
          setNutritionPlan(plan);

          const nutritionDoc = await getDoc(doc(db, 'nutrition', user.uid));
          if (nutritionDoc.exists()) {
            const savedFoods = nutritionDoc.data().selectedFoods || [];
            setSelectedFoods(savedFoods);
            const updatedPlan = {
              ...plan,
              meals: generateMeals(plan.calories, plan.protein, plan.carbs, plan.fats, savedFoods)
            };
            setNutritionPlan(updatedPlan);
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [router]);

  const handleFoodPreferenceChange = async (foodName: string) => {
    const newSelectedFoods = selectedFoods.includes(foodName)
      ? selectedFoods.filter((f) => f !== foodName)
      : [...selectedFoods, foodName];

    setSelectedFoods(newSelectedFoods);

    try {
      const user = auth.currentUser;
      if (user && nutritionPlan && userProfile) {
        await setDoc(doc(db, 'nutrition', user.uid), {
          selectedFoods: newSelectedFoods,
        }, { merge: true });

        const updatedPlan = {
          ...nutritionPlan,
          meals: generateMeals(
            nutritionPlan.calories,
            nutritionPlan.protein,
            nutritionPlan.carbs,
            nutritionPlan.fats,
            newSelectedFoods
          )
        };
        setNutritionPlan(updatedPlan);

        toast({
          title: 'Preferences updated',
          description: 'Your meal plan has been updated with your food preferences.',
        });
      }
    } catch (error) {
      console.error('Error saving food preferences:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save food preferences.',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading your nutrition plan...</div>
      </div>
    );
  }

  if (!nutritionPlan) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Card>
          <CardHeader>
            <CardTitle>Error Loading Nutrition Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Unable to load your nutrition plan. Please try again later.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Your Nutrition Plan</h1>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>

        <Alert>
          <Utensils className="h-4 w-4" />
          <AlertTitle>Daily Targets</AlertTitle>
          <AlertDescription>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
              <div>
                <div className="font-semibold">Calories</div>
                <div>{nutritionPlan.calories} kcal</div>
              </div>
              <div>
                <div className="font-semibold">Protein</div>
                <div>{nutritionPlan.protein}g</div>
              </div>
              <div>
                <div className="font-semibold">Carbs</div>
                <div>{nutritionPlan.carbs}g</div>
              </div>
              <div>
                <div className="font-semibold">Fats</div>
                <div>{nutritionPlan.fats}g</div>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="meals" className="space-y-6">
          <TabsList>
            <TabsTrigger value="meals">Meal Plan</TabsTrigger>
            <TabsTrigger value="preferences">Food Preferences</TabsTrigger>
          </TabsList>

          <TabsContent value="meals">
            <div className="space-y-6">
              {nutritionPlan.meals.map((meal, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle>{meal.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {meal.foods.map((food, foodIndex) => (
                        <div key={foodIndex} className="flex justify-between items-center p-4 bg-accent rounded-lg">
                          <div>
                            <div className="font-semibold">{food.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {food.portion}
                            </div>
                          </div>
                          <div className="text-sm">
                            <div>Protein: {food.protein}g</div>
                            <div>Carbs: {food.carbs}g</div>
                            <div>Fats: {food.fats}g</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="preferences">
            <Card>
              <CardHeader>
                <CardTitle>Food Preferences</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Protein Sources</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {foodDatabase.proteins.map((food) => (
                        <div key={food.name} className="flex items-center space-x-2">
                          <Checkbox
                            id={food.name}
                            checked={selectedFoods.includes(food.name)}
                            onCheckedChange={() => handleFoodPreferenceChange(food.name)}
                          />
                          <Label htmlFor={food.name}>{food.name}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4">Carb Sources</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {foodDatabase.carbs.map((food) => (
                        <div key={food.name} className="flex items-center space-x-2">
                          <Checkbox
                            id={food.name}
                            checked={selectedFoods.includes(food.name)}
                            onCheckedChange={() => handleFoodPreferenceChange(food.name)}
                          />
                          <Label htmlFor={food.name}>{food.name}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4">Fat Sources</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {foodDatabase.fats.map((food) => (
                        <div key={food.name} className="flex items-center space-x-2">
                          <Checkbox
                            id={food.name}
                            checked={selectedFoods.includes(food.name)}
                            onCheckedChange={() => handleFoodPreferenceChange(food.name)}
                          />
                          <Label htmlFor={food.name}>{food.name}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
