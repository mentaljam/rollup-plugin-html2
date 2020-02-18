import html2 from 'rollup-plugin-html2'
import postcss from 'rollup-plugin-postcss'


export default {
  input: 'src/index.js',
  output: {
    dir: 'dist/complex',
    entryFileNames: '[name]-[hash].js',
    format: 'esm',
  },
  plugins: [
    postcss({
      extract: true,
    }),
    html2({
      template: 'src/index.html',
      title: 'Rollup HTML2 plugin example',
      meta: {
        description: 'A complex usage example for the rollup-plugin-html2',
      },
      externals: [{
        file: 'https://cdnjs.cloudflare.com/ajax/libs/normalize/8.0.1/normalize.min.css',
        pos: 'before',
        crossorigin: 'use-credentials',
      }],
      preload: ['lib'],
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        keepClosingSlash: true,
      },
    }),
  ],
}
