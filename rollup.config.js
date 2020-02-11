import {eslint} from 'rollup-plugin-eslint'
import typescript from 'rollup-plugin-typescript2'


const formats = ['cjs', 'es']

export default formats.map(format => ({
  input: 'src/index.ts',
  output: {
    file: `dist/index.${format}.js`,
    format,
  },
  external: [
    'fs',
    'html-minifier',
    'node-html-parser',
    'path',
  ],
  plugins: [
    eslint(),
    typescript(),
  ],
}))
