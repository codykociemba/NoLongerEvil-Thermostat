'use client';

import { useThermostat } from '@/lib/store';
import './animated-weather.css';

type WeatherType = 'sunny' | 'mostly_sunny' | 'partly_cloudy' | 'mostly_cloudy' | 'cloudy' | 'rainy' | 'thundery' | 'foggy';

function mapConditionToType(condition: string): WeatherType {
  const c = condition.toLowerCase();

  // Thunderstorms (highest priority)
  if (c.includes('thunder') || c.includes('storm')) {
    return 'thundery';
  }

  // Rain/Showers
  if (c.includes('rain') || c.includes('shower')) {
    return 'rainy';
  }

  // Fog
  if (c.includes('fog')) {
    return 'foggy';
  }

  // Mostly Clear/Mostly Sunny
  if (c.includes('mostly clear') || c.includes('mostly sunny')) {
    return 'mostly_sunny';
  }

  // Sunny/Clear
  if (c === 'sunny' || c === 'clear') {
    return 'sunny';
  }

  // Partly Cloudy or conditions with both clouds and sun
  if (c.includes('partly cloudy') || c.includes('partly') ||
      (c.includes('cloud') && c.includes('sun')) ||
      (c.includes('cloud') && c.includes('clear'))) {
    return 'partly_cloudy';
  }

  // Mostly Cloudy
  if (c.includes('mostly cloudy')) {
    return 'mostly_cloudy';
  }

  // Cloudy
  if (c.includes('cloud') || c.includes('overcast')) {
    return 'cloudy';
  }

  return 'partly_cloudy'; // default
}

export function AnimatedWeather() {
  const userState = useThermostat((s) => s.userState);

  if (!userState?.weather?.current?.condition) {
    return null;
  }

  const weatherType = mapConditionToType(userState.weather.current.condition);
  const isRainy = weatherType === 'rainy' || weatherType === 'thundery';

  return (
    <div className="flex flex-col items-center mb-6">
      <div className="flex justify-center">
        {weatherType === 'sunny' && (
          <div className="weather-icon sunny"></div>
        )}

        {weatherType === 'mostly_sunny' && (
          <div className="weather-icon mostly_sunny">
            <div className="mostly_sunny__sun"></div>
            <div className="mostly_sunny__cloud"></div>
          </div>
        )}

        {weatherType === 'partly_cloudy' && (
          <div className="weather-icon partly_cloudy">
            <div className="partly_cloudy__sun"></div>
            <div className="partly_cloudy__cloud"></div>
          </div>
        )}

        {weatherType === 'cloudy' || weatherType === 'mostly_cloudy' && (
          <div className="weather-icon cloudy"></div>
        )}

        {weatherType === 'foggy' && (
          <div className="weather-icon foggy">
            <div className="foggy__fog"></div>
          </div>
        )}

        {weatherType === 'rainy' && (
          <div className="weather-icon rainy">
            <div className="rainy__cloud"></div>
            <div className="rainy__rain"></div>
          </div>
        )}

        {weatherType === 'thundery' && (
          <div className="weather-icon thundery">
            <div className="thundery__cloud"></div>
            <div className="thundery__rain"></div>
          </div>
        )}
      </div>

      {isRainy && (
        <div className="mt-2 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 italic animate-fade-in">
          Don't forget to bring a towel!
        </div>
      )}
    </div>
  );
}
