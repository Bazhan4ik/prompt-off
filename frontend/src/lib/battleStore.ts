import { writable } from 'svelte/store';

export interface ImageData {
  base64: string;
  mimeType: string;
}

export interface BattleData {
  roomId: string;
  originalTopic: string;
  playerNumber: 1 | 2;
  referenceImage: ImageData;
  myGuess: string;
  opponentGuess: string;
  myName: string;
  opponentName: string;
}

export const battleStore = writable<BattleData | null>(null);
