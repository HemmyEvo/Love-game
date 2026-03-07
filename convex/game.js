import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 600;

const couplesPrompts = [
  // --- TRUTHS ---
  { type: "Truth", text: "What was the exact moment you realized you had feelings for me?" },
  { type: "Truth", text: "What is your favorite non-physical feature of mine?" },
  { type: "Truth", text: "If we could teleport to any romantic destination right now, where would we go?" },
  { type: "Truth", text: "What outfit of mine do you think I look the most attractive in?" },
  { type: "Truth", text: "What is a romantic movie scene you would secretly love us to recreate?" },
  { type: "Truth", text: "What’s a small, everyday thing I do that gives you butterflies?" },
  { type: "Truth", text: "What was your very first impression of me before we started dating?" },
  { type: "Truth", text: "If you had to describe my kissing style in three words, what would they be?" },
  { type: "Truth", text: "What is a dream date you’ve always wanted to go on but haven't told me about?" },
  { type: "Truth", text: "What is your absolute favorite memory of us together?" },
  { type: "Truth", text: "What’s one thing you’re looking forward to doing with me in the future?" },
  { type: "Truth", text: "If we had a whole weekend completely to ourselves, how would we spend it?" },
  { type: "Truth", text: "What is the most thoughtful thing I’ve ever done for you?" },
  { type: "Truth", text: "Is there a song that immediately makes you think of me? What is it?" },
  { type: "Truth", text: "What’s a cheesy romantic cliché that you actually secretly love?" },
  { type: "Truth", text: "What is the best compliment I’ve ever given you?" },
  { type: "Truth", text: "When we are apart, what do you miss most about me?" },
  { type: "Truth", text: "What’s a flirty text I sent you that you still think about?" },
  { type: "Truth", text: "If you could only kiss me in one spot for the rest of your life, where would it be?" },
  { type: "Truth", text: "What is your favorite pet name that I call you?" },
  { type: "Truth", text: "What is one thing you wish I would do more often?" },
  { type: "Truth", text: "What was the most nervous you’ve ever been around me?" },
  { type: "Truth", text: "What is a secret talent or quirk of mine that you find adorable?" },
  { type: "Truth", text: "If our love story was a movie, what genre would it be and why?" },
  { type: "Truth", text: "What’s the most attractive thing I wear to sleep?" },
  { type: "Truth", text: "What do I do that always manages to make you smile, even on a bad day?" },
  { type: "Truth", text: "What is your favorite physical feature of mine?" },
  { type: "Truth", text: "What’s a question you’ve always wanted to ask me but never have?" },
  { type: "Truth", text: "How would you describe our chemistry to a stranger?" },
  { type: "Truth", text: "What is the sexiest trait a person can have, and how do I show it?" },
  // --- TRUTHS ---
  { type: "Truth", text: "If our relationship was a mobile app, what would its best feature be?" },
  { type: "Truth", text: "What's the most distracting thing I do when you are trying to study or focus on work?" },
  { type: "Truth", text: "What is your favorite memory of us celebrating a special occasion or birthday together?" },
  { type: "Truth", text: "If we could start a business together, what would it be?" },
  { type: "Truth", text: "What is the most calming thing I do when you are stressed?" },
  { type: "Truth", text: "What's a small detail about my face you love looking at?" },
  { type: "Truth", text: "If you had to describe my personality using a color, what would it be and why?" },
  { type: "Truth", text: "What is the most romantic thing you’ve ever caught me doing when I thought you weren't looking?" },
  { type: "Truth", text: "What’s one inside joke we have that always makes you laugh out loud?" },
  { type: "Truth", text: "How do you know when I’m really happy?" },
  { type: "Truth", text: "What is your favorite way that I show you affection?" },
  { type: "Truth", text: "What was the exact thought you had after our very first date?" },
  { type: "Truth", text: "If you could relive one day of our relationship, which one would you choose?" },
  { type: "Truth", text: "What is a hidden talent of mine that you love showing off to others?" },
  { type: "Truth", text: "What is the best gift I have ever given you?" },
  { type: "Truth", text: "How do you describe me to your friends?" },
  { type: "Truth", text: "What is a goal of yours that you feel I fully support?" },
  { type: "Truth", text: "What’s the most surprising thing you’ve learned about me since we’ve been together?" },
  { type: "Truth", text: "What is your favorite topic to talk about with me late at night?" },
  { type: "Truth", text: "If we were to write a book together, what would the title be?" },
  { type: "Truth", text: "What is the most attractive quality I have that has nothing to do with my looks?" },
  { type: "Truth", text: "What’s a song you heard recently that immediately made you think of me?" },
  { type: "Truth", text: "What is the best meal we’ve ever eaten together?" },
  { type: "Truth", text: "If I were a dessert, what kind of dessert would I be?" },
  { type: "Truth", text: "What is your favorite nickname for me that you haven't used in a while?" },
  { type: "Truth", text: "What’s the most adventurous thing you’d like us to try together?" },
  { type: "Truth", text: "When do you feel the most connected to me?" },
  { type: "Truth", text: "What’s a small, seemingly insignificant moment we shared that you’ll never forget?" },
  { type: "Truth", text: "What is your favorite way to spend a lazy Sunday with me?" },
  { type: "Truth", text: "If we had to move to a new city together tomorrow, what’s the first thing we’d do?" },
  { type: "Truth", text: "What is the most thoughtful text message I’ve ever sent you?" },
  { type: "Truth", text: "What’s a habit of yours that you think I’ve positively influenced?" },
  { type: "Truth", text: "If you could ask my parents one question about me as a kid, what would it be?" },
  { type: "Truth", text: "What’s a movie or show you’d love to binge-watch with me all weekend?" },
  { type: "Truth", text: "What is the most comforting thing I say to you?" },

  // --- DARES ---
  { type: "Dare", text: "Send a voice note of you explaining why you love me, using your best news anchor voice." },
  { type: "Dare", text: "Send a WhatsApp picture of the shoes you'd wear on our dream date." },
  { type: "Dare", text: "Change your WhatsApp status to something sweet about us for the next hour and send a screenshot." },
  { type: "Dare", text: "Send a voice note of you humming a love song and let me guess what it is." },
  { type: "Dare", text: "Send me a WhatsApp photo of an item you'd love to buy from an online store for us." },
  { type: "Dare", text: "Type out a romantic message but replace every vowel with an asterisk (*) and send it." },
  { type: "Dare", text: "Send a WhatsApp picture of the most colorful thing in your room right now." },
  { type: "Dare", text: "Record a voice note telling me about your day, but you have to whisper the whole time." },
  { type: "Dare", text: "Send a selfie on WhatsApp making a heart shape with your hands." },
  { type: "Dare", text: "Scroll back in our chat, find a message that made you smile, screenshot it, and send it to me on WhatsApp." },
  { type: "Dare", text: "Send me a 5-second video on WhatsApp of you blowing a kiss." },
  { type: "Dare", text: "Send me a voice note saying 'I miss you' in an accent of your choice." },
  { type: "Dare", text: "Send a picture on WhatsApp of your favorite mug or cup you are drinking from today." },
  { type: "Dare", text: "Write a 4-line rhyme about my smile and send it in the chat." },
  { type: "Dare", text: "Send a WhatsApp picture of a view you wish we were sharing right now." },
  { type: "Dare", text: "Send a voice note reading your favorite romantic quote to me." },
  { type: "Dare", text: "Look up a cheesy pickup line online, send it to me, and pretend you came up with it." },
  { type: "Dare", text: "Send a WhatsApp photo of a book or article you are currently reading or studying." },
  { type: "Dare", text: "Send me a voice note counting from 1 to 10, but say a reason you like me for each number." },
  { type: "Dare", text: "Send a WhatsApp picture of the sky right now from wherever you are." },
  { type: "Dare", text: "Text me a list of three things you want to do the next time we see each other." },
  { type: "Dare", text: "Send a voice note describing the exact outfit I was wearing the first time we met." },
  { type: "Dare", text: "Send a WhatsApp picture of a childhood photo of yourself if you have one nearby." },
  { type: "Dare", text: "Close your eyes, type 'I can't wait to see you', and send it without fixing any typos." },
  { type: "Dare", text: "Send a WhatsApp photo of something you cooked or ate today." },
  { type: "Dare", text: "Send a voice note giving a one-minute review of our relationship as if it were a 5-star restaurant." },
  { type: "Dare", text: "Find a meme that describes your current mood and send it to me on WhatsApp." },
  { type: "Dare", text: "Send a WhatsApp picture of your reflection in something other than a mirror." },
  { type: "Dare", text: "Send a voice note of your best fake laugh." },
  { type: "Dare", text: "Send me a link to a YouTube video that you think I would find hilarious." },
  { type: "Dare", text: "Write out my name using only emojis and send it." },
  { type: "Dare", text: "Send a WhatsApp photo of your favorite piece of clothing that you own." },
  { type: "Dare", text: "Send me a voice note telling me what you had for breakfast in extreme, dramatic detail." },
  { type: "Dare", text: "Send a WhatsApp picture of your current lock screen wallpaper." },
  { type: "Dare", text: "Send me a text message using only autocomplete suggestions until it forms a full sentence." },

  // --- MIXED / SCENARIO-BASED ---
  { type: "Truth", text: "What is a hobby of mine that you actually find really fascinating?" },
  { type: "Dare", text: "Send a WhatsApp picture of a piece of technology or gadget you can't live without." },
  { type: "Truth", text: "If we could design our dream house together, what is one must-have feature?" },
  { type: "Dare", text: "Send a voice note spelling my name backwards as fast as you can." },
  { type: "Truth", text: "What is the most valuable lesson our relationship has taught you so far?" },
  { type: "Dare", text: "Send a WhatsApp picture of your favorite cozy spot in your home." },
  { type: "Truth", text: "If we could have a themed date night based on any movie or TV show, what would it be?" },
  { type: "Dare", text: "Send a voice note of you doing your best romantic movie monologue." },
  { type: "Truth", text: "What’s something you’ve always wanted to ask me but have been too shy to?" },
  // --- DARES ---
  { type: "Dare", text: "Send me a voice note telling me three things you love about me." },
  { type: "Dare", text: "Take a selfie showing your current mood and send it to me on WhatsApp." },
  { type: "Dare", text: "Send me a picture on WhatsApp of the outfit you want me to wear on our next date." },
  { type: "Dare", text: "Write a short, three-line poem about my eyes and send it in the chat." },
  { type: "Dare", text: "Send me a voice note whispering a sweet secret to me." },
  { type: "Dare", text: "Find your favorite photo of us, send it on WhatsApp, and tell me why you love it." },
  { type: "Dare", text: "Send me a picture on WhatsApp of the exact view you are looking at right now." },
  { type: "Dare", text: "Change my contact name in your phone to something romantic, and send a WhatsApp screenshot as proof." },
  { type: "Dare", text: "Send me a voice note singing the chorus of our favorite song." },
  { type: "Dare", text: "Take a selfie blowing me a kiss and send it to me on WhatsApp right now." },
  { type: "Dare", text: "Send me a random emoji that represents how you feel about me today, without any context." },
  { type: "Dare", text: "Type out the story of how we met, but only use emojis." },
  { type: "Dare", text: "Send me a picture on WhatsApp of an item in your room that reminds you of me." },
  { type: "Dare", text: "Send me a voice note describing your perfect evening with me." },
  { type: "Dare", text: "Send a WhatsApp picture of your best 'flirty' face." },
  { type: "Dare", text: "Write a message explaining what you’d do if I was sitting right next to you, and hit send." },
  { type: "Dare", text: "Go to your camera roll, close your eyes, pick a random photo, and send it to me on WhatsApp." },
  { type: "Dare", text: "Send a voice note of you trying to do your best impression of me." },
  { type: "Dare", text: "Find a GIF that perfectly describes our relationship and send it." },
  { type: "Dare", text: "Send a WhatsApp picture of your hand, and tell me what you wish it was holding right now." },
  { type: "Dare", text: "Send me a voice note saying my name in the most romantic way possible." },
  { type: "Dare", text: "Type out a paragraph of what you appreciate about me, but translate it into a language neither of us speaks before sending." },
  { type: "Dare", text: "Take a mirror selfie of your current outfit and send it on WhatsApp." },
  { type: "Dare", text: "Send me a link to a song that perfectly captures your mood right now." },
  { type: "Dare", text: "Write me a 'Good Morning' text for tomorrow, but send it right now." },
  { type: "Dare", text: "Send a WhatsApp photo of your favorite snack so I know what to buy you next time." },
  { type: "Dare", text: "Send a voice note giving me a completely exaggerated, dramatic compliment." },
  { type: "Dare", text: "Send me a picture on WhatsApp of the shoes you are wearing right now (or your bare feet!)." },
  { type: "Dare", text: "Type your favorite thing about my personality with your eyes closed and send it without correcting typos." },
  { type: "Dare", text: "Send a WhatsApp selfie making the goofiest face you possibly can." },

  // --- MIXED / SCENARIO-BASED ---
  { type: "Truth", text: "If we were stranded on a desert island, what are two things you’d hope we brought?" },
  { type: "Dare", text: "Send me a voice note reading the last text message you sent to someone else (that isn't private)." },
  { type: "Truth", text: "What is one habit of mine that you actually find endearing?" },
  { type: "Dare", text: "Send a WhatsApp picture of the most random object near you right now." },
  { type: "Truth", text: "What is your favorite memory from our first month of talking/dating?" },
  { type: "Dare", text: "Write out a customized 'menu' of three cuddles/kisses you want later, and send it to me." },
  { type: "Truth", text: "If we swapped bodies for a day, what is the first thing you would do?" },
  { type: "Dare", text: "Send a voice note telling me a joke. If I don't laugh, you owe me a kiss later." },
  { type: "Truth", text: "What is the most spontaneous thing you’d like us to do together?" },
  { type: "Dare", text: "Send a WhatsApp picture of your workspace or wherever you are relaxing right now." },
  { type: "Truth", text: "What’s the best piece of relationship advice you’ve ever heard?" },
  { type: "Dare", text: "Find a romantic quote online that reminds you of us and send me the screenshot on WhatsApp." },
  { type: "Truth", text: "What do you think is our biggest strength as a couple?" },
  { type: "Dare", text: "Send me a 10-second video on WhatsApp of you just smiling at the camera." },
  { type: "Truth", text: "If you could freeze one moment of our relationship so far to live in forever, which would it be?" }
];

function randomCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function createPlayer() {
  return {
    x: Math.random() * (WORLD_WIDTH - 100) + 50,
    y: Math.random() * (WORLD_HEIGHT - 100) + 50,
    color: Math.random() > 0.5 ? "#8a1c1c" : "#d4af37", // Ancient Red or Gold
  };
}

function createLoveItem() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    x: Math.random() * (WORLD_WIDTH - 40) + 20,
    y: Math.random() * (WORLD_HEIGHT - 40) + 20,
    type: Math.floor(Math.random() * 4),
  };
}

async function findRoomByCode(ctx, roomCode) {
  return ctx.db.query("rooms").filter(q => q.eq(q.field("roomCode"), roomCode)).first();
}

function processGameState(room) {
  let { players, scores, loveItems, isGameOver, winnerId, gameStartTime, maxScore, timeLimit, todData } = room;
  
  if (gameStartTime && !isGameOver) {
    const elapsedSecs = (Date.now() - gameStartTime) / 1000;
    if (elapsedSecs >= timeLimit) {
      isGameOver = true;
    }
  }

  if (!isGameOver) {
    Object.keys(players).forEach((id) => {
      const p = players[id];
      for (let i = loveItems.length - 1; i >= 0; i--) {
        if (Math.hypot(p.x - loveItems[i].x, p.y - loveItems[i].y) < 30) {
          scores[id] = (scores[id] || 0) + 1;
          loveItems.splice(i, 1);
          loveItems.push(createLoveItem());
          if (scores[id] >= maxScore) isGameOver = true;
        }
      }
    });
  }

  if (isGameOver && !winnerId) {
    const ids = Object.keys(scores);
    if (ids.length === 2) {
      if (scores[ids[0]] > scores[ids[1]]) winnerId = ids[0];
      else if (scores[ids[1]] > scores[ids[0]]) winnerId = ids[1];
      else winnerId = "draw";
    } else {
      winnerId = ids[0];
    }

    if (winnerId !== "draw") {
      const loserId = Object.keys(players).find(id => id !== winnerId);
      const promptObj = couplesPrompts[Math.floor(Math.random() * couplesPrompts.length)];
      todData = { loserId, prompt: promptObj.text, answer: null, isDare: promptObj.type === "Dare", completed: false };
    }
  }

  return { players, scores, loveItems, isGameOver, winnerId, todData };
}

