import React, { useState, useEffect, useCallback } from 'react';
import './TransportChallenge.css';
import { TRANSPORTATION_MODES, GAME_LEVELS, HIGHWAY_INDUCED_TRAFFIC } from '../constants/transportationData';

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

// Helper function to calculate vehicle speed based on V/C ratio
const calculateVehicleSpeed = (vehicleVolume, vehicleCapacity) => {
  if (vehicleCapacity === 0) return 0;
  
  const vcRatio = vehicleVolume / vehicleCapacity;
  const freeFlowSpeed = 65; // mph
  
  // Granular speed decay starting at V/C > 0.5
  if (vcRatio <= 0.50) {
    return freeFlowSpeed; // Free flow
  } else if (vcRatio <= 0.55) {
    return 62; // Decay starts
  } else if (vcRatio <= 0.60) {
    return 58;
  } else if (vcRatio <= 0.65) {
    return 53;
  } else if (vcRatio <= 0.70) {
    return 47;
  } else if (vcRatio <= 0.75) {
    return 40;
  } else if (vcRatio <= 0.80) {
    return 32;
  } else if (vcRatio <= 0.85) {
    return 23;
  } else if (vcRatio <= 0.90) {
    return 15;
  } else if (vcRatio <= 0.95) {
    return 10;
  } else {
    return 8; // Stop-and-go
  }
};

