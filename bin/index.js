#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const configPath = path.join(process.cwd(), 'extendscript-config.js')
let config
try {
  config = require(configPath)
} catch (err) {
  throw new Error(`Cannot find config file in your project directory, expected it here: ${configPath}`)
}

require('../lib/index').default(config)
