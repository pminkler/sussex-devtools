// DevTools panel script that uses chrome.devtools.inspectedWindow.eval
// to execute code in the inspected page context

// Function to detect all Pinia stores in the inspected page
window.getStores = () => {
  return new Promise((resolve, reject) => {
    // Code to execute in the inspected page
    const detectStoresCode = `
      (function() {
        try {
          // Find an element with a Vue instance
          const element = Array.from(document.querySelectorAll('*')).find((e) => e._vnode);

          if (!element || !element._vnode) {
            return [];
          }

          // Access the Pinia instance
          const pinia = element._vnode.appContext.app.config.globalProperties.$pinia;

          if (!pinia || !pinia._s) {
            return [];
          }

          // Extract all store IDs from the Map
          const storeIds = Array.from(pinia._s.keys());

          return storeIds;
        } catch (error) {
          console.error('Error detecting Pinia stores:', error);
          return [];
        }
      })();
    `;

    // Execute the code in the inspected window
    chrome.devtools.inspectedWindow.eval(detectStoresCode, (result, exceptionInfo) => {
      if (exceptionInfo) {
        console.error('Error evaluating store detection code:', exceptionInfo);
        reject(exceptionInfo);
      } else {
        resolve(result || []);
      }
    });
  });
};

// Function to get the state of a specific store
window.getStoreState = (storeName) => {
  return new Promise((resolve, reject) => {
    // Code to execute in the inspected page
    const getStateCode = `
      (function() {
        try {
          // Find an element with a Vue instance
          const element = Array.from(document.querySelectorAll('*')).find((e) => e._vnode);

          if (!element || !element._vnode) {
            return null;
          }

          // Access the Pinia instance
          const pinia = element._vnode.appContext.app.config.globalProperties.$pinia;

          if (!pinia || !pinia._s) {
            return null;
          }

          // Get the specific store
          const store = pinia._s.get('${storeName}');

          if (!store) {
            return null;
          }

          // Extract the state - $state gives us the raw reactive state
          // We need to serialize it to pass to DevTools
          // Handle circular references by using a custom replacer
          const seen = new WeakSet();
          return JSON.parse(JSON.stringify(store.$state, (key, value) => {
            if (typeof value === 'object' && value !== null) {
              if (seen.has(value)) {
                return '[Circular Reference]';
              }
              seen.add(value);
            }
            return value;
          }));
        } catch (error) {
          console.error('Error getting store state:', error);
          return null;
        }
      })();
    `;

    // Execute the code in the inspected window
    chrome.devtools.inspectedWindow.eval(getStateCode, (result, exceptionInfo) => {
      if (exceptionInfo) {
        console.error('Error evaluating store state code:', exceptionInfo);
        reject(exceptionInfo);
      } else {
        resolve(result);
      }
    });
  });
};

// Function to detect all Vue components in the inspected page
window.getComponents = () => {
  return new Promise((resolve, reject) => {
    const detectComponentsCode = `
      (function() {
        try {
          let root = Array.from(document.querySelectorAll('*')).find(e => e.__vnode || e._vnode);

          if (!root) {
            return [];
          }

          let components = [];
          let idCounter = 0;

          function walkVNode(vnode, depth = 0, parentId = null) {
            if (!vnode) return;

            if (vnode.component) {
              const component = vnode.component;
              const name = component.type.__name || component.type.name || 'Anonymous';
              const id = idCounter++;

              components.push({
                id,
                name,
                depth,
                parentId,
                type: component.type
              });

              // Walk the component's subtree
              if (component.subTree) {
                walkVNode(component.subTree, depth + 1, id);
              }
            }

            // Walk children
            if (Array.isArray(vnode.children)) {
              vnode.children.forEach(child => {
                if (child && typeof child === 'object') {
                  walkVNode(child, depth, parentId);
                }
              });
            }
          }

          walkVNode(root.__vnode || root._vnode);
          return components;
        } catch (error) {
          console.error('Error detecting Vue components:', error);
          return [];
        }
      })();
    `;

    chrome.devtools.inspectedWindow.eval(detectComponentsCode, (result, exceptionInfo) => {
      if (exceptionInfo) {
        console.error('Error evaluating component detection code:', exceptionInfo);
        reject(exceptionInfo);
      } else {
        resolve(result || []);
      }
    });
  });
};

