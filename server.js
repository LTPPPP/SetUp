const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { google } = require('googleapis');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const spreadsheetId = '';

let buttonStates = Array(8).fill(true);
let currentNames = Array(8).fill('');
let currentMSSVs = Array(8).fill('');
let waitingList = [];

// Set up Google Sheets API
const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function getAuthClient() {
    const authClient = await auth.getClient();
    return authClient;
}

// Fetch names, MSSV, and status
async function fetchData() {
    try {
        console.log('Fetching data from Google Sheets...');
        const authClient = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth: authClient });
        const range = 'Điểm Danh!A6:G'; // Start from row 6, columns A to G

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: range,
        });

        if (response.data.values && response.data.values.length) {
            waitingList = response.data.values
                .filter(row => row[6] === 'Đang Chờ')
                .map(row => ({
                    name: row[0],
                    mssv: row[1],
                    rowIndex: response.data.values.indexOf(row) + 6 // +6 because we start from row 6
                }));

            console.log('Fetched waiting list:', waitingList);
        } else {
            console.log('No data found in the specified range.');
        }
    } catch (error) {
        console.error('Error fetching data from Google Sheets:', error);
    }
}

// Update status to "Đã Phỏng Vấn" for the specified row
async function updateStatus(rowIndex) {
    try {
        const authClient = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth: authClient });
        const range = `Điểm Danh!G${rowIndex}`;

        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: range,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [['Đã Phỏng Vấn']]
            }
        });

        console.log(`Updated status to "Đã Phỏng Vấn" for row ${rowIndex}`);
    } catch (error) {
        console.error('Error updating status:', error);
    }
}

// Fetch data every 5 seconds
setInterval(fetchData, 5000);

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

        if (buttonStates[index]) { // Green to Red
            if (waitingList.length > 0) {
                const nextPerson = waitingList.shift();
                currentNames[index] = nextPerson.name;
                currentMSSVs[index] = nextPerson.mssv;
                await updateStatus(nextPerson.rowIndex);
            }
        } else { // Red to Blue
            currentNames[index] = '';
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