<template>
    <div class="team-list">
        <span v-for="(team, index) in teams" :key="team" class="team-item" :class="{ active: selectedTeam === team }"
            @click="selectTeam(team)">
            {{ team }}
        </span>
    </div>
</template>

<script setup lang="ts">
import '../assets/teamSelection.css'
import { ref } from 'vue'

const teams = ['Tea Clan', 'Cuties Clan']

const selectedTeam = ref(teams[0])

function selectTeam(team: string) {
    selectedTeam.value = team
}
</script>
