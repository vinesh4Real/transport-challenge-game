import React from 'react';
import './GameStart.css';

function GameStart({ onStart }) {
  return (
    <div className="game-start">
      <div className="game-modal">
        <div className="modal-content">
          <h1 className="game-title">RUSH HOUR</h1>
          <p className="game-subtitle">Build Transit, Beat Traffic</p>
          
          <button className="play-button" onClick={onStart}>
            PLAY
          </button>
          
          <p className="game-hint">Build roads. Watch them fill. Try transit.</p>
        </div>
      </div>
    </div>
  );
}

export default GameStart; 