import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {pwaBuild} from './apps/web/pwaBuild';
export default defineConfig({root:'apps/web',plugins:[react(),pwaBuild()],build:{outDir:'../../dist/web',emptyOutDir:true}});
