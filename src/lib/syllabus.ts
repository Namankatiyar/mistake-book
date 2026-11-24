export type Chapter = { id: string; name: string };
export type Subject = { id: string; name: string; chapters: Chapter[] };

export type ExamMode = "jee" | "neet";

export const PHYSICS_SUBJECT: Subject = {
  id: "phy",
  name: "Physics",
  chapters: [
    { id: "phy-units", name: "Units and measurements" },
    { id: "phy-kinematics", name: "Kinematics" },
    { id: "phy-laws", name: "Laws of motion" },
    { id: "phy-work", name: "Work, energy and power" },
    { id: "phy-com", name: "Centre of mass and collisions" },
    { id: "phy-rotation", name: "Rotational motion" },
    { id: "phy-gravitation", name: "Gravitation" },
    { id: "phy-solids", name: "Mechanical properties of solids" },
    { id: "phy-fluids", name: "Mechanical properties of fluids" },
    { id: "phy-thermal", name: "Thermal properties of matter" },
    { id: "phy-thermo", name: "Thermodynamics" },
    { id: "phy-ktg", name: "Kinetic theory of gases" },
    { id: "phy-oscillations", name: "Oscillations" },
    { id: "phy-waves", name: "Waves" },
    { id: "phy-electrostatics", name: "Electrostatics" },
    { id: "phy-capacitance", name: "Capacitance" },
    { id: "phy-current", name: "Current electricity" },
    { id: "phy-magnetism", name: "Moving charges and magnetism" },
    { id: "phy-matter", name: "Magnetism and matter" },
    { id: "phy-emi", name: "Electromagnetic induction" },
    { id: "phy-ac", name: "Alternating current" },
    { id: "phy-emwaves", name: "Electromagnetic waves" },
    { id: "phy-ray", name: "Ray optics" },
    { id: "phy-waveoptics", name: "Wave optics" },
    { id: "phy-dual", name: "Dual nature of matter and radiation" },
    { id: "phy-atoms", name: "Atoms" },
    { id: "phy-nuclei", name: "Nuclei" },
    { id: "phy-semiconductor", name: "Semiconductor electronics" },
    { id: "phy-experimental", name: "Experimental physics" },
  ],
};

export const CHEMISTRY_SUBJECT: Subject = {
  id: "chem",
  name: "Chemistry",
  chapters: [
    { id: "chem-mole", name: "Some basic concepts of chemistry" },
    { id: "chem-atomic", name: "Atomic structure" },
    { id: "chem-bonding", name: "Chemical bonding" },
    { id: "chem-thermo", name: "Chemical thermodynamics" },
    { id: "chem-equilibrium", name: "Equilibrium" },
    { id: "chem-redox", name: "Redox reactions" },
    { id: "chem-solutions", name: "Solutions" },
    { id: "chem-electrochem", name: "Electrochemistry" },
    { id: "chem-kinetics", name: "Chemical kinetics" },
    { id: "chem-periodic", name: "Classification of elements and periodicity" },
    { id: "chem-pblock", name: "p-block elements" },
    { id: "chem-dblock", name: "d- and f-block elements" },
    { id: "chem-coordination", name: "Coordination compounds" },
    { id: "chem-goc", name: "Organic chemistry: basic principles" },
    { id: "chem-hydrocarbons", name: "Hydrocarbons" },
    { id: "chem-halo", name: "Haloalkanes and haloarenes" },
    { id: "chem-alcohols", name: "Alcohols, phenols and ethers" },
    { id: "chem-carbonyl", name: "Aldehydes, ketones and carboxylic acids" },
    { id: "chem-amines", name: "Amines" },
    { id: "chem-biomolecules", name: "Biomolecules" },
    { id: "chem-practical", name: "Purification and characterisation" },
  ],
};

export const MATHEMATICS_SUBJECT: Subject = {
  id: "math",
  name: "Mathematics",
  chapters: [
    { id: "math-sets", name: "Sets, relations and functions" },
    { id: "math-trig", name: "Trigonometry" },
    { id: "math-inverse", name: "Inverse trigonometry" },
    { id: "math-complex", name: "Complex numbers" },
    { id: "math-quadratic", name: "Quadratic equations" },
    { id: "math-matrices", name: "Matrices and determinants" },
    { id: "math-pnc", name: "Permutations and combinations" },
    { id: "math-binomial", name: "Binomial theorem" },
    { id: "math-sequence", name: "Sequence and series" },
    { id: "math-limits", name: "Limits, continuity and differentiability" },
    { id: "math-aod", name: "Applications of derivatives" },
    { id: "math-integration", name: "Integral calculus" },
    { id: "math-diffeq", name: "Differential equations" },
    { id: "math-straight", name: "Straight lines" },
    { id: "math-circles", name: "Circles" },
    { id: "math-conics", name: "Conic sections" },
    { id: "math-3d", name: "Three dimensional geometry" },
    { id: "math-vectors", name: "Vector algebra" },
    { id: "math-stats", name: "Statistics" },
    { id: "math-probability", name: "Probability" },
  ],
};

