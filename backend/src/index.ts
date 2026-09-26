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

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

app.use(cors());
app.use(express.json());

// ── Types ────────────────────────────────────────────────────────────────────

interface PlayerStat {
  name: string;
  wins: number;
  losses: number;
  score: number;
}

interface ImageData {
  base64: string;
  mimeType: string;
}

interface Judgment {
  winner: 1 | 2;
  reason: string;
}

interface RoomState {
  players: [string, string];
  topic: string;
  trickType: string;
  referenceImage?: ImageData;
  guesses: Map<string, string>;
  judgment?: Judgment;
}

// ── State ─────────────────────────────────────────────────────────────────────

const queue: string[] = [];
const rooms = new Map<string, RoomState>();
const socketToRoom = new Map<string, string>();
const playerNames = new Map<string, string>();   // socketId → display name
const playerStats = new Map<string, PlayerStat>(); // name → cumulative stats

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOrCreateStats(name: string): PlayerStat {
  if (!playerStats.has(name)) {
    playerStats.set(name, { name, wins: 0, losses: 0, score: 0 });
  }
  return playerStats.get(name)!;
}

function buildLeaderboard() {
  return [...playerStats.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((s, i) => ({ rank: i + 1, username: s.name, wins: s.wins, losses: s.losses, score: s.score }));
}

const TRICKS = [
  {
    name: 'misleading scale',
    how: 'Make something huge look tiny or something tiny look huge, so players misjudge what they are looking at.',
    example: 'A tiny lighthouse made of sugar cubes on a kitchen counter',
  },
  {
    name: 'abstract concept',
    how: 'Show a feeling or everyday situation as a physical scene.',
    example: 'The feeling of forgetting why you walked into a room',
  },
  {
    name: 'reversal',
    how: 'Flip the normal roles of two things.',
    example: 'A goldfish walking a cat on a leash',
  },
  {
    name: 'style disguise',
    how: 'Draw an ordinary modern scene in an unexpected art style or material.',
    example: 'A crayon drawing of a traffic jam',
  },
  {
    name: 'hidden detail',
    how: 'A normal scene with one small odd detail that defines the prompt.',
    example: 'A birthday party where one candle is already blown out',
  },
  {
    name: 'idiom',
    how: 'Take a common English saying and show it word for word.',
    example: 'A literal elephant in the corner of an office meeting',
  },
] as const;
 
// Plain, everyday words. Add to these freely; the bigger the pools, the more variety.
const SUBJECTS = [
  'dog', 'cat', 'grandma', 'toddler', 'penguin', 'cow', 'snowman', 'robot', 'pizza',
  'toaster', 'bicycle', 'goldfish', 'chicken', 'firefighter', 'banana', 'shoe', 'cactus',
  'school bus', 'teddy bear', 'frog', 'giraffe', 'mailman', 'vacuum cleaner', 'duck',
  'birthday cake', 'umbrella', 'pirate', 'hamster', 'soccer ball', 'lamp', 'horse',
  'chef', 'rubber duck', 'octopus', 'traffic cone', 'sandwich', 'bee', 'wizard',
  'shopping cart', 'sloth', 'dentist', 'watermelon', 'owl', 'bus driver', 'sock',
];
 
const SETTINGS = [
  'a kitchen', 'a beach', 'a supermarket', 'a classroom', 'a bathtub', 'a parking lot',
  'a forest', 'a subway car', 'a laundromat', 'a farm', 'a hospital waiting room',
  'the moon', 'a bowling alley', 'a backyard', 'a library', 'a gas station', 'a desert',
  'a swimming pool', 'an elevator', 'a snowy street', 'a playground', 'a car wash',
  'a wedding', 'a dentist office', 'a camping tent', 'a rooftop', 'a bakery',
];
 
const STYLES = [
  'crayon drawing', 'LEGO', 'claymation', 'pixel art', 'watercolor', 'comic strip',
  'cave painting', 'knitted wool', 'cardboard cutout', 'chalk on a sidewalk',
  'stained glass', 'old black-and-white photo', 'cake frosting', 'origami',
];
 
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
 
// Remember recent prompts so the model doesn't repeat itself.
// (Per-server memory; move to Redis/DB if you run multiple instances.)
const recentPrompts: string[] = [];
const RECENT_LIMIT = 15;
 
async function generateTopic(): Promise<{ topic: string; trickType: string }> {
  const trick = pick(TRICKS);
  const subject = pick(SUBJECTS);
  const setting = pick(SETTINGS);
  const styleLine = trick.name === 'style disguise' ? `\n- Art style: ${pick(STYLES)}` : '';
 
  const avoid = recentPrompts.length
    ? `\nDo not repeat ideas from these recent prompts:\n${recentPrompts.map(p => `- ${p}`).join('\n')}\n`
    : '';
 
  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [{
      role: 'user',
      parts: [{
        text: `Write one image prompt for a guessing game. Players see the image and try to guess the prompt, so it should be tricky but fair.
 
Trick: ${trick.name} - ${trick.how}
Example of this trick: "${trick.example}"
 
Build it around:
- Subject: ${subject}
- Setting: ${setting}${styleLine}
(You can change the setting if it makes the trick work better, but keep the subject.)
 
Rules:
- Use simple, everyday words a 12-year-old knows. No art history, science or fancy terms.
- 8 to 15 words.
- Every important part must be clearly visible in the image.
- Don't copy the example.
${avoid}
Respond with JSON only: {"prompt": "..."}`,
      }],
    }],
    config: {
      responseMimeType: 'application/json',
      temperature: 1.2, // more variety in wording
    },
  });
 
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = JSON.parse(text);
  if (!parsed.prompt) throw new Error('No topic returned from Gemini');
 
  recentPrompts.push(parsed.prompt);
  if (recentPrompts.length > RECENT_LIMIT) recentPrompts.shift();
 
  // trickType comes from our own pick, so it's always one of the six labels.
  return { topic: parsed.prompt as string, trickType: trick.name };
}

