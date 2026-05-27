import React from "react";
import ReactDOM from "react-dom/client";

import { AppRouter } from "./app/router";
import { ToastProvider } from "./components/UI/ToastProvider";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
      <AppRouter />
    </ToastProvider>
  </React.StrictMode>
);
