import { useMemo, useState } from "react";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Container,
} from "@mui/material";
import Navbar from "./components/Navbar";

export default function App() {
  const [mode, setMode] = useState("light");

  const theme = useMemo(() => {
    const base = {
      mode,
    };

    const darkOverrides = {
      primary: {
        main: "#7dd3fc",
      },
      secondary: {
        main: "#90cdf4",
      },
      background: {
        default: "#0b1220",
        paper: "#0f1724",
      },
      text: {
        primary: "#e6f0ff",
        secondary: "#bcd5ea",
      },
      divider: "rgba(255,255,255,0.08)",
    };

    return createTheme({
      palette: mode === "dark" ? { ...base, ...darkOverrides } : base,
    });
  }, [mode]);

  const toggleMode = () =>
    setMode((prev) => (prev === "light" ? "dark" : "light"));

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <Navbar mode={mode} onToggle={toggleMode} />

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        Hello
      </Container>
    </ThemeProvider>
  );
}
