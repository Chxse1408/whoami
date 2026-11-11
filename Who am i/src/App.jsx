import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, update } from "firebase/database";
import { Users, Sparkles, RefreshCw, Send, Check, X, HelpCircle, Trophy, Crown } from 'lucide-react';
import confetti from 'canvas-confetti';

// -----------------------------------------------------------------------------
// REPLACE THIS BLOCK WITH YOUR REAL FIREBASE KEYS FROM FIREBASE CONSOLE:
// -----------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyBLdzuTYhiF1RwLLyVtnUVNxEiL-u3e_38",
  authDomain: "whoami-7cce0.firebaseapp.com",
  databaseURL: "https://whoami-7cce0-default-rtdb.firebaseio.com",
  projectId: "whoami-7cce0",
  storageBucket: "whoami-7cce0.firebasestorage.app",
  messagingSenderId: "123302585429",
  appId: "1:123302585429:web:a41394bd1c3e0df1dea0dc"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Category word banks
const WORD_CATEGORIES = {
  "Celebrities": ["Taylor Swift", "Dwayne Johnson", "Beyonce", "Keanu Reeves", "Elon Musk", "Rihanna", "Tom Cruise", "Billie Eilish"],
  "Superheroes": ["Spider-Man", "Batman", "Iron Man", "Wonder Woman", "Thor", "Captain America", "Deadpool", "Black Panther"],
  "Anime & Cartoons": ["Goku", "Naruto", "SpongeBob", "Luffy", "Pikachu", "Shrek", "Mickey Mouse", "Homer Simpson"],
  "Movie Characters": ["Harry Potter", "Darth Vader", "Barbie", "Jack Sparrow", "Indiana Jones", "Katniss Everdeen", "Elsa", "Joker"],
  "Historical Figures": ["Albert Einstein", "Cleopatra", "Abraham Lincoln", "Leonardo da Vinci", "Julius Caesar", "Mozart", "Marie Curie"]
};

const AVATAR_COLORS = [
  'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
  'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
];

