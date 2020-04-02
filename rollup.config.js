import typescript from '@rollup/plugin-typescript'


const formats = ['cjs', 'es']

export default formats.map(format => ({
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    entryFileNames: '[name].[format].js',
    format,
  },
  external: [
    'fs',
    'html-minifier',
    'node-html-parser',
    'path',
  ],
  plugins: [
    typescript(),
  ],
}))
