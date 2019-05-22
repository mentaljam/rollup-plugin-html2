# rollup-plugin-html2

[Rollup](https://github.com/rollup/rollup) plugin to inject bundled files to an HTML template.

This plugin was inspired by the
[html-webpack-plugin](https://webpack.js.org/plugins/html-webpack-plugin) and
[rollup-plugin-bundle-html](https://github.com/haifeng2013/rollup-plugin-bundle-html).

rollup-plugin-html2 doesn't list the output directory but gets entries from the
resulting bundle. Also it emits resulting HTML file as an asset so it could be accessed by other plugins.

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

All options except [template](#template-required) are not mandatory.

### template (required)

```js
string
```

A path to an HTML template file or an HTML string.

##### Example

```js
template: 'src/index.html',
```

```js
template: '<html lang="en"><head><meta charset="utf-8"></head><body></body></html>',
```

### file

```js
string
```

A file path where to write the resulting HTML document. Mandatory if the
[template](#template-required) option is set to an HTML.

##### Default

The basename of the [template](#template-required) file.

##### Example

```js
file: 'dist/index.html',
```

### inject

```js
false | 'head' | 'body'
```

Defines where to inject bundled files. If `undefined` then links to CSS files are injected to the `<head>`
and scripts are injected to the `<body>`. If set to `false` then bundled files are not injected.

### title

```js
string
```

Sets the title of the output HTML document.

### favicon

```js
string
```

A file path of the favicon of the output HTML document. The provided file will be emitted as an asset.

### meta

```js
{[name: string]: string}
```

A set of metadata of the output HTML document. The provided object is handled as pairs `name-content`.

##### Example

```js
meta: {
  description: 'Generated with Rollup',
},
```

### externals

```js
{
  file: string
  pos: 'before' | 'after'
}[]
```

An array of additional files that will be injected to the output HTML document. Only CSS and JS files
are accepted. The `pos` property points when the file is inserted: before processing the budnled files
or after.

##### Example

```js
externals: [{
  file: 'https://cdnjs.cloudflare.com/ajax/libs/normalize/8.0.1/normalize.min.css',
  pos: 'before',
}]
```

### minify

```js
false | MinifyOptions
```

[Options](https://github.com/kangax/html-minifier#options-quick-reference) to pass to the
[html-minifier](https://github.com/kangax/html-minifier).
If the options is undefined or set to `false` then the output HTML will not minified.

##### Example

```js
minify: {
  removeComments: true,
  collapseWhitespace: true,
  keepClosingSlash: true,
},
```

## License

[MIT](LICENSE) © [Petr Tsymbarovich](mailto:petr@tsymbarovich.ru)

