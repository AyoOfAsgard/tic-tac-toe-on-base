import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './TicTacToe.css';
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, ConnectButton } from '@rainbow-me/rainbowkit';
import { WagmiProvider, useAccount, useBalance, useContractWrite, useWaitForTransactionReceipt } from 'wagmi';
import { base } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { http } from 'wagmi';
import { toast } from 'react-toastify'; 
import 'react-toastify/dist/ReactToastify.css';
import { parseEther } from 'ethers'; // Import parseEther directly




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
  const [errorMessage, setErrorMessage] = useState('');
  const [betAmount, setBetAmount] = useState('');
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });

  const { writeAsync: joinGame, data: joinData } = useContractWrite({
    address: '0xcd89a5CBe5b3053DB7cF9A16b5b3668cD0AFf40C',
    abi: [
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "internalType": "string",
            "name": "gameId",
            "type": "string"
          },
          {
            "indexed": false,
            "internalType": "address",
            "name": "player",
            "type": "address"
          }
        ],
        "name": "GameJoined",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "internalType": "string",
            "name": "gameId",
            "type": "string"
          },
          {
            "indexed": false,
            "internalType": "address",
            "name": "winner",
            "type": "address"
          }
        ],
        "name": "GameOver",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "internalType": "string",
            "name": "gameId",
            "type": "string"
          },
          {
            "indexed": false,
            "internalType": "uint8",
            "name": "position",
            "type": "uint8"
          }
        ],
        "name": "MoveMade",
        "type": "event"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "",
            "type": "string"
          }
        ],
        "name": "games",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "betAmount",
            "type": "uint256"
          },
          {
            "internalType": "uint8",
            "name": "currentTurn",
            "type": "uint8"
          },
          {
            "internalType": "bool",
            "name": "isComplete",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "gameId",
            "type": "string"
          }
        ],
        "name": "joinGame",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "gameId",
            "type": "string"
          },
          {
            "internalType": "uint8",
            "name": "position",
            "type": "uint8"
          }
        ],
        "name": "makeMove",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ],
    functionName: 'joinGame',
  });

  const { isLoading: isJoining, isSuccess: hasJoined } = useWaitForTransactionReceipt({
    hash: joinData?.hash,
  });

  const handleJoinGame = async () => {
    setErrorMessage('');
    if (!isConnected) {
      setErrorMessage('Please connect your wallet first');
      return;
    }
    if (!inputGameId.trim()) {
      setErrorMessage('Please enter a game ID');
      return;
    }
    if (!betAmount || parseFloat(betAmount) <= 0) {
      setErrorMessage('Please enter a valid bet amount');
      return;
    }
    if (balance && parseFloat(betAmount) > parseFloat(balance.formatted)) {
      setErrorMessage('Insufficient balance');
      return;
    }

    try {
      if (joinGame) {
        const tx = await joinGame({
          args: [inputGameId],
          value: parseEther(betAmount),
        });
        console.log('Transaction submitted:', tx);
        const receipt = await tx.wait();
        console.log('Transaction receipt:', receipt);
        setGameId(inputGameId);
        setGameOver(false);
        toast.success('Successfully joined the game!');
        socket.emit('joinGame', inputGameId);
      } else {
        throw new Error('joinGame function is not available');
      }
    } catch (error) {
      console.error('Error joining game:', error);
      setErrorMessage(`Failed to join game: ${error.message}`);
    }
  };

  


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

  useEffect(() => {
    if (hasJoined) {
      console.log('Successfully joined the game on the blockchain');
      setGameId(inputGameId);
      setGameOver(false);
      toast.success('Successfully joined the game!');
      socket.emit('joinGame', inputGameId);
    }
  }, [hasJoined, inputGameId]);

  

  

  const handleClick = (index) => {
    if (!isYourTurn || board[index] || gameOver) return;
    console.log('Making move', { gameId, index, myId: socket.id });
    socket.emit('makeMove', { gameId, index });
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
    <div className="game-container">
      <h1 className="game-title">Tic-Tac-Toe on Base</h1>
      <div className="wallet-connect-container">
        <ConnectButton />
      </div>
      {isConnected && (
        <p className="wallet-address">Connected: {address.slice(0, 6)}...{address.slice(-4)}</p>
      )}
      {!gameId && (
        <div className="join-game">
          <input 
            type="text" 
            value={inputGameId} 
            onChange={(e) => setInputGameId(e.target.value)}
            placeholder="Enter game ID"
            className="game-input"
          />
          <input 
            type="number" 
            value={betAmount} 
            onChange={(e) => setBetAmount(e.target.value)}
            placeholder="Enter bet amount (ETH)"
            className="game-input"
          />
          <button 
            onClick={handleJoinGame} 
            className="join-button" 
            disabled={!isConnected || !inputGameId.trim() || !betAmount || isJoining}
          >
            {isJoining ? 'Joining...' : 'Join Game'}
          </button>
          {errorMessage && <p className="error-message">{errorMessage}</p>}
        </div>
      )}
      {gameId && (
        <div className="game-play">
          <Board squares={board} onClick={handleClick} />
          <div className="game-info">
            <div className="status">{status}</div>
            <div>Your Symbol: {playerSymbol}</div>
            <div>Game ID: {gameId}</div>
            {gameOver && <button onClick={resetGame} className="reset-button">Play Again</button>}
          </div>
        </div>
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