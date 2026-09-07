<template>
    <div class="team-select">
        <button v-for="team in teams" :key="team.id" class="team-select-item"
            :class="{ active: modelValue === team.id }" :style="teamStyle(team.id)"
            @click="$emit('update:modelValue', team.id)">
            {{ team.name }}
        </button>
    </div>
</template>

<script setup lang="ts">
import '@/assets/teamSelection.css'
import type { Team } from '@/api/types'
import { teamColor } from '@/utils/teamColors'

const props = defineProps<{ teams: Team[]; modelValue: number | null }>()
defineEmits<{ 'update:modelValue': [value: number] }>()

function teamStyle(teamId: number) {
    return { '--team-color': teamColor(props.teams, teamId) }
}
</script>
