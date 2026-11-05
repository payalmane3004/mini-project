"""Transparent weekday/hour historical baselines for predictive analytics.

These estimates are intentionally simple and are not a trained or validated
forecasting model. Missing or weak coverage is reported instead of filled in.
"""

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from statistics import median


HISTORY_WINDOW_DAYS = 56
TRAINING_WINDOW_DAYS = 28
MIN_HISTORY_DAYS = 28
MIN_OCCUPANCY_RECORDS = 200
MIN_ENERGY_RECORDS = 100
MIN_SLOT_SAMPLES = 3
FORECAST_DAYS = 7
MIN_SLOT_COVERAGE = 0.7
UNDERUTILIZED_THRESHOLD_PERCENT = 20.0


def _utc(value):
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _history_quality(rows, required_records, now):
    timestamps = [_utc(row.get("recorded_at")) for row in rows]
    timestamps = [value for value in timestamps if value is not None and value <= now]
    distinct_days = len({value.date() for value in timestamps})
    if timestamps:
        first = min(timestamps)
        latest = max(timestamps)
        span_days = (latest.date() - first.date()).days + 1
        latest_age_days = max(0, (now.date() - latest.date()).days)
    else:
        first = latest = None
        span_days = latest_age_days = 0
    return {
        "records_available": len(timestamps),
        "records_required": required_records,
        "distinct_days": distinct_days,
        "history_days": span_days,
        "history_days_required": MIN_HISTORY_DAYS,
        "latest_reading": latest,
        "latest_reading_age_days": latest_age_days,
        "first_reading": first,
        "quality": "limited",
    }


def _slot_values(rows, entity_key, value_key, cutoff):
    values = defaultdict(list)
    for row in rows:
        timestamp = _utc(row.get("recorded_at"))
        if timestamp is None or timestamp < cutoff:
            continue
        value = row.get(value_key)
        if value is None:
            continue
        key = (row[entity_key], timestamp.weekday(), timestamp.hour)
        values[key].append(float(value))
    return values


def _future_slots(now, observed_hours):
    first_day = now.date() + timedelta(days=1)
    for day_offset in range(FORECAST_DAYS):
        day = first_day + timedelta(days=day_offset)
        for hour in observed_hours:
            yield datetime(day.year, day.month, day.day, hour, tzinfo=timezone.utc)


def _quality_label(min_slot_samples, coverage, history_days, latest_age_days):
    if min_slot_samples >= 6 and coverage >= 0.9 and history_days >= 42 and latest_age_days <= 1:
        return "good"
    if min_slot_samples >= MIN_SLOT_SAMPLES and coverage >= MIN_SLOT_COVERAGE and latest_age_days <= 7:
        return "moderate"
    return "limited"