export const createRoom = mutation({
  args: { loverName: v.optional(v.string()), deviceId: v.optional(v.string()), maxScore: v.optional(v.number()), timeLimit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const playerId = args.deviceId || `player-${Math.random().toString(36).substring(2)}`;
    
    // STRICT RULE: User cannot create a new room if they already have one
    const existingRooms = await ctx.db.query("rooms").collect();
    const activeRoom = existingRooms.find(r => r.players && r.players[playerId]);
    if (activeRoom) {
      throw new Error("You already have an active chamber! Please flee/leave it first.");
    }

    let roomCode = randomCode();
    while (await findRoomByCode(ctx, roomCode)) roomCode = randomCode();

    const players = { [playerId]: createPlayer() };
    const scores = { [playerId]: 0 };
    const names = { [playerId]: args.loverName?.slice(0, 15) || "Wanderer" };
    const readyPlayers = { [playerId]: false };

    await ctx.db.insert("rooms", {
      roomCode, createdAt: Date.now(), maxScore: args.maxScore || 20, timeLimit: args.timeLimit || 60,
      gameStartTime: null, gameStarted: false, readyPlayers, isGameOver: false, winnerId: null,
      players, scores, names, loveItems: Array.from({ length: 20 }, createLoveItem),
      todData: null
    });

    return { roomCode, playerId };
  },
});

