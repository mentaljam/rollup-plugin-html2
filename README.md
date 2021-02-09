> # :warning: This repository is unmaintained! You are welcome to continue the development of rollup-plugin-html2. Please contact me about transfering the ownership on npmjs.org.

# rollup-plugin-html2

[Rollup](https://github.com/rollup/rollup) plugin to inject bundled files to an HTML template.

This plugin was inspired by the
[html-webpack-plugin](https://webpack.js.org/plugins/html-webpack-plugin) and
[rollup-plugin-bundle-html](https://github.com/haifeng2013/rollup-plugin-bundle-html).

`rollup-plugin-html2` doesn't list the output directory but gets entries from the
resulting bundle. Also it emits resulting HTML file as an asset so it could be accessed by other plugins.

The plugin can be used alongside the [rollup-plugin-favicons](https://github.com/mentaljam/rollup-plugin-favicons).
In this case `rollup-plugin-favicons` should be placed before `rollup-plugin-html2`
in the plugin list.

## Install

```sh
npm i -D rollup-plugin-html2
```

## Usage

```js
// rollup.config.js

import html2 from 'rollup-plugin-html2'


export default {
  input: 'index.js',
  output: {
    dir: 'dist',
    format: 'es',
  },
  plugins: [
    html2({
      template: 'index.html',
    }),
  ],
}
```

## Options

Read the [documentation](https://mentaljam.github.io/rollup-plugin-html2/interfaces/ipluginoptions.html).

## License

[MIT](LICENSE) © [Petr Tsymbarovich](mailto:petr@tsymbarovich.ru)
