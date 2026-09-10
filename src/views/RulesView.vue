<template>
    <div class="rules-view">
        <h1 class="rules-title">Event Rules</h1>

        <div v-for="section in sections" :key="section.title" class="rules-card">
            <h2 class="rules-card-title">{{ section.title }}</h2>
            <p class="rules-card-body">{{ section.body }}</p>
        </div>
    </div>
</template>

<script setup lang="ts">
import '@/assets/rulesView.css'

const sections = [
    {
        title: 'The Boards',
        body: 'Each team has its own 10×10 board filled with OSRS task tiles (A–J across, 1–10 down). Complete a task to unlock that tile and earn a shot you can fire at the enemy board.',
    },
    {
        title: 'Firing',
        body: 'Click any unlocked tile on your own board and confirm to fire that shot at the same coordinate on the enemy board. A coordinate hiding part of an enemy ship scores a hit; an empty one scores a miss.',
    },
    {
        title: 'Ships',
        body: 'Each team’s hidden fleet has 5 ships: Carrier (5 tiles), Battleship (4), Cruiser (3), Submarine (3), and Destroyer (2). Sink every ship in a fleet to eliminate that team.',
    },
    {
        title: 'Hidden Challenges',
        body: 'Bonus challenges unlock as the event progresses. Completing one reveals its details for everyone and credits your team with the completion.',
    },
    {
        title: 'Winning',
        body: 'The first team to sink an opponent’s entire fleet wins the event.',
    },
]
</script>
