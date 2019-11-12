import * as fs from 'fs'
import {minify, Options as MinifyOptions} from 'html-minifier'
import {HTMLElement, parse, TextNode} from 'node-html-parser'
import * as path from 'path'
import {ModuleFormat, OutputAsset, OutputChunk, Plugin} from 'rollup'


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
  preload?: string[] | Set<string>
  modules?: boolean
  minify?: false | MinifyOptions
}

const enum Cache {
  isHTML = 'isHTML',
}

const normalizePreload = (preload?: string[] | Set<string>) => {
  if (!preload) {
    preload = []
  }
  if (preload instanceof Array) {
    preload = new Set(preload)
  }
  return preload
}

const extensionToType = (ext: InjectType | string) => {
  switch (ext) {
    case 'css': return 'style'
    case 'js' : return 'script'
    default   : return null
  }
}

interface IEntryMap {
  [chunk: string]: string
}

interface IReducesBundle {
  entries: IEntryMap
  dynamicEntries: IEntryMap
}

const isChunk = (item: OutputAsset | OutputChunk): item is OutputChunk => {
  return !(item as OutputAsset).isAsset
}

const bundleReducer = (prev: IReducesBundle, cur: OutputAsset | OutputChunk) => {
  if (isChunk(cur)) {
    // Use full name with possible hash and without extension to process
    // possible CSS files and other assets with same name of entry
    const {name} = path.parse(cur.fileName)
    if (cur.isEntry) {
      prev.entries[name] = cur.name
    } else if (cur.isDynamicEntry) {
      prev.dynamicEntries[name] = cur.name
    }
  }
  return prev
}

const formatSupportsModules = (f?: ModuleFormat) => (
     f === 'es'
  || f === 'esm'
  || f === 'module'
)

export default ({
  template,
  file,
  inject,
  title,
  favicon,
  meta,
  externals,
  preload,
  modules,
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

    const typeofmodules = typeof modules
    if (typeofmodules !== 'boolean' && typeofmodules !== 'undefined') {
      this.error('Invalid `modules` argument: ' + JSON.stringify(modules))
    }

    Object.keys(options).forEach(o => this.warn(`Ignoring unknown option "${o}"`))
  },

  outputOptions({dir, file: bundleFile, format}) {
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
    if (modules && !formatSupportsModules(format)) {
      this.error(`The modules option is set to true but the output.format is ${format}, \
consider to use the esm format or switch off the option`)
    }
    return null
  },

  generateBundle(_output, bundle) {
    const data = this.cache.get<boolean>(Cache.isHTML) ?
      template : fs.readFileSync(template).toString()

    const doc = parse(data) as HTMLElement & {valid: boolean}
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
        type: 'asset',
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
          const typeModule = modules ? 'type="module" ' : ''
          jsParent.appendChild(new HTMLElement('script', {}, `${typeModule}src="${fileName}"`))     
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

    // Inject generated files
    if (inject !== false) {
      const files = Object.values(bundle)
      // First of all get entries
      const {entries, dynamicEntries} = files.reduce(bundleReducer, {
        dynamicEntries: {} as IEntryMap,
        entries: {} as IEntryMap,
      })
      // Now process all files and inject only entries and preload files
      preload = normalizePreload(preload)
      files.forEach(({fileName}) => {
        const {name, ext} = path.parse(fileName)
        const injectType = ext.slice(1)
        if (name in entries) {
          injectCSSandJS(fileName, injectType, inject)
        } else if (name in dynamicEntries && (preload as Set<string>).has(dynamicEntries[name])) {
          const linkType = extensionToType(injectType)
          if (linkType) {
            addNewLine(head)
            head.appendChild(new HTMLElement('link', {}, `rel="preload" href="${fileName}" as="${linkType}"`))
          }
        }
      })
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
      type: 'asset',
    }
  },
})
