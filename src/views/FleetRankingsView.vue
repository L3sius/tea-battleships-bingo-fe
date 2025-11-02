<template>
    <div class="fleet-container">
        <h1 class="fleet-title">Fleet Rankings</h1>

        <div class="fleet-columns">
            <div v-for="column in columns" :key="column.title" class="fleet-card">
                <div class="fleet-card-header">
                    <h2 class="fleet-card-title">{{ column.title }}</h2>
                    <select v-model="selectedClans[column.title]" class="fleet-filter">
                        <option value="">ALL</option>
                        <option v-for="clan in clans" :key="clan" :value="clan">
                            {{ clan }}
                        </option>
                    </select>
                </div>

                <div class="fleet-card-content">
                    <p>Coming soon...</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import '@/assets/fleetRankingsView.css'
import { ref } from 'vue'

const columns = [
    { title: 'Bounty' },
    { title: 'Last Voyage' },
    { title: 'Active Sea Encounters' },
    { title: "Captain's Log" }
]

const clans = ['Tea Clan', 'Chickens Clan']

const selectedClans = ref<Record<string, string>>({
    'Bounty': '',
    'Last Voyage': '',
    'Active Sea Encounters': '',
    "Captain's Log": ''
})
</script>
