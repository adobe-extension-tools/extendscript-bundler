#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
if (args.length === 0 || (args.length === 1 && args[0] !== 'build' && args[0] !== 'watch')) {
  args.unshift('watch')
}

let configPath = path.join(process.cwd(), 'extendscript-config.js')
if (args.length === 2) {
  configPath = args[1]
}

let config
try {
  config = require(configPath)
} catch (err) {
  throw new Error(`Cannot find config file in your project directory, expected it here: ${configPath}`)
}

const action = args.shift()

switch (action) {
  case 'watch':
    require('../lib/index').watch(config)
  break
  case 'build':
    require('../lib/index').build(config)
  break
}