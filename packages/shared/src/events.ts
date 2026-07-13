export const CLIENT_EVENTS = {
  createRoom: "room:create",
  joinRoom: "room:join",
  ready: "room:ready",
  leaveRoom: "room:leave",
  rematch: "room:rematch",
  heartbeat: "room:heartbeat",
  reconnect: "room:reconnect",
  input: "game:input",
  ping: "client:ping"
} as const;

export const SERVER_EVENTS = {
  welcome: "server:welcome",
  created: "room:created",
  joined: "room:joined",
  roomUpdate: "room:update",
  rematchRequested: "room:rematch-requested",
  countdown: "game:countdown",
  snapshot: "game:snapshot",
  gameEvent: "game:event",
  error: "server:error"
} as const;
