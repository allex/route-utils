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

export interface TNode<TKey extends string | number = string> {
  [key: string]: any;
  path?: string;
  children?: Array<TNode<TKey>>
}

export interface TNodeRef<T extends TNode = TNode> {
  parent?: T;
  path: string;
  node: T;
}

export type IVisitor<T extends TNode = TNode> = (parent: T | undefined, node: T, path: string, level?: number) => TReturn | boolean
export type IVisitorWithLevel<T extends TNode = TNode> = (parent: T | undefined, node: T, path: string, level: number) => TReturn | boolean

export type EnterVisitor = IVisitor<TNode>
export type LeaveVisitor = IVisitor<TNode>

export interface ITraverseOption {
  enter?: EnterVisitor;
  leave?: LeaveVisitor;
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
export const traverse = <T extends TNode>(route: T | T [], visitor: EnterVisitor | ITraverseOption): void => {
  let enter: EnterVisitor = defaultVisitor
  let leave: LeaveVisitor = defaultVisitor

  if (isFunction(visitor)) {
    enter = visitor as EnterVisitor
  } else {
    const v = visitor as ITraverseOption
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

  reduce(null, route as T[], '/')
}

// Performs a bfs on a node and its children
const bfsTraversal = <T extends TNode> (node: T | T[], matcher: IVisitor): T[] => {
  if (!isArray(node)) {
    // duplicate root
    node = [node]
  }

  const createCtx = (root: string, node: TNode, parent?: TNode): TNodeRef =>
    ({ parent, node, path: resolvePath(root, node.path, true) })

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
      ? (parent, node, path) => (matchPath(path, prefix) === EMatch.NE ? TReturn.Skip : normalizeTReturn((matcher as IVisitor)(parent, node, path)))
      : (parent, node, path) => normalizeTReturn((matcher as IVisitor)(parent, node, path))
  }
  return (_parent, _node, path) => ((matcher as string).indexOf(path) !== 0
    ? TReturn.Skip
    : matcher === path
      ? TReturn.Break
      : TReturn.Normal)
}

export type TraversalFn<T extends TNode> = (routes: T[], fn: IVisitor<T>) => void

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
  const traverseFn: TraversalFn<TNode> = options.bfs
    ? bfsTraversal as TraversalFn<TNode>
    : traverse
  traverseFn(routes, (parent, node, path) => {
    const r = predicate(parent, node, path)
    if (isTBreak(r)) {
      context = { parent, node, path }
    }
    return r
  })
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
  const list = (isList ? node : [node]) as T[]
  const reduce = (parent: T | undefined, nodes: T[], root: string, level: number): T[] => nodes.reduce<T[]>((arr, node) => {
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
  const ret = reduce(undefined, list, '/', 0)
  return isList ? ret : ret[0]
}

type TreeMapIterator<T, TResult> = (node: T, index: number, array: T[]) => TResult

export const flatMapTree = <TResult> (tree: TNode, mapFunc: TreeMapIterator<TNode, TResult>): TResult[] => {
  const fn = (node: TNode, index: number, array: TNode[]) => {
    const v = mapFunc(node, index, array)
    const { children } = node
    return children ? [v, ...children.flatMap(fn)] : [v]
  }
  return fn(tree, 0, [])
}
