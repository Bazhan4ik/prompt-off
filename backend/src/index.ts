import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { GoogleGenAI } from '@google/genai';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });
const PORT = 3001;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  httpOptions: { apiVersion: 'v1alpha' },
});

app.use(cors());
app.use(express.json());

// ── Types ────────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  username: string;
  wins: number;
  losses: number;
  score: number;
}

interface RoomState {
  players: [string, string];
  topic: string;
  images: Map<string, { base64: string; mimeType: string }>;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const leaderboard: LeaderboardEntry[] = [
  { rank: 1,  username: 'PixelMaster99',  wins: 47, losses: 12, score: 2840 },
  { rank: 2,  username: 'PromptWizard',   wins: 43, losses: 15, score: 2650 },
  { rank: 3,  username: 'NeuralNomad',    wins: 39, losses: 18, score: 2410 },
  { rank: 4,  username: 'DreamForge_X',   wins: 35, losses: 20, score: 2200 },
  { rank: 5,  username: 'VectorViper',    wins: 31, losses: 22, score: 1980 },
  { rank: 6,  username: 'LatentLancer',   wins: 28, losses: 25, score: 1750 },
  { rank: 7,  username: 'GlitchGuru',     wins: 24, losses: 27, score: 1540 },
  { rank: 8,  username: 'SynthSorcerer',  wins: 21, losses: 30, score: 1320 },
  { rank: 9,  username: 'ByteBrawler',    wins: 18, losses: 32, score: 1100 },
  { rank: 10, username: 'QuantumQuill',   wins: 14, losses: 35, score:  890 },
];

const TOPICS = [
  'a cyberpunk samurai at midnight',
  'an underwater city at golden hour',
  'a dragon made of storm clouds',
  'a forest full of neon mushrooms',
  'a lonely robot in a flower field',
  'a wizard city floating in the sky',
  'a cat riding a motorcycle through space',
  'an ancient library inside a volcano',
  'a ghost town on the surface of Mars',
  'a giant whale swimming through the clouds',
];

// ── State ─────────────────────────────────────────────────────────────────────

const queue: string[] = [];
const rooms = new Map<string, RoomState>();
const socketToRoom = new Map<string, string>();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function generateImage(prompt: string): Promise<{ base64: string; mimeType: string }> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-preview-image-generation',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseModalities: ['IMAGE'] },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData);

  if (!imagePart?.inlineData?.data) throw new Error('No image returned from Gemini');

  return {
    base64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType ?? 'image/jpeg',
  };
}

// ── HTTP routes ───────────────────────────────────────────────────────────────

app.get('/api/leaderboard', (_req: Request, res: Response) => {
  res.json(leaderboard);
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// ── Socket.IO ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {

  socket.on('join_queue', () => {
    if (queue.includes(socket.id)) return;
    queue.push(socket.id);

    if (queue.length >= 2) {
      const [p1, p2] = queue.splice(0, 2);
      const roomId = `battle:${p1.slice(0, 6)}:${p2.slice(0, 6)}`;
      const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];

      const room: RoomState = { players: [p1, p2], topic, images: new Map() };
      rooms.set(roomId, room);
      socketToRoom.set(p1, roomId);
      socketToRoom.set(p2, roomId);

      io.sockets.sockets.get(p1)?.join(roomId);
      io.sockets.sockets.get(p2)?.join(roomId);
      io.to(roomId).emit('match_found', { roomId, topic });
    }
  });

  socket.on('submit_prompt', async ({ roomId, prompt }: { roomId: string; prompt: string }) => {
    const room = rooms.get(roomId);
    if (!room || room.images.has(socket.id)) return;

    socket.emit('generating');

    try {
      const image = await generateImage(prompt);
      room.images.set(socket.id, image);

      socket.emit('image_ready', image);

      if (room.images.size === 2) {
        const [p1, p2] = room.players;
        const payload = {
          roomId,
          images: {
            [p1]: room.images.get(p1)!,
            [p2]: room.images.get(p2)!,
          },
        };
        io.to(roomId).emit('both_ready', payload);
      }
    } catch (err) {
      console.error('Image generation failed:', err);
      socket.emit('generation_error', { message: 'Image generation failed. Please try again.' });
    }
  });

  socket.on('disconnect', () => {
    const queueIdx = queue.indexOf(socket.id);
    if (queueIdx !== -1) queue.splice(queueIdx, 1);

    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      socketToRoom.delete(socket.id);
      // notify opponent if battle was in progress
      socket.to(roomId).emit('opponent_disconnected');
    }
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
