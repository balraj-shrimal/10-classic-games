import React, { useEffect, useRef, useState } from 'react';
import { sound } from '../utils/audio';
import { RotateCcw, Zap } from 'lucide-react';

interface SlitherProps {
  onGameOver: (score: number) => void;
  isPaused: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface Snake {
  id: number;
  name: string;
  isPlayer: boolean;
  x: number;
  y: number;
  angle: number;
  speed: number;
  targetAngle: number;
  length: number;
  body: Point[];
  color: string;
  alive: boolean;
  isBoosting: boolean;
}

interface Pellet {
  x: number;
  y: number;
  radius: number;
  color: string;
  value: number;
}

const ARENA_RADIUS = 900;

export const SlitherIoGame: React.FC<SlitherProps> = ({ onGameOver, isPaused }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(10);
  const [rank, setRank] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [isBoosting, setIsBoosting] = useState(false);

  const stateRef = useRef({
    player: null as Snake | null,
    snakes: [] as Snake[],
    pellets: [] as Pellet[],
    mousePos: { x: 0, y: 0 },
    score: 10,
    isBoosting: false,
  });

  const restartGame = () => {
    initGame();
    setGameOver(false);
  };

  const initGame = () => {
    // Generate pellets
    const pellets: Pellet[] = [];
    const colors = ['#f43f5e', '#38bdf8', '#4ade80', '#facc15', '#a855f7', '#fb923c'];
    for (let i = 0; i < 450; i++) {
      const dist = Math.random() * (ARENA_RADIUS - 40);
      const ang = Math.random() * Math.PI * 2;
      pellets.push({
        x: Math.cos(ang) * dist,
        y: Math.sin(ang) * dist,
        radius: 2.5 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        value: 1,
      });
    }

    // Player
    const player: Snake = {
      id: 0,
      name: 'You',
      isPlayer: true,
      x: 0,
      y: 0,
      angle: 0,
      targetAngle: 0,
      speed: 3.2,
      length: 20,
      body: Array.from({ length: 20 }, () => ({ x: 0, y: 0 })),
      color: '#10b981',
      alive: true,
      isBoosting: false,
    };

    // AI Snakes
    const aiColors = ['#ec4899', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
    const aiNames = ['Viper', 'Python', 'Hydra', 'Cobra', 'Naga', 'Basilisk'];
    const snakes: Snake[] = [player];

    for (let i = 0; i < 6; i++) {
      const dist = 250 + Math.random() * (ARENA_RADIUS - 350);
      const ang = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
      const sx = Math.cos(ang) * dist;
      const sy = Math.sin(ang) * dist;
      const len = 18 + Math.floor(Math.random() * 35);
      snakes.push({
        id: i + 1,
        name: aiNames[i],
        isPlayer: false,
        x: sx,
        y: sy,
        angle: Math.random() * Math.PI * 2,
        targetAngle: Math.random() * Math.PI * 2,
        speed: 2.8,
        length: len,
        body: Array.from({ length: len }, () => ({ x: sx, y: sy })),
        color: aiColors[i],
        alive: true,
        isBoosting: false,
      });
    }

    stateRef.current.player = player;
    stateRef.current.snakes = snakes;
    stateRef.current.pellets = pellets;
    stateRef.current.score = 20;
    setScore(20);
  };

  useEffect(() => {
    initGame();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsBoosting(true);
        stateRef.current.isBoosting = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsBoosting(false);
        stateRef.current.isBoosting = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Main Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const mx = e.clientX - rect.left - centerX;
      const my = e.clientY - rect.top - centerY;
      stateRef.current.mousePos = { x: mx, y: my };
    };

    const handlePointerDown = () => {
      setIsBoosting(true);
      stateRef.current.isBoosting = true;
    };
    const handlePointerUp = () => {
      setIsBoosting(false);
      stateRef.current.isBoosting = false;
    };

    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    const loop = () => {
      if (!isPaused && !gameOver) {
        const s = stateRef.current;
        const player = s.player;

        if (player && player.alive) {
          // Steer player towards cursor
          player.targetAngle = Math.atan2(s.mousePos.y, s.mousePos.x);
          player.isBoosting = s.isBoosting && player.length > 10;
        }

        // Update all snakes
        s.snakes.forEach((snake) => {
          if (!snake.alive) return;

          // AI behavior
          if (!snake.isPlayer) {
            // Find nearest pellet
            let nearestPellet: Pellet | null = null;
            let minDist = 220;
            s.pellets.forEach((pellet) => {
              const d = Math.hypot(pellet.x - snake.x, pellet.y - snake.y);
              if (d < minDist) {
                minDist = d;
                nearestPellet = pellet;
              }
            });

            if (nearestPellet) {
              snake.targetAngle = Math.atan2(
                (nearestPellet as Pellet).y - snake.y,
                (nearestPellet as Pellet).x - snake.x
              );
            } else if (Math.random() < 0.03) {
              snake.targetAngle += (Math.random() - 0.5) * 1.5;
            }

            // Boundary avoidance
            const distFromCenter = Math.hypot(snake.x, snake.y);
            if (distFromCenter > ARENA_RADIUS - 120) {
              snake.targetAngle = Math.atan2(-snake.y, -snake.x);
            }
          }

          // Smooth turn
          let diff = snake.targetAngle - snake.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          snake.angle += diff * 0.12;

          // Boost speed & mass shedding
          const currentSpeed = snake.isBoosting ? 5.8 : 3.0;
          snake.speed = currentSpeed;

          if (snake.isBoosting && Math.random() < 0.25 && snake.length > 10) {
            snake.length -= 0.15;
            const tail = snake.body[snake.body.length - 1];
            s.pellets.push({
              x: tail.x,
              y: tail.y,
              radius: 3,
              color: snake.color,
              value: 1,
            });
          }

          // Move head
          snake.x += Math.cos(snake.angle) * snake.speed;
          snake.y += Math.sin(snake.angle) * snake.speed;

          // Update body joints
          snake.body.unshift({ x: snake.x, y: snake.y });
          const targetJoints = Math.floor(snake.length);
          while (snake.body.length > targetJoints) {
            snake.body.pop();
          }

          // Check Arena Boundary Collision
          if (Math.hypot(snake.x, snake.y) > ARENA_RADIUS) {
            snake.alive = false;
            // Spawn pellets on death
            snake.body.forEach((pt, idx) => {
              if (idx % 2 === 0) {
                s.pellets.push({
                  x: pt.x + (Math.random() - 0.5) * 10,
                  y: pt.y + (Math.random() - 0.5) * 10,
                  radius: 4.5,
                  color: snake.color,
                  value: 3,
                });
              }
            });

            if (snake.isPlayer) {
              sound.playExplosion();
              sound.playGameOver();
              setGameOver(true);
              onGameOver(Math.floor(snake.length * 10));
            }
          }

          // Eat Pellets
          s.pellets = s.pellets.filter((pellet) => {
            const dist = Math.hypot(snake.x - pellet.x, snake.y - pellet.y);
            if (dist < 18 + pellet.radius) {
              snake.length += pellet.value * 0.4;
              if (snake.isPlayer) {
                s.score = Math.floor(snake.length * 10);
                setScore(s.score);
                sound.playCoin();
              }
              return false;
            }
            return true;
          });

          // Head-to-Body Collisions with other snakes
          s.snakes.forEach((other) => {
            if (other.id === snake.id || !other.alive) return;

            // Check if snake head collides with other snake's body
            for (let i = 2; i < other.body.length; i++) {
              const bpt = other.body[i];
              const dist = Math.hypot(snake.x - bpt.x, snake.y - bpt.y);
              if (dist < 14) {
                // Snake dies!
                snake.alive = false;
                sound.playExplosion();

                // Drop mass
                snake.body.forEach((pt, idx) => {
                  if (idx % 2 === 0) {
                    s.pellets.push({
                      x: pt.x + (Math.random() - 0.5) * 12,
                      y: pt.y + (Math.random() - 0.5) * 12,
                      radius: 5,
                      color: snake.color,
                      value: 3,
                    });
                  }
                });

                if (snake.isPlayer) {
                  sound.playGameOver();
                  setGameOver(true);
                  onGameOver(Math.floor(snake.length * 10));
                }
                break;
              }
            }
          });
        });

        // Respawn AI snakes periodically
        s.snakes = s.snakes.filter((sn) => sn.alive || sn.isPlayer);
        if (s.snakes.length < 6) {
          const aiColors = ['#ec4899', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
          const aiNames = ['Viper', 'Python', 'Hydra', 'Cobra', 'Naga', 'Basilisk'];
          const newId = Math.floor(Math.random() * 1000) + 10;
          const ang = Math.random() * Math.PI * 2;
          const dist = 300 + Math.random() * (ARENA_RADIUS - 400);
          const sx = Math.cos(ang) * dist;
          const sy = Math.sin(ang) * dist;
          s.snakes.push({
            id: newId,
            name: aiNames[Math.floor(Math.random() * aiNames.length)],
            isPlayer: false,
            x: sx,
            y: sy,
            angle: Math.random() * Math.PI * 2,
            targetAngle: Math.random() * Math.PI * 2,
            speed: 2.8,
            length: 20 + Math.floor(Math.random() * 25),
            body: Array.from({ length: 20 }, () => ({ x: sx, y: sy })),
            color: aiColors[Math.floor(Math.random() * aiColors.length)],
            alive: true,
            isBoosting: false,
          });
        }

        // Leaderboard rank
        if (player) {
          const sorted = [...s.snakes].sort((a, b) => b.length - a.length);
          const myRank = sorted.findIndex((sn) => sn.isPlayer) + 1;
          setRank(myRank);
        }
      }

      // RENDER
      const s = stateRef.current;
      const player = s.player;
      if (!player) return;

      const camX = player.x;
      const camY = player.y;

      ctx.fillStyle = '#050714';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(canvas.width / 2 - camX, canvas.height / 2 - camY);

      // Arena boundary ring
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 10;
      ctx.shadowColor = '#dc2626';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, ARENA_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Hexagonal / Grid backdrop lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      const gridSize = 80;
      const startX = Math.floor((camX - canvas.width / 2) / gridSize) * gridSize;
      const endX = startX + canvas.width + gridSize;
      const startY = Math.floor((camY - canvas.height / 2) / gridSize) * gridSize;
      const endY = startY + canvas.height + gridSize;

      for (let x = startX; x <= endX; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
      }
      for (let y = startY; y <= endY; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
      }

      // Draw Pellets
      s.pellets.forEach((pellet) => {
        // Frustum cull
        if (
          pellet.x < camX - canvas.width / 2 - 20 ||
          pellet.x > camX + canvas.width / 2 + 20 ||
          pellet.y < camY - canvas.height / 2 - 20 ||
          pellet.y > camY + canvas.height / 2 + 20
        ) {
          return;
        }

        ctx.fillStyle = pellet.color;
        ctx.beginPath();
        ctx.arc(pellet.x, pellet.y, pellet.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Snakes
      s.snakes.forEach((snake) => {
        if (!snake.alive) return;

        // Draw body segments (from tail to head)
        for (let i = snake.body.length - 1; i >= 0; i--) {
          const pt = snake.body[i];
          const radius = Math.max(5, 10 + (snake.length > 50 ? 4 : 0));
          ctx.fillStyle = snake.color;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw Head & Eyes
        ctx.fillStyle = snake.color;
        ctx.beginPath();
        ctx.arc(snake.x, snake.y, 12, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        const eyeOffset = 6;
        const eyeDist = 6;
        const eye1X = snake.x + Math.cos(snake.angle + 0.6) * eyeDist;
        const eye1Y = snake.y + Math.sin(snake.angle + 0.6) * eyeDist;
        const eye2X = snake.x + Math.cos(snake.angle - 0.6) * eyeDist;
        const eye2Y = snake.y + Math.sin(snake.angle - 0.6) * eyeDist;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, 3.5, 0, Math.PI * 2);
        ctx.arc(eye2X, eye2Y, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(eye1X + Math.cos(snake.angle) * 1.2, eye1Y + Math.sin(snake.angle) * 1.2, 1.8, 0, Math.PI * 2);
        ctx.arc(eye2X + Math.cos(snake.angle) * 1.2, eye2Y + Math.sin(snake.angle) * 1.2, 1.8, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();

      // Mini-map radar on bottom-right
      const mapRadius = 38;
      const mapX = canvas.width - mapRadius - 14;
      const mapY = canvas.height - mapRadius - 14;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mapX, mapY, mapRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Snakes on radar
      s.snakes.forEach((sn) => {
        if (!sn.alive) return;
        const rX = mapX + (sn.x / ARENA_RADIUS) * (mapRadius - 4);
        const rY = mapY + (sn.y / ARENA_RADIUS) * (mapRadius - 4);
        ctx.fillStyle = sn.isPlayer ? '#10b981' : '#ef4444';
        ctx.beginPath();
        ctx.arc(rX, rY, sn.isPlayer ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isPaused, gameOver, onGameOver]);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
      {/* Top HUD */}
      <div className="flex items-center justify-between w-full px-4 py-2 bg-slate-900/90 rounded-t-xl border border-slate-800 backdrop-blur-sm text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">LENGTH</span>
          <span className="text-emerald-400 font-bold text-lg tabular-nums">{score}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">LEADERBOARD</span>
          <span className="text-amber-300 font-bold tabular-nums">#{rank}</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative border-x border-b border-slate-800 rounded-b-xl overflow-hidden shadow-2xl bg-black">
        <canvas
          ref={canvasRef}
          width={420}
          height={460}
          className="block touch-none cursor-crosshair"
        />

        {gameOver && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <h3 className="text-2xl font-black text-rose-500 mb-1 tracking-wider">CRASHED!</h3>
            <p className="text-sm text-slate-300 mb-4">You ran into another snake or the perimeter.</p>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-6 w-48">
              <span className="text-xs text-slate-400">Final Length</span>
              <div className="text-2xl font-extrabold text-emerald-400">{score}</div>
            </div>
            <button
              onClick={restartGame}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold shadow-lg hover:brightness-110 active:scale-95 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Slither Again
            </button>
          </div>
        )}
      </div>

      {/* Touch Boost Button for Mobile */}
      <div className="mt-4 w-full px-4 sm:hidden">
        <button
          onPointerDown={() => {
            setIsBoosting(true);
            stateRef.current.isBoosting = true;
          }}
          onPointerUp={() => {
            setIsBoosting(false);
            stateRef.current.isBoosting = false;
          }}
          className="w-full h-14 bg-emerald-600 active:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg"
        >
          <Zap className="w-5 h-5 fill-current" />
          HOLD TO BOOST SPEED
        </button>
      </div>
    </div>
  );
};
