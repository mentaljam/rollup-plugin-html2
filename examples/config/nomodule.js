import html2 from 'rollup-plugin-html2'
import postcss from 'rollup-plugin-postcss'


const config = ({
  css = false,
  format,
  html2Config,
  inlineDynamicImports = false,
}) => ({
  input: 'src/index.js',
  inlineDynamicImports,
  output: {
    dir: 'dist/nomodule/' + format,
    entryFileNames: '[name]-[hash].js',
    format,
  },
  plugins: [
    postcss({
      extract: css,
      inject: css,
    }),
    html2({
      onlinePath: format,
      ...html2Config,
    }),
  ],
})

export default [
  config({
    format: 'esm',
    css: true,
    html2Config: {
      template: 'src/index.html',
      file: '../index.html.tmp',
      title: 'Rollup HTML2 plugin example',
      modules: true,
      meta: {
        description:
          'A usage example for the rollup-plugin-html2 with injection of two scripts (module and nomodule).',
      },
    },
  }),

  config({
    format: 'iife',
    inlineDynamicImports: true,
    html2Config: {
      template: 'dist/nomodule/index.html.tmp',
      file: '../index.html',
      nomodule: true,
      externals: [{
        file: 'https://cdn.jsdelivr.net/npm/promise-polyfill@8/dist/polyfill.min.js',
        pos: 'before',
        crossorigin: 'use-credentials',
      }],
    },
  }),
]
