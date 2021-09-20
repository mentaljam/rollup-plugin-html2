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
      favicon: 'favicon.ico',
      onlinePath: '/complex',
      meta: {
        description: 'A complex usage example for the rollup-plugin-html2',
      },
      externals: {
        before: [{
          tag:  'link',
          href: 'https://cdnjs.cloudflare.com/ajax/libs/normalize/8.0.1/normalize.min.css',
        }],
        after: [{
          tag:  'script',
          text: 'console.log("Hello from external code!")',
        }],
      },
      entries: {
        index: {
          type: 'module',
        },
        lib: {
          rel: 'preload',
          as:  'script',
        }
      },
      minify: {
        removeComments:     true,
        collapseWhitespace: true,
        keepClosingSlash:   true,
      },
    }),
  ],
}
