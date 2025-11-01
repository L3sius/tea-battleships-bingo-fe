<template>
    <div class="optional-bingo-wrapper">
        <h2 class="optional-bingo-title">Uncharted Sea</h2>

        <div class="optional-bingo-top-labels">
            <span v-for="col in columns" :key="col" class="optional-bingo-label">{{ col }}</span>
        </div>

        <div class="optional-bingo-main">
            <div class="optional-bingo-left-labels">
                <span v-for="row in rows" :key="row" class="optional-bingo-label">{{ row }}</span>
            </div>

            <div class="optional-bingo-board">
                <div v-for="(cell, index) in boardFlat" :key="index" class="optional-bingo-cell"
                    :class="{ active: cell }"></div>
            </div>
        </div>

        <!-- Refresh timer label -->
        <div class="refresh-label">Sea refresh timer:</div>
        <!-- Mock time -->
        <div class="refresh-time">23 h 20 min 20 sec</div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import '../assets/optionalBingoBoard.css'

const gridSize = 5

const columns = Array.from({ length: gridSize }, (_, i) =>
    String.fromCharCode(65 + i)
)
const rows = Array.from({ length: gridSize }, (_, i) => i + 1)

const board = ref(
    Array.from({ length: gridSize }, () =>
        Array.from({ length: gridSize }, () => false)
    )
)

const boardFlat = computed(() => board.value.flat())
</script>
