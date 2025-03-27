const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

// Middleware to parse JSON (optional, if you need to handle JSON requests)
app.use(express.json());

// Add a basic route for testing the server
app.get("/", (req, res) => {
    res.send("Express + Socket.IO server is running!");
});

// Create an HTTP server (Railway handles HTTPS externally)
const server = http.createServer(app);

// Initialize Socket.IO with CORS configuration
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:5173",
            "http://192.168.0.118:5173",
            "https://10.64.53.109:5173",
            "https://manitv.vercel.app", // Your deployed frontend URL
        ],
        methods: ["GET", "POST"],
    },
});

// Store users who are available to chat (after clicking "Start")
let availableUsers = [];
// Store active rooms (key: roomId, value: array of user socket IDs)
const rooms = new Map();

io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // When a user clicks "Start", add them to the available users pool
    socket.on("start", () => {
        availableUsers.push(socket.id);
        console.log(`User ${socket.id} is available to chat`);
        matchUsers(socket);
    });

    // When a user clicks "Next", find a new match
    socket.on("next", (currentRoomId) => {
        leaveRoom(socket, currentRoomId);
        matchUsers(socket);
    });

    // When a user clicks "Stop", remove them from their room and the available pool
    socket.on("stop", (roomId) => {
        leaveRoom(socket, roomId);
        availableUsers = availableUsers.filter((id) => id !== socket.id);
        console.log(`User ${socket.id} stopped the stream`);
    });

    // Handle WebRTC signaling
    socket.on("offer", (data) => {
        const { offer, roomId, to } = data;
        console.log(`Received offer from ${socket.id} for ${to}`);
        io.to(to).emit("offer", { offer, from: socket.id, roomId });
    });

    socket.on("answer", (data) => {
        const { answer, to } = data;
        console.log(`Received answer from ${socket.id} for ${to}`);
        io.to(to).emit("answer", { answer, from: socket.id });
    });

    socket.on("ice-candidate", (data) => {
        const { candidate, to } = data;
        console.log(`Received ICE candidate from ${socket.id} for ${to}`);
        io.to(to).emit("ice-candidate", { candidate, from: socket.id });
    });

    // Handle user disconnection
    socket.on("disconnect", () => {
        availableUsers = availableUsers.filter((id) => id !== socket.id);
        for (const [roomId, users] of rooms.entries()) {
            if (users.includes(socket.id)) {
                leaveRoom(socket, roomId);
                break;
            }
        }
        console.log(`User disconnected: ${socket.id}`);
    });
});

// Function to match users
function matchUsers(socket) {
    availableUsers = availableUsers.filter((id) => id !== socket.id);

    if (availableUsers.length > 0) {
        const otherUserId = availableUsers.shift();
        const roomId = `${socket.id}-${otherUserId}`;

        rooms.set(roomId, [socket.id, otherUserId]);
        socket.join(roomId);
        io.to(otherUserId).emit("join-room", { roomId, from: socket.id });
        socket.emit("join-room", { roomId, from: otherUserId });

        console.log(`Matched ${socket.id} with ${otherUserId} in room ${roomId}`);
    } else {
        availableUsers.push(socket.id);
        socket.emit("waiting", "Waiting for another user...");
    }
}

// Function to handle leaving a room
function leaveRoom(socket, roomId) {
    if (roomId && rooms.has(roomId)) {
        const users = rooms.get(roomId);
        const otherUserId = users.find((id) => id !== socket.id);
        if (otherUserId) {
            io.to(otherUserId).emit("user-left", { roomId });
        }
        socket.leave(roomId);
        rooms.delete(roomId);
        console.log(`User ${socket.id} left room ${roomId}`);
    }
}

// Use the port provided by the hosting platform (e.g., Railway) or 8000 for local testing
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});