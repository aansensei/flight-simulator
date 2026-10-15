import { CESSNA_172_SPECS } from './types';

export type AircraftId = 'skyhawk' | 'ranger' | 'coastal';
export const AIRCRAFT_PROFILES = {
  skyhawk: { name: 'Cessna 172 Skyhawk', bestClimbKnots: 74, engines: 1, specs: CESSNA_172_SPECS },
  ranger: {
    name: 'Ranger 260 STOL', bestClimbKnots: 72, engines: 1,
    specs: { ...CESSNA_172_SPECS, wingspan: 12.1, wingArea: 18.1, aspectRatio: 8.09, meanChord: 1.50, mass: 1080, emptyMass: 790, mtow: 1300, maxPowerHp: 260, maxPowerWatts: 193882, propDiameter: 2.05, cd0: 0.034, inertia: { ixx: 1500, iyy: 1950, izz: 3000 } }
  },
  coastal: {
    name: 'Coastal Twin 620', bestClimbKnots: 95, engines: 2,
    specs: { ...CESSNA_172_SPECS, wingspan: 14, wingArea: 22.1, aspectRatio: 8.87, meanChord: 1.58, mass: 1860, emptyMass: 1300, mtow: 2350, maxPowerHp: 620, maxPowerWatts: 462334, propDiameter: 1.90, cd0: 0.033, inertia: { ixx: 3400, iyy: 4600, izz: 6500 } }
  }
} as const;