// Function to get the state of a specific component
window.getComponentState = (componentId) => {
  return new Promise((resolve, reject) => {
    const getComponentStateCode = `
      (function() {
        try {
          let root = Array.from(document.querySelectorAll('*')).find(e => e.__vnode || e._vnode);

          if (!root) {
            return null;
          }

          let targetComponent = null;
          let currentId = 0;
          const targetId = ${componentId};

          function walkVNode(vnode) {
            if (!vnode) return false;

            if (vnode.component) {
              const component = vnode.component;
              const id = currentId++;

              if (id === targetId) {
                targetComponent = component;
                return true;
              }

              if (component.subTree) {
                if (walkVNode(component.subTree)) return true;
              }
            }

            if (Array.isArray(vnode.children)) {
              for (const child of vnode.children) {
                if (child && typeof child === 'object') {
                  if (walkVNode(child)) return true;
                }
              }
            }

            return false;
          }

          walkVNode(root.__vnode || root._vnode);

          if (!targetComponent) {
            return null;
          }

          // Extract component state from effect dependencies
          const state = {
            props: {},
            state: {}
          };

          // Get props (these are always accessible)
          if (targetComponent.props) {
            try {
              state.props = JSON.parse(JSON.stringify(targetComponent.props));
            } catch (e) {
              state.props = { error: 'Could not serialize props' };
            }
          }

          // Extract reactive state from effect dependencies
          if (targetComponent.scope && targetComponent.scope.effects) {
            targetComponent.scope.effects.forEach((effect) => {
              const computed = effect.deps?.dep?.computed;

              if (computed) {
                const rootKey = computed.deps?.dep?.key;
                const nestedKey = computed.depsTail?.dep?.key;
                const value = computed._value;

                // Build nested object structure
                if (rootKey && nestedKey) {
                  if (!state.state[rootKey]) {
                    state.state[rootKey] = {};
                  }

                  try {
                    // Serialize the value to avoid proxy objects
                    state.state[rootKey][nestedKey] = JSON.parse(JSON.stringify(value));
                  } catch (e) {
                    state.state[rootKey][nestedKey] = '[Cannot serialize]';
                  }
                } else if (rootKey && !nestedKey) {
                  // Handle top-level properties
                  try {
                    state.state[rootKey] = JSON.parse(JSON.stringify(value));
                  } catch (e) {
                    state.state[rootKey] = '[Cannot serialize]';
                  }
                }
              }
            });
          }

          return state;
        } catch (error) {
          console.error('Error getting component state:', error);
          return null;
        }
      })();
    `;

    chrome.devtools.inspectedWindow.eval(getComponentStateCode, (result, exceptionInfo) => {
      if (exceptionInfo) {
        console.error('Error evaluating component state code:', exceptionInfo);
        reject(exceptionInfo);
      } else {
        resolve(result);
      }
    });
  });
};

// Function to find a component by DOM element
window.findComponentByElement = (element) => {
  return new Promise((resolve, reject) => {
    const findComponentCode = `
      (function() {
        try {
          let targetElement = arguments[0];

          if (!targetElement) {
            return null;
          }

          // Walk up the DOM tree to find the nearest element with a vnode
          let currentElement = targetElement;
          let targetVNode = null;

          while (currentElement && !targetVNode) {
            targetVNode = currentElement.__vnode || currentElement._vnode;
            if (!targetVNode) {
              currentElement = currentElement.parentElement;
            }
          }

          if (!targetVNode) {
            return null;
          }

          // Find the component instance from the vnode
          let targetComponent = null;
          let vnode = targetVNode;

          while (vnode && !targetComponent) {
            if (vnode.component) {
              targetComponent = vnode.component;
              break;
            }
            vnode = vnode.parent;
          }

          if (!targetComponent) {
            return null;
          }

          // Now we need to find the ID of this component by walking the tree
          let root = Array.from(document.querySelectorAll('*')).find(e => e.__vnode || e._vnode);

          if (!root) {
            return null;
          }

          let foundId = null;
          let currentId = 0;

          function walkVNode(vnode) {
            if (!vnode) return false;

            if (vnode.component) {
              const component = vnode.component;
              const id = currentId++;

              if (component === targetComponent) {
                foundId = id;
                return true;
              }

              if (component.subTree) {
                if (walkVNode(component.subTree)) return true;
              }
            }

            if (Array.isArray(vnode.children)) {
              for (const child of vnode.children) {
                if (child && typeof child === 'object') {
                  if (walkVNode(child)) return true;
                }
              }
            }

            return false;
          }

          walkVNode(root.__vnode || root._vnode);

          return foundId;
        } catch (error) {
          console.error('Error finding component by element:', error);
          return null;
        }
      })();
    `;

    chrome.devtools.inspectedWindow.eval(
      findComponentCode,
      { useContentScriptContext: false },
      (result, exceptionInfo) => {
        if (exceptionInfo) {
          console.error('Error finding component:', exceptionInfo);
          reject(exceptionInfo);
        } else {
          resolve(result);
        }
      }
    );
  });
};

