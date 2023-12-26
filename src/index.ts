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

const resolvePath = (b: string, p: string | undefined, append?: boolean): string => resolveUrl(b, p || '', append)

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
  [key: string | symbol]: any;
  path?: string;
  children?: TNode[];
}

export interface TNodeRef<T> {
  parent: T | null;
  path: string;
  node: T;
}

export type IVisitor<T> = (parent: T | null, node: T, path: string, level?: number) => TReturn | boolean
export type IVisitorWithLevel<T> = (parent: T | null, node: T, path: string, level: number) => TReturn | boolean

export type EnterVisitor<T> = IVisitor<T>
export type LeaveVisitor<T> = IVisitor<T>

export interface ITraverseOption<T extends TNode> {
  enter?: EnterVisitor<T>;
  leave?: LeaveVisitor<T>;
}

enum TReturn {
  Skip = -1,
  Normal = 0,
  Break = 1
}

enum EMatch {
  NE = -1,
  EQ = 1,
  LT = 2,
  GT = 3
}

export { TReturn, EMatch }

const defaultVisitor = () => TReturn.Normal
const isTBreak = (v: any): boolean => v === TReturn.Break || v === null || v === false

// Normalize traverse visitor returns
const normalizeTReturn = (v: any): TReturn => (!v
  ? TReturn.Normal
  : v === -1
    ? TReturn.Skip
    : TReturn.Break)

/**
 * Get path diff by a reference path, returns {EMatch}
 *
 * EMatch.NE - Whole not matches
 * EMatch.EQ - Absolute equal
 * EMatch.LT - target path is less than ref
 * EMatch.GT - target path is greater than ref
 */
export const matchPath = (path: string, ref: string): EMatch => {
  const p1 = path.split('/').filter(Boolean)
  const p2 = ref.split('/').filter(Boolean)
  const l1 = p1.length
  const l2 = p2.length
  const l = l1 > l2 ? l2 : l1
  let i = 0
  while (i < l) {
    if (p1[i] !== p2[i]) {
      return EMatch.NE
    }
    i++
  }
  return l1 === l2
    ? EMatch.EQ
    : l1 < l2
      ? EMatch.LT
      : EMatch.GT
}

/**
 * Helper api for traverse router tree (DFS)
 *
 * @param {TNode|TNode[]} route(s)
 * @param {ITraverseOption|EnterVisitor} visitor
 */
export const traverse = <T extends TNode>(route: T | T [], visitor: EnterVisitor<T> | ITraverseOption<T>): void => {
  let enter: EnterVisitor<T> = defaultVisitor
  let leave: LeaveVisitor<T> = defaultVisitor

  if (isFunction(visitor)) {
    enter = visitor
  } else {
    const v = visitor
    enter = v.enter || enter
    leave = v.leave || leave
  }

  const reduce = (parent: T | null, routes: T[], root: string): TReturn => routes.reduce<TReturn>((r, route) => {
    if (isTBreak(r)) {
      return r
    }

    parent = parent || route
    const path = resolvePath(root, route.path, true)
    r = enter(parent, route, path) as TReturn

    if (!isTBreak(r)) {
      const children = route.children as T[]
      if (children && children.length && r !== TReturn.Skip) {
        r = reduce(route, children, path)
      }
      if (isTBreak(r) || isTBreak(leave(parent, route, path))) {
        r = TReturn.Break
      }
    }

    return r
  }, TReturn.Normal)

  if (!isArray(route)) {
    route = [route]
  }

  reduce(null, route, '/')
}

const createCtx = <T extends TNode>(basePath: string, node: T, parent: T | null): TNodeRef<T> =>
  ({ parent, node, path: resolvePath(basePath, node.path, true) })

