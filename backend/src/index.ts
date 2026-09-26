import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});
const PORT = 3001;

app.use(cors());
app.use(express.json());

interface LeaderboardEntry {
  rank: number;
  username: string;
  wins: number;
  losses: number;
  score: number;
}

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

const queue: string[] = [];

interface MatchFoundPayload {
  roomId: string;
  topic: string;
}

app.get('/api/leaderboard', (_req: Request, res: Response) => {
  res.json(leaderboard);
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

io.on('connection', (socket) => {
  socket.on('join_queue', () => {
    if (queue.includes(socket.id)) return;
    queue.push(socket.id);

    if (queue.length >= 2) {
      const [p1, p2] = queue.splice(0, 2);
      const roomId = `battle:${p1}:${p2}`;
      const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];

      const payload: MatchFoundPayload = { roomId, topic };

      io.sockets.sockets.get(p1)?.join(roomId);
      io.sockets.sockets.get(p2)?.join(roomId);
      io.to(roomId).emit('match_found', payload);
    }
  });

  socket.on('disconnect', () => {
    const idx = queue.indexOf(socket.id);
    if (idx !== -1) queue.splice(idx, 1);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
