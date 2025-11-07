from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

# Ported HOS calculation from the frontend simulator (calculateHOSLogs)
MAX_DRIVING_HOURS = 11  # 11-Hour Driving Limit
MAX_WINDOW_HOURS = 14  # 14-Hour On-Duty Window Limit
MAX_CYCLE_HOURS = 70  # 70-Hour / 8-Day Cycle Limit
REQUIRED_DAILY_REST = 10  # Required 10 consecutive hours off duty
REQUIRED_BREAK_HOURS = 8  # Must take break after 8 cumulative hours of driving
REQUIRED_BREAK_DURATION = 0.5  # 30-minute break duration (0.5 hours)
AVG_DRIVING_SPEED = 60  # Assumed average speed in MPH
FUELING_INTERVAL_MILES = 1000
FUELING_DURATION = 0.5  # 30 minutes for fueling


def format_time(hours: float) -> str:
    h = int(hours)
    m = int(round((hours - h) * 60))
    return f"{h:02d}:{m:02d}"


def calculate_hos_logs(trip_distance, initial_cycle_used):
    logs = []
    route_summary = []

    total_driving_time_needed = trip_distance / AVG_DRIVING_SPEED
    current_cycle_used = float(initial_cycle_used)
    current_day = 1
    remaining_trip_time = float(total_driving_time_needed)

    current_time = 0.0  # Time in the current 24-hour log (0 to 24)
    current_driving_hours = 0.0  # Driving hours since last 10-hour rest
    driving_since_break = 0.0
    daily_driving = 0.0
    daily_on_duty = 0.0

    def get_status_line(status):
        return {"OFF": 1, "SB": 2, "D": 3, "ON": 4}.get(status, 0)

    def add_log_entry(status, duration, location, remarks, type_):
        nonlocal current_time
        logs.append(
            {
                "day": current_day,
                "start": current_time,
                "end": current_time + duration,
                "status": status,
                "location": location,
                "remarks": remarks,
                "dutyLine": get_status_line(status),
                "type": type_,
            }
        )
        current_time += duration

    def start_new_day(reason):
        nonlocal current_day, current_time, current_driving_hours, driving_since_break, daily_driving, daily_on_duty
        if current_time < 24:
            remaining_day_time = 24 - current_time
            required_rest = REQUIRED_DAILY_REST
            actual_rest = max(required_rest, remaining_day_time)
            # Use Sleeper Berth for required rest to reflect SB usage
            add_log_entry("SB", actual_rest, "Rest Location", reason, "REST")

        current_day += 1
        current_time = 0.0
        current_driving_hours = 0.0
        driving_since_break = 0.0
        daily_driving = 0.0
        daily_on_duty = 0.0

    # --- Start of Trip Simulation ---
    add_log_entry("ON", 1.0, "Current Location", "Pre-Trip Inspection / Initial Hookup", "WORK")
    daily_on_duty += 1.0
    current_cycle_used += 1.0
    route_summary.append({"day": current_day, "time": format_time(1), "activity": "Pre-Trip & Hookup", "location": "Start Location"})

    # Add Pickup (1 hour)
    add_log_entry("ON", 1.0, "Pickup Location", "Loading/Pickup", "WORK")
    daily_on_duty += 1.0
    current_cycle_used += 1.0
    route_summary.append({"day": current_day, "time": format_time(2), "activity": "Loading/Pickup", "location": "Pickup Location"})

    miles_driven = 0.0

    while remaining_trip_time > 0:
        drive_segment = min(
            remaining_trip_time,
            MAX_DRIVING_HOURS - daily_driving,
        )
        drive_segment = min(drive_segment, MAX_WINDOW_HOURS - daily_on_duty)
        drive_segment = min(drive_segment, MAX_CYCLE_HOURS - current_cycle_used)

        # Check 30-minute break rule
        if driving_since_break + drive_segment > REQUIRED_BREAK_HOURS:
            drive_segment = REQUIRED_BREAK_HOURS - driving_since_break

        # Check 14-hour window
        if current_time + drive_segment > MAX_WINDOW_HOURS:
            drive_segment = MAX_WINDOW_HOURS - current_time

        # Daily rest / inability to drive
        if drive_segment <= 0:
            if current_driving_hours >= MAX_DRIVING_HOURS:
                start_new_day("Reached 11-Hour Driving Limit")
                continue
            if daily_on_duty >= MAX_WINDOW_HOURS:
                start_new_day("Reached 14-Hour Window Limit")
                continue
            if driving_since_break >= REQUIRED_BREAK_HOURS and daily_driving < MAX_DRIVING_HOURS:
                add_log_entry("OFF", REQUIRED_BREAK_DURATION, "Roadside Rest", "30-Minute Rest Break", "BREAK")
                driving_since_break = 0.0
                route_summary.append({"day": current_day, "time": format_time(current_time), "activity": "30-Minute Break", "location": "Roadside Rest"})
                continue
            if current_cycle_used >= MAX_CYCLE_HOURS:
                route_summary.append({"day": current_day, "time": format_time(current_time), "activity": "70-Hour Cycle Limit Reached", "location": "Terminal/Home"})
                total_rest = 34 + (24 - current_time)
                add_log_entry("SB", total_rest, "Terminal/Home", "34-Hour Restart", "RESTART")
                current_cycle_used = 0.0
                start_new_day("34-Hour Restart Completed")
                continue
            start_new_day("End of Daily Driving Window")
            continue

        # Fueling check
        segment_miles = drive_segment * AVG_DRIVING_SPEED
        if int((miles_driven + segment_miles) / FUELING_INTERVAL_MILES) > int(miles_driven / FUELING_INTERVAL_MILES):
            miles_to_fuel = FUELING_INTERVAL_MILES - (miles_driven % FUELING_INTERVAL_MILES)
            time_to_fuel = miles_to_fuel / AVG_DRIVING_SPEED

            if time_to_fuel < drive_segment:
                # Drive to fueling station
                add_log_entry("D", time_to_fuel, "On Route", "Driving to Fuel Stop", "DRIVE")
                current_driving_hours += time_to_fuel
                driving_since_break += time_to_fuel
                daily_driving += time_to_fuel
                current_cycle_used += time_to_fuel
                miles_driven += miles_to_fuel
                remaining_trip_time -= time_to_fuel
                route_summary.append({"day": current_day, "time": format_time(current_time), "activity": f"Driving {round(miles_to_fuel)} miles", "location": "On Route"})

                # Fuel stop
                add_log_entry("ON", FUELING_DURATION, "Fuel Station", "Fueling", "WORK")
                daily_on_duty += FUELING_DURATION
                current_cycle_used += FUELING_DURATION
                route_summary.append({"day": current_day, "time": format_time(current_time), "activity": "Fueling Stop (30 mins)", "location": "Fuel Station"})

                drive_segment = drive_segment - time_to_fuel
                if drive_segment <= 0:
                    continue

        # Perform drive segment
        if drive_segment > 0:
            add_log_entry("D", drive_segment, "On Route", "Driving", "DRIVE")
            current_driving_hours += drive_segment
            driving_since_break += drive_segment
            daily_driving += drive_segment
            daily_on_duty += drive_segment
            current_cycle_used += drive_segment
            remaining_trip_time -= drive_segment
            miles_driven += drive_segment * AVG_DRIVING_SPEED
            route_summary.append({"day": current_day, "time": format_time(current_time), "activity": f"Driving {round(drive_segment * AVG_DRIVING_SPEED)} miles", "location": "On Route"})

    # Trip completed: final dropoff
    if remaining_trip_time <= 0:
        if current_time + 1 > MAX_WINDOW_HOURS or current_cycle_used + 1 > MAX_CYCLE_HOURS:
            start_new_day("Required Rest before Final Dropoff")
        add_log_entry("ON", 1.0, "Dropoff Location", "Unloading/Dropoff", "WORK")
        daily_on_duty += 1.0
        current_cycle_used += 1.0
        route_summary.append({"day": current_day, "time": format_time(current_time), "activity": "Unloading/Dropoff", "location": "Dropoff Location"})

        required_off = 8
        off_time = required_off + (24 - current_time)
        add_log_entry("SB", off_time, "Home/Terminal", "Final Post-Trip Inspection and Rest", "END")

    return {"logs": logs, "routeSummary": route_summary, "totalDays": current_day, "finalCycleUsed": current_cycle_used}


@api_view(["POST"])
def process_data(request):
    # Expected input keys: tripDistance, cycleUsed
    try:
        trip_distance = request.data.get("tripDistance")
        cycle_used = request.data.get("cycleUsed")
    except Exception:
        return Response({"error": "Invalid request body."}, status=status.HTTP_400_BAD_REQUEST)

    if trip_distance is None or cycle_used is None:
        return Response({"error": "Both 'tripDistance' and 'cycleUsed' are required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        trip_distance = float(trip_distance)
        cycle_used = float(cycle_used)
    except (TypeError, ValueError):
        return Response({"error": "'tripDistance' and 'cycleUsed' must be numbers."}, status=status.HTTP_400_BAD_REQUEST)

    if trip_distance < 0 or cycle_used < 0:
        return Response({"error": "Values must be non-negative."}, status=status.HTTP_400_BAD_REQUEST)

    result = calculate_hos_logs(trip_distance, cycle_used)
    return Response(result, status=status.HTTP_200_OK)
