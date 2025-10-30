<template>
    <div class="bingo-board">
        <div v-for="(col, colIndex) in board" :key="colIndex" class="bingo-col">
            <div v-for="(cell, rowIndex) in col" :key="rowIndex" class="bingo-cell" :class="{ active: cell }"></div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import '../assets/bingoBoard.css'

const gridSize = 10
const board = ref(
    Array.from({ length: gridSize }, () =>
        Array.from({ length: gridSize }, () => false)
    )
)
</script>
