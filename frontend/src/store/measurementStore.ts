import { create } from 'zustand';
import { Measurement, MeasurementRoom } from '../types/measurement';

interface MeasurementState {
  measurements: Measurement[];
  activeMeasurement: Measurement | null;
  activeMeasurementRooms: MeasurementRoom[];
  setMeasurements: (measurements: Measurement[]) => void;
  setActiveMeasurement: (measurement: Measurement | null) => void;
  setActiveMeasurementRooms: (rooms: MeasurementRoom[]) => void;
}

export const useMeasurementStore = create<MeasurementState>((set) => ({
  measurements: [],
  activeMeasurement: null,
  activeMeasurementRooms: [],
  setMeasurements: (measurements) => set({ measurements }),
  setActiveMeasurement: (activeMeasurement) => set({ activeMeasurement }),
  setActiveMeasurementRooms: (activeMeasurementRooms) => set({ activeMeasurementRooms }),
}));
