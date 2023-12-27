# route-utils

Provides some utils for routes (based on tree), such as traverse, findNodeRef etc,.

## Installation

```sh
yarn add route-utils -D
```

## Usage

### reduceTree

```ts
declare const reduceTree: <T extends TNode>(
  node: T | T[], 
  predicate: IVisitorWithLevel<T>
) => T | T[];
```

```ts
import { reduceTree } from 'route-utils'

const MAX_DEPTH = 3

const getMenuItems = (): RouteConfig[] => {
  // reduce only keep specific depth nodes
  const menuItems = reduceTree(menuItems, (_parent, _node, _path, level) => level < MAX_DEPTH) as RouteConfig[]
  return menuItems
}
```

### findNodeRef

```ts
declare const findNodeRef: <T extends TNode>(
  nodes: T[], 
  matcher: string | IVisitor<T>, 
  options?: MatcherOptions
) => TNodeRef<T> | undefined;
```

```ts
import { reduceTree } from 'route-utils'

export const findTopPath = (routes: RouteRecord[], prefix: string): string => {
  const {
    path = `/${prefix.split('/').filter(Boolean)[0]}`
  } = findNodeRef(routes, (parent, r, path) => (r.meta?.type === RouteType.Top), { prefix, bfs: true }) || {}
  return path
}
```

### traverse

```ts
declare const traverse: <T extends TNode>(
  tree: T | T[],
  visitor: EnterVisitor<T> | ITraverseOption<T>
) => void;
```

```ts
get navItems (): RouteConfig[] {
  const routerList: RouteConfig[] = this.$store.getters['session/aclRoutes']
  const root = this.basePath
  const items: RouteConfig[] = []
  traverse(routerList, {
    enter (_parent, node, path) {
      if (!path.startsWith(root)) {
        return -1
      }
      if (node.meta?.type === RouteType.Top) {
        if (!node.hidden) {
          items.push(node)
        }
        return -1
      }
      return 0
    }
  })
  return items
}
```

## License

[MIT](http://opensource.org/licenses/MIT)

[1]: https://github.com/allex/
