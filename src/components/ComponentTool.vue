<template>
  <div class="flex h-full">
    <!-- Secondary sidebar for component tree -->
    <div
      ref="sidebar"
      :style="{ width: sidebarWidth + 'px' }"
      class="h-full border-r border-gray-200 flex flex-col"
      style="background-color: #f5f7f9; min-width: 200px; max-width: 600px;"
    >
      <div class="p-4 border-b border-gray-200">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-lg font-bold text-gray-900">Components</h2>
          <button
            @click="togglePicker"
            :class="[
              'w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer',
              pickerActive
                ? 'text-white hover:opacity-90'
                : 'text-gray-600 hover:bg-gray-200'
            ]"
            :style="pickerActive ? 'background-color: #477be4;' : ''"
            :title="pickerActive ? 'Cancel element picker' : 'Select an element in the page to inspect it'"
          >
            <Pointer :size="16" :stroke-width="2" />
          </button>
        </div>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Filter..."
          class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div class="flex-1 overflow-auto p-2">
        <div v-if="loading" class="p-4 text-gray-600 text-sm">
          Loading components...
        </div>

        <div v-else-if="components.length === 0" class="p-4 text-gray-600 text-sm">
          No components found
        </div>

        <div v-else class="space-y-1">
          <button
            v-for="component in filteredComponents"
            :key="component.id"
            :ref="el => { if (selectedComponent === component.id) selectedComponentEl = el }"
            @click="selectComponent(component.id)"
            :class="[
              'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer',
              selectedComponent === component.id
                ? 'text-white shadow-sm'
                : component.isMatch
                  ? 'text-gray-700 hover:bg-white hover:shadow-sm'
                  : 'text-gray-400 hover:bg-white hover:shadow-sm'
            ]"
            :style="{
              paddingLeft: `${component.depth * 16 + 12}px`,
              ...(selectedComponent === component.id ? { 'background-color': '#477be4' } : {})
            }"
          >
            {{ component.name }}
          </button>
        </div>
      </div>

      <div class="p-3 border-t border-gray-200">
        <button
          @click="refreshComponents"
          class="w-full px-3 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium hover:shadow-md transition-all duration-200 cursor-pointer"
        >
          Refresh
        </button>
      </div>
    </div>

    <!-- Resize handle -->
    <div
      @mousedown="startResize"
      class="w-1 h-full cursor-col-resize hover:bg-blue-400 transition-colors"
      style="background-color: #d1d5db;"
    ></div>

    <!-- Main content area -->
    <div class="flex-1 overflow-auto p-6 flex flex-col">
      <div v-if="selectedComponent">
        <!-- Header with controls -->
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-bold text-gray-900">{{ selectedComponentName }}</h1>

            <!-- Reveal in page button -->
            <button
              @click="revealInPage"
              class="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer text-gray-600 hover:bg-gray-100"
              title="Reveal component in page"
            >
              <Locate :size="18" :stroke-width="2" />
            </button>
          </div>

          <div class="flex items-center gap-2">
            <!-- Manual refresh button -->
            <button
              @click="manualRefresh"
              :class="[
                'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer text-gray-600 hover:bg-gray-100',
                (stateLoading || isRefreshing) && 'animate-spin'
              ]"
              :title="'Refresh now'"
            >
              <RefreshCw :size="18" :stroke-width="2" />
            </button>

            <!-- Auto-refresh toggle -->
            <button
              @click="toggleAutoRefresh"
              :class="[
                'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer',
                autoRefresh
                  ? 'text-white hover:opacity-90'
                  : 'text-gray-600 hover:bg-gray-100'
              ]"
              :style="autoRefresh ? 'background-color: #477be4;' : ''"
              :title="autoRefresh ? 'Auto-refresh: ON (click to pause)' : 'Auto-refresh: OFF (click to start)'"
            >
              <Pause v-if="autoRefresh" :size="18" :stroke-width="2" />
              <Play v-else :size="18" :stroke-width="2" />
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="flex gap-2 mb-4 border-b border-gray-200">
          <button
            @click="activeTab = 'state'"
            :class="[
              'px-4 py-2 font-medium text-sm transition-all duration-200 cursor-pointer rounded-t-lg',
              activeTab === 'state'
                ? 'text-white'
                : 'text-gray-600 hover:bg-gray-100'
            ]"
            :style="activeTab === 'state' ? 'background-color: #477be4;' : ''"
          >
            State
          </button>
          <button
            @click="activeTab = 'events'"
            :class="[
              'px-4 py-2 font-medium text-sm transition-all duration-200 cursor-pointer rounded-t-lg',
              activeTab === 'events'
                ? 'text-white'
                : 'text-gray-600 hover:bg-gray-100'
            ]"
            :style="activeTab === 'events' ? 'background-color: #477be4;' : ''"
          >
            Events
          </button>
        </div>

        <!-- State tab content -->
        <div v-if="activeTab === 'state'" class="flex-1 flex flex-col">
          <div v-if="componentState" class="bg-white rounded-lg border border-gray-200 p-4 overflow-auto flex-1">
            <JsonTree :data="componentState" />
          </div>
          <div v-else-if="stateLoading" class="text-gray-600 text-center py-8">
            Loading state...
          </div>
          <div v-else class="text-gray-600 text-center py-8">
            No state data available
          </div>
        </div>

        <!-- Events tab content -->
        <div v-else-if="activeTab === 'events'" class="flex-1 flex flex-col">
          <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Event Name</label>
              <input
                v-model="eventName"
                type="text"
                placeholder="e.g., click, update, custom-event"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                @keydown.enter="emitEvent"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Event Data (optional JSON)</label>
              <textarea
                v-model="eventData"
                rows="6"
                placeholder='{ "key": "value" }'
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                @keydown.enter="emitEvent"
              ></textarea>
            </div>

            <button
              @click="emitEvent"
              class="w-full px-4 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all duration-200 cursor-pointer"
              style="background-color: #477be4;"
            >
              Emit Event
            </button>
          </div>
        </div>
      </div>
      <div v-else class="text-gray-600">
        Select a component to view its details
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import JsonTree from './JsonTree.vue'
import { RefreshCw, Play, Pause, Pointer, Locate } from 'lucide-vue-next'

