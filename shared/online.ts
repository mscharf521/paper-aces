// Types for the online API, shared by the client and the server.
import type { Duel, ManeuverId, Seat } from "./rules";

export const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O, so codes read cleanly aloud
export const normalizeCode = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
export const isCode = (s: string) => /^[A-Z]{4}$/.test(s) && [...s].every(c => CODE_LETTERS.includes(c));

/** What a player sees. Tokens and the opponent's pick are never included. */
export interface OnlineView extends Duel {
  code: string;
  seat: Seat;
  joined: boolean;
  round: number;
  picked: { 1: boolean; 2: boolean };
  myPick: ManeuverId | null;
}

export type ApiRequest =
  | { action: "create" }
  | { action: "join"; code: string; token?: string }
  | { action: "state"; code: string; token: string }
  | { action: "pick"; code: string; token: string; turn: number; maneuver: ManeuverId }
  | { action: "rematch"; code: string; token: string }
  | { action: "leave"; code: string; token: string };

export interface ApiResponse { state: OnlineView; token?: string }
export interface ApiError { error: string }
