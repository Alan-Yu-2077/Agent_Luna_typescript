import { fetchOpenMeteo, type WeatherSnapshot, type WeatherUnits } from './openMeteo';
import { fetchQWeather } from './qweather';

// Weather source dispatcher (Initiative 14, v0.21.5). QWeather (和风, China-accurate)
// when configured, else the no-key Open-Meteo fallback. Mirrors the web_search
// provider abstraction: the choice is config, the snapshot shape is shared.
export type WeatherProviderName = 'qweather' | 'open-meteo';

export function weatherProviderName(): WeatherProviderName {
  const p = Bun.env['LUNA_WEATHER_PROVIDER'];
  if (p === 'qweather') return 'qweather';
  if (p === 'open-meteo') return 'open-meteo';
  // auto: QWeather when a key is configured, else the no-key Open-Meteo.
  return (Bun.env['LUNA_WEATHER_API_KEY'] ?? '').length > 0 ? 'qweather' : 'open-meteo';
}

export function fetchWeather(
  lat: number,
  lon: number,
  tz: string,
  label: string,
  opts: { signal?: AbortSignal; units?: WeatherUnits } = {},
): Promise<WeatherSnapshot> {
  return weatherProviderName() === 'qweather'
    ? fetchQWeather(lat, lon, tz, label, opts)
    : fetchOpenMeteo(lat, lon, tz, label, opts);
}
