import { Container, CssBaseline } from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import React, { useMemo, useState } from "react";
import Navbar from "./components/Navbar";
import HOSSimulator from "./components/HOSSimulator";

export default function App() {
  const [mode, setMode] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("theme") || "light" : "light"
  );

  const toggleTheme = () => {
    const next = mode === "light" ? "dark" : "light";
    setMode(next);
    try {
      localStorage.setItem("theme", next);
    } catch (e) {}
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: { main: "#00897b" }, // teal
          secondary: { main: "#1976d2" },
          error: { main: "#ff6f00" }, // warm accent
          background: {
            default: mode === "dark" ? "#071018" : "#fafafa",
            paper: mode === "dark" ? "#071721" : "#ffffff",
          },
        },
        shape: { borderRadius: 8 },
      }),
    [mode]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div>
        <Navbar mode={mode} toggleTheme={toggleTheme} />
        <Container maxWidth="lg" sx={{ mt: 4 }}>
          <HOSSimulator />
        </Container>
      </div>
    </ThemeProvider>
  );
}