export default function App() {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  
  // Game State
  const [gameState, setGameState] = useState(null);
  const [questionText, setQuestionText] = useState('');
  const [guessText, setGuessText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState("Celebrities");

  // Create or Join Room
  const createRoom = () => {
    if (!playerName.trim()) return alert("Please enter your name!");
    const newCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const initialPlayer = {
      id: Date.now().toString(),
      name: playerName.trim(),
      color: selectedColor,
      isHost: true,
      secretName: '',
      score: 0
    };

    const initialRoomData = {
      code: newCode,
      status: 'LOBBY', // LOBBY, PLAYING, GAME_OVER
      category: selectedCategory,
      players: { [initialPlayer.id]: initialPlayer },
      turnOrder: [initialPlayer.id],
      currentTurnIndex: 0,
      currentQuestion: null,
      chat: []
    };

    set(ref(db, 'rooms/' + newCode), initialRoomData);
    setRoomCode(newCode);
    setIsHost(true);
    setInRoom(true);
    localStorage.setItem('myPlayerId', initialPlayer.id);
  };

  const joinRoom = () => {
    if (!playerName.trim() || !roomCode.trim()) return alert("Enter name and room code!");
    const code = roomCode.trim().toUpperCase();
    
    onValue(ref(db, `rooms/${code}`), (snapshot) => {
      const data = snapshot.val();
      if (!data) return alert("Room not found!");

      const myId = localStorage.getItem('myPlayerId') || Date.now().toString();
      localStorage.setItem('myPlayerId', myId);

      const updatedPlayers = {
        ...(data.players || {}),
        [myId]: {
          id: myId,
          name: playerName.trim(),
          color: selectedColor,
          isHost: false,
          secretName: '',
          score: 0
        }
      };

      const updatedTurnOrder = data.turnOrder.includes(myId) ? data.turnOrder : [...data.turnOrder, myId];

      update(ref(db, `rooms/${code}`), {
        players: updatedPlayers,
        turnOrder: updatedTurnOrder
      });

      setRoomCode(code);
      setInRoom(true);
    }, { onlyOnce: true });
  };

  // Sync with Firebase
  useEffect(() => {
    if (!inRoom || !roomCode) return;

    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data);
      }
    });

    return () => unsubscribe();
  }, [inRoom, roomCode]);

  // Start Game (Assign secret names to headbands)
  const startGame = () => {
    if (!gameState) return;
    const playerIds = Object.keys(gameState.players);
    if (playerIds.length < 2) return alert("Need at least 2 players!");

    const words = [...WORD_CATEGORIES[gameState.category || selectedCategory]];
    // Shuffle words
    const shuffledWords = words.sort(() => 0.5 - Math.random());

    const updatedPlayers = {};
    playerIds.forEach((id, index) => {
      updatedPlayers[id] = {
        ...gameState.players[id],
        secretName: shuffledWords[index % shuffledWords.length]
      };
    });

    update(ref(db, `rooms/${roomCode}`), {
      status: 'PLAYING',
      players: updatedPlayers,
      currentTurnIndex: 0,
      currentQuestion: null
    });
  };

  const myId = localStorage.getItem('myPlayerId');
  const playersList = gameState?.players ? Object.values(gameState.players) : [];
  const currentTurnPlayerId = gameState?.turnOrder?.[gameState.currentTurnIndex];
  const isMyTurn = currentTurnPlayerId === myId;

  // Ask Question
  const submitQuestion = (e) => {
    e.preventDefault();
    if (!questionText.trim()) return;

    update(ref(db, `rooms/${roomCode}`), {
      currentQuestion: {
        text: questionText.trim(),
        askedBy: myId,
        votes: {}
      }
    });
    setQuestionText('');
  };

  // Vote on Question (Yes/No)
  const voteQuestion = (voteValue) => {
    if (!gameState?.currentQuestion) return;
    update(ref(db, `rooms/${roomCode}/currentQuestion/votes`), {
      [myId]: voteValue
    });
  };

  // Submit Final Identity Guess
  const submitGuess = (e) => {
    e.preventDefault();
    if (!guessText.trim()) return;

    const mySecretName = gameState?.players[myId]?.secretName;
    const isCorrect = guessText.trim().toLowerCase() === mySecretName?.toLowerCase();

    if (isCorrect) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      const currentScore = gameState?.players[myId]?.score || 0;
      update(ref(db, `rooms/${roomCode}/players/${myId}`), {
        score: currentScore + 1
      });
      alert(`🎉 CORRECT! You guessed it! You are ${mySecretName}!`);
    } else {
      alert(`❌ WRONG! You guessed "${guessText}", but that's not it! Pass turn.`);
    }

    // Advance turn
    const nextTurn = (gameState.currentTurnIndex + 1) % gameState.turnOrder.length;
    update(ref(db, `rooms/${roomCode}`), {
      currentTurnIndex: nextTurn,
      currentQuestion: null
    });
    setGuessText('');
  };

  if (!inRoom) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full border border-slate-700">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Sparkles className="w-8 h-8 text-yellow-400" />
            <h1 className="text-3xl font-extrabold tracking-tight">Who Am I?</h1>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Your Nickname</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter nickname..."
                className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Choose Headband Color</label>
              <div className="flex gap-2 justify-between">
                {AVATAR_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className={`w-8 h-8 rounded-full ${c} ${selectedColor === c ? 'ring-4 ring-white' : ''}`}
                  />
                ))}
              </div>
            </div>

            <div className="border-t border-slate-700 my-4 pt-4 space-y-3">
              <button
                onClick={createRoom}
                className="w-full bg-indigo-600 hover:bg-indigo-500 font-bold py-3 rounded-lg shadow transition"
              >
                Create New Room
              </button>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="4-LETTER CODE"
                  className="w-1/2 p-3 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none text-center font-mono uppercase"
                />
                <button
                  onClick={joinRoom}
                  className="w-1/2 bg-emerald-600 hover:bg-emerald-500 font-bold py-3 rounded-lg shadow transition"
                >
                  Join Room
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <header className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            Room Code: <span className="font-mono text-yellow-400 bg-slate-900 px-3 py-1 rounded-md">{gameState?.code || roomCode}</span>
          </h2>
        </div>
        {isHost && gameState?.status === 'LOBBY' && (
          <button
            onClick={startGame}
            className="bg-emerald-600 hover:bg-emerald-500 font-bold px-6 py-2 rounded-lg transition"
          >
            Start Game 🚀
          </button>
        )}
      </header>

      {/* Main Headband Player Display */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {playersList.map((player) => {
          const isMe = player.id === myId;
          const isTurn = player.id === currentTurnPlayerId;

          return (
            <div
              key={player.id}
              className={`relative bg-slate-800 p-4 rounded-xl border-2 flex flex-col items-center text-center transition ${
                isTurn ? 'border-yellow-400 shadow-lg shadow-yellow-400/20' : 'border-slate-700'
              }`}
            >
              {isTurn && (
                <div className="absolute -top-3 bg-yellow-400 text-slate-900 font-bold text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Asking Turn
                </div>
              )}

              {/* Headband Display */}
              <div className={`w-full ${player.color} py-2 rounded-t-lg mb-3 font-bold text-lg shadow text-center`}>
                {isMe ? "❓ MYSTERIOUS ❓" : player.secretName || "???"}
              </div>

              <div className="font-semibold text-lg">{player.name} {isMe && "(You)"}</div>
              <div className="text-xs text-slate-400 mt-1">Score: {player.score || 0}</div>
            </div>
          );
        })}
      </div>

      {/* Active Question & Live Voting Area */}
      {gameState?.status === 'PLAYING' && (
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex flex-col items-center gap-4">
          {isMyTurn ? (
            <div className="w-full max-w-md space-y-4 text-center">
              <h3 className="text-xl font-bold">It's Your Turn! Ask a Yes/No Question</h3>
              
              <form onSubmit={submitQuestion} className="flex gap-2">
                <input
                  type="text"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="e.g. Am I a real person?"
                  className="flex-1 p-3 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none"
                />
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 font-bold px-4 rounded-lg">
                  Ask
                </button>
              </form>

              <form onSubmit={submitGuess} className="flex gap-2 pt-2 border-t border-slate-700">
                <input
                  type="text"
                  value={guessText}
                  onChange={(e) => setGuessText(e.target.value)}
                  placeholder="Final guess (e.g. Goku)..."
                  className="flex-1 p-3 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none"
                />
                <button type="submit" className="bg-amber-600 hover:bg-amber-500 font-bold px-4 rounded-lg">
                  Guess
                </button>
              </form>
            </div>
          ) : (
            <div className="w-full text-center space-y-3">
              <h3 className="text-lg font-medium text-slate-400">
                Waiting for <span className="text-yellow-400 font-bold">{gameState?.players?.[currentTurnPlayerId]?.name}</span> to ask a question...
              </h3>
              
              {gameState?.currentQuestion && (
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 max-w-md mx-auto space-y-3">
                  <p className="text-xl font-bold">"{gameState.currentQuestion.text}"</p>
                  
                  <div className="flex justify-center gap-4">
                    <button
                      onClick={() => voteQuestion('YES')}
                      className="bg-emerald-600 hover:bg-emerald-500 px-6 py-2 rounded-lg font-bold flex items-center gap-1"
                    >
                      <Check className="w-4 h-4" /> YES
                    </button>
                    <button
                      onClick={() => voteQuestion('NO')}
                      className="bg-rose-600 hover:bg-rose-500 px-6 py-2 rounded-lg font-bold flex items-center gap-1"
                    >
                      <X className="w-4 h-4" /> NO
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
