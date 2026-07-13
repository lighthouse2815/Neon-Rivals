import { z } from "zod";

import { ROOM_CODE_LENGTH } from "./constants";

export const vectorSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite()
});

export const inputCommandSchema = z.object({
  seq: z.number().int().nonnegative(),
  clientTime: z.number().nonnegative(),
  moveX: z.number().min(-1).max(1),
  moveY: z.number().min(-1).max(1),
  aimX: z.number().min(-1).max(1),
  aimY: z.number().min(-1).max(1),
  shoot: z.boolean(),
  dash: z.boolean()
});

export const playerNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(24)
  .regex(/^[\p{L}\p{N} _-]+$/u, "Player name contains invalid characters");

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(ROOM_CODE_LENGTH)
  .regex(/^[A-Z2-9]+$/);

export const createRoomSchema = z.object({
  playerName: playerNameSchema
});

export const joinRoomSchema = z.object({
  roomCode: roomCodeSchema,
  playerName: playerNameSchema
});

export const readySchema = z.object({
  roomCode: roomCodeSchema,
  ready: z.boolean()
});

export const leaveRoomSchema = z.object({
  roomCode: roomCodeSchema
});

export const rematchSchema = z.object({
  roomCode: roomCodeSchema
});

export const rematchRequestedSchema = z.object({
  roomCode: roomCodeSchema,
  requesterId: z.string().uuid(),
  requesterName: playerNameSchema
});

export const heartbeatSchema = z.object({
  roomCode: roomCodeSchema,
  reconnectToken: z.string().min(8).max(128).optional(),
  pingMs: z.number().int().min(0).max(9999).optional()
});

export const reconnectSchema = z.object({
  roomCode: roomCodeSchema,
  reconnectToken: z.string().min(8).max(128),
  playerName: playerNameSchema.optional()
});

export const gameInputSchema = z.object({
  roomCode: roomCodeSchema,
  input: inputCommandSchema
});

export const pingSchema = z.object({
  sentAt: z.number().nonnegative()
});