function TransportChallenge({ onComplete }) {
  const [level, setLevel] = useState(1);
  const [transportChoices, setTransportChoices] = useState([]);
  const [selectedTool, setSelectedTool] = useState(null);
  const [showSpeedModal, setShowSpeedModal] = useState(false);

  const [brtFleetSize, setBrtFleetSize] = useState(40); // Single BRT fleet size
  const [highwayLanes, setHighwayLanes] = useState(2); // Highway lanes (min 2, max 24, increment by 2)
  const [stats, setStats] = useState({
    people: 50000,
    distance: 20,
    carsUsed: 50000, // Start with everyone needing cars
    transitUsed: 0,
    activeUsers: 0,
    downtownParking: 100, // Will be calculated properly based on space
    cost: 0,
    efficiency: 0,
    parkingSpotsNeeded: 6251, // Will be calculated properly
    parkingSpaceNeeded: 2000000, // Will be calculated properly
    totalDowntownSpace: 4000000, // 4M sq ft downtown
    averageTravelTime: 0,
    peoplePerHour: 0,
    vehiclesPerHour: 0,
    averageSpeed: 0,
    volumeCapacityRatio: 0,
    trafficDeathsPerYear: 0,
    personalCostPerYear: 0,
    totalPeakHourTraffic: 0
  });

  // Build tools object from verified transportation data constants
  const tools = {
    1: GAME_LEVELS[1].available_modes.map(modeId => TRANSPORTATION_MODES[modeId]),
    2: GAME_LEVELS[2].available_modes.map(modeId => TRANSPORTATION_MODES[modeId]),
    3: GAME_LEVELS[3].available_modes.map(modeId => TRANSPORTATION_MODES[modeId])
  };

  // Use level data from constants with tools reference
  const levelData = {
    1: {
      ...GAME_LEVELS[1],
      unlocked: tools[1], // Only Level 1 tools
      maxParking: GAME_LEVELS[1].max_parking_percent
    },
    2: {
      ...GAME_LEVELS[2],
      unlocked: tools[2], // Level 2 tools already include highway
      maxParking: GAME_LEVELS[2].max_parking_percent
    },
    3: {
      ...GAME_LEVELS[3],
      unlocked: tools[3], // Level 3 tools include all modes
      maxParking: GAME_LEVELS[3].max_parking_percent
    }
  };

  const calculateStats = useCallback(() => {
    let totalCost = 0;
    let transitCapacity = 0;
    let activeCapacity = 0;
    let totalBRTUsers = 0; // Declare early to avoid initialization errors

    transportChoices.forEach(choice => {
      if (choice.tool.type === 'highway') {
        // Highway cost scales with number of lanes
        totalCost += choice.tool.cost * (highwayLanes / 2); // Base cost is for 2 lanes
      } else {
        totalCost += choice.tool.cost;
      }
      
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
      let totalADT = 60000; // Base total ADT with 2-lane highway
      let vehicleADT = totalADT; // Initially all traffic is vehicles
      
      if (highwayChoices.length > 0) {
        // Calculate induced traffic based on number of lanes
        if (HIGHWAY_INDUCED_TRAFFIC[highwayLanes]) {
          // Use predefined values for standard lane counts
          totalADT = HIGHWAY_INDUCED_TRAFFIC[highwayLanes];
        } else {
          // For non-standard lane counts, interpolate
          const sortedLanes = Object.keys(HIGHWAY_INDUCED_TRAFFIC).map(Number).sort((a, b) => a - b);
          const lowerBound = sortedLanes.filter(lanes => lanes < highwayLanes).pop() || 2;
          const upperBound = sortedLanes.find(lanes => lanes > highwayLanes) || 24;
          
          const lowerADT = HIGHWAY_INDUCED_TRAFFIC[lowerBound];
          const upperADT = HIGHWAY_INDUCED_TRAFFIC[upperBound];
          
          // Linear interpolation
          const ratio = (highwayLanes - lowerBound) / (upperBound - lowerBound);
          totalADT = Math.ceil(lowerADT + ratio * (upperADT - lowerADT));
        }
        vehicleADT = totalADT; // Start with all traffic as vehicles
      }

      // BRT modal split calculations (Level 2+)
      const brtChoices = transportChoices.filter(choice => choice.tool.id === 'brt');
      let dailyBRTRidership = 0;
      let peakHourBRTCapacity = 0;
      
      if (brtChoices.length > 0 && level >= 2) {
        // BRT calculations based on fleet size
        const frequency = 118 / brtFleetSize; // minutes between buses
        const busesPerHour = Math.floor(60 / frequency); // FLOOR to get whole buses
        
        // Peak hour capacity (100% occupancy)
        peakHourBRTCapacity = busesPerHour * 160; // 160 passengers per articulated bus
        
        // Daily ridership: 6 hours @ 100%, 6 hours @ 60%, 6 hours @ 30%
        // Using 18 hour service day
        const peakHours = 6;
        const midHours = 6;
        const offPeakHours = 6;
        
        dailyBRTRidership = Math.floor(
          (peakHourBRTCapacity * peakHours * 1.0) +    // Peak: 100% occupancy
          (peakHourBRTCapacity * midHours * 0.6) +     // Mid: 60% occupancy  
          (peakHourBRTCapacity * offPeakHours * 0.3)   // Off-peak: 30% occupancy
        );
        
        totalBRTUsers = dailyBRTRidership;
        
        // Vehicle ADT = Total ADT - Daily BRT ridership
        vehicleADT = Math.max(0, totalADT - dailyBRTRidership);
        
        // Debug logging
        console.log('BRT Calculations:', {
          brtFleetSize,
          frequency: frequency.toFixed(2),
          busesPerHour,
          peakHourBRTCapacity,
          dailyBRTRidership,
          totalADT,
          vehicleADT
        });
      }
    
    // Unified vehicle and people counting system
    const peakHourVehicles = Math.round(vehicleADT * 0.07); // Peak direction = 70% of 10% peak hour traffic
    // Total peak hour people = vehicle passengers + BRT riders
    const peakHourPeople = (peakHourVehicles * 1.2) + peakHourBRTCapacity;
    
    // Get highway capacity for all levels
    const highwayChoice = transportChoices.find(choice => choice.tool.type === 'highway');
    const totalHighwayVehicleCapacity = highwayChoice ? (highwayLanes / 2) * 2000 : 0; // 2000 vehicles per inbound lane
    
    // Calculate modal split consistently across all levels
    let vehiclesUsed, peakHourBRTUsers, nonCarUsers;
    
    if (level === 1) {
      // Level 1: Only cars, no transit/active options
      if (totalHighwayVehicleCapacity === 0) {
        // No highway = no vehicles can get downtown
        vehiclesUsed = 0;
        peakHourBRTUsers = 0;
        nonCarUsers = 0;
      } else {
        // All peak hour vehicles need to get downtown
        vehiclesUsed = peakHourVehicles;
        peakHourBRTUsers = 0;
        nonCarUsers = 0;
      }
    } else {
      // Levels 2-3: Calculate modal split with transit/active options
      // BRT users in peak hour = peak hour BRT capacity (100% occupancy)
      peakHourBRTUsers = peakHourBRTCapacity;
      
      // Active transport users (bikes/walking) - small percentage in peak hour
      nonCarUsers = Math.min(activeCapacity * 0.8, Math.round(totalADT * 0.01)); // ~1% of total ADT
      
      // Vehicles used = peak hour vehicles from vehicleADT
      vehiclesUsed = peakHourVehicles;
    }
    
    // Calculate parking needed (vehiclesUsed is already in vehicles, need 1.5 spaces per vehicle for peak)
    const parkingSpotsNeeded = Math.ceil(vehiclesUsed * 1.5);
    // Each parking spot = 320 sq ft (including driving lanes, access)
    const parkingSpaceNeeded = parkingSpotsNeeded * 320; // sq ft
    
    // Calculate downtown size based on highway capacity (larger highways serve larger metro areas)
    const totalHighwayCapacity = totalHighwayVehicleCapacity; // Use the already calculated value
    
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
    
    if (level === 1 && vehiclesUsed > 0) {
      // Traffic deaths: ~1.33 deaths per 100 million vehicle miles traveled (NHTSA 2022)
      // 20 miles each way × 2 trips × 250 work days = 20,000 miles/year per person
      const totalVehicleMiles = vehiclesUsed * 20000; // 20k miles per car per year
      trafficDeathsPerYear = (totalVehicleMiles / 100000000) * 1.33; // Deaths per year for this population
      
      // Personal car costs: $10,728/year average (AAA 2023)
      // Includes: car payments, insurance, gas, maintenance, parking, registration
      personalCostPerYear = vehiclesUsed * 10728; // Total cost burden on population
    }

    // Transit and active users are already calculated above, no need to recalculate
    
    // Calculate travel time and throughput efficiency
    let averageTravelTime = 60; // minutes, base case
    let peoplePerHour = 0;
    let vehiclesPerHour = 0;
    let vehicleAvgSpeed = 0; // mph
    let brtAvgSpeed = 0; // mph
    let primaryModeSpeed = 0; // Speed of primary mode
    
    const distance = 20; // miles - fixed distance for all calculations
    
    // Get transport choices by type
    const transitChoices = transportChoices.filter(choice => choice.tool.type === 'transit');
    const activeChoices = transportChoices.filter(choice => choice.tool.type === 'active');
    
    if (totalHighwayVehicleCapacity === 0 && transitChoices.length === 0 && activeChoices.length === 0) {
      // No transportation infrastructure
      averageTravelTime = 999; // Can't get there
      peoplePerHour = 0;
      vehiclesPerHour = 0;
    } else {
      // Calculate highway vehicle throughput and speed if highways exist
      if (totalHighwayVehicleCapacity > 0) {
        // For V/C ratio, use peak hour vehicle demand to show traffic pressure
        const volumeToCapacityRatio = peakHourVehicles / totalHighwayVehicleCapacity;
        
        // Determine flow efficiency based on V/C ratio
        const flowEfficiency = volumeToCapacityRatio > TRAFFIC_FLOW_CONSTANTS.OVERCAPACITY_THRESHOLD 
          ? TRAFFIC_FLOW_CONSTANTS.BREAKDOWN_FLOW_EFFICIENCY 
          : TRAFFIC_FLOW_CONSTANTS.STABLE_FLOW_EFFICIENCY;
        
        // Calculate actual throughput
        vehiclesPerHour = Math.round(totalHighwayVehicleCapacity * flowEfficiency);
        
        // Calculate vehicle speed using helper function
        // Use peakHourVehicles (peak hour demand) as volume
        vehicleAvgSpeed = calculateVehicleSpeed(peakHourVehicles, totalHighwayVehicleCapacity);
      }
      
      // Calculate BRT speed if present
      if (transitChoices.some(choice => choice.tool.id === 'brt') && peakHourBRTUsers > 0) {
        brtAvgSpeed = 27; // BRT average speed with stops
      }
      
      // Determine primary mode speed and travel time
      if (transitChoices.length > 0 && peakHourBRTUsers > 0) {
        // Transit is primary mode
        primaryModeSpeed = brtAvgSpeed || 27;
        averageTravelTime = Math.round((distance / primaryModeSpeed) * 60);
      } else if (activeChoices.length > 0 && nonCarUsers > 0) {
        // Active transport is primary mode
        primaryModeSpeed = 12; // Bike average speed
        averageTravelTime = Math.round((distance / primaryModeSpeed) * 60);
      } else if (totalHighwayVehicleCapacity > 0) {
        // Highway is primary mode
        primaryModeSpeed = vehicleAvgSpeed;
        averageTravelTime = Math.round((distance / primaryModeSpeed) * 60);
      }
      
      // Calculate total people moved per hour
      const transitPeoplePerHour = peakHourBRTUsers;
      const activePeoplePerHour = nonCarUsers;
      const vehiclePeoplePerHour = vehiclesUsed * 1.2;
      peoplePerHour = Math.round(transitPeoplePerHour + activePeoplePerHour + vehiclePeoplePerHour);
      
      // If vehiclesPerHour wasn't calculated (no highways), use vehiclesUsed as the hourly rate
      if (vehiclesPerHour === 0 && vehiclesUsed > 0) {
        vehiclesPerHour = vehiclesUsed;
      }
    }

      // Calculate V/C ratio for display
      let volumeCapacityRatio = 0;
      if (totalHighwayVehicleCapacity > 0) {
        // V/C ratio uses vehicle ADT (vehicles only, not BRT which has dedicated lanes)
        volumeCapacityRatio = peakHourVehicles / totalHighwayVehicleCapacity;
      }

      // Calculate total peak hour traffic (people traveling by all modes)
      const totalPeakHourTraffic = (vehiclesUsed * 1.2) + peakHourBRTUsers + nonCarUsers;

      const newStats = {
        // Population counts
        people: peakHourPeople,
        peakHourPeople: peakHourPeople,
        totalPeakHourTraffic: Math.round(totalPeakHourTraffic),
        adt: Math.ceil(vehicleADT),
        totalADT: Math.ceil(totalADT),
        
        // Vehicle/Car specific stats
        cars: peakHourVehicles, // For Level 1 display compatibility
        carsUsed: vehiclesUsed, // deprecated, use vehiclesUsed
        vehiclesUsed: vehiclesUsed,
        peakHourVehicles: peakHourVehicles,
        vehicleAvgSpeed: Math.round(vehicleAvgSpeed),
        vehiclesPerHour: vehiclesPerHour,
        
        // Transit specific stats (BRT)
        transitUsed: peakHourBRTUsers, // Generic for backwards compatibility
        peakHourBRTUsers: peakHourBRTUsers,
        totalBRTUsers: Math.floor(totalBRTUsers),
        brtAvgSpeed: Math.round(brtAvgSpeed),
        
        // Active transport specific stats
        activeUsers: nonCarUsers, // deprecated, use nonCarUsers
        nonCarUsers: nonCarUsers,
        
        // Infrastructure and space stats
        downtownParking: downtownParkingPercent,
        parkingSpotsNeeded: parkingSpotsNeeded,
        parkingSpaceNeeded: parkingSpaceNeeded,
        totalDowntownSpace: totalDowntownSpace,
        
        // Cost and efficiency stats
        cost: totalCost,
        efficiency: Math.round((peakHourBRTUsers + nonCarUsers) / peakHourPeople * 100),
        
        // Performance stats
        averageTravelTime: averageTravelTime,
        peoplePerHour: peoplePerHour,
        primaryModeSpeed: Math.round(primaryModeSpeed),
        volumeCapacityRatio: Math.round(volumeCapacityRatio * 100) / 100,
        
        // Safety and personal cost impacts
        trafficDeathsPerYear: Math.round(trafficDeathsPerYear * 100) / 100,
        personalCostPerYear: personalCostPerYear,
        
        // Speed calculation details for modal
        speedCalculation: totalHighwayVehicleCapacity > 0 ? {
          volume: peakHourVehicles, // Peak hour vehicle demand from vehicleADT
          capacity: totalHighwayVehicleCapacity, // Highway capacity
          throughput: vehiclesPerHour, // Actual throughput after flow efficiency
          freeFlowSpeed: 65,
          theoreticalCapacity: totalHighwayVehicleCapacity,
          flowEfficiency: volumeCapacityRatio > TRAFFIC_FLOW_CONSTANTS.OVERCAPACITY_THRESHOLD 
            ? TRAFFIC_FLOW_CONSTANTS.BREAKDOWN_FLOW_EFFICIENCY 
            : TRAFFIC_FLOW_CONSTANTS.STABLE_FLOW_EFFICIENCY,
          vcRatio: Math.round(volumeCapacityRatio * 100) / 100,
          actualSpeed: vehicleAvgSpeed
        } : null
      };

    setStats(newStats);
  }, [transportChoices, level, brtFleetSize, highwayLanes]);

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
    setLevel(2);
  };

  const handleBrtFleetChange = (change) => {
    setBrtFleetSize(prev => Math.max(10, Math.min(100, prev + change)));
  };

  const handleHighwayLaneChange = (change) => {
    setHighwayLanes(prev => Math.max(2, Math.min(24, prev + change)));
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
      {/* Game HUD Header */}
      <div className="game-header">
        <div className="level-info">
          <div className="level-badge">Level {level}</div>
          <div className="objective-mini">
            Goal: {levelData[level].goal}
          </div>
        </div>
        <div className="stats-mini">
          <div className="stat-mini">
            <span>🅿️</span>
            <span className="stat-mini-value">{Math.round(stats.downtownParking)}%</span>
          </div>
          <div className="stat-mini">
            <span>⏱️</span>
            <span className="stat-mini-value">
              {stats.averageTravelTime === 999 ? 'N/A' : `${stats.averageTravelTime}min`}
            </span>
          </div>
          <div className="stat-mini">
            <span>💰</span>
            <span className="stat-mini-value">${Math.round(stats.cost/1000000)}M</span>
          </div>
        </div>
      </div>

      {/* Main Game Content */}
      <div className="game-content">
        {/* Stats Grid */}
        <div className="stats-grid-container">
          {/* Row 1 - Traffic Volumes */}
          <div className="stat-item" title="Average Daily Traffic - total vehicles entering downtown per day">
            <span className="stat-label">ADT</span>
            <span className="stat-value">{formatLargeNumber(stats.adt || 0)}</span>
          </div>
          <div className="stat-item" title="Total Peak Traffic - all people traveling during peak hour">
            <span className="stat-label">Total Peak Traffic</span>
            <span className="stat-value">{formatLargeNumber(stats.totalPeakHourTraffic || 0)}</span>
          </div>
          <div className="stat-item" title="Total Peak Vehicles - vehicles during peak hour">
            <span className="stat-label">Total Peak Vehicles</span>
            <span className="stat-value">{formatLargeNumber(stats.peakHourVehicles || 0)}</span>
          </div>
          <div className="stat-item" title="Total Peak BRT Traffic - BRT riders during peak hour">
            <span className="stat-label">Total Peak BRT</span>
            <span className="stat-value">{formatLargeNumber(stats.peakHourBRTUsers || 0)}</span>
          </div>
          
          {/* Row 2 - Capacity & Speed */}
          <div className="stat-item" title="Theoretical highway capacity in vehicles per hour">
            <span className="stat-label">Lane Capacity</span>
            <span className="stat-value">{formatLargeNumber((stats.speedCalculation?.capacity || 0))}/hr</span>
          </div>
          <div className="stat-item" title="Current Volume/Capacity Ratio">
            <span className="stat-label">Current V/C</span>
            <span className="stat-value">{stats.volumeCapacityRatio}</span>
          </div>
          <div className="stat-item" title="Vehicle Speed on highway">
            <span className="stat-label">Vehicle Speed</span>
            <span className="stat-value">{stats.vehicleAvgSpeed || 0} mph</span>
          </div>
          <div className="stat-item" title="BRT Speed with stops">
            <span className="stat-label">BRT Speed</span>
            <span className="stat-value">{stats.brtAvgSpeed || 0} mph</span>
          </div>
          
          {/* Row 3 - Outcomes */}
          <div className="stat-item" title="Downtown space used for parking">
            <span className="stat-label">Parking</span>
            <span className="stat-value highlight">{Math.round(stats.downtownParking)}%</span>
          </div>
          <div className="stat-item" title="Average travel time">
            <span className="stat-label">Travel Time</span>
            <span className="stat-value">{stats.averageTravelTime === 999 ? 'N/A' : `${stats.averageTravelTime}min`}</span>
          </div>
          {level === 1 && stats.trafficDeathsPerYear > 0 ? (
            <>
              <div className="stat-item warning" title="Estimated annual traffic fatalities">
                <span className="stat-label">Deaths/yr</span>
                <span className="stat-value">{stats.trafficDeathsPerYear}</span>
              </div>
              <div className="stat-item warning" title="Total annual cost of car ownership">
                <span className="stat-label">Personal $</span>
                <span className="stat-value">${Math.round(stats.personalCostPerYear/1000000)}M</span>
              </div>
            </>
          ) : (
            <>
              <div className="stat-item" title="Infrastructure cost">
                <span className="stat-label">Cost</span>
                <span className="stat-value">${Math.round(stats.cost/1000000)}M</span>
              </div>
              <div className="stat-item" title="Percentage using sustainable transport">
                <span className="stat-label">Efficiency</span>
                <span className="stat-value">{stats.efficiency}%</span>
              </div>
            </>
          )}
        </div>

        {/* City Visualization */}
        <div className="city-view">
          <div className="corridor-visual">
            <div className="city-section suburbs">
              <div className="city-icon">🏘️</div>
              <h4>Suburbs</h4>
              <div className="city-stats">
                <div>{stats.adt?.toLocaleString()} ADT</div>
                <div>{stats.totalPeakHourTraffic?.toLocaleString()} peak</div>
              </div>
            </div>
            
            <div className="transport-corridor-visual">
              {/* Combined Highway and BRT Animation */}
              {transportChoices.some(choice => choice.tool.type === 'highway') && (
                <div className="highway-animation">
                  <div className="highway-container">
                    {/* Inbound lanes (to downtown) */}
                    <div className="highway-direction">
                      {/* BRT lane on outer edge if BRT exists */}
                      {transportChoices.some(choice => choice.tool.id === 'brt') && (
                        <div className="highway-lane brt-lane">
                          {[...Array(Math.min(3, Math.ceil(brtFleetSize / 30)))].map((_, i) => (
                            <div
                              key={`bus-in-${i}`}
                              className="bus"
                              style={{
                                animationDelay: `${i * 4}s`,
                                animationDuration: `${120 / brtFleetSize}s`
                              }}
                            >
                              🚌
                            </div>
                          ))}
                        </div>
                      )}
                      {[...Array(highwayLanes / 2)].map((_, laneIndex) => {
                        // Calculate cars per lane based on V/C ratio
                        const vcRatio = stats.volumeCapacityRatio || 0;
                        
                        // For V/C >= 1, we need continuous cars
                        // Assuming each car+gap takes about 40px, and container is ~800px wide
                        // That's about 20 car positions across the screen
                        let carsPerLane = 3;
                        
                        if (vcRatio >= 1.0) {
                          // Gridlock - continuous stream of cars
                          carsPerLane = 20;
                        } else if (vcRatio > 0.8) {
                          // Near capacity - very dense
                          carsPerLane = 15;
                        } else if (vcRatio > 0.6) {
                          // Heavy traffic
                          carsPerLane = 10;
                        } else if (vcRatio > 0.4) {
                          // Moderate traffic
                          carsPerLane = 6;
                        } else if (vcRatio > 0.2) {
                          // Light traffic
                          carsPerLane = 4;
                        } else {
                          // Very light
                          carsPerLane = 2;
                        }
                        
                        return (
                          <div key={`lane-in-${laneIndex}`} className="highway-lane">
                            {[...Array(carsPerLane)].map((_, carIndex) => {
                              // For packed traffic, space cars evenly across the animation duration
                              const animationDuration = vcRatio >= 1.0 ? 20 : 
                                                       vcRatio > 0.8 ? 15 :
                                                       vcRatio > 0.6 ? 12 :
                                                       vcRatio > 0.4 ? 10 : 8;
                              
                              return (
                                <div
                                  key={`car-in-${laneIndex}-${carIndex}`}
                                  className={`car ${vcRatio >= 1.0 ? 'packed' : stats.vehicleAvgSpeed < 20 ? 'slow' : stats.vehicleAvgSpeed < 40 ? 'medium' : 'fast'}`}
                                  style={{
                                    animationDelay: `${(carIndex * animationDuration / carsPerLane) + (laneIndex * 0.2)}s`,
                                    animationDuration: `${animationDuration}s`
                                  }}
                                >
                                  🚗
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Center divider */}
                    <div className="highway-divider" />
                    
                    {/* Outbound lanes (from downtown) */}
                    <div className="highway-direction">
                      {[...Array(highwayLanes / 2)].map((_, laneIndex) => {
                        // Calculate cars per lane based on V/C ratio
                        const vcRatio = stats.volumeCapacityRatio || 0;
                        
                        // For V/C >= 1, we need continuous cars
                        let carsPerLane = 3;
                        
                        if (vcRatio >= 1.0) {
                          // Gridlock - continuous stream of cars
                          carsPerLane = 20;
                        } else if (vcRatio > 0.8) {
                          // Near capacity - very dense
                          carsPerLane = 15;
                        } else if (vcRatio > 0.6) {
                          // Heavy traffic
                          carsPerLane = 10;
                        } else if (vcRatio > 0.4) {
                          // Moderate traffic
                          carsPerLane = 6;
                        } else if (vcRatio > 0.2) {
                          // Light traffic
                          carsPerLane = 4;
                        } else {
                          // Very light
                          carsPerLane = 2;
                        }
                        
                        return (
                          <div key={`lane-out-${laneIndex}`} className="highway-lane">
                            {[...Array(carsPerLane)].map((_, carIndex) => {
                              // For packed traffic, space cars evenly across the animation duration
                              const animationDuration = vcRatio >= 1.0 ? 20 : 
                                                       vcRatio > 0.8 ? 15 :
                                                       vcRatio > 0.6 ? 12 :
                                                       vcRatio > 0.4 ? 10 : 8;
                              
                              return (
                                <div
                                  key={`car-out-${laneIndex}-${carIndex}`}
                                  className={`car reverse ${vcRatio >= 1.0 ? 'packed' : stats.vehicleAvgSpeed < 20 ? 'slow' : stats.vehicleAvgSpeed < 40 ? 'medium' : 'fast'}`}
                                  style={{
                                    animationDelay: `${(carIndex * animationDuration / carsPerLane) + (laneIndex * 0.2) + 0.5}s`,
                                    animationDuration: `${animationDuration}s`
                                  }}
                                >
                                  🚙
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                      {/* BRT lane on outer edge if BRT exists */}
                      {transportChoices.some(choice => choice.tool.id === 'brt') && (
                        <div className="highway-lane brt-lane">
                          {[...Array(Math.min(3, Math.ceil(brtFleetSize / 30)))].map((_, i) => (
                            <div
                              key={`bus-out-${i}`}
                              className="bus reverse"
                              style={{
                                animationDelay: `${i * 4 + 2}s`,
                                animationDuration: `${120 / brtFleetSize}s`
                              }}
                            >
                              🚌
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Other transport icons */}
              <div className="active-transport-line">
                {transportChoices
                  .filter(choice => choice.tool.type !== 'highway' && choice.tool.id !== 'brt')
                  .map(choice => (
                    <span key={choice.id}>{choice.tool.icon}</span>
                  ))}
              </div>
            </div>
            
            <div className="city-section downtown">
              <div className="city-icon">🏙️</div>
              <h4>Downtown</h4>
              <div className="city-stats">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{width: `${Math.min(100, stats.downtownParking)}%`}}
                  />
                </div>
                <div>{Math.round(stats.downtownParking)}% parking</div>
              </div>
            </div>
          </div>
        </div>

        {/* Transport Selector */}
        <div className="transport-selector">
          <h3>🛠️ Choose Transport</h3>
          <div className="transport-icons">
            {levelData[level].unlocked.map(tool => (
              <div key={tool.id} className="transport-option-wrapper">
                <div 
                  className={`transport-icon-btn ${selectedTool?.id === tool.id ? 'selected' : ''}`}
                  onClick={() => handleToolSelect(tool)}
                  title={`${tool.name}: ${tool.capacity.toLocaleString()}/hr capacity`}
                >
                  <div className="transport-emoji">{tool.icon}</div>
                  <div className="transport-label">{tool.name}</div>
                  <div className="transport-cost">${Math.round(tool.cost/1000000)}M</div>
                </div>
                {/* Counter controls below when selected */}
                {selectedTool?.id === tool.id && tool.id === 'brt' && (
                  <div className="transport-counter-pill">
                    <button 
                      className="counter-btn"
                      onClick={() => handleBrtFleetChange(-10)}
                      disabled={brtFleetSize <= 10}
                    >-</button>
                    <span className="counter-value">{brtFleetSize} buses</span>
                    <button 
                      className="counter-btn"
                      onClick={() => handleBrtFleetChange(10)}
                      disabled={brtFleetSize >= 100}
                    >+</button>
                  </div>
                )}
                {selectedTool?.id === tool.id && tool.id === 'highway' && (
                  <div className="transport-counter-pill">
                    <button 
                      className="counter-btn"
                      onClick={() => handleHighwayLaneChange(-2)}
                      disabled={highwayLanes <= 2}
                    >-</button>
                    <span className="counter-value">{highwayLanes} lanes</span>
                    <button 
                      className="counter-btn"
                      onClick={() => handleHighwayLaneChange(2)}
                      disabled={highwayLanes >= 24}
                    >+</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="game-actions">
            <button 
              className="game-btn add-transport-btn"
              onClick={handleAddTransport}
              disabled={!selectedTool}
            >
              Build {selectedTool?.name || 'Transport'}
            </button>
            <button className="game-btn reset-btn" onClick={resetLevel}>
              Reset
            </button>
          </div>
        </div>

        {/* Active Transports */}
        {transportChoices.length > 0 && (
          <div className="active-transports">
            <div className="transport-list">
              {transportChoices.map(choice => (
                <div key={choice.id} className="transport-badge">
                  <span>{choice.tool.icon}</span>
                  <span>{choice.tool.name}</span>
                  {choice.tool.id === 'brt' && (
                    <span>({brtFleetSize} buses)</span>
                  )}
                  {choice.tool.id === 'highway' && (
                    <span>({highwayLanes} lanes)</span>
                  )}
                  <button 
                    className="remove-btn"
                    onClick={() => handleRemoveChoice(choice.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Level Progress */}
        {canAdvanceLevel() && (
          <div className="level-complete">
            <div className="success-message">✅ Goal Achieved!</div>
            <button 
              className="next-level-btn" 
              onClick={handleNextLevel}
            >
              {level < 3 ? 'Next Level' : 'Complete Game'}
            </button>
          </div>
        )}
        
        {/* Level 1 Give Up Button */}
        {!canAdvanceLevel() && level === 1 && transportChoices.length > 0 && (
          <div className="level-feedback">
            <p>🎯 <strong>Highway Challenge:</strong> Goal: ≤{levelData[level].maxParking}% parking</p>
            <p>Current: {Math.round(stats.downtownParking)}% parking</p>
            <button 
              className="unlock-transit-btn"
              onClick={handleUnlockTransit}
            >
              I give up! ⚡ Give me other transit options ⚡
            </button>
          </div>
        )}
      </div>

      {/* Compact Stats Sidebar */}
      <div className="game-stats">
        <div className="stat-row">
          <span className="stat-label">Peak Hour</span>
          <span className="stat-value">{stats.totalPeakHourTraffic?.toLocaleString()}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Travel Time</span>
          <span className="stat-value">{stats.averageTravelTime === 999 ? 'N/A' : `${stats.averageTravelTime}min`}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">V/C Ratio</span>
          <span className="stat-value">{stats.volumeCapacityRatio}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Efficiency</span>
          <span className="stat-value">{stats.efficiency}%</span>
        </div>
        {stats.speedCalculation && (
          <button 
            className="speed-info-btn"
            onClick={() => setShowSpeedModal(true)}
            style={{marginTop: '10px', width: '100%'}}
          >
            View Speed Details
          </button>
        )}
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
                <h4>📐 Speed Formula</h4>
                <div className="formula-box">
                  <p><strong>Based on V/C Ratio (Volume/Capacity):</strong></p>
                  <ul>
                    <li>V/C ≤ 0.5: Free flow speed (65 mph)</li>
                    <li>0.5 &lt; V/C ≤ 0.7: 5% speed reduction per 5% V/C increase</li>
                    <li>V/C &gt; 0.7: 20% base reduction + 10% per 5% V/C increase</li>
                    <li>Minimum speed: 8 mph (stop-and-go)</li>
                  </ul>
                </div>
              </div>

              <div className="calculation-section">
                <h4>🏗️ V/C Ratio and Throughput Calculation</h4>
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
                        Based on Highway Capacity Manual: 2,000 vehicles per lane per hour under ideal conditions<br/>
                        <strong>For {highwayLanes} lanes: {highwayLanes/2} inbound lanes × 2,000 = {stats.speedCalculation.capacity.toLocaleString()} vehicles/hour</strong>
                      </div>
                    </div>
                  </div>

                  <div className="capacity-step">
                    <div className="capacity-step-header">
                      <span className="capacity-step-number">2</span>
                      <span className="capacity-step-title">Calculate V/C Ratio</span>
                    </div>
                    <div className="capacity-step-content">
                      <div className="capacity-calc">
                        V/C = {stats.speedCalculation.volume.toLocaleString()} ÷ {stats.speedCalculation.capacity.toLocaleString()} = <strong>{stats.speedCalculation.vcRatio}</strong>
                      </div>
                      <div className="capacity-desc">
                        {stats.speedCalculation.vcRatio > 1.0 ? 
                          `Overcapacity! Demand exceeds supply → severe congestion` :
                          stats.speedCalculation.vcRatio > 0.7 ?
                          `Heavy traffic conditions → significant congestion` :
                          stats.speedCalculation.vcRatio > 0.5 ?
                          `Moderate traffic → some congestion` :
                          `Light traffic → free flow conditions`
                        }
                      </div>
                    </div>
                  </div>
                  
                  <div className="capacity-step">
                    <div className="capacity-step-header">
                      <span className="capacity-step-number">3</span>
                      <span className="capacity-step-title">Apply Traffic Flow Efficiency for Throughput</span>
                    </div>
                    <div className="capacity-step-content">
                      <div className="capacity-calc final-capacity">
                        {stats.speedCalculation.theoreticalCapacity.toLocaleString()} × {stats.speedCalculation.flowEfficiency} = {Math.round(stats.speedCalculation.theoreticalCapacity * stats.speedCalculation.flowEfficiency).toLocaleString()} vehicles/hour
                      </div>
                      <div className="capacity-desc">
                        {stats.speedCalculation.vcRatio > 1.0 ? 
                          `Breakdown flow efficiency = ${stats.speedCalculation.flowEfficiency} (stop-and-go conditions)` :
                          `Stable flow efficiency = ${stats.speedCalculation.flowEfficiency} (smooth traffic)`
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="calculation-section">
                <h4>📊 Key Values</h4>
                <div className="inputs-grid">
                  <div className="input-item">
                    <span className="input-label">Peak Hour Vehicles:</span>
                    <span className="input-value">{stats.speedCalculation.volume.toLocaleString()}</span>
                    <span className="input-desc">ADT × 0.07 (peak direction)</span>
                  </div>
                  <div className="input-item">
                    <span className="input-label">Highway Capacity:</span>
                    <span className="input-value">{stats.speedCalculation.capacity.toLocaleString()} veh/hr</span>
                    <span className="input-desc">{highwayLanes/2} lanes × 2,000</span>
                  </div>
                  <div className="input-item">
                    <span className="input-label">V/C Ratio:</span>
                    <span className="input-value">{stats.speedCalculation.vcRatio}</span>
                    <span className="input-desc">{Math.round(stats.speedCalculation.vcRatio * 100)}% of capacity</span>
                  </div>
                  <div className="input-item">
                    <span className="input-label">Free Flow Speed:</span>
                    <span className="input-value">{stats.speedCalculation.freeFlowSpeed} mph</span>
                    <span className="input-desc">Speed with no congestion</span>
                  </div>
                </div>
              </div>

              <div className="calculation-section">
                <h4>🔢 Speed Calculation Steps</h4>
                <div className="steps">
                  <div className="step">
                    <span className="step-number">1.</span>
                    <span className="step-text">
                      V/C Ratio = {stats.speedCalculation.volume.toLocaleString()} ÷ {stats.speedCalculation.capacity.toLocaleString()} = <strong>{stats.speedCalculation.vcRatio}</strong>
                    </span>
                  </div>
                  <div className="step">
                    <span className="step-number">2.</span>
                    <span className="step-text">
                      {stats.speedCalculation.vcRatio <= 0.5 ? 
                        `V/C ≤ 0.5 → No speed reduction (free flow)` :
                        stats.speedCalculation.vcRatio <= 0.7 ?
                        `0.5 < V/C ≤ 0.7 → Speed reduction = (${stats.speedCalculation.vcRatio} - 0.5) × 100 = ${((stats.speedCalculation.vcRatio - 0.5) * 100).toFixed(0)}%` :
                        `V/C > 0.7 → Speed reduction = 20% + ((${stats.speedCalculation.vcRatio} - 0.7) × 200) = ${(20 + ((stats.speedCalculation.vcRatio - 0.7) * 200)).toFixed(0)}%`
                      }
                    </span>
                  </div>
                  <div className="step">
                    <span className="step-number">3.</span>
                    <span className="step-text">
                      {(() => {
                        const reduction = stats.speedCalculation.vcRatio <= 0.5 ? 0 :
                                        stats.speedCalculation.vcRatio <= 0.7 ? (stats.speedCalculation.vcRatio - 0.5) :
                                        0.2 + ((stats.speedCalculation.vcRatio - 0.7) * 2);
                        return `Speed = 65 × (1 - ${reduction.toFixed(2)}) = ${(65 * (1 - reduction)).toFixed(1)} mph`;
                      })()}
                    </span>
                  </div>
                  <div className="step">
                    <span className="step-number">4.</span>
                    <span className="step-text">
                      Final speed = max(8, {(() => {
                        const reduction = stats.speedCalculation.vcRatio <= 0.5 ? 0 :
                                        stats.speedCalculation.vcRatio <= 0.7 ? (stats.speedCalculation.vcRatio - 0.5) :
                                        0.2 + ((stats.speedCalculation.vcRatio - 0.7) * 2);
                        return (65 * (1 - reduction)).toFixed(1);
                      })()}) = <strong className="final-result">{stats.speedCalculation.actualSpeed} mph</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="calculation-section">
                <h4>💡 Why This Speed?</h4>
                <div className="explanation-box">
                  {stats.speedCalculation.vcRatio > 1.0 ? (
                    <>
                      <p><strong>🚗 Severe Congestion:</strong> Peak hour demand ({stats.speedCalculation.volume.toLocaleString()} cars) exceeds the highway's capacity ({stats.speedCalculation.capacity.toLocaleString()} cars/hr).</p>
                      <p><strong>🐌 V/C Ratio = {stats.speedCalculation.vcRatio}:</strong> Traffic is operating at {Math.round(stats.speedCalculation.vcRatio * 100)}% of capacity, causing severe congestion.</p>
                      <p><strong>📈 Induced Demand Effect:</strong> Building more highway capacity attracted more traffic, keeping the system congested despite the expansion.</p>
                    </>
                  ) : (
                    <>
                      <p><strong>✅ V/C Ratio = {stats.speedCalculation.vcRatio}:</strong> The highway is operating at {Math.round(stats.speedCalculation.vcRatio * 100)}% of capacity.</p>
                      <p><strong>🚗 Traffic Conditions:</strong> {stats.speedCalculation.vcRatio <= 0.5 ? 'Free-flowing traffic with minimal congestion.' : stats.speedCalculation.vcRatio <= 0.7 ? 'Moderate congestion with some speed reduction.' : 'Heavy congestion with significant speed reduction.'}</p>
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