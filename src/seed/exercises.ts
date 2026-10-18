import type { Exercise, LoadMode, Measure } from '@/db/types';

export interface LibraryEntry {
  id: string;
  name: string;
  category: string;
  equipment: string;
  level: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
}

const PER_SIDE =
  /one[- ]arm|single[- ]arm|single[- ]leg|one[- ]legged|alternat|lunge|split squat|step[- ]?up/i;
const SINGLE_IMPLEMENT = /one[- ]arm|single[- ]arm|goblet/i;

function inferMeasure(e: LibraryEntry): Measure {
  if (e.category === 'cardio') return 'time';
  if (['body only', 'bands', 'other', 'exercise ball'].includes(e.equipment)) return 'reps';
  return 'weight_reps';
}

function inferLoadMode(e: LibraryEntry): LoadMode {
  switch (e.equipment) {
    case 'dumbbell':
    case 'kettlebells':
      return 'per_implement';
    case 'barbell':
    case 'e-z curl bar':
    case 'medicine ball':
      return 'total';
    case 'cable':
    case 'machine':
      return 'stack';
    case 'body only':
      return 'added';
    default:
      return 'none';
  }
}

export function fromLibrary(e: LibraryEntry): Exercise {
  const loadMode = inferLoadMode(e);
  const twoImplements =
    (e.equipment === 'dumbbell' && !SINGLE_IMPLEMENT.test(e.name)) ||
    (e.equipment === 'kettlebells' && /double/i.test(e.name));
  return {
    id: e.id,
    name: e.name,
    aliases: [],
    category: e.category,
    equipment: e.equipment,
    primaryMuscles: e.primaryMuscles,
    secondaryMuscles: e.secondaryMuscles,
    instructions: e.instructions,
    images: e.images,
    measure: inferMeasure(e),
    loadMode,
    perSide: PER_SIDE.test(e.name),
    implements: twoImplements ? 2 : 1,
    source: 'library',
    updatedAt: 0,
  };
}

/**
 * Correzioni agli esercizi di libreria usati nelle schede del coach:
 * nome italiano, nomi "coloriti" del coach come alias, convenzioni di carico.
 */
export const LIBRARY_OVERRIDES: Record<string, Partial<Exercise>> = {
  'plyo-push-up': { nameIt: 'Piegamenti esplosivi', aliases: ['Explosive Push ups'] },
  pullups: { nameIt: 'Trazioni presa prona', aliases: ['Pull ups'] },
  'push-up-wide': { nameIt: 'Piegamenti presa larga', aliases: ['Wide Push ups'] },
  'chin-up': { nameIt: 'Trazioni presa supina', aliases: ['Chin ups'] },
  pushups: { nameIt: 'Piegamenti', aliases: ['Push ups'] },
  'push-ups-close-triceps-position': {
    nameIt: 'Piegamenti presa stretta',
    aliases: ['Close Push ups'],
  },
  'hanging-leg-raise': { nameIt: 'Alzate gambe alla sbarra', aliases: ['Hanging Leg Raises'] },
  'flutter-kicks': { nameIt: 'Sforbiciate', aliases: ['Flutter Kick Abs Low'], measure: 'time' },
  'side-lateral-raise': {
    nameIt: 'Alzate laterali',
    aliases: ['Dumbbell Lateral Raise'],
  },
  'dumbbell-incline-row': {
    nameIt: 'Rematore con manubri su panca inclinata',
    aliases: ['Inverted Row su panca', 'Chest Supported Dumbbell Row'],
  },
  'barbell-hip-thrust': { nameIt: 'Hip thrust', aliases: ['Hip Trust', 'Hip Thrust'] },
  'goblet-squat': {
    nameIt: 'Goblet squat',
    aliases: [],
    equipment: 'dumbbell',
    implements: 1,
  },
  'sumo-deadlift': { nameIt: 'Stacco sumo', aliases: [] },
  'stiff-legged-dumbbell-deadlift': {
    nameIt: 'Stacco rumeno con manubri',
    aliases: ['Dumbell Romanian Deadlift', 'Dumbbell Romanian Deadlift'],
  },
  'bent-over-barbell-row': {
    nameIt: 'Rematore con bilanciere',
    aliases: ['Close Barbell Row'],
  },
  'ab-roller': { nameIt: 'Ruota addominale', aliases: ['Ab Wheel Rollout'], loadMode: 'none' },
  superman: {
    nameIt: 'Superman',
    aliases: ['Superman Back Extensions'],
    measure: 'time',
  },
  'rope-jumping': { nameIt: 'Salto della corda', aliases: ['Jump Rope'] },
  'seated-leg-tucks': {
    nameIt: 'Raccolte gambe da seduto',
    aliases: ['Knee to Leg Abs'],
    measure: 'time_reps',
  },
};

