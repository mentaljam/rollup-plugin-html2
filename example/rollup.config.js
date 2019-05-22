import html2 from 'rollup-plugin-html2'
import postcss from 'rollup-plugin-postcss'


export default {
  input: 'index.js',
  output: {
    dir: 'dist',
    entryFileNames: '[name]-[hash].js',
    format: 'es',
  },
  plugins: [
    postcss({
      extract: true,
    }),
    html2({
      template: 'index.html',
      title: 'Rollup HTML2 plugin',
      meta: {
        description: 'Usage example for the rollup-plugin-html2',
      },
      externals: [{
        file: 'https://cdnjs.cloudflare.com/ajax/libs/normalize/8.0.1/normalize.min.css',
        pos: 'before',
      }],
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        keepClosingSlash: true,
      },
    }),
  ],
}
