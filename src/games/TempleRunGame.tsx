import React, { useEffect, useRef, useState } from 'react';
import { sound } from '../utils/audio';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';

interface TempleRunProps {
  onGameOver: (score: number) => void;
  isPaused: boolean;
}

type TurnType = 'left' | 'right' | 'none';

interface Segment {
  z: number;
  type: 'straight' | 'corner_left' | 'corner_right';
  hasRoot?: boolean;
  hasFire?: boolean;
  hasCoins?: boolean;
}

export const TempleRunGame: React.FC<TempleRunProps> = ({ onGameOver, isPaused }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const stateRef = useRef({
    player: {
      lateralX: 0, // -1 to 1 across pathway width
      y: 0, // jump height
      vy: 0,
      isSliding: false,
      slideTimer: 0,
      runFrame: 0,
    },
    distance: 0,
    speed: 7.0,
    coinsCount: 0,
    segments: [] as Segment[],
    nextCornerZ: 600,
    cornerType: 'corner_left' as 'corner_left' | 'corner_right',
    monkeyDistance: 80, // distance behind player
  });

  const steer = (dx: number) => {
    const p = stateRef.current.player;
    p.lateralX = Math.max(-0.8, Math.min(0.8, p.lateralX + dx * 0.4));
  };

  const turn = (dir: 'left' | 'right') => {
    const s = stateRef.current;
    // Check if at corner window
    if (s.nextCornerZ >= 0 && s.nextCornerZ <= 100) {
      if (
        (dir === 'left' && s.cornerType === 'corner_left') ||
        (dir === 'right' && s.cornerType === 'corner_right')
      ) {
        // Successful turn!
        sound.playPowerup();
        s.nextCornerZ = 500 + Math.random() * 400;
        s.cornerType = Math.random() < 0.5 ? 'corner_left' : 'corner_right';
        s.score += 50;
        setScore(s.score);
        return;
      }
    }
    // Also steer slightly if not exactly on corner
    steer(dir === 'left' ? -1 : 1);
  };

  const jump = () => {
    const p = stateRef.current.player;
    if (p.y === 0 && !p.isSliding) {
      p.vy = 11;
      sound.playJump();
    }
  };

  const slide = () => {
    const p = stateRef.current.player;
    if (p.y > 0) p.vy = -12;
    p.isSliding = true;
    p.slideTimer = 32;
  };

  const restartGame = () => {
    stateRef.current = {
      player: {
        lateralX: 0,
        y: 0,
        vy: 0,
        isSliding: false,
        slideTimer: 0,
        runFrame: 0,
      },
      distance: 0,
      speed: 7.0,
      coinsCount: 0,
      segments: [],
      nextCornerZ: 600,
      cornerType: 'corner_left',
      monkeyDistance: 80,
    };
    setScore(0);
    setCoins(0);
    setGameOver(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        turn('left');
        e.preventDefault();
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        turn('right');
        e.preventDefault();
      } else if (['ArrowUp', 'KeyW'].includes(e.code)) {
        jump();
        e.preventDefault();
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        slide();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Main Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 30) turn('right');
        else if (dx < -30) turn('left');
      } else {
        if (dy < -30) jump();
        else if (dy > 30) slide();
      }
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: true });

    const loop = () => {
      if (!isPaused && !gameOver) {
        const s = stateRef.current;
        const p = s.player;

        s.distance += s.speed;
        setScore(Math.floor(s.distance / 10) + s.coinsCount * 10);
        p.runFrame = (p.runFrame + 0.3) % (Math.PI * 2);

        // Jump physics
        if (p.vy !== 0 || p.y > 0) {
          p.y += p.vy;
          p.vy -= 0.65;
          if (p.y <= 0) {
            p.y = 0;
            p.vy = 0;
          }
        }

        // Slide timer
        if (p.isSliding) {
          p.slideTimer--;
          if (p.slideTimer <= 0) p.isSliding = false;
        }

        // Corner countdown
        s.nextCornerZ -= s.speed;

        // If player overshot corner without turning
        if (s.nextCornerZ < -20) {
          sound.playExplosion();
          sound.playGameOver();
          setGameOver(true);
          onGameOver(Math.floor(s.distance / 10) + s.coinsCount * 10);
        }

        // Spawn periodic obstacles
        if (s.segments.length < 6 && Math.random() < 0.035) {
          const lastZ = s.segments.length > 0 ? s.segments[s.segments.length - 1].z : 0;
          if (800 - lastZ > 180 && Math.abs(800 - s.nextCornerZ) > 100) {
            const isFire = Math.random() < 0.45;
            s.segments.push({
              z: 800,
              type: 'straight',
              hasFire: isFire,
              hasRoot: !isFire,
              hasCoins: Math.random() < 0.5,
            });
          }
        }

        // Update Obstacles
        s.segments.forEach((seg) => {
          seg.z -= s.speed;

          // Collision Check
          if (seg.z >= 20 && seg.z <= 60) {
            if (seg.hasRoot && p.y < 30) {
              // Failed to jump tree root!
              sound.playExplosion();
              sound.playGameOver();
              setGameOver(true);
              onGameOver(Math.floor(s.distance / 10) + s.coinsCount * 10);
            } else if (seg.hasFire && !p.isSliding) {
              // Failed to slide under fire trap!
              sound.playExplosion();
              sound.playGameOver();
              setGameOver(true);
              onGameOver(Math.floor(s.distance / 10) + s.coinsCount * 10);
            } else if (seg.hasCoins) {
              seg.hasCoins = false;
              s.coinsCount += 3;
              setCoins(s.coinsCount);
              sound.playCoin();
            }
          }
        });
        s.segments = s.segments.filter((seg) => seg.z > 0);
      }

      // RENDER (Pseudo 3D Temple View)
      const s = stateRef.current;
      const p = s.player;

      const horizonY = 170;
      const centerX = canvas.width / 2;

      // Ancient Jungle Canopy Backdrop
      ctx.fillStyle = '#14281d'; // Deep jungle green
      ctx.fillRect(0, 0, canvas.width, horizonY);
      // Chasm mist
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, horizonY, canvas.width, canvas.height - horizonY);

      // Perspective Projection
      const project = (xOffset: number, z: number, yOffset: number = 0) => {
        const factor = 140 / (z + 140);
        const roadWidth = 20 + 260 * factor;
        const screenX = centerX + xOffset * roadWidth * 0.5;
        const screenY = horizonY + (canvas.height - horizonY) * factor - yOffset * factor;
        return { x: screenX, y: screenY, factor, width: roadWidth };
      };

      // Draw Ancient Stone Road Segments
      for (let z = 900; z >= 20; z -= 30) {
        const p1 = project(0, z);
        const p2 = project(0, z - 30);

        ctx.fillStyle = (Math.floor(z / 30) + Math.floor(s.distance / 30)) % 2 === 0 ? '#78716c' : '#57534e';
        ctx.beginPath();
        ctx.moveTo(p1.x - p1.width / 2, p1.y);
        ctx.lineTo(p1.x + p1.width / 2, p1.y);
        ctx.lineTo(p2.x + p2.width / 2, p2.y);
        ctx.lineTo(p2.x - p2.width / 2, p2.y);
        ctx.closePath();
        ctx.fill();

        // Stone boundary walls
        ctx.fillStyle = '#44403c';
        ctx.fillRect(p1.x - p1.width / 2 - 4, p1.y - 12 * p1.factor, 5, 12 * p1.factor);
        ctx.fillRect(p1.x + p1.width / 2 - 1, p1.y - 12 * p1.factor, 5, 12 * p1.factor);
      }

      // Draw Upcoming 90-degree Corner Wall Junction
      if (s.nextCornerZ > 0 && s.nextCornerZ < 800) {
        const cp = project(0, s.nextCornerZ);
        ctx.fillStyle = '#b45309';
        // Red corner warning banner
        ctx.fillRect(cp.x - cp.width / 2, cp.y - 45 * cp.factor, cp.width, 10 * cp.factor);

        // Draw arrow pointing turn direction
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(10, Math.floor(22 * cp.factor))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(s.cornerType === 'corner_left' ? '◀ TURN' : 'TURN ▶', cp.x, cp.y - 15 * cp.factor);
      }

      // Draw Obstacles
      s.segments.forEach((seg) => {
        const pos = project(0, seg.z);

        if (seg.hasRoot) {
          // Twisted ancient root hurdle
          ctx.fillStyle = '#713f12';
          ctx.beginPath();
          ctx.roundRect(
            pos.x - pos.width * 0.45,
            pos.y - 22 * pos.factor,
            pos.width * 0.9,
            16 * pos.factor,
            4
          );
          ctx.fill();
        } else if (seg.hasFire) {
          // Flaming Stone Arch
          ctx.strokeStyle = '#44403c';
          ctx.lineWidth = Math.max(2, 8 * pos.factor);
          ctx.beginPath();
          ctx.arc(pos.x, pos.y - 20 * pos.factor, pos.width * 0.42, Math.PI, 0);
          ctx.stroke();

          // Fire flames
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(pos.x, pos.y - 42 * pos.factor, pos.width * 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(pos.x, pos.y - 42 * pos.factor, pos.width * 0.1, 0, Math.PI * 2);
          ctx.fill();
        }

        // Floating Gold Coins
        if (seg.hasCoins) {
          const coinPos = project(0, seg.z, 25);
          ctx.fillStyle = '#eab308';
          ctx.beginPath();
          ctx.arc(coinPos.x, coinPos.y, 8 * coinPos.factor, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw Demon Monkey Shadow Chasing closely Behind
      const monkeyY = canvas.height - 20;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.ellipse(centerX, monkeyY, 65, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      // Glowing yellow monkey eyes
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(centerX - 16, monkeyY - 12, 4, 0, Math.PI * 2);
      ctx.arc(centerX + 16, monkeyY - 12, 4, 0, Math.PI * 2);
      ctx.fill();

      // Draw Guy Dangerous (Over-the-shoulder hero)
      const playerPos = project(p.lateralX, 35, p.y);
      const pw = 42 * playerPos.factor;
      const ph = p.isSliding ? 22 * playerPos.factor : 68 * playerPos.factor;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(playerPos.x, canvas.height - 50, pw * 0.8, pw * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();

      // Explorer Vest & Shirt
      ctx.fillStyle = '#d97706'; // Tan jacket
      ctx.fillRect(playerPos.x - pw * 0.35, playerPos.y - ph * 0.75, pw * 0.7, ph * 0.45);
      // Head / Hair
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.arc(playerPos.x, playerPos.y - ph * 0.85, pw * 0.3, 0, Math.PI * 2);
      ctx.fill();
      // Legs
      ctx.fillStyle = '#1c1917';
      const legRun = Math.sin(p.runFrame) * 8;
      ctx.fillRect(playerPos.x - pw * 0.28, playerPos.y - ph * 0.3, pw * 0.24, ph * 0.3 + legRun);
      ctx.fillRect(playerPos.x + pw * 0.04, playerPos.y - ph * 0.3, pw * 0.24, ph * 0.3 - legRun);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPaused, gameOver, onGameOver]);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
      {/* Top HUD */}
      <div className="flex items-center justify-between w-full px-4 py-2 bg-slate-900/90 rounded-t-xl border border-slate-800 backdrop-blur-sm text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">METERS</span>
          <span className="text-amber-400 font-bold text-lg tabular-nums">
            {Math.floor(stateRef.current.distance / 10)}m
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">COINS</span>
          <span className="text-yellow-300 font-bold tabular-nums">★ {coins}</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative border-x border-b border-slate-800 rounded-b-xl overflow-hidden shadow-2xl bg-black">
        <canvas
          ref={canvasRef}
          width={400}
          height={480}
          className="block touch-none"
        />

        {gameOver && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <h3 className="text-2xl font-black text-rose-500 mb-1 tracking-wider">CAUGHT!</h3>
            <p className="text-sm text-slate-300 mb-4">You fell from the temple or hit a trap.</p>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-6 w-48">
              <span className="text-xs text-slate-400">Score</span>
              <div className="text-2xl font-extrabold text-amber-400">{score} pts</div>
            </div>
            <button
              onClick={restartGame}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 text-white font-semibold shadow-lg hover:brightness-110 active:scale-95 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Escape Again
            </button>
          </div>
        )}
      </div>

      {/* Mobile Touch Controls */}
      <div className="mt-4 grid grid-cols-3 gap-2 w-52 sm:hidden select-none">
        <div />
        <button
          onClick={jump}
          className="h-12 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-slate-200 active:bg-amber-500 active:text-white"
        >
          <ArrowUp className="w-6 h-6" />
        </button>
        <div />
        <button
          onClick={() => turn('left')}
          className="h-12 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-slate-200 active:bg-amber-500 active:text-white"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <button
          onClick={slide}
          className="h-12 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-slate-200 active:bg-amber-500 active:text-white"
        >
          <ArrowDown className="w-6 h-6" />
        </button>
        <button
          onClick={() => turn('right')}
          className="h-12 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-slate-200 active:bg-amber-500 active:text-white"
        >
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
