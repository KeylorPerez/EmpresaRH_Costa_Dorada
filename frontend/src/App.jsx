import React from "react";
import AppRouter from "./routes/AppRouter";
import AppErrorBoundary from "./components/AppErrorBoundary";
import "./App.css";

function App() {
  return (
    <AppErrorBoundary>
      <AppRouter />
    </AppErrorBoundary>
  );
}

export default App;