export const joinRoom = mutation({
  args: { roomCode: v.string(), loverName: v.optional(v.string()), deviceId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const room = await findRoomByCode(ctx, args.roomCode.toUpperCase());
    if (!room) throw new Error("Chamber not found");

    const playerId = args.deviceId || `player-${Math.random().toString(36).substring(2)}`;
    if (Object.keys(room.players).length >= 2 && !room.players[playerId]) throw new Error("Chamber is full (Max 2 Wanderers)");

    if (!room.players[playerId]) {
      room.players[playerId] = createPlayer();
      room.scores[playerId] = 0;
      room.readyPlayers[playerId] = false;
    }
    room.names[playerId] = args.loverName?.slice(0, 15) || "Wanderer";

    await ctx.db.patch(room._id, { players: room.players, scores: room.scores, names: room.names, readyPlayers: room.readyPlayers });
    return { roomCode: room.roomCode, playerId, ...room };
  },
});

export const setMatchReady = mutation({
  args: { roomCode: v.string(), playerId: v.string(), ready: v.boolean() },
  handler: async (ctx, args) => {
    const room = await findRoomByCode(ctx, args.roomCode.toUpperCase());
    if (!room) throw new Error("Chamber not found");

    room.readyPlayers[args.playerId] = args.ready;
    const allReady = Object.keys(room.players).length === 2 && Object.values(room.readyPlayers).every(Boolean);

    await ctx.db.patch(room._id, { readyPlayers: room.readyPlayers, gameStarted: allReady, gameStartTime: allReady ? Date.now() : null });
    return { ...room, gameStarted: allReady };
  },
});

