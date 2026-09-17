import type { WeatherData } from "../types";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

interface OpenMeteoForecast {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    weather_code: number;
    is_day: number;
    precipitation: number;
    cloud_cover: number;
    pressure_msl: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    weather_code: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    wind_speed_10m_max: number[];
    sunrise: string[];
    sunset: string[];
    daylight_duration: number[];
  };
  timezone: string;
}

interface OpenMeteoAq {
  current?: {
    us_aqi?: number | null;
    pm2_5?: number | null;
    pm10?: number | null;
  };
}

/** Current conditions + 24h hourly + 7 day daily forecast + air quality. */
export async function fetchWeather(
  lat: number,
  lng: number,
  name: string,
): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    hourly: "temperature_2m,precipitation_probability,weather_code",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset,daylight_duration",
    timezone: "auto",
    forecast_days: "8",
  });

  const [forecastRes, aqRes] = await Promise.all([
    fetch(`${FORECAST_URL}?${params}`),
    fetch(
      `${AIR_QUALITY_URL}?latitude=${lat}&longitude=${lng}&current=us_aqi,pm2_5,pm10`,
    ),
  ]);

  if (!forecastRes.ok) {
    throw new Error(`Weather API ${forecastRes.status}`);
  }
  const forecast = (await forecastRes.json()) as OpenMeteoForecast;
  let aq: OpenMeteoAq = {};
  if (aqRes.ok) {
    aq = (await aqRes.json()) as OpenMeteoAq;
  }

  // Defensive default: Open-Meteo always returns the requested arrays, but a
  // malformed/partial upstream response must never crash the UI on .slice/.map.
  const safe = <T,>(v: T[] | undefined): T[] => (Array.isArray(v) ? v : []);
  const hourly = {
    time: safe(forecast.hourly?.time),
    temperature: safe(forecast.hourly?.temperature_2m),
    precipProb: safe(forecast.hourly?.precipitation_probability),
    weatherCode: safe(forecast.hourly?.weather_code),
  };
  const daily = {
    time: safe(forecast.daily?.time),
    weatherCode: safe(forecast.daily?.weather_code),
    tMax: safe(forecast.daily?.temperature_2m_max),
    tMin: safe(forecast.daily?.temperature_2m_min),
    precipProb: safe(forecast.daily?.precipitation_probability_max),
    windMax: safe(forecast.daily?.wind_speed_10m_max),
    sunrise: safe(forecast.daily?.sunrise),
    sunset: safe(forecast.daily?.sunset),
    daylight: safe(forecast.daily?.daylight_duration),
  };
  const cur = forecast.current ?? ({} as OpenMeteoForecast["current"]);
  return {
    location: { name, lat, lng },
    current: {
      temperature: cur.temperature_2m ?? 0,
      apparentTemperature: cur.apparent_temperature ?? 0,
      humidity: cur.relative_humidity_2m ?? 0,
      weatherCode: cur.weather_code ?? 0,
      isDay: cur.is_day === 1,
      precipitation: cur.precipitation ?? 0,
      cloudCover: cur.cloud_cover ?? 0,
      pressure: cur.pressure_msl ?? 1013,
      windSpeed: cur.wind_speed_10m ?? 0,
      windDirection: cur.wind_direction_10m ?? 0,
      windGusts: cur.wind_gusts_10m ?? 0,
    },
    hourly: {
      time: hourly.time.slice(0, 24),
      temperature: hourly.temperature.slice(0, 24),
      precipProb: hourly.precipProb.slice(0, 24),
      weatherCode: hourly.weatherCode.slice(0, 24),
    },
    daily: {
      time: daily.time.slice(0, 7),
      code: daily.weatherCode.slice(0, 7),
      tMax: daily.tMax.slice(0, 7),
      tMin: daily.tMin.slice(0, 7),
      precipProb: daily.precipProb.slice(0, 7),
      windMax: daily.windMax.slice(0, 7),
      sunrise: daily.sunrise.slice(0, 7),
      sunset: daily.sunset.slice(0, 7),
      daylightDuration: daily.daylight.slice(0, 7),
    },
    aq: {
      usAqi: aq.current?.us_aqi ?? null,
      pm25: aq.current?.pm2_5 ?? null,
      pm10: aq.current?.pm10 ?? null,
    },
    timezone: forecast.timezone ?? "UTC",
    updatedAt: Date.now(),
  };
}

/** WMO weather interpretation codes → human label + glyph. */
export function wmoInfo(code: number): { label: string; glyph: string } {
  if (code === 0) return { label: "Clear sky", glyph: "☀" };
  if (code === 1) return { label: "Mainly clear", glyph: "◑" };
  if (code === 2) return { label: "Partly cloudy", glyph: "⛅" };
  if (code === 3) return { label: "Overcast", glyph: "☁" };
  if (code === 45 || code === 48) return { label: "Fog", glyph: "≋" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", glyph: "▒" };
  if (code >= 61 && code <= 67) return { label: "Rain", glyph: "☂" };
  if (code >= 71 && code <= 77) return { label: "Snow", glyph: "❄" };
  if (code >= 80 && code <= 82) return { label: "Rain showers", glyph: "☔" };
  if (code === 85 || code === 86) return { label: "Snow showers", glyph: "✳" };
  if (code >= 95) return { label: "Thunderstorm", glyph: "⚡" };
  return { label: "Unknown", glyph: "?" };
}

/** AQI → band label + flat color. */
export function aqiInfo(usAqi: number): {
  label: string;
  color: string;
} {
  if (usAqi <= 50) return { label: "GOOD", color: "#00a651" };
  if (usAqi <= 100) return { label: "MODERATE", color: "#ffd400" };
  if (usAqi <= 150) return { label: "SENSITIVE", color: "#ff4d00" };
  if (usAqi <= 200) return { label: "UNHEALTHY", color: "#ff2e2e" };
  return { label: "HAZARDOUS", color: "#b91c1c" };
}
