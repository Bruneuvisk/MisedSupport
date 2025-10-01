// Curva estilo MEE6 (aproximação bem usada):
// XP para passar do level L -> L+1: 5*L^2 + 50*L + 100
export function xpForNextLevel(level: number): number {
  return 5 * level * level + 50 * level + 100;
}

export function addXpAndCalcLevel(currentXp: number, currentLevel: number, gain: number) {
  let xp = currentXp + gain;
  let level = currentLevel;
  let leveledUp = false;

  while (xp >= xpForNextLevel(level)) {
    xp -= xpForNextLevel(level);
    level++;
    leveledUp = true;
  }
  return { xp, level, leveledUp };
}