export const move = mutation({
  args: { roomCode: v.string(), playerId: v.string(), x: v.number(), y: v.number() },
  handler: async (ctx, args) => {
    const room = await findRoomByCode(ctx, args.roomCode.toUpperCase());
    if (!room || room.isGameOver || !room.gameStarted) return room;

    if (room.players[args.playerId]) {
      room.players[args.playerId].x = args.x;
      room.players[args.playerId].y = args.y;
    }

    const nextState = processGameState(room);
    await ctx.db.patch(room._id, nextState);
    return { ...room, ...nextState };
  },
});

export const submitTod = mutation({
  args: { roomCode: v.string(), answer: v.string() },
  handler: async (ctx, args) => {
    const room = await findRoomByCode(ctx, args.roomCode.toUpperCase());
    if (!room || !room.todData) throw new Error("Invalid ritual request");
    
    room.todData.answer = args.answer.slice(0, 150);
    room.todData.completed = true;
    
    await ctx.db.patch(room._id, { todData: room.todData });
    return true;
  }
});

export const playAgain = mutation({
  args: { roomCode: v.string(), playerId: v.string() },
  handler: async (ctx, args) => {
    const room = await findRoomByCode(ctx, args.roomCode.toUpperCase());
    if (!room) throw new Error("Chamber not found");

    const resetScores = {};
    const resetReady = {};
    Object.keys(room.players).forEach(id => { resetScores[id] = 0; resetReady[id] = false; });

    await ctx.db.patch(room._id, {
      scores: resetScores, readyPlayers: resetReady, isGameOver: false, winnerId: null,
      gameStarted: false, gameStartTime: null, todData: null,
      loveItems: Array.from({ length: 20 }, createLoveItem),
    });

    return await ctx.db.get(room._id);
  },
});

// STRICT RULE: Automatically delete the room completely if any user leaves.
export const leaveRoom = mutation({
  args: { roomCode: v.string(), playerId: v.string() },
  handler: async (ctx, args) => {
    const room = await findRoomByCode(ctx, args.roomCode.toUpperCase());
    if (room) {
      await ctx.db.delete(room._id);
    }
    return true;
  }
});

export const getRoomState = query({
  args: { roomCode: v.string(), playerId: v.optional(v.string()) },
  handler: async (ctx, args) => await findRoomByCode(ctx, (args.roomCode || "").toUpperCase()) || null
});