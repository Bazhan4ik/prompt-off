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

async function generateTopic(): Promise<{ topic: string; trickType: string }> {
  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [{
      role: 'user',
      parts: [{
        text: `You are designing prompts for a competitive AI image-guessing game. Players see a generated image and must guess the exact prompt that made it. Your goal is to make that as hard as possible while staying fair — every key element must actually be visible.

Pick ONE trick category and craft a prompt using it:

MISLEADING SCALE — make something huge look tiny or vice versa, or set an outdoor scene indoors.
Example: "A tiny lighthouse made of sugar cubes on a kitchen counter during a thunderstorm, shot from ground level"
Why it works: players guess "lighthouse in a storm" and miss it's miniature and indoors.
Example: "Macro photograph of frost on a car windshield that looks like a pine forest"
Why it works: the image reads as a forest; the real subject is hidden.

ABSTRACT CONCEPT RENDERED LITERALLY — depict a feeling, idea, or phrase as a physical scene.
Example: "The feeling of forgetting why you walked into a room"
Example: "Nostalgia for a place you've never been, as a vintage postcard"
Why it works: players describe what they see, not the concept behind it.

REVERSAL OR SWAP — flip the normal relationship between two things.
Example: "A goldfish walking a cat on a leash through a park"
Example: "An astronaut in the desert, looking up at Earth in the sky"
Why it works: players mentally correct the image back to the normal version.

STYLE DISGUISED AS SUBJECT — the medium or art style is the trick, not the content.
Example: "A Renaissance oil painting of a man waiting for his microwave to finish"
Example: "A medieval tapestry showing a traffic jam"
Why it works: players describe the solemn scene and miss the mundane punchline or anachronism.

EASY-TO-MISS DETAIL — the whole point is one or two small things most players overlook.
Example: "A crowded train platform where everyone is holding an umbrella except one child, and it isn't raining"
Example: "A birthday party where one candle on the cake is already blown out"
Why it works: players get the scene right but miss the specific detail that defines the prompt.

IDIOM OR WORDPLAY RENDERED LITERALLY — take a phrase or idiom and depict it word-for-word.
Example: "A literal elephant sitting in the corner of a quiet office meeting"
Example: "A cat made entirely of spaghetti, sitting in a colander"
Why it works: guessable only if the player makes the exact connection; impossible if they don't.

Additional rules:
- Use specific, niche, or technical vocabulary where possible (art movements, architectural terms, obscure species, scientific jargon)
- Every trick element must be clearly visible in the image — don't rely on details an image model might drop
- 8 to 18 words
- Do not reuse the examples above

Respond with valid JSON only (no markdown):
{"prompt": "the image prompt here", "trickType": "one of: misleading scale, abstract concept, reversal, style disguise, hidden detail, idiom"}`,
      }],
    }],
    config: { responseMimeType: 'application/json' },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = JSON.parse(text);
  if (!parsed.prompt) throw new Error('No topic returned from Gemini');
  return { topic: parsed.prompt as string, trickType: parsed.trickType as string };
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
