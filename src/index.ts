import cors from "cors";
import dotenv from "dotenv";
import express, { Express, Request, Response } from "express";
import http from "http";
import { Server as SocketIOServer, Socket } from "socket.io";

dotenv.config();

const app: Express = express();
const server = http.createServer(app);
const io: SocketIOServer = new SocketIOServer(server);

const port = process.env.PORT || 3000;

// Use cors middleware to handle CORS issues
app.use(cors());

app.get("/", (req: Request, res: Response) => {
	res.json("Express + TypeScript Server Boiler Plate");
});

// Dictionary to store rooms and their users
interface Room {
	users: { [userId: string]: { username: string; color: string } }; // userId: { username, color }
}

const rooms: { [roomName: string]: Room } = {};

// Dictionary to store socket id and username mapping
const socketUsernameMap: { [socketId: string]: string } = {};

const generateRandomColor = (): string => {
	const randomColor = Math.floor(Math.random() * 16777215).toString(16);
	return "#" + randomColor;
};

io.on("connection", (socket: Socket) => {
	console.log("A user connected", socket.id);

	socket.on("createRoom", (roomName: string) => {
		console.log(`Room ${roomName} created by ${socket.id}`);
		// Store the room and its creator
		rooms[roomName] = { users: {} };
		socket.join(roomName);
	});

	socket.on(
		"join",
		({ roomName, username }: { roomName: string; username: string }) => {
			console.log(`User ${username} joined room ${roomName}`);
			// Join the room
			socket.join(roomName);
			// Check if the room exists, if not, create it
			if (!rooms[roomName]) {
				rooms[roomName] = { users: {} };
			}
			// Add the user to the list of users in the room with a random color
			const color = generateRandomColor();
			rooms[roomName].users[socket.id] = { username, color };
			// Store the username associated with the socket id
			socketUsernameMap[socket.id] = username;
			// Notify other users in the room about the new user
			socket
				.to(roomName)
				.emit("userJoined", { username, userId: socket.id, color });
		}
	);

	// Handling mouse position data
	socket.on("mousePosition", ({ x, y }) => {
		socket.rooms.forEach((room, index, arr) => {
			if (room !== socket.id) {
				const username = socketUsernameMap[socket.id];
				const color = rooms[room].users[socket.id].color;

				socket.to(room).emit("mousePosition", { username, x, y, color });
			}
		});
	});

	socket.on("disconnect", () => {
		console.log("User disconnected", socket.id);
		const username = socketUsernameMap[socket.id];
		delete socketUsernameMap[socket.id];
		// Remove the user from all rooms
		for (const roomName in rooms) {
			if (rooms.hasOwnProperty(roomName)) {
				const users = rooms[roomName].users;
				if (users.hasOwnProperty(socket.id)) {
					delete users[socket.id];
					// Notify other users in the room about the disconnection
					socket.to(roomName).emit("userLeft", { userId: socket.id });
					console.log(`User ${username} left room ${roomName}`);
					if (Object.keys(users).length === 0) {
						// If no users left in the room, delete the room
						delete rooms[roomName];
						console.log(`Room ${roomName} deleted`);
					}
				}
			}
		}
	});
});

server.listen(port, () => {
	console.log(`[server]: Server is running at http://localhost:${port}`);
});
