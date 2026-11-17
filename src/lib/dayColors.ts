/** One colour per day (or per city), shared by the route image and the plan map. */
export const DAY_COLORS = ["#e11d48", "#2563eb", "#059669", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4f46e5", "#0d9488", "#b45309", "#9333ea", "#16a34a"];

export const dayColor = (i: number) => DAY_COLORS[((i % DAY_COLORS.length) + DAY_COLORS.length) % DAY_COLORS.length];
