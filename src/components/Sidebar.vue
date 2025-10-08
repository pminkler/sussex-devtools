<template>
  <div class="w-16 h-full flex flex-col items-center py-4 space-y-2" style="background-color: #f5f7f9;">
    <button
      v-for="tool in tools"
      :key="tool.id"
      @click="$emit('select-tool', tool.id)"
      :class="[
        'w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 shadow-sm cursor-pointer',
        selectedTool === tool.id
          ? 'text-white shadow-md scale-105'
          : 'bg-white text-gray-600 hover:text-gray-900 hover:shadow-md hover:scale-105'
      ]"
      :style="selectedTool === tool.id ? 'background-color: #477be4;' : ''"
      :title="tool.name"
    >
      <component :is="tool.icon" :size="20" :stroke-width="2" />
    </button>
  </div>
</template>

<script setup>
import { Database, Box, Network } from 'lucide-vue-next'

defineProps({
  selectedTool: String
})

defineEmits(['select-tool'])

const tools = [
  {
    id: 'pinia',
    name: 'Pinia Store Browser',
    icon: Database
  },
  {
    id: 'components',
    name: 'Component Inspector',
    icon: Box
  },
  {
    id: 'memberModules',
    name: 'Member Modules Monitor',
    icon: Network
  }
]
</script>
