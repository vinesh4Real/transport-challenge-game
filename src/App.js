import React, { useState } from 'react';
import './App.css';
import GameStart from './components/GameStart';
import TransportChallenge from './components/TransportChallenge';
import GameResults from './components/GameResults';

function App() {
  const [showStartModal, setShowStartModal] = useState(true);
  const [gameState, setGameState] = useState('playing'); // 'playing', 'results'
  const [finalStats, setFinalStats] = useState(null);

  const handleStartGame = () => {
    setShowStartModal(false);
  };

  const handleCompleteGame = (stats) => {
    setFinalStats(stats);
    setGameState('results');
  };

  const handleRestartGame = () => {
    setGameState('playing');
    setShowStartModal(true);
    setFinalStats(null);
  };

  return (
    <div className="App">
      {/* Game is always rendered */}
      {gameState === 'playing' && <TransportChallenge onComplete={handleCompleteGame} />}
      {gameState === 'results' && <GameResults stats={finalStats} onRestart={handleRestartGame} />}
      
      {/* Start modal overlays on top */}
      {showStartModal && <GameStart onStart={handleStartGame} />}
    </div>
  );
}

export default App; 