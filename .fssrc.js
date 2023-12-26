// vim: set ft=javascript fdm=marker et ff=unix tw=81 sw=2:
// author: allex_wang <http://iallex.com>

import path from 'path'

import { version, name, author, license, description } from './package.json'

const banner = (name, short = false) => {
  let s
  if (short) {
    s = `/*! ${name} v${version} | ${license} licensed | ${author.name || author} */`
  } else {
    s = `/**
 * ${name} v${version} - ${description}
 *
 * @author ${author}
 * Released under the ${license} license.
 */`
  }
  return s
}

const resolve = p => path.resolve(__dirname, '.', p)

const plugins = [
  'node-builtins',
  'resolve',
  'typescript',
  'babel',
  'commonjs',
  'globals',
  ['minimize', { output: { beautify: true } }]
]

export default {
  destDir: resolve('lib'),
  entry: [
    {
      input: resolve('src/index.ts'),
      plugins,
      output: [
        { format: 'es', file: 'lib/route-utils.esm.js', banner: banner(name, true) },
        { format: 'cjs', file: 'lib/route-utils.js', banner: banner(name) }
      ]
    }
  ]
}
