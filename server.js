import { createServer } from "http";
import { WebSocketServer } from "ws";
import { createClient } from "redis";
import dotenv from "dotenv";

const port = process.env.PORT || 5006

// Load environment variables from .env file
dotenv.config();

// Redis Connection
const redisClient = createClient({
    url: `rediss://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
    password: process.env.REDIS_PASSWORD,
});

redisClient.on("error", (err) => console.error("Redis Error:", err));

(async () => {
    try {
        await redisClient.connect();
        console.log("✅ Connected to Redis");
    } catch (err) {
        console.error("❌ Failed to connect to Redis:", err);
    }
})();

// Create HTTP server
const server = createServer();

// Initialize WebSocket server
const wss = new WebSocketServer({ server });

wss.on("connection", async (ws, req) => {
    console.log("🔗 New WebSocket client connected");

    ws.on("message", async (message) => {
        try {
            const { projectName } = JSON.parse(message);

            if (!projectName) {
                ws.send(JSON.stringify({ error: "Missing projectName" }));
                return;
            }

            console.log(`📡 Client subscribed to logs: ${projectName}`);

            // Create a new Redis subscriber for this client
            const subscriber = redisClient.duplicate();
            await subscriber.connect();

            // Subscribe to the project-specific Redis channel
            await subscriber.subscribe(projectName, (log) => {
                ws.send(JSON.stringify({ projectName, log }));
            });

            // Handle WebSocket disconnection
            ws.on("close", async () => {
                console.log(`❌ Client disconnected from ${projectName}`);
                await subscriber.unsubscribe(projectName);
                await subscriber.quit();
            });
        } catch (err) {
            console.error("❌ Error handling message:", err);
        }
    });
});

server.listen(port, () => console.log(`🚀 WebSocket server running on port ${port}`));
