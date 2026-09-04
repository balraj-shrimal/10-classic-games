import React from 'react';
import {
  Ghost,
  Car,
  Mountain,
  Zap,
  Flame,
  CircleDot,
  ChevronsUp,
  Footprints,
  Disc,
  Train,
  Gamepad2,
} from 'lucide-react';

interface GameIconProps {
  name: string;
  className?: string;
}

export const GameIcon: React.FC<GameIconProps> = ({ name, className = 'w-6 h-6' }) => {
  switch (name) {
    case 'Ghost':
      return <Ghost className={className} />;
    case 'Car':
      return <Car className={className} />;
    case 'Mountain':
      return <Mountain className={className} />;
    case 'Zap':
      return <Zap className={className} />;
    case 'Train':
    case 'TrainTrack':
      return <Train className={className} />;
    case 'Flame':
      return <Flame className={className} />;
    case 'CircleDot':
      return <CircleDot className={className} />;
    case 'ChevronsUp':
      return <ChevronsUp className={className} />;
    case 'Footprints':
      return <Footprints className={className} />;
    case 'Disc':
      return <Disc className={className} />;
    default:
      return <Gamepad2 className={className} />;
  }
};
