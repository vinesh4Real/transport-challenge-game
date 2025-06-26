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
  
  let speedReduction = 0;
  if (vcRatio <= 0.5) {
    speedReduction = 0; // No congestion below 50%
  } else if (vcRatio <= 0.7) {
    // 5% reduction per 5% V/C increase from 50% to 70%
    // (0.7 - 0.5) = 0.2 range, want 20% total reduction
    // So multiply by 100 to get percentage (0.2 * 100 = 20%)
    speedReduction = (vcRatio - 0.5) * 100 * 0.01; // Convert to decimal
  } else {
    // 20% reduction at 70%, then 10% reduction per 5% V/C increase
    // Each 0.05 increase = 10% more reduction = multiply by 200
    speedReduction = 0.2 + ((vcRatio - 0.7) * 200 * 0.01);
  }
  
  return Math.max(8, freeFlowSpeed * (1 - speedReduction));
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
      let averageDailyTraffic = 60000; // Base ADT with 2-lane highway
      
      if (highwayChoices.length > 0) {
        // Calculate induced traffic based on number of lanes
        if (HIGHWAY_INDUCED_TRAFFIC[highwayLanes]) {
          // Use predefined values for standard lane counts
          averageDailyTraffic = HIGHWAY_INDUCED_TRAFFIC[highwayLanes];
        } else {
          // For non-standard lane counts, interpolate
          const sortedLanes = Object.keys(HIGHWAY_INDUCED_TRAFFIC).map(Number).sort((a, b) => a - b);
          const lowerBound = sortedLanes.filter(lanes => lanes < highwayLanes).pop() || 2;
          const upperBound = sortedLanes.find(lanes => lanes > highwayLanes) || 24;
          
          const lowerADT = HIGHWAY_INDUCED_TRAFFIC[lowerBound];
          const upperADT = HIGHWAY_INDUCED_TRAFFIC[upperBound];
          
          // Linear interpolation
          const ratio = (highwayLanes - lowerBound) / (upperBound - lowerBound);
          averageDailyTraffic = Math.ceil(lowerADT + ratio * (upperADT - lowerADT));
        }
      }

      // BRT modal split calculations (Level 2+)
      const brtChoices = transportChoices.filter(choice => choice.tool.id === 'brt');
      console.log('BRT Debug:', { 
        brtChoices: brtChoices.length, 
        level, 
        transportChoices: transportChoices.map(c => c.tool.id),
        brtFleetSize 
      });
      
      if (brtChoices.length > 0 && level >= 2) {
        // BRT calculations based on fleet size
        // Use exact frequency for more accurate calculations
        const frequency = 118 / brtFleetSize; // exact minutes between buses
        const busesPerHour = 60 / frequency; // exact buses per hour
        
        // Load factors: Peak (1.0) vs Off-peak (0.689)
        const peakCapacityPerHour = busesPerHour * 160 * 1.0; // 160 passengers per articulated bus
        const offPeakCapacityPerHour = busesPerHour * 160 * 0.689;
        
        // Daily ridership: 6 peak hours + 10 off-peak hours
        const dailyRidership = (peakCapacityPerHour * 6) + (offPeakCapacityPerHour * 10);
        totalBRTUsers = Math.floor(dailyRidership);
        
        // Modal split: 75% from cars, 25% induced demand
        const carTripsRemoved = (dailyRidership * 0.75) / 1.2; // 1.2 people per car
        
        // Debug logging
        console.log('BRT Calculations:', {
          brtFleetSize,
          frequency,
          busesPerHour,
          peakCapacityPerHour,
          offPeakCapacityPerHour,
          dailyRidership,
          carTripsRemoved,
          originalADT: averageDailyTraffic,
          newADT: Math.max(0, averageDailyTraffic - carTripsRemoved)
        });
        
        // Reduce ADT by car trips removed
        averageDailyTraffic = Math.ceil(Math.max(0, averageDailyTraffic - carTripsRemoved));
      }
    
    // Unified vehicle and people counting system
    const peakHourVehicles = Math.round(averageDailyTraffic * 0.07); // Peak direction = 70% of 10% peak hour traffic
    const peakHourPeople = peakHourVehicles * 1.2; // Convert vehicles to people
    
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
      // For BRT, use actual peak hour capacity based on fleet size
      let actualPeakHourBRTCapacity = 0;
      if (brtChoices.length > 0) {
        const frequency = 118 / brtFleetSize;
        const busesPerHour = 60 / frequency;
        actualPeakHourBRTCapacity = busesPerHour * 160 * 1.0; // Peak hour capacity
      }
      
      // Use actual BRT capacity if available, otherwise use generic transit capacity
      const effectiveTransitCapacity = brtChoices.length > 0 ? actualPeakHourBRTCapacity : transitCapacity;
      
      peakHourBRTUsers = Math.floor(Math.min(effectiveTransitCapacity * 0.6, peakHourPeople * 0.8));
      nonCarUsers = Math.min(activeCapacity * 0.8, (peakHourPeople - peakHourBRTUsers) * 0.5);
      const remainingPeople = Math.max(0, peakHourPeople - peakHourBRTUsers - nonCarUsers);
      vehiclesUsed = Math.round(remainingPeople / 1.2); // Convert back to vehicles
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
      if (transportChoices.length > 0) {
        const totalHighwayVehicleCapacity = transportChoices
          .find(choice => choice.tool.type === 'highway')?.tool.capacity * (highwayLanes / 2);
        // Use peakHourVehicles (demand) not vehiclesUsed (after modal split) for V/C ratio
        volumeCapacityRatio = totalHighwayVehicleCapacity > 0 ? peakHourVehicles / totalHighwayVehicleCapacity : 0;
      }

      // Calculate total peak hour traffic (people traveling by all modes)
      const totalPeakHourTraffic = (vehiclesUsed * 1.2) + peakHourBRTUsers + nonCarUsers;

      const newStats = {
        // Population counts
        people: peakHourPeople,
        peakHourPeople: peakHourPeople,
        totalPeakHourTraffic: Math.round(totalPeakHourTraffic),
        adt: Math.ceil(averageDailyTraffic),
        
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
          volume: peakHourVehicles, // Peak hour vehicle demand
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
                 <p><strong>Distance:</strong> {stats.distance} miles average to downtown core</p>
                 <p><strong>Peak Hour Car Traffic:</strong> {`${Math.round(stats.peakHourVehicles * 1.2)?.toLocaleString()} people traveling by ${stats.peakHourVehicles?.toLocaleString()} personal vehicles`}.</p>
                 <p><strong>Peak Hour Transit Traffic:</strong> {`${stats.peakHourBRTUsers?.toLocaleString()} people using BRT`}.</p>
                 {stats.totalBRTUsers > 0 && (
                   <p><strong>Daily BRT Ridership:</strong> {`${stats.totalBRTUsers?.toLocaleString()} total daily BRT users`}.</p>
                 )}
                 <p><strong>Total Peak Hour Traffic:</strong> {`${stats.totalPeakHourTraffic?.toLocaleString()} people traveling downtown`}.</p>
               </div>
              <div className="suburb-visual">🏠🏠🏠🏠🏠</div>
            </div>
            
            <div className="corridor-section transport-zone">
              <h4>🛣️ Transportation Corridor (20-mile route)</h4>
              
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
                    <span className="stat-label">
                      {transportChoices.some(choice => choice.tool.type === 'highway') ? 'Veh-Speed:' : 'Speed:'}
                    </span>
                    <div className="stat-value-with-button">
                      <span className="stat-value">
                        {stats.averageTravelTime === 999 ? 'N/A' : `${stats.vehicleAvgSpeed} mph`}
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
                  {transportChoices.some(choice => choice.tool.id === 'brt') && (
                    <>
                      <div className="stat-item">
                        <span className="stat-label">BRT-Speed:</span>
                        <span className="stat-value">{stats.brtAvgSpeed} mph</span>
                      </div>
                    </>
                  )}
                  <div className="stat-item">
                    <span className="stat-label">People/Hour:</span>
                    <span className="stat-value">{stats.peoplePerHour}</span>
                  </div>
                  {transportChoices.some(choice => choice.tool.type === 'highway') && (
                    <div className="stat-item">
                      <span className="stat-label">Vehicles/Hour:</span>
                      <span className="stat-value">{stats.vehiclesPerHour.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="stat-item">
                    <span className="stat-label">V/C Ratio:</span>
                    <span className="stat-value">{stats.volumeCapacityRatio}</span>
                  </div>
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
                        
                        {choice.tool.id === 'brt' ? (
                          <div className="brt-fleet-controls">
                            <div className="fleet-size-controls">
                              <button 
                                className="fleet-btn"
                                onClick={() => handleBrtFleetChange(-10)}
                                disabled={brtFleetSize <= 10}
                              >
                                -10
                              </button>
                              <span className="fleet-size">
                                Fleet: {brtFleetSize} buses
                              </span>
                              <button 
                                className="fleet-btn"
                                onClick={() => handleBrtFleetChange(10)}
                                disabled={brtFleetSize >= 100}
                              >
                                +10
                              </button>
                            </div>
                            <div className="brt-stats">
                              <span className="frequency">
                                Frequency: {(118 / brtFleetSize).toFixed(1)} min
                              </span>
                              <span className="capacity">
                                {Math.round((60 / (118 / brtFleetSize)) * 160)} peak capacity/hr
                              </span>
                            </div>
                          </div>
                        ) : choice.tool.id === 'highway' ? (
                          <div className="highway-lane-controls">
                            <div className="lane-size-controls">
                              <button 
                                className="lane-btn"
                                onClick={() => handleHighwayLaneChange(-2)}
                                disabled={highwayLanes <= 2}
                              >
                                -2
                              </button>
                              <span className="lane-size">
                                {highwayLanes} lanes
                              </span>
                              <button 
                                className="lane-btn"
                                onClick={() => handleHighwayLaneChange(2)}
                                disabled={highwayLanes >= 24}
                              >
                                +2
                              </button>
                            </div>
                            <div className="highway-stats">
                              <span className="inbound-lanes">
                                {highwayLanes / 2} lanes inbound
                              </span>
                              <span className="capacity">
                                {(highwayLanes / 2 * 2000).toLocaleString()} vehicles/hr
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="transport-capacity">{choice.tool.capacity.toLocaleString()}/hr</span>
                        )}
                        
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
                    style={{width: `${(stats.vehiclesUsed * 1.2 / stats.peakHourPeople) * 100}%`}}
                  ></div>
                </div>
                <div className="split-value">{Math.round((stats.vehiclesUsed * 1.2 / stats.peakHourPeople) * 100)}%</div>
              </div>
              
              <div className="split-bar">
                <div className="split-label">🚊 Transit</div>
                <div className="split-visual">
                  <div 
                    className="split-fill transit"
                    style={{width: `${(stats.peakHourBRTUsers / stats.peakHourPeople) * 100}%`}}
                  ></div>
                </div>
                <div className="split-value">{Math.round((stats.peakHourBRTUsers / stats.peakHourPeople) * 100)}%</div>
              </div>
              
              <div className="split-bar">
                <div className="split-label">🚲 Active</div>
                <div className="split-visual">
                  <div 
                    className="split-fill active"
                    style={{width: `${((stats.nonCarUsers || 0) / stats.peakHourPeople) * 100}%`}}
                  ></div>
                </div>
                <div className="split-value">{Math.round(((stats.nonCarUsers || 0) / stats.peakHourPeople) * 100)}%</div>
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
                  {level === 1 && (
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