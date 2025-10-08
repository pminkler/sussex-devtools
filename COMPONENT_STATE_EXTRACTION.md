# Component State Extraction Technical Guide

This document explains how Sussex DevTools extracts component state from Vue 3 applications, even in production builds with minified code.

## The Challenge

In Vue 3 applications using `<script setup>`, component state (refs, reactive objects, computed properties) is not directly accessible on the component instance in production builds. The state exists only in the closure of the setup function and is not exposed via traditional means like:
- `component.setupState` (empty in production)
- `component.data` (empty for Composition API components)
- `component.proxy` (not enumerable)

## The Solution: Effect Dependencies

Vue 3's reactivity system tracks dependencies through an internal effect/dependency graph. When template expressions reference reactive values, Vue creates effects that track which reactive sources they depend on. We can traverse this graph to extract state.

## Implementation Details

### Location of State

Component state is hidden in the effect dependency chain:

```
component
  └─ scope
      └─ effects[] (array of reactive effects)
          └─ deps
              └─ dep
                  ├─ key (root property name, e.g., "name", "location")
                  └─ computed (the reactive ref)
                      ├─ _value (current value)
                      ├─ deps (dependency chain start)
                      └─ depsTail (dependency chain end)
                          └─ dep
                              └─ key (nested property name, e.g., "first", "address1")
```

### Extraction Algorithm

1. **Access the component's effect scope**
   ```javascript
   component.scope.effects
   ```

2. **For each effect, extract the computed ref**
   ```javascript
   const computed = effect.deps?.dep?.computed
   ```

3. **Get the property path**
   - Root key: `computed.deps.dep.key`
   - Nested key: `computed.depsTail.dep.key`
   - Value: `computed._value`

4. **Build nested object structure**
   ```javascript
   if (rootKey && nestedKey) {
     state[rootKey][nestedKey] = value
   }
   ```

### Example Extraction

Given a component with state:
```javascript
const firstName = ref('John')
const lastName = ref('Doe')
const address = ref({ city: 'Austin', state: 'TX' })
```

The effects array will contain entries like:
```javascript
// Effect for firstName
{
  deps: {
    dep: {
      key: 'name',
      computed: { _value: 'John' }
    }
  },
  depsTail: {
    dep: { key: 'first' }
  }
}

// Effect for lastName
{
  deps: {
    dep: {
      key: 'name',
      computed: { _value: 'Doe' }
    }
  },
  depsTail: {
    dep: { key: 'last' }
  }
}
```

This produces:
```json
{
  "name": {
    "first": "John",
    "last": "Doe"
  }
}
```

## Why This Works

### In Development
All the effect tracking structures exist to support Vue's reactivity system.

### In Production
Even with minified code:
- The reactivity system still needs to track dependencies
- Property names in reactive objects are preserved (not minified)
- Effect structures remain intact at runtime
- Only function/variable names in closures get minified

### Limitations

This approach captures:
- ✅ Reactive refs and reactive objects accessed in templates
- ✅ Computed properties used in templates
- ✅ Component props (always accessible)

This approach does NOT capture:
- ❌ Unused refs/reactive objects (no effects created)
- ❌ Local variables in setup that aren't reactive
- ❌ Functions and methods (by design)

## Code Location

The extraction logic is implemented in:
- **`src/devtools-panel.js`** - `window.getComponentState()` function
- Executed in the context of the inspected page via `chrome.devtools.inspectedWindow.eval()`

## Further Reading

- [Vue 3 Reactivity System](https://vuejs.org/guide/extras/reactivity-in-depth.html)
- [Chrome DevTools Extension API](https://developer.chrome.com/docs/extensions/reference/devtools_inspectedWindow/)
- [Vue 3 Component Instance Internals](https://github.com/vuejs/core/blob/main/packages/runtime-core/src/component.ts)
