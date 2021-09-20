import {rollup} from 'rollup'
import html2 from 'rollup-plugin-html2'
import postcss from 'rollup-plugin-postcss'


const input          = 'src/index.js'
const dir            = 'dist/nomodule'
const entryFileNames = '[format]/[name]-[hash].js'
const chunkFileNames = entryFileNames
const onlinePath     = '/nomodule'

const iifeOptions = {
  dir,
  format: 'iife',
  entryFileNames,
  chunkFileNames,
}

const esmOptions = {
  dir,
  format: 'esm',
  entryFileNames,
  chunkFileNames,
}

const iifeBundle = await rollup({
  input,
  inlineDynamicImports: true,
  plugins: [
    postcss({
      inject:  false,
    }),
  ]
})
await iifeBundle.generate(iifeOptions)
const {output} = await iifeBundle.write(iifeOptions)
const iife = output.find(({type}) => type === 'chunk').fileName

const esmBundle = await rollup({
  input,
  plugins: [
    postcss({
      extract: true,
    }),
    html2({
      template: 'src/index.html',
      title: 'Rollup HTML2 plugin example',
      favicon: 'favicon.ico',
      onlinePath,
      meta: {
        description:
          'A usage example for the rollup-plugin-html2 with injection \
of two scripts (module and nomodule).',
      },
      entries: {
        index: {
          type: 'module',
        },
      },
      externals: {
        after: [{
          tag:         'script',
          nomodule:    true,
          src:         'https://cdn.jsdelivr.net/npm/promise-polyfill@8/dist/polyfill.min.js',
          crossorigin: 'use-credentials',
        }, {
          tag:         'script',
          nomodule:    true,
          src:         `${onlinePath}/${iife}`,
        }],
      },
    }),
  ]
})
await esmBundle.generate(esmOptions)
await esmBundle.write(esmOptions)
