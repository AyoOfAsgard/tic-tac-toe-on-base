// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract TicTacToe {
    struct Game {
        address[2] players;
        uint256 betAmount;
        uint8[9] board;
        uint8 currentTurn;
        bool isComplete;
    }

    mapping(string => Game) public games;

    event GameJoined(string gameId, address player);
    event MoveMade(string gameId, uint8 position);
    event GameOver(string gameId, address winner);

    function joinGame(string memory gameId) external payable {
        Game storage game = games[gameId];
        require(msg.value > 0, "Bet amount must be greater than 0");
        require(game.players[0] == address(0) || game.players[1] == address(0), "Game is full");
        require(!game.isComplete, "Game is already complete");

        if (game.players[0] == address(0)) {
            game.players[0] = msg.sender;
            game.betAmount = msg.value;
        } else {
            require(msg.value == game.betAmount, "Bet amount must match");
            game.players[1] = msg.sender;
            game.currentTurn = uint8(block.timestamp % 2);  // Randomly choose first player
        }

        emit GameJoined(gameId, msg.sender);
    }

    function makeMove(string memory gameId, uint8 position) external {
        Game storage game = games[gameId];
        require(!game.isComplete, "Game is already complete");
        require(msg.sender == game.players[game.currentTurn], "Not your turn");
        require(position < 9, "Invalid position");
        require(game.board[position] == 0, "Position already taken");

        game.board[position] = game.currentTurn + 1;  // 1 for first player, 2 for second
        emit MoveMade(gameId, position);

        if (checkWin(game.board)) {
            game.isComplete = true;
            payable(msg.sender).transfer(game.betAmount * 2);
            emit GameOver(gameId, msg.sender);
        } else if (checkDraw(game.board)) {
            game.isComplete = true;
            payable(game.players[0]).transfer(game.betAmount);
            payable(game.players[1]).transfer(game.betAmount);
            emit GameOver(gameId, address(0));  // Draw
        } else {
            game.currentTurn = 1 - game.currentTurn;  // Switch turns
        }
    }

    function checkWin(uint8[9] memory board) internal pure returns (bool) {
        uint8[3][8] memory lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
        for (uint i = 0; i < 8; i++) {
            if (board[lines[i][0]] != 0 &&
                board[lines[i][0]] == board[lines[i][1]] &&
                board[lines[i][0]] == board[lines[i][2]]) {
                return true;
            }
        }
        return false;
    }

    function checkDraw(uint8[9] memory board) internal pure returns (bool) {
        for (uint i = 0; i < 9; i++) {
            if (board[i] == 0) {
                return false;
            }
        }
        return true;
    }
}