// File: server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let buttonStates = [false, false, false, false];

// Serve the static files (frontend)
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('a user connected');

    // Send the current button states to the newly connected user
    socket.emit('update-buttons', buttonStates);

    // Handle button click event
    socket.on('button-click', (index) => {
        // Toggle the button state
        buttonStates[index] = !buttonStates[index];

        // Broadcast the updated states to all users
        io.emit('update-buttons', buttonStates);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

server.listen(3000, () => {
    console.log('localhost:3000');
});