// Function to enable the element picker
window.enablePicker = () => {
  return new Promise((resolve, reject) => {
    const enablePickerCode = `
      (function() {
        // Create overlay element for highlighting
        let overlay = document.getElementById('__vue_devtools_picker_overlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = '__vue_devtools_picker_overlay';
          overlay.style.position = 'absolute';
          overlay.style.backgroundColor = 'rgba(71, 123, 228, 0.3)';
          overlay.style.border = '2px solid #477be4';
          overlay.style.pointerEvents = 'none';
          overlay.style.zIndex = '999999';
          overlay.style.display = 'none';
          document.body.appendChild(overlay);
        }

        let hoveredElement = null;

        const onMouseMove = (e) => {
          hoveredElement = e.target;

          // Update overlay position and size
          const rect = hoveredElement.getBoundingClientRect();
          overlay.style.display = 'block';
          overlay.style.left = (rect.left + window.scrollX) + 'px';
          overlay.style.top = (rect.top + window.scrollY) + 'px';
          overlay.style.width = rect.width + 'px';
          overlay.style.height = rect.height + 'px';
        };

        const onClick = (e) => {
          // Store the selected element for retrieval BEFORE cleanup
          window.__selectedElement = hoveredElement;

          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          // Clean up after storing element
          cleanup();

          // Signal that element was selected
          return false;
        };

        const onKeyDown = (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cleanup();
            window.__pickerCancelled = true;
          }
        };

        const cleanup = () => {
          document.removeEventListener('mousemove', onMouseMove, true);
          document.removeEventListener('click', onClick, true);
          document.removeEventListener('keydown', onKeyDown, true);

          if (overlay) {
            overlay.style.display = 'none';
          }

          // Mark as cleaned up
          window.__pickerCleanedUp = true;
        };

        // Reset cleanup flag
        window.__pickerCleanedUp = false;

        // Add event listeners with capture phase
        document.addEventListener('mousemove', onMouseMove, true);
        document.addEventListener('click', onClick, true);
        document.addEventListener('keydown', onKeyDown, true);

        // Store cleanup function globally
        window.__cleanupPicker = cleanup;

        return true;
      })();
    `;

    chrome.devtools.inspectedWindow.eval(enablePickerCode, (result, exceptionInfo) => {
      if (exceptionInfo) {
        console.error('Error enabling picker:', exceptionInfo);
        reject(exceptionInfo);
        return;
      }

      // Poll for selection or cancellation
      const checkInterval = setInterval(() => {
        chrome.devtools.inspectedWindow.eval(
          '({ selected: !!window.__selectedElement, cancelled: !!window.__pickerCancelled })',
          (checkResult, checkException) => {
            if (checkException) {
              clearInterval(checkInterval);
              reject(checkException);
              return;
            }

            if (checkResult.cancelled) {
              // Cancelled
              clearInterval(checkInterval);
              chrome.devtools.inspectedWindow.eval('delete window.__pickerCancelled');
              resolve(null);
            } else if (checkResult.selected) {
              // Element was selected
              clearInterval(checkInterval);

              // Now find the component ID
              const findComponentCode = `
                (function() {
                  try {
                    let targetElement = window.__selectedElement;

                    if (!targetElement) {
                      console.log('No target element found');
                      return null;
                    }

                    console.log('Target element:', targetElement);

                    // Build a complete list of all components and their DOM elements
                    let root = Array.from(document.querySelectorAll('*')).find(e => e.__vnode || e._vnode);

                    if (!root) {
                      console.log('No root element found');
                      delete window.__selectedElement;
                      return null;
                    }

                    const allComponents = [];
                    let tempIdCounter = 0;

                    function collectComponents(vnode, depth = 0, parentId = null) {
                      if (!vnode) return;

                      if (vnode.component) {
                        const component = vnode.component;
                        const name = component.type.__name || component.type.name || 'Anonymous';
                        const id = tempIdCounter++;

                        // Get the DOM element for this component
                        let el = component.vnode?.el || component.subTree?.el;

                        allComponents.push({
                          id,
                          name,
                          component,
                          element: el,
                          uid: component.uid
                        });

                        if (component.subTree) {
                          collectComponents(component.subTree, depth + 1, id);
                        }
                      }

                      if (Array.isArray(vnode.children)) {
                        vnode.children.forEach(child => {
                          if (child && typeof child === 'object') {
                            collectComponents(child, depth, parentId);
                          }
                        });
                      }
                    }

                    collectComponents(root.__vnode || root._vnode);

                    console.log('Total components found:', allComponents.length);

                    // Find components that contain the target element
                    const matchingComponents = allComponents.filter(comp => {
                      if (!comp.element) return false;
                      return comp.element === targetElement || comp.element.contains(targetElement);
                    });

                    console.log('Components containing target:', matchingComponents.length);

                    if (matchingComponents.length === 0) {
                      console.log('No component contains the target element');
                      delete window.__selectedElement;
                      return null;
                    }

                    // Find the closest component (smallest containing element)
                    let closestComponent = matchingComponents[0];

                    // First check for exact match
                    const exactMatch = matchingComponents.find(c => c.element === targetElement);
                    if (exactMatch) {
                      closestComponent = exactMatch;
                      console.log('Found exact match:', closestComponent.name, 'ID:', closestComponent.id);
                    } else {
                      // Find the component with the smallest containing element
                      let smallestSize = Infinity;
                      matchingComponents.forEach(comp => {
                        if (comp.element) {
                          const size = comp.element.offsetWidth * comp.element.offsetHeight;
                          if (size > 0 && size < smallestSize) {
                            smallestSize = size;
                            closestComponent = comp;
                          }
                        }
                      });
                      console.log('Found closest by size:', closestComponent.name, 'ID:', closestComponent.id);
                    }

                    const targetComponent = closestComponent.component;

                    // Now we need to find the ID of this component by walking the tree again
                    // (with the same ID counter logic as getComponents)

                    let foundId = null;
                    let currentId = 0;

                    function walkVNode(vnode) {
                      if (!vnode) return false;

                      if (vnode.component) {
                        const component = vnode.component;
                        const id = currentId++;

                        if (component === targetComponent) {
                          foundId = id;
                          return true;
                        }

                        if (component.subTree) {
                          if (walkVNode(component.subTree)) return true;
                        }
                      }

                      if (Array.isArray(vnode.children)) {
                        for (const child of vnode.children) {
                          if (child && typeof child === 'object') {
                            if (walkVNode(child)) return true;
                          }
                        }
                      }

                      return false;
                    }

                    walkVNode(root.__vnode || root._vnode);

                    console.log('Found component ID:', foundId);

                    // Clean up after finding the component
                    delete window.__selectedElement;

                    return foundId;
                  } catch (error) {
                    console.error('Error finding component by element:', error);
                    delete window.__selectedElement;
                    return null;
                  }
                })();
              `;

              chrome.devtools.inspectedWindow.eval(findComponentCode, (componentId, componentException) => {
                if (componentException) {
                  console.error('Exception finding component:', componentException);
                  reject(componentException);
                } else {
                  console.log('Resolved component ID:', componentId);
                  resolve(componentId);
                }
              });
            }
          }
        );
      }, 100);
    });
  });
};

