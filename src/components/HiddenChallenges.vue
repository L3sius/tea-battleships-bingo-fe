<template>
    <div :class="['hidden-challenges', { full }]">
        <div class="hidden-challenges-header">
            <h3 class="hidden-challenges-title" :class="{ compact: !full }">Hidden Challenges</h3>
            <div class="hidden-challenges-rule" />
            <span class="hidden-challenges-count">{{ revealedCount }}/{{ tasks.length }}</span>
        </div>

        <div class="challenges-grid" :class="{ full }">
            <div v-for="task in tasks" :key="task.id" class="challenge-card" :class="statusClass(task)"
                @click="task.revealed && (detail = task)">
                <span class="challenge-status-pill" :class="statusClass(task)">{{ statusLabel(task) }}</span>

                <div v-if="!task.revealed" class="challenge-locked">
                    <span class="challenge-unknown">?</span>
                </div>
                <div v-else class="challenge-revealed">
                    <span class="challenge-title">{{ task.title }}</span>
                    <span v-if="full && task.caption" class="challenge-caption">{{ task.caption }}</span>
                    <span v-if="task.completions?.length" class="challenge-completed-by">
                        <span class="challenge-dot" />
                        <span class="challenge-cb-names">{{ full ? completedBy(task) : completedNames(task) }}</span>
                    </span>
                </div>
            </div>
        </div>

        <div v-if="detail" class="challenge-detail-backdrop" @click.self="detail = null">
            <div class="challenge-detail">
                <div class="challenge-detail-header">
                    <div>
                        <h3 class="challenge-detail-title">{{ detail.title }}</h3>
                        <span class="challenge-status-pill" :class="statusClass(detail)">{{ statusLabel(detail) }}</span>
                    </div>
                    <button class="challenge-detail-close" @click="detail = null">✕</button>
                </div>
                <p v-if="detail.caption" class="challenge-detail-caption">{{ detail.caption }}</p>
                <p v-if="detail.description" class="challenge-detail-description">{{ detail.description }}</p>
                <div v-if="detail.completions?.length" class="challenge-detail-completions">
                    <label class="challenge-detail-label">Completed By</label>
                    <div v-for="c in detail.completions" :key="c.teamId + c.completedBy" class="challenge-detail-completion">
                        {{ c.completedBy }} <span class="challenge-detail-team">({{ c.teamName }})</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import '@/assets/hiddenChallenges.css'
import { ref, computed } from 'vue'
import type { BonusTask } from '@/api/types'

const props = defineProps<{ tasks: BonusTask[]; full?: boolean }>()

const detail = ref<BonusTask | null>(null)

const revealedCount = computed(() => props.tasks.filter((t) => t.revealed).length)

function statusClass(task: BonusTask): string {
    if (!task.revealed) return 'locked'
    return task.completions?.length ? 'completed' : 'revealed'
}

function statusLabel(task: BonusTask): string {
    if (!task.revealed) return 'Locked'
    return task.completions?.length ? 'Completed' : 'Revealed'
}

function completedBy(task: BonusTask): string | null {
    if (!task.completions?.length) return null
    return task.completions.map((c) => `${c.completedBy} (${c.teamName})`).join(', ')
}

// Compact tiles show just the names — the team is obvious from context and the
// full "name (Team)" form is too long for a board-cell-sized tile.
function completedNames(task: BonusTask): string {
    return (task.completions ?? []).map((c) => c.completedBy).join(', ')
}
</script>
