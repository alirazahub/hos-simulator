import { Container } from "@mui/material";
import Navbar from "./components/Navbar";
import HOSSimulator from "./components/HOSSimulator";

export default function App() {
  return (
    <div>
      <Navbar />
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <HOSSimulator />
      </Container>
    </div>
  );
}