const components = ref([])
const selectedComponent = ref(null)
const loading = ref(true)
const componentState = ref(null)
const stateLoading = ref(false)
const isRefreshing = ref(false)
const autoRefresh = ref(true)
let pollInterval = null
const sidebarWidth = ref(256)
const sidebar = ref(null)
let isResizing = false
const searchQuery = ref('')
const pickerActive = ref(false)
let selectedComponentEl = null
const activeTab = ref('state')
const eventName = ref('')
const eventData = ref('')

const filteredComponents = computed(() => {
  if (!searchQuery.value) {
    return components.value.map(c => ({ ...c, isMatch: true }))
  }

  const query = searchQuery.value.toLowerCase()

  // Find all matching components
  const matches = new Set()
  const ancestorsToInclude = new Set()

  components.value.forEach(component => {
    if (component.name.toLowerCase().includes(query)) {
      matches.add(component.id)

      // Add all ancestors of this match
      let currentId = component.parentId
      while (currentId !== null && currentId !== undefined) {
        ancestorsToInclude.add(currentId)
        const parent = components.value.find(c => c.id === currentId)
        if (!parent) break
        currentId = parent.parentId
      }
    }
  })

  // Filter to include matches and their ancestors, with isMatch flag
  return components.value
    .filter(c => matches.has(c.id) || ancestorsToInclude.has(c.id))
    .map(c => ({
      ...c,
      isMatch: matches.has(c.id)
    }))
})

const selectedComponentName = computed(() => {
  if (!selectedComponent.value) return ''
  const component = components.value.find(c => c.id === selectedComponent.value)
  return component?.name || ''
})

const fetchComponents = async () => {
  loading.value = true
  try {
    if (window.vueDevTools && window.vueDevTools.getComponents) {
      const componentsList = await window.vueDevTools.getComponents()
      components.value = componentsList || []

      // Auto-select first component if available
      if (components.value.length > 0 && !selectedComponent.value) {
        selectedComponent.value = components.value[0].id
      }
    }
  } catch (error) {
    console.error('Error fetching components:', error)
  } finally {
    loading.value = false
  }
}

