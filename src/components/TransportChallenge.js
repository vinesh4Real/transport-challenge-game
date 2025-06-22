import React, { useState, useEffect, useCallback } from 'react';
import './TransportChallenge.css';
import { TRANSPORTATION_MODES, GAME_LEVELS } from '../constants/transportationData';

// Helper function to format large numbers in words
const formatLargeNumber = (num) => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)} million`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}k`;
  }
  return num.toLocaleString();
};

// Traffic flow efficiency constants from Highway Capacity Manual
const TRAFFIC_FLOW_CONSTANTS = {
  STABLE_FLOW_EFFICIENCY: 0.95, // Max throughput before instability
  BREAKDOWN_FLOW_EFFICIENCY: 0.6, // Throughput during stop-and-go conditions
  OVERCAPACITY_THRESHOLD: 1.0 // V/C ratio where breakdown occurs
};

function TransportChallenge({ onComplete }) {
  const [level, setLevel] = useState(1);
  const [transportChoices, setTransportChoices] = useState([]);
  const [selectedTool, setSelectedTool] = useState(null);
  const [showSpeedModal, setShowSpeedModal] = useState(false);
  const [transitUnlocked, setTransitUnlocked] = useState(false); // Track if transit options are unlocked
  const [stats, setStats] = useState({
    people: 50000,
    carsUsed: 50000, // Start with everyone needing cars
    transitUsed: 0,
    activeUsed: 0,
    downtownParking: 100, // Will be calculated properly based on space
    cost: 0,
    efficiency: 0,
    parkingSpotsNeeded: 6251, // Will be calculated properly
    parkingSpaceNeeded: 2000000, // Will be calculated properly
    totalDowntownSpace: 4000000 // 4M sq ft downtown
  });

  // Build tools object from verified transportation data constants
  const tools = {
    1: GAME_LEVELS[1].available_modes.map(modeId => TRANSPORTATION_MODES[modeId]),
    2: [...GAME_LEVELS[1].available_modes, ...GAME_LEVELS[2].available_modes.filter(mode => !GAME_LEVELS[1].available_modes.includes(mode))].map(modeId => TRANSPORTATION_MODES[modeId]),
    3: GAME_LEVELS[3].available_modes.map(modeId => TRANSPORTATION_MODES[modeId])
  };

  // Use level data from constants with tools reference
  const levelData = {
    1: {
      ...GAME_LEVELS[1],
      unlocked: transitUnlocked ? [...tools[1], ...tools[2]] : tools[1], // Show transit tools if unlocked
      maxParking: GAME_LEVELS[1].max_parking_percent
    },
    2: {
      ...GAME_LEVELS[2],
      unlocked: [...tools[1], ...tools[2]],
      maxParking: GAME_LEVELS[2].max_parking_percent
    },
    3: {
      ...GAME_LEVELS[3],
      unlocked: [...tools[1], ...tools[2], ...tools[3]],
      maxParking: GAME_LEVELS[3].max_parking_percent
    }
  };

  const calculateStats = useCallback(() => {
    let totalCost = 0;
    let transitCapacity = 0;
    let activeCapacity = 0;

    transportChoices.forEach(choice => {
      totalCost += choice.tool.cost;
      
      if (choice.tool.type === 'transit') {
        transitCapacity += choice.tool.capacity;
      } else if (choice.tool.type === 'active') {
        activeCapacity += choice.tool.capacity;
      }
      // Note: Parking lots don't add capacity, they just provide storage
    });

          // Calculate modal split with induced traffic effect
      // Downtown receives traffic from multiple suburbs - ADT increases with highway capacity (induced demand)
      const highwayChoices = transportChoices.filter(choice => choice.tool.type === 'highway');
      let averageDailyTraffic = 60000; // Base ADT with 2-lane highway
      
      if (highwayChoices.length > 0) {
        const highwayType = highwayChoices[0].tool.id;
        if (highwayType === 'highway_4lane') {
          averageDailyTraffic = 80000; // 4-lane induces more regional traffic
        } else if (highwayType === 'highway_6lane') {
          averageDailyTraffic = 100000; // 6-lane induces even more regional traffic
        } else if (highwayType === 'highway_8lane') {
          averageDailyTraffic = 125000; // 8-lane induces massive regional traffic
        } else if (highwayType === 'highway_12lane') {
          averageDailyTraffic = 170000; // 12-lane induces extreme regional traffic
        } else if (highwayType === 'highway_24lane') {
          averageDailyTraffic = 225000; // 24-lane induces ultra extreme regional traffic
        }
        // 2-lane stays at 60,000
      }
      
      const peakHourCars = Math.round(averageDailyTraffic * 0.07); // Peak direction = 70% of 10% peak hour traffic
      
      // Level 1: Induced traffic - minimum highway needed, but more capacity attracts more users
    let carUsers;
          if (level === 1) {
      const totalHighwayVehicleCapacity = transportChoices
        .filter(choice => choice.tool.type === 'highway')
        .reduce((sum, choice) => sum + choice.tool.capacity, 0);
      
              if (totalHighwayVehicleCapacity === 0) {
          // No highway = the ~6,700 peak hour cars can't get downtown at all
          carUsers = 0;
        } else {
          // All peak hour cars need to get downtown (ADT already includes induced demand)
          carUsers = peakHourCars;
        }
    } else {
              // Normal calculation for levels 2-3 (convert back to people for transit/active)
        const peakHourPeople = peakHourCars * 1.2;
        const transitUsers = Math.min(transitCapacity * 0.6, peakHourPeople * 0.8);
        const activeUsers = Math.min(activeCapacity * 0.8, (peakHourPeople - transitUsers) * 0.5);
        const remainingPeople = Math.max(0, peakHourPeople - transitUsers - activeUsers);
        carUsers = Math.round(remainingPeople / 1.2); // Convert back to cars
    }
    
    // Calculate parking needed (carUsers is already in cars, need 1.5 spaces per car for peak)
    const parkingSpotsNeeded = Math.ceil(carUsers * 1.5);
    // Each parking spot = 320 sq ft (including driving lanes, access)
    const parkingSpaceNeeded = parkingSpotsNeeded * 320; // sq ft
    
    // Calculate downtown size based on highway capacity (larger highways serve larger metro areas)
    const totalHighwayCapacity = transportChoices
      .filter(choice => choice.tool.type === 'highway')
      .reduce((sum, choice) => sum + choice.tool.capacity, 0);
    
    // Base downtown: 4M sq ft for 2-lane highway (2,000 capacity)
    // Scale proportionally: 24-lane highway (24,000 capacity) = 48M sq ft downtown
    const baseDowntownSize = 4000000; // 4M sq ft base
    const baseHighwayCapacity = 2000; // 2-lane highway capacity
    const downtownScaleFactor = totalHighwayCapacity > 0 ? totalHighwayCapacity / baseHighwayCapacity : 1;
    const totalDowntownSpace = Math.round(baseDowntownSize * downtownScaleFactor);
    
    const downtownParkingPercent = Math.min(100, (parkingSpaceNeeded / totalDowntownSpace) * 100);

    // Calculate safety risk and personal costs for Level 1
    let trafficDeathsPerYear = 0;
    let personalCostPerYear = 0;
    
    if (level === 1 && carUsers > 0) {
      // Traffic deaths: ~1.33 deaths per 100 million vehicle miles traveled (NHTSA 2022)
      // 15 miles each way × 2 trips × 250 work days = 15,000 miles/year per person
      const totalVehicleMiles = carUsers * 15000; // 15k miles per car per year
      trafficDeathsPerYear = (totalVehicleMiles / 100000000) * 1.33; // Deaths per year for this population
      
      // Personal car costs: $10,728/year average (AAA 2023)
      // Includes: car payments, insurance, gas, maintenance, parking, registration
      personalCostPerYear = carUsers * 10728; // Total cost burden on population
    }

          // Calculate transit/active users for stats display
      const peakHourPeople = peakHourCars * 1.2;
      const transitUsersDisplay = level === 1 ? 0 : Math.min(transitCapacity * 0.6, peakHourPeople * 0.8);
      const activeUsersDisplay = level === 1 ? 0 : Math.min(activeCapacity * 0.8, (peakHourPeople - transitUsersDisplay) * 0.5);
      
      // Calculate travel time and throughput efficiency based on actual lane performance
      let averageTravelTime = 60; // minutes, base case
      let peoplePerHour = 0;
      let averageSpeed = 0; // mph
      
      const distance = 15; // miles
      
      if (level === 1) {
        const highwayChoices = transportChoices.filter(choice => choice.tool.type === 'highway');
        
        if (highwayChoices.length === 0) {
          averageTravelTime = 999; // Can't get there
          peoplePerHour = 0;
          averageSpeed = 0;
        } else {
          // Calculate capacity and V/C ratio
          const totalHighwayVehicleCapacity = highwayChoices.reduce((sum, choice) => sum + choice.tool.capacity, 0);
          const totalHighwayCapacity = totalHighwayVehicleCapacity * 1.2; // Convert vehicles to people (1.2 people/car)
          
          // Use V/C ratio based on vehicle capacity for determining flow efficiency
          const volumeToCapacityRatio = carUsers / totalHighwayVehicleCapacity;
          
          // Determine flow efficiency based on V/C ratio
          const flowEfficiency = volumeToCapacityRatio > TRAFFIC_FLOW_CONSTANTS.OVERCAPACITY_THRESHOLD 
            ? TRAFFIC_FLOW_CONSTANTS.BREAKDOWN_FLOW_EFFICIENCY 
            : TRAFFIC_FLOW_CONSTANTS.STABLE_FLOW_EFFICIENCY;
          
          // Calculate actual throughput based on highway capacity
          const throughputPeople = Math.round(totalHighwayCapacity * flowEfficiency);
          peoplePerHour = Math.round(throughputPeople);
          
          // Refined speed formula: realistic congestion curve
          const freeFlowSpeed = 65; // mph
          let speedReduction = 0;
          
          if (volumeToCapacityRatio <= 0.5) {
            speedReduction = 0; // No congestion below 50%
          } else if (volumeToCapacityRatio <= 0.7) {
            // 5% reduction per 5% V/C increase from 50% to 70%
            speedReduction = (volumeToCapacityRatio - 0.5) * 1.0; // 20% total at 70%
          } else {
            // 20% reduction at 70%, then 10% reduction per 5% V/C increase
            speedReduction = 0.2 + ((volumeToCapacityRatio - 0.7) * 2.0);
          }
          
          averageSpeed = Math.max(8, freeFlowSpeed * (1 - speedReduction));
          
          // Calculate travel time: Time = Distance / Speed (convert to minutes)
          averageTravelTime = Math.round((distance / averageSpeed) * 60);
        }
      } else {
        // For transit/active levels, use different speed calculations
        const totalCapacity = transitCapacity + activeCapacity + transportChoices
          .filter(choice => choice.tool.type === 'highway')
          .reduce((sum, choice) => sum + choice.tool.capacity, 0);
        
        // Transit average speeds (including stops, transfers)
        const transitChoices = transportChoices.filter(choice => choice.tool.type === 'transit');
        const activeChoices = transportChoices.filter(choice => choice.tool.type === 'active');
        
        if (transitChoices.length > 0) {
          averageSpeed = 35; // BRT/Light Rail average speed including stops
          averageTravelTime = Math.round((distance / averageSpeed) * 60);
        } else if (activeChoices.length > 0) {
          averageSpeed = 12; // Bike average speed
          averageTravelTime = Math.round((distance / averageSpeed) * 60);
        } else {
          averageSpeed = 25; // Mixed traffic
          averageTravelTime = Math.round((distance / averageSpeed) * 60);
        }
        
        peoplePerHour = totalCapacity;
      }

      // Calculate V/C ratio for display
      let volumeCapacityRatio = 0;
      if (level === 1 && transportChoices.length > 0) {
        const totalHighwayVehicleCapacity = transportChoices
          .filter(choice => choice.tool.type === 'highway')
          .reduce((sum, choice) => sum + choice.tool.capacity, 0);
        volumeCapacityRatio = totalHighwayVehicleCapacity > 0 ? carUsers / totalHighwayVehicleCapacity : 0;
      }

      const newStats = {
        people: peakHourPeople, // People count for internal tracking
        cars: peakHourCars, // Cars count for Level 1 display
        adt: averageDailyTraffic, // ADT for display
        carsUsed: carUsers,
        transitUsed: transitUsersDisplay,
        activeUsed: activeUsersDisplay,
        downtownParking: downtownParkingPercent,
        cost: totalCost,
        efficiency: Math.round((transitUsersDisplay + activeUsersDisplay) / peakHourPeople * 100),
        parkingSpotsNeeded: parkingSpotsNeeded,
        parkingSpaceNeeded: parkingSpaceNeeded,
        totalDowntownSpace: totalDowntownSpace,
        averageTravelTime: averageTravelTime,
        peoplePerHour: peoplePerHour,
        averageSpeed: Math.round(averageSpeed),
        volumeCapacityRatio: Math.round(volumeCapacityRatio * 100) / 100, // Round to 2 decimal places
        // Safety and cost impacts for Level 1
        trafficDeathsPerYear: Math.round(trafficDeathsPerYear * 100) / 100, // Round to 2 decimal places
        personalCostPerYear: personalCostPerYear,
        // Speed calculation details for modal
        speedCalculation: level === 1 && transportChoices.length > 0 ? {
          volume: carUsers,
          throughput: Math.round(peoplePerHour / 1.2),
          freeFlowSpeed: 65,
          formula: `max(8, 65 × (1 - ${carUsers}/${Math.round(peoplePerHour / 1.2)}))`,
          // Capacity breakdown details - all in vehicles for Level 1
          theoreticalCapacity: transportChoices.filter(choice => choice.tool.type === 'highway')
            .reduce((sum, choice) => sum + choice.tool.capacity, 0),
          flowEfficiency: volumeCapacityRatio > TRAFFIC_FLOW_CONSTANTS.OVERCAPACITY_THRESHOLD 
            ? TRAFFIC_FLOW_CONSTANTS.BREAKDOWN_FLOW_EFFICIENCY 
            : TRAFFIC_FLOW_CONSTANTS.STABLE_FLOW_EFFICIENCY,
          vcRatio: Math.round(volumeCapacityRatio * 100) / 100
        } : null
      };

    setStats(newStats);
  }, [transportChoices, level]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  const handleToolSelect = (tool) => {
    setSelectedTool(tool);
  };

  const handleAddTransport = () => {
    if (!selectedTool) return;

    // Replace existing highway when adding a new one (applies to all levels)
    if (selectedTool.type === 'highway') {
      // Remove any existing highways first
      setTransportChoices(prev => prev.filter(choice => choice.tool.type !== 'highway'));
    }

    const newChoice = {
      id: Date.now(),
      tool: selectedTool
    };

    setTransportChoices(prev => [...prev, newChoice]);
  };

  const handleRemoveChoice = (choiceId) => {
    setTransportChoices(prev => prev.filter(choice => choice.id !== choiceId));
  };

  const handleNextLevel = () => {
    if (level < 3) {
      setLevel(level + 1);
      setTransportChoices([]);
    } else {
      onComplete(stats);
    }
  };

  const handleUnlockTransit = () => {
    setTransitUnlocked(true);
  };

  const canAdvanceLevel = () => {
    // Don't allow advancement if no transportation has been built
    if (transportChoices.length === 0) {
      return false;
    }
    
    // All levels: Must meet parking goal to advance
    return stats.downtownParking <= levelData[level].maxParking;
  };

  const resetLevel = () => {
    setTransportChoices([]);
    setSelectedTool(null);
  };

  return (
    <div className="transport-challenge">
      {/* Top section: Level info on left, Goal/Hint stacked on right */}
      <div className="top-section">
        <div className="level-info">
          <h2>Level {level}: {levelData[level].name}</h2>
        </div>
        <div className="level-objectives">
          <div className="level-goal">
            <strong>Goal:</strong> {levelData[level].goal}
          </div>
          <div className="level-hint">
            <strong>Hint:</strong> {levelData[level].hint}
          </div>
        </div>
      </div>

      {/* <div className="game-header">
        <div className="level-info">
          <h2>Level {level}: {levelData[level].name}</h2>
        </div>

        <div className={`travel-time-block ${stats.averageTravelTime > 60 ? 'travel-time-bad' : stats.averageTravelTime === 999 ? 'travel-time-none' : 'travel-time-good'}`}>
          <div className="travel-time-main">
            <div className="travel-time-value">
              {stats.averageTravelTime === 999 ? 'No Access' : `${stats.averageTravelTime} minutes`}
            </div>
            <div className="travel-time-label">⏱️ Average Travel Time to Downtown</div>
          </div>
          <div className="throughput-info">
            <span className="throughput-value">{level === 1 ? Math.round(stats.peoplePerHour / 1.2)?.toLocaleString() : stats.peoplePerHour?.toLocaleString()}/hr</span>
            <span className="throughput-label">{level === 1 ? 'vehicles moved' : 'people moved'}</span>
          </div>
        </div>

        <div className="live-stats">
          <div className="stat">
            <div className="stat-value">{level === 1 ? stats.cars?.toLocaleString() : stats.people?.toLocaleString()}</div>
            <div className="stat-label">{level === 1 ? '🚗 Cars to Move' : '👥 People to Move'}</div>
          </div>
          <div className="stat">
            <div className="stat-value">{Math.round(stats.downtownParking)}%</div>
            <div className="stat-label">🅿️ Downtown Space for Parking</div>
            <div 
              className="stat-detail parking-tooltip" 
              title={`${stats.parkingSpotsNeeded?.toLocaleString()} parking spots × 320 sq ft each`}
            >
              {formatLargeNumber(stats.parkingSpaceNeeded)} sq ft needed
            </div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.efficiency}%</div>
            <div className="stat-label">🚊 Transit/Active</div>
          </div>
          <div className="stat">
            <div className="stat-value">${Math.round(stats.cost/1000000)}M</div>
            <div className="stat-label">💰 Total Cost</div>
          </div>
        </div>
      </div> */}

            <div className="game-content">
        <div className="tool-palette">
          <h3>🛠️ Transportation Tools</h3>
          <div className="tools">
            {levelData[level].unlocked.map(tool => (
              <div 
                key={tool.id}
                className={`tool ${selectedTool?.id === tool.id ? 'selected' : ''}`}
                onClick={() => handleToolSelect(tool)}
              >
                <div className="tool-icon">{tool.icon}</div>
                <div className="tool-name">{tool.name}</div>
                <div className="tool-stats">
                  👥{tool.capacity.toLocaleString()}/hr
                  💰${tool.cost/1000000}M
                </div>
                <div className="tool-description">{tool.description}</div>
                <div className="tool-source" title={tool.source}>📊 Verified Data</div>
              </div>
            ))}
          </div>
          
          <div className="tool-actions">
            <button 
              className="add-transport-btn"
              onClick={handleAddTransport}
              disabled={!selectedTool}
            >
              Add {selectedTool?.name || 'Transport'}
            </button>
            <button className="reset-btn" onClick={resetLevel}>
              Reset Level
            </button>
          </div>
        </div>

        <div className="transport-corridor">
          <h3>🗺️ Transportation Corridor</h3>
          
          <div className="corridor-visual">
            <div className="corridor-section suburbs">
              <h4>🏘️ Suburban Neighborhoods</h4>
                             <div className="suburb-context">
                 <p><strong>Multiple Suburbs:</strong> {stats.adt?.toLocaleString()} ADT from all suburban areas to downtown</p>
                 <p><strong>Distance:</strong> 15 miles average to downtown core</p>
                 <p><strong>Peak Hour:</strong> {level === 1 ? `${stats.cars?.toLocaleString()} cars` : `${stats.people?.toLocaleString()} people`} travel during rush hour</p>
               </div>
              <div className="suburb-visual">🏠🏠🏠🏠🏠</div>
            </div>
            
            <div className="corridor-section transport-zone">
              <h4>🛣️ Transportation Corridor (15-mile route)</h4>
              
              {/* Performance Box */}
              <div className="performance-box">
                <div className="performance-stats">
                  <div className="stat-item">
                    <span className="stat-label">Travel Time:</span>
                    <span className="stat-value">
                      {stats.averageTravelTime === 999 ? 'No Access' : `${stats.averageTravelTime} min`}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Speed:</span>
                    <div className="stat-value-with-button">
                      <span className="stat-value">
                        {stats.averageTravelTime === 999 ? 'N/A' : `${stats.averageSpeed} mph`}
                      </span>
                      {stats.speedCalculation && (
                        <button 
                          className="speed-info-button"
                          onClick={() => setShowSpeedModal(true)}
                          title="Click to see speed calculation details"
                        >
                          ℹ️
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">{level === 1 ? 'Vehicles/Hour:' : 'People/Hour:'}</span>
                    <span className="stat-value">{level === 1 ? Math.round(stats.peoplePerHour / 1.2)?.toLocaleString() : stats.peoplePerHour?.toLocaleString()}</span>
                  </div>
                  {level === 1 && stats.volumeCapacityRatio > 0 && (
                    <div className="stat-item">
                      <span className="stat-label">V/C Ratio:</span>
                      <span className="stat-value">{stats.volumeCapacityRatio}</span>
                    </div>
                  )}
                </div>
                
                {/* Congestion Remarks */}
                {stats.averageTravelTime === 999 && (
                  <div className="congestion-remark no-access">
                    🚫 <strong>No Access:</strong> No transportation infrastructure built yet
                  </div>
                )}
                {stats.averageTravelTime !== 999 && level === 1 && stats.adt > 60000 && (
                  <div className="congestion-remark induced-traffic">
                    ⚠️ <strong>Induced Traffic:</strong> Wider highway attracted {stats.adt - 60000} more daily trips!
                  </div>
                )}
                {stats.averageTravelTime !== 999 && level === 1 && stats.averageTravelTime > 60 && (
                  <div className="congestion-remark heavy-congestion">
                    🚗 <strong>Heavy Congestion:</strong> More lanes created more traffic - {stats.averageTravelTime}min travel time!
                  </div>
                )}
                {stats.averageTravelTime <= 30 && stats.averageTravelTime !== 999 && (
                  <div className="congestion-remark good-flow">
                    ✅ <strong>Good Flow:</strong> Efficient transportation with {stats.averageTravelTime}min travel time
                  </div>
                )}
                
                {/* Parking Space Warning */}
                {stats.averageTravelTime !== 999 && level === 1 && stats.downtownParking > 5 && (
                  <div className="congestion-remark parking-warning">
                    🅿️ <strong>Parking Crisis:</strong> Cars need {formatLargeNumber(stats.parkingSpaceNeeded)} sq ft ({Math.round(stats.downtownParking)}% of downtown)!
                  </div>
                )}
                {stats.averageTravelTime !== 999 && level === 1 && stats.downtownParking > 2 && stats.downtownParking <= 5 && (
                  <div className="congestion-remark parking-caution">
                    ⚠️ <strong>Parking Alert:</strong> Cars consume {formatLargeNumber(stats.parkingSpaceNeeded)} sq ft of valuable downtown space
                  </div>
                )}
                
                {/* Safety Risk Warning */}
                {stats.averageTravelTime !== 999 && level === 1 && stats.trafficDeathsPerYear > 1 && (
                  <div className="congestion-remark safety-risk">
                    💀 <strong>Safety Risk:</strong> Car dependency causes ~{Math.round(stats.trafficDeathsPerYear)} traffic deaths per year for this population
                  </div>
                )}
                {stats.averageTravelTime !== 999 && level === 1 && stats.trafficDeathsPerYear > 0.1 && stats.trafficDeathsPerYear <= 1 && (
                  <div className="congestion-remark safety-caution">
                    ⚠️ <strong>Traffic Risk:</strong> ~{stats.trafficDeathsPerYear.toFixed(1)} expected traffic deaths per year
                  </div>
                )}
                
                {/* Personal Cost Warning */}
                {stats.averageTravelTime !== 999 && level === 1 && stats.personalCostPerYear > 50000000 && (
                  <div className="congestion-remark cost-burden">
                    💸 <strong>Cost Crisis:</strong> Car dependency costs this population ${formatLargeNumber(stats.personalCostPerYear)} per year
                  </div>
                )}
                {stats.averageTravelTime !== 999 && level === 1 && stats.personalCostPerYear > 10000000 && stats.personalCostPerYear <= 50000000 && (
                  <div className="congestion-remark cost-warning">
                    💰 <strong>Cost Burden:</strong> Cars cost this population ${formatLargeNumber(stats.personalCostPerYear)} annually
                  </div>
                )}
              </div>

              {/* Infrastructure Box */}
              <div className="infrastructure-box">
                <h5>Infrastructure Lanes</h5>
                <div className="transport-list">
                  {transportChoices.length === 0 ? (
                    <p className="no-transport">No transport added yet. Select tools from the left!</p>
                  ) : (
                    transportChoices.map(choice => (
                      <div key={choice.id} className="transport-item">
                        <span className="transport-icon">{choice.tool.icon}</span>
                        <span className="transport-name">{choice.tool.name}</span>
                        <span className="transport-capacity">{choice.tool.capacity.toLocaleString()}/hr</span>
                        <button 
                          className="remove-transport"
                          onClick={() => handleRemoveChoice(choice.id)}
                        >
                          ❌
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            
            <div className="corridor-section downtown">
              <h4>🏢 Downtown Core ({Math.round(stats.totalDowntownSpace / 400000)} city blocks)</h4>
              <div className="downtown-context">
                <p><strong>Total space:</strong> {formatLargeNumber(stats.totalDowntownSpace)} sq ft</p>
                <p><strong>Cars need:</strong> {formatLargeNumber(stats.parkingSpaceNeeded)} sq ft for parking</p>
                <p><strong>Metro scale:</strong> Larger highways serve bigger metropolitan areas</p>
              </div>
              <div className="downtown-visual">
                <div className="downtown-breakdown">
                  <div className="parking-section" style={{width: `${stats.downtownParking}%`}}>
                    <span>🅿️ {Math.round(stats.downtownParking)}% Parking</span>
                  </div>
                  <div className="building-section" style={{width: `${100 - stats.downtownParking}%`}}>
                    <span>🏙️ {Math.round(100 - stats.downtownParking)}% Other</span>
                  </div>
                </div>
              </div>
              <div className="downtown-explanation">
                <small>Each 1% = {formatLargeNumber(Math.round(stats.totalDowntownSpace / 100))} sq ft</small>
              </div>
            </div>
          </div>

          <div className="modal-split">
            <h4>📊 How People Travel</h4>
            <div className="split-bars">
              <div className="split-bar">
                <div className="split-label">🚗 Cars</div>
                <div className="split-visual">
                  <div 
                    className="split-fill cars"
                    style={{width: `${(stats.carsUsed / stats.people) * 100}%`}}
                  ></div>
                </div>
                <div className="split-value">{Math.round((stats.carsUsed / stats.people) * 100)}%</div>
              </div>
              
              <div className="split-bar">
                <div className="split-label">🚊 Transit</div>
                <div className="split-visual">
                  <div 
                    className="split-fill transit"
                    style={{width: `${(stats.transitUsed / stats.people) * 100}%`}}
                  ></div>
                </div>
                <div className="split-value">{Math.round((stats.transitUsed / stats.people) * 100)}%</div>
              </div>
              
              <div className="split-bar">
                <div className="split-label">🚲 Active</div>
                <div className="split-visual">
                  <div 
                    className="split-fill active"
                    style={{width: `${((stats.activeUsed || 0) / stats.people) * 100}%`}}
                  ></div>
                </div>
                <div className="split-value">{Math.round(((stats.activeUsed || 0) / stats.people) * 100)}%</div>
              </div>
            </div>
          </div>

          {canAdvanceLevel() && (
            <button 
              className="next-level-btn achieved"
              onClick={handleNextLevel}
            >
              {level < 3 ? 'Next Level' : 'Complete Challenge'} ✨
            </button>
          )}
          
          {!canAdvanceLevel() && (
            <div className="level-feedback">
              {transportChoices.length === 0 ? (
                <p>🛠️ <strong>Get Started:</strong> Select and add a transportation option from the tools above to begin!</p>
              ) : level === 1 ? (
                <>
                  <p>🎯 <strong>Highway Challenge:</strong> Try different highway configurations to see what happens!</p>
                  <p>Current: {Math.round(stats.downtownParking)}% parking (Goal: ≤{levelData[level].maxParking}%)</p>
                  {!transitUnlocked && (
                    <button 
                      className="unlock-transit-btn"
                      onClick={handleUnlockTransit}
                    >
                      I give up! ⚡ Give me other transit options ⚡
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p>🎯 <strong>Goal not reached!</strong> You need to get downtown parking below {levelData[level].maxParking}%</p>
                  <p>Current: {Math.round(stats.downtownParking)}% parking</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Speed Calculation Modal */}
      {showSpeedModal && stats.speedCalculation && (
        <div className="modal-overlay" onClick={() => setShowSpeedModal(false)}>
          <div className="speed-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🏁 Speed Calculation Details</h3>
              <button 
                className="modal-close"
                onClick={() => setShowSpeedModal(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="modal-content">
              <div className="calculation-section">
                <h4>📐 Formula</h4>
                <div className="formula-box">
                  Speed = max(8, 65 × (1 - Volume/Throughput))
                </div>
              </div>

              <div className="calculation-section">
                <h4>🏗️ How We Get {stats.speedCalculation.throughput.toLocaleString()} Vehicles/Hour Capacity</h4>
                <div className="capacity-breakdown">
                  <div className="capacity-step">
                    <div className="capacity-step-header">
                      <span className="capacity-step-number">1</span>
                      <span className="capacity-step-title">Theoretical Highway Capacity</span>
                    </div>
                    <div className="capacity-step-content">
                      <div className="capacity-calc">
                        {stats.speedCalculation.theoreticalCapacity.toLocaleString()} vehicles/hour
                      </div>
                      <div className="capacity-desc">
                        Based on Highway Capacity Manual: 2,000 vehicles per lane per hour under ideal conditions
                      </div>
                    </div>
                  </div>

                  <div className="capacity-step">
                    <div className="capacity-step-header">
                      <span className="capacity-step-number">2</span>
                      <span className="capacity-step-title">Apply Traffic Flow Efficiency</span>
                    </div>
                    <div className="capacity-step-content">
                      <div className="capacity-calc final-capacity">
                        {stats.speedCalculation.theoreticalCapacity.toLocaleString()} × {stats.speedCalculation.flowEfficiency} = {Math.round(stats.speedCalculation.theoreticalCapacity * stats.speedCalculation.flowEfficiency).toLocaleString()} vehicles/hour
                      </div>
                      <div className="capacity-desc">
                        {stats.speedCalculation.vcRatio > 1.0 ? 
                          `V/C ratio = ${stats.speedCalculation.vcRatio} (overcapacity) → Breakdown flow efficiency = ${stats.speedCalculation.flowEfficiency} (stop-and-go conditions)` :
                          `V/C ratio = ${stats.speedCalculation.vcRatio} (stable) → Stable flow efficiency = ${stats.speedCalculation.flowEfficiency} (smooth traffic)`
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="calculation-section">
                <h4>📊 Input Values for Speed Formula</h4>
                <div className="inputs-grid">
                  <div className="input-item">
                    <span className="input-label">Volume:</span>
                    <span className="input-value">{stats.speedCalculation.volume.toLocaleString()} vehicles</span>
                    <span className="input-desc">Peak hour demand</span>
                  </div>
                  <div className="input-item">
                    <span className="input-label">Throughput:</span>
                    <span className="input-value">{stats.speedCalculation.throughput.toLocaleString()} vehicles/hr</span>
                    <span className="input-desc">Actual highway capacity (calculated above)</span>
                  </div>
                  <div className="input-item">
                    <span className="input-label">Free Flow Speed:</span>
                    <span className="input-value">{stats.speedCalculation.freeFlowSpeed} mph</span>
                    <span className="input-desc">Speed with no congestion</span>
                  </div>
                  <div className="input-item">
                    <span className="input-label">Speed Floor:</span>
                    <span className="input-value">8 mph</span>
                    <span className="input-desc">Minimum in stop-and-go</span>
                  </div>
                </div>
              </div>

              <div className="calculation-section">
                <h4>🔢 Step-by-Step Calculation</h4>
                <div className="steps">
                  <div className="step">
                    <span className="step-number">1.</span>
                    <span className="step-text">
                      Volume ÷ Throughput = {stats.speedCalculation.volume.toLocaleString()} ÷ {stats.speedCalculation.throughput.toLocaleString()} = <strong>{(stats.speedCalculation.volume / stats.speedCalculation.throughput).toFixed(2)}</strong>
                    </span>
                  </div>
                  <div className="step">
                    <span className="step-number">2.</span>
                    <span className="step-text">
                      Congestion factor = 1 - {(stats.speedCalculation.volume / stats.speedCalculation.throughput).toFixed(2)} = <strong>{(1 - stats.speedCalculation.volume / stats.speedCalculation.throughput).toFixed(2)}</strong>
                    </span>
                  </div>
                  <div className="step">
                    <span className="step-number">3.</span>
                    <span className="step-text">
                      Raw speed = 65 × {(1 - stats.speedCalculation.volume / stats.speedCalculation.throughput).toFixed(2)} = <strong>{(65 * (1 - stats.speedCalculation.volume / stats.speedCalculation.throughput)).toFixed(1)} mph</strong>
                    </span>
                  </div>
                  <div className="step">
                    <span className="step-number">4.</span>
                    <span className="step-text">
                      Final speed = max(8, {(65 * (1 - stats.speedCalculation.volume / stats.speedCalculation.throughput)).toFixed(1)}) = <strong className="final-result">{stats.averageSpeed} mph</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="calculation-section">
                <h4>💡 Why This Speed?</h4>
                <div className="explanation-box">
                  {stats.speedCalculation.volume > stats.speedCalculation.throughput ? (
                    <>
                      <p><strong>🚗 Severe Congestion:</strong> Peak hour demand ({stats.speedCalculation.volume.toLocaleString()} cars) exceeds the highway's actual capacity ({stats.speedCalculation.throughput.toLocaleString()} cars/hr).</p>
                      <p><strong>🐌 Stop-and-Go Traffic:</strong> When demand exceeds capacity, traffic breaks down into stop-and-go conditions. The speed hits our minimum floor of 8 mph, representing severe but still-moving congestion.</p>
                      <p><strong>📈 Induced Demand Effect:</strong> Building more highway capacity attracted more traffic, keeping the system congested despite the expansion.</p>
                    </>
                  ) : (
                    <>
                      <p><strong>✅ Flowing Traffic:</strong> The highway is operating at {Math.round((stats.speedCalculation.volume / stats.speedCalculation.throughput) * 100)}% of capacity.</p>
                      <p><strong>🚗 Manageable Congestion:</strong> Traffic is moving but with some slowdown due to volume approaching capacity limits.</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TransportChallenge; 