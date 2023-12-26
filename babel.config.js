module.exports = {
  "presets": [
    [ "@babel/preset-env", {
      "loose": true,
      "useBuiltIns": false,
      "targets": {
        "browsers": [ "last 2 versions", "not ie <= 8" ]
      },
      "exclude": [ "transform-typeof-symbol", "transform-function-name", "transform-classes" ]
    } ]
  ],
  "plugins": []
}
