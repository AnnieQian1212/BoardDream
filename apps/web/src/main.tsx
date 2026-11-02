import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/inter";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { RoomPage } from "./components/RoomPage";
import "./styles.css";

// ?room=<code> is a table shared with friends; everything else is the app.
const room = new URLSearchParams(window.location.search).get("room");

createRoot(document.getElementById("root")!).render(<StrictMode>{room ? <RoomPage code={room} /> : <App />}</StrictMode>);
