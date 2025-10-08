<template>
  <div class="flex h-screen" style="background-color: #f5f7f9;">
    <Sidebar :selected-tool="selectedTool" @select-tool="selectTool" />

    <div class="w-px bg-gray-300"></div>

    <main class="flex-1 overflow-auto">
      <component :is="currentToolComponent" />
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import Sidebar from './components/Sidebar.vue'
import PiniaTool from './components/PiniaTool.vue'
import ComponentTool from './components/ComponentTool.vue'
import MemberModulesTool from './components/MemberModulesTool.vue'

const selectedTool = ref('pinia')

const tools = {
  pinia: PiniaTool,
  components: ComponentTool,
  memberModules: MemberModulesTool
}

const currentToolComponent = computed(() => {
  return tools[selectedTool.value]
})

const selectTool = (toolId) => {
  selectedTool.value = toolId
}
</script>
