function isOptionalText(value) {
  return value === null || value === undefined || typeof value === "string";
}

export function validateBuildingList(buildings) {
  if (!Array.isArray(buildings) || buildings.some((building) => (
    !building
    || typeof building !== "object"
    || Array.isArray(building)
    || !Number.isInteger(building.id)
    || typeof building.building_code !== "string"
    || typeof building.name !== "string"
    || !isOptionalText(building.description)
  ))) {
    throw new Error("The buildings API returned an unexpected response.");
  }
  return buildings;
}

export function validateRoomList(rooms) {
  if (!Array.isArray(rooms) || rooms.some((room) => (
    !room
    || typeof room !== "object"
    || Array.isArray(room)
    || !Number.isInteger(room.id)
    || !(room.building_id === null || Number.isInteger(room.building_id))
    || typeof room.room_code !== "string"
    || !isOptionalText(room.room_name)
    || !Number.isInteger(room.floor_number)
    || !(room.capacity === null || Number.isInteger(room.capacity))
    || typeof room.room_type !== "string"
  ))) {
    throw new Error("The rooms API returned an unexpected response.");
  }
  return rooms;
}