// Performs a bfs on a node and its children
const bfsTraversal = <T extends TNode> (node: T | T[], matcher: IVisitor<T>): T[] => {
  if (!isArray(node)) {
    // duplicate root
    node = [node]
  }

  const nodes: T[] = []
  if (node.length) {
    // init queue
    const queue = node.map((n) => createCtx('/', n, null))

    while (queue.length) {
      const item = queue.shift()
      if (!item) break
      const { parent, node, path } = item
      const r = matcher(parent, node, path)
      if (r !== TReturn.Skip) {
        nodes.push(node)
      }
      if (isTBreak(r)) {
        break
      } else if (r !== TReturn.Skip && node.children) {
        node.children.forEach(n => {
          queue.push(createCtx(path, n as T, node))
        })
      }
    }
  }

  return nodes
}

interface MatcherOptions {
  prefix?: string;
  bfs?: boolean;
}

const normalizeMatcher = <T>(matcher: IVisitor<T> | string, { prefix }: MatcherOptions = {}): IVisitor<T> => {
  if (isFunction(matcher)) {
    return prefix
      ? (parent, node, path) => (matchPath(path, prefix) === EMatch.NE ? TReturn.Skip : normalizeTReturn(matcher(parent, node, path)))
      : (parent, node, path) => normalizeTReturn(matcher(parent, node, path))
  }
  return (_parent, _node, path) => ((matcher).indexOf(path) !== 0
    ? TReturn.Skip
    : matcher === path
      ? TReturn.Break
      : TReturn.Normal)
}

export type TraversalFn<T> = (items: T[], visitor: IVisitor<T>) => void

/**
 * Find route context by a specific matcher
 *
 * @param matcher {IVisitor|string} IVisitor or a reference path to evalute.
 *
 * @returns {TNodeRef|undefined}
 */
export const findNodeRef = <T extends TNode> (
  nodes: T[],
  matcher: IVisitor<T> | string,
  options: MatcherOptions = {}
): TNodeRef<T> | undefined => {
  if (!isArray(nodes)) {
    throw new TypeError('Invalid node list')
  }

  let context: TNodeRef<T> | undefined
  const predicate: IVisitor<T> = normalizeMatcher(matcher, options)
  const traverseFn: TraversalFn<T> = options.bfs
    ? bfsTraversal
    : traverse

  traverseFn(nodes, (parent, node, path) => {
    const r = predicate(parent, node, path)
    if (isTBreak(r)) {
      context = { parent, node, path }
    }
    return r
  })

  return context
}

export interface ResolveRouteOptions {
  base?: string;
  params?: Kv;
  query?: Kv;
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

  const rawPath = isString(route) ? (route) : (route).path

  let path = resolvePath(base, rawPath, !!append)

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

export const reduceTree = <T extends TNode> (node: T | T[], predicate: IVisitorWithLevel<T>): typeof node => {
  const isList = isArray(node)
  const list = (isList ? node : [node])
  const reduce = (parent: T | null, nodes: T[], root: string, level: number): T[] => nodes.reduce<T[]>((arr, node) => {
    const copyChildren = (node.children && node.children.slice(0) || []) as T[]
    const copyNode: T = {
      ...node,
      children: copyChildren
    }
    const path = resolvePath(root, copyNode.path, true)
    if (predicate(parent, copyNode, path, level)) {
      if (copyChildren.length > 0) {
        copyNode.children = reduce(copyNode, copyChildren, path, level + 1)
      }
      if (!copyNode.children?.length) {
        delete copyNode.children
      }
      arr.push(copyNode)
    }
    return arr
  }, [])
  const ret = reduce(null, list, '/', 0)
  return isList ? ret : ret[0]
}

type TreeMapIterator<T, TResult> = (node: T, index: number, array: T[]) => TResult

export const flatMapTree = <T extends TNode, TResult> (
  tree: T,
  mapFunc: TreeMapIterator<T, TResult>
): TResult[] => {
  const fn = (node: T, index: number, array: T[]) => {
    const v = mapFunc(node, index, array)
    const children = node.children as T[]
    return children ? [v, ...children.flatMap<TResult, null>(fn)] : [v]
  }
  return fn(tree, 0, [])
}
