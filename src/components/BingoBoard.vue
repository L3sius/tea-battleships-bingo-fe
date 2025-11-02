<template>
    <div class="bingo-wrapper">
        <h2 class="bingo-title">Bloody Waters</h2>

        <div class="bingo-top-labels">
            <span v-for="col in columns" :key="col" class="bingo-label">{{ col }}</span>
        </div>

        <div class="bingo-main">
            <div class="bingo-left-labels">
                <span v-for="row in rows" :key="row" class="bingo-label">{{ row }}</span>
            </div>

            <div class="bingo-board">
                <div v-for="(cell, index) in boardFlat" :key="index" class="bingo-cell" :class="{ active: cell }"></div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import '../assets/bingoBoard.css'

const gridSize = 10

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
