# Maintenance room QR payloads

The student and admin maintenance scanners accept two payload shapes that were already recognized by `StudentQRComplaint.jsx`:

- `SCAMPUS:ROOM:<room-code>`, where `<room-code>` is the entire non-empty text following the prefix. The admin room form allows punctuation and spaces, so the parser preserves the full code instead of imposing a narrower character set.
- An absolute `http://` or `https://` URL whose query string contains `location=<room-code>` or `room=<room-code>`.

Both forms identify a room by its database `room_code`. The scanners match the code against the authorized `/rooms` response before opening the student form or selecting a room in the admin interface.

Bare room codes, database room IDs, other `SCAMPUS:` payloads, JSON payloads, and URLs without a `location` or `room` query parameter are unsupported QR payloads. They are reported as invalid; the scanner does not guess an identifier or create a room. A student may enter a bare room code in the explicit manual-entry field, which performs the same exact directory lookup. Matching prefers an exact room code and rejects ambiguous case-insensitive matches.

Admin room QR images encode `SCAMPUS:ROOM:<room-code>`. Existing QR images using that prefix or a campus URL with `location` or `room` query parameters remain supported. After a successful lookup, the student sees the matched room and building, then chooses **Continue to Report an Issue**; the existing form receives the matched room code and building ID.

Room records have no separate verification column. The project treats an existing database `rooms` record as verified; adding one is restricted to an admin through Admin → Floors & Rooms after confirming the official campus inventory.
