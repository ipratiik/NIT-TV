import { createContext, useMemo, useContext, useEffect } from "react";
import React from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

export const useSocket = () => {
    const socket = useContext(SocketContext);
    return socket;
};

export default function SocketProvider(props) {
    // Socket for video chat signaling (using the public Railway URL)
    const socket = useMemo(
        () =>
            io("wss://manittv.up.railway.app:8000", {
                transports: ["websocket", "polling"],
                reconnection: true, // Enable reconnection
                reconnectionAttempts: 5, // Number of reconnection attempts
                reconnectionDelay: 1000, // Delay between reconnection attempts (1 second)
            }),
        []
    );

    useEffect(() => {
        // Log connection status
        socket.on("connect", () => {
            console.log("Socket connected:", socket.id);
        });
        socket.on("connect_error", (error) => {
            console.error("Socket connection error:", error.message);
            console.error("Error details:", error);
        });
        socket.on("disconnect", (reason) => {
            console.log("Socket disconnected:", reason);
        });
        socket.on("reconnect", (attempt) => {
            console.log("Socket reconnected after attempt:", attempt);
        });
        socket.on("reconnect_failed", () => {
            console.error("Socket reconnection failed");
        });

        // Cleanup on unmount
        return () => {
            socket.disconnect();
        };
    }, [socket]);

    return (
        <SocketContext.Provider value={socket}>
            {props.children}
        </SocketContext.Provider>
    );
}