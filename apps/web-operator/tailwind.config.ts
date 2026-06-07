import type { Config } from 'tailwindcss';
import d2dPreset from '@d2d/ui-tokens/tailwind-preset';

const config: Config = {
  presets: [d2dPreset],
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui-web/src/**/*.{ts,tsx}'],
};
export default config;
