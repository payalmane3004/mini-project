export function isDemoRoom(room) {
  return room?.is_demo === true
    || (typeof room?.room_code === "string" && room.room_code.toUpperCase().startsWith("DEMO-"));
}

export function filterOperationalRooms(rooms) {
  return rooms.filter((room) => !isDemoRoom(room));
}

export function isDemoFloorLabel(floorLabel) {
  return floorLabel?.is_demo === true
    || (typeof floorLabel?.label === "string" && floorLabel.label.toUpperCase().startsWith("DEMO "));
}

export function isSimulatedSource(source) {
  return typeof source === "string" && source.toUpperCase().includes("SIMULAT");
}

export function filterEnergyReadings(readings, sourceFilter) {
  return readings.filter((reading) => {
    const simulated = isSimulatedSource(reading.reading_source);
    return sourceFilter === "all" || (sourceFilter === "simulated" ? simulated : !simulated);
  });
}
