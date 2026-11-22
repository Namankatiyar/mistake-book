export type Chapter = { id: string; name: string };
export type Subject = { id: string; name: string; chapters: Chapter[] };

export const SYLLABUS: Subject[] = [
  {
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
  },
  {
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
  },
  {
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
  },
];

export function subjectById(id: string): Subject | undefined {
  return SYLLABUS.find((s) => s.id === id);
}

export function chapterById(chapterId: string): Chapter | undefined {
  for (const s of SYLLABUS) {
    const c = s.chapters.find((ch) => ch.id === chapterId);
    if (c) return c;
  }
  return undefined;
}

export function subjectOfChapter(chapterId: string): Subject | undefined {
  return SYLLABUS.find((s) => s.chapters.some((c) => c.id === chapterId));
}

export function isValidChapter(subjectId: string, chapterId: string): boolean {
  return !!subjectById(subjectId)?.chapters.some((c) => c.id === chapterId);
}