// Function to disable the element picker
window.disablePicker = () => {
  return new Promise((resolve, reject) => {
    const disablePickerCode = `
      (function() {
        if (window.__cleanupPicker) {
          window.__cleanupPicker();
          delete window.__cleanupPicker;
        }

        // Clean up any leftover state
        delete window.__selectedElement;
        delete window.__pickerCancelled;

        // Remove overlay
        const overlay = document.getElementById('__vue_devtools_picker_overlay');
        if (overlay) {
          overlay.remove();
        }

        return true;
      })();
    `;

    chrome.devtools.inspectedWindow.eval(disablePickerCode, (result, exceptionInfo) => {
      if (exceptionInfo) {
        console.error('Error disabling picker:', exceptionInfo);
        reject(exceptionInfo);
      } else {
        resolve(result);
      }
    });
  });
};

// Function to reveal a component in the inspected page
window.revealComponentInPage = (componentId) => {
  return new Promise((resolve, reject) => {
    const revealCode = `
      (function() {
        try {
          let root = Array.from(document.querySelectorAll('*')).find(e => e.__vnode || e._vnode);

          if (!root) {
            return false;
          }

          let targetComponent = null;
          let currentId = 0;
          const targetId = ${componentId};

          function walkVNode(vnode) {
            if (!vnode) return false;

            if (vnode.component) {
              const component = vnode.component;
              const id = currentId++;

              if (id === targetId) {
                targetComponent = component;
                return true;
              }

              if (component.subTree) {
                if (walkVNode(component.subTree)) return true;
              }
            }

            if (Array.isArray(vnode.children)) {
              for (const child of vnode.children) {
                if (child && typeof child === 'object') {
                  if (walkVNode(child)) return true;
                }
              }
            }

            return false;
          }

          walkVNode(root.__vnode || root._vnode);

          if (!targetComponent) {
            return false;
          }

          // Get the component's DOM element
          const element = targetComponent.vnode?.el || targetComponent.subTree?.el;

          if (!element) {
            return false;
          }

          // Remove any existing highlight
          const existingHighlight = document.getElementById('__vue_devtools_reveal_highlight');
          if (existingHighlight) {
            existingHighlight.remove();
          }

          // Create highlight overlay
          const highlight = document.createElement('div');
          highlight.id = '__vue_devtools_reveal_highlight';
          highlight.style.position = 'absolute';
          highlight.style.backgroundColor = 'rgba(71, 123, 228, 0.3)';
          highlight.style.border = '2px solid #477be4';
          highlight.style.pointerEvents = 'none';
          highlight.style.zIndex = '999999';
          highlight.style.transition = 'opacity 0.3s ease-out';
          highlight.style.boxShadow = '0 0 0 3px rgba(71, 123, 228, 0.2)';

          // Position the highlight
          const rect = element.getBoundingClientRect();
          highlight.style.left = (rect.left + window.scrollX) + 'px';
          highlight.style.top = (rect.top + window.scrollY) + 'px';
          highlight.style.width = rect.width + 'px';
          highlight.style.height = rect.height + 'px';

          document.body.appendChild(highlight);

          // Scroll element into view
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Fade out and remove after 2 seconds
          setTimeout(() => {
            highlight.style.opacity = '0';
            setTimeout(() => {
              highlight.remove();
            }, 300);
          }, 2000);

          return true;
        } catch (error) {
          console.error('Error revealing component:', error);
          return false;
        }
      })();
    `;

    chrome.devtools.inspectedWindow.eval(revealCode, (result, exceptionInfo) => {
      if (exceptionInfo) {
        console.error('Error revealing component:', exceptionInfo);
        reject(exceptionInfo);
      } else {
        resolve(result);
      }
    });
  });
};

