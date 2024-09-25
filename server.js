const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { google } = require('googleapis');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let buttonStates = [false, false, false, false];
let currentIndex = 0; // Start from the 5th row (index 4)
let names = [];

// Set up Google Sheets API
const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json', // Đảm bảo bạn có credentials.json
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

async function getAuthClient() {
    const authClient = await auth.getClient();
    return authClient;
}

async function fetchNames() {
    try {
        console.log('Fetching names from Google Sheets...');
        const authClient = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth: authClient });

        const spreadsheetId = ''; // Thay bằng ID sheet của bạn
        const range = 'Sheet1!A:B'; // Thay đổi range theo yêu cầu

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: range,
        });

        if (response.data.values.length) {
            names = response.data.values.slice(1).map(row => row[1]); // Bắt đầu từ hàng thứ 5
            console.log('Names from Google Sheets:', names);
        } else {
            console.log('No data found in the specified range.');
        }
    } catch (error) {
        console.error('Error fetching data from Google Sheets:', error);
    }
}

// Fetch names every 5 seconds
setInterval(fetchNames, 5000); // Kiểm tra thay đổi mỗi 5 giây

// Serve the static files (frontend)
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('A user connected');

    // Send the current button states to the newly connected user
    socket.emit('update-buttons', buttonStates, names.slice(0, 4));
    console.log('Sent current button states and names to new user');

    // Handle button click event
    socket.on('button-click', (index) => {
        console.log(`Button ${index} clicked`);

        // Toggle the button state
        buttonStates[index] = !buttonStates[index];

        let name = '';
        if (buttonStates[index] === false) { // Changed from red to green
            name = names[currentIndex] || '';
            console.log(`Assigned name: ${name} at index ${currentIndex}`);
            currentIndex++;
        }

        // Broadcast the updated states to all users
        io.emit('update-buttons', buttonStates, [name]);
        console.log('Updated button states and name sent to all users');
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
