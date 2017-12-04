# extendscript-bundler

This package makes it easy to start making extensions for the Adobe suite using ExtendScript.
It uses browserify to package multiple files together, and uses AppleScript (on macOS) to evaluate the code in your running application.

The real cool thing about this is when it's used in conjunction with the extendscript-starter project.
In this project the Windows instance is stored in a global variable and after you make a change to the code,
The new code is evaluated and will find the old Window instance, and will reuse it after clearing all "groups" that are on it.

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

TODO: explain this better & show some examples

## Caveats

- macOS only at this point, Windows support is coming soon