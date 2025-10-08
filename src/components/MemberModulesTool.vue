<template>
  <div class="flex h-full">
    <!-- Secondary sidebar for projects list -->
    <div
      ref="sidebar"
      :style="{ width: sidebarWidth + 'px' }"
      class="h-full border-r border-gray-200 flex flex-col"
      style="background-color: #f5f7f9; min-width: 200px; max-width: 600px;"
    >
      <div class="p-4 border-b border-gray-200">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-lg font-bold text-gray-900">Projects</h2>
          <div class="text-xs text-gray-600">{{ projects.length }} found</div>
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
          Monitoring network requests...
        </div>

        <div v-else-if="filteredProjects.length === 0 && projects.length === 0" class="p-4 text-gray-600 text-sm">
          No member modules detected yet. Load a page that uses member modules.
        </div>

        <div v-else-if="filteredProjects.length === 0" class="p-4 text-gray-600 text-sm">
          No projects match your filter
        </div>

        <div v-else class="space-y-1">
          <button
            v-for="project in filteredProjects"
            :key="`${project.workspace}/${project.project}`"
            @click="selectProject(project)"
            :class="[
              'w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 cursor-pointer',
              selectedProject && selectedProject.workspace === project.workspace && selectedProject.project === project.project
                ? 'text-white shadow-sm'
                : 'text-gray-700 hover:bg-white hover:shadow-sm'
            ]"
            :style="selectedProject && selectedProject.workspace === project.workspace && selectedProject.project === project.project ? 'background-color: #477be4;' : ''"
          >
            <div class="font-medium">{{ project.project }}</div>
            <div class="text-xs opacity-75 mt-0.5">{{ project.workspace }} ({{ project.moduleCount }} modules)</div>
          </button>
        </div>
      </div>

      <div class="p-3 border-t border-gray-200">
        <button
          @click="clearData"
          class="w-full px-3 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium hover:shadow-md transition-all duration-200 cursor-pointer"
        >
          Clear All
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
      <div v-if="selectedProject">
        <!-- Header -->
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">{{ selectedProject.project }}</h1>
            <div class="text-sm text-gray-600 mt-1">
              Workspace: <span class="font-medium">{{ selectedProject.workspace }}</span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              @click="copyToClipboard"
              class="px-3 py-2 text-sm font-medium text-gray-700 bg-white rounded-lg hover:shadow-md transition-all duration-200 cursor-pointer flex items-center gap-2"
              title="Copy project info to clipboard"
            >
              <Copy :size="16" :stroke-width="2" />
              Copy
            </button>
          </div>
        </div>

        <!-- Module list -->
        <div class="bg-white rounded-lg border border-gray-200 p-4 overflow-auto flex-1">
          <h3 class="text-sm font-bold text-gray-900 mb-3">Loaded Modules ({{ selectedProject.modules.length }})</h3>

          <div class="space-y-2">
            <div
              v-for="(module, index) in selectedProject.modules"
              :key="index"
              class="p-3 bg-gray-50 rounded border border-gray-200"
            >
              <div class="text-sm font-mono text-gray-900 break-all">{{ module.file }}</div>
              <div class="text-xs text-gray-500 mt-1">Loaded at {{ formatTimestamp(module.timestamp) }}</div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="text-gray-600">
        <div class="text-center py-8">
          <Network :size="48" :stroke-width="1.5" class="mx-auto text-gray-400 mb-4" />
          <p class="text-lg font-medium">Member Modules Monitor</p>
          <p class="text-sm mt-2">Select a project to view loaded modules</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Copy, Network } from 'lucide-vue-next'
import { copyToClipboard as copyText } from '../utils/clipboard.js'

const projects = ref([])
const selectedProject = ref(null)
const loading = ref(true)
const sidebarWidth = ref(256)
const sidebar = ref(null)
let isResizing = false
const searchQuery = ref('')
let unsubscribe = null

const filteredProjects = computed(() => {
  if (!searchQuery.value) {
    return projects.value
  }

  const query = searchQuery.value.toLowerCase()
  return projects.value.filter(project =>
    project.project.toLowerCase().includes(query) ||
    project.workspace.toLowerCase().includes(query)
  )
})

const fetchProjects = async () => {
  try {
    if (window.memberModulesDevTools && window.memberModulesDevTools.getMemberModules) {
      const projectsList = await window.memberModulesDevTools.getMemberModules()
      projects.value = projectsList || []
    }
  } catch (error) {
    console.error('Error fetching member modules:', error)
  } finally {
    loading.value = false
  }
}

const selectProject = (project) => {
  selectedProject.value = project
}

const clearData = async () => {
  try {
    if (window.memberModulesDevTools && window.memberModulesDevTools.clearMemberModules) {
      await window.memberModulesDevTools.clearMemberModules()
      projects.value = []
      selectedProject.value = null
    }
  } catch (error) {
    console.error('Error clearing member modules:', error)
  }
}

const copyToClipboard = async () => {
  if (!selectedProject.value) return

  const text = `Project: ${selectedProject.value.project}\nWorkspace: ${selectedProject.value.workspace}\nModules: ${selectedProject.value.moduleCount}\n\nLoaded Files:\n${selectedProject.value.modules.map(m => `- ${m.file}`).join('\n')}`

  const success = await copyText(text)
  if (success) {
    console.log('Copied to clipboard')
  }
}

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

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

onMounted(async () => {
  await fetchProjects()

  // Listen for updates
  if (window.memberModulesDevTools && window.memberModulesDevTools.addListener) {
    unsubscribe = window.memberModulesDevTools.addListener(() => {
      fetchProjects()
    })
  }
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})
</script>
