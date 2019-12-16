/**
 * Provice some useful route utilities. (based on vue-router)
 *
 * @author Allex Wang (allex.wxn@gmail.com) <http://fedor.io/>
 * MIT Licensed
 */

import {
  isArray, isEmpty, isFunction, isString, resolveUrl
} from '@tdio/utils'

import { fillParams } from './params'

// Re-export some shortcut APIs
export {
  fillParams
}

const param = (o: Kv): string => {
  if (isEmpty(o)) return ''
  return Object.keys(o).reduce((p, k) => {
    if (o[k] != null) {
      p = `${p}&${encodeURIComponent(k)}=${encodeURIComponent(o[k])}`
    }
    return p
  }, '')
}

export interface TNode {
  [key: string]: any;
  path: string;
  children?: TNode[];
}

export interface TNodeRef<T = TNode> {
  parent?: T;
  path: string;
  node: T;
}

export type IVisitor<T = TNode> = (parent: T | undefined, node: T, path: string) => TReturn | boolean

export enum TReturn { Skip = -1, Normal = 0, Break = 1 }

export interface ITraverseOption<T> {
  enter?: IVisitor<T>;
  leave?: IVisitor<T>;
}

const defaultVisitor = () => TReturn.Normal
const isTBreak = (v: any): boolean => v === TReturn.Break || v === null || v === false

// Normalize traverse visitor returns
const normalizeTReturn = (v: any): TReturn => (!v
  ? TReturn.Normal
  : v === -1
    ? TReturn.Skip
    : TReturn.Break)

// Get path diff by a reference path, returns {TReturn}
// TReturn.Skip - Whole not matches
// TReturn.Break - Absolute equal
// TReturn.Normal - with same prefix
export const matchPath = (path: string, ref: string): TReturn => {
  const p1 = path.split('/')
  const p2 = ref.split('/')
  const l1 = p1.length
  const l2 = p2.length
  const l = l1 > l2 ? l2 : l1
  let i = 0
  while (i < l) {
    if (p1[i] !== p2[i]) {
      return TReturn.Skip
    }
    i++
  }
  return l1 === l2 ? TReturn.Break : TReturn.Normal
}

/**
 * Helper api for traverse router tree (DFS)
 *
 * @param {TNode|TNode[]} route(s)
 * @param {ITraverseOption} visitor
 */
export const traverse = <T extends TNode> (route: T | T[], visitor: ITraverseOption<TNode>) => {
  const {
    enter = defaultVisitor,
    leave = defaultVisitor
  } = visitor

  const reduce = <T extends TNode> (parent: T | null, routes: T[], root: string): TReturn => routes.reduce((r: TReturn, route: T) => {
    if (isTBreak(r)) {
      return r
    }

    parent = parent || route
    const path = resolveUrl(root, route.path, true)
    r = enter(parent, route, path) as TReturn

    if (!isTBreak(r)) {
      const children = route.children
      if (children && children.length && r !== TReturn.Skip) {
        r = reduce(route, children!, path)
      }
      if (isTBreak(r) || isTBreak(leave(parent, route, path))) {
        r = TReturn.Break
      }
    }

    return r
  }, TReturn.Normal as TReturn)

  if (!isArray(route)) {
    route = [route]
  }

  reduce(null, route as T[], '/')
}

// Performs a bfs on a node and its children
const bfsTraversal = <T extends TNode> (node: T | T[], matcher: IVisitor): T[] => {
  if (!isArray(node)) {
    // duplicate root
    node = [node]
  }

  const createCtx = (root: string, node: TNode, parent?: TNode): TNodeRef =>
    ({ parent, node, path: resolveUrl(root, node.path, true) })

  const nodes: T[] = []

  if (node.length) {
    // init queue
    const queue = node.map((node: T) => createCtx('/', node, node))

    while (queue.length) {
      const item = queue.shift()
      if (!item) break
      const { parent, node, path } = item
      const r = matcher(parent, node, path)
      if (r !== TReturn.Skip) {
        nodes.push(node as T)
      }
      let children: TNode[] | undefined
      if (isTBreak(r)) {
        break
      } else if (r !== TReturn.Skip && (children = node.children)) {
        for (let i = 0; i < children.length; i++) {
          queue.push(createCtx(path, children[i], node))
        }
      }
    }
  }

  return nodes
}

interface MatcherOptions {
  prefix?: string;
  bfs?: boolean;
}

const normalizeMatcher = (matcher: IVisitor | string, { prefix }: MatcherOptions = {}): IVisitor => {
  if (isFunction(matcher)) {
    return prefix
      ? (parent, node, path) => (matchPath(prefix, path) === TReturn.Skip ? TReturn.Skip : normalizeTReturn((matcher as IVisitor)(parent, node, path)))
      : (parent, node, path) => normalizeTReturn((matcher as IVisitor)(parent, node, path))
  }
  return (_parent, _node, path) => ((matcher as string).indexOf(path) !== 0
    ? TReturn.Skip
    : matcher === path
      ? TReturn.Break
      : TReturn.Normal)
}

/**
 * Find route context by a specific matcher
 *
 * @param matcher {IVisitor|string} IVisitor or a reference path to evalute.
 *
 * @returns {TNodeRef|undefined}
 */
export const findNodeRef = <T extends TNode> (routes: T[], matcher: IVisitor | string, options: MatcherOptions = {}): TNodeRef<T> | undefined => {
  if (!isArray(routes)) {
    throw new TypeError('Invalid node list')
  }
  let context: TNodeRef<TNode> | undefined
  const predicate: IVisitor = normalizeMatcher(matcher, options)
  if (options.bfs) {
    bfsTraversal(routes, (parent, node, path) => {
      const r = predicate(parent, node, path)
      if (isTBreak(r)) {
        context = { parent, node, path }
      }
      return r
    })
  } else {
    traverse(routes, {
      enter (parent, node, path) {
        const r = predicate(parent, node, path)
        if (isTBreak(r)) {
          context = { parent, node, path }
        }
        return r
      }
    })
  }
  return context as TNodeRef<T>
}

export interface ResolveRouteOptions {
  base?: string;
  params?: Kv,
  query?: Kv,
  append?: boolean;
}

/**
 * Resolve route config to a valid href.
 *
 * @param {TNode|string} route
 * @param {ResolveRouteOptions} options
 *
 * @returns {string} The combined path (with params and query evalutions)
 */
export const resolveRoutePath = (route: TNode | string, options: ResolveRouteOptions): string => {
  const {
    base = '/',
    params,
    query,
    append = false
  } = options

  const rawPath = isString(route) ? (route as string) : (route as TNode).path

  let path = resolveUrl(base, rawPath, !!append)

  // apply params. eg: /foo/:id, { id: 1 } => /foo/1
  if (!isEmpty(params)) {
    path = fillParams(path, params!)
  }

  // append query
  if (!isEmpty(query)) {
    const qsToken = path.indexOf('?') === -1 ? '?' : '&'
    path += (qsToken + param(query!))
  }

  return path
}
