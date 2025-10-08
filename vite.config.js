import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { copyFileSync } from 'fs'

// Plugin to copy extension files after build
function copyExtensionFiles() {
  return {
    name: 'copy-extension-files',
    closeBundle() {
      const filesToCopy = [
        { src: 'manifest.json', dest: 'dist/manifest.json' },
        { src: 'devtools.html', dest: 'dist/devtools.html' },
        { src: 'devtools.js', dest: 'dist/devtools.js' },
        { src: 'src/devtools-panel.js', dest: 'dist/devtools-panel.js' }
      ]

      filesToCopy.forEach(({ src, dest }) => {
        try {
          copyFileSync(src, dest)
          console.log(`Copied ${src} to ${dest}`)
        } catch (err) {
          console.error(`Failed to copy ${src}:`, err.message)
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [vue(), copyExtensionFiles()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        panel: resolve(__dirname, 'panel.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  }
})
