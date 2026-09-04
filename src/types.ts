export type GameId =
  | 'pacman-256'
  | 'crossy-road'
  | 'altos-adventure'
  | 'jetpack-joyride'
  | 'subway-surfers'
  | 'fruit-ninja'
  | 'slither-io'
  | 'doodle-jump'
  | 'temple-run'
  | 'donut-county';

export interface GameInfo {
  id: GameId;
  title: string;
  tagline: string;
  description: string;
  category: 'Arcade' | 'Runner' | 'Action' | 'Physics' | 'Classic';
  icon: string; // Lucide icon
  emoji: string; // Vibrant arcade emoji
  accentColor: string; // Tailwind color class
  bgGradient: string;
  borderColor: string; // e.g. border-yellow-500
  shadowClass: string; // e.g. shadow-[6px_6px_0px_0px_rgba(234,179,8,1)]
  iconBg: string; // e.g. bg-yellow-100
  textColor: string; // e.g. text-yellow-600
  btnBg: string; // e.g. bg-yellow-500
  controlsInfo: {
    desktop: string;
    mobile: string;
  };
}

export interface GameScoreRecord {
  highScore: number;
  gamesPlayed: number;
  lastPlayed: number; // timestamp
}

export type AllScores = Record<GameId, GameScoreRecord>;

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
}
