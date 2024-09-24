import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './TicTacToe.css';
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, ConnectButton } from '@rainbow-me/rainbowkit';
import { WagmiProvider, useAccount } from 'wagmi';
import { base } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { http } from 'wagmi';


const socket = io('http://localhost:4000');

// RainbowKit Configuration
const config = getDefaultConfig({
  appName: 'Tic-Tac-Toe on Base',
  projectId: 'a75aa9b55259b29c210a05b18e9d00ba', // Replace with your WalletConnect Cloud project ID
  chains: [base],
  transports: {
    [base.id]: http('https://mainnet.base.org'), // You can replace this with your own RPC URL if needed
  },
});


const queryClient = new QueryClient();

function Square({ value, onClick }) {
  return (
    <button className={`square ${value}`} onClick={onClick}>
      {value}
    </button>
  );
}

function Board({ squares, onClick }) {
  return (
    <div className="game-board">
      {squares.map((value, index) => (
        <Square key={index} value={value} onClick={() => onClick(index)} />
      ))}
    </div>
  );
}

function Game() {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [gameId, setGameId] = useState(null);
  const [playerSymbol, setPlayerSymbol] = useState(null);
  const [isYourTurn, setIsYourTurn] = useState(false);
  const [status, setStatus] = useState('');
  const [inputGameId, setInputGameId] = useState('');
  const [gameOver, setGameOver] = useState(false);

  const { address, isConnected } = useAccount();

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('waitingForOpponent', () => {
      console.log('Waiting for opponent');
      setStatus('Waiting for an opponent...');
    });

    socket.on('gameStart', ({ board, turn }) => {
      console.log('Game started', { board, turn, myId: socket.id });
      setBoard(board);
      setPlayerSymbol(socket.id === turn ? 'X' : 'O');
      setIsYourTurn(socket.id === turn);
      setStatus(`You are ${socket.id === turn ? 'X' : 'O'}. ${socket.id === turn ? 'Your' : "Opponent's"} turn.`);
    });

    socket.on('updateBoard', ({ board, turn }) => {
      console.log('Board updated', { board, turn, myId: socket.id });
      setBoard(board);
      setIsYourTurn(socket.id === turn);
      setStatus(`${socket.id === turn ? 'Your' : "Opponent's"} turn.`);
    });

    socket.on('gameOver', ({ winner, board }) => {
      console.log('Game over', { winner, board });
      setBoard(board);
      setGameOver(true);
      setIsYourTurn(false);
      if (winner === 'draw') {
        setStatus("It's a draw! Game over.");
      } else if (winner === playerSymbol) {
        setStatus('Congratulations! You won the game!');
      } else {
        setStatus('You lost. Better luck next time!');
      }
    });

    socket.on('opponentDisconnected', () => {
      console.log('Opponent disconnected');
      setStatus('Opponent disconnected. Game over.');
      setGameOver(true);
    });

    return () => {
      socket.off('connect');
      socket.off('waitingForOpponent');
      socket.off('gameStart');
      socket.off('updateBoard');
      socket.off('gameOver');
      socket.off('opponentDisconnected');
    };
  }, [playerSymbol]);

  const handleClick = (index) => {
    if (!isYourTurn || board[index] || gameOver) return;
    console.log('Making move', { gameId, index, myId: socket.id });
    socket.emit('makeMove', { gameId, index });
  };

  const joinGame = () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }
    const newGameId = inputGameId || Math.random().toString(36).substr(2, 5);
    console.log('Joining game:', newGameId, 'My ID:', socket.id);
    setGameId(newGameId);
    setGameOver(false);
    socket.emit('joinGame', newGameId);
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setGameId(null);
    setPlayerSymbol(null);
    setIsYourTurn(false);
    setStatus('');
    setGameOver(false);
    setInputGameId('');
  };


  return (
    <div className="game">
      <div className="wallet-info">
        <ConnectButton />
        {isConnected && (
          <p>Connected: {address.slice(0, 6)}...{address.slice(-4)}</p>
        )}
      </div>
      {!gameId && (
        <div className="join-game">
          <input 
            type="text" 
            value={inputGameId} 
            onChange={(e) => setInputGameId(e.target.value)}
            placeholder="Enter game ID to start or join a game"
            className="game-input"
          />
          <button onClick={joinGame} className="join-button" disabled={!isConnected}>Join Game</button>
        </div>
      )}
      {gameId && (
        <>
          <Board squares={board} onClick={handleClick} />
          <div className="game-info">
            <div>{status}</div>
            <div>Your Symbol: {playerSymbol}</div>
            {gameOver && <button onClick={resetGame} className="reset-button">Play Again</button>}
          </div>
        </>
      )}
    </div>
  );
}

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <Game />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;