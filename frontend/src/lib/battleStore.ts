import { writable } from 'svelte/store';

export interface ImageData {
  base64: string;
  mimeType: string;
}

export interface BattleData {
  roomId: string;
  topic: string;
  playerNumber: 1 | 2;
  myImage: ImageData;
  myPrompt: string;
  opponentImage: ImageData;
  opponentPrompt: string;
}

export const battleStore = writable<BattleData | null>(null);