// Function to emit an event from a component
window.emitComponentEvent = (componentId, eventName, eventData) => {
  return new Promise((resolve, reject) => {
    const emitCode = `
      (function() {
        try {
          let root = Array.from(document.querySelectorAll('*')).find(e => e.__vnode || e._vnode);

          if (!root) {
            return false;
          }

          let targetComponent = null;
          let currentId = 0;
          const targetId = ${componentId};

          function walkVNode(vnode) {
            if (!vnode) return false;

            if (vnode.component) {
              const component = vnode.component;
              const id = currentId++;

              if (id === targetId) {
                targetComponent = component;
                return true;
              }

              if (component.subTree) {
                if (walkVNode(component.subTree)) return true;
              }
            }

            if (Array.isArray(vnode.children)) {
              for (const child of vnode.children) {
                if (child && typeof child === 'object') {
                  if (walkVNode(child)) return true;
                }
              }
            }

            return false;
          }

          walkVNode(root.__vnode || root._vnode);

          if (!targetComponent) {
            return false;
          }

          // Parse event data if provided
          let parsedData = ${eventData ? JSON.stringify(eventData) : 'undefined'};

          // Emit the event
          if (targetComponent.emit) {
            targetComponent.emit('${eventName}', parsedData);
            return true;
          }

          return false;
        } catch (error) {
          console.error('Error emitting event:', error);
          return false;
        }
      })();
    `;

    chrome.devtools.inspectedWindow.eval(emitCode, (result, exceptionInfo) => {
      if (exceptionInfo) {
        console.error('Error emitting event:', exceptionInfo);
        reject(exceptionInfo);
      } else {
        resolve(result);
      }
    });
  });
};

