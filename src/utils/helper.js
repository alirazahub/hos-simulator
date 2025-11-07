export async function getCoordinatesFromAddress(address) {
  if (!address) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      address
    )}&limit=1`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
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

export const formatTime = (hours) => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const REQUIRED_BREAK_HOURS = 8;
const AVG_DRIVING_SPEED = 60;
const FUELING_INTERVAL_MILES = 1000;
const FUELING_DURATION = 0.5;

export const ASSUMPTIONS = [
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

export const US_STATES = [
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

export const drawLogSheet = (canvas, day, dayLogs) => {
  if (!canvas || !dayLogs || dayLogs.length === 0) return;

  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  const dutyLinesY = { 1: 80, 2: 130, 3: 180, 4: 230 };
  const chartAreaY = dutyLinesY[1];
  const chartAreaBottom = dutyLinesY[4];

  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = "#D1D5DB";
  ctx.lineWidth = 1;
  ctx.font = "9px sans-serif";
  ctx.textAlign = "center";
  const hourWidth = width / 24;

  for (let i = 0; i <= 24; i++) {
    const x = i * hourWidth;

    ctx.strokeStyle = i % 1 === 0 ? "#D1D5DB" : "#F3F4F6";
    ctx.lineWidth = i % 1 === 0 ? 1 : 0.5;

    ctx.beginPath();
    ctx.moveTo(x, chartAreaY);
    ctx.lineTo(x, chartAreaBottom);
    ctx.stroke();

    if (i < 24) {
      ctx.fillStyle = "#374151";
      ctx.fillText(String(i).padStart(2, "0") + ":00", x, chartAreaBottom + 30);
    }
  }

  ctx.strokeStyle = "#9CA3AF";
  ctx.lineWidth = 2;
  Object.values(dutyLinesY).forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  });

  ctx.fillStyle = "#111827";
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "left";

  const labelYOffset = 12;
  ctx.fillText("OFF Duty", 5, dutyLinesY[1] + labelYOffset);
  ctx.fillText("Sleeper Berth", 5, dutyLinesY[2] + labelYOffset);
  ctx.fillText("Driving", 5, dutyLinesY[3] + labelYOffset);
  ctx.fillText("On Duty", 5, dutyLinesY[4] + labelYOffset);

  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Time (Hours)", 5, chartAreaY - 15);

  ctx.strokeStyle = "#D32F2F";
  ctx.lineWidth = 4;

  dayLogs.forEach((log, index) => {
    const startX = log.start * hourWidth;
    const endX = log.end * hourWidth;
    const startY = dutyLinesY[log.dutyLine];
    const endY = dutyLinesY[log.dutyLine];

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

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

  ctx.fillStyle = "#111827";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "left";

  let remarksY = chartAreaBottom + 40;
  remarksY += 20;

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