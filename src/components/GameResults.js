import React from 'react';
import './GameResults.css';

function GameResults({ stats, onRestart }) {
  const getGrade = () => {
    if (stats.downtownParking <= 25) return { grade: 'A+', message: 'Outstanding! You created a people-first city!' };
    if (stats.downtownParking <= 40) return { grade: 'A', message: 'Excellent! Great transit-oriented development!' };
    if (stats.downtownParking <= 55) return { grade: 'B', message: 'Good progress on reducing car dependency!' };
    if (stats.downtownParking <= 70) return { grade: 'C', message: 'Some improvement, but still very car-dependent.' };
    return { grade: 'D', message: 'Still trapped in car-centric design.' };
  };

  const result = getGrade();

  return (
    <div className="game-results">
      <div className="results-container">
        <h1 className="results-title">🎯 Transportation Challenge Complete!</h1>
        
        <div className="grade-section">
          <div className={`grade-display grade-${result.grade.toLowerCase().replace('+', 'plus')}`}>
            {result.grade}
          </div>
          <div className="grade-message">{result.message}</div>
        </div>

        <div className="final-stats">
          <h3>📊 Final Results</h3>
          
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-number">{stats.people?.toLocaleString() || '5,000'}</div>
              <div className="stat-label">People Moved Daily</div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">🅿️</div>
              <div className="stat-number">{Math.round(stats.downtownParking || 70)}%</div>
              <div className="stat-label">Downtown Parking</div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">🚊</div>
              <div className="stat-number">{stats.efficiency || 25}%</div>
              <div className="stat-label">Transit & Active Transport</div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">💰</div>
              <div className="stat-number">${Math.round((stats.cost || 150000000)/1000000)}M</div>
              <div className="stat-label">Infrastructure Investment</div>
            </div>
          </div>
        </div>

        <div className="impact-comparison">
          <h3>🏙️ Before vs After</h3>
          
          <div className="comparison-grid">
            <div className="comparison-section before">
              <h4>🚗 Car-Dependent City</h4>
              <div className="visual-bar">
                <div className="bar-section parking" style={{width: '70%'}}>
                  🅿️ 70% Parking
                </div>
                <div className="bar-section buildings" style={{width: '30%'}}>
                  🏢 30% Buildings
                </div>
              </div>
              <div className="comparison-stats">
                <div>😞 Low walkability</div>
                <div>💨 High pollution</div>
                <div>🚗 Car required for everything</div>
              </div>
            </div>
            
            <div className="comparison-section after">
              <h4>🚊 Your Transit City</h4>
              <div className="visual-bar">
                <div className="bar-section parking" style={{width: `${stats.downtownParking || 70}%`}}>
                  🅿️ {Math.round(stats.downtownParking || 70)}% Parking
                </div>
                <div className="bar-section buildings" style={{width: `${100 - (stats.downtownParking || 70)}%`}}>
                  🏢 {Math.round(100 - (stats.downtownParking || 70))}% Buildings
                </div>
              </div>
              <div className="comparison-stats">
                <div>😊 {stats.efficiency >= 50 ? 'High' : 'Improved'} walkability</div>
                <div>🌱 {stats.efficiency >= 50 ? 'Low' : 'Reduced'} pollution</div>
                <div>🚌 {stats.efficiency >= 50 ? 'Multiple' : 'Some'} transport options</div>
              </div>
            </div>
          </div>
        </div>

        <div className="key-insights">
          <h3>💡 Key Insights</h3>
          <div className="insights-list">
            <div className="insight">
              <strong>🚗 Cars are space-inefficient:</strong> Each parking space serves only 1-2 people, while the same space could house apartments for dozens.
            </div>
            <div className="insight">
              <strong>🚊 Transit scales better:</strong> A single light rail line can move 20,000+ people per hour - equivalent to 10+ highway lanes.
            </div>
            <div className="insight">
              <strong>🏙️ Dense cities are livable cities:</strong> When people don't need cars, downtown becomes a place for people, not parking.
            </div>
            <div className="insight">
              <strong>🚲 Active transport completes the picture:</strong> Bikes and walking handle short trips that don't need cars or transit.
            </div>
          </div>
        </div>

        <div className="call-to-action">
          <h3>🌟 Take Action</h3>
          <p>Ready to advocate for better transportation in your city?</p>
          <div className="action-buttons">
            <button className="action-btn primary" onClick={onRestart}>
              Play Again
            </button>
            <button className="action-btn secondary" onClick={() => window.open('https://www.strongtowns.org/', '_blank')}>
              Learn More
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GameResults; 