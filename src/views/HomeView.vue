<script setup lang="ts">
import '@/assets/homeView.css'
import BingoBoard from '@/components/BingoBoard.vue';
import OptionalBingoBoard from '@/components/OptionalBingoBoard.vue';
import TeamSelection from '@/components/TeamSelection.vue';
</script>

<template>
  <div class="home-container">
    <img src="/images/logo.png" alt="Tea Clan Logo" class="home-logo" />
    <TeamSelection />
    <div class="board-wrapper">
      <BingoBoard />
      <OptionalBingoBoard />
    </div>
  </div>
</template>