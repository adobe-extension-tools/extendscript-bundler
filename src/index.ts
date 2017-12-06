/// <reference path="./index.d.ts" />

import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import { execSync } from 'child_process'
import * as browserify from 'browserify'
import * as watchify from 'watchify'
import * as prependify from 'prependify'
import * as envify from 'envify'
import * as debug from 'debug'
import * as yuicompressor from 'yuicompressor'

const log = debug('extendscript-bundler')

interface BundlerOpts {
  app: string,
  live: boolean,
  entry: string,
  dest: string,
  minify: boolean
}

const escape = (str: string) => str.replace(/[\\"]/g, '\\$&')

function sendJsxToApp(jsxFile: string, applicationPath: string) {
  log('-> sendJsxToApp')
  const appleScriptPath = path.join(os.tmpdir(), `evalinadobe.scpt`);
  const code = `$.global.errorToPretty = function (err) {
  var stack = $.stack.split('\\n')
  stack.shift()
  var lines = (err.source && err.source.split('\\n')) || []
  err.line--;
  return {
    name: err.name,
    message: err.message,
    line: err.line,
    context: [
      lines[err.line - 2] || '',
      lines[err.line - 1] || '',
      lines[err.line] || '',
      lines[err.line + 1] || '',
      lines[err.line + 2] || ''
    ],
    stack: stack
  }
}
try {
  $.evalFile("${jsxFile}");
  $.writeln('Live-reloaded JSX');
} catch (err) {
  $.writeln('Unable to livereload: ' + JSON.stringify($.global.errorToPretty(err), undefined, 2));
}`
  const appleScriptContents = `tell application "${applicationPath}"
  DoScript "${escape(code)}"
end tell`;
  fs.writeFileSync(appleScriptPath, appleScriptContents, 'utf8');
  execSync(`osascript "${appleScriptPath}"`)
}

function getBundler(opts: BundlerOpts) {
  log('-> getBundler')
  const bundler = browserify({
    entries: [opts.entry],
    cache: {},
    packageCache: {}
  })
  bundler.plugin(prependify, `var globalThis = this;`)
  bundler.transform(envify)
  return bundler
}

function build(opts: BundlerOpts) {
  log('-> build')
  const bundler = getBundler(opts)
  const writeStream = fs.createWriteStream(opts.dest)
  bundler.bundle()
    .on('error', (err: Error) => console.error(err.message))
    .pipe(writeStream)
}

function watch(opts: BundlerOpts) {
  log('-> watch')
  const bundler = getBundler(opts)
  bundler.plugin(watchify)
  function bundle() {
    log('-> bundle')
    const writeStream = fs.createWriteStream(opts.dest)
    writeStream.on('finish', () => {
      const contents = fs.readFileSync(opts.dest, 'utf8')
      if (opts.minify) {
        yuicompressor.compress(
          contents,
          {
            charset: 'utf8',
            type: 'js',
            'preserve-semi': true,
            // nomunge: false
          },
          function (err: Error, minified: string) {
            if (err) {
              console.error(err)
              return
            }
            fs.writeFileSync(opts.dest, minified)
          }
        )
      }
      sendJsxToApp(opts.dest, opts.app)
    })
    bundler.bundle()
      .on('error', (err: Error) => console.error(err.message))
      .pipe(writeStream)
  }
  bundler.on('update', bundle)
  bundle()
}

export default (opts: any) => {
  log(opts)
  if (opts.live) {
    watch(opts)
  } else {
    build(opts)
  }
}