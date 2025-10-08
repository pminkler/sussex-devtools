<template>
  <div class="json-tree">
    <div v-if="data === null || data === undefined" class="text-gray-500 italic group inline-flex items-center">
      {{ data === null ? 'null' : 'undefined' }}
      <button
        @click="copyToClipboard(data)"
        class="ml-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-gray-400 hover:text-gray-600"
        title="Copy to clipboard"
      >
        <Copy :size="14" :stroke-width="2" />
      </button>
    </div>
    <div v-else-if="isPrimitive(data)" class="inline group">
      <span :class="getValueClass(data)">{{ formatValue(data) }}</span>
      <button
        @click="copyToClipboard(data)"
        class="ml-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-gray-400 hover:text-gray-600 inline-flex items-center"
        title="Copy to clipboard"
      >
        <Copy :size="14" :stroke-width="2" />
      </button>
    </div>
    <div v-else>
      <div v-for="(value, key) in data" :key="key" class="ml-4">
        <div class="flex items-start">
          <button
            v-if="!isPrimitive(value)"
            @click="toggleExpand(key)"
            class="mr-1 text-gray-500 hover:text-gray-700 cursor-pointer flex-shrink-0 w-4 h-4 flex items-center justify-center"
          >
            <span v-if="expanded[key]">▼</span>
            <span v-else>▶</span>
          </button>
          <span v-else class="w-4 mr-1"></span>

          <span class="text-purple-600 font-medium">{{ key }}:</span>

          <span v-if="isPrimitive(value)" class="ml-2 group inline-flex items-center">
            <span :class="getValueClass(value)">{{ formatValue(value) }}</span>
            <button
              @click="copyToClipboard(value)"
              class="ml-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-gray-400 hover:text-gray-600 inline-flex items-center"
              title="Copy to clipboard"
            >
              <Copy :size="14" :stroke-width="2" />
            </button>
          </span>
          <span v-else class="ml-2 text-gray-500">
            {{ getTypeIndicator(value) }}
          </span>
        </div>

        <div v-if="!isPrimitive(value) && expanded[key]" class="ml-4">
          <JsonTree :data="value" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { Copy } from 'lucide-vue-next'
import { copyToClipboard as copyText } from '../utils/clipboard.js'

const props = defineProps({
  data: {
    type: [Object, Array, String, Number, Boolean, null],
    default: null
  }
})

const expanded = reactive({})

const toggleExpand = (key) => {
  expanded[key] = !expanded[key]
}

const isPrimitive = (value) => {
  return value === null ||
         value === undefined ||
         typeof value === 'string' ||
         typeof value === 'number' ||
         typeof value === 'boolean'
}

const getValueClass = (value) => {
  if (value === null || value === undefined) return 'text-gray-500 italic'
  if (typeof value === 'string') return 'text-green-600'
  if (typeof value === 'number') return 'text-blue-600'
  if (typeof value === 'boolean') return 'text-orange-600'
  return ''
}

const formatValue = (value) => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return `"${value}"`
  return String(value)
}

const getTypeIndicator = (value) => {
  if (Array.isArray(value)) {
    return `Array(${value.length})`
  }
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value)
    return `Object {${keys.length} ${keys.length === 1 ? 'property' : 'properties'}}`
  }
  return ''
}

const copyToClipboard = async (value) => {
  let textToCopy = ''

  if (value === null) {
    textToCopy = 'null'
  } else if (value === undefined) {
    textToCopy = 'undefined'
  } else {
    textToCopy = String(value)
  }

  await copyText(textToCopy)
}
</script>

<style scoped>
.json-tree {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
}
</style>