def build_predictive_summary(rooms, occupancy_rows, energy_rows, *, now=None, demo_preview=False):
    """Build a seven-day seasonal baseline from real supplied observations."""
    current = _utc(now or datetime.now(timezone.utc))
    history_cutoff = current - timedelta(days=HISTORY_WINDOW_DAYS)
    training_cutoff = current - timedelta(days=TRAINING_WINDOW_DAYS)
    rooms_by_id = {
        room["id"]: room for room in rooms
        if room.get("capacity") is not None and float(room["capacity"]) > 0
    }
    buildings = {row["building_id"]: row for row in energy_rows if row.get("building_id") is not None}

    occupancy_history = [
        row for row in occupancy_rows
        if (timestamp := _utc(row.get("recorded_at"))) is not None
        and history_cutoff <= timestamp <= current
        and row.get("room_id") in rooms_by_id
        and row.get("occupied_count") is not None
    ]
    energy_history = [
        row for row in energy_rows
        if (timestamp := _utc(row.get("recorded_at"))) is not None
        and history_cutoff <= timestamp <= current
        and row.get("building_id") is not None
        and row.get("energy_kwh") is not None
    ]

    occupancy_quality = _history_quality(occupancy_history, MIN_OCCUPANCY_RECORDS, current)
    energy_quality = _history_quality(energy_history, MIN_ENERGY_RECORDS, current)
    occupancy_hours = sorted({
        _utc(row["recorded_at"]).hour for row in occupancy_history
        if _utc(row["recorded_at"]) >= training_cutoff
    })
    energy_hours = sorted({
        _utc(row["recorded_at"]).hour for row in energy_history
        if _utc(row["recorded_at"]) >= training_cutoff
    })

    occupancy_slots = _slot_values(occupancy_history, "room_id", "occupied_count", training_cutoff)
    occupancy_points = []
    occupancy_coverages = []
    occupancy_min_samples = None
    if (
        occupancy_quality["records_available"] >= MIN_OCCUPANCY_RECORDS
        and occupancy_quality["history_days"] >= MIN_HISTORY_DAYS
        and len(rooms_by_id) >= 3
    ):
        for forecast_at in _future_slots(current, occupancy_hours):
            room_values = []
            room_capacity = 0
            slot_sample_counts = []
            for room_id, room in rooms_by_id.items():
                samples = occupancy_slots.get((room_id, forecast_at.weekday(), forecast_at.hour), [])
                if len(samples) < MIN_SLOT_SAMPLES:
                    continue
                capacity = float(room["capacity"])
                room_values.append(min(capacity, max(0.0, median(samples))))
                room_capacity += capacity
                slot_sample_counts.append(len(samples))
            coverage = len(room_values) / len(rooms_by_id)
            occupancy_coverages.append(coverage)
            if room_values and coverage >= MIN_SLOT_COVERAGE:
                min_samples = min(slot_sample_counts)
                occupancy_min_samples = min(min_samples, occupancy_min_samples or min_samples)
                occupied = sum(room_values)
                occupancy_points.append({
                    "forecast_at": forecast_at,
                    "expected_occupied_count": round(occupied, 2),
                    "expected_utilization_percent": round(occupied / room_capacity * 100, 1),
                    "rooms_covered": len(room_values),
                    "rooms_total": len(rooms_by_id),
                    "slot_samples_min": min_samples,
                })

    occupancy_coverage = median(occupancy_coverages) if occupancy_coverages else 0.0
    occupancy_quality["quality"] = _quality_label(
        occupancy_min_samples or 0, occupancy_coverage,
        occupancy_quality["history_days"], occupancy_quality["latest_reading_age_days"],
    )
    occupancy_available = len(occupancy_points) >= 21
    if not occupancy_available:
        if occupancy_quality["records_available"] == 0:
            occupancy_quality["reason"] = "No timestamped occupancy observations were found in the last 56 days."
        elif occupancy_quality["history_days"] < MIN_HISTORY_DAYS:
            occupancy_quality["reason"] = f"Occupancy history spans {occupancy_quality['history_days']} days; at least {MIN_HISTORY_DAYS} days are required."
        elif occupancy_quality["records_available"] < MIN_OCCUPANCY_RECORDS:
            occupancy_quality["reason"] = f"{occupancy_quality['records_available']} occupancy readings are available; at least {MIN_OCCUPANCY_RECORDS} are required."
        else:
            occupancy_quality["reason"] = "Comparable room/hour readings do not cover enough rooms and future periods."
    else:
        occupancy_quality["reason"] = None

    energy_slots = _slot_values(energy_history, "building_id", "energy_kwh", training_cutoff)
    energy_points = []
    energy_coverages = []
    energy_min_samples = None
    energy_building_ids = set(buildings)
    if (
        energy_quality["records_available"] >= MIN_ENERGY_RECORDS
        and energy_quality["history_days"] >= MIN_HISTORY_DAYS
        and len(energy_building_ids) >= 2
    ):
        for forecast_at in _future_slots(current, energy_hours):
            readings = []
            slot_sample_counts = []
            for building_id in energy_building_ids:
                samples = energy_slots.get((building_id, forecast_at.weekday(), forecast_at.hour), [])
                if len(samples) < MIN_SLOT_SAMPLES:
                    continue
                readings.append(median(samples))
                slot_sample_counts.append(len(samples))
            coverage = len(readings) / len(energy_building_ids)
            energy_coverages.append(coverage)
            if readings and coverage >= MIN_SLOT_COVERAGE:
                min_samples = min(slot_sample_counts)
                energy_min_samples = min(min_samples, energy_min_samples or min_samples)
                energy_points.append({
                    "forecast_at": forecast_at,
                    "expected_energy_kwh": round(sum(readings), 3),
                    "buildings_covered": len(readings),
                    "buildings_total": len(energy_building_ids),
                    "slot_samples_min": min_samples,
                })

    energy_coverage = median(energy_coverages) if energy_coverages else 0.0
    energy_quality["quality"] = _quality_label(
        energy_min_samples or 0, energy_coverage,
        energy_quality["history_days"], energy_quality["latest_reading_age_days"],
    )
    energy_available = len(energy_points) >= 21
    if not energy_available:
        if energy_quality["records_available"] == 0:
            energy_quality["reason"] = "No operational timestamped energy readings were found in the last 56 days."
        elif energy_quality["history_days"] < MIN_HISTORY_DAYS:
            energy_quality["reason"] = f"Energy history spans {energy_quality['history_days']} days; at least {MIN_HISTORY_DAYS} days are required."
        elif energy_quality["records_available"] < MIN_ENERGY_RECORDS:
            energy_quality["reason"] = f"{energy_quality['records_available']} energy readings are available; at least {MIN_ENERGY_RECORDS} are required."
        else:
            energy_quality["reason"] = "Comparable building/hour readings do not cover enough buildings and future periods."
    else:
        energy_quality["reason"] = None

    peak_usage = sorted(
        occupancy_points, key=lambda point: point["expected_utilization_percent"], reverse=True
    )[:5] if occupancy_available else []
    underutilized_rooms = []
    if occupancy_available:
        per_room_days = defaultdict(lambda: defaultdict(list))
        for row in occupancy_history:
            timestamp = _utc(row["recorded_at"])
            if timestamp < training_cutoff or not 8 <= timestamp.hour <= 20:
                continue
            per_room_days[row["room_id"]][timestamp.date()].append(float(row["occupied_count"]))
        for room_id, daily_values in per_room_days.items():
            room = rooms_by_id[room_id]
            if len(daily_values) < 8:
                continue
            average_occupancy = sum(
                sum(values) / len(values) for values in daily_values.values()
            ) / len(daily_values)
            utilization = average_occupancy / float(room["capacity"]) * 100
            if utilization < UNDERUTILIZED_THRESHOLD_PERCENT:
                underutilized_rooms.append({
                    "room_id": room_id,
                    "room_code": room["room_code"],
                    "building_code": room.get("building_code"),
                    "building_name": room.get("building_name"),
                    "average_utilization_percent": round(utilization, 1),
                    "observation_days": len(daily_values),
                })
        underutilized_rooms.sort(key=lambda row: row["average_utilization_percent"])

    recommendations = []
    if peak_usage:
        peak = peak_usage[0]
        recommendations.append({
            "title": "Plan around forecast peak usage",
            "detail": f"The historical baseline peaks near {peak['forecast_at'].strftime('%A %H:%M UTC')} at {peak['expected_utilization_percent']:.1f}% of observed room capacity.",
            "basis": "weekday/hour occupancy median",
        })
    if underutilized_rooms:
        examples = ", ".join(room["room_code"] for room in underutilized_rooms[:3])
        recommendations.append({
            "title": "Review persistently underused rooms",
            "detail": f"{len(underutilized_rooms)} rooms averaged below {UNDERUTILIZED_THRESHOLD_PERCENT:.0f}% observed utilization across at least eight days; first examples: {examples}.",
            "basis": "observed occupancy divided by recorded capacity",
        })
    if energy_available:
        highest_energy = max(energy_points, key=lambda point: point["expected_energy_kwh"])
        recommendations.append({
            "title": "Review high energy intervals",
            "detail": f"The highest baseline interval is {highest_energy['forecast_at'].strftime('%A %H:%M UTC')} at {highest_energy['expected_energy_kwh']:.3f} kWh across {highest_energy['buildings_covered']} buildings.",
            "basis": "weekday/hour energy-reading median",
        })
    if not recommendations:
        recommendations.append({
            "title": "Collect comparable historical readings",
            "detail": "Record timestamped occupancy by room and energy by building across regular hours. Forecasts require at least four weeks of history, repeated weekday/hour samples, and sufficient facility coverage.",
            "basis": "forecast data requirements",
        })

    return {
        "demo_preview": bool(demo_preview),
        "method": "Seven-day historical baseline: median readings for the same weekday and hour from the preceding 28 days. No missing rooms or periods are filled.",
        "is_validated_model": False,
        "forecast_horizon_days": FORECAST_DAYS,
        "requirements": {
            "history_days": MIN_HISTORY_DAYS,
            "occupancy_records": MIN_OCCUPANCY_RECORDS,
            "energy_records": MIN_ENERGY_RECORDS,
            "slot_repeats": MIN_SLOT_SAMPLES,
            "slot_coverage_percent": round(MIN_SLOT_COVERAGE * 100),
        },
        "occupancy": {
            "available": occupancy_available,
            "data_quality": occupancy_quality,
            "coverage_percent": round(occupancy_coverage * 100, 1),
            "forecast_points": occupancy_points if occupancy_available else [],
            "peak_usage": peak_usage,
            "underutilized_rooms": underutilized_rooms if occupancy_available else [],
        },
        "energy": {
            "available": energy_available,
            "data_quality": energy_quality,
            "coverage_percent": round(energy_coverage * 100, 1),
            "forecast_points": energy_points if energy_available else [],
        },
        "recommendations": recommendations,
    }