async function generateImage(prompt: string): Promise<ImageData> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
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

async function judgeGuesses(
  originalTopic: string,
  guess1: string,
  guess2: string,
): Promise<Judgment> {
  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [{
      role: 'user',
      parts: [{
        text:
          `You are judging a reverse prompt guessing game. Score each guess on three dimensions:\n` +
          `- Subject (40 pts): did they identify the main subject correctly?\n` +
          `- Twist (40 pts): did they catch the trick — the scale, reversal, hidden detail, style, concept, or idiom?\n` +
          `- Style/detail (20 pts): did they capture specific wording, medium, or compositional details?\n\n` +
          `Original prompt: "${originalTopic}"\n` +
          `Player 1 guessed: "${guess1}"\n` +
          `Player 2 guessed: "${guess2}"\n\n` +
          `Pick the winner based on total score. In case of a tie, the player who caught the twist wins.\n\n` +
          `Respond with valid JSON only (no markdown fences):\n` +
          `{"winner": 1, "reason": "one sentence explanation that names what the twist was"}`,
      }],
    }],
    config: { responseMimeType: 'application/json' },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = JSON.parse(text);
  return { winner: parsed.winner as 1 | 2, reason: parsed.reason as string };
}

// ── HTTP routes ───────────────────────────────────────────────────────────────

app.get('/api/leaderboard', (_req: Request, res: Response) => {
  res.json(buildLeaderboard());
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// ── Socket.IO ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {

  socket.on('join_queue', ({ name }: { name: string }) => {
    const displayName = name.trim().slice(0, 32) || 'Anonymous';
    playerNames.set(socket.id, displayName);
    getOrCreateStats(displayName);

    if (queue.includes(socket.id)) return;
    queue.push(socket.id);

    if (queue.length >= 2) {
      const [p1, p2] = queue.splice(0, 2);
      const roomId = `battle:${p1.slice(0, 6)}:${p2.slice(0, 6)}`;

      const room: RoomState = { players: [p1, p2], topic: '', trickType: '', guesses: new Map() };
      rooms.set(roomId, room);
      socketToRoom.set(p1, roomId);
      socketToRoom.set(p2, roomId);

      io.sockets.sockets.get(p1)?.join(roomId);
      io.sockets.sockets.get(p2)?.join(roomId);

      const name1 = playerNames.get(p1) ?? 'Opponent';
      const name2 = playerNames.get(p2) ?? 'Opponent';

      io.sockets.sockets.get(p1)?.emit('match_found', { roomId, opponentName: name2 });
      io.sockets.sockets.get(p2)?.emit('match_found', { roomId, opponentName: name1 });

      generateTopic()
        .then(({ topic, trickType }) => {
          room.topic = topic;
          room.trickType = trickType;
          return generateImage(topic);
        })
        .then((img) => {
          room.referenceImage = img;
          io.to(roomId).emit('reference_ready', { referenceImage: img });
        })
        .catch((err) => {
          console.error('Challenge generation failed:', err);
          io.to(roomId).emit('reference_error', { message: 'Failed to generate the challenge image.' });
        });
    }
  });

  socket.on('submit_guess', ({ roomId, guess }: { roomId: string; guess: string }) => {
    const room = rooms.get(roomId);
    if (!room || room.guesses.has(socket.id)) return;

    room.guesses.set(socket.id, guess);
    socket.emit('guess_submitted');

    if (room.guesses.size === 2) {
      const [p1, p2] = room.players;
      const payload = {
        roomId,
        topic: room.topic,
        players: room.players,
        playerNames: { [p1]: playerNames.get(p1) ?? 'Player 1', [p2]: playerNames.get(p2) ?? 'Player 2' },
        referenceImage: room.referenceImage,
        guesses: {
          [p1]: room.guesses.get(p1)!,
          [p2]: room.guesses.get(p2)!,
        },
      };
      io.to(roomId).emit('both_ready', payload);

      judgeGuesses(room.topic, room.guesses.get(p1)!, room.guesses.get(p2)!)
        .then((judgment) => {
          room.judgment = judgment;

          // Update leaderboard stats
          const winnerId = judgment.winner === 1 ? p1 : p2;
          const loserId = judgment.winner === 1 ? p2 : p1;
          const winnerName = playerNames.get(winnerId);
          const loserName = playerNames.get(loserId);
          if (winnerName) {
            const s = getOrCreateStats(winnerName);
            s.wins += 1;
            s.score += 100;
          }
          if (loserName) {
            getOrCreateStats(loserName).losses += 1;
          }

          io.to(roomId).emit('judgment_result', { ...judgment, originalTopic: room.topic, trickType: room.trickType });
        })
        .catch((err) => {
          console.error('Judging failed:', err);
          io.to(roomId).emit('judgment_error', { message: 'Judging failed.' });
        });
    }
  });

  socket.on('join_judging', ({ roomId }: { roomId: string }) => {
    socket.join(roomId);
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.judgment) {
      socket.emit('judgment_result', { ...room.judgment, originalTopic: room.topic, trickType: room.trickType });
    }
  });

  socket.on('disconnect', () => {
    const queueIdx = queue.indexOf(socket.id);
    if (queueIdx !== -1) queue.splice(queueIdx, 1);

    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      socketToRoom.delete(socket.id);
      socket.to(roomId).emit('opponent_disconnected');
    }

    playerNames.delete(socket.id);
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
