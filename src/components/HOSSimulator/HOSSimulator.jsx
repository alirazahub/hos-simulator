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
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  Tooltip,
  Snackbar,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Autocomplete,
  MenuItem,
} from "@mui/material";
import { ExpandMore } from "@mui/icons-material";
import { styled } from "@mui/material/styles";
import MapView from "../MapView";

const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
  "District of Columbia",
];

// --- HOS Constants and Rules (Based on FMCSA 70hr/8day Property-Carrying) ---
const MAX_DRIVING_HOURS = 11; // 11-Hour Driving Limit
const MAX_WINDOW_HOURS = 14; // 14-Hour On-Duty Window Limit
const MAX_CYCLE_HOURS = 70; // 70-Hour / 8-Day Cycle Limit
const REQUIRED_DAILY_REST = 10; // Required 10 consecutive hours off duty
const REQUIRED_BREAK_HOURS = 8; // Must take break after 8 cumulative hours of driving
const REQUIRED_BREAK_DURATION = 0.5; // 30-minute break duration (0.5 hours)
const AVG_DRIVING_SPEED = 60; // Assumed average speed in MPH
const FUELING_INTERVAL_MILES = 1000;
const FUELING_DURATION = 0.5; // 30 minutes for fueling

// Full assumptions text shown in modal
const ASSUMPTIONS = [
  "Driver Type: Property-Carrying, 70hrs/8-day cycle.",
  "Speed: Average " +
    AVG_DRIVING_SPEED +
    " MPH for distance-to-time conversion.",
  "Pickup/Dropoff: Exactly 1 hour On-Duty (Line 4) at the start/end of the first/last driving day.",
  "Fueling: Exactly " +
    FUELING_DURATION * 60 +
    " minutes On-Duty every " +
    FUELING_INTERVAL_MILES +
    " cumulative miles driven.",
  "Breaks: 30-minute break is mandatory after " +
    REQUIRED_BREAK_HOURS +
    " cumulative driving hours, taken as Off-Duty (Line 1).",
  "Rest: 10 consecutive hours Off-Duty/Sleeper Berth is enforced at the end of the 14-hour window or 11 hours of driving.",
  "Pre/Post trip: 1 hour On-Duty for pre-trip inspection/loading and unloading at pickup/dropoff.",
  "Cycle restart: 34-hour restart logic applied when 70-hour cycle is exhausted.",
  "Fueling and break locations are approximated and chosen when mile thresholds are crossed; real routes may vary.",
  "This tool is a planner/simulator only and does not replace legal guidance or official ELD systems.",
];

