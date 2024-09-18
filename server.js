const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

// Serve the static HTML file
app.use(express.static(path.join(__dirname, 'public')));

// Store player names along with room code
let gameRooms = {}; // Store game sessions

// Generate a random room code
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

// Handle connection
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Create a new game room with a random code
    socket.on('createGame', (playerName) => {
        const roomCode = generateRoomCode();
        socket.join(roomCode);
        gameRooms[roomCode] = {
            players: { [socket.id]: { name: playerName, move: null } },
            starter: socket.id,
        };

        socket.emit('roomCreated', { roomCode });
    });

    // Join an existing game
    socket.on('joinGame', ({ roomCode, playerName }) => {
        const room = io.sockets.adapter.rooms.get(roomCode);

        if (room && room.size === 1) {
            socket.join(roomCode);
            gameRooms[roomCode].players[socket.id] = { name: playerName, move: null };

            // Start the game when both players are connected
            io.in(roomCode).emit('startGame', {
                message: `Game started, ${gameRooms[roomCode].players[socket.id].name} joined`,
                starter: gameRooms[roomCode].starter
            });
        } else if (room && room.size >= 2) {
            socket.emit('roomFull', 'Room is already full.');
        } else {
            socket.emit('roomNotFound', 'Room not found.');
        }
    });

    // Handle player moves (with player names)
    socket.on('playerMove', ({ roomCode, playerId, playerName, move }) => {
        if (!gameRooms[roomCode]) {
            return;
        }

        gameRooms[roomCode].players[playerId].move = move;

        // Check if both players have made their moves
        if (Object.values(gameRooms[roomCode].players).every(player => player.move !== null)) {
            const result = checkWinner(gameRooms[roomCode].players);
            io.in(roomCode).emit('gameResult', result);

            // Reset moves for a new round
            Object.values(gameRooms[roomCode].players).forEach(player => player.move = null);
        }
    });

    // Function to determine the winner (with player names)
    function checkWinner(players) {
        const [player1, player2] = Object.values(players);
        const [player1Id, player2Id] = Object.keys(players);

        if (player1.move === player2.move) {
            return { winner: 'draw', message: 'It\'s a tie!' };
        }

        const winningCombos = {
            rock: 'scissors',
            paper: 'rock',
            scissors: 'paper'
        };

        const winner = winningCombos[player1.move] === player2.move ? player1Id : player2Id;

        return { winner, message: `${players[winner].name} wins!` };
    }

    // Handle user disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Optionally, clean up the gameRooms object here
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
