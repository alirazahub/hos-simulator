import React, { useState, useCallback, useEffect, useRef } from "react";
import { Truck, Map, Clock, LogOut } from "lucide-react";
import {
  Container,
  Box,
  Typography,
  Grid,
  TextField,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  InputAdornment,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Autocomplete,
} from "@mui/material";
import { ExpandMore } from "@mui/icons-material";
import { styled } from "@mui/material/styles";
import MapView from "./MapView";
import {
  getCoordinatesFromAddress,
  ASSUMPTIONS,
  US_STATES,
  drawLogSheet,
} from "../utils/helper";
import MuiInput from "./MuiInput";

const SectionCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.spacing(2),
  boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
  border: `1px solid ${theme.palette.divider}`,
  background: "linear-gradient(180deg, #fff, #fafafa)",
}));

const HOSSimulator = () => {
  const [currentLocation, setCurrentLocation] = useState(US_STATES[0]);
  const [pickupLocation, setPickupLocation] = useState(US_STATES[9]);
  const [dropoffLocation, setDropoffLocation] = useState(US_STATES[19]);
  const [cycleUsed, setCycleUsed] = useState(30); // Hours
  const [tripDistance, setTripDistance] = useState(1500); // Miles
  const [currentCoords, setCurrentCoords] = useState(null);
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);

  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);

  const canvasRefs = useRef([]);

  const handleSimulate = async () => {
    setIsLoading(true);
    setResults(null);

    try {
      const [curRes, pickRes, dropRes] = await Promise.all([
        getCoordinatesFromAddress(currentLocation),
        getCoordinatesFromAddress(pickupLocation),
        getCoordinatesFromAddress(dropoffLocation),
      ]);

      const errors = [];
      if (!curRes)
        errors.push(`Could not geocode Current Location: "${currentLocation}"`);
      if (!pickRes)
        errors.push(`Could not geocode Pickup Location: "${pickupLocation}"`);
      if (!dropRes)
        errors.push(`Could not geocode Dropoff Location: "${dropoffLocation}"`);

      setCurrentCoords(curRes ? curRes.coords : null);
      setPickupCoords(pickRes ? pickRes.coords : null);
      setDropoffCoords(dropRes ? dropRes.coords : null);

      try {
        const resp = await fetch("http://127.0.0.1:8000/api/process/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tripDistance, cycleUsed }),
        });

        if (!resp.ok) {
          const errBody = await resp.json().catch(() => null);
          const msg =
            (errBody && errBody.error) || `Server returned ${resp.status}`;
          throw new Error(msg);
        }

        const data = await resp.json();
        setResults(data);
      } catch (err) {
        console.warn(
          "Backend simulation failed, falling back to local calc:",
          err
        );
      }
    } catch (error) {
      console.error("Simulation failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const memoizedDrawLogSheet = useCallback(drawLogSheet, []);

  useEffect(() => {
    if (results && canvasRefs.current.length > 0) {
      for (let i = 0; i < results.totalDays; i++) {
        const canvas = canvasRefs.current[i];
        if (canvas) {
          const dayLogs = results.logs.filter((log) => log.day === i + 1);
          memoizedDrawLogSheet(canvas, i + 1, dayLogs);
        }
      }
    }
  }, [results, memoizedDrawLogSheet]);

  return (
    <Container
      maxWidth="xl"
      sx={{
        py: 6,
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #fafafa 0%, #f5f5f5 50%, #ffffff 100%)",
      }}
    >
      <Box sx={{ maxWidth: "lg", mx: "auto" }}>
        <Typography
          variant="h3"
          fontWeight="bold"
          textAlign="center"
          sx={{ mb: 1, color: "error.main" }}
        >
          FMCSA Hours of Service Planner
        </Typography>
        <Typography
          variant="subtitle1"
          color="text.secondary"
          textAlign="center"
          sx={{ mb: 5 }}
        >
          Plan long-haul trips, ensure FMCSA compliance, and auto-generate daily
          ELD logs.
        </Typography>
        <SectionCard
          sx={{
            mb: 4,
            py: 2,
            px: 3,
            position: "relative",
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
            background: "linear-gradient(180deg, #fff, #fafafa)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "5px",
              height: "100%",
              background: "linear-gradient(180deg, #ffb74d, #f57c00)",
              borderRadius: "0 4px 4px 0",
            }}
          />

          <Box sx={{ pl: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Typography
                variant="subtitle1"
                fontWeight="bold"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  color: "error.dark",
                }}
              >
                <Clock size={18} />
                Simulation Assumptions
              </Typography>
            </Box>

            <Grid container spacing={1}>
              {ASSUMPTIONS.slice(0, 3).map((a, i) => (
                <Grid item xs={12} md={4} key={i}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.2,
                      borderRadius: 1.5,
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 1,
                      bgcolor: "#fffaf2",
                      border: "1px solid #ffe0b2",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        boxShadow: "0 2px 6px rgba(255,152,0,0.2)",
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        bgcolor: "error.main",
                        mt: 0.6,
                      }}
                    />
                    <Typography
                      variant="body2"
                      color="text.primary"
                      sx={{ lineHeight: 1 }}
                    >
                      {a}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1.5 }}>
              <Button
                variant="contained"
                color="error"
                size="small"
                onClick={() => setAssumptionsOpen(true)}
                sx={{
                  borderRadius: 2,
                  fontWeight: 600,
                  textTransform: "none",
                  px: 2.2,
                  py: 0.6,
                  fontSize: "0.6rem",
                  boxShadow: "0 2px 6px rgba(245,124,0,0.3)",
                  "&:hover": {
                    boxShadow: "0 3px 10px rgba(245,124,0,0.4)",
                    transform: "translateY(-1px)",
                  },
                  transition: "all 0.25s ease",
                }}
              >
                View All
              </Button>
            </Box>
          </Box>
        </SectionCard>

        <SectionCard sx={{ mb: 6 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
            <Truck size={24} style={{ marginRight: 8, color: "#D32F2F" }} />
            <Typography variant="h6" fontWeight="bold">
              Trip & Cycle Inputs
            </Typography>
          </Box>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={4}>
              <Autocomplete
                options={US_STATES}
                value={currentLocation}
                onChange={(event, newValue) =>
                  setCurrentLocation(newValue || "")
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Current Location"
                    variant="outlined"
                    size="small"
                    style={{ width: 330 }}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position="start">
                          <Map size={18} color="action" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                        backgroundColor: "white",
                        "&.Mui-focused fieldset": {
                          borderColor: "#D32F2F",
                          boxShadow: "0 0 0 2px rgba(211,47,47,0.2)",
                        },
                      },
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Autocomplete
                options={US_STATES}
                value={pickupLocation}
                onChange={(event, newValue) =>
                  setPickupLocation(newValue || "")
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Pickup Location"
                    variant="outlined"
                    size="small"
                    style={{ width: 330 }}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position="start">
                          <Map size={18} color="action" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                        backgroundColor: "white",
                        "&.Mui-focused fieldset": {
                          borderColor: "#D32F2F",
                          boxShadow: "0 0 0 2px rgba(211,47,47,0.2)",
                        },
                      },
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Autocomplete
                options={US_STATES}
                value={dropoffLocation}
                onChange={(event, newValue) =>
                  setDropoffLocation(newValue || "")
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Dropoff Location"
                    variant="outlined"
                    size="small"
                    style={{ width: 330 }}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position="start">
                          <Map size={18} color="action" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                        backgroundColor: "white",
                        "&.Mui-focused fieldset": {
                          borderColor: "#D32F2F",
                          boxShadow: "0 0 0 2px rgba(211,47,47,0.2)",
                        },
                      },
                    }}
                  />
                )}
              />
            </Grid>
            <Grid style={{ width: 330 }} item xs={12} sm={6} md={4}>
              <MuiInput
                label="Trip Distance (Miles)"
                icon={Truck}
                type="number"
                value={tripDistance}
                onChange={(e) =>
                  setTripDistance(parseFloat(e.target.value) || 0)
                }
              />
            </Grid>
            <Grid item xs={12} style={{ width: 330 }} sm={6} md={4}>
              <MuiInput
                label="Cycle Used (Hrs/70)"
                icon={Clock}
                type="number"
                value={cycleUsed}
                onChange={(e) => setCycleUsed(parseFloat(e.target.value) || 0)}
              />
            </Grid>
            <Grid>
              <Button
                onClick={handleSimulate}
                disabled={isLoading || tripDistance <= 0}
                variant="contained"
                color="error"
                style={{ width: 330 }}
                size="large"
                sx={{
                  borderRadius: 3,
                  boxShadow: "0 4px 10px rgba(211,47,47,0.3)",
                  "&:hover": {
                    boxShadow: "0 6px 15px rgba(211,47,47,0.4)",
                    transform: "translateY(-2px)",
                  },
                  transition: "all 0.25s",
                }}
              >
                {isLoading ? (
                  <CircularProgress size={22} color="inherit" sx={{ mr: 1 }} />
                ) : (
                  "Run Simulation"
                )}
              </Button>
            </Grid>
          </Grid>
        </SectionCard>

        {results && (
          <Box>
            <Typography
              color="error.main"
              variant="h4"
              fontWeight="bold"
              sx={{
                mb: 3,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              Simulation Results
            </Typography>

            <SectionCard sx={{ mb: 5 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <Map size={20} style={{ marginRight: 8, color: "#D32F2F" }} />
                <Typography variant="h6" fontWeight="bold">
                  Route & Activity Summary
                </Typography>
              </Box>
              <TableContainer
                sx={{
                  borderRadius: 2,
                  border: "1px solid #eee",
                  maxHeight: 400,
                  overflowY: "auto",
                }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Day</TableCell>
                      <TableCell>Time</TableCell>
                      <TableCell>Activity</TableCell>
                      <TableCell>Location</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.routeSummary.map((item, i) => (
                      <TableRow
                        key={i}
                        sx={{
                          bgcolor:
                            item.activity.includes("Break") ||
                            item.activity.includes("Rest")
                              ? "rgba(76,175,80,0.1)"
                              : "inherit",
                        }}
                      >
                        <TableCell>{item.day}</TableCell>
                        <TableCell>{item.time}</TableCell>
                        <TableCell>{item.activity}</TableCell>
                        <TableCell>{item.location}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </SectionCard>

            <SectionCard>
              <Typography
                variant="h6"
                fontWeight="bold"
                sx={{ mb: 2, display: "flex", alignItems: "center" }}
              >
                <LogOut
                  size={22}
                  style={{ marginRight: 8, color: "#D32F2F" }}
                />
                Generated Daily ELD Logs
              </Typography>

              {Array.from({ length: results.totalDays }).map((_, i) => (
                <Accordion key={i} sx={{ mb: 2, borderRadius: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography fontWeight="bold">
                      Log Sheet - Day {i + 1}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <canvas
                      ref={(el) => (canvasRefs.current[i] = el)}
                      width={1340}
                      height={380}
                      style={{
                        border: "1px solid #ccc",
                        borderRadius: "8px",
                        display: "block",
                        maxWidth: "100%",
                        height: "300px",
                      }}
                    />
                  </AccordionDetails>
                </Accordion>
              ))}
            </SectionCard>
          </Box>
        )}

        {results && (
          <SectionCard sx={{ mt: 5 }}>
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <Map size={20} style={{ marginRight: 8, color: "#D32F2F" }} />
                <Typography variant="h6" fontWeight="bold">
                  Route Visualization
                </Typography>
              </Box>
              <MapView
                points={[
                  currentCoords
                    ? {
                        coords: currentCoords,
                        label: "Current Location",
                        address: currentLocation,
                        type: "current",
                      }
                    : null,
                  pickupCoords
                    ? {
                        coords: pickupCoords,
                        label: "Pickup Location",
                        address: pickupLocation,
                        type: "pickup",
                      }
                    : null,
                  dropoffCoords
                    ? {
                        coords: dropoffCoords,
                        label: "Dropoff Location",
                        address: dropoffLocation,
                        type: "dropoff",
                      }
                    : null,
                ]}
              />
            </Box>
          </SectionCard>
        )}

        <Dialog
          open={assumptionsOpen}
          onClose={() => setAssumptionsOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Simulation Assumptions</DialogTitle>
          <DialogContent dividers>
            <List>
              {ASSUMPTIONS.map((item, idx) => (
                <React.Fragment key={idx}>
                  <ListItem disableGutters>
                    <ListItemText primary={item} />
                  </ListItem>
                  {idx < ASSUMPTIONS.length - 1 && <Divider component="li" />}
                </React.Fragment>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAssumptionsOpen(false)} color="primary">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default HOSSimulator;
