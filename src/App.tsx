import React, { useState, useEffect } from 'react';
import { GAMES_DATA } from './data/games';
import { GameId, GameInfo } from './types';
import { storage } from './utils/storage';
import { sound } from './utils/audio';
import { usePWAInstall, useOnlineStatus } from './hooks/usePWAInstall';
import { GameIcon } from './components/GameIcon';
import { ControlsGuide } from './components/ControlsGuide';

// Games
import { PacmanGame } from './games/PacmanGame';
import { CrossyRoadGame } from './games/CrossyRoadGame';
import { AltosAdventureGame } from './games/AltosAdventureGame';
import { JetpackJoyrideGame } from './games/JetpackJoyrideGame';
import { SubwaySurfersGame } from './games/SubwaySurfersGame';
import { FruitNinjaGame } from './games/FruitNinjaGame';
import { SlitherIoGame } from './games/SlitherIoGame';
import { DoodleJumpGame } from './games/DoodleJumpGame';
import { TempleRunGame } from './games/TempleRunGame';
import { DonutCountyGame } from './games/DonutCountyGame';

import {
  Gamepad2,
  ArrowLeft,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Download,
  Search,
  Trophy,
} from 'lucide-react';

export default function App() {
  const [activeGameId, setActiveGameId] = useState<GameId | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [highScores, setHighScores] = useState<Record<string, number>>({});
  const { isInstallable, install: installApp } = usePWAInstall();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    setHighScores(storage.getAllHighScores());
  }, []);

  const handleSelectGame = (id: GameId) => {
    setActiveGameId(id);
    setIsPaused(false);
    sound.playPowerup();
  };

  const handleBackToMenu = () => {
    setActiveGameId(null);
    setIsPaused(false);
    setHighScores(storage.getAllHighScores());
  };

  const handleToggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const handleGameOver = (score: number) => {
    if (activeGameId) {
      storage.saveHighScore(activeGameId, score);
      setHighScores(storage.getAllHighScores());
    }
  };

  const activeGame = GAMES_DATA.find((g) => g.id === activeGameId);

  const categories = ['All', 'Arcade', 'Runner', 'Action', 'Physics', 'Classic'];

  const filteredGames = GAMES_DATA.filter((game) => {
    const matchesCategory = selectedCategory === 'All' || game.category === selectedCategory;
    const matchesSearch =
      game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.tagline.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalScore = Object.values(highScores).reduce<number>(
    (acc, curr) => acc + (Number(curr) || 0),
    0
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-yellow-400 selection:text-black">
      {/* Vibrant Palette Header */}
      <header className="h-20 bg-yellow-400 border-b-4 border-black flex items-center justify-between px-4 sm:px-8 shrink-0 z-50 sticky top-0">
        <div className="flex items-center gap-3">
          {activeGameId ? (
            <button
              onClick={handleBackToMenu}
              className="bg-black text-white hover:bg-white hover:text-black border-2 border-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-2 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>All Games</span>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <div className="w-4 h-4 bg-yellow-400 rounded-full animate-pulse" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black italic tracking-tighter text-black">
                ARCADE.IO
              </h1>
            </div>
          )}
        </div>

        <div className="flex gap-2 sm:gap-4 items-center">
          {/* Total Score / High Score Pill */}
          <div className="bg-white border-2 border-black px-3.5 py-1 rounded-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hidden md:flex items-center">
            <span className="text-xs font-bold uppercase text-slate-800">Total Score</span>
            <span className="ml-2 font-black text-blue-600 tabular-nums">
              {totalScore.toLocaleString()}
            </span>
          </div>

          {/* Offline Mode Indicator */}
          <div className="bg-black text-white px-3 sm:px-4 py-1.5 rounded-full flex items-center gap-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <div
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-green-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest">
              {isOnline ? 'Offline Mode Ready' : 'Offline Active'}
            </span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            className="w-9 h-9 bg-white border-2 border-black rounded-lg flex items-center justify-center text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-200 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-600" /> : <Volume2 className="w-4 h-4 text-black" />}
          </button>

          {/* PWA Install */}
          {isInstallable && (
            <button
              onClick={installApp}
              className="bg-black text-white hover:bg-white hover:text-black border-2 border-black px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hidden sm:flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
        {activeGame ? (
          /* Active Game Playing Cabinet */
          <div className="w-full max-w-2xl mx-auto flex flex-col items-center animate-in fade-in duration-200">
            {/* Cabinet Top Header */}
            <div className="w-full flex items-center justify-between mb-4 bg-white border-4 border-black rounded-2xl p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{activeGame.emoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black uppercase tracking-tight text-black italic">
                      {activeGame.title}
                    </h2>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-black text-yellow-400">
                      {activeGame.category}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase">{activeGame.tagline}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="bg-yellow-100 border-2 border-black px-3 py-1 rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-yellow-700" />
                  <span className="font-black text-xs text-black tabular-nums">
                    {highScores[activeGame.id] || 0}
                  </span>
                </div>

                <button
                  onClick={() => setIsPaused(!isPaused)}
                  title={isPaused ? 'Resume Game' : 'Pause Game'}
                  className="w-9 h-9 bg-yellow-400 border-2 border-black rounded-xl flex items-center justify-center text-black font-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-300 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Game Canvas Box */}
            <div className="w-full flex justify-center border-4 border-black rounded-2xl overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-black">
              {activeGame.id === 'pacman-256' && (
                <PacmanGame onGameOver={handleGameOver} isPaused={isPaused} />
              )}
              {activeGame.id === 'crossy-road' && (
                <CrossyRoadGame onGameOver={handleGameOver} isPaused={isPaused} />
              )}
              {activeGame.id === 'altos-adventure' && (
                <AltosAdventureGame onGameOver={handleGameOver} isPaused={isPaused} />
              )}
              {activeGame.id === 'jetpack-joyride' && (
                <JetpackJoyrideGame onGameOver={handleGameOver} isPaused={isPaused} />
              )}
              {activeGame.id === 'subway-surfers' && (
                <SubwaySurfersGame onGameOver={handleGameOver} isPaused={isPaused} />
              )}
              {activeGame.id === 'fruit-ninja' && (
                <FruitNinjaGame onGameOver={handleGameOver} isPaused={isPaused} />
              )}
              {activeGame.id === 'slither-io' && (
                <SlitherIoGame onGameOver={handleGameOver} isPaused={isPaused} />
              )}
              {activeGame.id === 'doodle-jump' && (
                <DoodleJumpGame onGameOver={handleGameOver} isPaused={isPaused} />
              )}
              {activeGame.id === 'temple-run' && (
                <TempleRunGame onGameOver={handleGameOver} isPaused={isPaused} />
              )}
              {activeGame.id === 'donut-county' && (
                <DonutCountyGame onGameOver={handleGameOver} isPaused={isPaused} />
              )}
            </div>

            {/* Controls Guide */}
            <ControlsGuide game={activeGame} />
          </div>
        ) : (
          /* Vibrant Palette 10 Game Selection Grid */
          <div className="space-y-6">
            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2">
              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
                      selectedCategory === cat
                        ? 'bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 text-black absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="SEARCH 10 GAMES..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border-2 border-black rounded-full pl-9 pr-4 py-1.5 text-xs font-black text-black placeholder:text-slate-400 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-yellow-400 uppercase tracking-wide transition"
                />
              </div>
            </div>

            {/* 10 Games Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
              {filteredGames.map((game) => {
                const highScore = highScores[game.id] || 0;
                return (
                  <div
                    key={game.id}
                    onClick={() => handleSelectGame(game.id)}
                    className={`bg-white border-4 ${game.borderColor} rounded-2xl p-4 ${game.shadowClass} flex flex-col justify-between hover:-translate-y-1.5 transition-all duration-200 cursor-pointer group`}
                  >
                    {/* Visual Emoji Header Box */}
                    <div
                      className={`h-24 ${game.iconBg} rounded-xl mb-3 flex items-center justify-center text-4xl border-2 border-black/10 select-none group-hover:scale-105 transition-transform`}
                    >
                      <span>{game.emoji}</span>
                    </div>

                    {/* Title & Tagline */}
                    <div>
                      <h3 className="font-black text-lg leading-tight uppercase text-black">
                        {game.title}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wide">
                        {game.tagline}
                      </p>
                    </div>

                    {/* Bottom Row */}
                    <div className="mt-auto pt-3 border-t-2 border-slate-100 flex justify-between items-center">
                      <span className={`text-xs font-black ${game.textColor}`}>
                        {highScore > 0 ? `${highScore.toLocaleString()} pts` : '0 pts'}
                      </span>
                      <button
                        className={`${game.btnBg} text-white px-3.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border border-black/20 group-hover:bg-black transition-colors`}
                      >
                        PLAY
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredGames.length === 0 && (
              <div className="py-16 text-center bg-white border-4 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-black font-black uppercase text-sm">
                  NO ARCADE GAMES FOUND MATCHING "{searchQuery}"
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Vibrant Palette Footer */}
      <footer className="h-14 bg-black text-white flex flex-col sm:flex-row items-center justify-between px-6 sm:px-8 shrink-0 text-[10px] font-bold tracking-widest uppercase border-t-4 border-black gap-2">
        <div className="flex gap-4 sm:gap-8 text-slate-400">
          <span>10 Games Loaded</span>
          <span>LocalStorage: Synced</span>
          <span className="hidden sm:inline">Offline Mode Ready</span>
        </div>
        <div className="text-yellow-400 font-black">
          CLICK A TILE TO BEGIN GAMEPLAY SESSION
        </div>
      </footer>
    </div>
  );
}
