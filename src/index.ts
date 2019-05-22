import * as fs from 'fs'
import {minify, Options as MinifyOptions} from 'html-minifier'
import {HTMLElement, parse, TextNode} from 'node-html-parser'
import * as path from 'path'
import {Plugin} from 'rollup'


const getChildElement = (node: HTMLElement, tag: string, append = true) => {
  let child = node.querySelector(tag)
  if (!child) {
    child = new HTMLElement(tag, {})
    if (append) {
      node.appendChild(child)
    } else {
      node.childNodes.unshift(child)
    }
  }
  return child
}

const addNewLine = (node: HTMLElement) => node.appendChild(new TextNode('\n  '))

const enum Inject {
  head = 'head',
  body = 'body',
}

const enum InjectType {
  css = 'css',
  js = 'js',
}

const enum ExternalPosition {
  before = 'before',
  after = 'after',
}

interface IExternal {
  file: string
  type?: InjectType
  pos: ExternalPosition
}

type ExtrenalsProcessor = (pos: ExternalPosition) => void

interface IPluginOptions {
  template: string
  file?: string
  inject?: false | Inject
  title?: string
  favicon?: string
  meta?: {[name: string]: string}
  externals?: IExternal[]
  minify?: false | MinifyOptions
}

const enum Cache {
  isHTML = 'isHTML',
}

export default ({
  template,
  file,
  inject,
  title,
  favicon,
  meta,
  externals,
  minify: minifyOptions,
  ...options
}: IPluginOptions): Plugin => ({
  name: 'html2',

  buildStart() {
    const isHTML = /^.*<html>[\s\S]*<\/html>\s*$/i.test(template)
    if (isHTML) {
      if (!file) {
        this.error('When `template` is an HTML string the `file` option must be defined')
      }
    } else {
      if (fs.existsSync(template) && fs.lstatSync(template).isFile()) {
        this.addWatchFile(template)
      } else {
        this.error('`template` must be an HTML or a file path')
      }
    }
    this.cache.set(Cache.isHTML, isHTML)

    if (favicon && !(fs.existsSync(favicon) && fs.lstatSync(favicon).isFile())) {
      this.error('The provided favicon file does\'t exist')
    }

    if (typeof inject === 'string' && !(inject === Inject.head || inject === Inject.body)) {
      this.error('Invalid inject argument: ' + inject)
    }

    if (externals) {
      for (const {pos} of externals) {
        if (pos !== ExternalPosition.before && pos !== ExternalPosition.after) {
          this.error('Invalid position for the extrenal: ' + pos)
        }
      }
    }

    Object.keys(options).forEach(o => this.warn(`Ignoring unknown option "${o}"`))
  },

  outputOptions({dir, file: bundleFile}) {
    if (!file) {
      let distDir = process.cwd()
      if (dir) {
        distDir = path.resolve(distDir, dir)
      } else if (bundleFile) {
        const bundleDir = path.dirname(bundleFile)
        distDir = path.isAbsolute(bundleDir) ? bundleDir : path.resolve(distDir, bundleDir)
      }
      // Template is always a file path
      file = path.resolve(distDir, path.basename(template))
      if (file === path.resolve(template)) {
        this.error('Could\'t write the generated HTML to the source template, define one of the options: `file`, `output.file` or `output.dir`')
      }
    }
  },

  generateBundle(_output, bundle) {
    if (!this.cache.get<boolean>(Cache.isHTML)) {
      template = fs.readFileSync(template).toString()
    }

    const doc = parse(template) as HTMLElement & {valid: boolean}
    if (!doc.valid) {
      this.error('Error parsing template')
    }

    const html = doc.querySelector('html')    
    if (!html) {
      this.error('The input template doesn\'t contain the `html` tag')
    }

    const head = getChildElement(html, 'head', false)
    const body = getChildElement(html, 'body')

    if (meta) {
      const nodes = head.querySelectorAll('meta')
      Object.entries(meta).forEach(([name, content]) => {
        const oldMeta = nodes.find(n => n.attributes.name === name)
        const newMeta = new HTMLElement('meta', {}, `name="${name}" content="${content}"`)
        if (oldMeta) {
          head.exchangeChild(oldMeta, newMeta)
        } else {
          addNewLine(head)
          head.appendChild(newMeta)
        }
      })
    }

    if (title) {
      let node = head.querySelector('title')
      if (!node) {
        addNewLine(head)
        node = new HTMLElement('title', {})
        head.appendChild(node)
      }
      node.set_content(title)
    }

    if (favicon) {
      const nodes = head.querySelectorAll('link')
      const rel = 'shortcut icon'
      const oldLink = nodes.find(n => n.attributes.rel === rel)
      const fileName = path.basename(favicon)
      const newLink = new HTMLElement('link', {}, `rel="${rel}" href="${fileName}"`)
      if (oldLink) {
        head.exchangeChild(oldLink, newLink)
      } else {
        addNewLine(head)
        head.appendChild(newLink)
      }
      bundle[fileName] = {
        fileName,
        isAsset: true,
        source: fs.readFileSync(favicon),
      }
    }

    const injectCSSandJS = (fileName: string, type: string, pos: Inject | undefined = undefined) => {
      const cssParent = pos !== Inject.body ? head : body
      const jsParent = pos !== Inject.head ? body : head
      switch (type) {
        case InjectType.css:
          addNewLine(cssParent)
          cssParent.appendChild(new HTMLElement('link', {}, `rel="stylesheet" href="${fileName}"`))
          break
        case InjectType.js:
          addNewLine(jsParent)
          jsParent.appendChild(new HTMLElement('script', {}, `src="${fileName}"`))
          break
        default:
          break
      }
    }

    const processExternals: ExtrenalsProcessor = externals ?
      (pos) => {
        for (const external of externals) {
          if (external.pos === pos) {
            injectCSSandJS(external.file, external.type || path.extname(external.file).slice(1))
          }
        }
      }
    :
// tslint:disable-next-line: no-empty
      (_pos) => {}

    // Inject externals before
    processExternals(ExternalPosition.before)

    // Inject generated assets
    if (inject !== false) {
      Object.values(bundle).forEach(({fileName}) => injectCSSandJS(fileName, path.extname(fileName).slice(1), inject))
    }

    // Inject externals after
    processExternals(ExternalPosition.after)

    let source = '<!doctype html>\n' + doc.toString()

    if (minifyOptions) {
      source = minify(source, minifyOptions)
    }

    bundle[file!] = {
      fileName: file!,
      isAsset: true,
      source,
    }
  },
})