const fetchComponentState = async (isBackgroundRefresh = false) => {
  if (!selectedComponent.value) return

  // Only show loading state for initial load, not background refreshes
  if (!isBackgroundRefresh && !componentState.value) {
    stateLoading.value = true
  } else if (isBackgroundRefresh) {
    isRefreshing.value = true
  }

  try {
    if (window.vueDevTools && window.vueDevTools.getComponentState) {
      const state = await window.vueDevTools.getComponentState(selectedComponent.value)
      componentState.value = state
    }
  } catch (error) {
    console.error('Error fetching component state:', error)
  } finally {
    stateLoading.value = false
    isRefreshing.value = false
  }
}

const selectComponent = (componentId) => {
  selectedComponent.value = componentId
}

const refreshComponents = () => {
  fetchComponents()
}

const manualRefresh = () => {
  fetchComponentState(false)
}

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value
}

const revealInPage = async () => {
  if (!selectedComponent.value) return

  try {
    if (window.vueDevTools && window.vueDevTools.revealComponentInPage) {
      await window.vueDevTools.revealComponentInPage(selectedComponent.value)
    }
  } catch (error) {
    console.error('Error revealing component in page:', error)
  }
}

const emitEvent = async () => {
  if (!selectedComponent.value || !eventName.value) return

  try {
    // Parse event data if provided
    let parsedData = undefined
    if (eventData.value.trim()) {
      try {
        parsedData = JSON.parse(eventData.value)
      } catch (e) {
        console.error('Invalid JSON in event data:', e)
        return
      }
    }

    if (window.vueDevTools && window.vueDevTools.emitComponentEvent) {
      await window.vueDevTools.emitComponentEvent(
        selectedComponent.value,
        eventName.value,
        parsedData
      )
    }
  } catch (error) {
    console.error('Error emitting event:', error)
  }
}

const togglePicker = async () => {
  if (pickerActive.value) {
    // Disable picker
    if (window.vueDevTools && window.vueDevTools.disablePicker) {
      await window.vueDevTools.disablePicker()
    }
    pickerActive.value = false
  } else {
    // Enable picker
    if (window.vueDevTools && window.vueDevTools.enablePicker) {
      pickerActive.value = true
      try {
        const componentId = await window.vueDevTools.enablePicker()

        // If a component was selected, disable picker and select it
        if (componentId !== null && componentId !== undefined) {
          pickerActive.value = false

          // Refresh components list first to ensure we have latest data
          await fetchComponents()

          // Select the component
          selectedComponent.value = componentId

          // Scroll to the selected component in the next tick
          await new Promise(resolve => setTimeout(resolve, 100))
          if (selectedComponentEl) {
            selectedComponentEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        } else {
          // Picker was cancelled
          pickerActive.value = false
        }
      } catch (error) {
        console.error('Error with picker:', error)
        pickerActive.value = false
      }
    }
  }
}

const startPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval)
  }

  if (autoRefresh.value && selectedComponent.value) {
    pollInterval = setInterval(() => {
      fetchComponentState(true) // Pass true to indicate background refresh
    }, 1000) // Poll every second
  }
}

const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

// Watch for component selection changes
watch(selectedComponent, (newComponent) => {
  if (newComponent) {
    fetchComponentState()
    if (autoRefresh.value) {
      startPolling()
    }
  } else {
    stopPolling()
    componentState.value = null
  }
})

// Watch for auto-refresh toggle
watch(autoRefresh, (enabled) => {
  if (enabled && selectedComponent.value) {
    startPolling()
  } else {
    stopPolling()
  }
})

onMounted(() => {
  fetchComponents()
})

const startResize = (e) => {
  isResizing = true
  e.preventDefault()

  const onMouseMove = (e) => {
    if (!isResizing) return

    const newWidth = e.clientX - sidebar.value.getBoundingClientRect().left
    if (newWidth >= 200 && newWidth <= 600) {
      sidebarWidth.value = newWidth
    }
  }

  const onMouseUp = () => {
    isResizing = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

onUnmounted(() => {
  stopPolling()
})
</script>
