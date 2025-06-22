import React, { useState } from 'react';
import './App.css';
import GameStart from './components/GameStart';
import TransportChallenge from './components/TransportChallenge';
import GameResults from './components/GameResults';

function App() {
  const [gameState, setGameState] = useState('start'); // 'start', 'playing', 'results'
  const [finalStats, setFinalStats] = useState(null);

  const handleStartGame = () => {
    setGameState('playing');
  };

  const handleCompleteGame = (stats) => {
    setFinalStats(stats);
    setGameState('results');
  };

  const handleRestartGame = () => {
    setGameState('start');
    setFinalStats(null);
  };

  return (
    <div className="App">
      {gameState === 'start' && <GameStart onStart={handleStartGame} />}
      {gameState === 'playing' && <TransportChallenge onComplete={handleCompleteGame} />}
      {gameState === 'results' && <GameResults stats={finalStats} onRestart={handleRestartGame} />}
    </div>
  );
}

export default App; 