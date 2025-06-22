# Transport Challenge Game

An interactive web-based game that demonstrates the space efficiency of different transportation modes through real-world transportation engineering data.

## About

This game challenges players to move 5,000 people through a transportation corridor using different infrastructure choices. Players discover that car-focused infrastructure requires dramatically more space and investment compared to transit and active transportation options.

## Key Features

- **Level-based progression** from car-only to complete streets
- **Real-time statistics** showing people capacity, costs, and space usage
- **Evidence-based gameplay** using verified transportation engineering data
- **Interactive tool selection** with immediate visual feedback

## Game Levels

1. **Highway Hell** - Car infrastructure only (shows limitations)
2. **Transit Revolution** - Introduces bus rapid transit and light rail
3. **Complete Streets** - Adds cycling, walking, and mixed-use development

## Educational Value

The game demonstrates the fundamental space efficiency differences between transportation modes:

- **Highway lane**: ~2,000 people/hour
- **Light rail track**: ~20,000 people/hour (10x more efficient)
- **Protected bike lane**: ~3,000 people/hour (1.5x more efficient)

## Data Credibility

All transportation capacity numbers are based on established engineering standards:

- **Highway Capacity Manual (HCM 2016)** - Official US transportation standard
- **Real-world transit system data** from major BRT and light rail networks
- **Transportation Research Board** guidelines for active transportation

See [CAPACITY_SOURCES.md](./CAPACITY_SOURCES.md) for detailed verification and sources.

## Getting Started

```bash
npm install
npm start
```

The game will open in your browser at `http://localhost:3000`.

## Technology

- React.js for interactive UI
- CSS3 for modern styling and animations
- Real-time state management for game mechanics

## Purpose

This game makes the abstract concept of "transportation space efficiency" visceral and immediate. Players experience firsthand why car-dependent infrastructure struggles to serve growing urban populations, while transit and active transportation provide scalable solutions.

The dramatic capacity improvements players see aren't exaggerated - they reflect the actual engineering reality documented in transportation planning standards worldwide.

---

*An educational tool for understanding sustainable transportation planning* 