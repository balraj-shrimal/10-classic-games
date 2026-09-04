import { AllScores, GameId, GameScoreRecord } from '../types';

const STORAGE_KEY = 'arcade_10_scores';

const INITIAL_SCORES: AllScores = {
  'pacman-256': { highScore: 0, gamesPlayed: 0, lastPlayed: 0 },
  'crossy-road': { highScore: 0, gamesPlayed: 0, lastPlayed: 0 },
  'altos-adventure': { highScore: 0, gamesPlayed: 0, lastPlayed: 0 },
  'jetpack-joyride': { highScore: 0, gamesPlayed: 0, lastPlayed: 0 },
  'subway-surfers': { highScore: 0, gamesPlayed: 0, lastPlayed: 0 },
  'fruit-ninja': { highScore: 0, gamesPlayed: 0, lastPlayed: 0 },
  'slither-io': { highScore: 0, gamesPlayed: 0, lastPlayed: 0 },
  'doodle-jump': { highScore: 0, gamesPlayed: 0, lastPlayed: 0 },
  'temple-run': { highScore: 0, gamesPlayed: 0, lastPlayed: 0 },
  'donut-county': { highScore: 0, gamesPlayed: 0, lastPlayed: 0 },
};

export function getScores(): AllScores {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...INITIAL_SCORES };
    const parsed = JSON.parse(raw);
    return { ...INITIAL_SCORES, ...parsed };
  } catch {
    return { ...INITIAL_SCORES };
  }
}

export function saveScore(
  gameId: GameId,
  score: number
): { isNewHigh: boolean; highScore: number } {
  const scores = getScores();
  const current = scores[gameId] || { highScore: 0, gamesPlayed: 0, lastPlayed: 0 };
  const isNewHigh = score > current.highScore;
  const newHighScore = Math.max(current.highScore, score);

  const updatedRecord: GameScoreRecord = {
    highScore: newHighScore,
    gamesPlayed: current.gamesPlayed + 1,
    lastPlayed: Date.now(),
  };

  scores[gameId] = updatedRecord;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  } catch (e) {
    console.error('Failed to save scores to localStorage', e);
  }

  return { isNewHigh, highScore: newHighScore };
}

export function resetScores(): AllScores {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
  return { ...INITIAL_SCORES };
}

export const storage = {
  getScores,
  saveScore,
  resetScores,
  getHighScore: (gameId: GameId) => {
    const scores = getScores();
    return scores[gameId]?.highScore || 0;
  },
  saveHighScore: (gameId: GameId, score: number) => {
    return saveScore(gameId, score);
  },
  getAllHighScores: (): Record<string, number> => {
    const scores = getScores();
    const result: Record<string, number> = {};
    for (const key in scores) {
      result[key] = scores[key as GameId]?.highScore || 0;
    }
    return result;
  },
};