async function getCoordinatesFromAddress(address) {
  if (!address) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      address
    )}&limit=1`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        // polite User-Agent - replace with your app name or email in production
        "User-Agent": "HOSSimulator/1.0 (your-email@example.com)",
      },
    });
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        coords: [parseFloat(data[0].lat), parseFloat(data[0].lon)],
        address: data[0].display_name,
      };
    }
    return null;
  } catch (err) {
    console.error("Geocoding error:", err);
    return null;
  }
}
// Helper function to convert hours (e.g., 9.5) to HH:MM format
const formatTime = (hours) => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

// --- HOS Log Generation Logic (Unchanged) ---

const calculateHOSLogs = (tripDistance, initialCycleUsed) => {
  const logs = [];
  const routeSummary = [];

  let totalDrivingTimeNeeded = tripDistance / AVG_DRIVING_SPEED;
  let currentCycleUsed = initialCycleUsed;
  let currentDay = 1;
  let remainingTripTime = totalDrivingTimeNeeded;

  let currentTime = 0; // Time in the current 24-hour log (0 to 24)
  let currentDrivingHours = 0; // Driving hours since last 10-hour rest
  let drivingSinceBreak = 0; // Driving hours since last 30-min break
  let dailyDriving = 0;
  let dailyOnDuty = 0;

  const getStatusLine = (status) => {
    switch (status) {
      case "OFF":
        return 1; // Off Duty
      case "SB":
        return 2; // Sleeper Berth
      case "D":
        return 3; // Driving
      case "ON":
        return 4; // On Duty (Not Driving)
      default:
        return 0;
    }
  };

  const addLogEntry = (status, duration, location, remarks, type) => {
    // const startHour = Math.floor(currentTime);
    // const startMinute = Math.round((currentTime - startHour) * 60);

    logs.push({
      day: currentDay,
      start: currentTime,
      end: currentTime + duration,
      status: status,
      location: location,
      remarks: remarks,
      dutyLine: getStatusLine(status),
      type: type, // 'D' for driving, 'ON' for on-duty work, 'BREAK' for rest
    });
    currentTime += duration;
  };

  const startNewDay = (reason) => {
    if (currentTime < 24) {
      // Complete the current day with the required 10-hour rest
      const remainingDayTime = 24 - currentTime;
      const requiredRest = REQUIRED_DAILY_REST;
      const actualRest = Math.max(requiredRest, remainingDayTime);

      // Use Sleeper Berth for required rest to reflect SB usage in logs/visualization
      addLogEntry("SB", actualRest, "Rest Location", reason, "REST");
    }

    // Reset for the new day
    currentDay += 1;
    currentTime = 0;
    currentDrivingHours = 0;
    drivingSinceBreak = 0;
    dailyDriving = 0;
    dailyOnDuty = 0;
  };

  // --- Start of Trip Simulation ---
  addLogEntry(
    "ON",
    1,
    "Current Location",
    "Pre-Trip Inspection / Initial Hookup",
    "WORK"
  ); // Initial 1 hr On-Duty
  dailyOnDuty += 1;
  currentCycleUsed += 1;
  routeSummary.push({
    day: currentDay,
    time: formatTime(1),
    activity: "Pre-Trip & Hookup",
    location: "Start Location",
  });

  // Add Pickup (1 hour)
  addLogEntry("ON", 1, "Pickup Location", "Loading/Pickup", "WORK");
  dailyOnDuty += 1;
  currentCycleUsed += 1;
  routeSummary.push({
    day: currentDay,
    time: formatTime(2),
    activity: "Loading/Pickup",
    location: "Pickup Location",
  });

  let milesDriven = 0;

  while (remainingTripTime > 0) {
    let driveSegment = Math.min(
      remainingTripTime,
      MAX_DRIVING_HOURS - dailyDriving
    );
    driveSegment = Math.min(driveSegment, MAX_WINDOW_HOURS - dailyOnDuty);
    driveSegment = Math.min(driveSegment, MAX_CYCLE_HOURS - currentCycleUsed);

    // Check 30-minute break rule: Must break before 8 cumulative hours of driving
    if (drivingSinceBreak + driveSegment > REQUIRED_BREAK_HOURS) {
      driveSegment = REQUIRED_BREAK_HOURS - drivingSinceBreak;
    }

    // Check if the drive segment exceeds the 14-hour window
    if (currentTime + driveSegment > MAX_WINDOW_HOURS) {
      driveSegment = MAX_WINDOW_HOURS - currentTime;
    }

    // --- Daily Rest Check ---
    if (driveSegment <= 0) {
      // If we can't drive, we must check why
      if (currentDrivingHours >= MAX_DRIVING_HOURS) {
        startNewDay("Reached 11-Hour Driving Limit");
        continue;
      }
      if (dailyOnDuty >= MAX_WINDOW_HOURS) {
        startNewDay("Reached 14-Hour Window Limit");
        continue;
      }
      if (
        drivingSinceBreak >= REQUIRED_BREAK_HOURS &&
        dailyDriving < MAX_DRIVING_HOURS
      ) {
        // Need to take a 30-minute break
        addLogEntry(
          "OFF",
          REQUIRED_BREAK_DURATION,
          "Roadside Rest",
          "30-Minute Rest Break",
          "BREAK"
        );
        drivingSinceBreak = 0; // Reset counter after break
        routeSummary.push({
          day: currentDay,
          time: formatTime(currentTime),
          activity: "30-Minute Break",
          location: "Roadside Rest",
        });
        continue;
      }
      if (currentCycleUsed >= MAX_CYCLE_HOURS) {
        // Cycle limit reached. Need a 34-hour restart.
        routeSummary.push({
          day: currentDay,
          time: formatTime(currentTime),
          activity: "70-Hour Cycle Limit Reached",
          location: "Terminal/Home",
        });
        // Take a 34-hour rest (24 hours for the current log + 10 hours for the next one)
        const totalRest = 34 + (24 - currentTime);
        // Use Sleeper Berth for the 34-hour restart period
        addLogEntry(
          "SB",
          totalRest,
          "Terminal/Home",
          "34-Hour Restart",
          "RESTART"
        );
        currentCycleUsed = 0; // Restart cycle
        startNewDay("34-Hour Restart Completed");
        continue;
      }
      // If none of the above, it's end of a 14-hour window.
      startNewDay("End of Daily Driving Window");
      continue;
    }

    // --- Fueling Check (Every 1000 miles) ---
    const segmentMiles = driveSegment * AVG_DRIVING_SPEED;
    if (
      Math.floor((milesDriven + segmentMiles) / FUELING_INTERVAL_MILES) >
      Math.floor(milesDriven / FUELING_INTERVAL_MILES)
    ) {
      // Fueling will occur in this segment. Calculate time to fueling spot.
      const milesToFuel =
        FUELING_INTERVAL_MILES - (milesDriven % FUELING_INTERVAL_MILES);
      const timeToFuel = milesToFuel / AVG_DRIVING_SPEED;

      if (timeToFuel < driveSegment) {
        // 1. Drive to fueling station
        addLogEntry(
          "D",
          timeToFuel,
          "On Route",
          "Driving to Fuel Stop",
          "DRIVE"
        );
        currentDrivingHours += timeToFuel;
        drivingSinceBreak += timeToFuel;
        dailyDriving += timeToFuel;
        currentCycleUsed += timeToFuel;
        milesDriven += milesToFuel;
        remainingTripTime -= timeToFuel;
        routeSummary.push({
          day: currentDay,
          time: formatTime(currentTime),
          activity: `Driving ${Math.round(milesToFuel)} miles`,
          location: "On Route",
        });

        // 2. Fuel stop (On-Duty, Not Driving)
        addLogEntry("ON", FUELING_DURATION, "Fuel Station", "Fueling", "WORK");
        dailyOnDuty += FUELING_DURATION;
        currentCycleUsed += FUELING_DURATION;
        routeSummary.push({
          day: currentDay,
          time: formatTime(currentTime),
          activity: "Fueling Stop (30 mins)",
          location: "Fuel Station",
        });

        // Recalculate remaining segment time
        driveSegment = driveSegment - timeToFuel;
        if (driveSegment <= 0) continue; // Go back to top of loop to re-evaluate limits
      }
    }

    // --- Perform Drive Segment ---
    if (driveSegment > 0) {
      addLogEntry("D", driveSegment, "On Route", "Driving", "DRIVE");
      currentDrivingHours += driveSegment;
      drivingSinceBreak += driveSegment;
      dailyDriving += driveSegment;
      dailyOnDuty += driveSegment;
      currentCycleUsed += driveSegment;
      remainingTripTime -= driveSegment;
      milesDriven += driveSegment * AVG_DRIVING_SPEED;
      routeSummary.push({
        day: currentDay,
        time: formatTime(currentTime),
        activity: `Driving ${Math.round(
          driveSegment * AVG_DRIVING_SPEED
        )} miles`,
        location: "On Route",
      });
    }
  }

  // --- Trip Completed ---
  // Final Dropoff (1 hour)
  if (remainingTripTime <= 0) {
    if (
      currentTime + 1 > MAX_WINDOW_HOURS ||
      currentCycleUsed + 1 > MAX_CYCLE_HOURS
    ) {
      // Must rest before dropoff
      startNewDay("Required Rest before Final Dropoff");
    }
    addLogEntry("ON", 1, "Dropoff Location", "Unloading/Dropoff", "WORK");
    dailyOnDuty += 1;
    currentCycleUsed += 1;
    routeSummary.push({
      day: currentDay,
      time: formatTime(currentTime),
      activity: "Unloading/Dropoff",
      location: "Dropoff Location",
    });

    // End of final day: 8 consecutive hours of off duty/sleeper berth required.
    const requiredOff = 8;
    const offTime = requiredOff + (24 - currentTime); // Ensure end-of-day rest extends to a full day
    // Use Sleeper Berth at final rest to indicate SB usage
    addLogEntry(
      "SB",
      offTime,
      "Home/Terminal",
      "Final Post-Trip Inspection and Rest",
      "END"
    );
  }

  return {
    logs,
    routeSummary,
    totalDays: currentDay,
    finalCycleUsed: currentCycleUsed,
  };
};

// --- Custom Input Component (MUI version) ---
const MuiInput = ({
  label,
  icon: Icon,
  value,
  onChange,
  type = "text",
  min,
  max,
  fullWidth = true,
}) => (
  <TextField
    label={label}
    variant="outlined"
    type={type}
    value={value}
    onChange={onChange}
    fullWidth={fullWidth}
    size="small"
    InputProps={{
      startAdornment: (
        <InputAdornment position="start">
          <Icon size={18} color="action" />
        </InputAdornment>
      ),
      inputProps: {
        min: min,
        max: max,
      },
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
);

const SectionCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.spacing(2),
  boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
  border: `1px solid ${theme.palette.divider}`,
  background: "linear-gradient(180deg, #fff, #fafafa)",
}));

// --- Styled Components for Canvas/Log Sheet (Unchanged Logic, just styled Box) ---
const LogSheetContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.spacing(2),
  marginBottom: theme.spacing(4),
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: "#fff",
  overflowX: "auto",
}));

// --- HOS Log Visualization Logic (Unchanged) ---
const drawLogSheet = (canvas, day, dayLogs) => {
  if (!canvas || !dayLogs || dayLogs.length === 0) return;

  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  // Y positions for duty lines (50px vertical spacing)
  const dutyLinesY = { 1: 80, 2: 130, 3: 180, 4: 230 };
  const chartAreaY = dutyLinesY[1]; // Top of the chart area
  const chartAreaBottom = dutyLinesY[4]; // Bottom of the chart area

  // Clear Canvas
  ctx.clearRect(0, 0, width, height);

  // --- Draw Grid and Time Labels ---
  ctx.strokeStyle = "#D1D5DB"; // Light gray for grid lines
  ctx.lineWidth = 1;
  ctx.font = "9px sans-serif";
  ctx.textAlign = "center";
  const hourWidth = width / 24;

  // Draw vertical lines (hours) and labels
  for (let i = 0; i <= 24; i++) {
    const x = i * hourWidth;

    // Draw the vertical grid line
    ctx.strokeStyle = i % 1 === 0 ? "#D1D5DB" : "#F3F4F6";
    ctx.lineWidth = i % 1 === 0 ? 1 : 0.5;

    ctx.beginPath();
    ctx.moveTo(x, chartAreaY);
    ctx.lineTo(x, chartAreaBottom); // Only draw vertical lines within the chart
    ctx.stroke();

    // Time labels (00:00, 01:00, etc.)
    if (i < 24) {
      ctx.fillStyle = "#374151";
      // Positioned 20px below the lowest duty status line (Line 4)
      ctx.fillText(String(i).padStart(2, "0") + ":00", x, chartAreaBottom + 30);
    }
  }

  // Draw horizontal duty status lines (Darker and thicker)
  ctx.strokeStyle = "#9CA3AF";
  ctx.lineWidth = 2;
  Object.values(dutyLinesY).forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  });

  // Draw Duty Status Labels (Aligned Professionally)
  ctx.fillStyle = "#111827";
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "left";

  // Y-offset of 12 places the text baseline correctly in the center of the vertical slot.
  const labelYOffset = 12;
  ctx.fillText("OFF Duty", 5, dutyLinesY[1] + labelYOffset);
  ctx.fillText("Sleeper Berth", 5, dutyLinesY[2] + labelYOffset);
  ctx.fillText("Driving", 5, dutyLinesY[3] + labelYOffset);
  ctx.fillText("On Duty", 5, dutyLinesY[4] + labelYOffset);

  // Time Header above the chart
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Time (Hours)", 5, chartAreaY - 15);

  // --- Draw Log Entries (Red Line) ---
  ctx.strokeStyle = "#D32F2F";
  ctx.lineWidth = 4;

  dayLogs.forEach((log, index) => {
    const startX = log.start * hourWidth;
    const endX = log.end * hourWidth;
    const startY = dutyLinesY[log.dutyLine];
    const endY = dutyLinesY[log.dutyLine];

    // Draw horizontal line segment
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Draw vertical connections to the next status change
    const nextLog = dayLogs[index + 1];
    if (nextLog) {
      const nextY = dutyLinesY[nextLog.dutyLine];
      if (startY !== nextY) {
        ctx.beginPath();
        ctx.moveTo(endX, startY);
        ctx.lineTo(endX, nextY);
        ctx.stroke();
      }
    }
  });

  // --- Draw Remarks and Summary Info ---
  ctx.fillStyle = "#111827";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "left";

  // Start Remarks Y position well below the chart and time markers
  let remarksY = chartAreaBottom + 40;
  // ctx.fillText(`Daily Log Sheet - Day ${day}`, 10, remarksY);
  remarksY += 20;

  // Filter log changes for the summary table
  const dailySummary = dayLogs.filter((log) =>
    ["WORK", "BREAK", "RESTART", "END"].includes(log.type)
  );

  let summaryX = 10;
  const summaryColWidth = width / 4;

  ctx.font = "bold 12px sans-serif";
  ctx.fillText("Time", summaryX, remarksY);
  ctx.fillText("Location", summaryX + summaryColWidth, remarksY);
  ctx.fillText("Activity/Remarks", summaryX + summaryColWidth * 2, remarksY);
  remarksY += 18;

  ctx.font = "12px sans-serif";
  dailySummary.forEach((log) => {
    const time = formatTime(log.start);
    ctx.fillText(time, summaryX, remarksY);
    ctx.fillText(log.location, summaryX + summaryColWidth, remarksY);
    ctx.fillText(log.remarks, summaryX + summaryColWidth * 2, remarksY);
    remarksY += 18;
  });

  // Print Calculated Total Hours for the day (Daily Off, SB, D, ON)
  const dailyHours = dayLogs.reduce((acc, log) => {
    const duration = log.end - log.start;
    acc[log.status] = (acc[log.status] || 0) + duration;
    return acc;
  }, {});

  const dailySummaryHours = [
    `OFF Duty: ${formatTime(dailyHours["OFF"] || 0)}`,
    `Sleeper Berth: ${formatTime(dailyHours["SB"] || 0)}`,
    `DRIVE: ${formatTime(dailyHours["D"] || 0)}`,
    `ON-DUTY: ${formatTime(dailyHours["ON"] || 0)}`,
  ].join(" | ");

  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Daily Hours: ${dailySummaryHours}`, width / 2, height - 10);
};

