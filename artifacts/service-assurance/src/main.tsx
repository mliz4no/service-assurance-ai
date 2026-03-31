import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

const TOKEN_KEY = "sa_auth_token";

setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

createRoot(document.getElementById("root")!).render(<App />);
