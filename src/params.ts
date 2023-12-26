import { compile, PathFunction } from 'path-to-regexp'

const regexpCompileCache: Record<string, PathFunction> = Object.create(null)

export function fillParams (path: string, params: Kv): string {
  params = params || {}
  try {
    const filler = regexpCompileCache[path]
      || (regexpCompileCache[path] = compile(path))

    // Fix #2505 resolving asterisk routes { name: 'not-found', params: { pathMatch: '/not-found' }}
    if (params.pathMatch) params[0] = params.pathMatch

    return filler(params)
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(`missing param for ${path}: ${(e instanceof Error ? e.message : (e as string))}`)
    }
    return ''
  } finally {
    // delete the 0 if it was added
    delete params[0]
  }
}
