const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let buttonStates = Array(8).fill(true);
let currentNames = Array(8).fill('');
let currentMSSVs = Array(8).fill('');
let waitingList = []; // Will remain as an empty array or can be populated from another source.

// Serve the static files (frontend)
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('A user connected');

    // Send the current button states and names to the newly connected user
    socket.emit('update-buttons', buttonStates, currentNames, currentMSSVs);

    // Handle button click event
    socket.on('button-click', async (index) => {
        console.log(`Button ${index} clicked`);

        // Toggle the button state
        buttonStates[index] = !buttonStates[index];

        if (buttonStates[index]) { // Red to Green (re-enable the button)
            if (waitingList.length > 0) {
                const nextPerson = waitingList.shift();
                currentNames[index] = nextPerson.name;
                currentMSSVs[index] = nextPerson.mssv;
            } else {
                currentNames[index] = '';  // Clear the name if waiting list is empty
                currentMSSVs[index] = '';
            }
        } else { // Green to Red (clear the button)
            currentNames[index] = '';  // Clear the current name and MSSV
            currentMSSVs[index] = '';
        }

        // Broadcast the updated states and names to all users
        io.emit('update-buttons', buttonStates, currentNames, currentMSSVs);
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
