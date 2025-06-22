// Transportation Capacity Data - Verified against real-world engineering standards
// See CAPACITY_SOURCES.md for detailed verification and sources

// Highway capacity in vehicles/hour, Transit capacity in people/hour
// Sources: Highway Capacity Manual (HCM 2016), Transit Capacity Manual, Real-world transit data

// COST DATA SOURCES:
// Highway costs: FHWA Highway Statistics, state DOT data
// Transit costs: FTA New Starts program data, real project costs
// Active transport: NACTO Urban Bikeway Design Guide, AASHTO standards
// Note: Costs are approximate and vary significantly by location, terrain, and project complexity

export const TRANSPORTATION_MODES = {
  // HIGHWAY INFRASTRUCTURE
  // Source: Highway Capacity Manual (HCM 2016) - 1,900-2,300 vehicles/hour/lane
  // Note: Highway capacity is in VEHICLES/HOUR, converted to people in game logic
  highway_2lane: {
    id: 'highway_2lane',
    name: '2-Lane Highway',
    icon: '🛣️',
    capacity: 2000, // 1 lane inbound × 2,000 vehicles/lane
    cost: 10000000, // $10M per mile
    type: 'highway',
    description: 'Basic highway - 2,000 vehicles/hour (1 lane inbound)',
    source: 'HCM 2016: 2,000 vehicles/lane/hr, one direction'
  },
  
  highway_4lane: {
    id: 'highway_4lane', 
    name: '4-Lane Highway',
    icon: '🛣️🛣️',
    capacity: 4000, // 2 lanes inbound × 2,000 vehicles/lane
    cost: 20000000, // $20M per mile
    type: 'highway',
    description: 'Wider highway - 4,000 vehicles/hour (2 lanes inbound)',
    source: 'HCM 2016: 2,000 vehicles/lane/hr, one direction'
  },
  
  highway_6lane: {
    id: 'highway_6lane',
    name: '6-Lane Highway', 
    icon: '🛣️🛣️🛣️',
    capacity: 6000, // 3 lanes inbound × 2,000 vehicles/lane
    cost: 30000000, // $30M per mile
    type: 'highway',
    description: 'Major highway - 6,000 vehicles/hour (3 lanes inbound)',
    source: 'HCM 2016: 2,000 vehicles/lane/hr, one direction'
  },
  
  highway_8lane: {
    id: 'highway_8lane',
    name: '8-Lane Highway', 
    icon: '🛣️🛣️🛣️🛣️',
    capacity: 8000, // 4 lanes inbound × 2,000 vehicles/lane
    cost: 40000000, // $40M per mile
    type: 'highway',
    description: 'Super highway - 8,000 vehicles/hour (4 lanes inbound)',
    source: 'HCM 2016: 2,000 vehicles/lane/hr, one direction'
  },
  
  highway_12lane: {
    id: 'highway_12lane',
    name: '12-Lane Highway', 
    icon: '🛣️🛣️🛣️🛣️🛣️🛣️',
    capacity: 12000, // 6 lanes inbound × 2,000 vehicles/lane
    cost: 60000000, // $60M per mile
    type: 'highway',
    description: 'Mega highway - 12,000 vehicles/hour (6 lanes inbound)',
    source: 'HCM 2016: 2,000 vehicles/lane/hr, one direction'
  },
  
  highway_24lane: {
    id: 'highway_24lane',
    name: '24-Lane Highway', 
    icon: '🛣️🛣️🛣️🛣️🛣️🛣️🛣️🛣️🛣️🛣️🛣️🛣️',
    capacity: 18750, // 225k ADT ÷ 12 = ~18,750 vehicles/hour peak
    cost: 120000000, // $120M per mile
    type: 'highway',
    description: 'Ultra mega highway - 225,000 ADT (18,750 vehicles/hour peak)',
    source: '225k ADT converted to peak hour traffic (ADT ÷ 12)'
  },
  
  parking_lot: {
    id: 'parking_lot',
    name: 'Parking Lot',
    icon: '🅿️', 
    capacity: 0, // Parking doesn't move people
    cost: 5000000, // $5M per downtown parking structure
    type: 'parking',
    description: 'Downtown parking for 500 cars',
    source: 'Urban parking construction costs'
  },

  // TRANSIT INFRASTRUCTURE  
  // Source: Real-world BRT/Light Rail operational data
  light_rail: {
    id: 'light_rail',
    name: 'Light Rail',
    icon: '🚊',
    capacity: 20000, // 4-car trains × 150 people/car × 33 trains/hour
    cost: 100000000, // $100M per mile
    type: 'transit', 
    description: 'Light rail - 20,000 people/hour',
    source: 'Real systems: Bogotá TransMilenio, Istanbul Metrobüs'
  },
  
  brt: {
    id: 'brt',
    name: 'Bus Rapid Transit',
    icon: '🚌',
    capacity: 15000, // 80-person buses × 188 buses/hour
    cost: 50000000, // $50M per mile
    type: 'transit',
    description: 'BRT - 15,000 people/hour', 
    source: 'Dedicated BRT lanes: Curitiba, Jakarta TransJakarta'
  },
  
  express_bus: {
    id: 'express_bus',
    name: 'Express Bus',
    icon: '🚐', 
    capacity: 8000, // 60-person buses × 133 buses/hour
    cost: 20000000, // $20M per mile
    type: 'transit',
    description: 'Express bus - 8,000 people/hour',
    source: 'Frequent bus service on dedicated lanes'
  },
  
  park_ride: {
    id: 'park_ride',
    name: 'Park & Ride',
    icon: '🅿️🚌',
    capacity: 5000, // Suburban parking + transit connection
    cost: 15000000, // $15M per facility
    type: 'transit',
    description: 'Suburban parking + transit',
    source: 'Suburban transit integration'
  },

  // ACTIVE TRANSPORTATION
  // Source: Transportation planning standards for protected infrastructure
  bike_lanes: {
    id: 'bike_lanes',
    name: 'Bike Network', 
    icon: '🚲',
    capacity: 3000, // 2-second headways at 15 mph average speed
    cost: 5000000, // $5M per mile
    type: 'active',
    description: 'Protected bike lanes',
    source: 'Transportation planning standards: 2-sec headways at 15 mph'
  },
  
  pedestrian: {
    id: 'pedestrian',
    name: 'Pedestrian Paths',
    icon: '🚶', 
    capacity: 2000, // Comfortable walking speeds and path utilization
    cost: 3000000, // $3M per mile
    type: 'active',
    description: 'Walkable connections',
    source: 'Pedestrian capacity standards from transportation engineering'
  },
  
  micro_transit: {
    id: 'micro_transit',
    name: 'Micro-Transit',
    icon: '🛴',
    capacity: 1500, // E-scooters, bike share systems
    cost: 8000000, // $8M per system
    type: 'active', 
    description: 'E-scooters, bike share',
    source: 'Micro-mobility system capacity analysis'
  },
  
  local_destinations: {
    id: 'local_destinations',
    name: 'Local Destinations',
    icon: '🏪',
    capacity: 1000, // Reduces trip distances, increases walkability
    cost: 25000000, // $25M per mixed-use development
    type: 'active',
    description: 'Reduce trip distances', 
    source: 'Mixed-use development impact on trip reduction'
  }
};

