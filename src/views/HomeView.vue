<script setup lang="ts">
import '@/assets/homeView.css'
import TeamSelection from '@/components/TeamSelection.vue';
</script>

<template>
  <div class="home-container">
    <img src="/images/logo.png" alt="Tea Clan Logo" class="home-logo" />
    <TeamSelection />
  </div>
  <!-- <BingoBoard /> -->
</template>