type CustomInput = Omit<
  Exercise,
  | 'source'
  | 'updatedAt'
  | 'aliases'
  | 'secondaryMuscles'
  | 'instructions'
  | 'images'
  | 'perSide'
  | 'implements'
> &
  Partial<
    Pick<
      Exercise,
      'aliases' | 'secondaryMuscles' | 'instructions' | 'images' | 'perSide' | 'implements'
    >
  >;

const custom = (e: CustomInput): Exercise => ({
  aliases: [],
  secondaryMuscles: [],
  instructions: [],
  images: [],
  perSide: false,
  implements: 1,
  ...e,
  source: 'custom',
  updatedAt: 0,
});

/** Esercizi reali usati dal coach che non sono nella libreria. */
export const CUSTOM_EXERCISES: Exercise[] = [
  custom({
    id: 'bulgarian-split-squat',
    name: 'Bulgarian Split Squat',
    nameIt: 'Affondi bulgari',
    category: 'strength',
    equipment: 'dumbbell',
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: ['glutes', 'hamstrings'],
    images: [
      'exercises/split-squat-with-dumbbells/0.webp',
      'exercises/split-squat-with-dumbbells/1.webp',
    ],
    measure: 'weight_reps',
    loadMode: 'per_implement',
    perSide: true,
    implements: 2,
  }),
  custom({
    id: 'dumbbell-jump-squat',
    name: 'Dumbbell Jump Squat',
    nameIt: 'Squat jump con manubri',
    aliases: ['Dumbbell Squat Jumps'],
    category: 'plyometrics',
    equipment: 'dumbbell',
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: ['glutes', 'calves'],
    images: ['exercises/freehand-jump-squat/0.webp', 'exercises/freehand-jump-squat/1.webp'],
    measure: 'weight_reps',
    loadMode: 'per_implement',
    implements: 2,
  }),
  custom({
    id: 'dumbbell-rear-delt-row',
    name: 'Dumbbell Rear Delt Row',
    nameIt: 'Rematore deltoide posteriore con manubri',
    category: 'strength',
    equipment: 'dumbbell',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['middle back', 'traps'],
    measure: 'weight_reps',
    loadMode: 'per_implement',
    implements: 2,
  }),
  custom({
    id: 'lying-leg-raise',
    name: 'Lying Leg Raise',
    nameIt: 'Alzate gambe a terra',
    aliases: ['Ground Leg Lift'],
    category: 'strength',
    equipment: 'body only',
    primaryMuscles: ['abdominals'],
    images: [
      'exercises/flat-bench-lying-leg-raise/0.webp',
      'exercises/flat-bench-lying-leg-raise/1.webp',
    ],
    measure: 'reps',
    loadMode: 'added',
  }),
  custom({
    id: 'lying-windshield-wipers',
    name: 'Lying Windshield Wipers',
    nameIt: 'Tergicristalli a terra',
    aliases: ['Ground Windshield Wipers'],
    category: 'strength',
    equipment: 'body only',
    primaryMuscles: ['abdominals'],
    measure: 'time',
    loadMode: 'none',
  }),
  custom({
    id: 'hollow-body-hold',
    name: 'Hollow Body Hold',
    nameIt: 'Hollow body',
    aliases: ['Hollow Body Abs'],
    category: 'strength',
    equipment: 'body only',
    primaryMuscles: ['abdominals'],
    measure: 'weight_time',
    loadMode: 'added',
  }),
  custom({
    id: 'plank-arm-leg-raise',
    name: 'Plank with Arm and Leg Raise',
    nameIt: 'Plank con alzata braccio e gamba opposti',
    aliases: ['Superman Plank'],
    category: 'strength',
    equipment: 'body only',
    primaryMuscles: ['abdominals'],
    secondaryMuscles: ['lower back', 'glutes', 'shoulders'],
    images: ['exercises/plank/0.webp'],
    measure: 'time',
    loadMode: 'none',
  }),
  custom({
    id: 'forearm-plank-arm-leg-raise',
    name: 'Forearm Plank with Arm and Leg Raise',
    nameIt: 'Plank sui gomiti con alzata braccio e gamba',
    aliases: ['Elbow Superman Plank'],
    category: 'strength',
    equipment: 'body only',
    primaryMuscles: ['abdominals'],
    secondaryMuscles: ['lower back', 'glutes'],
    images: ['exercises/plank/0.webp'],
    measure: 'time',
    loadMode: 'none',
  }),
  custom({
    id: 'v-sit-hold',
    name: 'V-Sit Hold',
    nameIt: 'Tenuta a V',
    aliases: ['Ground Sit'],
    category: 'strength',
    equipment: 'body only',
    primaryMuscles: ['abdominals'],
    measure: 'time',
    loadMode: 'added',
  }),
  custom({
    id: 'weighted-side-plank',
    name: 'Weighted Side Plank',
    nameIt: 'Plank laterale con sovraccarico',
    aliases: ['Side Plank Lift'],
    category: 'strength',
    equipment: 'body only',
    primaryMuscles: ['abdominals'],
    images: ['exercises/side-bridge/0.webp', 'exercises/side-bridge/1.webp'],
    measure: 'weight_time',
    loadMode: 'added',
    perSide: true,
  }),
  custom({
    id: 'side-lying-leg-raise',
    name: 'Side-Lying Leg Raise',
    nameIt: 'Abduzioni da sdraiato su un fianco',
    aliases: ['Side Leg Raises'],
    category: 'strength',
    equipment: 'body only',
    primaryMuscles: ['abductors'],
    secondaryMuscles: ['glutes'],
    measure: 'time',
    loadMode: 'none',
    perSide: true,
  }),
  custom({
    id: 'feet-elevated-hamstring-bridge',
    name: 'Feet-Elevated Hamstring Bridge',
    nameIt: 'Ponte femorali con piedi rialzati',
    aliases: ['Elevated Feet Harmstring Bridge'],
    category: 'strength',
    equipment: 'body only',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['glutes'],
    images: ['exercises/butt-lift-bridge/0.webp', 'exercises/butt-lift-bridge/1.webp'],
    measure: 'time',
    loadMode: 'added',
  }),
  custom({
    id: 'double-crunch',
    name: 'Double Crunch',
    nameIt: 'Crunch doppio',
    category: 'strength',
    equipment: 'body only',
    primaryMuscles: ['abdominals'],
    measure: 'reps',
    loadMode: 'added',
  }),
  custom({
    id: 'dive-bomber-push-up',
    name: 'Dive Bomber Push-Up',
    nameIt: 'Piegamenti dive bomber',
    aliases: ['Dive V-Push ups'],
    category: 'strength',
    equipment: 'body only',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['shoulders', 'triceps'],
    measure: 'reps',
    loadMode: 'added',
  }),
  custom({
    id: 'kneeling-one-arm-triceps-extension',
    name: 'Kneeling One-Arm Triceps Extension',
    nameIt: 'Estensione tricipite a un braccio in ginocchio',
    aliases: ['Knees One Arm Triceps Extensions'],
    category: 'strength',
    equipment: 'bands',
    primaryMuscles: ['triceps'],
    measure: 'reps',
    loadMode: 'none',
    perSide: true,
  }),
  custom({
    id: 'fit-boxing',
    name: 'Fit Boxing',
    nameIt: 'Fit boxing',
    category: 'cardio',
    equipment: 'other',
    primaryMuscles: ['shoulders'],
    measure: 'time',
    loadMode: 'none',
  }),
];
