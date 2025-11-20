/**
 * WeatherService
 *
 * Handles weather data caching and proxying to weather.nest.com
 * Implements 10-minute cache in Convex to reduce external API calls
 */

import * as https from 'https';
import type { WeatherData, StateWeatherCache } from '../lib/types';
import { ConvexService } from './ConvexService';
import { environment } from '../config/environment';

export class WeatherService {
  private convex: ConvexService;

  constructor(convex: ConvexService) {
    this.convex = convex;
  }

  /**
   * Get weather data for a location
   * Uses cache if available and not expired, otherwise fetches from weather.nest.com
   *
   * @param query - Format: "postalCode,country" or "ipv4"/"ipv6"
   * @returns Weather data or null on error
   */
  async getWeather(query: string): Promise<WeatherData | null> {
    const { postalCode, country, isIpQuery } = this.parseQuery(query);

    if (!isIpQuery && postalCode && country) {
      const cached = await this.getCachedWeather(postalCode, country);
      if (cached) {
        console.log(`[WeatherService] Cache hit for ${postalCode}, ${country}`);
        return cached.data;
      }
    }

    console.log(`[WeatherService] Fetching weather for query: ${query}`);
    const weatherData = await this.fetchWeatherFromNest(query);

    if (!weatherData) {
      return null;
    }

    if (!isIpQuery && postalCode && country) {
      await this.cacheWeather(postalCode, country, weatherData);
      await this.propagateWeatherToUsers(postalCode, country, weatherData);
    }

    return weatherData;
  }

  /**
   * Parse weather query string
   */
  private parseQuery(query: string): {
    postalCode: string | null;
    country: string | null;
    isIpQuery: boolean;
  } {
    if (query.startsWith('ipv4') || query.startsWith('ipv6')) {
      return { postalCode: null, country: null, isIpQuery: true };
    }

    const parts = query.split(',');
    if (parts.length === 2) {
      return {
        postalCode: parts[0].trim(),
        country: parts[1].trim(),
        isIpQuery: false,
      };
    }

    return { postalCode: null, country: null, isIpQuery: false };
  }

  /**
   * Get cached weather from Convex
   */
  private async getCachedWeather(
    postalCode: string,
    country: string
  ): Promise<StateWeatherCache | null> {
    const cached = await this.convex.getWeather(postalCode, country);

    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.fetchedAt;
    if (age > environment.WEATHER_CACHE_TTL_MS) {
      console.log(`[WeatherService] Cache expired for ${postalCode}, ${country} (age: ${age}ms)`);
      return null;
    }

    return cached;
  }

  /**
   * Cache weather data in Convex
   */
  private async cacheWeather(
    postalCode: string,
    country: string,
    data: WeatherData
  ): Promise<void> {
    await this.convex.upsertWeather(postalCode, country, Date.now(), data);
  }

  /**
   * Propagate weather data to all users with this postal code
   * Extracts current and location data from weatherData
   */
  private async propagateWeatherToUsers(
    postalCode: string,
    country: string,
    weatherData: WeatherData
  ): Promise<void> {
    try {
      const locationKey = `${postalCode},${country}`;
      const weatherInfo = weatherData[locationKey];

      if (weatherInfo && weatherInfo.now) {
        const weatherDataToSave: WeatherData = {
          [locationKey]: {
            now: weatherInfo.now,
            forecast: weatherInfo.forecast
          }
        };

        await this.convex.updateWeatherForPostalCode(postalCode, country, weatherDataToSave);
        console.log(`[WeatherService] Propagated weather to users with postal code ${postalCode},${country}`);
      }
    } catch (err) {
      console.error(`[WeatherService] Failed to propagate weather to users:`, err);
    }
  }

  /**
   * Fetch weather from weather.nest.com
   */
  private fetchWeatherFromNest(query: string): Promise<WeatherData | null> {
    return new Promise((resolve) => {
      const url = `https://weather.nest.com/weather/v1?query=${encodeURIComponent(query)}`;

      https.get(url, { rejectUnauthorized: false }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode !== 200) {
            console.error(`[WeatherService] Weather API returned ${res.statusCode}`);
            resolve(null);
            return;
          }

          try {
            const weatherData = JSON.parse(data);
            resolve(weatherData);
          } catch (error) {
            console.error('[WeatherService] Failed to parse weather response:', error);
            resolve(null);
          }
        });
      }).on('error', (error) => {
        console.error('[WeatherService] Weather API request failed:', error);
        resolve(null);
      });
    });
  }
}
