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

  return {
    location: { name, lat, lng },
    current: {
      temperature: forecast.current.temperature_2m,
      apparentTemperature: forecast.current.apparent_temperature,
      humidity: forecast.current.relative_humidity_2m,
      weatherCode: forecast.current.weather_code,
      isDay: forecast.current.is_day === 1,
      precipitation: forecast.current.precipitation,
      cloudCover: forecast.current.cloud_cover,
      pressure: forecast.current.pressure_msl,
      windSpeed: forecast.current.wind_speed_10m,
      windDirection: forecast.current.wind_direction_10m,
      windGusts: forecast.current.wind_gusts_10m,
    },
    hourly: {
      time: forecast.hourly.time.slice(0, 24),
      temperature: forecast.hourly.temperature_2m.slice(0, 24),
      precipProb: forecast.hourly.precipitation_probability.slice(0, 24),
      weatherCode: forecast.hourly.weather_code.slice(0, 24),
    },
    daily: {
      time: forecast.daily.time.slice(0, 7),
      code: forecast.daily.weather_code.slice(0, 7),
      tMax: forecast.daily.temperature_2m_max.slice(0, 7),
      tMin: forecast.daily.temperature_2m_min.slice(0, 7),
      precipProb: forecast.daily.precipitation_probability_max.slice(0, 7),
      windMax: forecast.daily.wind_speed_10m_max.slice(0, 7),
      sunrise: forecast.daily.sunrise.slice(0, 7),
      sunset: forecast.daily.sunset.slice(0, 7),
      daylightDuration: forecast.daily.daylight_duration.slice(0, 7),
    },
    aq: {
      usAqi: aq.current?.us_aqi ?? null,
      pm25: aq.current?.pm2_5 ?? null,
      pm10: aq.current?.pm10 ?? null,
    },
    timezone: forecast.timezone,
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
