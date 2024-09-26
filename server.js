const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { google } = require('googleapis');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let buttonStates = Array(8).fill(false);
let currentIndex = 0;
let names = [];
let checkboxStates = [];

// Set up Google Sheets API
const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
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

        const spreadsheetId = '16YLsvBoO5qtbfQdNoGLzUVL3Xeh4uKa8m1JDn4Wb6u4';
        const range = 'Sheet1!A:C'; // Changed to include column C

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: range,
        });

        if (response.data.values.length) {
            names = [];
            checkboxStates = [];
            response.data.values.slice(1).forEach(row => {
                if (row[2] !== 'TRUE') { // Check if the checkbox is not checked
                    names.push(row[1]);
                    checkboxStates.push(row[2] === 'TRUE');
                }
            });
            console.log('Names and checkbox states from Google Sheets:', names, checkboxStates);
        } else {
            console.log('No data found in the specified range.');
        }
    } catch (error) {
        console.error('Error fetching data from Google Sheets:', error);
    }
}

async function updateCheckbox(index) {
    try {
        const authClient = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth: authClient });

        const spreadsheetId = '16YLsvBoO5qtbfQdNoGLzUVL3Xeh4uKa8m1JDn4Wb6u4';
        const range = `Sheet1!C${index + 2}`; // +2 because sheet is 1-indexed and we have a header row

        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: range,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [['TRUE']]
            }
        });

        console.log(`Updated checkbox for index ${index}`);
    } catch (error) {
        console.error('Error updating checkbox:', error);
    }
}

// Fetch names every 5 seconds
setInterval(fetchNames, 5000);

// Serve the static files (frontend)
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('A user connected');

    // Send the current button states to the newly connected user
    socket.emit('update-buttons', buttonStates, names.slice(0, 8));
    console.log('Sent current button states and names to new user');

    // Handle button click event
    socket.on('button-click', async (index) => {
        console.log(`Button ${index} clicked`);

        // Toggle the button state
        buttonStates[index] = !buttonStates[index];

        let name = '';
        if (buttonStates[index] === false) { // Changed from red to green
            name = names[currentIndex] || '';
            console.log(`Assigned name: ${name} at index ${currentIndex}`);
            await updateCheckbox(currentIndex);
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