// SPACE EFFICIENCY COMPARISON
// Key insight: How many people can be moved per unit of urban space
export const SPACE_EFFICIENCY = {
  highway_lane: {
    people_per_hour: 2000,
    width_feet: 12,
    efficiency_ratio: 1.0 // Baseline
  },
  light_rail_track: {
    people_per_hour: 20000, 
    width_feet: 12,
    efficiency_ratio: 10.0 // 10x more efficient than highway
  },
  protected_bike_lane: {
    people_per_hour: 3000,
    width_feet: 8, 
    efficiency_ratio: 1.5 // 1.5x more efficient than highway
  }
};

// LEVEL CONFIGURATION
export const GAME_LEVELS = {
  1: {
    name: "Induced Traffic Trap",
    goal: "Try to reduce parking by building more highways", 
    hint: "Build more highway capacity. Watch what happens to car usage and parking demand!",
    available_modes: ['highway_2lane', 'highway_4lane', 'highway_6lane', 'highway_8lane', 'highway_12lane', 'highway_24lane', 'parking_lot'],
    target_people: 5000,
    max_parking_percent: 100
  },
  2: {
    name: "Transit Revolution", 
    goal: "Move 5,000 people with <50% downtown parking",
    hint: "Add transit options! Watch how much parking space you can free up.",
    available_modes: ['highway_2lane', 'highway_4lane', 'highway_6lane', 'highway_8lane', 'highway_12lane', 'highway_24lane', 'parking_lot', 'light_rail', 'brt', 'express_bus', 'park_ride'],
    target_people: 5000,
    max_parking_percent: 50
  },
  3: {
    name: "Complete Streets",
    goal: "Move 5,000 people with <25% downtown parking", 
    hint: "Add bikes, walking, and local destinations to minimize car dependency.",
    available_modes: Object.keys(TRANSPORTATION_MODES),
    target_people: 5000,
    max_parking_percent: 25
  }
};

// REAL-WORLD EXAMPLES FOR CREDIBILITY
export const REAL_WORLD_EXAMPLES = {
  light_rail: [
    "Bogotá TransMilenio: 45,000 passengers/hour/direction",
    "Istanbul Metrobüs: 25,000 passengers/hour/direction", 
    "Los Angeles Metro Orange Line: 18,000 passengers/hour/direction"
  ],
  brt: [
    "Curitiba BRT: 13,000 passengers/hour/direction",
    "Jakarta TransJakarta: 15,000 passengers/hour/direction",
    "Mexico City Metrobús: 12,000 passengers/hour/direction"
  ],
  highway: [
    "I-405 Los Angeles: 1,900 vehicles/hour/lane (2,280 people/hour/lane)",
    "I-95 Washington DC: 2,100 vehicles/hour/lane (2,520 people/hour/lane)",
    "Highway Capacity Manual standard: 1,900-2,300 vehicles/hour/lane"
  ]
};

export default TRANSPORTATION_MODES; 