// Make it available globally for Vue components
window.piniaDevTools = {
  getStores: window.getStores,
  getStoreState: window.getStoreState
};

window.vueDevTools = {
  getComponents: window.getComponents,
  getComponentState: window.getComponentState,
  findComponentByElement: window.findComponentByElement,
  enablePicker: window.enablePicker,
  disablePicker: window.disablePicker,
  revealComponentInPage: window.revealComponentInPage,
  emitComponentEvent: window.emitComponentEvent
};

// Member Modules Network Monitoring
const memberModulesData = {
  projects: new Map(), // Map of "workspace/project" -> { workspace, project, modules: [] }
  listeners: new Set()
};

// Listen for network requests
if (chrome.devtools && chrome.devtools.network) {
  chrome.devtools.network.onRequestFinished.addListener((request) => {
    try {
      const url = request.request.url;

      // Check if URL matches member modules pattern
      // https://d3mmydk2yvkj9n.cloudfront.net/{workspace}/{project}/latest/assets/{file}
      const cloudFrontPattern = /^https:\/\/d3mmydk2yvkj9n\.cloudfront\.net\/([^/]+)\/([^/]+)\/latest\/assets\/(.+)$/;
      const match = url.match(cloudFrontPattern);

      if (match) {
        const workspace = match[1];
        const project = match[2];
        const file = match[3];
        const key = `${workspace}/${project}`;

        if (!memberModulesData.projects.has(key)) {
          memberModulesData.projects.set(key, {
            workspace,
            project,
            modules: []
          });
        }

        const projectData = memberModulesData.projects.get(key);
        projectData.modules.push({
          file,
          url,
          timestamp: new Date().toISOString()
        });

        // Notify listeners
        memberModulesData.listeners.forEach(listener => {
          try {
            listener();
          } catch (e) {
            console.error('Error notifying listener:', e);
          }
        });
      }
    } catch (error) {
      console.error('Error processing network request:', error);
    }
  });
}

window.getMemberModules = () => {
  return new Promise((resolve) => {
    const projects = Array.from(memberModulesData.projects.values()).map(project => ({
      workspace: project.workspace,
      project: project.project,
      moduleCount: project.modules.length,
      modules: project.modules
    }));
    resolve(projects);
  });
};

window.clearMemberModules = () => {
  return new Promise((resolve) => {
    memberModulesData.projects.clear();
    memberModulesData.listeners.forEach(listener => {
      try {
        listener();
      } catch (e) {
        console.error('Error notifying listener:', e);
      }
    });
    resolve(true);
  });
};

window.addMemberModulesListener = (callback) => {
  memberModulesData.listeners.add(callback);
  return () => memberModulesData.listeners.delete(callback);
};

window.memberModulesDevTools = {
  getMemberModules: window.getMemberModules,
  clearMemberModules: window.clearMemberModules,
  addListener: window.addMemberModulesListener
};
