<template>
    <div class="panel hidden-challenges">
        <h2 class="panel-title">Hidden Challenges</h2>
        <div class="challenges-grid">
            <div v-for="task in tasks" :key="task.id" class="challenge-tile" :class="{ revealed: task.revealed }"
                :title="tileTitle(task)">
                <span v-if="task.revealed" class="challenge-title">{{ task.title }}</span>
                <span v-else class="challenge-unknown">?</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import '@/assets/hiddenChallenges.css'
import type { BonusTask } from '@/api/types'

defineProps<{ tasks: BonusTask[] }>()

function tileTitle(task: BonusTask): string | undefined {
    if (!task.revealed) return undefined
    const parts = [task.title, task.caption, task.description].filter(Boolean)
    if (task.completions?.length) {
        parts.push(`Completed by: ${task.completions.map((c) => `${c.completedBy} (${c.teamName})`).join(', ')}`)
    }
    return parts.join('\n')
}
</script>