export const BIOLOGY_SUBJECT: Subject = {
  id: "bio",
  name: "Biology",
  chapters: [
    // Class 11 - Unit I: Diversity in the Living World
    { id: "bio-living-world", name: "The living world" },
    { id: "bio-classification", name: "Biological classification" },
    { id: "bio-plant-kingdom", name: "Plant kingdom" },
    { id: "bio-animal-kingdom", name: "Animal kingdom" },

    // Class 11 - Unit II: Structural Organisation in Animals and Plants
    { id: "bio-plant-morphology", name: "Morphology of flowering plants" },
    { id: "bio-plant-anatomy", name: "Anatomy of flowering plants" },
    { id: "bio-animal-tissues", name: "Structural organisation in animals" },

    // Class 11 - Unit III: Cell: Structure and Function
    { id: "bio-cell-unit", name: "Cell: the unit of life" },
    { id: "bio-biomolecules", name: "Biomolecules" },
    { id: "bio-cell-cycle", name: "Cell cycle and cell division" },

    // Class 11 - Unit IV: Plant Physiology
    { id: "bio-transport", name: "Transport in plants" },
    { id: "bio-mineral", name: "Mineral nutrition" },
    { id: "bio-photosynthesis", name: "Photosynthesis in higher plants" },
    { id: "bio-respiration-plants", name: "Respiration in plants" },
    { id: "bio-plant-growth", name: "Plant growth and development" },

    // Class 11 - Unit V: Human Physiology
    { id: "bio-digestion", name: "Digestion and absorption" },
    { id: "bio-breathing", name: "Breathing and exchange of gases" },
    { id: "bio-circulation", name: "Body fluids and circulation" },
    { id: "bio-excretion", name: "Excretory products and their elimination" },
    { id: "bio-locomotion", name: "Locomotion and movement" },
    { id: "bio-neural", name: "Neural control and coordination" },
    { id: "bio-chemical-coord", name: "Chemical coordination and integration" },

    // Class 12 - Unit VI: Reproduction
    { id: "bio-reproduction-organisms", name: "Reproduction in organisms" },
    { id: "bio-plant-reproduction", name: "Sexual reproduction in flowering plants" },
    { id: "bio-human-reproduction", name: "Human reproduction" },
    { id: "bio-reproductive-health", name: "Reproductive health" },

    // Class 12 - Unit VII: Genetics and Evolution
    { id: "bio-genetics-inheritance", name: "Principles of inheritance and variation" },
    { id: "bio-genetics-molecular", name: "Molecular basis of inheritance" },
    { id: "bio-evolution", name: "Evolution" },

    // Class 12 - Unit VIII: Biology and Human Welfare
    { id: "bio-human-health", name: "Human health and disease" },
    { id: "bio-food-production", name: "Strategies for enhancement in food production" },
    { id: "bio-microbes", name: "Microbes in human welfare" },

    // Class 12 - Unit IX: Biotechnology and Its Applications
    { id: "bio-biotech-principles", name: "Biotechnology: principles and processes" },
    { id: "bio-biotech-applications", name: "Biotechnology and its applications" },

    // Class 12 - Unit X: Ecology and Environment
    { id: "bio-organisms-populations", name: "Organisms and populations" },
    { id: "bio-ecosystem", name: "Ecosystem" },
    { id: "bio-biodiversity", name: "Biodiversity and conservation" },
    { id: "bio-environmental-issues", name: "Environmental issues" },
  ],
};

export const JEE_SYLLABUS: Subject[] = [
  PHYSICS_SUBJECT,
  CHEMISTRY_SUBJECT,
  MATHEMATICS_SUBJECT,
];

export const NEET_SYLLABUS: Subject[] = [
  PHYSICS_SUBJECT,
  CHEMISTRY_SUBJECT,
  BIOLOGY_SUBJECT,
];

export const ALL_SUBJECTS: Subject[] = [
  PHYSICS_SUBJECT,
  CHEMISTRY_SUBJECT,
  MATHEMATICS_SUBJECT,
  BIOLOGY_SUBJECT,
];

export function getSyllabus(mode: ExamMode): Subject[] {
  return mode === "neet" ? NEET_SYLLABUS : JEE_SYLLABUS;
}

/** Default export for backwards compatibility */
export const SYLLABUS: Subject[] = JEE_SYLLABUS;

export function subjectById(id: string): Subject | undefined {
  return ALL_SUBJECTS.find((s) => s.id === id);
}

export function chapterById(chapterId: string): Chapter | undefined {
  for (const s of ALL_SUBJECTS) {
    const c = s.chapters.find((ch) => ch.id === chapterId);
    if (c) return c;
  }
  return undefined;
}

export function subjectOfChapter(chapterId: string): Subject | undefined {
  return ALL_SUBJECTS.find((s) => s.chapters.some((c) => c.id === chapterId));
}

export function isValidChapter(subjectId: string, chapterId: string): boolean {
  return !!subjectById(subjectId)?.chapters.some((c) => c.id === chapterId);
}
