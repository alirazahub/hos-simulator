import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import Box from "@mui/material/Box";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";

export default function Navbar({ mode = "light", onToggle = () => {} }) {
  return (
    <AppBar
      position="static"
      color="transparent"
      elevation={0}
      sx={{ borderBottom: (theme) => `1px solid ${theme.palette.divider}` }}
    >
      <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            Hos Simulator
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {mode === "dark" ? (
            <Brightness7Icon sx={{ color: "warning.main" }} />
          ) : (
            <Brightness4Icon sx={{ color: "primary.main" }} />
          )}
          <Switch
            checked={mode === "dark"}
            onChange={onToggle}
            inputProps={{ "aria-label": "theme toggle" }}
          />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
