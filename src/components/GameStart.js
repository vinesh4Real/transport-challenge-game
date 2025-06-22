import React from 'react';
import './GameStart.css';

function GameStart({ onStart }) {
  return (
    <div className="game-start">
      <div className="hero-section">
        <h1 className="main-title">🚦 Transportation Challenge</h1>
        <h2 className="subtitle">The Commuter Crisis</h2>
        
        <div className="challenge-preview">
          <div className="scenario">
            <h3>🏘️ The Problem</h3>
            <p>5,000 people live in the suburbs and need to get to downtown every day.</p>
            <p>How much urban space will different transportation choices require?</p>
          </div>
          
          <div className="stats-preview">
            <div className="stat-card car-stats">
              <h4>🚗 Car-Only Scenario</h4>
              <div className="big-number">70%</div>
              <p>of downtown becomes parking</p>
              <div className="visual-hint">
                <span className="parking-blocks">🅿️🅿️🅿️🅿️🅿️🅿️🅿️</span>
                <span className="building-blocks">🏢🏢🏢</span>
              </div>
            </div>
            
            <div className="stat-card transit-stats">
              <h4>🚊 With Transit</h4>
              <div className="big-number">25%</div>
              <p>of downtown for parking</p>
              <div className="visual-hint">
                <span className="parking-blocks">🅿️🅿️</span>
                <span className="building-blocks">🏢🏢🏢🏢🏢🏪</span>
              </div>
            </div>
          </div>
          
          <div className="challenge-description">
            <h3>🎯 Your Challenge</h3>
            <p>Move 5,000 suburban commuters to downtown efficiently.</p>
            <p>Discover how transportation choices shape our cities.</p>
            <p><strong>Can you free downtown from the parking prison?</strong></p>
          </div>
        </div>
        
        <button className="start-button" onClick={onStart}>
          Start Transportation Challenge
        </button>
        
        <div className="game-info">
          <p>⏱️ 3 levels • 🎮 Interactive simulation • 📊 Real data</p>
        </div>
      </div>
    </div>
  );
}

export default GameStart; 