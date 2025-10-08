<template>
  <div class="flex h-full">
    <!-- Secondary sidebar for store list -->
    <div
      ref="sidebar"
      :style="{ width: sidebarWidth + 'px' }"
      class="h-full border-r border-gray-200 flex flex-col"
      style="background-color: #f5f7f9; min-width: 200px; max-width: 600px;"
    >
      <div class="p-4 border-b border-gray-200">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-lg font-bold text-gray-900">Stores</h2>
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
          Loading stores...
        </div>

        <div v-else-if="stores.length === 0" class="p-4 text-gray-600 text-sm">
          No stores found
        </div>

        <div v-else class="space-y-1">
          <button
            v-for="store in filteredStores"
            :key="store"
            @click="selectStore(store)"
            :class="[
              'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer',
              selectedStore === store
                ? 'text-white shadow-sm'
                : 'text-gray-700 hover:bg-white hover:shadow-sm'
            ]"
            :style="selectedStore === store ? 'background-color: #477be4;' : ''"
          >
            {{ store }}
          </button>
        </div>
      </div>

      <div class="p-3 border-t border-gray-200">
        <button
          @click="refreshStores"
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
      <div v-if="selectedStore">
        <!-- Header with controls -->
        <div class="mb-4 flex items-center justify-between">
          <h1 class="text-2xl font-bold text-gray-900">{{ selectedStore }}</h1>

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

        <!-- State display -->
        <div v-if="storeState" class="bg-white rounded-lg border border-gray-200 p-4 overflow-auto flex-1">
          <JsonTree :data="storeState" />
        </div>
        <div v-else-if="stateLoading" class="text-gray-600 text-center py-8">
          Loading state...
        </div>
        <div v-else class="text-gray-600 text-center py-8">
          No state data available
        </div>
      </div>
      <div v-else class="text-gray-600">
        Select a store to view its details
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import JsonTree from './JsonTree.vue'
import { RefreshCw, Play, Pause } from 'lucide-vue-next'

const stores = ref([])
const selectedStore = ref(null)
const loading = ref(true)
const storeState = ref(null)
const stateLoading = ref(false)
const isRefreshing = ref(false)
const autoRefresh = ref(true)
const lastUpdated = ref(null)
let pollInterval = null
const sidebarWidth = ref(256)
const sidebar = ref(null)
let isResizing = false
const searchQuery = ref('')

const filteredStores = computed(() => {
  if (!searchQuery.value) {
    return stores.value
  }

  const query = searchQuery.value.toLowerCase()
  return stores.value.filter(store =>
    store.toLowerCase().includes(query)
  )
})

const lastUpdatedText = computed(() => {
  if (!lastUpdated.value) return ''

  const now = Date.now()
  const diff = now - lastUpdated.value

  if (diff < 1000) return 'just now'
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  return `${Math.floor(diff / 3600000)}h ago`
})

const fetchStores = async () => {
  loading.value = true
  try {
    if (window.piniaDevTools && window.piniaDevTools.getStores) {
      const storesList = await window.piniaDevTools.getStores()
      stores.value = storesList || []

      // Auto-select first store if available
      if (stores.value.length > 0 && !selectedStore.value) {
        selectedStore.value = stores.value[0]
      }
    }
  } catch (error) {
    console.error('Error fetching stores:', error)
  } finally {
    loading.value = false
  }
}

const fetchStoreState = async (isBackgroundRefresh = false) => {
  if (!selectedStore.value) return

  // Only show loading state for initial load, not background refreshes
  if (!isBackgroundRefresh && !storeState.value) {
    stateLoading.value = true
  } else if (isBackgroundRefresh) {
    isRefreshing.value = true
  }

  try {
    if (window.piniaDevTools && window.piniaDevTools.getStoreState) {
      const state = await window.piniaDevTools.getStoreState(selectedStore.value)
      storeState.value = state
      lastUpdated.value = Date.now()
    }
  } catch (error) {
    console.error('Error fetching store state:', error)
  } finally {
    stateLoading.value = false
    isRefreshing.value = false
  }
}

const selectStore = (store) => {
  selectedStore.value = store
}

const refreshStores = () => {
  fetchStores()
}

const manualRefresh = () => {
  fetchStoreState(false)
}

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value
}

const startPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval)
  }

  if (autoRefresh.value && selectedStore.value) {
    pollInterval = setInterval(() => {
      fetchStoreState(true) // Pass true to indicate background refresh
    }, 1000) // Poll every second
  }
}

const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

// Watch for store selection changes
watch(selectedStore, (newStore) => {
  if (newStore) {
    fetchStoreState()
    if (autoRefresh.value) {
      startPolling()
    }
  } else {
    stopPolling()
    storeState.value = null
  }
})

// Watch for auto-refresh toggle
watch(autoRefresh, (enabled) => {
  if (enabled && selectedStore.value) {
    startPolling()
  } else {
    stopPolling()
  }
})

onMounted(() => {
  fetchStores()
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
