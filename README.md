# extendscript-bundler

[![Build Status](https://aedtci.mtmograph.com/api/badges/adobe-extension-tools/extendscript-bundler/status.svg)](https://aedtci.mtmograph.com/adobe-extension-tools/extendscript-bundler)
[![npm version](https://badge.fury.io/js/extendscript-bundler.svg)](https://www.npmjs.com/extendscript-bundler)

This package makes it easy to start making extensions for the Adobe suite using ExtendScript and ScriptUI.

It uses browserify to package multiple files together, and uses AppleScript (on macOS) to evaluate the code in your running application.

The real cool thing about this is when it's used in conjunction with the `extendscript-starter` project.
In that project, when loading the extension it looks if there is an existing `Window` instance (which is stored in a global variable on creation).
When it finds one, it will remove all children from it and reuse it.

This way you get an instant "refresh" whenever you make changes to a file!

It looks like this (for After Effects):

```ts
export default (object, title, x = 0, y = 0) => {
  const width: number = 210
  const height: number = 300
  const bounds: Bounds = [x, y, width, height]
  const existingPanel = $.global.extendScriptPanel
  if (isValid(existingPanel)) {
    for (var i = existingPanel.children.length - 1; i >= 0; i--) {
      existingPanel.remove(i)
    }
    return existingPanel
  }
  const panel = (object instanceof Panel) ? object : new Window('palette', title, bounds, {
    resizeable: true,
    borderless: true,
    independent: false
  })
  $.global.extendScriptPanel = panel
  return panel
}
```

## caveats

- macOS only at this point, Windows support is coming soon