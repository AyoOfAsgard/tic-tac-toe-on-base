const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const games = new Map();
const waitingPlayers = new Map();

function checkWinner(board) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('joinGame', (gameId) => {
    console.log(`Player ${socket.id} attempting to join game ${gameId}`);
    
    if (waitingPlayers.has(gameId)) {
      const opponent = waitingPlayers.get(gameId);
      waitingPlayers.delete(gameId);
      
      const game = {
        players: [opponent, socket.id],
        board: Array(9).fill(null)
      };
      games.set(gameId, game);
      
      console.log(`Matching players in game ${gameId}: ${opponent} and ${socket.id}`);
      socket.join(gameId);
      io.to(gameId).emit('gameStart', { board: game.board, turn: opponent });
    } else {
      console.log(`Player ${socket.id} waiting for opponent in game ${gameId}`);
      waitingPlayers.set(gameId, socket.id);
      socket.join(gameId);
      socket.emit('waitingForOpponent');
    }
  });

  socket.on('makeMove', ({ gameId, index }) => {
    console.log(`Player ${socket.id} making move in game ${gameId} at index ${index}`);
    const game = games.get(gameId);
    if (game && game.players.includes(socket.id)) {
      const playerIndex = game.players.indexOf(socket.id);
      if (game.board[index] === null) {
        game.board[index] = playerIndex === 0 ? 'X' : 'O';
        const winner = checkWinner(game.board);
        if (winner) {
          io.to(gameId).emit('gameOver', { winner, board: game.board });
          games.delete(gameId);
        } else if (!game.board.includes(null)) {
          io.to(gameId).emit('gameOver', { winner: 'draw', board: game.board });
          games.delete(gameId);
        } else {
          const nextTurn = game.players[1 - playerIndex];
          io.to(gameId).emit('updateBoard', { board: game.board, turn: nextTurn });
        }
        console.log(`Move made. Updated board:`, game.board);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    for (const [gameId, game] of games.entries()) {
      if (game.players.includes(socket.id)) {
        const opponentIndex = 1 - game.players.indexOf(socket.id);
        const opponent = game.players[opponentIndex];
        console.log(`Player ${socket.id} left game ${gameId}. Notifying opponent ${opponent}.`);
        io.to(opponent).emit('opponentDisconnected');
        games.delete(gameId);
      }
    }
    for (const [gameId, waitingPlayer] of waitingPlayers.entries()) {
      if (waitingPlayer === socket.id) {
        console.log(`Waiting player ${socket.id} disconnected from game ${gameId}`);
        waitingPlayers.delete(gameId);
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));