// --- React Component (MUI Conversion) ---
const HOSSimulator = () => {
  const [currentLocation, setCurrentLocation] = useState(US_STATES[0]);
  const [pickupLocation, setPickupLocation] = useState(US_STATES[9]);
  const [dropoffLocation, setDropoffLocation] = useState(US_STATES[19]);
  const [cycleUsed, setCycleUsed] = useState(30); // Hours
  const [tripDistance, setTripDistance] = useState(1500); // Miles
  const [currentCoords, setCurrentCoords] = useState(null);
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [geocodeerrors, setGeocodeerrors] = useState([]); // array of strings

  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);

  const canvasRefs = useRef([]);

  const handleSimulate = async () => {
    setIsLoading(true);
    setResults(null);
    setGeocodeerrors([]);

    try {
      // resolve coordinates in parallel
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
      setGeocodeerrors(errors);

      setCurrentCoords(curRes ? curRes.coords : null);
      setPickupCoords(pickRes ? pickRes.coords : null);
      setDropoffCoords(dropRes ? dropRes.coords : null);

      // call your HOS calculation (server or local)
      const simulationResults = calculateHOSLogs(tripDistance, cycleUsed);
      setResults(simulationResults);
    } catch (error) {
      console.error("Simulation failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Memoized draw function for useEffect dependency
  const memoizedDrawLogSheet = useCallback(drawLogSheet, []);

  // Effect to draw canvases when results change
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

  // --- Render UI (MUI Components) ---
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

        {/* Assumptions Section */}
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
          {/* Gradient Accent Bar */}
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
            {/* Header */}
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

            {/* Compact List */}
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

            {/* Compact Button */}
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

        {/* Input Section */}
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

        {/* Results */}
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

        {/* Map */}
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

        {/* Dialog and Snackbar (unchanged) */}
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
