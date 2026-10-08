import { defineConfig } from 'vite';
import Sonda from 'sonda/vite';

export default defineConfig({
  build: {
    sourcemap: true,
  },
  plugins: [Sonda()],
});
