import { tool } from "ai";
import { z } from "zod";
import { executeBashCommand, executeComputerUse } from "./tool";

const computerParameters = z.object({
  action: z.enum([
    "screenshot",
    "wait",
    "left_click",
    "double_click",
    "right_click",
    "mouse_move",
    "type",
    "key",
    "scroll",
    "left_click_drag",
  ]),
  coordinate: z.tuple([z.number(), z.number()]).optional(),
  text: z.string().optional(),
  duration: z.number().optional(),
  scroll_amount: z.number().optional(),
  scroll_direction: z.enum(["up", "down"]).optional(),
  start_coordinate: z.tuple([z.number(), z.number()]).optional(),
});

export function openAICompatibleSandboxTools(sandboxId: string) {
  return {
    computer: tool({
      description:
        "Control the remote Linux desktop in the sandbox: screenshots, mouse, keyboard, scrolling, and short waits. Coordinates are pixels on a 1024x768 display.",
      parameters: computerParameters,
      execute: async (input) => executeComputerUse(sandboxId, input),
    }),
    bash: tool({
      description:
        "Run a bash shell command on the sandbox. Prefer this for file operations and CLI tasks.",
      parameters: z.object({
        command: z.string().describe("Full bash command to run"),
      }),
      execute: async ({ command }) => executeBashCommand(sandboxId, command),
    }),
    get_weather: tool({
      description:
        "Get approximate current weather for a city or place name (no API key; uses Open-Meteo).",
      parameters: z.object({
        location: z.string().describe("City or location, e.g. Dubai"),
      }),
      execute: async ({ location }) => {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`,
        );
        const geo = (await geoRes.json()) as {
          results?: Array<{
            latitude: number;
            longitude: number;
            name: string;
            country?: string;
          }>;
        };
        const first = geo.results?.[0];
        if (!first) {
          return { error: `No location found for "${location}"` };
        }
        const wxRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${first.latitude}&longitude=${first.longitude}&current=temperature_2m,weather_code&timezone=auto`,
        );
        const wx = (await wxRes.json()) as {
          current?: { temperature_2m: number; weather_code: number };
        };
        const temp = wx.current?.temperature_2m;
        const code = wx.current?.weather_code;
        return {
          location: first.name,
          country: first.country,
          temperatureC: temp,
          weatherCode: code,
          summary:
            temp != null
              ? `${first.name}${first.country ? `, ${first.country}` : ""}: ${temp}°C (weather code ${code})`
              : "No current conditions returned",
        };
      },
    }),
  };
}
