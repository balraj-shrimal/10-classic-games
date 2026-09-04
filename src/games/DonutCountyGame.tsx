import React, { useEffect, useRef, useState } from 'react';
import { sound } from '../utils/audio';
import { RotateCcw, Trophy } from 'lucide-react';

interface DonutCountyProps {
  onGameOver: (score: number) => void;
  isPaused: boolean;
}

interface CountyObject {
  id: number;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  sizeReq: number; // required hole radius to swallow
  points: number;
  color: string;
  shape: 'box' | 'circle' | 'donut';
  falling: boolean;
  fallScale: number;
  swallowed: boolean;
}

export const DonutCountyGame: React.FC<DonutCountyProps> = ({ onGameOver, isPaused }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [swallowedCount, setSwallowedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [levelClear, setLevelClear] = useState(false);

  const stateRef = useRef({
    hole: {
      x: 200,
      y: 250,
      targetX: 200,
      targetY: 250,
      radius: 24, // starts small
      maxRadius: 110,
    },
    objects: [] as CountyObject[],
    score: 0,
    swallowed: 0,
  });

  const initGame = () => {
    // Generate a charming collection of items of varying sizes
    const items: CountyObject[] = [
      // Small items (radius req: 22-30)
      { id: 1, name: 'Donut', x: 120, y: 150, vx: 0, vy: 0, width: 18, height: 18, sizeReq: 22, points: 10, color: '#ec4899', shape: 'donut', falling: false, fallScale: 1, swallowed: false },
      { id: 2, name: 'Soda Can', x: 280, y: 160, vx: 0, vy: 0, width: 14, height: 20, sizeReq: 22, points: 10, color: '#ef4444', shape: 'box', falling: false, fallScale: 1, swallowed: false },
      { id: 3, name: 'Apple', x: 190, y: 180, vx: 0, vy: 0, width: 16, height: 16, sizeReq: 22, points: 10, color: '#dc2626', shape: 'circle', falling: false, fallScale: 1, swallowed: false },
      { id: 4, name: 'Coffee Cup', x: 90, y: 260, vx: 0, vy: 0, width: 16, height: 18, sizeReq: 22, points: 10, color: '#f59e0b', shape: 'box', falling: false, fallScale: 1, swallowed: false },
      { id: 5, name: 'Frog', x: 310, y: 240, vx: 0, vy: 0, width: 18, height: 16, sizeReq: 24, points: 15, color: '#22c55e', shape: 'circle', falling: false, fallScale: 1, swallowed: false },
      { id: 6, name: 'Donut', x: 220, y: 110, vx: 0, vy: 0, width: 18, height: 18, sizeReq: 22, points: 10, color: '#ec4899', shape: 'donut', falling: false, fallScale: 1, swallowed: false },
      { id: 7, name: 'Radio', x: 70, y: 180, vx: 0, vy: 0, width: 22, height: 18, sizeReq: 26, points: 20, color: '#64748b', shape: 'box', falling: false, fallScale: 1, swallowed: false },

      // Medium items (radius req: 35-50)
      { id: 8, name: 'Trash Can', x: 320, y: 320, vx: 0, vy: 0, width: 26, height: 34, sizeReq: 35, points: 30, color: '#475569', shape: 'box', falling: false, fallScale: 1, swallowed: false },
      { id: 9, name: 'Campfire', x: 150, y: 310, vx: 0, vy: 0, width: 32, height: 28, sizeReq: 38, points: 35, color: '#ea580c', shape: 'circle', falling: false, fallScale: 1, swallowed: false },
      { id: 10, name: 'Mailbox', x: 70, y: 350, vx: 0, vy: 0, width: 24, height: 36, sizeReq: 36, points: 30, color: '#3b82f6', shape: 'box', falling: false, fallScale: 1, swallowed: false },
      { id: 11, name: 'Bicycle', x: 240, y: 260, vx: 0, vy: 0, width: 44, height: 26, sizeReq: 42, points: 40, color: '#06b6d4', shape: 'box', falling: false, fallScale: 1, swallowed: false },
      { id: 12, name: 'Park Bench', x: 120, y: 400, vx: 0, vy: 0, width: 48, height: 28, sizeReq: 46, points: 45, color: '#854d0e', shape: 'box', falling: false, fallScale: 1, swallowed: false },

      // Large items (radius req: 55-80)
      { id: 13, name: 'Picnic Table', x: 280, y: 410, vx: 0, vy: 0, width: 58, height: 42, sizeReq: 56, points: 60, color: '#a16207', shape: 'box', falling: false, fallScale: 1, swallowed: false },
      { id: 14, name: 'Pine Tree', x: 60, y: 90, vx: 0, vy: 0, width: 46, height: 75, sizeReq: 62, points: 75, color: '#15803d', shape: 'circle', falling: false, fallScale: 1, swallowed: false },
      { id: 15, name: 'Pickup Truck', x: 290, y: 80, vx: 0, vy: 0, width: 72, height: 44, sizeReq: 70, points: 90, color: '#e11d48', shape: 'box', falling: false, fallScale: 1, swallowed: false },

      // Huge Boss item (radius req: 85)
      { id: 16, name: 'County Diner', x: 190, y: 470, vx: 0, vy: 0, width: 95, height: 65, sizeReq: 85, points: 150, color: '#f43f5e', shape: 'box', falling: false, fallScale: 1, swallowed: false },
    ];

    stateRef.current = {
      hole: {
        x: 200,
        y: 250,
        targetX: 200,
        targetY: 250,
        radius: 24,
        maxRadius: 100,
      },
      objects: items,
      score: 0,
      swallowed: 0,
    };

    setScore(0);
    setSwallowedCount(0);
    setTotalCount(items.length);
    setLevelClear(false);
  };

  const restartGame = () => {
    initGame();
  };

  useEffect(() => {
    initGame();
  }, []);

  // Main Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateHolePos = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const h = stateRef.current.hole;
      h.targetX = clientX - rect.left;
      h.targetY = clientY - rect.top;
    };

    const handlePointerMove = (e: PointerEvent) => {
      updateHolePos(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        updateHolePos(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: true });

    const loop = () => {
      if (!isPaused) {
        const s = stateRef.current;
        const h = s.hole;

        // Smooth hole movement
        h.x += (h.targetX - h.x) * 0.2;
        h.y += (h.targetY - h.y) * 0.2;

        // Clamp inside canvas
        h.x = Math.max(h.radius, Math.min(canvas.width - h.radius, h.x));
        h.y = Math.max(h.radius, Math.min(canvas.height - h.radius, h.y));

        // Physics & Swallow Checks
        s.objects.forEach((obj) => {
          if (obj.swallowed) return;

          const dist = Math.hypot(obj.x - h.x, obj.y - h.y);

          if (!obj.falling) {
            // If near hole rim and hole is big enough
            if (dist < h.radius) {
              if (h.radius >= obj.sizeReq) {
                // Sucking into hole!
                obj.falling = true;
                sound.playSlice();
              } else {
                // Object too big! Teeter on edge, nudge away gently
                const pushAng = Math.atan2(obj.y - h.y, obj.x - h.x);
                obj.x = h.x + Math.cos(pushAng) * (h.radius + 4);
                obj.y = h.y + Math.sin(pushAng) * (h.radius + 4);
              }
            }
          } else {
            // Spiral / fall into center
            obj.x += (h.x - obj.x) * 0.2;
            obj.y += (h.y - obj.y) * 0.2;
            obj.fallScale *= 0.85;

            if (obj.fallScale < 0.1) {
              // Completely swallowed!
              obj.swallowed = true;
              s.swallowed++;
              s.score += obj.points;
              // Expand hole!
              h.radius = Math.min(h.maxRadius, h.radius + 4.5);

              setScore(s.score);
              setSwallowedCount(s.swallowed);
              sound.playCoin();

              // Check if all swallowed
              if (s.swallowed >= s.objects.length) {
                setLevelClear(true);
                sound.playPowerup();
                onGameOver(s.score);
              }
            }
          }
        });
      }

      // RENDER
      const s = stateRef.current;
      const h = s.hole;

      // County Pastel Grass Ground
      ctx.fillStyle = '#a7f3d0'; // Gentle mint pastel county lawn
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Cute grassy lawn patterns
      ctx.fillStyle = '#6ee7b7';
      for (let i = 0; i < 40; i++) {
        const gx = (i * 47) % canvas.width;
        const gy = (i * 83) % canvas.height;
        ctx.beginPath();
        ctx.arc(gx, gy, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render Objects (not falling)
      s.objects.forEach((obj) => {
        if (obj.swallowed || obj.falling) return;
        renderObject(ctx, obj, 1);
      });

      // Render The Hole
      // Hole depth / gradient rim
      ctx.fillStyle = '#0f172a'; // Bottomless abyss
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, h.radius, h.radius * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hole edge rim outline
      ctx.strokeStyle = '#047857';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Inner depth shadow
      ctx.strokeStyle = '#022c22';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(h.x, h.y - 2, h.radius - 2, (h.radius - 2) * 0.85, 0, 0, Math.PI);
      ctx.stroke();

      // Render Falling Objects (drawn inside the hole)
      s.objects.forEach((obj) => {
        if (obj.falling && !obj.swallowed) {
          renderObject(ctx, obj, obj.fallScale);
        }
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isPaused, onGameOver]);

  const renderObject = (ctx: CanvasRenderingContext2D, obj: CountyObject, scale: number) => {
    ctx.save();
    ctx.translate(obj.x, obj.y);
    ctx.scale(scale, scale);

    const w = obj.width;
    const h = obj.height;

    // Drop Shadow
    if (!obj.falling) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.ellipse(0, h / 2 + 2, w * 0.6, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (obj.shape === 'donut') {
      // Donut
      ctx.fillStyle = '#fde047'; // Dough
      ctx.beginPath();
      ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
      ctx.fill();
      // Pink frosting
      ctx.fillStyle = '#ec4899';
      ctx.beginPath();
      ctx.arc(0, 0, w / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
      // Hole in center
      ctx.fillStyle = obj.falling ? '#0f172a' : '#a7f3d0';
      ctx.beginPath();
      ctx.arc(0, 0, w / 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (obj.shape === 'circle') {
      ctx.fillStyle = obj.color;
      ctx.beginPath();
      ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      // Box
      ctx.fillStyle = obj.color;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Label if large enough
    if (scale > 0.8) {
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(obj.name, 0, -h / 2 - 4);
    }

    ctx.restore();
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
      {/* Top HUD */}
      <div className="flex items-center justify-between w-full px-4 py-2 bg-slate-900/90 rounded-t-xl border border-slate-800 backdrop-blur-sm text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">HOLE SIZE</span>
          <span className="text-pink-400 font-bold text-lg tabular-nums">
            {Math.round(stateRef.current.hole.radius)}mm
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">SWALLOWED</span>
          <span className="text-emerald-400 font-bold tabular-nums">
            {swallowedCount} / {totalCount}
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative border-x border-b border-slate-800 rounded-b-xl overflow-hidden shadow-2xl bg-black">
        <canvas
          ref={canvasRef}
          width={400}
          height={480}
          className="block touch-none cursor-move"
        />

        {levelClear && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <Trophy className="w-12 h-12 text-yellow-400 mb-2 animate-bounce" />
            <h3 className="text-2xl font-black text-pink-400 mb-1 tracking-wider">COUNTY SWALLOWED!</h3>
            <p className="text-sm text-slate-300 mb-4">You devoured every single object in town!</p>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-6 w-48">
              <span className="text-xs text-slate-400">Total Score</span>
              <div className="text-2xl font-extrabold text-pink-400">{score} pts</div>
            </div>
            <button
              onClick={restartGame}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white font-semibold shadow-lg hover:brightness-110 active:scale-95 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Swallow Again
            </button>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-400 text-center">
        Drag the hole across the county. Swallow small items first to expand your hole!
      </p>
    </div>
  );
};
