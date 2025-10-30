<template>
    <header class="header">
        <div class="header-container">
            <!-- Left: Logo -->
            <div class="header-logo">
                <router-link to="/">
                    <img src="/images/logo.png" alt="Tea Clan Logo" />
                </router-link>
            </div>

            <!-- Right: Navigation -->
            <nav class="header-nav" :class="{ show: menuOpen }">
                <router-link to="/">
                    <span :class="{ 'active-tab': route.path === '/' }">Homepage</span>
                </router-link>
                <router-link to="/port-sarim">
                    <span :class="{ 'active-tab': route.path === '/port-sarim' }">Port Sarim</span>
                </router-link>
                <router-link to="/how-to-play">
                    <span :class="{ 'active-tab': route.path === '/how-to-play' }">How to play?</span>
                </router-link>
                <router-link to="/fleet-rankings">
                    <span :class="{ 'active-tab': route.path === '/fleet-rankings' }">Fleet Rankings</span>
                </router-link>
            </nav>

            <!-- Hamburger (mobile only) -->
            <div class="hamburger" :class="{ active: menuOpen }" @click="toggleMenu">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    </header>
</template>


<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import '@/assets/header.css';

const route = useRoute();
const menuOpen = ref(false);

function toggleMenu() {
    menuOpen.value = !menuOpen.value;
}
</script>